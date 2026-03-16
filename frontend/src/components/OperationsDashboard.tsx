import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface OperationsDashboardProps {
  apiUrl: string;
  user: any;
}

interface LiveStatus {
  summary: {
    totalRoutes: number;
    activeVehicles: number;
    availableVehicles: number;
    pendingRequisitions: number;
  };
  todaysRoutes: any[];
  criticalAlerts: any[];
  recentAccidents: any[];
}

interface FleetHealth {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  averageHealth: number;
  atRiskVehicles: any[];
  topRecommendations: any[];
}

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  vehicleReg?: string;
  timestamp: string;
  actionRequired: boolean;
}

export default function OperationsDashboard({ apiUrl }: OperationsDashboardProps) {
  const [, setSocket] = useState<Socket | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [fleetHealth, setFleetHealth] = useState<FleetHealth | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'routes' | 'health' | 'alerts'>('overview');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const token = localStorage.getItem('token');

  const API_BASE = apiUrl.replace('/api', '');

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [statusRes, healthRes, alertsRes, aiRes] = await Promise.all([
        fetch(`${apiUrl}/operations/live-status`, { headers }),
        fetch(`${apiUrl}/operations/fleet-health`, { headers }),
        fetch(`${apiUrl}/operations/alerts`, { headers }),
        fetch(`${apiUrl}/operations/ai-recommendations`, { headers })
      ]);
      
      if (statusRes.ok) setLiveStatus(await statusRes.json());
      if (healthRes.ok) setFleetHealth(await healthRes.json());
      if (alertsRes.ok) {
        const alertData = await alertsRes.json();
        setAlerts(alertData.alerts);
      }
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        setAiRecommendations(aiData.recommendations);
      }
      
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch operations data:', err);
    }
  }, [apiUrl, token]);

  // Setup WebSocket and polling
  useEffect(() => {
    fetchData();
    
    // Connect to WebSocket
    const newSocket = io(API_BASE, {
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('Operations dashboard connected');
    });
    
    newSocket.on('operations:update', (data) => {
      setLiveStatus(data.status);
      setFleetHealth(data.health);
      setLastUpdate(new Date());
    });
    
    setSocket(newSocket);
    
    // Polling fallback (every 30 seconds)
    const pollInterval = setInterval(fetchData, 30000);
    
    // Clock update
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      newSocket.close();
      clearInterval(pollInterval);
      clearInterval(clockInterval);
    };
  }, [fetchData, API_BASE]);

  // Auto-refresh alerts more frequently
  useEffect(() => {
    const alertInterval = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/operations/alerts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.alerts);
        }
      } catch (err) {
        console.error('Failed to refresh alerts:', err);
      }
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(alertInterval);
  }, [apiUrl, token]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-400 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🚛</span>
            <div>
              <h1 className="text-2xl font-bold">Operations Command Center</h1>
              <p className="text-gray-400 text-sm">Live Fleet Monitoring & AI-Powered Insights</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Status Indicators */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-gray-300">Live</span>
              </div>
              <div className="text-gray-400">
                Last update: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
            
            {/* Clock */}
            <div className="text-3xl font-mono font-bold">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
            
            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="flex gap-2 mt-4">
          {[
            { key: 'overview', label: '📊 Overview', icon: '📊' },
            { key: 'routes', label: '🛣️ Routes', icon: '🛣️' },
            { key: 'health', label: '❤️ Fleet Health', icon: '❤️' },
            { key: 'alerts', label: `🚨 Alerts ${alerts.length > 0 ? `(${alerts.filter(a => ['critical', 'high'].includes(a.severity)).length})` : ''}`, icon: '🚨' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {activeView === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                title="Today's Routes"
                value={liveStatus?.summary.totalRoutes || 0}
                subtitle={`${liveStatus?.summary.activeVehicles || 0} active vehicles`}
                icon="🛣️"
                color="blue"
              />
              <KPICard
                title="Fleet Health"
                value={`${fleetHealth?.averageHealth || 0}%`}
                subtitle={`${fleetHealth?.critical || 0} critical`}
                icon="❤️"
                color={(fleetHealth?.averageHealth || 0) >= 80 ? 'green' : (fleetHealth?.averageHealth || 0) >= 60 ? 'yellow' : 'red'}
              />
              <KPICard
                title="Available Vehicles"
                value={liveStatus?.summary.availableVehicles || 0}
                subtitle={`${liveStatus?.summary.pendingRequisitions || 0} pending requests`}
                icon="🚙"
                color="green"
              />
              <KPICard
                title="Active Alerts"
                value={alerts.filter(a => ['critical', 'high'].includes(a.severity)).length}
                subtitle={`${alerts.filter(a => a.severity === 'critical').length} critical`}
                icon="🚨"
                color={alerts.filter(a => a.severity === 'critical').length > 0 ? 'red' : alerts.filter(a => a.severity === 'high').length > 0 ? 'orange' : 'green'}
              />
            </div>

            {/* AI Recommendations */}
            {aiRecommendations.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  🤖 AI Recommendations
                  <span className="text-xs bg-blue-600 px-2 py-1 rounded">LIVE</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiRecommendations.slice(0, 4).map((rec, idx) => (
                    <div key={idx} className="bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          rec.priority === 'critical' ? 'bg-red-600' :
                          rec.priority === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                        }`}>
                          {rec.priority.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-sm">{rec.category}</span>
                      </div>
                      <h3 className="font-semibold mb-1">{rec.title}</h3>
                      <p className="text-gray-300 text-sm mb-2">{rec.description}</p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-green-400">💡 {rec.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critical Alerts Preview */}
            {alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4">🚨 Critical Alerts</h2>
                <div className="space-y-2">
                  {alerts.filter(a => a.severity === 'critical' || a.severity === 'high').slice(0, 5).map((alert) => (
                    <div key={alert.id} className={`p-3 rounded-lg ${getSeverityColor(alert.severity)}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{alert.title}</p>
                          <p className="text-sm opacity-90">{alert.message}</p>
                        </div>
                        {alert.vehicleReg && (
                          <span className="text-xs bg-black/20 px-2 py-1 rounded">{alert.vehicleReg}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'routes' && liveStatus && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Today's Routes ({liveStatus.todaysRoutes.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveStatus.todaysRoutes.map((route) => (
                <div key={route.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{route.route_name || 'Unnamed Route'}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${
                      route.status === 'Completed' ? 'bg-green-600' :
                      route.status === 'In Progress' ? 'bg-blue-600' : 'bg-gray-600'
                    }`}>
                      {route.status}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>🚙 {route.registration_num}</p>
                    <p>👤 {route.driver_name || 'No driver assigned'}</p>
                    {route.actual_km && (
                      <p>📏 {route.actual_km} km {route.target_km && `/${route.target_km} km target`}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'health' && fleetHealth && (
          <div className="space-y-6">
            {/* Health Summary */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'Total', value: fleetHealth.total, color: 'bg-blue-600' },
                { label: 'Critical', value: fleetHealth.critical, color: 'bg-red-600' },
                { label: 'High Risk', value: fleetHealth.high, color: 'bg-orange-500' },
                { label: 'Medium', value: fleetHealth.medium, color: 'bg-yellow-500' },
                { label: 'Healthy', value: fleetHealth.low, color: 'bg-green-500' }
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-800 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <div className={`h-1 mt-2 rounded ${stat.color}`}></div>
                </div>
              ))}
            </div>

            {/* At-Risk Vehicles */}
            {fleetHealth.atRiskVehicles.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">⚠️ At-Risk Vehicles</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-gray-700">
                        <th className="pb-3">Vehicle</th>
                        <th className="pb-3">Health Score</th>
                        <th className="pb-3">Risk Level</th>
                        <th className="pb-3">Predicted Issues</th>
                        <th className="pb-3">Recommended Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleetHealth.atRiskVehicles.slice(0, 10).map((v) => (
                        <tr key={v.vehicleId} className="border-b border-gray-700">
                          <td className="py-3 font-mono">{v.registrationNum}</td>
                          <td className="py-3">
                            <span className={`text-xl font-bold ${getHealthColor(v.healthScore)}`}>
                              {v.healthScore}%
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              v.riskLevel === 'critical' ? 'bg-red-600' :
                              v.riskLevel === 'high' ? 'bg-orange-500' :
                              v.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}>
                              {v.riskLevel.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-300">
                            {v.predictedIssues.slice(0, 2).join(', ')}
                            {v.predictedIssues.length > 2 && ` +${v.predictedIssues.length - 2} more`}
                          </td>
                          <td className="py-3 text-sm text-blue-400">
                            {v.recommendedActions[0]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'alerts' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">All Alerts ({alerts.length})</h2>
              <div className="flex gap-2">
                {['all', 'critical', 'high', 'medium'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => {}}
                    className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm capitalize"
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  ✅ No active alerts
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs opacity-75">{alert.type.toUpperCase()}</span>
                          <span className="text-xs opacity-75">•</span>
                          <span className="text-xs opacity-75">
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <h3 className="font-semibold text-lg">{alert.title}</h3>
                        <p className="opacity-90">{alert.message}</p>
                        
                        {alert.vehicleReg && (
                          <p className="mt-2 text-sm">Vehicle: {alert.vehicleReg}</p>
                        )}
                      </div>
                      
                      {alert.actionRequired && (
                        <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded font-medium">
                          Take Action →
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// KPI Card Component
function KPICard({ title, value, subtitle, icon, color }: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-600'
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-4">
      <div className={`w-16 h-16 rounded-lg ${colorClasses[color] || colorClasses.blue} flex items-center justify-center text-3xl`}>
        {icon}
      </div>
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-gray-400 text-xs">{subtitle}</p>
      </div>
    </div>
  );
}
