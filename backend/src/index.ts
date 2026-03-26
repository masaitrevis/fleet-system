import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDatabase, runMigrations } from './database';
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
import integrationProvidersRoutes from './routes/integration-providers';
import settingsRoutes from './routes/settings';
import operationsRoutes from './routes/operations';
import workshopRoutes from './routes/workshop';
import riskIntelligenceRoutes from './routes/riskIntelligence';
import photoRoutes from './routes/photos';
import webhookRoutes from './routes/webhooks';
import inspectionRoutes from './routes/inspections';
import apiV1Routes from './routes/api/v1';
import seedDemoRoutes from './routes/seed-demo';

// Import services for webhooks and operations
import * as webhookService from './services/webhook';
import * as operationsAI from './services/operationsAI';

dotenv.config();

// Debug: Log environment variables (without secrets)
console.log('🔧 Environment Check:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'NOT SET');
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL || 'Not set (using *)');

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

// CORS configuration - allow multiple origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://masaitrevis.github.io',
  'https://masaitrevis.github.io/fleet-system',
  'https://fleet-pro-git-master-masaitrevis-projects.vercel.app',
  'https://fleet-pro.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow all Vercel preview deployments (for mobile testing)
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // Log rejected origins for debugging (but don't crash)
    console.log('🚫 CORS rejected origin:', origin);
    console.log('📋 Allowed origins:', allowedOrigins);
    callback(null, true); // Temporarily allow all for debugging
  },
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

// Handle OPTIONS preflight for all routes (important for mobile)
app.options('*', cors());

// Health check (public)
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  let adminUser = null;
  
  try {
    const { query } = await import('./database');
    const result = await query('SELECT COUNT(*) as count FROM users');
    dbStatus = 'connected';
    
    const adminResult = await query('SELECT email, role FROM users WHERE email = $1', ['admin@fleet.local']);
    adminUser = adminResult.length > 0 ? adminResult[0] : null;
  } catch (err) {
    dbStatus = 'error: ' + (err as Error).message;
  }
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    adminUser: adminUser ? { email: adminUser.email, role: adminUser.role } : null
  });
});

// Demo data seeder (public endpoint)
app.use('/api/seed-demo', seedDemoRoutes);

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

// Integration providers (ERP, telematics, fuel cards, etc.)
app.use('/api/integrations/providers', authenticateToken, integrationProvidersRoutes);

// Settings routes
app.use('/api/settings', authenticateToken, settingsRoutes);

// Operations routes (AI features, live status, fleet health)
app.use('/api/operations', authenticateToken, operationsRoutes);

// Workshop routes (stock, invoices, workshop management)
app.use('/api/workshop', authenticateToken, workshopRoutes);

// Risk Intelligence routes (AI-powered fleet risk analysis)
app.use('/api/risk-intelligence', authenticateToken, riskIntelligenceRoutes);

// Photo evidence routes (audit & inspection photos)
app.use('/api/photos', authenticateToken, photoRoutes);

// Webhook management routes
app.use('/api/webhooks', authenticateToken, webhookRoutes);

// Vehicle Inspection routes
app.use('/api/inspections', authenticateToken, inspectionRoutes);

// REST API v1 (with API key auth support)
app.use('/api/v1', apiV1Routes);

// Static file serving for uploads
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

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
    await runMigrations(); // Run additional migrations
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Fleet API + WebSocket running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'NOT SET'}`);
      console.log(`🤖 Operations AI: Enabled`);
    });
    
    // Broadcast operations updates every 30 seconds
    setInterval(() => {
      operationsAI.broadcastOperationsUpdate().catch(console.error);
    }, 30000);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { io };
