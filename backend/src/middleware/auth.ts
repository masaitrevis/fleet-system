import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database';
import { JWT_SECRET } from '../routes/auth';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    staffId?: string | null;
    staffRole?: string | null;
    department?: string | null;
    branch?: string | null;
    companyId?: string | null;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Authenticate using API key
 * Header: X-API-Key: your_api_key_here
 */
export const authenticateApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return next(); // No API key provided, let JWT auth handle it
  }
  
  try {
    // Look up API key in database
    const keys = await query(`
      SELECT ak.*, u.email, u.role, u.id as user_id
      FROM api_keys ak
      JOIN users u ON u.id = ak.user_id
      WHERE ak.key_hash = crypt($1, ak.key_hash)
      AND ak.is_active = true
      AND (ak.expires_at IS NULL OR ak.expires_at > CURRENT_TIMESTAMP)
    `, [apiKey]);
    
    if (keys.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    const keyData = keys[0];
    
    // Update last used timestamp
    await query(`
      UPDATE api_keys 
      SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1
      WHERE id = $1
    `, [keyData.id]);
    
    // Set user on request
    req.user = {
      userId: keyData.user_id,
      email: keyData.email,
      role: keyData.role,
      companyId: keyData.company_id
    };
    
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};