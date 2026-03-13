import { useState, useEffect } from 'react';

interface RoutesProps {
  apiUrl: string;
}

interface Route {
  id: string;
  route_date: string;
  route_name: string;
  registration_num: string;
  driver1_name: string;
  actual_km: number;
  actual_fuel: number;
  actual_consumption_rate: number;
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

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchRoutes();
    fetchVehicles();
    fetchDrivers();
  }, [apiUrl]);

  const fetchRoutes = () => {
    fetch(`${apiUrl}/routes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setRoutes(data);
        setLoading(false);
      });
  };

  const fetchVehicles = () => {
    fetch(`${apiUrl}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setVehicles(data.filter((v: any) => v.status === 'Active')));
  };

  const fetchDrivers = () => {
    fetch(`${apiUrl}/staff/drivers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setDrivers(data));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${apiUrl}/routes`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...formData,
        target_km: parseFloat(formData.target_km),
        actual_km: parseFloat(formData.actual_km),
        target_fuel_consumption: parseFloat(formData.target_fuel_consumption),
        actual_fuel: parseFloat(formData.actual_fuel)
      })
    });
    setShowForm(false);
    fetchRoutes();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Route Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Log Route
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="date" value={formData.route_date} onChange={e => setFormData({...formData, route_date: e.target.value})} className="border p-2 rounded" required />
            <input placeholder="Route Name" value={formData.route_name} onChange={e => setFormData({...formData, route_name: e.target.value})} className="border p-2 rounded" required />
            <select value={formData.vehicle_id} onChange={e => setFormData({...formData, vehicle_id: e.target.value})} className="border p-2 rounded" required>
              <option value="">Select Vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_num}</option>)}
            </select>
            
            <select value={formData.driver1_id} onChange={e => setFormData({...formData, driver1_id: e.target.value})} className="border p-2 rounded">
              <option value="">Select Driver</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.staff_name}</option>)}
            </select>
            
            <input placeholder="Target KM" type="number" value={formData.target_km} onChange={e => setFormData({...formData, target_km: e.target.value})} className="border p-2 rounded" />
            <input placeholder="Actual KM" type="number" value={formData.actual_km} onChange={e => setFormData({...formData, actual_km: e.target.value})} className="border p-2 rounded" required />
            
            <input placeholder="Target Fuel (L)" type="number" value={formData.target_fuel_consumption} onChange={e => setFormData({...formData, target_fuel_consumption: e.target.value})} className="border p-2 rounded" />
            
            <input placeholder="Actual Fuel (L)" type="number" value={formData.actual_fuel} onChange={e => setFormData({...formData, actual_fuel: e.target.value})} className="border p-2 rounded" required />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
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
            {routes.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-4">{r.route_date}</td>
                <td className="p-4 font-medium">{r.route_name}</td>
                <td className="p-4">{r.registration_num}</td>
                <td className="p-4">{r.driver1_name || '-'}</td>
                <td className="p-4">{r.actual_km}</td>
                <td className="p-4">{r.actual_fuel}</td>
                <td className="p-4">{r.actual_consumption_rate?.toFixed(2) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}