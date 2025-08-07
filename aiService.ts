import OpenAI from 'openai';
import * as tf from '@tensorflow/tfjs-node';
import natural from 'natural';
import { logger } from '../utils/logger';
import { RedisClient } from '../config/redis';
import { CustomError } from '../utils/errors';

interface TaskAnalysis {
  priority: number;
  estimatedHours: number;
  complexity: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'negative' | 'neutral';
  tags: string[];
  deadlineUrgency: number;
  suggestedSubtasks: string[];
  optimalTimeSlot: 'morning' | 'afternoon' | 'evening' | 'flexible';
  confidenceScore: number;
}

interface ProductivityInsight {
  type: 'pattern' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestions: string[];
}

export class AIService {
  private static openai: OpenAI;
  private static sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
  private static tokenizer = new natural.WordTokenizer();
  private static isInitialized = false;

  /**
   * Initialize AI service
   */
  static initialize(): void {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('⚠️  OpenAI API key not provided. AI features will be disabled.');
      return;
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
      maxRetries: 3
    });

    this.isInitialized = true;
    logger.info('🤖 AI Service initialized with OpenAI GPT-4');
  }

  /**
   * Analyze task content using AI to extract insights
   */
  static async analyzeTask(title: string, description: string, context?: any): Promise<TaskAnalysis> {
    try {
      if (!this.isInitialized) {
        return this.fallbackAnalysis(title, description);
      }

      // Check cache first
      const cacheKey = `task_analysis:${Buffer.from(title + description).toString('base64')}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) {
        logger.info('📋 Using cached task analysis');
        return JSON.parse(cached);
      }

      const prompt = this.buildAnalysisPrompt(title, description, context);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert productivity consultant and project manager with deep understanding of task complexity, time estimation, and workflow optimization. Analyze tasks comprehensively and provide actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
        top_p: 0.9
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('Empty response from OpenAI');
      }

      let analysis: Partial<TaskAnalysis>;
      try {
        // Extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn('⚠️  Failed to parse AI response, using fallback');
        return this.fallbackAnalysis(title, description);
      }

      // Sentiment analysis using Natural
      const sentimentScore = this.analyzeSentiment(description);

      const finalAnalysis: TaskAnalysis = {
        priority: this.validateRange(analysis.priority, 1, 10, 5),
        estimatedHours: this.validateRange(analysis.estimatedHours, 0.5, 40, 2),
        complexity: this.validateComplexity(analysis.complexity),
        sentiment: sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral',
        tags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 8) : [],
        deadlineUrgency: this.validateRange(analysis.deadlineUrgency, 1, 10, 5),
        suggestedSubtasks: Array.isArray(analysis.suggestedSubtasks) ? analysis.suggestedSubtasks.slice(0, 5) : [],
        optimalTimeSlot: this.validateTimeSlot(analysis.optimalTimeSlot),
        confidenceScore: this.calculateConfidenceScore(analysis)
      };

      // Cache for 1 hour
      await RedisClient.setex(cacheKey, 3600, JSON.stringify(finalAnalysis));

      logger.info(`🔍 AI task analysis completed with ${finalAnalysis.confidenceScore}% confidence`);
      return finalAnalysis;

    } catch (error) {
      logger.error('❌ AI task analysis failed:', error);
      return this.fallbackAnalysis(title, description);
    }
  }

  /**
   * Generate smart task suggestions based on user's history and patterns
   */
  static async generateTaskSuggestions(userId: string, context: string, limit = 5): Promise<string[]> {
    try {
      if (!this.isInitialized) {
        return this.getDefaultSuggestions();
      }

      const cacheKey = `task_suggestions:${userId}:${Buffer.from(context).toString('base64')}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const prompt = `Based on this user context: "${context}"
        Generate ${limit} specific, actionable task suggestions that would be valuable and relevant.

        Return ONLY a JSON array of strings, no other text.
        Make them practical, immediately actionable, and varied in scope.
        Consider different areas: planning, execution, review, optimization, learning.

        Example format: ["Task 1", "Task 2", "Task 3"]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 400
      });

      const suggestions = JSON.parse(response.choices[0]?.message?.content || '[]');

      // Cache for 30 minutes
      await RedisClient.setex(cacheKey, 1800, JSON.stringify(suggestions));

      return Array.isArray(suggestions) ? suggestions.slice(0, limit) : this.getDefaultSuggestions();

    } catch (error) {
      logger.error('❌ Task suggestion generation failed:', error);
      return this.getDefaultSuggestions();
    }
  }

  /**
   * Generate productivity insights based on user data
   */
  static async generateProductivityInsights(userData: any): Promise<ProductivityInsight[]> {
    try {
      if (!this.isInitialized) {
        return this.getDefaultInsights();
      }

      const prompt = `Analyze this productivity data and generate actionable insights:

        User Data: ${JSON.stringify(userData, null, 2)}

        Generate 3-5 insights as a JSON array with this structure:
        {
          "type": "pattern|recommendation|warning|achievement",
          "title": "Brief title",
          "description": "Detailed description",
          "impact": "high|medium|low",
          "actionable": true|false,
          "suggestions": ["suggestion1", "suggestion2"]
        }

        Focus on patterns, inefficiencies, strengths, and specific recommendations.
        Return ONLY the JSON array.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1000
      });

      const insights = JSON.parse(response.choices[0]?.message?.content || '[]');
      return Array.isArray(insights) ? insights : this.getDefaultInsights();

    } catch (error) {
      logger.error('❌ Productivity insights generation failed:', error);
      return this.getDefaultInsights();
    }
  }

  /**
   * Convert voice transcription to structured task
   */
  static async parseVoiceToTask(transcription: string): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new CustomError('AI service not available', 503);
      }

      const prompt = `Convert this voice transcription into a structured task:
        "${transcription}"

        Extract and return JSON with:
        {
          "title": "brief, actionable title (max 100 chars)",
          "description": "detailed description based on transcription",
          "priority": number 1-10,
          "estimatedHours": number,
          "dueDate": "YYYY-MM-DD or null if not mentioned",
          "tags": ["tag1", "tag2"],
          "category": "work|personal|learning|health|other"
        }

        If transcription is unclear, make reasonable assumptions.
        Return ONLY the JSON object.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const taskData = JSON.parse(response.choices[0]?.message?.content || '{}');

      // Validate and sanitize
      return {
        title: taskData.title || 'Voice Task',
        description: taskData.description || transcription,
        priority: this.validateRange(taskData.priority, 1, 10, 5),
        estimatedHours: this.validateRange(taskData.estimatedHours, 0.5, 20, 1),
        dueDate: this.validateDate(taskData.dueDate),
        tags: Array.isArray(taskData.tags) ? taskData.tags.slice(0, 5) : ['voice'],
        category: taskData.category || 'other'
      };

    } catch (error) {
      logger.error('❌ Voice to task conversion failed:', error);
      throw new CustomError('Failed to process voice input', 500);
    }
  }

  // Helper methods
  private static buildAnalysisPrompt(title: string, description: string, context?: any): string {
    return `Analyze this task comprehensively:

