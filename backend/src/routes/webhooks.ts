import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import * as webhookService from '../services/webhook';

const router = Router();

// Apply authentication
router.use(authenticateToken);

/**
 * List all webhooks for the current user
 * GET /webhooks
 */
router.get('/', asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  let sql = `
    SELECT 
      w.*,
      COUNT(wd.id) as total_deliveries,
      COUNT(CASE WHEN wd.delivered_at IS NOT NULL THEN 1 END) as successful_deliveries
    FROM webhooks w
    LEFT JOIN webhook_deliveries wd ON wd.webhook_id = w.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  // Non-admins can only see their own webhooks
  if (userRole !== 'admin') {
    sql += ` AND w.user_id = $1`;
    params.push(userId);
  }
  
  sql += ` GROUP BY w.id ORDER BY w.created_at DESC`;
  
  const webhooks = await query(sql, params);
  res.json({ data: webhooks });
}));

/**
 * Create a new webhook
 * POST /webhooks
 */
router.post('/', asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.userId;
  const { url, event_types, secret, description, headers } = req.body;
  
  // Validate required fields
  if (!url || !event_types || !Array.isArray(event_types)) {
    return res.status(400).json({ 
      error: 'URL and event_types array are required' 
    });
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  // Validate event types
  const validEvents = [
    'training.completed',
    'training.failed',
    'inventory.low_stock',
    'inventory.out_of_stock',
    'maintenance.overdue',
    'maintenance.due_soon',
    'vehicle.accident',
    'vehicle.defect_reported',
    'driver.behavior_alert',
    '*'
  ];
  
  const invalidEvents = event_types.filter((e: string) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return res.status(400).json({
      error: `Invalid event types: ${invalidEvents.join(', ')}`,
      valid_events: validEvents
    });
  }
  
  const webhookId = await webhookService.registerWebhook(userId, url, event_types, {
    secret,
    description,
    headers
  });
  
  res.status(201).json({
    id: webhookId,
    message: 'Webhook registered successfully'
  });
}));

/**
 * Get webhook details
 * GET /webhooks/:id
 */
router.get('/:id', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  let sql = `SELECT * FROM webhooks WHERE id = $1`;
  const params: any[] = [id];
  
  if (userRole !== 'admin') {
    sql += ` AND user_id = $2`;
    params.push(userId);
  }
  
  const webhooks = await query(sql, params);
  
  if (webhooks.length === 0) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  res.json({ data: webhooks[0] });
}));

/**
 * Update a webhook
 * PUT /webhooks/:id
 */
router.put('/:id', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  const { url, event_types, secret, description, headers, is_active } = req.body;
  
  // Check ownership
  let checkSql = `SELECT * FROM webhooks WHERE id = $1`;
  const checkParams: any[] = [id];
  
  if (userRole !== 'admin') {
    checkSql += ` AND user_id = $2`;
    checkParams.push(userId);
  }
  
  const existing = await query(checkSql, checkParams);
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  // Build update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (url !== undefined) {
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    updates.push(`url = $${paramIndex++}`);
    values.push(url);
  }
  
  if (event_types !== undefined) {
    updates.push(`event_types = $${paramIndex++}`);
    values.push(JSON.stringify(event_types));
  }
  
  if (secret !== undefined) {
    updates.push(`secret = $${paramIndex++}`);
    values.push(secret);
  }
  
  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(description);
  }
  
  if (headers !== undefined) {
    updates.push(`headers = $${paramIndex++}`);
    values.push(JSON.stringify(headers));
  }
  
  if (is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(is_active);
    // Reset failure count when reactivating
    if (is_active === true) {
      updates.push(`failure_count = 0`);
    }
  }
  
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  
  values.push(id);
  
  await query(`
    UPDATE webhooks 
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
  `, values);
  
  res.json({ message: 'Webhook updated successfully' });
}));

/**
 * Delete a webhook
 * DELETE /webhooks/:id
 */
router.delete('/:id', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  try {
    await webhookService.unregisterWebhook(id, userRole === 'admin' ? '' : userId);
    res.json({ message: 'Webhook deleted successfully' });
  } catch (error: any) {
    res.status(404).json({ error: 'Webhook not found' });
  }
}));

/**
 * Get webhook delivery history
 * GET /webhooks/:id/deliveries
 */
router.get('/:id/deliveries', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  const { limit = 50 } = req.query;
  
  // Check ownership
  let checkSql = `SELECT * FROM webhooks WHERE id = $1`;
  const checkParams: any[] = [id];
  
  if (userRole !== 'admin') {
    checkSql += ` AND user_id = $2`;
    checkParams.push(userId);
  }
  
  const existing = await query(checkSql, checkParams);
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  const deliveries = await webhookService.getDeliveryHistory(id, parseInt(limit));
  res.json({ data: deliveries });
}));

/**
 * Test a webhook
 * POST /webhooks/:id/test
 */
router.post('/:id/test', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  // Check ownership
  let checkSql = `SELECT * FROM webhooks WHERE id = $1`;
  const checkParams: any[] = [id];
  
  if (userRole !== 'admin') {
    checkSql += ` AND user_id = $2`;
    checkParams.push(userId);
  }
  
  const webhooks = await query(checkSql, checkParams);
  if (webhooks.length === 0) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  const webhook = webhooks[0];
  
  // Send test event
  try {
    await webhookService.emitWebhookEvent('webhook.test', {
      webhook_id: id,
      url: webhook.url,
      timestamp: new Date().toISOString(),
      message: 'This is a test event from NextBotics Fleet Management'
    });
    
    res.json({ message: 'Test event sent successfully' });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to send test event',
      details: error.message 
    });
  }
}));

export default router;
