import bcrypt from 'bcryptjs';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const API_KEY_PREFIX = 'fp_live_';
const SALT_ROUNDS = 10;

export interface ApiKeyData {
  id: string;
  keyPrefix: string;
  name: string;
  description?: string;
  createdBy?: string;
  expiresAt?: Date;
  permissions?: string[];
  rateLimitPerMinute?: number;
}

// Generate a new API key
export const generateApiKey = async (data: ApiKeyData): Promise<{ key: string; id: string }> => {
  // Generate random key
  const randomPart = Buffer.from(uuidv4() + uuidv4()).toString('base64url').substring(0, 32);
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const keyPrefix = key.substring(0, 20);
  
  // Hash the key for storage
  const keyHash = await bcrypt.hash(key, SALT_ROUNDS);
  
  // Store in database
  const result = await query(
    `INSERT INTO api_keys (id, key_hash, key_prefix, name, description, created_by, expires_at, permissions, rate_limit_per_minute)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      data.id || uuidv4(),
      keyHash,
      keyPrefix,
      data.name,
      data.description || null,
      data.createdBy || null,
      data.expiresAt || null,
      JSON.stringify(data.permissions || ['read']),
      data.rateLimitPerMinute || 60
    ]
  );
  
  return { key, id: result[0].id };
};

// Revoke an API key
export const revokeApiKey = async (keyId: string): Promise<boolean> => {
  const result = await query(
    'UPDATE api_keys SET is_active = false WHERE id = $1 RETURNING id',
    [keyId]
  );
  return result.length > 0;
};

// Get all active API keys
export const getApiKeys = async (): Promise<any[]> => {
  return await query(
    `SELECT id, key_prefix, name, description, is_active, created_at, last_used_at, expires_at, permissions, rate_limit_per_minute
     FROM api_keys WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
};

// Get API key by ID
export const getApiKeyById = async (keyId: string): Promise<any | null> => {
  const result = await query(
    `SELECT id, key_prefix, name, description, is_active, created_at, last_used_at, expires_at, permissions, rate_limit_per_minute
     FROM api_keys WHERE id = $1 AND deleted_at IS NULL`,
    [keyId]
  );
  return result.length > 0 ? result[0] : null;
};

// Get API usage statistics
export const getApiUsageStats = async (keyId?: string, days: number = 7): Promise<any> => {
  const params: any[] = [];
  let whereClause = '';
  
  if (keyId) {
    whereClause = 'WHERE api_key_id = $1';
    params.push(keyId);
  }
  
  // Total requests
  const totalRequests = await query(
    `SELECT COUNT(*) as total FROM api_usage_logs ${whereClause} AND created_at > NOW() - INTERVAL '${days} days'`,
    params
  );
  
  // Requests by endpoint
  const byEndpoint = await query(
    `SELECT endpoint, method, COUNT(*) as count 
     FROM api_usage_logs ${whereClause} AND created_at > NOW() - INTERVAL '${days} days'
     GROUP BY endpoint, method ORDER BY count DESC LIMIT 20`,
    params
  );
  
  // Requests by day
  const byDay = await query(
    `SELECT DATE(created_at) as date, COUNT(*) as count 
     FROM api_usage_logs ${whereClause} AND created_at > NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at) ORDER BY date`,
    params
  );
  
  // Error rate
  const errorRate = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE status_code >= 400) as errors,
       COUNT(*) as total
     FROM api_usage_logs ${whereClause} AND created_at > NOW() - INTERVAL '${days} days'`,
    params
  );
  
  return {
    period: `${days} days`,
    totalRequests: parseInt(totalRequests[0]?.total || 0),
    byEndpoint,
    byDay,
    errorRate: {
      errors: parseInt(errorRate[0]?.errors || 0),
      total: parseInt(errorRate[0]?.total || 0),
      percentage: errorRate[0]?.total > 0 
        ? ((parseInt(errorRate[0].errors) / parseInt(errorRate[0].total)) * 100).toFixed(2)
        : 0
    }
  };
};
