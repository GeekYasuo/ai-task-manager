import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';

import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { initializeAI } from './config/openai';
import { setupRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { setupWebSocket } from './services/websocketService';

// Load environment variables
dotenv.config();

class AITaskManagerServer {
  public app: express.Application;
  public server: any;
  public io: SocketServer;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3001');
    this.server = createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
  }

  /**
   * Initialize database connections
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await connectDatabase();
      await connectRedis();
      logger.info('🗄️  Database connections established');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }

  /**
   * Setup middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      type: ['application/json', 'text/plain']
    }));
    this.app.use(express.urlencoded({ 
      extended: true,
      limit: '10mb'
    }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip} - ${req.get('User-Agent')}`);
      next();
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Readiness check
    this.app.get('/ready', (req, res) => {
      res.status(200).json({
        status: 'ready',
        services: {
          database: 'connected',
          redis: 'connected',
          ai: 'initialized'
        }
      });
    });
  }

  /**
   * Setup API documentation
   */
  private initializeSwagger(): void {
    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'AI Task Manager API',
          version: '1.0.0',
          description: 'Intelligent task management system with AI-powered features',
          contact: {
            name: 'Himanshu Singh',
            url: 'https://github.com/GeekYasuo',
            email: 'himanshu@example.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: process.env.API_URL || 'http://localhost:3001/api',
            description: 'Development server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
        }
      },
      apis: ['./src/routes/*.ts', './src/controllers/*.ts']
    };

    const specs = swaggerJsdoc(options);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'AI Task Manager API Documentation'
    }));
  }

  /**
   * Setup routes
   */
  private initializeRoutes(): void {
    setupRoutes(this.app, this.io);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Initialize AI services
   */
  private async initializeAI(): Promise<void> {
    try {
      await initializeAI();
      logger.info('🤖 AI services initialized');
    } catch (error) {
      logger.error('❌ AI initialization failed:', error);
      // Don't exit, AI features will be disabled
    }
  }

  /**
   * Setup WebSocket connections
   */
  private initializeWebSocket(): void {
    setupWebSocket(this.io);
    logger.info('🔌 WebSocket server initialized');
  }

  /**
   * Graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      logger.info(`📴 Received ${signal}. Starting graceful shutdown...`);

      this.server.close(() => {
        logger.info('🛑 Server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Initialize all services
      await this.initializeDatabase();
      await this.initializeAI();

      // Setup middleware and routes
      this.initializeMiddleware();
      this.initializeSwagger();
      this.initializeRoutes();
      this.initializeWebSocket();
      this.setupGracefulShutdown();

      // Start server
      this.server.listen(this.port, () => {
        logger.info(`🚀 AI Task Manager API running on port ${this.port}`);
        logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`🤖 AI Features: Enabled`);
        logger.info(`📖 API Documentation: http://localhost:${this.port}/api-docs`);
        logger.info(`💓 Health Check: http://localhost:${this.port}/health`);
      });

    } catch (error) {
      logger.error('💥 Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the application
const server = new AITaskManagerServer();
server.start().catch(error => {
  logger.error('🚨 Startup error:', error);
  process.exit(1);
});

export default server;