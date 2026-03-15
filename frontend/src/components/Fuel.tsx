import { useState, useEffect } from 'react';

interface FuelProps {
  apiUrl: string;
}

interface FuelRecord {
  id: string;
  fuel_date: string;
  registration_num: string;
  past_mileage: number;
  current_mileage: number;
  distance_km: number;
  quantity_liters: number;
  km_per_liter: number;
  amount: number;
  place: string;
}

interface Vehicle {
  id: string;
  registration_num: string;
  current_mileage: number;
}

export default function Fuel({ apiUrl }: FuelProps) {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (apiUrl && token) {
      fetchRecords();
      fetchVehicles();
    } else {
      setLoading(false);
      if (!token) {
        setError('Authentication required. Please login.');
      }
    }
  }, [apiUrl]);

  const fetchRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        throw new Error('No authentication token');
      }
      
      const res = await fetch(`${apiUrl}/fuel`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      
      if (res.status === 401 || res.status === 403) {
        throw new Error('Session expired. Please logout and login again.');
      }
      
      if (!res.ok) {
        throw new Error(`Failed to fetch fuel records: ${res.status}`);
      }
      
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Fuel fetch error:', err);
      setError(err.message || 'Failed to load fuel records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) return;
      
      const res = await fetch(`${apiUrl}/vehicles`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      
      if (!res.ok) {
        console.error('Vehicles fetch failed:', res.status);
        setVehicles([]);
        return;
      }
      
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Vehicles fetch error:', err);
      setVehicles([]);
    }
  };

  const handleVehicleChange = (vehicleId: string) => {
    if (!vehicleId) {
      setFormData(prev => ({
        ...prev,
        vehicle_id: '',
        past_mileage: ''
      }));
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
      fetchRecords();
      fetchVehicles();
    } catch (err: any) {
      console.error('Fuel submit error:', err);
      setError(err.message || 'Failed to save fuel record');
    }
  };

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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Fuel Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Fuel Record'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
          <p>{error}</p>
          {(error.includes('expired') || error.includes('token') || error.includes('Authentication')) && (
            <button
              onClick={handleReLogin}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              🔑 Click to Re-Login
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input 
                type="date" 
                value={formData.fuel_date} 
                onChange={e => setFormData({...formData, fuel_date: e.target.value})} 
                className="border p-2 rounded w-full" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle *</label>
              <select 
                value={formData.vehicle_id} 
                onChange={e => handleVehicleChange(e.target.value)} 
                className="border p-2 rounded w-full" 
                required
              >
                <option value="">Select Vehicle</option>
                {vehicles?.map(v => (
                  <option key={v?.id || 'unknown'} value={v?.id || ''}>{v?.registration_num || 'Unknown'}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Card Number</label>
              <input 
                placeholder="Card Number" 
                value={formData.card_num} 
                onChange={e => setFormData({...formData, card_num: e.target.value})} 
                className="border p-2 rounded w-full" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Card Name</label>
              <input 
                placeholder="Card Name" 
                value={formData.card_name} 
                onChange={e => setFormData({...formData, card_name: e.target.value})} 
                className="border p-2 rounded w-full" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Past Mileage *</label>
              <input 
                placeholder="Past Mileage" 
                type="number" 
                value={formData.past_mileage} 
                onChange={e => setFormData({...formData, past_mileage: e.target.value})} 
                className="border p-2 rounded w-full" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Current Mileage *</label>
              <input 
                placeholder="Current Mileage" 
                type="number" 
                value={formData.current_mileage} 
                onChange={e => setFormData({...formData, current_mileage: e.target.value})} 
                className="border p-2 rounded w-full" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Quantity (Liters) *</label>
              <input 
                placeholder="Quantity (Liters)" 
                type="number" 
                step="0.01" 
                value={formData.quantity_liters} 
                onChange={e => setFormData({...formData, quantity_liters: e.target.value})} 
                className="border p-2 rounded w-full" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Amount ($) *</label>
              <input 
                placeholder="Amount ($)" 
                type="number" 
                step="0.01" 
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})} 
                className="border p-2 rounded w-full" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Station/Place</label>
              <input 
                placeholder="Station/Place" 
                value={formData.place} 
                onChange={e => setFormData({...formData, place: e.target.value})} 
                className="border p-2 rounded w-full" 
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Vehicle</th>
              <th className="text-left p-4">Distance (km)</th>
              <th className="text-left p-4">Liters</th>
              <th className="text-left p-4">KM/L</th>
              <th className="text-left p-4">Amount</th>
              <th className="text-left p-4">Place</th>
            </tr>
          </thead>
          <tbody>
            {!records || records?.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No fuel records found
                </td>
              </tr>
            ) : (
              records?.map(r => (
                <tr key={r?.id || Math.random()} className="border-b hover:bg-gray-50">
                  <td className="p-4">{r?.fuel_date || '-'}</td>
                  <td className="p-4 font-medium">{r?.registration_num || '-'}</td>
                  <td className="p-4">{r?.distance_km?.toLocaleString() || '-'}</td>
                  <td className="p-4">{r?.quantity_liters || '-'}</td>
                  <td className="p-4">{r?.km_per_liter ? Number(r.km_per_liter).toFixed(2) : '-'}</td>
                  <td className="p-4">${r?.amount ? Number(r.amount).toFixed(2) : '-'}</td>
                  <td className="p-4">{r?.place || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
