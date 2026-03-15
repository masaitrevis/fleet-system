import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface DashboardProps {
  apiUrl: string;
  user?: {
    id?: string;
    email?: string;
    role?: string;
    staffRole?: string | null;
    staffName?: string | null;
  } | null;
}

interface Stats {
  fleet: {
    total_vehicles: string;
    active_vehicles: string;
    maintenance_vehicles: string;
    total_mileage: string;
  };
  staff: { total_staff: string };
  today: {
    today_routes: string;
    today_km: string;
    today_fuel: string;
  };
  monthlyFuel: {
    monthly_cost: string;
    monthly_liters: string;
  };
  repairs: {
    pending_repairs: string;
    repair_costs: string;
  };
  topConsumers: Array<{
    registration_num: string;
    total_fuel: string;
    total_cost: string;
  }>;
  maintenanceDue: Array<{
    registration_num: string;
    make_model: string;
    current_mileage: number;
    next_service_due: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// Role-based visibility config
const DRIVER_HIDDEN_CARDS = ['Total Staff', 'Pending Repairs'];

export default function Dashboard({ apiUrl, user }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [myStats, setMyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const token = localStorage.getItem('token');
  
  // Check if user is a driver
  const isDriver = user?.staffRole?.toLowerCase().includes('driver') || 
                   user?.role?.toLowerCase().includes('driver');

  const fetchStats = () => {
    setLoading(true);
    fetch(`${apiUrl}/dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        console.log('Dashboard stats:', data);
        setStats(data);
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch(err => {
        console.error('Dashboard error:', err);
        setLoading(false);
      });
  };

  // Fetch driver-specific stats
  const fetchMyStats = () => {
    if (!isDriver) return;
    
    fetch(`${apiUrl}/routes/my-routes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        console.log('My routes:', data);
        setMyStats({
          totalRoutes: data?.length || 0,
          completed: data?.filter((r: any) => r.status === 'Completed')?.length || 0,
          pending: data?.filter((r: any) => r.status === 'Assigned')?.length || 0
        });
      })
      .catch(err => {
        console.error('Failed to fetch my stats:', err);
      });
  };

  useEffect(() => {
    fetchStats();
    if (isDriver) {
      fetchMyStats();
    }
  }, [apiUrl, token, isDriver]);

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!stats) return <div className="text-center py-12 text-red-600">Failed to load stats</div>;

  const fleetStatusData = [
    { name: 'Active', value: parseInt(stats.fleet?.active_vehicles || '0'), color: '#10B981' },
    { name: 'Maintenance', value: parseInt(stats.fleet?.maintenance_vehicles || '0'), color: '#F59E0B' },
  ];

  const fuelData = stats.topConsumers?.map(c => ({
    name: c.registration_num,
    fuel: parseFloat(c.total_fuel || '0'),
    cost: parseFloat(c.total_cost || '0')
  })) || [];

  // Filter stat cards for drivers
  let statCards = [
    { title: 'Total Vehicles', value: stats.fleet?.total_vehicles || '0', color: 'bg-blue-500', icon: '🚗' },
    { title: 'Active Vehicles', value: stats.fleet?.active_vehicles || '0', color: 'bg-green-500', icon: '✅' },
    { title: 'Under Maintenance', value: stats.fleet?.maintenance_vehicles || '0', color: 'bg-orange-500', icon: '🔧' },
    { title: 'Total Staff', value: stats.staff?.total_staff || '0', color: 'bg-purple-500', icon: '👥' },
  ];

  if (isDriver) {
    statCards = statCards.filter(card => !DRIVER_HIDDEN_CARDS.includes(card.title));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">
            {isDriver ? `Welcome, ${user?.staffName || 'Driver'}` : 'Dashboard'}
          </h2>
          {isDriver && <p className="text-gray-500 text-sm mt-1">Driver View - Limited Access</p>}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Driver Summary Cards */}
      {isDriver && myStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-4xl mb-2">🚗</div>
            <div className="text-3xl font-bold">{myStats.totalRoutes}</div>
            <div className="text-white/80">My Total Routes</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-3xl font-bold">{myStats.completed}</div>
            <div className="text-white/80">Completed</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-4xl mb-2">⏳</div>
            <div className="text-3xl font-bold">{myStats.pending}</div>
            <div className="text-white/80">Pending</div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards?.map((card, i) => (
          <div key={i} className={`${card.color} rounded-xl p-6 text-white shadow-lg`}>
            <div className="text-4xl mb-2">{card.icon}</div>
            <div className="text-3xl font-bold">{card.value}</div>
            <div className="text-white/80">{card.title}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Fleet Status Chart */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Fleet Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={fleetStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {fleetStatusData?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Fuel Consumption Chart */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Fuel Consumers (30 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={fuelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{fontSize: 12}} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="fuel" fill="#3B82F6" name="Fuel (L)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Operations Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Today's Operations</h3>
          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Routes Completed:</span>
              <span className="font-semibold">{stats.today?.today_routes || 0}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Total Distance:</span>
              <span className="font-semibold">{parseFloat(stats.today?.today_km || '0').toLocaleString()} km</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Fuel Used:</span>
              <span className="font-semibold">{parseFloat(stats.today?.today_fuel || '0').toLocaleString()} L</span>
            </div>
          </div>
        </div>

        {!isDriver && (
          <>
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">💰 Monthly Fuel Costs</h3>
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="font-semibold text-red-600">${parseFloat(stats.monthlyFuel?.monthly_cost || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Total Liters:</span>
                  <span className="font-semibold">{parseFloat(stats.monthlyFuel?.monthly_liters || '0').toLocaleString()} L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending Repairs:</span>
                  <span className="font-semibold text-orange-600">{stats.repairs?.pending_repairs || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">⛽ Fuel Costs by Vehicle</h3>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={fuelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="cost"
                  >
                    {fuelData?.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Maintenance Due - Hidden for drivers */}
      {!isDriver && (
        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">⚠️ Maintenance Due Soon</h3>
          {stats.maintenanceDue?.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Vehicle</th>
                  <th className="text-left p-3">Model</th>
                  <th className="text-left p-3">Current Mileage</th>
                  <th className="text-left p-3">Service Due</th>
                </tr>
              </thead>
              <tbody>
                {stats.maintenanceDue?.map((v, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-3 font-medium">{v.registration_num}</td>
                    <td className="p-3">{v.make_model}</td>
                    <td className="p-3">{v.current_mileage?.toLocaleString()} km</td>
                    <td className="p-3 text-orange-600">{v.next_service_due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500">✅ No maintenance due in next 30 days</p>
          )}
        </div>
      )}
    </div>
  );
}