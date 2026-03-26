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

// Schedule retry of failed deliveries every 5 minutes
setInterval(retryFailedDeliveries, 5 * 60 * 1000);
