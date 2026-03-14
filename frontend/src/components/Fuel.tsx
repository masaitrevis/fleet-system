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

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchRecords();
    fetchVehicles();
  }, [apiUrl]);

  const fetchRecords = () => {
    fetch(`${apiUrl}/fuel`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRecords(data);
        } else {
          console.error('Fuel data not an array:', data);
          setRecords([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch fuel records:', err);
        setRecords([]);
        setLoading(false);
      });
  };

  const fetchVehicles = () => {
    fetch(`${apiUrl}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setVehicles(data);
        } else {
          console.error('Vehicles data not an array:', data);
          setVehicles([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch vehicles:', err);
        setVehicles([]);
      });
  };

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    setFormData({
      ...formData,
      vehicle_id: vehicleId,
      past_mileage: vehicle?.current_mileage?.toString() || ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${apiUrl}/fuel`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...formData,
        past_mileage: parseInt(formData.past_mileage),
        current_mileage: parseInt(formData.current_mileage),
        quantity_liters: parseFloat(formData.quantity_liters),
        amount: parseFloat(formData.amount)
      })
    });
    setShowForm(false);
    fetchRecords();
    fetchVehicles();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Fuel Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Add Fuel Record
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="date" value={formData.fuel_date} onChange={e => setFormData({...formData, fuel_date: e.target.value})} className="border p-2 rounded" required />
            
            <select value={formData.vehicle_id} onChange={e => handleVehicleChange(e.target.value)} className="border p-2 rounded" required>
              <option value="">Select Vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_num}</option>)}
            </select>
            
            <input placeholder="Card Number" value={formData.card_num} onChange={e => setFormData({...formData, card_num: e.target.value})} className="border p-2 rounded" />
            
            <input placeholder="Card Name" value={formData.card_name} onChange={e => setFormData({...formData, card_name: e.target.value})} className="border p-2 rounded" />
            
            <input placeholder="Past Mileage" type="number" value={formData.past_mileage} onChange={e => setFormData({...formData, past_mileage: e.target.value})} className="border p-2 rounded" required />
            
            <input placeholder="Current Mileage" type="number" value={formData.current_mileage} onChange={e => setFormData({...formData, current_mileage: e.target.value})} className="border p-2 rounded" required />
            
            <input placeholder="Quantity (Liters)" type="number" step="0.01" value={formData.quantity_liters} onChange={e => setFormData({...formData, quantity_liters: e.target.value})} className="border p-2 rounded" required />
            
            <input placeholder="Amount ($)" type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="border p-2 rounded" required />
            
            <input placeholder="Station/Place" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} className="border p-2 rounded" />
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
              <th className="text-left p-4">Vehicle</th>
              <th className="text-left p-4">Distance (km)</th>
              <th className="text-left p-4">Liters</th>
              <th className="text-left p-4">KM/L</th>
              <th className="text-left p-4">Amount</th>
              <th className="text-left p-4">Place</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-4">{r.fuel_date}</td>
                <td className="p-4 font-medium">{r.registration_num}</td>
                <td className="p-4">{r.distance_km?.toLocaleString()}</td>
                <td className="p-4">{r.quantity_liters}</td>
                <td className="p-4">{r.km_per_liter?.toFixed(2)}</td>
                <td className="p-4">${r.amount?.toFixed(2)}</td>
                <td className="p-4">{r.place}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}