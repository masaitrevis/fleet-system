import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

interface FleetOverviewPageProps {
  apiUrl: string;
}

interface Vehicle {
  id: string;
  registration_num: string;
  make_model?: string;
  year_of_manufacture?: number;
  ownership: string;
  department?: string;
  branch?: string;
  status: 'Active' | 'Under Maintenance' | 'Retired' | 'Inactive';
  current_mileage: number;
  next_service_due?: string;
  last_service_date?: string;
  target_consumption_rate?: number;
  created_at: string;
}

interface FleetMetrics {
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  retiredVehicles: number;
  totalMileage: number;
  avgMileage: number;
  byDepartment: Record<string, number>;
  byOwnership: Record<string, number>;
  byStatus: Record<string, number>;
  maintenanceDue: Vehicle[];
  highMileage: Vehicle[];
}

interface UtilizationData {
  date: string;
  active: number;
  maintenance: number;
  utilizationRate: number;
}

const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];
const STATUS_COLORS = {
  'Active': 'bg-green-100 text-green-800',
  'Under Maintenance': 'bg-amber-100 text-amber-800',
  'Retired': 'bg-gray-100 text-gray-800',
  'Inactive': 'bg-red-100 text-red-800'
};

export default function FleetOverviewPage({ apiUrl }: FleetOverviewPageProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'utilization' | 'maintenance'>('overview');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      fetchVehicles();
    }
  }, [apiUrl, token]);

  const fetchVehicles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load fleet data');
    } finally {
      setLoading(false);
    }
  };

  // Computed metrics
  const metrics: FleetMetrics = useMemo(() => {
    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter(v => v.status === 'Active').length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'Under Maintenance').length;
    const retiredVehicles = vehicles.filter(v => v.status === 'Retired').length;
    const totalMileage = vehicles.reduce((sum, v) => sum + (v.current_mileage || 0), 0);
    const avgMileage = totalVehicles > 0 ? totalMileage / totalVehicles : 0;

    const byDepartment = vehicles.reduce((acc, v) => {
      const dept = v.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byOwnership = vehicles.reduce((acc, v) => {
      const own = v.ownership || 'Unknown';
      acc[own] = (acc[own] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = vehicles.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Maintenance due within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const maintenanceDue = vehicles.filter(v => {
      if (!v.next_service_due) return false;
      const dueDate = new Date(v.next_service_due);
      return dueDate <= thirtyDaysFromNow && v.status === 'Active';
    }).sort((a, b) => new Date(a.next_service_due!).getTime() - new Date(b.next_service_due!).getTime());

    // High mileage vehicles (top 10)
    const highMileage = [...vehicles]
      .sort((a, b) => (b.current_mileage || 0) - (a.current_mileage || 0))
      .slice(0, 10);

    return {
      totalVehicles,
      activeVehicles,
      maintenanceVehicles,
      retiredVehicles,
      totalMileage,
      avgMileage,
      byDepartment,
      byOwnership,
      byStatus,
      maintenanceDue,
      highMileage
    };
  }, [vehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const deptMatch = selectedDepartment === 'all' || v.department === selectedDepartment;
      const statusMatch = selectedStatus === 'all' || v.status === selectedStatus;
      return deptMatch && statusMatch;
    });
  }, [vehicles, selectedDepartment, selectedStatus]);

  // Chart data
  const departmentData = useMemo(() => 
    Object.entries(metrics.byDepartment).map(([name, value]) => ({ name, value })),
    [metrics.byDepartment]
  );

  const ownershipData = useMemo(() => 
    Object.entries(metrics.byOwnership).map(([name, value]) => ({ name, value })),
    [metrics.byOwnership]
  );

  const statusData = useMemo(() => 
    Object.entries(metrics.byStatus).map(([name, value]) => ({ name, value })),
    [metrics.byStatus]
  );

  const mileageDistribution = useMemo(() => {
    const ranges = [
      { name: '0-50k', min: 0, max: 50000, count: 0 },
      { name: '50-100k', min: 50000, max: 100000, count: 0 },
      { name: '100-150k', min: 100000, max: 150000, count: 0 },
      { name: '150-200k', min: 150000, max: 200000, count: 0 },
      { name: '200k+', min: 200000, max: Infinity, count: 0 }
    ];
    
    vehicles.forEach(v => {
      const mileage = v.current_mileage || 0;
      const range = ranges.find(r => mileage >= r.min && mileage < r.max);
      if (range) range.count++;
    });
    
    return ranges;
  }, [vehicles]);

  // Departments and statuses for filters
  const departments = useMemo(() => 
    ['all', ...Array.from(new Set(vehicles.map(v => v.department).filter(Boolean)))],
    [vehicles]
  );

  const statuses = useMemo(() => 
    ['all', ...Array.from(new Set(vehicles.map(v => v.status)))],
    [vehicles]
  );

  // Utilization trend (mock data for demo - would come from API)
  const utilizationData: UtilizationData[] = useMemo(() => {
    const data: UtilizationData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toISOString().substring(0, 7);
      data.push({
        date: month,
        active: Math.round(metrics.activeVehicles * (0.8 + Math.random() * 0.2)),
        maintenance: Math.round(metrics.maintenanceVehicles * (0.8 + Math.random() * 0.4)),
        utilizationRate: Math.round(70 + Math.random() * 20)
      });
    }
    return data;
  }, [metrics.activeVehicles, metrics.maintenanceVehicles]);

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        <span className="ml-3 text-slate-600">Loading fleet overview...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🚛 Fleet Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Fleet status dashboard and vehicle utilization metrics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchVehicles}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <div className="text-amber-100 text-sm">Total Vehicles</div>
          <div className="text-3xl font-bold">{metrics.totalVehicles}</div>
          <div className="text-amber-200 text-xs mt-1">{metrics.byOwnership['Company'] || 0} Company owned</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="text-green-100 text-sm">Active</div>
          <div className="text-3xl font-bold">{metrics.activeVehicles}</div>
          <div className="text-green-200 text-xs mt-1">
            {metrics.totalVehicles > 0 ? Math.round((metrics.activeVehicles / metrics.totalVehicles) * 100) : 0}% of fleet
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="text-blue-100 text-sm">Total Mileage</div>
          <div className="text-3xl font-bold">{(metrics.totalMileage / 1000).toFixed(1)}k</div>
          <div className="text-blue-200 text-xs mt-1">Avg: {Math.round(metrics.avgMileage).toLocaleString()} km</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="text-red-100 text-sm">In Maintenance</div>
          <div className="text-3xl font-bold">{metrics.maintenanceVehicles}</div>
          <div className="text-red-200 text-xs mt-1">{metrics.maintenanceDue.length} due soon</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {[
              { key: 'overview', label: 'Fleet Status', icon: '📊' },
              { key: 'utilization', label: 'Utilization', icon: '📈' },
              { key: 'maintenance', label: 'Maintenance', icon: '🔧' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-3 flex items-center gap-2 font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-amber-500 text-amber-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">By Status</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${value}`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">By Department</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={departmentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${value}`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">By Ownership</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={ownershipData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${value}`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {ownershipData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Mileage Distribution */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-4">Mileage Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={mileageDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#F59E0B" name="Vehicles" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Vehicle List with Filters */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                    <select
                      value={selectedDepartment}
                      onChange={e => setSelectedDepartment(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2"
                    >
                      {departments.map(d => (
                        <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={selectedStatus}
                      onChange={e => setSelectedStatus(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2"
                    >
                      {statuses.map(s => (
                        <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Registration</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Model</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Department</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Status</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Mileage</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Ownership</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVehicles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            No vehicles match the selected filters
                          </td>
                        </tr>
                      ) : (
                        filteredVehicles.map(v => (
                          <tr key={v.id} className="border-t hover:bg-slate-50">
                            <td className="p-3 font-medium">{v.registration_num}</td>
                            <td className="p-3">{v.make_model || '-'}</td>
                            <td className="p-3">{v.department || '-'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[v.status] || 'bg-gray-100'}`}>
                                {v.status}
                              </span>
                            </td>
                            <td className="p-3">{v.current_mileage?.toLocaleString()} km</td>
                            <td className="p-3">{v.ownership}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Utilization Tab */}
          {activeTab === 'utilization' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-800">Vehicle Utilization</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Utilization Trend (7 Months)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={utilizationData}>
                      <defs>
                        <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="active" stroke="#10B981" fillOpacity={1} fill="url(#colorActive)" name="Active" />
                      <Area type="monotone" dataKey="maintenance" stroke="#F59E0B" fill="#F59E0B" name="Maintenance" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Utilization Rate %</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={utilizationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Line type="monotone" dataKey="utilizationRate" stroke="#3B82F6" strokeWidth={2} name="Utilization %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Utilization Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900">Fleet Availability</h4>
                  <p className="text-3xl font-bold text-green-700 mt-2">
                    {metrics.totalVehicles > 0 
                      ? Math.round((metrics.activeVehicles / metrics.totalVehicles) * 100) 
                      : 0}%
                  </p>
                  <p className="text-sm text-green-600">{metrics.activeVehicles} vehicles available</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900">Maintenance Rate</h4>
                  <p className="text-3xl font-bold text-amber-700 mt-2">
                    {metrics.totalVehicles > 0 
                      ? Math.round((metrics.maintenanceVehicles / metrics.totalVehicles) * 100) 
                      : 0}%
                  </p>
                  <p className="text-sm text-amber-600">{metrics.maintenanceVehicles} in maintenance</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900">Avg Utilization</h4>
                  <p className="text-3xl font-bold text-blue-700 mt-2">
                    {Math.round(utilizationData.reduce((sum, d) => sum + d.utilizationRate, 0) / utilizationData.length)}%
                  </p>
                  <p className="text-sm text-blue-600">Last 7 months average</p>
                </div>
              </div>
            </div>
          )}

          {/* Maintenance Tab */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-800">Maintenance Overview</h2>
              
              {/* Maintenance Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900">Overdue</h4>
                  <p className="text-3xl font-bold text-red-700 mt-2">
                    {metrics.maintenanceDue.filter(v => v.next_service_due && new Date(v.next_service_due) < new Date()).length}
                  </p>
                  <p className="text-sm text-red-600">Immediate attention required</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900">Due Soon (30 days)</h4>
                  <p className="text-3xl font-bold text-amber-700 mt-2">{metrics.maintenanceDue.length}</p>
                  <p className="text-sm text-amber-600">Schedule maintenance</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900">High Mileage (150k+)</h4>
                  <p className="text-3xl font-bold text-slate-700 mt-2">
                    {vehicles.filter(v => (v.current_mileage || 0) >= 150000).length}
                  </p>
                  <p className="text-sm text-slate-600">Consider replacement</p>
                </div>
              </div>

              {/* Maintenance Due List */}
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-800">Maintenance Due Soon</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Vehicle</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Model</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Mileage</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Last Service</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Next Due</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.maintenanceDue.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            ✅ No maintenance due in the next 30 days
                          </td>
                        </tr>
                      ) : (
                        metrics.maintenanceDue.map(v => {
                          const isOverdue = v.next_service_due && new Date(v.next_service_due) < new Date();
                          return (
                            <tr key={v.id} className="border-t hover:bg-slate-50">
                              <td className="p-3 font-medium">{v.registration_num}</td>
                              <td className="p-3">{v.make_model || '-'}</td>
                              <td className="p-3">{v.current_mileage?.toLocaleString()} km</td>
                              <td className="p-3">{v.last_service_date ? new Date(v.last_service_date).toLocaleDateString() : '-'}</td>
                              <td className="p-3">{v.next_service_due}</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  isOverdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {isOverdue ? '🔴 Overdue' : '🟡 Due Soon'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* High Mileage Vehicles */}
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-800">High Mileage Vehicles (Top 10)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Vehicle</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Model</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Year</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Mileage</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.highMileage.map(v => (
                        <tr key={v.id} className="border-t hover:bg-slate-50">
                          <td className="p-3 font-medium">{v.registration_num}</td>
                          <td className="p-3">{v.make_model || '-'}</td>
                          <td className="p-3">{v.year_of_manufacture || '-'}</td>
                          <td className="p-3">{v.current_mileage?.toLocaleString()} km</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[v.status] || 'bg-gray-100'}`}>
                              {v.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
