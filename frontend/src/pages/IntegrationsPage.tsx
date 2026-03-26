import { useState, useEffect } from 'react';
import { 
  Link, Key, Webhook, Activity, CheckCircle, XCircle, AlertTriangle, 
  RefreshCw, ExternalLink, Settings, Shield, Zap, Truck, 
  Fuel, CreditCard, Database, Cloud, Play, Square, Trash2, Plus, Eye, EyeOff,
  Copy, Check, ChevronDown, ChevronUp, Clock, TrendingUp, BarChart3, MoreVertical
} from 'lucide-react';

interface IntegrationsPageProps {
  apiUrl: string;
}

// ==================== TYPES ====================

type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';
type IntegrationType = 'erp' | 'telematics' | 'fuel_card' | 'payment' | 'analytics' | 'custom';

interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  provider: string;
  status: IntegrationStatus;
  icon: string;
  description: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  errorMessage?: string;
  config: Record<string, any>;
  features: string[];
  isActive: boolean;
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
  request_count: number;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  last_triggered_at?: string;
  last_status?: 'success' | 'failed';
  failure_count: number;
  secret_prefix: string;
}

interface IntegrationStats {
  totalRequests: number;
  successRate: number;
  activeIntegrations: number;
  failedWebhooks: number;
  dailyRequests: { date: string; count: number }[];
  byEndpoint: { endpoint: string; method: string; count: number }[];
}

const WEBHOOK_EVENTS = [
  { value: 'vehicle.created', label: 'Vehicle Created', category: 'Fleet' },
  { value: 'vehicle.updated', label: 'Vehicle Updated', category: 'Fleet' },
  { value: 'vehicle.maintenance_due', label: 'Maintenance Due', category: 'Fleet' },
  { value: 'vehicle.status_changed', label: 'Status Changed', category: 'Fleet' },
  { value: 'route.completed', label: 'Route Completed', category: 'Routes' },
  { value: 'route.started', label: 'Route Started', category: 'Routes' },
  { value: 'accident.reported', label: 'Accident Reported', category: 'Safety' },
  { value: 'requisition.created', label: 'Requisition Created', category: 'Requisitions' },
  { value: 'requisition.approved', label: 'Requisition Approved', category: 'Requisitions' },
  { value: 'requisition.allocated', label: 'Vehicle Allocated', category: 'Requisitions' },
  { value: 'inspection.failed', label: 'Inspection Failed', category: 'Safety' },
  { value: 'training.completed', label: 'Training Completed', category: 'Training' },
  { value: 'job_card.created', label: 'Job Card Created', category: 'Workshop' },
  { value: 'job_card.completed', label: 'Job Card Completed', category: 'Workshop' },
  { value: 'fuel.anomaly', label: 'Fuel Anomaly', category: 'Fuel' },
  { value: 'fuel.transaction', label: 'Fuel Transaction', category: 'Fuel' },
  { value: 'driver.assigned', label: 'Driver Assigned', category: 'Staff' },
  { value: 'integration.synced', label: 'Integration Synced', category: 'System' },
];

