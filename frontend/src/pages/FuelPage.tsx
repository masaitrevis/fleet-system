import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

interface FuelPageProps {
  apiUrl: string;
}

interface FuelRecord {
  id: string;
  fuel_date: string;
  registration_num: string;
  vehicle_id: string;
  card_num?: string;
  card_name?: string;
  past_mileage: number;
  current_mileage: number;
  distance_km: number;
  quantity_liters: number;
  km_per_liter: number;
  amount: number;
  cost_per_km?: number;
  place?: string;
  created_at: string;
}

interface FuelCard {
  id: string;
  card_num: string;
  card_name: string;
  assigned_vehicle_id?: string;
  registration_num?: string;
  monthly_limit?: number;
  current_month_usage: number;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
}

interface Vehicle {
  id: string;
  registration_num: string;
  make_model?: string;
  current_mileage: number;
  target_consumption_rate?: number;
}

interface EfficiencyData {
  registration_num: string;
  avg_km_per_liter: number;
  target_rate: number;
  total_distance: number;
  total_fuel: number;
  variance: number;
}

interface CostAnalytics {
  period: string;
  total_cost: number;
  total_liters: number;
  avg_cost_per_liter: number;
  transaction_count: number;
}

const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];

export default function FuelPage({ apiUrl }: FuelPageProps) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'cards' | 'efficiency' | 'analytics'>('transactions');
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [fuelCards, setFuelCards] = useState<FuelCard[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<EfficiencyData[]>([]);
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Form states
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
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
  const [cardForm, setCardForm] = useState({
    card_num: '',
    card_name: '',
    assigned_vehicle_id: '',
    monthly_limit: ''
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    // Set default date range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  }, []);

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
        fetchRecords(),
        fetchFuelCards(),
        fetchVehicles(),
        fetchEfficiencyData(),
        fetchCostAnalytics()
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to load fuel data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    const res = await fetch(`${apiUrl}/fuel`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch fuel records');
    const data = await res.json();
    setRecords(Array.isArray(data) ? data : []);
  };

  const fetchFuelCards = async () => {
    const res = await fetch(`${apiUrl}/fuel/cards`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      // Cards endpoint might not exist yet
      setFuelCards([]);
      return;
    }
    const data = await res.json();
    setFuelCards(Array.isArray(data) ? data : []);
  };

  const fetchVehicles = async () => {
    const res = await fetch(`${apiUrl}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch vehicles');
    const data = await res.json();
    setVehicles(Array.isArray(data) ? data : []);
  };

  const fetchEfficiencyData = async () => {
    const res = await fetch(`${apiUrl}/fuel/efficiency`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      setEfficiencyData([]);
      return;
    }
    const data = await res.json();
    setEfficiencyData(Array.isArray(data) ? data : []);
  };

  const fetchCostAnalytics = async () => {
    const res = await fetch(`${apiUrl}/fuel/analytics?start=${dateRange.start}&end=${dateRange.end}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      setCostAnalytics([]);
      return;
    }
    const data = await res.json();
    setCostAnalytics(Array.isArray(data) ? data : []);
  };

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    setTransactionForm(prev => ({
      ...prev,
      vehicle_id: vehicleId,
      past_mileage: vehicle?.current_mileage?.toString() || ''
    }));
  };

  const submitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/fuel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fuel_date: transactionForm.fuel_date,
          vehicle_id: transactionForm.vehicle_id,
          card_num: transactionForm.card_num,
          card_name: transactionForm.card_name,
          past_mileage: parseInt(transactionForm.past_mileage) || 0,
          current_mileage: parseInt(transactionForm.current_mileage) || 0,
          quantity_liters: parseFloat(transactionForm.quantity_liters) || 0,
          amount: parseFloat(transactionForm.amount) || 0,
          place: transactionForm.place
        })
      });
      
      if (!res.ok) throw new Error('Failed to save transaction');
      
      setShowTransactionForm(false);
      setTransactionForm({
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
      fetchAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const submitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/fuel/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          card_num: cardForm.card_num,
          card_name: cardForm.card_name,
          assigned_vehicle_id: cardForm.assigned_vehicle_id || null,
          monthly_limit: parseFloat(cardForm.monthly_limit) || null
        })
      });
      
      if (!res.ok) throw new Error('Failed to create fuel card');
      
      setShowCardForm(false);
      setCardForm({ card_num: '', card_name: '', assigned_vehicle_id: '', monthly_limit: '' });
      fetchFuelCards();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleCardStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`${apiUrl}/fuel/cards/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchFuelCards();
    } catch (err) {
      console.error('Failed to update card status:', err);
    }
  };

  // Computed statistics
  const stats = useMemo(() => {
    const totalCost = records.reduce((sum, r) => sum + (parseFloat(r.amount as any) || 0), 0);
    const totalLiters = records.reduce((sum, r) => sum + (parseFloat(r.quantity_liters as any) || 0), 0);
    const totalDistance = records.reduce((sum, r) => sum + (parseFloat(r.distance_km as any) || 0), 0);
    const avgEfficiency = totalLiters > 0 ? totalDistance / totalLiters : 0;
    const avgCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
    
    return { totalCost, totalLiters, totalDistance, avgEfficiency, avgCostPerLiter };
  }, [records]);

  // Chart data preparation
  const fuelByVehicle = useMemo(() => {
    const grouped = records.reduce((acc, r) => {
      const key = r.registration_num || 'Unknown';
      if (!acc[key]) acc[key] = { name: key, fuel: 0, cost: 0, distance: 0 };
      acc[key].fuel += parseFloat(r.quantity_liters as any) || 0;
      acc[key].cost += parseFloat(r.amount as any) || 0;
      acc[key].distance += parseFloat(r.distance_km as any) || 0;
      return acc;
    }, {} as Record<string, { name: string; fuel: number; cost: number; distance: number }>);
    return Object.values(grouped).sort((a, b) => b.fuel - a.fuel).slice(0, 10);
  }, [records]);

  const fuelTrend = useMemo(() => {
    const grouped = records.reduce((acc, r) => {
      const date = r.fuel_date?.substring(0, 7) || 'Unknown'; // YYYY-MM
      if (!acc[date]) acc[date] = { period: date, liters: 0, cost: 0, count: 0 };
      acc[date].liters += parseFloat(r.quantity_liters as any) || 0;
      acc[date].cost += parseFloat(r.amount as any) || 0;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { period: string; liters: number; cost: number; count: number }>);
    return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period)).slice(-12);
  }, [records]);

  const efficiencyChartData = useMemo(() => {
    return efficiencyData.map(d => ({
      name: d.registration_num,
      actual: parseFloat(d.avg_km_per_liter as any) || 0,
      target: parseFloat(d.target_rate as any) || 0,
      variance: parseFloat(d.variance as any) || 0
    })).slice(0, 10);
  }, [efficiencyData]);

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        <span className="ml-3 text-slate-600">Loading fuel management...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">⛽ Fuel Management</h1>
          <p className="text-slate-500 text-sm mt-1">Track fuel consumption, manage cards, and analyze costs</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <div className="text-amber-100 text-sm">Total Cost</div>
          <div className="text-2xl font-bold">${stats.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="text-blue-100 text-sm">Total Liters</div>
          <div className="text-2xl font-bold">{stats.totalLiters.toLocaleString(undefined, { maximumFractionDigits: 0 })} L</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="text-green-100 text-sm">Distance</div>
          <div className="text-2xl font-bold">{stats.totalDistance.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="text-purple-100 text-sm">Avg Efficiency</div>
          <div className="text-2xl font-bold">{stats.avgEfficiency.toFixed(1)} km/L</div>
        </div>
        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-4 text-white">
          <div className="text-slate-100 text-sm">Cost/Liter</div>
          <div className="text-2xl font-bold">${stats.avgCostPerLiter.toFixed(2)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {[
              { key: 'transactions', label: 'Transactions', icon: '📝' },
              { key: 'cards', label: 'Fuel Cards', icon: '💳' },
              { key: 'efficiency', label: 'Efficiency', icon: '📊' },
              { key: 'analytics', label: 'Analytics', icon: '📈' }
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
          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800">Fuel Transactions</h2>
                <button
                  onClick={() => setShowTransactionForm(!showTransactionForm)}
                  className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600"
                >
                  {showTransactionForm ? 'Cancel' : '+ Add Transaction'}
                </button>
              </div>

              {showTransactionForm && (
                <form onSubmit={submitTransaction} className="bg-slate-50 p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                      <input
                        type="date"
                        value={transactionForm.fuel_date}
                        onChange={e => setTransactionForm({...transactionForm, fuel_date: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle *</label>
                      <select
                        value={transactionForm.vehicle_id}
                        onChange={e => handleVehicleChange(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        required
                      >
                        <option value="">Select Vehicle</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.registration_num}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Card Number</label>
                      <input
                        type="text"
                        value={transactionForm.card_num}
                        onChange={e => setTransactionForm({...transactionForm, card_num: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        placeholder="Fuel card number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Past Mileage *</label>
                      <input
                        type="number"
                        value={transactionForm.past_mileage}
                        onChange={e => setTransactionForm({...transactionForm, past_mileage: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Current Mileage *</label>
                      <input
                        type="number"
                        value={transactionForm.current_mileage}
                        onChange={e => setTransactionForm({...transactionForm, current_mileage: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Liters *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={transactionForm.quantity_liters}
                        onChange={e => setTransactionForm({...transactionForm, quantity_liters: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={transactionForm.amount}
                        onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Station/Place</label>
                      <input
                        type="text"
                        value={transactionForm.place}
                        onChange={e => setTransactionForm({...transactionForm, place: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        placeholder="Fuel station"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                      Save Transaction
                    </button>
                    <button type="button" onClick={() => setShowTransactionForm(false)} className="bg-slate-300 px-4 py-2 rounded-lg hover:bg-slate-400">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Vehicle</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Distance</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Liters</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">KM/L</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Amount</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Place</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No fuel transactions found
                        </td>
                      </tr>
                    ) : (
                      records.slice(0, 50).map(r => (
                        <tr key={r.id} className="border-t hover:bg-slate-50">
                          <td className="p-3">{r.fuel_date}</td>
                          <td className="p-3 font-medium">{r.registration_num}</td>
                          <td className="p-3">{r.distance_km?.toLocaleString()} km</td>
                          <td className="p-3">{r.quantity_liters}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              r.km_per_liter >= 8 ? 'bg-green-100 text-green-800' :
                              r.km_per_liter >= 5 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {r.km_per_liter?.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-3">${parseFloat(r.amount as any).toFixed(2)}</td>
                          <td className="p-3 text-slate-500">{r.place || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fuel Cards Tab */}
          {activeTab === 'cards' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800">Fuel Cards</h2>
                <button
                  onClick={() => setShowCardForm(!showCardForm)}
                  className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600"
                >
                  {showCardForm ? 'Cancel' : '+ Add Card'}
                </button>
              </div>

              {showCardForm && (
                <form onSubmit={submitCard} className="bg-slate-50 p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Card Number *</label>
                      <input
                        type="text"
                        value={cardForm.card_num}
                        onChange={e => setCardForm({...cardForm, card_num: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Card Name</label>
                      <input
                        type="text"
                        value={cardForm.card_name}
                        onChange={e => setCardForm({...cardForm, card_name: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        placeholder="e.g., Shell Fleet Card"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Vehicle</label>
                      <select
                        value={cardForm.assigned_vehicle_id}
                        onChange={e => setCardForm({...cardForm, assigned_vehicle_id: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      >
                        <option value="">Unassigned</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.registration_num}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Limit ($)</label>
                      <input
                        type="number"
                        value={cardForm.monthly_limit}
                        onChange={e => setCardForm({...cardForm, monthly_limit: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                      Save Card
                    </button>
                    <button type="button" onClick={() => setShowCardForm(false)} className="bg-slate-300 px-4 py-2 rounded-lg hover:bg-slate-400">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {fuelCards.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                  <div className="text-4xl mb-2">💳</div>
                  <p>No fuel cards configured yet.</p>
                  <p className="text-sm">Add a fuel card to track usage by card.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fuelCards.map(card => (
                    <div key={card.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-800">{card.card_name || card.card_num}</h3>
                          <p className="text-sm text-slate-500">{card.card_num}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          card.status === 'active' ? 'bg-green-100 text-green-800' :
                          card.status === 'blocked' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {card.status}
                        </span>
                      </div>
                      {card.assigned_vehicle_id && (
                        <p className="text-sm text-slate-600 mb-2">
                          Assigned: {card.registration_num || card.assigned_vehicle_id}
                        </p>
                      )}
                      {card.monthly_limit && (
                        <div className="mb-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-500">Monthly Usage</span>
                            <span className="font-medium">${card.current_month_usage?.toFixed(2)} / ${card.monthly_limit}</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-amber-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, ((card.current_month_usage || 0) / card.monthly_limit) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => toggleCardStatus(card.id, card.status)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {card.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Efficiency Tab */}
          {activeTab === 'efficiency' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-800">Fuel Efficiency Analysis</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Efficiency vs Target</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={efficiencyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="actual" name="Actual KM/L" fill="#F59E0B" />
                      <Bar dataKey="target" name="Target KM/L" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Efficiency Variance</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={efficiencyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="variance" name="Variance %" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Vehicle</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Avg KM/L</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Target</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Variance</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Total Distance</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Total Fuel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {efficiencyData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No efficiency data available
                        </td>
                      </tr>
                    ) : (
                      efficiencyData.map(d => (
                        <tr key={d.registration_num} className="border-t hover:bg-slate-50">
                          <td className="p-3 font-medium">{d.registration_num}</td>
                          <td className="p-3">{parseFloat(d.avg_km_per_liter as any)?.toFixed(2)}</td>
                          <td className="p-3">{d.target_rate}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              d.variance >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {d.variance > 0 ? '+' : ''}{d.variance?.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3">{d.total_distance?.toLocaleString()} km</td>
                          <td className="p-3">{d.total_fuel?.toFixed(1)} L</td>
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
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800">Cost Analytics</h2>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={e => setDateRange({...dateRange, start: e.target.value})}
                    className="border border-slate-300 rounded-lg px-3 py-2"
                  />
                  <span className="self-center">to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={e => setDateRange({...dateRange, end: e.target.value})}
                    className="border border-slate-300 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={fetchCostAnalytics}
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Fuel Cost Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={fuelTrend}>
                      <defs>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="cost" stroke="#F59E0B" fillOpacity={1} fill="url(#colorCost)" name="Cost ($)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Fuel Volume Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={fuelTrend}>
                      <defs>
                        <linearGradient id="colorLiters" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="liters" stroke="#3B82F6" fillOpacity={1} fill="url(#colorLiters)" name="Liters" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Top Consumers (Fuel)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={fuelByVehicle}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="fuel"
                      >
                        {fuelByVehicle.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-4">Top Consumers (Cost)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={fuelByVehicle}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="cost" fill="#EF4444" name="Cost ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
