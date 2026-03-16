import { useState, useEffect } from 'react';

interface FleetIntelligenceWidgetProps {
  apiUrl: string;
}

interface IntelligenceSummary {
  totalVehiclesAtRisk: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  overdueInspections: number;
  maintenanceDueSoon: number;
  driverSafetyAlerts: number;
  vehiclesByRiskLevel: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export default function FleetIntelligenceWidget({ apiUrl }: FleetIntelligenceWidgetProps) {
  const [summary, setSummary] = useState<IntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchIntelligence();
    // Refresh every 5 minutes
    const interval = setInterval(fetchIntelligence, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchIntelligence = async () => {
    try {
      const response = await fetch(`${apiUrl}/risk-intelligence/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
        setError('');
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Fleet intelligence error:', errData);
        setError(errData.message || errData.error || `Failed to load intelligence data (${response.status})`);
      }
    } catch (err: any) {
      console.error('Network error fetching intelligence:', err);
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-2">🧠 Fleet Intelligence</h3>
        <p className="text-red-500 text-sm">{error || 'No data available'}</p>
      </div>
    );
  }

  const totalVehicles = Object.values(summary.vehiclesByRiskLevel).reduce((a, b) => a + b, 0);
  const riskPercentage = totalVehicles > 0 
    ? Math.round(((summary.vehiclesByRiskLevel.high + summary.vehiclesByRiskLevel.critical) / totalVehicles) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold">Fleet Intelligence</h3>
              <p className="text-slate-300 text-sm">AI-powered risk monitoring</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${
              riskPercentage > 20 ? 'text-red-400' : riskPercentage > 10 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {riskPercentage}%
            </div>
            <p className="text-slate-400 text-xs">Fleet at risk</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Critical Alerts */}
          <div className={`p-4 rounded-xl border-l-4 ${
            summary.criticalAlerts > 0 ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-800">{summary.criticalAlerts}</span>
              <span className="text-2xl">🚨</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Critical Alerts</p>
          </div>

          {/* High Alerts */}
          <div className={`p-4 rounded-xl border-l-4 ${
            summary.highAlerts > 0 ? 'bg-orange-50 border-orange-500' : 'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-800">{summary.highAlerts}</span>
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">High Priority</p>
          </div>

          {/* Overdue Inspections */}
          <div className={`p-4 rounded-xl border-l-4 ${
            summary.overdueInspections > 0 ? 'bg-yellow-50 border-yellow-500' : 'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-800">{summary.overdueInspections}</span>
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Overdue Inspections</p>
          </div>

          {/* Maintenance Due */}
          <div className={`p-4 rounded-xl border-l-4 ${
            summary.maintenanceDueSoon > 0 ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-800">{summary.maintenanceDueSoon}</span>
              <span className="text-2xl">🔧</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Maintenance Due (7d)</p>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-600 mb-3">Vehicle Risk Distribution</p>
          <div className="flex h-4 rounded-full overflow-hidden">
            {summary.vehiclesByRiskLevel.critical > 0 && (
              <div 
                className="bg-red-500" 
                style={{ width: `${(summary.vehiclesByRiskLevel.critical / totalVehicles) * 100}%` }}
                title={`Critical: ${summary.vehiclesByRiskLevel.critical}`}
              />
            )}
            {summary.vehiclesByRiskLevel.high > 0 && (
              <div 
                className="bg-orange-500" 
                style={{ width: `${(summary.vehiclesByRiskLevel.high / totalVehicles) * 100}%` }}
                title={`High: ${summary.vehiclesByRiskLevel.high}`}
              />
            )}
            {summary.vehiclesByRiskLevel.medium > 0 && (
              <div 
                className="bg-yellow-500" 
                style={{ width: `${(summary.vehiclesByRiskLevel.medium / totalVehicles) * 100}%` }}
                title={`Medium: ${summary.vehiclesByRiskLevel.medium}`}
              />
            )}
            {summary.vehiclesByRiskLevel.low > 0 && (
              <div 
                className="bg-green-500" 
                style={{ width: `${(summary.vehiclesByRiskLevel.low / totalVehicles) * 100}%` }}
                title={`Low: ${summary.vehiclesByRiskLevel.low}`}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Critical: {summary.vehiclesByRiskLevel.critical}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-full"></span> High: {summary.vehiclesByRiskLevel.high}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Medium: {summary.vehiclesByRiskLevel.medium}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Low: {summary.vehiclesByRiskLevel.low}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
