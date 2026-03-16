import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Custom error class for API errors
export class AppError extends Error implements ApiError {
  statusCode: number;
  code: string;
  details?: any;
  
  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export const Errors = {
  BadRequest: (message: string, details?: any) => new AppError(message, 400, 'BAD_REQUEST', details),
  Unauthorized: (message: string = 'Unauthorized') => new AppError(message, 401, 'UNAUTHORIZED'),
  Forbidden: (message: string = 'Forbidden') => new AppError(message, 403, 'FORBIDDEN'),
  NotFound: (resource: string) => new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  Conflict: (message: string) => new AppError(message, 409, 'CONFLICT'),
  ValidationError: (message: string, details?: any) => new AppError(message, 422, 'VALIDATION_ERROR', details),
  TooManyRequests: (message: string = 'Too many requests') => new AppError(message, 429, 'TOO_MANY_REQUESTS'),
  InternalError: (message: string = 'Internal server error') => new AppError(message, 500, 'INTERNAL_ERROR')
};

// Global error handler middleware
export const errorHandler = (err: ApiError, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId || 'unknown';
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Build error response
  const errorResponse: any = {
    error: true,
    code: err.code || 'INTERNAL_ERROR',
    message: err.message,
    requestId
  };
  
  // Include details for validation errors and 4xx errors
  if (err.details && statusCode < 500) {
    errorResponse.details = err.details;
  }
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  // Log error
  if (statusCode >= 500) {
    console.error(`[${requestId}] Server Error:`, err);
  } else {
    console.warn(`[${requestId}] Client Error:`, { code: err.code, message: err.message });
  }
  
  res.status(statusCode).json(errorResponse);
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  
  res.status(404).json({
    error: true,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    requestId
  });
};

// Async handler wrapper to catch errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