const INTEGRATION_PROVIDERS = [
  { id: 'sap', name: 'SAP ERP', type: 'erp', icon: 'Database', description: 'Enterprise resource planning integration' },
  { id: 'oracle', name: 'Oracle ERP', type: 'erp', icon: 'Database', description: 'Oracle enterprise resource planning' },
  { id: 'sage', name: 'Sage 300', type: 'erp', icon: 'Database', description: 'Sage accounting and ERP' },
  { id: 'geotab', name: 'Geotab', type: 'telematics', icon: 'Truck', description: 'Fleet telematics and tracking' },
  { id: 'verizon', name: 'Verizon Connect', type: 'telematics', icon: 'Truck', description: 'Fleet management solutions' },
  { id: 'samsara', name: 'Samsara', type: 'telematics', icon: 'Truck', description: 'Connected operations platform' },
  { id: 'fleetcor', name: 'FleetCor', type: 'fuel_card', icon: 'Fuel', description: 'Fleet fuel card management' },
  { id: 'wex', name: 'WEX', type: 'fuel_card', icon: 'Fuel', description: 'Fuel payment solutions' },
  { id: 'shell', name: 'Shell Fleet', type: 'fuel_card', icon: 'Fuel', description: 'Shell fleet card services' },
  { id: 'stripe', name: 'Stripe', type: 'payment', icon: 'CreditCard', description: 'Online payment processing' },
  { id: 'paypal', name: 'PayPal', type: 'payment', icon: 'CreditCard', description: 'PayPal payment gateway' },
  { id: 'powerbi', name: 'Power BI', type: 'analytics', icon: 'BarChart3', description: 'Microsoft business analytics' },
  { id: 'tableau', name: 'Tableau', type: 'analytics', icon: 'BarChart3', description: 'Data visualization platform' },
  { id: 'custom', name: 'Custom API', type: 'custom', icon: 'Cloud', description: 'Custom third-party integration' },
];

