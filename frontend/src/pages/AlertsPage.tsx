import { useState, useEffect, useMemo } from 'react';
import { Bell, AlertTriangle, CheckCircle, XCircle, Info, Calendar, Shield, Wrench, FileText } from 'lucide-react';

interface AlertsPageProps {
  apiUrl: string;
}

interface Alert {
  id: string;
  type: 'maintenance' | 'document_expiry' | 'fuel_anomaly' | 'accident' | 'inspection' | 'system';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  due_date?: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  resolved_at?: string;
}

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200'
};

const SEVERITY_ICONS = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵'
};

const TYPE_ICONS = {
  maintenance: '🔧',
  document_expiry: '📄',
  fuel_anomaly: '⛽',
  accident: '🚨',
  inspection: '🔍',
  system: '⚙️'
};

export default function AlertsPage({ apiUrl }: AlertsPageProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'warning' | 'info'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      fetchAlerts();
    }
  }, [apiUrl, token]);

  const fetchAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      // Try to fetch from alerts API
      const res = await fetch(`${apiUrl}/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        // Fallback: fetch from risk_intelligence or create from other endpoints
        await fetchAlertsFromAlternativeSources();
        return;
      }
      
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      await fetchAlertsFromAlternativeSources();
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertsFromAlternativeSources = async () => {
    try {
      const newAlerts: Alert[] = [];
      
      // Fetch maintenance due from vehicles
      const vehiclesRes = await fetch(`${apiUrl}/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (vehiclesRes.ok) {
        const vehicles = await vehiclesRes.json();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        vehicles.forEach((v: any) => {
          if (v.next_service_due) {
            const dueDate = new Date(v.next_service_due);
            if (dueDate <= thirtyDaysFromNow && v.status === 'Active') {
              const isOverdue = dueDate < new Date();
              newAlerts.push({
                id: `maintenance-${v.id}`,
                type: 'maintenance',
                severity: isOverdue ? 'critical' : 'warning',
                title: isOverdue ? 'Maintenance Overdue' : 'Maintenance Due Soon',
                message: `Vehicle ${v.registration_num} is ${isOverdue ? 'overdue' : 'due'} for service`,
                entity_type: 'vehicle',
                entity_id: v.id,
                entity_name: v.registration_num,
                due_date: v.next_service_due,
                is_read: false,
                is_dismissed: false,
                created_at: new Date().toISOString()
              });
            }
          }
        });
      }
      
      // Fetch document expiries from staff (licenses)
      const staffRes = await fetch(`${apiUrl}/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (staffRes.ok) {
        const staff = await staffRes.json();
        const sixtyDaysFromNow = new Date();
        sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
        
        staff.forEach((s: any) => {
          if (s.license_expiry) {
            const expiryDate = new Date(s.license_expiry);
            if (expiryDate <= sixtyDaysFromNow) {
              const isExpired = expiryDate < new Date();
              newAlerts.push({
                id: `license-${s.id}`,
                type: 'document_expiry',
                severity: isExpired ? 'critical' : 'warning',
                title: isExpired ? 'License Expired' : 'License Expiring Soon',
                message: `${s.staff_name}'s license is ${isExpired ? 'expired' : 'expiring'}`,
                entity_type: 'driver',
                entity_id: s.id,
                entity_name: s.staff_name,
                due_date: s.license_expiry,
                is_read: false,
                is_dismissed: false,
                created_at: new Date().toISOString()
              });
            }
          }
        });
      }
      
      // Fetch risk alerts
      const riskRes = await fetch(`${apiUrl}/risk-intelligence/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (riskRes.ok) {
        const riskAlerts = await riskRes.json();
        riskAlerts.forEach((r: any) => {
          newAlerts.push({
            id: `risk-${r.id}`,
            type: r.type || 'system',
            severity: r.severity || 'warning',
            title: r.title || 'Risk Alert',
            message: r.description || r.message,
            entity_type: r.entity_type,
            entity_id: r.entity_id,
            entity_name: r.entity_name,
            is_read: r.is_read || false,
            is_dismissed: r.is_dismissed || false,
            created_at: r.created_at
          });
        });
      }
      
      setAlerts(newAlerts);
    } catch (err) {
      setError('Failed to load alerts from any source');
      setAlerts([]);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const res = await fetch(`${apiUrl}/alerts/${alertId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a));
      } else {
        // Local update if API fails
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a));
      }
    } catch {
      // Local update
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    }
  };

  const markAllAsRead = async () => {
    const unreadAlerts = alerts.filter(a => !a.is_read);
    for (const alert of unreadAlerts) {
      await markAsRead(alert.id);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const res = await fetch(`${apiUrl}/alerts/${alertId}/dismiss`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_dismissed: true } : a));
      } else {
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_dismissed: true } : a));
      }
    } catch {
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_dismissed: true } : a));
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`${apiUrl}/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, resolved_at: new Date().toISOString() } : a));
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (alert.is_dismissed) return false;
      
      if (filter === 'unread' && alert.is_read) return false;
      if (filter !== 'all' && filter !== 'unread' && alert.severity !== filter) return false;
      if (typeFilter !== 'all' && alert.type !== typeFilter) return false;
      
      return true;
    }).sort((a, b) => {
      // Sort by severity first, then by date
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [alerts, filter, typeFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: alerts.length,
      unread: alerts.filter(a => !a.is_read).length,
      critical: alerts.filter(a => a.severity === 'critical' && !a.is_dismissed).length,
      warning: alerts.filter(a => a.severity === 'warning' && !a.is_dismissed).length,
      info: alerts.filter(a => a.severity === 'info' && !a.is_dismissed).length
    };
  }, [alerts]);

  const alertTypes = useMemo(() => {
    const types = Array.from(new Set(alerts.map(a => a.type)));
    return ['all', ...types];
  }, [alerts]);

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        <span className="ml-3 text-slate-600">Loading alerts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🔔 System Alerts</h1>
          <p className="text-slate-500 text-sm mt-1">Monitor maintenance due, document expiry, and other alerts</p>
        </div>
        <div className="flex gap-2">
          {stats.unread > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              Mark All Read ({stats.unread})
            </button>
          )}
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            {loading ? '🔄' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-4 text-white">
          <div className="text-slate-100 text-sm">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="text-blue-100 text-sm">Unread</div>
          <div className="text-2xl font-bold">{stats.unread}</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="text-red-100 text-sm">Critical</div>
          <div className="text-2xl font-bold">{stats.critical}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <div className="text-amber-100 text-sm">Warning</div>
          <div className="text-2xl font-bold">{stats.warning}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="text-green-100 text-sm">Info</div>
          <div className="text-2xl font-bold">{stats.info}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex gap-2">
            <span className="text-sm font-medium text-slate-700 self-center">Severity:</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'critical', label: 'Critical' },
              { key: 'warning', label: 'Warning' },
              { key: 'info', label: 'Info' }
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filter === f.key
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <span className="text-sm font-medium text-slate-700 self-center">Type:</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1 text-sm"
            >
              <option value="all">All Types</option>
              {alertTypes.filter(t => t !== 'all').map(type => (
                <option key={type} value={type}>
                  {TYPE_ICONS[type as keyof typeof TYPE_ICONS] || '🔔'} {type.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            Alerts ({filteredAlerts.length})
          </h2>
        </div>
        
        <div className="divide-y divide-slate-200">
          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-lg">No alerts match your filters</p>
              <p className="text-sm mt-1">Great! You're all caught up.</p>
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 hover:bg-slate-50 transition-colors ${
                  !alert.is_read ? 'bg-amber-50/50' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">
                    {TYPE_ICONS[alert.type] || '🔔'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold ${!alert.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                        {alert.title}
                      </h3>
                      
                      <span className={`px-2 py-0.5 rounded text-xs border ${SEVERITY_COLORS[alert.severity]}`}>
                        {SEVERITY_ICONS[alert.severity]} {alert.severity}
                      </span>
                      
                      {!alert.is_read && (
                        <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded">NEW</span>
                      )}
                    </div>
                    
                    <p className="text-slate-600 mt-1">{alert.message}</p>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      {alert.entity_name && (
                        <span className="flex items-center gap-1">
                          <span>📌</span> {alert.entity_name}
                        </span>
                      )}
                      
                      {alert.due_date && (
                        <span className={`flex items-center gap-1 ${
                          alert.due_date && new Date(alert.due_date) < new Date() 
                            ? 'text-red-600 font-medium' : ''
                        }`}>
                          <span>📅</span> Due: {new Date(alert.due_date).toLocaleDateString()}
                        </span>
                      )}
                      
                      <span>🕐 {new Date(alert.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!alert.is_read && (
                      <button
                        onClick={() => markAsRead(alert.id)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Mark as read"
                      >
                        <CheckCircle size={18} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                      title="Resolve"
                    >
                      <CheckCircle size={18} className="text-green-500" />
                    </button>
                    
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Dismiss"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Alert Types Legend */}
      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Alert Types</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(TYPE_ICONS).map(([type, icon]) => (
            <div key={type} className="flex items-center gap-2 text-sm text-slate-600">
              <span>{icon}</span>
              <span className="capitalize">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
