import crypto from 'crypto';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

// Webhook delivery queue (in-memory, consider Redis for production)
const deliveryQueue: WebhookDelivery[] = [];

interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  attemptNumber: number;
  maxAttempts: number;
}

// Generate webhook signature
export const generateSignature = (payload: string, secret: string): string => {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
};

// Verify webhook signature
export const verifySignature = (payload: string, signature: string, secret: string): boolean => {
  const expected = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
};

// Create webhook
export const createWebhook = async (data: {
  name: string;
  url: string;
  events: string[];
  createdBy: string;
  headers?: Record<string, string>;
}): Promise<{ webhook: any; secret: string }> => {
  const secret = crypto.randomBytes(32).toString('hex');
  const id = uuidv4();
  
  const result = await query(
    `INSERT INTO webhooks (id, name, url, secret, events, created_by, headers)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      id,
      data.name,
      data.url,
      secret,
      JSON.stringify(data.events),
      data.createdBy,
      JSON.stringify(data.headers || {})
    ]
  );
  
  return { webhook: result[0], secret };
};

// Get all webhooks
export const getWebhooks = async (): Promise<any[]> => {
  return await query(
    `SELECT id, name, url, events, is_active, created_at, last_triggered_at, failure_count
     FROM webhooks ORDER BY created_at DESC`
  );
};

// Get webhook by ID
export const getWebhookById = async (id: string): Promise<any | null> => {
  const result = await query('SELECT * FROM webhooks WHERE id = $1', [id]);
  return result.length > 0 ? result[0] : null;
};

// Update webhook
export const updateWebhook = async (id: string, data: Partial<any>): Promise<any | null> => {
  const allowedFields = ['name', 'url', 'events', 'is_active', 'headers'];
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(key === 'events' || key === 'headers' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }
  
  if (updates.length === 0) return null;
  
  values.push(id);
  
  const result = await query(
    `UPDATE webhooks SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  return result.length > 0 ? result[0] : null;
};

// Delete webhook
export const deleteWebhook = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM webhooks WHERE id = $1 RETURNING id', [id]);
  return result.length > 0;
};

// Trigger webhook event
export const triggerWebhook = async (eventType: string, payload: any) => {
  // Find active webhooks subscribed to this event
  const webhooks = await query(
    `SELECT * FROM webhooks 
     WHERE is_active = true AND events @> $1::jsonb`,
    [JSON.stringify([eventType])]
  );
  
  for (const webhook of webhooks) {
    const delivery: WebhookDelivery = {
      id: uuidv4(),
      webhookId: webhook.id,
      eventType,
      payload,
      attemptNumber: 0,
      maxAttempts: 3
    };
    
    // Add to queue for immediate processing
    deliveryQueue.push(delivery);
    
    // Process immediately (async)
    processDelivery(delivery, webhook);
  }
  
  return webhooks.length;
};

// Process webhook delivery
const processDelivery = async (delivery: WebhookDelivery, webhook: any) => {
  delivery.attemptNumber++;
  
  const payload = JSON.stringify({
    event: delivery.eventType,
    data: delivery.payload,
    timestamp: new Date().toISOString(),
    deliveryId: delivery.id
  });
  
  const signature = generateSignature(payload, webhook.secret);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Event': delivery.eventType,
    'X-Webhook-ID': delivery.id,
    'User-Agent': 'FleetPro-Webhook/1.0',
    ...JSON.parse(webhook.headers || '{}')
  };
  
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    const responseBody = await response.text();
    
    // Log delivery
    await query(
      `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, response_status, response_body, attempt_number, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [delivery.id, webhook.id, delivery.eventType, payload, response.status, responseBody, delivery.attemptNumber]
    );
    
    // Update webhook stats
    await query(
      `UPDATE webhooks SET last_triggered_at = CURRENT_TIMESTAMP, failure_count = 0 WHERE id = $1`,
      [webhook.id]
    );
    
    // Remove from queue if successful
    if (response.ok) {
      const index = deliveryQueue.findIndex(d => d.id === delivery.id);
      if (index > -1) deliveryQueue.splice(index, 1);
    } else if (delivery.attemptNumber < delivery.maxAttempts) {
      // Retry with exponential backoff
      const delay = Math.pow(2, delivery.attemptNumber) * 1000;
      setTimeout(() => processDelivery(delivery, webhook), delay);
    } else {
      // Max retries reached, increment failure count
      await query(
        `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
        [webhook.id]
      );
    }
  } catch (error: any) {
    // Log failed delivery
    await query(
      `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, error_message, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [delivery.id, webhook.id, delivery.eventType, payload, error.message, delivery.attemptNumber]
    );
    
    if (delivery.attemptNumber < delivery.maxAttempts) {
      // Retry with exponential backoff
      const delay = Math.pow(2, delivery.attemptNumber) * 1000;
      setTimeout(() => processDelivery(delivery, webhook), delay);
    } else {
      await query(
        `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
        [webhook.id]
      );
    }
  }
};

// Get webhook delivery logs
export const getWebhookLogs = async (webhookId: string, limit: number = 50): Promise<any[]> => {
  return await query(
    `SELECT * FROM webhook_deliveries 
     WHERE webhook_id = $1 
     ORDER BY created_at DESC LIMIT $2`,
    [webhookId, limit]
  );
};

// Test webhook
export const testWebhook = async (webhookId: string): Promise<{ success: boolean; message: string }> => {
  const webhook = await getWebhookById(webhookId);
  if (!webhook) {
    return { success: false, message: 'Webhook not found' };
  }
  
  const testPayload = {
    event: 'test',
    data: { message: 'This is a test webhook' },
    timestamp: new Date().toISOString()
  };
  
  const payload = JSON.stringify(testPayload);
  const signature = generateSignature(payload, webhook.secret);
  
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'test'
      },
      body: payload,
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      return { success: true, message: `Webhook responded with ${response.status}` };
    } else {
      return { success: false, message: `Webhook responded with ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: `Failed to call webhook: ${error.message}` };
  }
};
