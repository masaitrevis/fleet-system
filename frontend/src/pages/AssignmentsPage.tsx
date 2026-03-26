import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface AssignmentsPageProps {
  apiUrl: string;
}

interface Assignment {
  id: string;
  vehicle_id: string;
  driver_id: string;
  co_driver_id?: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at?: string;
  registration_num?: string;
  make_model?: string;
  driver_name?: string;
  co_driver_name?: string;
  driver_phone?: string;
  driver_license?: string;
}

interface Vehicle {
  id: string;
  registration_num: string;
  make_model?: string;
  status: string;
  current_mileage: number;
  assigned_driver_id?: string;
  assigned_driver_name?: string;
  department?: string;
}

interface Driver {
  id: string;
  staff_name: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  license_number?: string;
  license_expiry?: string;
  status: string;
}

interface AssignmentHistory {
  month: string;
  assignments: number;
  completions: number;
  cancellations: number;
}

const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];
const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800'
};

export default function AssignmentsPage({ apiUrl }: AssignmentsPageProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'create'>('current');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_id: '',
    co_driver_id: '',
    start_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [apiUrl, token]);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        fetchAssignments(),
        fetchVehicles(),
        fetchDrivers()
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    const res = await fetch(`${apiUrl}/assignments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      // Fallback to routes endpoint if assignments doesn't exist
      const routesRes = await fetch(`${apiUrl}/routes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!routesRes.ok) throw new Error('Failed to fetch assignments');
      const routesData = await routesRes.json();
      // Transform routes to assignments format
      const transformed = routesData.map((r: any) => ({
        id: r.id,
        vehicle_id: r.vehicle_id,
        driver_id: r.driver1_id,
        co_driver_id: r.driver2_id,
        start_date: r.route_date,
        status: r.status === 'Completed' ? 'completed' : 'active',
        notes: r.comments,
        registration_num: r.registration_num,
        make_model: r.make_model,
        driver_name: r.driver1_name,
        co_driver_name: r.driver2_name,
        created_at: r.created_at
      }));
      setAssignments(transformed);
      return;
    }
    const data = await res.json();
    setAssignments(Array.isArray(data) ? data : []);
  };

  const fetchVehicles = async () => {
    const res = await fetch(`${apiUrl}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch vehicles');
    const data = await res.json();
    setVehicles(Array.isArray(data) ? data : []);
  };

  const fetchDrivers = async () => {
    const res = await fetch(`${apiUrl}/staff/drivers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      // Fallback to staff endpoint
      const staffRes = await fetch(`${apiUrl}/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!staffRes.ok) throw new Error('Failed to fetch drivers');
      const staffData = await staffRes.json();
      const driversOnly = staffData.filter((s: any) => 
        s.role?.toLowerCase().includes('driver') || 
        s.designation?.toLowerCase().includes('driver')
      );
      setDrivers(driversOnly);
      return;
    }
    const data = await res.json();
    setDrivers(Array.isArray(data) ? data : []);
  };

  const submitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicle_id: formData.vehicle_id,
          driver_id: formData.driver_id,
          co_driver_id: formData.co_driver_id || null,
          start_date: formData.start_date,
          notes: formData.notes
        })
      });
      
      if (!res.ok) {
        // Fallback: create a route entry
        const routeRes = await fetch(`${apiUrl}/routes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            route_date: formData.start_date,
            vehicle_id: formData.vehicle_id,
            driver1_id: formData.driver_id,
            driver2_id: formData.co_driver_id || null,
            comments: formData.notes
          })
        });
        if (!routeRes.ok) throw new Error('Failed to create assignment');
      }
      
      setShowForm(false);
      setFormData({
        vehicle_id: '',
        driver_id: '',
        co_driver_id: '',
        start_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const completeAssignment = async (id: string) => {
    if (!confirm('Mark this assignment as completed?')) return;
    try {
      const res = await fetch(`${apiUrl}/assignments/${id}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAssignments();
      }
    } catch (err) {
      console.error('Failed to complete assignment:', err);
    }
  };

  const cancelAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this assignment?')) return;
    try {
      const res = await fetch(`${apiUrl}/assignments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (res.ok) {
        fetchAssignments();
      }
    } catch (err) {
      console.error('Failed to cancel assignment:', err);
    }
  };

  // Computed data
  const currentAssignments = useMemo(() => 
    assignments.filter(a => a.status === 'active'),
    [assignments]
  );

  const assignmentStats = useMemo(() => {
    const total = assignments.length;
    const active = assignments.filter(a => a.status === 'active').length;
    const completed = assignments.filter(a => a.status === 'completed').length;
    const cancelled = assignments.filter(a => a.status === 'cancelled').length;
    
    // Driver utilization
    const driverAssignmentCount = assignments.reduce((acc, a) => {
      if (a.driver_id) {
        acc[a.driver_id] = (acc[a.driver_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topDrivers = Object.entries(driverAssignmentCount)
      .map(([id, count]) => ({
        name: drivers.find(d => d.id === id)?.staff_name || id,
        assignments: count
      }))
      .sort((a, b) => b.assignments - a.assignments)
      .slice(0, 5);
    
    return { total, active, completed, cancelled, topDrivers };
  }, [assignments, drivers]);

  const historyData = useMemo(() => {
    const grouped = assignments.reduce((acc, a) => {
      const month = a.start_date?.substring(0, 7) || 'Unknown';
      if (!acc[month]) {
        acc[month] = { month, assignments: 0, completions: 0, cancellations: 0 };
      }
      acc[month].assignments += 1;
      if (a.status === 'completed') acc[month].completions += 1;
      if (a.status === 'cancelled') acc[month].cancellations += 1;
      return acc;
    }, {} as Record<string, AssignmentHistory>);
    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }, [assignments]);

  const unassignedVehicles = useMemo(() => 
    vehicles.filter(v => !v.assigned_driver_id && v.status === 'Active'),
    [vehicles]
  );

  const availableDrivers = useMemo(() => 
    drivers.filter(d => d.status !== 'Inactive'),
    [drivers]
  );

  if (loading && assignments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        <span className="ml-3 text-slate-600">Loading assignments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🚗 Vehicle-Driver Assignments</h1>
          <p className="text-slate-500 text-sm mt-1">Manage vehicle assignments and track driver allocation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAllData}
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
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="text-blue-100 text-sm">Total Assignments</div>
          <div className="text-2xl font-bold">{assignmentStats.total}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="text-green-100 text-sm">Active</div>
          <div className="text-2xl font-bold">{assignmentStats.active}</div>
        </div>
        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-4 text-white">
          <div className="text-slate-100 text-sm">Completed</div>
          <div className="text-2xl font-bold">{assignmentStats.completed}</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="text-red-100 text-sm">Cancelled</div>
          <div className="text-2xl font-bold">{assignmentStats.cancelled}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {[
              { key: 'current', label: 'Current Assignments', icon: '📋' },
              { key: 'history', label: 'Assignment History', icon: '📊' },
              { key: 'create', label: 'New Assignment', icon: '➕' }
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
          {/* Current Assignments Tab */}
          {activeTab === 'current' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800">
                  Active Assignments ({currentAssignments.length})
                </h2>
              </div>

              {currentAssignments.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                  <div className="text-4xl mb-2">🚗</div>
                  <p>No active assignments found.</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-4 text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Create a new assignment →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {currentAssignments.map(a => (
                    <div key={a.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-800 text-lg">{a.registration_num}</h3>
                          <p className="text-sm text-slate-500">{a.make_model || 'Unknown Model'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[a.status]}`}>
                          {a.status}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">👤</span>
                          <span className="font-medium">{a.driver_name || 'Unassigned'}</span>
                          <span className="text-xs text-slate-400">(Primary)</span>
                        </div>
                        {a.co_driver_name && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">👤</span>
                            <span>{a.co_driver_name}</span>
                            <span className="text-xs text-slate-400">(Co-driver)</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>📅</span>
                          <span>Started: {new Date(a.start_date).toLocaleDateString()}</span>
                        </div>
                        {a.notes && (
                          <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">{a.notes}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => completeAssignment(a.id)}
                          className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700"
                        >
                          ✓ Complete
                        </button>
                        <button
                          onClick={() => cancelAssignment(a.id)}
                          className="flex-1 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm hover:bg-red-200"
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unassigned Vehicles */}
              {unassignedVehicles.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-md font-semibold text-slate-700 mb-3">
                    Available Vehicles ({unassignedVehicles.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {unassignedVehicles.map(v => (
                      <div
                        key={v.id}
                        className="bg-slate-100 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                      >
                        <span>🚗</span>
                        <span className="font-medium">{v.registration_num}</span>
                        <button
                          onClick={() => {
                            setFormData({ ...formData, vehicle_id: v.id });
                            setActiveTab('create');
                          }}
                          className="text-amber-600 hover:text-amber-700 text-xs ml-2"
                        >
                          Assign →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-800">Assignment History</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Monthly Trends</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{fontSize: 10}} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="assignments" name="Total" fill="#3B82F6" />
                      <Bar dataKey="completions" name="Completed" fill="#10B981" />
                      <Bar dataKey="cancellations" name="Cancelled" fill="#EF4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Status Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Active', value: assignmentStats.active },
                          { name: 'Completed', value: assignmentStats.completed },
                          { name: 'Cancelled', value: assignmentStats.cancelled }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[0, 1, 2].map((index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Drivers */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-4">Most Assigned Drivers</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={assignmentStats.topDrivers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                    <Tooltip />
                    <Bar dataKey="assignments" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* All Assignments Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Vehicle</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Driver</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Status</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          No assignment history found
                        </td>
                      </tr>
                    ) : (
                      assignments.slice(0, 50).map(a => (
                        <tr key={a.id} className="border-t hover:bg-slate-50">
                          <td className="p-3">{new Date(a.start_date).toLocaleDateString()}</td>
                          <td className="p-3 font-medium">{a.registration_num}</td>
                          <td className="p-3">{a.driver_name || '-'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[a.status]}`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{a.notes || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create Tab */}
          {activeTab === 'create' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-800">Create New Assignment</h2>
              
              <form onSubmit={submitAssignment} className="max-w-2xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Vehicle *
                    </label>
                    <select
                      value={formData.vehicle_id}
                      onChange={e => setFormData({...formData, vehicle_id: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Select Vehicle</option>
                      {vehicles
                        .filter(v => v.status === 'Active')
                        .map(v => (
                          <option key={v.id} value={v.id}>
                            {v.registration_num} {v.assigned_driver_id ? '(Assigned)' : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Primary Driver *
                    </label>
                    <select
                      value={formData.driver_id}
                      onChange={e => setFormData({...formData, driver_id: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Select Driver</option>
                      {availableDrivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.staff_name} {d.license_number ? `(${d.license_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Co-Driver
                    </label>
                    <select
                      value={formData.co_driver_id}
                      onChange={e => setFormData({...formData, co_driver_id: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="">None</option>
                      {availableDrivers
                        .filter(d => d.id !== formData.driver_id)
                        .map(d => (
                          <option key={d.id} value={d.id}>{d.staff_name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={e => setFormData({...formData, start_date: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="Any special instructions or notes..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-amber-500 text-white px-6 py-2 rounded-lg hover:bg-amber-600"
                  >
                    Create Assignment
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('current')}
                    className="bg-slate-300 px-6 py-2 rounded-lg hover:bg-slate-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Available Vehicles</h4>
                  <p className="text-2xl font-bold text-blue-700">{unassignedVehicles.length}</p>
                  <p className="text-sm text-blue-600">Ready for assignment</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Available Drivers</h4>
                  <p className="text-2xl font-bold text-green-700">{availableDrivers.length}</p>
                  <p className="text-sm text-green-600">Active drivers</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
