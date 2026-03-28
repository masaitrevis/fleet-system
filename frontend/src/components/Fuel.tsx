import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

interface FuelProps {
  apiUrl: string;
}

interface FuelRecord {
  id: string;
  fuel_date: string;
  registration_num: string;
  vehicle_id: string;
  past_mileage: number;
  current_mileage: number;
  distance_km: number;
  quantity_liters: number;
  km_per_liter: number;
  amount: number;
  cost_per_km: number;
  place: string;
  card_num?: string;
  card_name?: string;
  created_at?: string;
}

interface Vehicle {
  id: string;
  registration_num: string;
  make_model?: string;
  current_mileage: number;
  fuel_type?: string;
  status?: string;
}

interface FuelAnalytics {
  totalFuel: number;
  totalCost: number;
  totalDistance: number;
  avgEfficiency: number;
  avgCostPerKm: number;
  recordsCount: number;
}

interface Alert {
  id: string;
  type: 'low_efficiency' | 'high_cost' | 'maintenance' | 'overspeed';
  message: string;
  vehicle: string;
  severity: 'warning' | 'critical';
  date: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function Fuel({ apiUrl }: FuelProps) {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'analytics' | 'alerts' | 'trends'>('records');
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    fuel_date: new Date().toISOString().split('T')[0],
    vehicle_id: '',
    card_num: '',
    card_name: '',
    past_mileage: '',
    current_mileage: '',
    quantity_liters: '',
    amount: '',
    place: ''
  });
  const [calculatedDistance, setCalculatedDistance] = useState(0);
  const [calculatedEfficiency, setCalculatedEfficiency] = useState(0);
  const [calculatedCostPerKm, setCalculatedCostPerKm] = useState(0);

  // Filter states
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [selectedVehicle, setSelectedVehicle] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (apiUrl && token) {
      fetchData();
    } else {
      setLoading(false);
      if (!token) {
        setError('Authentication required. Please login.');
      }
    }
  }, [apiUrl]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) throw new Error('No authentication token');
      
      const [fuelRes, vehiclesRes] = await Promise.all([
        fetch(`${apiUrl}/fuel`, { headers: { 'Authorization': `Bearer ${currentToken}` } }),
        fetch(`${apiUrl}/vehicles`, { headers: { 'Authorization': `Bearer ${currentToken}` } })
      ]);
      
      if (fuelRes.status === 401 || fuelRes.status === 403) {
        throw new Error('Session expired. Please logout and login again.');
      }
      
      if (!fuelRes.ok) throw new Error(`Failed to fetch fuel records: ${fuelRes.status}`);
      if (!vehiclesRes.ok) throw new Error(`Failed to fetch vehicles: ${vehiclesRes.status}`);
      
      const [fuelData, vehiclesData] = await Promise.all([
        fuelRes.json(),
        vehiclesRes.json()
      ]);
      
      setRecords(Array.isArray(fuelData) ? fuelData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load data');
      setRecords([]);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate when form values change
  useEffect(() => {
    const past = parseInt(formData.past_mileage) || 0;
    const current = parseInt(formData.current_mileage) || 0;
    const liters = parseFloat(formData.quantity_liters) || 0;
    const amount = parseFloat(formData.amount) || 0;
    
    const distance = current > past ? current - past : 0;
    const efficiency = distance > 0 && liters > 0 ? distance / liters : 0;
    const costPerKm = distance > 0 && amount > 0 ? amount / distance : 0;
    
    setCalculatedDistance(distance);
    setCalculatedEfficiency(efficiency);
    setCalculatedCostPerKm(costPerKm);
  }, [formData.past_mileage, formData.current_mileage, formData.quantity_liters, formData.amount]);

  const handleVehicleChange = (vehicleId: string) => {
    if (!vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: '', past_mileage: '' }));
      return;
    }
    
    const vehicle = vehicles?.find(v => v?.id === vehicleId);
    setFormData(prev => ({
      ...prev,
      vehicle_id: vehicleId,
      past_mileage: vehicle?.current_mileage?.toString() || ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      setError('Authentication required. Please login again.');
      return;
    }
    
    try {
      const res = await fetch(`${apiUrl}/fuel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          fuel_date: formData.fuel_date,
          vehicle_id: formData.vehicle_id,
          card_num: formData.card_num,
          card_name: formData.card_name,
          past_mileage: parseInt(formData.past_mileage) || 0,
          current_mileage: parseInt(formData.current_mileage) || 0,
          quantity_liters: parseFloat(formData.quantity_liters) || 0,
          amount: parseFloat(formData.amount) || 0,
          place: formData.place
        })
      });
      
      if (res.status === 401 || res.status === 403) {
        throw new Error('Session expired. Please logout and login again.');
      }
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to save: ${res.status}`);
      }
      
      setShowForm(false);
      setFormData({
        fuel_date: new Date().toISOString().split('T')[0],
        vehicle_id: '',
        card_num: '',
        card_name: '',
        past_mileage: '',
        current_mileage: '',
        quantity_liters: '',
        amount: '',
        place: ''
      });
      fetchData();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to save fuel record');
    }
  };

  // Filter records based on date range and selected vehicle
  const filteredRecords = useMemo(() => {
    let filtered = records;
    
    // Filter by vehicle
    if (selectedVehicle) {
      filtered = filtered.filter(r => r.vehicle_id === selectedVehicle);
    }
    
    // Filter by date range
    const now = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return filtered;
    }
    
    return filtered.filter(r => new Date(r.fuel_date) >= startDate);
  }, [records, dateRange, selectedVehicle]);

  // Calculate analytics
  const analytics: FuelAnalytics = useMemo(() => {
    const data = filteredRecords;
    const totalFuel = data.reduce((sum, r) => sum + (r.quantity_liters || 0), 0);
    const totalCost = data.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalDistance = data.reduce((sum, r) => sum + (r.distance_km || 0), 0);
    const avgEfficiency = totalFuel > 0 ? totalDistance / totalFuel : 0;
    const avgCostPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;
    
    return {
      totalFuel,
      totalCost,
      totalDistance,
      avgEfficiency,
      avgCostPerKm,
      recordsCount: data.length
    };
  }, [filteredRecords]);

  // Chart data
  const chartData = useMemo(() => {
    // Group by month
    const monthly = filteredRecords.reduce((acc, r) => {
      const month = r.fuel_date.substring(0, 7);
      if (!acc[month]) {
        acc[month] = { month, liters: 0, cost: 0, distance: 0 };
      }
      acc[month].liters += r.quantity_liters || 0;
      acc[month].cost += r.amount || 0;
      acc[month].distance += r.distance_km || 0;
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(monthly).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [filteredRecords]);

  const vehicleEfficiencyData = useMemo(() => {
    const vehicleStats = filteredRecords.reduce((acc, r) => {
      if (!acc[r.registration_num]) {
        acc[r.registration_num] = { 
          vehicle: r.registration_num, 
          totalLiters: 0, 
          totalDistance: 0,
          avgEfficiency: 0
        };
      }
      acc[r.registration_num].totalLiters += r.quantity_liters || 0;
      acc[r.registration_num].totalDistance += r.distance_km || 0;
      return acc;
    }, {} as Record<string, any>);
    
    // Calculate efficiency for each
    Object.values(vehicleStats).forEach((v: any) => {
      v.avgEfficiency = v.totalLiters > 0 ? v.totalDistance / v.totalLiters : 0;
    });
    
    return Object.values(vehicleStats)
      .sort((a: any, b: any) => b.avgEfficiency - a.avgEfficiency)
      .slice(0, 10);
  }, [filteredRecords]);

  // Generate alerts based on data
  const alerts: Alert[] = useMemo(() => {
    const newAlerts: Alert[] = [];
    
    // Check for low efficiency vehicles
    const vehicleStats = records.reduce((acc, r) => {
      if (!acc[r.vehicle_id]) {
        acc[r.vehicle_id] = { 
          vehicle: r.registration_num, 
          liters: 0, 
          distance: 0,
          records: 0
        };
      }
      acc[r.vehicle_id].liters += r.quantity_liters || 0;
      acc[r.vehicle_id].distance += r.distance_km || 0;
      acc[r.vehicle_id].records += 1;
      return acc;
    }, {} as Record<string, any>);
    
    Object.entries(vehicleStats).forEach(([vehicleId, stats]: [string, any]) => {
      if (stats.records >= 3) {
        const efficiency = stats.liters > 0 ? stats.distance / stats.liters : 0;
        if (efficiency < 5) {
          newAlerts.push({
            id: `low-eff-${vehicleId}`,
            type: 'low_efficiency',
            message: `${stats.vehicle} has low fuel efficiency (${efficiency.toFixed(1)} km/L)`,
            vehicle: stats.vehicle,
            severity: 'warning',
            date: new Date().toISOString()
          });
        }
      }
    });
    
    return newAlerts;
  }, [records]);

  const handleReLogin = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading fuel records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">⛽ Fuel Management</h2>
          <p className="text-gray-500">Track fuel consumption, costs, and vehicle efficiency</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          {showForm ? 'Cancel' : '+ Add Fuel Record'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          <p>{error}</p>
          {(error.includes('expired') || error.includes('token') || error.includes('Authentication')) && (
            <button onClick={handleReLogin} className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
              🔑 Click to Re-Login
            </button>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl">
          <p className="text-sm text-gray-600">Total Fuel</p>
          <p className="text-2xl font-bold text-blue-600">{analytics.totalFuel.toFixed(1)} L</p>
        </div>
        <div className="bg-green-50 p-4 rounded-xl">
          <p className="text-sm text-gray-600">Total Cost</p>
          <p className="text-2xl font-bold text-green-600">${analytics.totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl">
          <p className="text-sm text-gray-600">Total Distance</p>
          <p className="text-2xl font-bold text-purple-600">{analytics.totalDistance.toLocaleString()} km</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl">
          <p className="text-sm text-gray-600">Avg Efficiency</p>
          <p className="text-2xl font-bold text-orange-600">{analytics.avgEfficiency.toFixed(1)} km/L</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['records', 'analytics', 'trends', 'alerts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab} {tab === 'alerts' && alerts.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{alerts.length}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="border rounded-lg px-3 py-2">
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="quarter">Last 3 Months</option>
          <option value="year">Last Year</option>
          <option value="all">All Time</option>
        </select>
        
        <select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)} className="border rounded-lg px-3 py-2">
          <option value="">All Vehicles</option>
          {vehicles?.map(v => (
            <option key={v.id} value={v.id}>{v.registration_num}</option>
          ))}
        </select>
      </div>

      {/* Add Fuel Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg border border-blue-100">
          <h3 className="text-lg font-semibold mb-4">Add Fuel Record</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input type="date" value={formData.fuel_date} onChange={e => setFormData({...formData, fuel_date: e.target.value})} className="border p-2 rounded w-full" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle *</label>
              <select value={formData.vehicle_id} onChange={e => handleVehicleChange(e.target.value)} className="border p-2 rounded w-full" required>
                <option value="">Select Vehicle</option>
                {vehicles?.map(v => <option key={v?.id} value={v?.id}>{v?.registration_num} - {v?.make_model}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Past Mileage (km) *</label>
              <input type="number" value={formData.past_mileage} onChange={e => setFormData({...formData, past_mileage: e.target.value})} className="border p-2 rounded w-full" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Current Mileage (km) *</label>
              <input type="number" value={formData.current_mileage} onChange={e => setFormData({...formData, current_mileage: e.target.value})} className="border p-2 rounded w-full" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Quantity (Liters) *</label>
              <input type="number" step="0.01" value={formData.quantity_liters} onChange={e => setFormData({...formData, quantity_liters: e.target.value})} className="border p-2 rounded w-full" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Amount ($) *</label>
              <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="border p-2 rounded w-full" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Card Number</label>
              <input value={formData.card_num} onChange={e => setFormData({...formData, card_num: e.target.value})} className="border p-2 rounded w-full" placeholder="Fuel card number" />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Card Name</label>
              <input value={formData.card_name} onChange={e => setFormData({...formData, card_name: e.target.value})} className="border p-2 rounded w-full" placeholder="Card holder name" />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Station/Place</label>
              <input value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} className="border p-2 rounded w-full" placeholder="e.g., Shell Ngong Road" />
            </div>
          </div>

          {/* Calculations Preview */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium">Calculated Metrics:</p>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div>
                <p className="text-xs text-gray-500">Distance</p>
                <p className="font-semibold">{calculatedDistance} km</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Efficiency</p>
                <p className={`font-semibold ${calculatedEfficiency > 0 && calculatedEfficiency < 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {calculatedEfficiency.toFixed(2)} km/L
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cost/km</p>
                <p className="font-semibold">${calculatedCostPerKm.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save Record</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
          </div>
        </form>
      )}

      {/* Records Tab */}
      {activeTab === 'records' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Vehicle</th>
                  <th className="text-left p-4">Distance</th>
                  <th className="text-left p-4">Liters</th>
                  <th className="text-left p-4">KM/L</th>
                  <th className="text-left p-4">Amount</th>
                  <th className="text-left p-4">Cost/km</th>
                  <th className="text-left p-4">Place</th>
                </tr>
              </thead>
              <tbody>
                {!filteredRecords || filteredRecords?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">No fuel records found</td>
                  </tr>
                ) : (
                  filteredRecords?.map(r => (
                    <tr key={r?.id || Math.random()} className="border-b hover:bg-gray-50">
                      <td className="p-4">{r?.fuel_date}</td>
                      <td className="p-4 font-medium">{r?.registration_num || '-'}</td>
                      <td className="p-4">{r?.distance_km?.toLocaleString() || '-'} km</td>
                      <td className="p-4">{r?.quantity_liters || '-'}</td>
                      <td className="p-4">
                        <span className={`${(r?.km_per_liter || 0) < 5 ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                          {r?.km_per_liter ? Number(r.km_per_liter).toFixed(2) : '-'}
                        </span>
                      </td>
                      <td className="p-4">${r?.amount ? Number(r.amount).toFixed(2) : '-'}</td>
                      <td className="p-4">{r?.cost_per_km ? Number(r.cost_per_km).toFixed(2) : '-'}</td>
                      <td className="p-4">{r?.place || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">Fuel Consumption by Vehicle</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehicleEfficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vehicle" angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: 'km/L', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Bar dataKey="avgEfficiency" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">Cost Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vehicleEfficiencyData.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="totalLiters"
                    nameKey="vehicle"
                  >
                    {vehicleEfficiencyData.slice(0, 5).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-4">Fuel Trends Over Time</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" label={{ value: 'Liters', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Cost ($)', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="liters" stroke="#0088FE" fill="#0088FE" fillOpacity={0.3} name="Fuel (L)" />
                <Area yAxisId="right" type="monotone" dataKey="cost" stroke="#00C49F" fill="#00C49F" fillOpacity={0.3} name="Cost ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-green-50 text-green-700 p-6 rounded-xl text-center">
              <p className="text-lg">✅ No alerts at this time</p>
              <p className="text-sm">All vehicles are operating within normal efficiency ranges</p>
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className={`p-4 rounded-xl ${alert.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{alert.type === 'low_efficiency' ? '⛽' : '⚠️'}</span>
                  <div>
                    <p className="font-semibold">{alert.vehicle}</p>
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">Detected: {new Date(alert.date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
