import { useState, useEffect } from 'react';

interface RiskAlertsPanelProps {
  apiUrl: string;
  limit?: number;
  showAcknowledged?: boolean;
}

interface RiskAlert {
  id: string;
  type: 'vehicle' | 'driver' | 'inspection' | 'maintenance' | 'route';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entityId: string;
  entityName: string;
  createdAt: string;
  acknowledged: boolean;
}

export default function RiskAlertsPanel({ 
  apiUrl, 
  limit = 10,
  showAcknowledged = false 
}: RiskAlertsPanelProps) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAlerts();
    // Refresh every 2 minutes
    const interval = setInterval(fetchAlerts, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const severityParam = filter !== 'all' ? `?severity=${filter}` : '';
      const response = await fetch(`${apiUrl}/risk-intelligence/alerts${severityParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        let filteredAlerts = data.alerts || [];
        if (!showAcknowledged) {
          filteredAlerts = filteredAlerts.filter((a: RiskAlert) => !a.acknowledged);
        }
        setAlerts(filteredAlerts.slice(0, limit));
        setError('');
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Risk alerts error:', errData);
        setError(errData.message || errData.error || `Failed to load alerts (${response.status})`);
      }
    } catch (err: any) {
      console.error('Network error fetching alerts:', err);
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`${apiUrl}/risk-intelligence/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-500 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      default: return 'bg-blue-100 border-blue-500 text-blue-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '🔶';
      default: return 'ℹ️';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vehicle': return '🚗';
      case 'driver': return '👤';
      case 'inspection': return '📋';
      case 'maintenance': return '🔧';
      case 'route': return '🛣️';
      default: return '📌';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-2">🚨 Risk Alerts</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🚨 Risk Alerts
            {alerts.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            )}
          </h3>
          <button
            onClick={fetchAlerts}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {(['all', 'critical', 'high', 'medium'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
                filter === f 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="max-h-96 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-gray-500">No active risk alerts</p>
            <p className="text-sm text-gray-400 mt-1">Your fleet is operating normally</p>
          </div>
        ) : (
          <div className="divide-y">
            {alerts.map((alert) => (
              <div 
                key={alert.id}
                className={`p-4 border-l-4 ${getSeverityColor(alert.severity)} hover:bg-opacity-80 transition-colors`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getSeverityIcon(alert.severity)}</span>
                      <span className="font-semibold text-sm">{alert.title}</span>
                      <span className="text-xs bg-white/50 px-2 py-0.5 rounded">
                        {getTypeIcon(alert.type)} {alert.entityName}
                      </span>
                    </div>
                    <p className="text-sm opacity-90 mb-2">{alert.description}</p>
                    <div className="flex items-center gap-3 text-xs opacity-70">
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                      <span className="uppercase font-medium">{alert.severity}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="text-xs bg-white hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded border shadow-sm whitespace-nowrap"
                    title="Acknowledge and dismiss"
                  >
                    Ack
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div className="p-3 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Showing {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
