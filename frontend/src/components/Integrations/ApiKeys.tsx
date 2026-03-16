import { useState, useEffect } from 'react';

interface ApiKeysProps {
  apiUrl: string;
  token: string;
}

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  permissions: string[];
  rate_limit_per_minute: number;
}

export default function ApiKeys({ apiUrl, token }: ApiKeysProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: ['read'],
    expiresInDays: '',
    rateLimitPerMinute: 60
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/integrations/api-keys`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/integrations/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        setShowCreate(false);
        setFormData({
          name: '',
          description: '',
          permissions: ['read'],
          expiresInDays: '',
          rateLimitPerMinute: 60
        });
        fetchKeys();
      }
    } catch (err) {
      console.error('Failed to create API key:', err);
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }
    
    try {
      const res = await fetch(`${apiUrl}/integrations/api-keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchKeys();
      }
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* New Key Alert */}
      {newKey && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">🔑 New API Key Created</h3>
              <p className="text-sm text-yellow-800 mt-1">
                Copy this key now! It will only be shown once.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="bg-black text-green-400 px-3 py-2 rounded font-mono text-sm flex-1">
                  {newKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newKey)}
                  className="bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700"
                >
                  Copy
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-yellow-700 hover:text-yellow-900"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showCreate ? 'Cancel' : '+ Create API Key'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={createKey} className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="e.g., GPS Tracker Integration"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="What is this API key for?"
              rows={2}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Permissions</label>
              <select
                multiple
                value={formData.permissions}
                onChange={(e) => {
                  const options = Array.from(e.target.selectedOptions, o => o.value);
                  setFormData({ ...formData, permissions: options });
                }}
                className="w-full border rounded-lg px-3 py-2"
                size={3}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl to select multiple</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Expires In (days)</label>
              <input
                type="number"
                value={formData.expiresInDays}
                onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Never"
                min="1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Rate Limit (req/min)</label>
              <input
                type="number"
                value={formData.rateLimitPerMinute}
                onChange={(e) => setFormData({ ...formData, rateLimitPerMinute: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
                min="10"
                max="1000"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Create Key
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

      {/* Keys List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No API keys yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`border rounded-lg p-4 ${key.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{key.name}</h3>
                    {key.is_active ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
                    ) : (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">Revoked</span>
                    )}
                  </div>
                  
                  {key.description && (
                    <p className="text-sm text-gray-600 mt-1">{key.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                    <span>Key: {key.key_prefix}...***</span>
                    <span>Permissions: {Array.isArray(key.permissions) ? key.permissions.join(', ') : key.permissions}</span>
                    <span>Rate: {key.rate_limit_per_minute}/min</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-400">
                    <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                    {key.last_used_at && (
                      <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>
                    )}
                    {key.expires_at && (
                      <span className={new Date(key.expires_at) < new Date() ? 'text-red-500' : ''}>
                        Expires: {new Date(key.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                {key.is_active && (
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
