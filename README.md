# 🤖 AI-Powered Task Manager

![AI Task Manager](https://img.shields.io/badge/AI-Powered-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white) ![OpenAI](https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white)

> **Intelligent task management system that leverages AI to optimize productivity, predict deadlines, and provide personalized insights for enhanced workflow management.**

## ✨ Features

### 🤖 AI-Powered Intelligence
- **Smart Task Prioritization**: GPT-4 analyzes task content and context to suggest optimal priorities
- **Deadline Prediction**: ML models predict realistic completion times based on complexity and history
- **Natural Language Processing**: Create tasks using natural language with automatic parsing
- **Voice-to-Task**: Convert voice recordings into structured tasks with AI transcription
- **Sentiment Analysis**: Monitor team morale and task satisfaction through sentiment tracking

### 🎯 Productivity Enhancement
- **Intelligent Scheduling**: AI suggests optimal time slots based on your productivity patterns
- **Smart Notifications**: ML-powered notification timing to maximize focus and minimize interruption
- **Productivity Analytics**: Deep insights into work patterns, bottlenecks, and optimization opportunities
- **Automated Time Tracking**: Intelligent detection of task switches and time allocation
- **Focus Mode**: AI-driven distraction blocking and optimal work environment suggestions

### 🔗 Advanced Integration
- **Real-time Collaboration**: Socket.io powered live updates and team synchronization
- **API-First Design**: RESTful API with comprehensive documentation
- **Webhook Support**: Real-time notifications to external systems
- **Third-party Integrations**: Slack, Microsoft Teams, Google Calendar support

## 🏗 Architecture

```mermaid
graph TB
    A[Frontend - React + TypeScript] --> B[API Gateway]
    B --> C[Backend Services]
    C --> D[PostgreSQL Database]
    C --> E[Redis Cache]
    C --> F[AI Services]
    F --> G[OpenAI GPT-4]
    F --> H[TensorFlow.js]
    I[Socket.io] --> A
    I --> C
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- OpenAI API Key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/GeekYasuo/ai-task-manager.git
cd ai-task-manager
```

2. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your OpenAI API key and other configurations
```

3. **Start with Docker (Recommended)**
```bash
docker-compose up -d
```

4. **Or run manually**
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm start
```

5. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- API Docs: http://localhost:3001/api-docs

## 📊 API Documentation

### Authentication
```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
```

### Task Management
```http
GET    /api/tasks              # Get user tasks
POST   /api/tasks              # Create task with AI analysis
PUT    /api/tasks/:id          # Update task
DELETE /api/tasks/:id          # Delete task
```

### AI Features
```http
POST   /api/ai/analyze-task    # Get AI task analysis
GET    /api/ai/insights        # Get productivity insights
POST   /api/ai/voice-to-task   # Convert voice to task
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests
cd frontend
npm test
```

## 🐳 Docker

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_openai_key_here
DATABASE_URL=postgresql://user:pass@localhost:5432/taskdb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret

# Optional
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 📈 Performance

- **API Response Time**: < 200ms average
- **AI Analysis**: < 2s for complex tasks
- **Real-time Updates**: < 50ms latency
- **Concurrent Users**: 1000+ supported

## 🔒 Security

- JWT authentication with refresh tokens
- Rate limiting (100 requests/15min)
- Input validation and sanitization
- SQL injection prevention
- CORS protection
- Security headers with Helmet.js

## 🚀 Deployment

### AWS ECS
```bash
docker build -t ai-task-manager .
docker tag ai-task-manager:latest your-ecr-repo
docker push your-ecr-repo
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- The amazing TypeScript and React communities
- All contributors and testers

---

**Built with ❤️ by Himanshu Singh**
