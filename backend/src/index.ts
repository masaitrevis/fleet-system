import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDatabase } from './database';
import { authenticateToken } from './middleware/auth';

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

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.locals.io = io;

// Public routes
app.use('/api/auth', authRoutes);

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

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const startServer = async () => {
  try {
    await initDatabase();
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Fleet API + WebSocket running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { io };