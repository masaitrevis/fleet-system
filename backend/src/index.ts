import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDatabase } from './database';
import { authenticateToken } from './middleware/auth';
import { requestLogger, errorLogger } from './middleware/logger';
import { rateLimiter, authRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import vehicleRoutes from './routes/vehicles';
import staffRoutes from './routes/staff';
import routeRoutes from './routes/routes';
import fuelRoutes from './routes/fuel';
import repairRoutes from './routes/repairs';
import uploadRoutes from './routes/upload';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import requisitionRoutes from './routes/requisitions';
import accidentRoutes from './routes/accidents';
import auditRoutes from './routes/audits';
import trainingRoutes from './routes/training';
import auditScheduleRoutes from './routes/audit-schedules';
import integrationRoutes from './routes/integrations';

// Import services for webhooks
import * as webhookService from './services/webhook';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (adds requestId)
app.use(requestLogger);

// Rate limiting for all routes
app.use(rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200
}));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.locals.io = io;

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Public routes
app.use('/api/auth', authRateLimiter, authRoutes);

// Protected routes
app.use('/api/vehicles', authenticateToken, vehicleRoutes);
app.use('/api/staff', authenticateToken, staffRoutes);
app.use('/api/routes', authenticateToken, routeRoutes);
app.use('/api/fuel', authenticateToken, fuelRoutes);
app.use('/api/repairs', authenticateToken, repairRoutes);
app.use('/api/upload', authenticateToken, uploadRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/requisitions', authenticateToken, requisitionRoutes);
app.use('/api/accidents', authenticateToken, accidentRoutes);
app.use('/api/audits', authenticateToken, auditRoutes);
app.use('/api/training', authenticateToken, trainingRoutes);
app.use('/api/audit-schedules', authenticateToken, auditScheduleRoutes);

// Integration routes (includes public API with API key auth)
app.use('/api/integrations', integrationRoutes);

// Error logging (before error handler)
app.use(errorLogger);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await initDatabase();
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Fleet API + WebSocket running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'NOT SET'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { io };
