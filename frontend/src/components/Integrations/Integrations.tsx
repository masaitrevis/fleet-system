import { useState } from 'react';
import ApiKeys from './ApiKeys';
import Webhooks from './Webhooks';

interface IntegrationsProps {
  apiUrl: string;
}

type Tab = 'api-keys' | 'webhooks' | 'usage';

export default function Integrations({ apiUrl }: IntegrationsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('api-keys');
  const token = localStorage.getItem('token');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">🔗 Integrations</h1>
          <p className="text-gray-500">Manage API keys, webhooks, and third-party integrations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex">
            {[
              { key: 'api-keys', label: 'API Keys', icon: '🔑' },
              { key: 'webhooks', label: 'Webhooks', icon: '🪝' },
              { key: 'usage', label: 'API Usage', icon: '📊' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as Tab)}
                className={`px-6 py-4 flex items-center gap-2 font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'api-keys' && <ApiKeys apiUrl={apiUrl} token={token || ''} />}
          {activeTab === 'webhooks' && <Webhooks apiUrl={apiUrl} token={token || ''} />}
          {activeTab === 'usage' && <ApiUsage apiUrl={apiUrl} token={token || ''} />}
        </div>
      </div>
    </div>
  );
}

// API Usage Component
function ApiUsage({ apiUrl, token }: { apiUrl: string; token: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/integrations/usage?days=${days}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">API Usage Statistics</h2>
        <div className="flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!stats && !loading && (
        <div className="text-center py-12 text-gray-500">
          Click Refresh to load usage statistics
        </div>
      )}

      {stats && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold">{stats.totalRequests?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold">
                {stats.errorRate?.percentage > 0 
                  ? `${(100 - parseFloat(stats.errorRate.percentage)).toFixed(1)}%`
                  : '100%'}
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-2xl font-bold">{stats.errorRate?.errors || 0}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Period</p>
              <p className="text-2xl font-bold">{stats.period}</p>
            </div>
          </div>

          {/* Top Endpoints */}
          {stats.byEndpoint && stats.byEndpoint.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4">Endpoint</th>
                    <th className="text-left p-4">Method</th>
                    <th className="text-right p-4">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byEndpoint.map((endpoint: any, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="p-4 font-mono text-sm">{endpoint.endpoint}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                          endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                          endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {endpoint.method}
                        </span>
                      </td>
                      <td className="p-4 text-right">{parseInt(endpoint.count).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
