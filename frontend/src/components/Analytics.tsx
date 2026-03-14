import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

interface AnalyticsProps {
  apiUrl: string;
}

interface DriverKPI {
  id: string;
  name: string;
  trips: number;
  fuelEfficiency: number;
  onTimePerformance: number;
  experience: number;
  variance: number;
  rating: number;
}

interface MaintenanceData {
  category: string;
  count: number;
  avgCost: number;
  productivity: number;
}

// Colors for charts

export default function Analytics({ apiUrl }: AnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'maintenance'>('overview');
  const [driverKPIs, setDriverKPIs] = useState<DriverKPI[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData[]>([]);
  const [fleetData, setFleetData] = useState({
    totalVehicles: 0,
    activeVehicles: 0,
    maintenanceDue: 0,
    avgFuelConsumption: 0
  });
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const [driversRes, maintenanceRes, fleetRes] = await Promise.all([
        fetch(`${apiUrl}/analytics/driver-kpis`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/analytics/maintenance-productivity`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/analytics/fleet-summary`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (driversRes.ok) setDriverKPIs(await driversRes.json());
      if (maintenanceRes.ok) setMaintenanceData(await maintenanceRes.json());
      if (fleetRes.ok) setFleetData(await fleetRes.json());
    } catch (err) {
      console.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Sample data if API returns empty
  const sampleDrivers: DriverKPI[] = useMemo(() => [
    { id: '1', name: 'John Kamau', trips: 45, fuelEfficiency: 12.5, onTimePerformance: 95, experience: 8, variance: -2.3, rating: 87 },
    { id: '2', name: 'Mary Wanjiku', trips: 38, fuelEfficiency: 11.8, onTimePerformance: 92, experience: 5, variance: 1.5, rating: 82 },
    { id: '3', name: 'James Ochieng', trips: 52, fuelEfficiency: 13.2, onTimePerformance: 88, experience: 12, variance: -1.8, rating: 91 },
    { id: '4', name: 'Patricia Mutua', trips: 41, fuelEfficiency: 10.9, onTimePerformance: 97, experience: 6, variance: 0.5, rating: 85 },
    { id: '5', name: 'Robert Kipchoge', trips: 48, fuelEfficiency: 12.1, onTimePerformance: 94, experience: 10, variance: -0.8, rating: 89 }
  ], []);

  const drivers = driverKPIs.length > 0 ? driverKPIs : sampleDrivers;

  const sampleMaintenance: MaintenanceData[] = useMemo(() => [
    { category: 'Oil Change', count: 25, avgCost: 4500, productivity: 1.2 },
    { category: 'Brake Service', count: 18, avgCost: 8500, productivity: 0.9 },
    { category: 'Tire Rotation', count: 32, avgCost: 2500, productivity: 1.5 },
    { category: 'Engine Tune', count: 12, avgCost: 15000, productivity: 0.8 },
    { category: 'Transmission', count: 8, avgCost: 45000, productivity: 0.7 },
    { category: 'Electrical', count: 15, avgCost: 6500, productivity: 1.1 }
  ], []);

  const maintenance = maintenanceData.length > 0 ? maintenanceData : sampleMaintenance;

  const fleetStatusData = [
    { name: 'Active', value: fleetData.activeVehicles || 45, color: '#10B981' },
    { name: 'Maintenance', value: fleetData.maintenanceDue || 8, color: '#F59E0B' },
    { name: 'Retired', value: 5, color: '#6B7280' }
  ];

  const fuelTrendData = [
    { month: 'Jan', target: 10.5, actual: 10.2 },
    { month: 'Feb', target: 10.5, actual: 10.8 },
    { month: 'Mar', target: 10.5, actual: 10.1 },
    { month: 'Apr', target: 10.5, actual: 9.9 },
    { month: 'May', target: 10.5, actual: 10.4 },
    { month: 'Jun', target: 10.5, actual: 10.6 }
  ];

  if (loading) return <div className="p-8">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">📈 Analytics Dashboard</h1>
        <div className="bg-gray-100 p-1 rounded-lg flex">
          {(['overview', 'drivers', 'maintenance'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md capitalize ${activeTab === tab ? 'bg-white shadow' : 'text-gray-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl">
              <p className="text-blue-100 text-sm">Total Vehicles</p>
              <p className="text-3xl font-bold">{fleetData.totalVehicles || 58}</p>
              <p className="text-blue-200 text-sm mt-1">↑ 3 from last month</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl">
              <p className="text-green-100 text-sm">Active Vehicles</p>
              <p className="text-3xl font-bold">{fleetData.activeVehicles || 45}</p>
              <p className="text-green-200 text-sm mt-1">78% utilization</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-xl">
              <p className="text-yellow-100 text-sm">Maintenance Due</p>
              <p className="text-3xl font-bold">{fleetData.maintenanceDue || 8}</p>
              <p className="text-yellow-200 text-sm mt-1">Schedule now</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl">
              <p className="text-purple-100 text-sm">Avg Fuel Consumption</p>
              <p className="text-3xl font-bold">{fleetData.avgFuelConsumption?.toFixed(1) || 10.4} <span className="text-lg">km/l</span></p>
              <p className="text-purple-200 text-sm mt-1">Target: 10.5 km/l</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-semibold mb-4">Fleet Status Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={fleetStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {fleetStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-semibold mb-4">Fuel Efficiency Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={fuelTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[8, 12]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="target" stroke="#94A3B8" strokeDasharray="5 5" name="Target" />
                  <Line type="monotone" dataKey="actual" stroke="#3B82F6" strokeWidth={2} name="Actual" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Drivers Tab */}
      {activeTab === 'drivers' && (
        <>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">🏆 Driver Performance Rankings</h3>
              <p className="text-gray-500 text-sm">Rated out of 100 based on efficiency, punctuality, experience, and variance</p>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4">Rank</th>
                  <th className="text-left p-4">Driver</th>
                  <th className="text-center p-4">Trips</th>
                  <th className="text-center p-4">Fuel Eff. (km/l)</th>
                  <th className="text-center p-4">On-Time %</th>
                  <th className="text-center p-4">Experience (yrs)</th>
                  <th className="text-center p-4">Variance</th>
                  <th className="text-center p-4">Rating</th>
                </tr>
              </thead>
              <tbody>
                {drivers
                  .sort((a, b) => b.rating - a.rating)
                  .map((driver, index) => (
                  <tr key={driver.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td className="p-4 font-medium">{driver.name}</td>
                    <td className="p-4 text-center">{driver.trips}</td>
                    <td className="p-4 text-center">{driver.fuelEfficiency.toFixed(1)}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-sm ${driver.onTimePerformance >= 95 ? 'bg-green-100 text-green-800' : driver.onTimePerformance >= 90 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {driver.onTimePerformance}%
                      </span>
                    </td>
                    <td className="p-4 text-center">{driver.experience}</td>
                    <td className="p-4 text-center">
                      <span className={driver.variance <= 0 ? 'text-green-600' : 'text-red-600'}>
                        {driver.variance > 0 ? '+' : ''}{driver.variance.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${driver.rating >= 90 ? 'bg-green-500' : driver.rating >= 80 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                            style={{ width: `${driver.rating}%` }}
                          />
                        </div>
                        <span className="font-bold">{driver.rating}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">Driver Performance Radar</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                { subject: 'Fuel Efficiency', A: 85, fullMark: 100 },
                { subject: 'On-Time', A: 90, fullMark: 100 },
                { subject: 'Safety', A: 95, fullMark: 100 },
                { subject: 'Maintenance', A: 88, fullMark: 100 },
                { subject: 'Customer Rating', A: 92, fullMark: 100 },
              ]}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Avg Performance" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-semibold mb-4">Maintenance by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maintenance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-semibold mb-4">Average Cost by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maintenance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `KES ${value?.toLocaleString?.() || value}`} />
                  <Bar dataKey="avgCost" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">⚠️ Maintenance Warnings</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg">
                <span className="text-2xl">🔴</span>
                <div>
                  <p className="font-medium">KBZ 123X - Service Overdue</p>
                  <p className="text-sm text-gray-600">Last service: 120 days ago | Mileage: 145,000 km</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg">
                <span className="text-2xl">🟡</span>
                <div>
                  <p className="font-medium">KCY 456Y - Service Due Soon</p>
                  <p className="text-sm text-gray-600">Due in 500 km | Current: 49,500 km</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg">
                <span className="text-2xl">🟡</span>
                <div>
                  <p className="font-medium">KDA 789Z - Service Due Soon</p>
                  <p className="text-sm text-gray-600">Due in 300 km | Current: 29,700 km</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
