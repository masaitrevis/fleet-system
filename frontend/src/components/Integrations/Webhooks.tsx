import { useState, useEffect } from 'react';

interface WebhooksProps {
  apiUrl: string;
  token: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  last_triggered_at?: string;
  failure_count: number;
}

const WEBHOOK_EVENTS = [
  { value: 'vehicle.created', label: 'Vehicle Created' },
  { value: 'vehicle.updated', label: 'Vehicle Updated' },
  { value: 'vehicle.maintenance_due', label: 'Maintenance Due' },
  { value: 'route.completed', label: 'Route Completed' },
  { value: 'accident.reported', label: 'Accident Reported' },
  { value: 'requisition.approved', label: 'Requisition Approved' },
  { value: 'requisition.allocated', label: 'Vehicle Allocated' },
  { value: 'inspection.failed', label: 'Inspection Failed' },
  { value: 'training.completed', label: 'Training Completed' },
  { value: 'job_card.created', label: 'Job Card Created' },
  { value: 'fuel.anomaly', label: 'Fuel Anomaly' }
];

export default function Webhooks({ apiUrl, token }: WebhooksProps) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[]
  });

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/integrations/webhooks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/integrations/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const data = await res.json();
        setNewSecret(data.secret);
        setShowCreate(false);
        setFormData({ name: '', url: '', events: [] });
        fetchWebhooks();
      }
    } catch (err) {
      console.error('Failed to create webhook:', err);
    }
  };

  const testWebhook = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/integrations/webhooks/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.success ? '✅ Webhook test successful!' : `❌ Test failed: ${data.message}`);
    } catch (err) {
      alert('❌ Failed to test webhook');
    }
  };

  const toggleWebhook = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`${apiUrl}/integrations/webhooks/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      
      if (res.ok) {
        fetchWebhooks();
      }
    } catch (err) {
      console.error('Failed to toggle webhook:', err);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    
    try {
      const res = await fetch(`${apiUrl}/integrations/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchWebhooks();
      }
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const fetchLogs = async (webhookId: string) => {
    try {
      const res = await fetch(`${apiUrl}/integrations/webhooks/${webhookId}/logs?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
        setShowLogs(webhookId);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* New Secret Alert */}
      {newSecret && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">🪝 Webhook Created</h3>
              <p className="text-sm text-yellow-800 mt-1">
                Copy this secret now! It will only be shown once. Use it to verify webhook signatures.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="bg-black text-green-400 px-3 py-2 rounded font-mono text-sm flex-1 truncate">
                  {newSecret}
                </code>
                <button
                  onClick={() => copyToClipboard(newSecret)}
                  className="bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700"
                >
                  Copy
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewSecret(null)}
              className="text-yellow-700 hover:text-yellow-900"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Webhooks</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showCreate ? 'Cancel' : '+ Add Webhook'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={createWebhook} className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="e.g., Slack Notifications"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">URL *</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="https://your-app.com/webhook"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Events *</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, events: [...formData.events, event.value] });
                      } else {
                        setFormData({ ...formData, events: formData.events.filter(ev => ev !== event.value) });
                      }
                    }}
                  />
                  <span className="text-sm">{event.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Create Webhook
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold">Webhook Delivery Logs</h3>
              <button
                onClick={() => setShowLogs(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No logs found</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Time</th>
                      <th className="text-left p-3">Event</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3 text-sm">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-3">{log.event_type}</td>
                        <td className="p-3">
                          {log.response_status ? (
                            <span className={`px-2 py-1 rounded text-xs ${
                              log.response_status < 300 ? 'bg-green-100 text-green-800' :
                              log.response_status < 400 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {log.response_status}
                            </span>
                          ) : (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">Failed</span>
                          )}
                        </td>
                        <td className="p-3">#{log.attempt_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No webhooks configured yet.
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className={`border rounded-lg p-4 ${webhook.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{webhook.name}</h3>
                    {webhook.is_active ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">Inactive</span>
                    )}
                    {webhook.failure_count > 3 && (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">⚠️ Failing</span>
                    )}
                  </div>
                  
                  <p className="text-sm font-mono text-gray-600 mt-1 truncate">{webhook.url}</p>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {webhook.events.map((event) => (
                      <span key={event} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
                        {event}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span>Created: {new Date(webhook.created_at).toLocaleDateString()}</span>
                    {webhook.last_triggered_at && (
                      <span>Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}</span>
                    )}
                    {webhook.failure_count > 0 && (
                      <span className="text-red-500">Failures: {webhook.failure_count}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => testWebhook(webhook.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => fetchLogs(webhook.id)}
                    className="text-gray-600 hover:text-gray-800 text-sm"
                  >
                    Logs
                  </button>
                  <button
                    onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                    className="text-yellow-600 hover:text-yellow-800 text-sm"
                  >
                    {webhook.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => deleteWebhook(webhook.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
