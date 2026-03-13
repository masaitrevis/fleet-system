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

  const fetchRepairs = () => {
    fetch(`${apiUrl}/repairs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setRepairs(data);
        setLoading(false);
      });
  };

  const fetchVehicles = () => {
    fetch(`${apiUrl}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setVehicles(data));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${apiUrl}/repairs`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...formData,
        odometer_reading: parseInt(formData.odometer_reading),
        target_repair_hours: parseFloat(formData.target_repair_hours),
        cost: parseFloat(formData.cost)
      })
    });
    setShowForm(false);
    fetchRepairs();
    fetchVehicles();
  };

  const completeRepair = async (id: string) => {
    const hours = prompt('Enter actual repair hours:');
    if (!hours) return;
    
    await fetch(`${apiUrl}/repairs/${id}/complete`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        date_out: new Date().toISOString().split('T')[0],
        repairs_end_time: new Date().toISOString(),
        actual_repair_hours: parseFloat(hours)
      })
    });
    fetchRepairs();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Repairs & Maintenance</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Repair
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="date" value={formData.date_in} onChange={e => setFormData({...formData, date_in: e.target.value})} className="border p-2 rounded" required />
            
            <select value={formData.vehicle_id} onChange={e => setFormData({...formData, vehicle_id: e.target.value})} className="border p-2 rounded" required>
              <option value="">Select Vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_num}</option>)}
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
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
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
            {repairs.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-4">{r.date_in}</td>
                <td className="p-4 font-medium">{r.registration_num}</td>
                <td className="p-4 max-w-xs truncate">{r.breakdown_description || 'Preventative Maintenance'}</td>
                <td className="p-4">{r.odometer_reading?.toLocaleString()}</td>
                <td className="p-4">{r.assigned_technician || '-'}</td>
                <td className="p-4">${r.cost?.toFixed(2)}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-sm ${getStatusColor(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-4">
                  {r.status !== 'Completed' && (
                    <button 
                      onClick={() => completeRepair(r.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}