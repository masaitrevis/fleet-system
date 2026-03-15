import { useState, useEffect } from 'react';

interface RequestFormProps {
  apiUrl: string;
  user: any;
  onSuccess: () => void;
}

interface StaffMember {
  id: string;
  staff_no: string;
  staff_name: string;
  email: string;
  department: string;
  role: string;
}

export default function RequestForm({ apiUrl, user, onSuccess }: RequestFormProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const hasStaffId = !!user?.staffId;
  const [formData, setFormData] = useState({
    requested_by: user?.staffId || '',
    place_of_departure: '',
    destination: '',
    purpose: '',
    travel_date: '',
    travel_time: '',
    return_date: '',
    return_time: '',
    num_passengers: 1,
    passenger_names: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchStaff();
    // If user has staffId, pre-select it
    if (user?.staffId) {
      setFormData(prev => ({ ...prev, requested_by: user.staffId }));
    }
  }, [user]);

  const fetchStaff = async () => {
    try {
      const res = await fetch(`${apiUrl}/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStaff(data);
      }
    } catch (err) {
      console.error('Failed to load staff');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Validation - only check staff selection if user doesn't have staffId
    if (!hasStaffId) {
      const selectedStaff = staff.find((s: any) => s.id === formData.requested_by);
      if (!selectedStaff) {
        setError('Please select a staff member');
        setSubmitting(false);
        return;
      }
      if (!selectedStaff.email) {
        setError(`⚠️ ${selectedStaff.staff_name} has no email. Please add email in Staff tab first.`);
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch(`${apiUrl}/requisitions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create request');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    
    setSubmitting(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-lg font-bold mb-4">Request Vehicle</h2>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Requester field - show as text if user has staffId, else show dropdown */}
          {hasStaffId ? (
            <div>
              <label className="block text-sm font-medium mb-1">Requester</label>
              <input
                type="text"
                value={user?.staffName || 'Current User'}
                className="w-full border rounded-lg p-2 bg-gray-100"
                disabled
              />
              <input type="hidden" value={formData.requested_by} />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Requester *</label>
              <select 
                value={formData.requested_by}
                onChange={e => setFormData({...formData, requested_by: e.target.value})}
                className="w-full border rounded-lg p-2"
                required
              >
                <option value="">Select staff...</option>
                {staff?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.staff_name} - {s.department || 'No Dept'} {s.email ? '✓' : '⚠️'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Place of Departure *</label>
            <input
              value={formData.place_of_departure}
              onChange={e => setFormData({...formData, place_of_departure: e.target.value})}
              className="w-full border rounded-lg p-2"
              placeholder="e.g., Nairobi HQ"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Destination *</label>
            <input
              value={formData.destination}
              onChange={e => setFormData({...formData, destination: e.target.value})}
              className="w-full border rounded-lg p-2"
              placeholder="e.g., Mombasa Branch"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Purpose *</label>
            <input
              value={formData.purpose}
              onChange={e => setFormData({...formData, purpose: e.target.value})}
              className="w-full border rounded-lg p-2"
              placeholder="e.g., Client meeting"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Travel Date *</label>
            <input
              type="date"
              value={formData.travel_date}
              onChange={e => setFormData({...formData, travel_date: e.target.value})}
              className="w-full border rounded-lg p-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Travel Time *</label>
            <input
              type="time"
              value={formData.travel_time}
              onChange={e => setFormData({...formData, travel_time: e.target.value})}
              className="w-full border rounded-lg p-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Return Date</label>
            <input
              type="date"
              value={formData.return_date}
              onChange={e => setFormData({...formData, return_date: e.target.value})}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Return Time</label>
            <input
              type="time"
              value={formData.return_time}
              onChange={e => setFormData({...formData, return_time: e.target.value})}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Passengers *</label>
            <input
              type="number"
              min={1}
              value={formData.num_passengers}
              onChange={e => setFormData({...formData, num_passengers: parseInt(e.target.value)})}
              className="w-full border rounded-lg p-2"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Passenger Names</label>
            <textarea
              value={formData.passenger_names}
              onChange={e => setFormData({...formData, passenger_names: e.target.value})}
              className="w-full border rounded-lg p-2"
              placeholder="Names of passengers (one per line)"
              rows={3}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
