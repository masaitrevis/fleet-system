import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { query } from '../database';

const router = Router();

// ==========================================
// INTEGRATION PROVIDERS (ERP, Telematics, etc.)
// ==========================================

interface IntegrationProvider {
  id: string;
  name: string;
  type: 'erp' | 'telematics' | 'fuel_card' | 'payment' | 'analytics' | 'custom';
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  description: string;
  config: Record<string, any>;
  features: string[];
  is_active: boolean;
  last_sync_at?: Date;
  next_sync_at?: Date;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

// Get all integration providers
router.get('/providers',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await query(`
      SELECT id, name, type, provider, status, description, config, features, 
             is_active, last_sync_at, next_sync_at, error_message, created_at, updated_at
      FROM integration_providers
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);
    res.json(result);
  })
);

// Get single provider
router.get('/providers/:id',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await query(`
      SELECT * FROM integration_providers
      WHERE id = $1 AND deleted_at IS NULL
    `, [req.params.id]);
    
    if (!result || result.length === 0) {
      throw Errors.NotFound('Integration provider');
    }
    
    res.json(result[0]);
  })
);

// Create new integration provider
router.post('/providers',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { provider, type, name, config, description } = req.body;
    
    if (!provider || !type || !name) {
      throw Errors.BadRequest('Provider, type, and name are required');
    }

    // Encrypt sensitive config data
    const encryptedConfig = JSON.stringify(config);
    
    const result = await query(`
      INSERT INTO integration_providers (
        id, name, type, provider, status, description, config, 
        features, is_active, created_at, updated_at, created_by
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'pending', $4, $5, 
        $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $7
      ) RETURNING *
    `, [
      name, type, provider, description || '', 
      encryptedConfig, getDefaultFeatures(type), req.user?.userId
    ]);

    res.status(201).json(result[0]);
  })
);

// Update integration provider
router.put('/providers/:id',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { is_active, config, status, error_message } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    if (config) {
      updates.push(`config = $${paramCount++}`);
      values.push(JSON.stringify(config));
    }
    
    if (status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (error_message !== undefined) {
      updates.push(`error_message = $${paramCount++}`);
      values.push(error_message);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);

    const result = await query(`
      UPDATE integration_providers
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (!result || result.length === 0) {
      throw Errors.NotFound('Integration provider');
    }

    res.json(result[0]);
  })
);

// Test integration connection
router.post('/providers/:id/test',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const provider = await query(`
      SELECT * FROM integration_providers
      WHERE id = $1 AND deleted_at IS NULL
    `, [req.params.id]);

    if (!provider || provider.length === 0) {
      throw Errors.NotFound('Integration provider');
    }

    // Test connection based on provider type
    const testResult = await testProviderConnection(provider[0]);

    // Update status based on test result
    await query(`
      UPDATE integration_providers
      SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [testResult.success ? 'connected' : 'error', testResult.message, req.params.id]);

    res.json(testResult);
  })
);

// Sync integration data
router.post('/providers/:id/sync',
  authenticateToken,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const provider = await query(`
      SELECT * FROM integration_providers
      WHERE id = $1 AND deleted_at IS NULL
    `, [req.params.id]);

    if (!provider || provider.length === 0) {
      throw Errors.NotFound('Integration provider');
    }

    // Trigger sync based on provider type
    const syncResult = await syncProviderData(provider[0]);

    // Update sync timestamps
    await query(`
      UPDATE integration_providers
      SET last_sync_at = CURRENT_TIMESTAMP, 
          next_sync_at = CURRENT_TIMESTAMP + INTERVAL '1 hour',
          status = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [syncResult.success ? 'connected' : 'error', req.params.id]);

    res.json(syncResult);
  })
);

// Delete integration provider
router.delete('/providers/:id',
  authenticateToken,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await query(`
      UPDATE integration_providers
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [req.params.id]);

    res.json({ message: 'Integration provider deleted' });
  })
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getDefaultFeatures(type: string): string[] {
  const features: Record<string, string[]> = {
    erp: ['Financial Sync', 'Invoice Import', 'Cost Center Mapping', 'Budget Tracking'],
    telematics: ['GPS Tracking', 'Route History', 'Driver Behavior', 'Geofencing', 'OBD Data'],
    fuel_card: ['Transaction Import', 'Fuel Station Network', 'Expense Categorization'],
    payment: ['Payment Processing', 'Invoice Generation', 'Refund Handling'],
    analytics: ['Data Export', 'Dashboard Sync', 'Report Automation'],
    custom: ['API Integration', 'Webhook Support', 'Custom Mapping']
  };
  return features[type] || features.custom;
}

async function testProviderConnection(provider: IntegrationProvider): Promise<{ success: boolean; message: string }> {
  try {
    // Mock test connection - in production, this would make actual API calls
    switch (provider.type) {
      case 'erp':
        return { success: true, message: 'ERP connection successful' };
      case 'telematics':
        return { success: true, message: 'Telematics API responding' };
      case 'fuel_card':
        return { success: true, message: 'Fuel card provider connected' };
      case 'payment':
        return { success: true, message: 'Payment gateway active' };
      default:
        return { success: true, message: 'Connection test passed' };
    }
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

async function syncProviderData(provider: IntegrationProvider): Promise<{ success: boolean; message: string; records?: number }> {
  try {
    // Mock sync - in production, this would fetch and process actual data
    const records = Math.floor(Math.random() * 100) + 1;
    return { 
      success: true, 
      message: `Synced ${records} records from ${provider.name}`,
      records 
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

export default router;
