import { useState, useEffect } from 'react';

interface RepairsProps {
  apiUrl: string;
}

interface Repair {
  id: string;
  date_in: string;
  registration_num: string;
  breakdown_description: string;
  odometer_reading: number;
  assigned_technician: string;
  garage_name: string;
  cost: number;
  status: string;
}

interface Vehicle {
  id: string;
  registration_num: string;
}

export default function Repairs({ apiUrl }: RepairsProps) {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date_in: new Date().toISOString().split('T')[0],
    vehicle_id: '',
    preventative_maintenance: '',
    breakdown_description: '',
    odometer_reading: '',
    assigned_technician: '',
    target_repair_hours: '',
    garage_name: '',
    cost: ''
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchRepairs();
    fetchVehicles();
  }, [apiUrl]);

  const fetchRepairs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/repairs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch repairs');
      const data = await res.json();
      setRepairs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Repairs fetch error:', err);
      setError(err.message || 'Failed to load repairs');
      setRepairs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await fetch(`${apiUrl}/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Vehicles fetch error:', err);
      setVehicles([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch(`${apiUrl}/repairs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          odometer_reading: parseInt(formData.odometer_reading) || 0,
          target_repair_hours: parseFloat(formData.target_repair_hours) || 0,
          cost: parseFloat(formData.cost) || 0
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save repair');
      }
      
      setShowForm(false);
      setFormData({
        date_in: new Date().toISOString().split('T')[0],
        vehicle_id: '',
        preventative_maintenance: '',
        breakdown_description: '',
        odometer_reading: '',
        assigned_technician: '',
        target_repair_hours: '',
        garage_name: '',
        cost: ''
      });
      fetchRepairs();
    } catch (err: any) {
      console.error('Repair submit error:', err);
      setError(err.message || 'Failed to save repair');
    }
  };

  const completeRepair = async (id: string) => {
    const hours = prompt('Enter actual repair hours:');
    if (!hours) return;
    
    try {
      const res = await fetch(`${apiUrl}/repairs/${id}/complete`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date_out: new Date().toISOString().split('T')[0],
          repairs_end_time: new Date().toISOString(),
          actual_repair_hours: parseFloat(hours) || 0
        })
      });
      
      if (!res.ok) throw new Error('Failed to complete repair');
      fetchRepairs();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading && repairs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading repairs...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Repairs & Maintenance</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ New Repair'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="date" value={formData.date_in} onChange={e => setFormData({...formData, date_in: e.target.value})} className="border p-2 rounded" required />
            
            <select value={formData.vehicle_id} onChange={e => setFormData({...formData, vehicle_id: e.target.value})} className="border p-2 rounded" required>
              <option value="">Select Vehicle</option>
              {vehicles?.map(v => <option key={v.id} value={v.id}>{v.registration_num}</option>)}
            </select>
            
            <input placeholder="Odometer Reading" type="number" value={formData.odometer_reading} onChange={e => setFormData({...formData, odometer_reading: e.target.value})} className="border p-2 rounded" required />
            
            <input placeholder="Technician" value={formData.assigned_technician} onChange={e => setFormData({...formData, assigned_technician: e.target.value})} className="border p-2 rounded" />
            
            <input placeholder="Garage Name" value={formData.garage_name} onChange={e => setFormData({...formData, garage_name: e.target.value})} className="border p-2 rounded" />
            
            <input placeholder="Target Hours" type="number" step="0.5" value={formData.target_repair_hours} onChange={e => setFormData({...formData, target_repair_hours: e.target.value})} className="border p-2 rounded" />
            
            <input placeholder="Cost ($)" type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="border p-2 rounded" />
          </div>
          
          <textarea 
            placeholder="Preventative Maintenance Description" 
            value={formData.preventative_maintenance} 
            onChange={e => setFormData({...formData, preventative_maintenance: e.target.value})} 
            className="border p-2 rounded w-full mt-4" 
            rows={2}
          />
          
          <textarea 
            placeholder="Breakdown/Repairs Description" 
            value={formData.breakdown_description} 
            onChange={e => setFormData({...formData, breakdown_description: e.target.value})} 
            className="border p-2 rounded w-full mt-4" 
            rows={2}
          />
          
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
              <th className="text-left p-4">Date In</th>
              <th className="text-left p-4">Vehicle</th>
              <th className="text-left p-4">Issue</th>
              <th className="text-left p-4">Odometer</th>
              <th className="text-left p-4">Technician</th>
              <th className="text-left p-4">Cost</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {repairs?.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">No repair records found</td>
              </tr>
            ) : (
              repairs?.map(r => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">{r.date_in || '-'}</td>
                  <td className="p-4 font-medium">{r.registration_num || '-'}</td>
                  <td className="p-4 max-w-xs truncate">{r.breakdown_description || 'Preventative Maintenance'}</td>
                  <td className="p-4">{r.odometer_reading?.toLocaleString() || '-'}</td>
                  <td className="p-4">{r.assigned_technician || '-'}</td>
                  <td className="p-4">${r.cost ? r.cost.toFixed(2) : '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-sm ${getStatusColor(r.status)}`}>
                      {r.status || 'Pending'}
                    </span>
                  </td>
                  <td className="p-4">
                    {r.status !== 'Completed' && (
                      <button 
                        onClick={() => completeRepair(r.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
