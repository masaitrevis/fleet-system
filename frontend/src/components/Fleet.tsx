import { useState, useEffect } from 'react';

interface FleetProps {
  apiUrl: string;
}

interface Vehicle {
  id: string;
  registration_num: string;
  make_model: string;
  year_of_manufacture: number;
  ownership: string;
  department: string;
  status: string;
  current_mileage: number;
  target_consumption_rate: number;
}

export default function Fleet({ apiUrl }: FleetProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    registration_num: '',
    make_model: '',
    year_of_manufacture: '',
    ownership: 'Company',
    department: '',
    target_consumption_rate: '8.0'
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchVehicles();
  }, [apiUrl]);

  const fetchVehicles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Fleet fetch error:', errData);
        throw new Error(errData.message || errData.error || `Failed to fetch vehicles (${res.status})`);
      }
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Fleet fetch error:', err);
      setError(err.message || 'Failed to load vehicles');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch(`${apiUrl}/vehicles`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          registration_num: formData.registration_num,
          make_model: formData.make_model,
          year_of_manufacture: parseInt(formData.year_of_manufacture) || new Date().getFullYear(),
          ownership: formData.ownership,
          department: formData.department,
          target_consumption_rate: parseFloat(formData.target_consumption_rate) || 8.0
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to add vehicle');
      }
      
      setShowForm(false);
      setFormData({
        registration_num: '',
        make_model: '',
        year_of_manufacture: '',
        ownership: 'Company',
        department: '',
        target_consumption_rate: '8.0'
      });
      fetchVehicles();
    } catch (err: any) {
      console.error('Vehicle submit error:', err);
      setError(err.message || 'Failed to add vehicle');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Under Maintenance': return 'bg-orange-100 text-orange-800';
      case 'Retired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading fleet...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Fleet Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Vehicle'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              placeholder="Registration Number *"
              value={formData.registration_num}
              onChange={e => setFormData({...formData, registration_num: e.target.value})}
              className="border p-2 rounded"
              required
            />
            <input
              placeholder="Make/Model"
              value={formData.make_model}
              onChange={e => setFormData({...formData, make_model: e.target.value})}
              className="border p-2 rounded"
            />
            <input
              placeholder="Year"
              type="number"
              value={formData.year_of_manufacture}
              onChange={e => setFormData({...formData, year_of_manufacture: e.target.value})}
              className="border p-2 rounded"
            />
            <select
              value={formData.ownership}
              onChange={e => setFormData({...formData, ownership: e.target.value})}
              className="border p-2 rounded"
            >
              <option>Company</option>
              <option>Leased</option>
              <option>Hired</option>
            </select>
            <input
              placeholder="Department"
              value={formData.department}
              onChange={e => setFormData({...formData, department: e.target.value})}
              className="border p-2 rounded"
            />
            <input
              placeholder="Target KM/L"
              type="number"
              step="0.1"
              value={formData.target_consumption_rate}
              onChange={e => setFormData({...formData, target_consumption_rate: e.target.value})}
              className="border p-2 rounded"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
          </div>
        </form>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">Registration</th>
                <th className="text-left p-4">Make/Model</th>
                <th className="text-left p-4">Year</th>
                <th className="text-left p-4">Department</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Mileage</th>
                <th className="text-left p-4">Target KM/L</th>
              </tr>
            </thead>
            <tbody>
              {vehicles?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">No vehicles found</td>
                </tr>
              ) : (
                vehicles?.map(v => (
                  <tr key={v.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{v.registration_num || '-'}</td>
                    <td className="p-4">{v.make_model || '-'}</td>
                    <td className="p-4">{v.year_of_manufacture || '-'}</td>
                    <td className="p-4">{v.department || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-sm ${getStatusColor(v.status)}`}>
                        {v.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4">{v.current_mileage ? v.current_mileage.toLocaleString() + ' km' : '-'}</td>
                    <td className="p-4">{v.target_consumption_rate || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {vehicles?.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-white rounded-xl">No vehicles found</div>
        ) : (
          vehicles?.map(v => (
            <div key={v.id} className="bg-white rounded-xl shadow p-4 space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-medium text-lg">{v.registration_num || '-'}</span>
                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(v.status)}`}>
                  {v.status || 'Unknown'}
                </span>
              </div>
              <div className="text-sm text-gray-600">{v.make_model || '-'} • {v.year_of_manufacture || '-'}</div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dept: {v.department || '-'}</span>
                <span className="text-gray-500">{v.current_mileage ? v.current_mileage.toLocaleString() + ' km' : '-'}</span>
              </div>
              <div className="text-sm text-gray-500">Target: {v.target_consumption_rate || '-'} km/L</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
