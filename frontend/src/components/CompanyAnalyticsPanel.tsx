import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

interface CompanyAnalyticsProps {
  apiUrl: string;
  user?: {
    id?: string;
    email?: string;
    role?: string;
  } | null;
}

interface AnalyticsData {
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  totalDrivers: number;
  activeDrivers: number;
  fleetUtilization: number;
  coursesCompleted: number;
  totalEnrollments: number;
  monthlyFuelConsumption: number;
  monthlyMaintenanceCost: number;
  accidentsThisMonth: number;
  vehicleStatusBreakdown: Array<{ name: string; value: number }>;
  trainingProgress: Array<{ month: string; completed: number; enrolled: number }>;
  fuelEfficiency: Array<{ vehicle: string; efficiency: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

// Check if user can view company analytics
const canViewAnalytics = (role?: string): boolean => {
  const allowedRoles = ['admin', 'fleet_manager', 'high_staff', 'manager', 'transport_supervisor'];
  return allowedRoles.includes(role?.toLowerCase() || '');
};

export default function CompanyAnalyticsPanel({ apiUrl, user }: CompanyAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (canViewAnalytics(user?.role)) {
      fetchAnalytics();
      // Refresh every 5 minutes
      const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [apiUrl, user?.role]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/analytics/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to fetch analytics (${res.status})`);
      }
      
      const result = await res.json();
      setData(result);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Don't render if user doesn't have permission
  if (!canViewAnalytics(user?.role)) {
    return null;
  }

  if (loading && !data) {
    return (
      <div className="bg-white rounded-xl shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-2">📊 Company Analytics</h3>
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <button 
          onClick={fetchAnalytics}
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-2">📊 Company Analytics</h3>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">📊 Company Analytics</h3>
          {lastUpdated && (
            <p className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-blue-600 font-medium">Total Vehicles</p>
          <p className="text-2xl font-bold text-blue-900">{data.totalVehicles}</p>
          <p className="text-xs text-blue-600">{data.activeVehicles} Active</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-xs text-green-600 font-medium">Active Drivers</p>
          <p className="text-2xl font-bold text-green-900">{data.activeDrivers}</p>
          <p className="text-xs text-green-600">of {data.totalDrivers} Total</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-xs text-purple-600 font-medium">Fleet Utilization</p>
          <p className="text-2xl font-bold text-purple-900">{data.fleetUtilization}%</p>
          <p className="text-xs text-purple-600">Active vehicles in use</p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <p className="text-xs text-orange-600 font-medium">Training Progress</p>
          <p className="text-2xl font-bold text-orange-900">{data.coursesCompleted}</p>
          <p className="text-xs text-orange-600">Courses completed</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle Status Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3">Vehicle Status Breakdown</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.vehicleStatusBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.vehicleStatusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Training Progress */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3">Training Progress (6 Months)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trainingProgress}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="completed" stroke="#00C49F" name="Completed" />
                <Line type="monotone" dataKey="enrolled" stroke="#0088FE" name="Enrolled" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fuel Efficiency */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3">Top Vehicles by Fuel Efficiency (km/L)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.fuelEfficiency.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vehicle" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="efficiency" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3">Monthly Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white rounded">
              <span className="text-sm">Fuel Consumption</span>
              <span className="font-semibold text-blue-600">{data.monthlyFuelConsumption.toLocaleString()} L</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded">
              <span className="text-sm">Maintenance Costs</span>
              <span className="font-semibold text-orange-600">${data.monthlyMaintenanceCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded">
              <span className="text-sm">Accidents This Month</span>
              <span className={`font-semibold ${data.accidentsThisMonth > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.accidentsThisMonth}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded">
              <span className="text-sm">Training Completion Rate</span>
              <span className="font-semibold text-green-600">
                {data.totalEnrollments > 0 ? Math.round((data.coursesCompleted / data.totalEnrollments) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
