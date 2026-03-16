import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request to include requestId
export interface RequestWithId extends Request {
  requestId: string;
  startTime: number;
}

// Logger middleware - adds request ID and timing
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4().split('-')[0]; // Short ID for readability
  (req as RequestWithId).requestId = requestId;
  (req as RequestWithId).startTime = Date.now();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request
  console.log(`[${requestId}] ${req.method} ${req.path} - ${req.ip}`);
  
  // Log response time on finish
  res.on('finish', () => {
    const duration = Date.now() - (req as RequestWithId).startTime;
    const status = res.statusCode;
    const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const resetColor = '\x1b[0m';
    
    console.log(
      `[${requestId}] ${req.method} ${req.path} - ${statusColor}${status}${resetColor} - ${duration}ms`
    );
  });
  
  next();
};

// Error logger middleware
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as RequestWithId).requestId || 'unknown';
  
  console.error(`[${requestId}] ERROR:`, {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  next(err);
};
