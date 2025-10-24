import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import {
  generalLimiter
} from './middleware/rateLimit.js';
import {
  sendError
} from './utils/responseHandler.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: {
    policy: "cross-origin"
  }
}));
app.use(compression());
app.use(generalLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({
  limit: '10mb'
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Server is running smoothly with Zod validation',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '2025.1.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Error stack:', err.stack);

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, `${field} already exists`, 'DUPLICATE_ENTRY', 409);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return sendError(res, 'Validation failed', 'MONGOOSE_VALIDATION_ERROR', 400, {
      errors
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 'INVALID_TOKEN', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 'TOKEN_EXPIRED', 401);
  }

  // Default error
  sendError(res, 'Internal server error', 'INTERNAL_ERROR', 500);
});

// 404 handler
app.use('*', (req, res) => {
  sendError(res, '🔍 Route not found', 'ROUTE_NOT_FOUND', 404);
});


// const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`Server is runing at port: ${process.env.PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    // console.log(` Health check: http://localhost:${PORT}/api/health`);
    // console.log(` API Documentation: http://localhost:${PORT}/api/docs`);
  });
});