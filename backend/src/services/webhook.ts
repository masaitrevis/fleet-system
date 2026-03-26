import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Webhook Service for event notifications
 * Supports: training completion, stock alerts, vehicle maintenance alerts
 */

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

/**
 * Emit a webhook event to all registered listeners
 */
export const emitWebhookEvent = async (eventType: string, data: any): Promise<void> => {
  try {
    // Find all active webhooks subscribed to this event
    const webhooks = await query(`
      SELECT * FROM webhooks 
      WHERE is_active = true 
      AND (event_types @> $1::jsonb OR event_types = '["*"]')
    `, [JSON.stringify([eventType])]);

    for (const webhook of webhooks) {
      try {
        await deliverWebhook(webhook, {
          event: eventType,
          timestamp: new Date().toISOString(),
          data
        });
      } catch (error) {
        console.error(`Failed to deliver webhook ${webhook.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error emitting webhook event:', error);
  }
};

/**
 * Deliver a webhook to its endpoint
 */
const deliverWebhook = async (webhook: any, payload: WebhookPayload): Promise<void> => {
  const deliveryId = uuidv4();
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-ID': webhook.id,
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      ...webhook.headers
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeout: 30000 // 30 second timeout
    } as any);

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text();

    // Log delivery
    await query(`
      INSERT INTO webhook_deliveries (
        id, webhook_id, event_type, payload, response_status, 
        response_body, delivered_at, attempt_number
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 1)
    `, [
      deliveryId,
      webhook.id,
      payload.event,
      JSON.stringify(payload),
      response.status,
      responseBody.substring(0, 1000) // Limit response size
    ]);

    // Update webhook last triggered
    await query(`
      UPDATE webhooks 
      SET last_triggered_at = CURRENT_TIMESTAMP, failure_count = 0
      WHERE id = $1
    `, [webhook.id]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseBody}`);
    }

  } catch (error: any) {
    // Log failed delivery
    await query(`
      INSERT INTO webhook_deliveries (
        id, webhook_id, event_type, payload, error_message, attempt_number
      ) VALUES ($1, $2, $3, $4, $5, 1)
    `, [
      deliveryId,
      webhook.id,
      payload.event,
      JSON.stringify(payload),
      error.message
    ]);

    // Increment failure count
    await query(`
      UPDATE webhooks 
      SET failure_count = failure_count + 1
      WHERE id = $1
    `, [webhook.id]);

    // Deactivate webhook after 5 consecutive failures
    await query(`
      UPDATE webhooks 
      SET is_active = false
      WHERE id = $1 AND failure_count >= 5
    `, [webhook.id]);

    throw error;
  }
};

/**
 * Retry failed webhook deliveries
 */
export const retryFailedDeliveries = async (): Promise<void> => {
  try {
    // Get failed deliveries from last 24 hours
    const failedDeliveries = await query(`
      SELECT wd.*, w.url, w.secret, w.headers
      FROM webhook_deliveries wd
      JOIN webhooks w ON w.id = wd.webhook_id
      WHERE wd.delivered_at IS NULL
      AND wd.attempt_number < 5
      AND wd.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY wd.created_at DESC
      LIMIT 50
    `);

    for (const delivery of failedDeliveries) {
      try {
        const payload = JSON.parse(delivery.payload);
        
        await deliverWebhook(
          { ...delivery, id: delivery.webhook_id },
          payload
        );

        // Update attempt count
        await query(`
          UPDATE webhook_deliveries 
          SET attempt_number = attempt_number + 1
          WHERE id = $1
        `, [delivery.id]);

      } catch (error) {
        console.error(`Retry failed for delivery ${delivery.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error retrying failed deliveries:', error);
  }
};

/**
 * Register a new webhook
 */
export const registerWebhook = async (
  userId: string,
  url: string,
  eventTypes: string[],
  options: {
    secret?: string;
    description?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<string> => {
  const webhookId = uuidv4();
  
  await query(`
    INSERT INTO webhooks (
      id, user_id, url, event_types, secret, description, headers, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
  `, [
    webhookId,
    userId,
    url,
    JSON.stringify(eventTypes),
    options.secret || null,
    options.description || null,
    JSON.stringify(options.headers || {})
  ]);

  return webhookId;
};

/**
 * Unregister a webhook
 */
export const unregisterWebhook = async (webhookId: string, userId: string): Promise<void> => {
  await query(`
    DELETE FROM webhooks 
    WHERE id = $1 AND user_id = $2
  `, [webhookId, userId]);
};

/**
 * Get webhook delivery history
 */
export const getDeliveryHistory = async (
  webhookId: string,
  limit: number = 50
): Promise<any[]> => {
  return await query(`
    SELECT * FROM webhook_deliveries
    WHERE webhook_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [webhookId, limit]);
};

// ============================================
// NEW FUNCTIONS FOR INTEGRATIONS MODULE
// ============================================

interface CreateWebhookInput {
  name: string;
  url: string;
  events: string[];
  createdBy: string;
  headers?: Record<string, string>;
}

interface CreateWebhookResult {
  webhook: any;
  secret: string;
}

/**
 * Create a new webhook (for integrations module)
 */
export const createWebhook = async (input: CreateWebhookInput): Promise<CreateWebhookResult> => {
  const webhookId = uuidv4();
  const secret = generateWebhookSecret();
  
  const result = await query(`
    INSERT INTO webhooks (
      id, name, url, secret, event_types, created_by, headers, is_active, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP)
    RETURNING id, name, url, event_types, headers, is_active, created_at
  `, [
    webhookId,
    input.name,
    input.url,
    secret,
    JSON.stringify(input.events),
    input.createdBy,
    JSON.stringify(input.headers || {})
  ]);
  
  return {
    webhook: result[0],
    secret
  };
};

/**
 * Get all webhooks (for integrations module)
 */
export const getWebhooks = async (): Promise<any[]> => {
  return await query(`
    SELECT 
      id, name, url, event_types, headers, is_active, 
      last_triggered_at, failure_count, created_at
    FROM webhooks
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `);
};

/**
 * Get single webhook by ID
 */
export const getWebhookById = async (webhookId: string): Promise<any | null> => {
  const result = await query(`
    SELECT * FROM webhooks
    WHERE id = $1 AND deleted_at IS NULL
  `, [webhookId]);
  
  return result.length > 0 ? result[0] : null;
};

/**
 * Update webhook
 */
export const updateWebhook = async (
  webhookId: string, 
  updates: { name?: string; url?: string; events?: string[]; headers?: Record<string, string>; is_active?: boolean }
): Promise<any | null> => {
  const setClause: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    setClause.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  
  if (updates.url !== undefined) {
    setClause.push(`url = $${paramIndex++}`);
    values.push(updates.url);
  }
  
  if (updates.events !== undefined) {
    setClause.push(`event_types = $${paramIndex++}`);
    values.push(JSON.stringify(updates.events));
  }
  
  if (updates.headers !== undefined) {
    setClause.push(`headers = $${paramIndex++}`);
    values.push(JSON.stringify(updates.headers));
  }
  
  if (updates.is_active !== undefined) {
    setClause.push(`is_active = $${paramIndex++}`);
    values.push(updates.is_active);
  }
  
  if (setClause.length === 0) {
    return getWebhookById(webhookId);
  }
  
  setClause.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(webhookId);
  
  const result = await query(`
    UPDATE webhooks
    SET ${setClause.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, url, event_types, headers, is_active, created_at, updated_at
  `, values);
  
  return result.length > 0 ? result[0] : null;
};

/**
 * Delete webhook
 */
export const deleteWebhook = async (webhookId: string): Promise<boolean> => {
  const result = await query(`
    UPDATE webhooks
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id
  `, [webhookId]);
  
  return result.length > 0;
};

/**
 * Test webhook by sending a ping event
 */
export const testWebhook = async (webhookId: string): Promise<{ success: boolean; message: string; statusCode?: number }> => {
  const webhook = await getWebhookById(webhookId);
  
  if (!webhook) {
    return { success: false, message: 'Webhook not found' };
  }
  
  const payload: WebhookPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test ping from Fleet Management System' }
  };
  
  try {
    await deliverWebhook(webhook, payload);
    return { success: true, message: 'Webhook test successful' };
  } catch (error: any) {
    return { success: false, message: `Webhook test failed: ${error.message}` };
  }
};

/**
 * Get webhook delivery logs
 */
export const getWebhookLogs = async (webhookId: string, limit: number = 50): Promise<any[]> => {
  return await query(`
    SELECT 
      id, event_type, payload, response_status, error_message, 
      attempt_number, delivered_at, created_at
    FROM webhook_deliveries
    WHERE webhook_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [webhookId, limit]);
};

/**
 * Manually trigger a webhook event
 */
export const triggerWebhook = async (eventType: string, data: any): Promise<{ success: boolean; delivered: number; failed: number }> => {
  let delivered = 0;
  let failed = 0;
  
  try {
    const webhooks = await query(`
      SELECT * FROM webhooks 
      WHERE is_active = true 
      AND (event_types @> $1::jsonb OR event_types = '["*"]')
    `, [JSON.stringify([eventType])]);
    
    for (const webhook of webhooks) {
      try {
        await deliverWebhook(webhook, {
          event: eventType,
          timestamp: new Date().toISOString(),
          data
        });
        delivered++;
      } catch (error) {
        console.error(`Failed to deliver webhook ${webhook.id}:`, error);
        failed++;
      }
    }
    
    return { success: true, delivered, failed };
  } catch (error) {
    console.error('Error triggering webhook:', error);
    return { success: false, delivered, failed };
  }
};

/**
 * Verify webhook signature
 */
export const verifySignature = (payload: string, signature: string, secret: string): boolean => {
  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    // Support both raw hex and 'sha256=' prefixed signatures
    const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
};

/**
 * Generate a secure webhook secret
 */
function generateWebhookSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// Schedule retry of failed deliveries every 5 minutes
setInterval(retryFailedDeliveries, 5 * 60 * 1000);
