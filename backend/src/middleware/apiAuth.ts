import { Request, Response, NextFunction } from 'express';
import { query } from '../database';
import bcrypt from 'bcryptjs';
import { AuthRequest } from './auth';

export interface ApiKeyRequest extends AuthRequest {
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
    rateLimit: number;
  };
}

// API key authentication middleware
export const authenticateApiKey = async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
  
  if (!apiKeyHeader) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Extract key from header (handle "Bearer KEY" or just "KEY")
  let apiKey = apiKeyHeader.toString();
  if (apiKey.toLowerCase().startsWith('bearer ')) {
    apiKey = apiKey.substring(7);
  }
  
  try {
    // Extract prefix from key (format: fp_live_xxxxxxxx...)
    const keyParts = apiKey.split('_');
    const keyPrefix = keyParts.length >= 3 ? `${keyParts[0]}_${keyParts[1]}_` : apiKey.substring(0, 20);
    
    // Find API key by prefix
    const keys = await query(
      'SELECT * FROM api_keys WHERE key_prefix = $1 AND is_active = true',
      [keyPrefix]
    );
    
    if (!keys || keys.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    const keyRecord = keys[0];
    
    // Check if expired
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }
    
    // Verify key hash
    const isValid = await bcrypt.compare(apiKey, keyRecord.key_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Update last used timestamp
    await query(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [keyRecord.id]
    );
    
    // Attach API key info to request
    req.apiKey = {
      id: keyRecord.id,
      name: keyRecord.name,
      permissions: keyRecord.permissions || ['read'],
      rateLimit: keyRecord.rate_limit_per_minute || 60
    };
    
    // Log API usage
    await logApiUsage(keyRecord.id, null, req);
    
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to check API key permissions
export const requireApiPermission = (permission: string) => {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: 'API key authentication required' });
    }
    
    const hasPermission = req.apiKey.permissions.includes(permission) || 
                         req.apiKey.permissions.includes('admin');
    
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        granted: req.apiKey.permissions
      });
    }
    
    next();
  };
};

// Combined authentication (JWT or API Key)
export const authenticateAny = async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];
  
  // If API key present, use API key auth
  if (apiKeyHeader) {
    return authenticateApiKey(req, res, next);
  }
  
  // Otherwise, fall back to JWT auth
  const jwtAuth = require('./auth').authenticateToken;
  return jwtAuth(req, res, next);
};

// Helper to log API usage
const logApiUsage = async (apiKeyId: string | null, userId: string | null, req: Request) => {
  try {
    await query(
      `INSERT INTO api_usage_logs (api_key_id, user_id, endpoint, method, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        apiKeyId,
        userId,
        req.path,
        req.method,
        req.ip,
        req.headers['user-agent'] || null
      ]
    );
  } catch (err) {
    // Non-critical error, just log
    console.warn('Failed to log API usage:', err);
  }
};