Title: "${title}"
Description: "${description}"
${context ? `Context: ${JSON.stringify(context)}` : ''}

Provide analysis as JSON:
{
  "priority": <1-10, business impact and urgency>,
  "estimatedHours": <realistic hours needed>,
  "complexity": "low|medium|high",
  "deadlineUrgency": <1-10, how time-sensitive>,
  "tags": ["relevant", "keywords", "max8"],
  "suggestedSubtasks": ["subtask1", "subtask2", "max5"],
  "optimalTimeSlot": "morning|afternoon|evening|flexible"
}

Consider: technical complexity, dependencies, business value, time sensitivity, required skills.`;
  }

  private static analyzeSentiment(text: string): number {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    if (!tokens || tokens.length === 0) return 0;

    const stemmedTokens = tokens.map(token => natural.PorterStemmer.stem(token));
    return this.sentiment.getSentiment(stemmedTokens);
  }

  private static validateRange(value: any, min: number, max: number, defaultValue: number): number {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) return defaultValue;
    return Math.round(num * 10) / 10; // Round to 1 decimal
  }

  private static validateComplexity(value: any): 'low' | 'medium' | 'high' {
    const validValues = ['low', 'medium', 'high'];
    return validValues.includes(value) ? value : 'medium';
  }

  private static validateTimeSlot(value: any): 'morning' | 'afternoon' | 'evening' | 'flexible' {
    const validValues = ['morning', 'afternoon', 'evening', 'flexible'];
    return validValues.includes(value) ? value : 'flexible';
  }

  private static validateDate(dateString: any): string | null {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) ? dateString : null;
  }

  private static calculateConfidenceScore(analysis: any): number {
    let score = 85; // Base confidence

    // Reduce confidence for missing or invalid data
    if (!analysis.priority) score -= 10;
    if (!analysis.estimatedHours) score -= 10;
    if (!Array.isArray(analysis.tags) || analysis.tags.length === 0) score -= 5;
    if (!Array.isArray(analysis.suggestedSubtasks)) score -= 5;

    return Math.max(Math.min(score, 99), 60);
  }

  private static fallbackAnalysis(title: string, description: string): TaskAnalysis {
    const text = (title + ' ' + description).toLowerCase();
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'deadline'];
    const complexKeywords = ['refactor', 'architecture', 'design', 'research', 'analysis', 'integration'];

    const isUrgent = urgentKeywords.some(keyword => text.includes(keyword));
    const isComplex = complexKeywords.some(keyword => text.includes(keyword));

    return {
      priority: isUrgent ? 8 : isComplex ? 6 : 4,
      estimatedHours: isComplex ? 6 : 2,
      complexity: isComplex ? 'high' : 'medium',
      sentiment: 'neutral',
      tags: this.extractKeywords(text),
      deadlineUrgency: isUrgent ? 9 : 5,
      suggestedSubtasks: [],
      optimalTimeSlot: 'flexible',
      confidenceScore: 70
    };
  }

  private static extractKeywords(text: string): string[] {
    const words = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !/^(the|and|but|for|are|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|may|new|now|old|see|two|way|who|boy|did|man|use|what|with|have|from|they|know|want|been|good|much|some|time|very|when|come|here|just|like|long|make|many|over|such|take|than|them|well|were)$/i.test(word));

    return [...new Set(words)].slice(0, 5);
  }

  private static getDefaultSuggestions(): string[] {
    return [
      'Review and update project documentation',
      'Schedule weekly team check-in meeting',
      'Conduct code review for recent changes',
      'Plan next sprint activities and priorities',
      'Update task dependencies and blockers'
    ];
  }

  private static getDefaultInsights(): ProductivityInsight[] {
    return [
      {
        type: 'recommendation',
        title: 'Focus Time Optimization',
        description: 'Consider blocking dedicated focus time for complex tasks',
        impact: 'medium',
        actionable: true,
        suggestions: ['Block 2-hour focus sessions', 'Turn off notifications during deep work']
      }
    ];
  }
}