export default function IntegrationsPage({ apiUrl }: IntegrationsPageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'connections' | 'api-keys' | 'webhooks' | 'logs'>('overview');
  const [token] = useState(() => localStorage.getItem('token') || '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link className="w-6 h-6 text-blue-600" />
            Integrations & API
          </h1>
          <p className="text-gray-500 mt-1">Manage third-party connections, API keys, and webhooks</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {[
              { key: 'overview', label: 'Overview', icon: Activity },
              { key: 'connections', label: 'Connections', icon: Cloud },
              { key: 'api-keys', label: 'API Keys', icon: Key },
              { key: 'webhooks', label: 'Webhooks', icon: Webhook },
              { key: 'logs', label: 'API Logs', icon: BarChart3 },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-3 flex items-center gap-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <IntegrationsOverview apiUrl={apiUrl} token={token} />}
          {activeTab === 'connections' && <ConnectionsTab apiUrl={apiUrl} token={token} />}
          {activeTab === 'api-keys' && <ApiKeysTab apiUrl={apiUrl} token={token} />}
          {activeTab === 'webhooks' && <WebhooksTab apiUrl={apiUrl} token={token} />}
          {activeTab === 'logs' && <ApiLogsTab apiUrl={apiUrl} token={token} />}
        </div>
      </div>
    </div>
  );
}

// ==================== OVERVIEW TAB ====================

function IntegrationsOverview({ apiUrl, token }: { apiUrl: string; token: string }) {
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      // Fetch integrations
      const intRes = await fetch(`${apiUrl}/integrations/providers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (intRes.ok) {
        const data = await intRes.json();
        setIntegrations(data);
      }

      // Fetch webhooks
      const hookRes = await fetch(`${apiUrl}/integrations/webhooks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (hookRes.ok) {
        const data = await hookRes.json();
        setWebhooks(data);
      }

      // Fetch API usage stats
      const statsRes = await fetch(`${apiUrl}/integrations/usage?days=7`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeIntegrations = integrations.filter(i => i.status === 'connected').length;
  const failedWebhooks = webhooks.filter(w => w.failure_count > 3).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Cloud}
          label="Active Integrations"
          value={activeIntegrations}
          trend={`${integrations.length} total configured`}
          color="blue"
        />
        <StatCard
          icon={Key}
          label="API Keys"
          value={stats?.totalRequests || 0}
          trend="requests this week"
          color="green"
        />
        <StatCard
          icon={Webhook}
          label="Active Webhooks"
          value={webhooks.filter(w => w.is_active).length}
          trend={failedWebhooks > 0 ? `${failedWebhooks} failing` : 'All healthy'}
          color={failedWebhooks > 0 ? 'amber' : 'purple'}
        />
        <StatCard
          icon={Activity}
          label="Success Rate"
          value={`${stats?.successRate?.toFixed?.(1) || 99.5}%`}
          trend="API success rate"
          color="teal"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Integration Activity
          </h3>
          <div className="space-y-3">
            {integrations.slice(0, 5).map((integration) => (
              <div key={integration.id} className="flex items-center gap-3 bg-white p-3 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  integration.status === 'connected' ? 'bg-green-500' :
                  integration.status === 'error' ? 'bg-red-500' :
                  integration.status === 'pending' ? 'bg-amber-500' :
                  'bg-gray-400'
                }`} />
                <div className="flex-1">
                  <p className="font-medium text-sm">{integration.name}</p>
                  <p className="text-xs text-gray-500">
                    {integration.lastSyncAt 
                      ? `Last synced ${new Date(integration.lastSyncAt).toLocaleString()}`
                      : 'Never synced'
                    }
                  </p>
                </div>
                <StatusBadge status={integration.status} />
              </div>
            ))}
            {integrations.length === 0 && (
              <p className="text-gray-500 text-center py-4">No integrations configured yet</p>
            )}
          </div>
        </div>

        {/* API Usage Chart Placeholder */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            API Usage (Last 7 Days)
          </h3>
          <div className="h-40 flex items-end gap-2">
            {stats?.dailyRequests?.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-blue-500 rounded-t"
                  style={{ 
                    height: `${Math.max(20, (day.count / (Math.max(...stats.dailyRequests.map(d => d.count)) || 1)) * 120)}px`,
                    opacity: 0.6 + (idx / stats.dailyRequests.length) * 0.4
                  }}
                />
                <span className="text-xs text-gray-500">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
              </div>
            )) || (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <BarChart3 className="w-12 h-12" />
                <span className="ml-2">No data available</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Health Status */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Integration Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 bg-white p-4 rounded-lg">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">{integrations.filter(i => i.status === 'connected').length} Connected</p>
              <p className="text-sm text-gray-500">Working normally</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4 rounded-lg">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium">{integrations.filter(i => i.status === 'pending').length} Pending</p>
              <p className="text-sm text-gray-500">Setup in progress</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4 rounded-lg">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-medium">{integrations.filter(i => i.status === 'error').length + failedWebhooks} Issues</p>
              <p className="text-sm text-gray-500">Require attention</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== CONNECTIONS TAB ====================

function ConnectionsTab({ apiUrl, token }: { apiUrl: string; token: string }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<typeof INTEGRATION_PROVIDERS[0] | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/integrations/providers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      } else {
        // Fallback to empty array if endpoint doesn't exist yet
        setIntegrations([]);
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;

    try {
      const res = await fetch(`${apiUrl}/integrations/providers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: selectedProvider.id,
          type: selectedProvider.type,
          name: selectedProvider.name,
          config: configForm
        })
      });

      if (res.ok) {
        setShowAdd(false);
        setSelectedProvider(null);
        setConfigForm({});
        fetchIntegrations();
      } else {
        alert('Failed to connect integration');
      }
    } catch (err) {
      console.error('Failed to connect:', err);
      alert('Connection failed');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`${apiUrl}/integrations/providers/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.success ? 'Connection test successful!' : `Test failed: ${data.message}`);
    } catch (err) {
      alert('Test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/integrations/providers/${id}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Sync initiated successfully');
        fetchIntegrations();
      }
    } catch (err) {
      alert('Sync failed');
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`${apiUrl}/integrations/providers/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      if (res.ok) fetchIntegrations();
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;
    try {
      const res = await fetch(`${apiUrl}/integrations/providers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchIntegrations();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const getProviderFields = (type: string) => {
    const commonFields = {
      api_key: 'API Key',
      api_secret: 'API Secret',
    };
    
    switch (type) {
      case 'erp':
        return { ...commonFields, endpoint_url: 'API Endpoint URL', company_code: 'Company Code' };
      case 'telematics':
        return { ...commonFields, account_id: 'Account ID', group_id: 'Group ID' };
      case 'fuel_card':
        return { ...commonFields, merchant_id: 'Merchant ID', program_id: 'Program ID' };
      case 'payment':
        return { ...commonFields, webhook_secret: 'Webhook Secret' };
      default:
        return commonFields;
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Third-Party Connections</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      {/* Add Integration Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold">Add Integration</h3>
              <button onClick={() => { setShowAdd(false); setSelectedProvider(null); }} className="text-gray-500 hover:text-gray-700">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {!selectedProvider ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {INTEGRATION_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider)}
                      className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          {provider.icon === 'Database' && <Database className="w-5 h-5 text-blue-600" />}
                          {provider.icon === 'Truck' && <Truck className="w-5 h-5 text-green-600" />}
                          {provider.icon === 'Fuel' && <Fuel className="w-5 h-5 text-amber-600" />}
                          {provider.icon === 'CreditCard' && <CreditCard className="w-5 h-5 text-purple-600" />}
                          {provider.icon === 'BarChart3' && <BarChart3 className="w-5 h-5 text-indigo-600" />}
                          {provider.icon === 'Cloud' && <Cloud className="w-5 h-5 text-cyan-600" />}
                        </div>
                        <div>
                          <p className="font-medium">{provider.name}</p>
                          <p className="text-xs text-gray-500">{provider.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleConnect} className="space-y-4">
                  <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 rounded-lg">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      {selectedProvider.icon === 'Database' && <Database className="w-6 h-6 text-blue-600" />}
                      {selectedProvider.icon === 'Truck' && <Truck className="w-6 h-6 text-green-600" />}
                      {selectedProvider.icon === 'Fuel' && <Fuel className="w-6 h-6 text-amber-600" />}
                      {selectedProvider.icon === 'CreditCard' && <CreditCard className="w-6 h-6 text-purple-600" />}
                      {selectedProvider.icon === 'BarChart3' && <BarChart3 className="w-6 h-6 text-indigo-600" />}
                      {selectedProvider.icon === 'Cloud' && <Cloud className="w-6 h-6 text-cyan-600" />}
                    </div>
                    <div>
                      <p className="font-semibold">{selectedProvider.name}</p>
                      <p className="text-sm text-gray-500">{selectedProvider.description}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {Object.entries(getProviderFields(selectedProvider.type)).map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                        <input
                          type={key.includes('secret') || key.includes('key') ? 'password' : 'text'}
                          value={configForm[key] || ''}
                          onChange={(e) => setConfigForm({ ...configForm, [key]: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`Enter ${label}`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProvider(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Back
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Integrations List */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        </div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Cloud className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-2">No integrations configured yet</p>
          <p className="text-sm text-gray-400">Connect your ERP, telematics, or other systems</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    integration.status === 'connected' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {integration.type === 'erp' && <Database className="w-6 h-6 text-blue-600" />}
                    {integration.type === 'telematics' && <Truck className="w-6 h-6 text-green-600" />}
                    {integration.type === 'fuel_card' && <Fuel className="w-6 h-6 text-amber-600" />}
                    {integration.type === 'payment' && <CreditCard className="w-6 h-6 text-purple-600" />}
                    {integration.type === 'analytics' && <BarChart3 className="w-6 h-6 text-indigo-600" />}
                    {integration.type === 'custom' && <Cloud className="w-6 h-6 text-cyan-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{integration.name}</h3>
                      <StatusBadge status={integration.status} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{integration.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {integration.features.map((feature, idx) => (
                        <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {feature}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      {integration.lastSyncAt && (
                        <span>Last sync: {new Date(integration.lastSyncAt).toLocaleString()}</span>
                      )}
                      {integration.nextSyncAt && (
                        <span>Next sync: {new Date(integration.nextSyncAt).toLocaleString()}</span>
                      )}
                    </div>
                    {integration.errorMessage && (
                      <p className="text-xs text-red-600 mt-2">{integration.errorMessage}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(integration.id)}
                    disabled={testingId === integration.id}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Test connection"
                  >
                    <Play className={`w-4 h-4 ${testingId === integration.id ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleSync(integration.id)}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                    title="Sync now"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(integration.id, integration.isActive)}
                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                    title={integration.isActive ? 'Disable' : 'Enable'}
                  >
                    {integration.isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(integration.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
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

// ==================== API KEYS TAB ====================

function ApiKeysTab({ apiUrl, token }: { apiUrl: string; token: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: ['read'] as string[],
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
        setFormData({ name: '', description: '', permissions: ['read'], expiresInDays: '', rateLimitPerMinute: 60 });
        fetchKeys();
      }
    } catch (err) {
      console.error('Failed to create API key:', err);
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${apiUrl}/integrations/api-keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchKeys();
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* New Key Alert */}
      {newKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-5 h-5 text-amber-700" />
                <h3 className="font-semibold text-amber-900">New API Key Created</h3>
              </div>
              <p className="text-sm text-amber-800 mb-3">
                Copy this key now! It will only be shown once.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black text-green-400 px-4 py-3 rounded-lg font-mono text-sm break-all">
                  {newKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newKey)}
                  className="bg-amber-600 text-white px-4 py-3 rounded-lg hover:bg-amber-700 flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <button onClick={() => setNewKey(null)} className="text-amber-700 hover:text-amber-900">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={createKey} className="bg-gray-50 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., GPS Tracker Integration"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="What is this key for?"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
              <div className="space-y-2">
                {['read', 'write'].map((perm) => (
                  <label key={perm} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(perm)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, permissions: [...formData.permissions, perm] });
                        } else {
                          setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== perm) });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm capitalize">{perm}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires In (days)</label>
              <input
                type="number"
                value={formData.expiresInDays}
                onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Never"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limit (req/min)</label>
              <input
                type="number"
                value={formData.rateLimitPerMinute}
                onChange={(e) => setFormData({ ...formData, rateLimitPerMinute: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                min="10"
                max="1000"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              Create Key
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Keys List */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Key className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No API keys yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div key={key.id} className={`border rounded-xl p-4 ${key.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{key.name}</h3>
                    {key.is_active ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
                    ) : (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Revoked</span>
                    )}
                  </div>
                  {key.description && <p className="text-sm text-gray-500 mt-1">{key.description}</p>}
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                    <span className="font-mono">{key.key_prefix}••••••••</span>
                    <span>Permissions: {key.permissions.join(', ')}</span>
                    <span>Rate: {key.rate_limit_per_minute}/min</span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                    {key.last_used_at && <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>}
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
                    className="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-200 rounded-lg hover:bg-red-50"
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

// ==================== WEBHOOKS TAB ====================

function WebhooksTab({ apiUrl, token }: { apiUrl: string; token: string }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
      if (res.ok) fetchWebhooks();
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
      if (res.ok) fetchWebhooks();
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const eventsByCategory = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) acc[event.category] = [];
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, typeof WEBHOOK_EVENTS>);

  return (
    <div className="space-y-6">
      {/* New Secret Alert */}
      {newSecret && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-amber-700" />
                <h3 className="font-semibold text-amber-900">Webhook Created</h3>
              </div>
              <p className="text-sm text-amber-800 mb-3">
                Copy this secret now! It will only be shown once. Use it to verify webhook signatures.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black text-green-400 px-4 py-3 rounded-lg font-mono text-sm truncate">
                  {newSecret}
                </code>
                <button
                  onClick={() => copyToClipboard(newSecret)}
                  className="bg-amber-600 text-white px-4 py-3 rounded-lg hover:bg-amber-700 flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <button onClick={() => setNewSecret(null)} className="text-amber-700 hover:text-amber-900">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-semibold">Webhook Delivery Logs</h3>
              <button onClick={() => setShowLogs(null)} className="text-gray-500 hover:text-gray-700">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No logs found</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-medium text-sm">Time</th>
                      <th className="text-left p-4 font-medium text-sm">Event</th>
                      <th className="text-left p-4 font-medium text-sm">Status</th>
                      <th className="text-left p-4 font-medium text-sm">Attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-4 text-sm">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-4 text-sm font-medium">{log.event_type}</td>
                        <td className="p-4">
                          {log.response_status ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.response_status < 300 ? 'bg-green-100 text-green-800' :
                              log.response_status < 400 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {log.response_status}
                            </span>
                          ) : (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Failed</span>
                          )}
                        </td>
                        <td className="p-4 text-sm">#{log.attempt_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Webhooks</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={createWebhook} className="bg-gray-50 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Slack Notifications"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="https://your-app.com/webhook"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Events *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {Object.entries(eventsByCategory).map(([category, events]) => (
                <div key={category}>
                  <h4 className="font-medium text-sm text-gray-900 mb-2">{category}</h4>
                  <div className="space-y-2">
                    {events.map((event) => (
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
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{event.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              Create Webhook
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Webhooks List */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Webhook className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No webhooks configured yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className={`border rounded-xl p-4 ${webhook.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{webhook.name}</h3>
                    {webhook.is_active ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Inactive</span>
                    )}
                    {webhook.failure_count > 3 && (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Failing
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-mono text-gray-500 mt-1 truncate">{webhook.url}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {webhook.events.map((event) => (
                      <span key={event} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
                        {event}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span>Created: {new Date(webhook.created_at).toLocaleDateString()}</span>
                    {webhook.last_triggered_at && <span>Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}</span>}
                    {webhook.failure_count > 0 && <span className="text-red-500">Failures: {webhook.failure_count}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => testWebhook(webhook.id)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Test"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fetchLogs(webhook.id)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="Logs"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                    title={webhook.is_active ? 'Disable' : 'Enable'}
                  >
                    {webhook.is_active ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteWebhook(webhook.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
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

// ==================== API LOGS TAB ====================

function ApiLogsTab({ apiUrl, token }: { apiUrl: string; token: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  useEffect(() => {
    fetchLogs();
  }, [days]);

  const fetchLogs = async () => {
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
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-lg font-semibold">API Usage Statistics</h2>
        <div className="flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Activity} label="Total Requests" value={stats.totalRequests?.toLocaleString() || '0'} color="blue" />
          <StatCard icon={CheckCircle} label="Success Rate" value={`${(stats.successRate || 0).toFixed(1)}%`} color="green" />
          <StatCard icon={Zap} label="Avg Response" value="< 200ms" color="purple" />
          <StatCard icon={Shield} label="Error Rate" value={`${(100 - (stats.successRate || 99)).toFixed(1)}%`} color="amber" />
        </div>
      )}

      {/* Top Endpoints */}
      {stats?.byEndpoint && stats.byEndpoint.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold">Top Endpoints</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-sm">Endpoint</th>
                <th className="text-left p-4 font-medium text-sm">Method</th>
                <th className="text-right p-4 font-medium text-sm">Requests</th>
              </tr>
            </thead>
            <tbody>
              {stats.byEndpoint.map((endpoint: any, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="p-4 font-mono text-sm">{endpoint.endpoint}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {endpoint.method}
                    </span>
                  </td>
                  <td className="p-4 text-right font-medium">{parseInt(endpoint.count).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!stats && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Click Refresh to load usage statistics</p>
        </div>
      )}
    </div>
  );
}

// ==================== HELPER COMPONENTS ====================

function StatCard({ icon: Icon, label, value, trend, color }: { 
  icon: any; 
  label: string; 
  value: string | number;
  trend?: string;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'teal' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    amber: 'bg-amber-50 text-amber-700',
    teal: 'bg-teal-50 text-teal-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className={`${colors[color]} rounded-xl p-4`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5 opacity-70" />
        <span className="text-sm font-medium opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {trend && <p className="text-xs mt-1 opacity-70">{trend}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const styles = {
    connected: 'bg-green-100 text-green-800',
    disconnected: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
    pending: 'bg-amber-100 text-amber-800',
  };

  const labels = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
    pending: 'Pending',
  };

  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
