import { useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface RoutesProps {
  apiUrl: string;
}

interface Route {
  id: string;
  route_date: string;
  route_name: string;
  registration_num?: string;
  driver1_name?: string;
  actual_km?: number;
  actual_fuel?: number;
  actual_consumption_rate?: number;
}

interface Vehicle {
  id: string;
  registration_num: string;
}

interface Driver {
  id: string;
  staff_name: string;
}

export default function Routes({ apiUrl }: RoutesProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    route_date: new Date().toISOString().split('T')[0],
    route_name: '',
    vehicle_id: '',
    driver1_id: '',
    target_km: '',
    actual_km: '',
    target_fuel_consumption: '',
    actual_fuel: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
  }, [apiUrl]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const [routesRes, vehiclesRes, driversRes] = await Promise.all([
        fetch(`${apiUrl}/routes`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        }).catch(() => ({ ok: false, json: async () => ({ error: 'Network error' }) })),
        fetch(`${apiUrl}/vehicles`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        }).catch(() => ({ ok: false, json: async () => ({ error: 'Network error' }) })),
        fetch(`${apiUrl}/staff/drivers`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        }).catch(() => ({ ok: false, json: async () => ({ error: 'Network error' }) }))
      ]);

      // Handle routes response
      if (routesRes.ok) {
        const routesData = await routesRes.json();
        setRoutes(Array.isArray(routesData) ? routesData : []);
      } else {
        const err = await routesRes.json().catch(() => ({}));
        console.error('Routes fetch error:', err);
        setRoutes([]);
      }

      // Handle vehicles response
      if (vehiclesRes.ok) {
        const vehiclesData = await vehiclesRes.json();
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData.filter((v: any) => v.status === 'Active') : []);
      } else {
        console.error('Vehicles fetch error');
        setVehicles([]);
      }

      // Handle drivers response
      if (driversRes.ok) {
        const driversData = await driversRes.json();
        setDrivers(Array.isArray(driversData) ? driversData : []);
      } else {
        console.error('Drivers fetch error');
        setDrivers([]);
      }
    } catch (err: any) {
      console.error('Routes error:', err);
      setError('Failed to load route data. Please try again.');
      setRoutes([]);
      setVehicles([]);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    
    try {
      const res = await fetch(`${apiUrl}/routes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          target_km: parseFloat(formData.target_km) || 0,
          actual_km: parseFloat(formData.actual_km) || 0,
          target_fuel_consumption: parseFloat(formData.target_fuel_consumption) || 0,
          actual_fuel: parseFloat(formData.actual_fuel) || 0
        })
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({
          route_date: new Date().toISOString().split('T')[0],
          route_name: '',
          vehicle_id: '',
          driver1_id: '',
          target_km: '',
          actual_km: '',
          target_fuel_consumption: '',
          actual_fuel: ''
        });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to save route' }));
        setError(err.error || 'Failed to save route');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setError('Network error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading routes...</div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Route Management</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {showForm ? 'Cancel' : '+ Log Route'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
            {error}
            <button 
              onClick={fetchData}
              className="ml-4 text-sm underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
            <h3 className="text-lg font-bold mb-4">Log New Route</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input 
                  type="date" 
                  value={formData.route_date} 
                  onChange={e => setFormData({...formData, route_date: e.target.value})} 
                  className="border p-2 rounded w-full" 
                  required 
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Route Name *</label>
                <input 
                  placeholder="e.g., Nairobi-Mombasa" 
                  value={formData.route_name} 
                  onChange={e => setFormData({...formData, route_name: e.target.value})} 
                  className="border p-2 rounded w-full" 
                  required 
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vehicle *</label>
                <select 
                  value={formData.vehicle_id} 
                  onChange={e => setFormData({...formData, vehicle_id: e.target.value})} 
                  className="border p-2 rounded w-full" 
                  required
                  disabled={submitting}
                >
                  <option value="">Select Vehicle</option>
                  {vehicles?.map(v => <option key={v.id} value={v.id}>{v.registration_num}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Driver</label>
                <select 
                  value={formData.driver1_id} 
                  onChange={e => setFormData({...formData, driver1_id: e.target.value})} 
                  className="border p-2 rounded w-full"
                  disabled={submitting}
                >
                  <option value="">Select Driver</option>
                  {drivers?.map(d => <option key={d.id} value={d.id}>{d.staff_name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Target KM</label>
                <input 
                  placeholder="e.g., 500" 
                  type="number" 
                  value={formData.target_km} 
                  onChange={e => setFormData({...formData, target_km: e.target.value})} 
                  className="border p-2 rounded w-full" 
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Actual KM *</label>
                <input 
                  placeholder="e.g., 520" 
                  type="number" 
                  value={formData.actual_km} 
                  onChange={e => setFormData({...formData, actual_km: e.target.value})} 
                  className="border p-2 rounded w-full" 
                  required 
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Target Fuel (L)</label>
                <input 
                  placeholder="e.g., 50" 
                  type="number" 
                  value={formData.target_fuel_consumption} 
                  onChange={e => setFormData({...formData, target_fuel_consumption: e.target.value})} 
                  className="border p-2 rounded w-full" 
                  disabled={submitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Actual Fuel (L) *</label>
                <input 
                  placeholder="e.g., 48" 
                  type="number" 
                  value={formData.actual_fuel} 
                  onChange={e => setFormData({...formData, actual_fuel: e.target.value})} 
                  className="border p-2 rounded w-full" 
                  required 
                  disabled={submitting}
                />
              </div>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button 
                type="submit" 
                disabled={submitting}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                disabled={submitting}
                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Route</th>
                <th className="text-left p-4">Vehicle</th>
                <th className="text-left p-4">Driver</th>
                <th className="text-left p-4">Distance (km)</th>
                <th className="text-left p-4">Fuel (L)</th>
                <th className="text-left p-4">KM/L</th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No routes found. Click "Log Route" to add one.
                  </td>
                </tr>
              ) : (
                routes.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">{r.route_date || '-'}</td>
                    <td className="p-4 font-medium">{r.route_name}</td>
                    <td className="p-4">{r.registration_num || 'N/A'}</td>
                    <td className="p-4">{r.driver1_name || '-'}</td>
                    <td className="p-4">{r.actual_km || '-'}</td>
                    <td className="p-4">{r.actual_fuel || '-'}</td>
                    <td className="p-4">{r.actual_consumption_rate ? Number(r.actual_consumption_rate).toFixed(2) : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ErrorBoundary>
  );
}