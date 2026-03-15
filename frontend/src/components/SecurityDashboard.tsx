import { useState, useEffect } from 'react';
import { Permissions, getEffectiveRole, type SystemRole } from '../utils/roles';

interface SecurityDashboardProps {
  apiUrl: string;
  user: any;
}

interface Trip {
  id: string;
  request_no: string;
  requester_name: string;
  driver_name: string;
  driver_phone?: string;
  registration_num: string;
  make_model?: string;
  place_of_departure: string;
  destination: string;
  travel_date: string;
  travel_time: string;
  starting_odometer?: number;
  ending_odometer?: number;
  departed_at?: string;
  trip_duration_minutes?: number;
  status: string;
}

export default function SecurityDashboard({ apiUrl, user }: SecurityDashboardProps) {
  const [activeTab, setActiveTab] = useState<'ready' | 'active' | 'history'>('ready');
  const [readyVehicles, setReadyVehicles] = useState<Trip[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [odometerReading, setOdometerReading] = useState('');
  const [notes, setNotes] = useState('');
  const [showModal, setShowModal] = useState<'checkout' | 'checkin' | null>(null);

  const token = localStorage.getItem('token');
  const effectiveRole: SystemRole = getEffectiveRole(user);

  const canManageGate = Permissions.canManageGate(effectiveRole);

  useEffect(() => {
    if (activeTab === 'ready') fetchReadyVehicles();
    if (activeTab === 'active') fetchActiveTrips();
  }, [activeTab]);

  const fetchReadyVehicles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/requisitions/security/ready-for-departure`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setReadyVehicles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
      setReadyVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTrips = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/requisitions/security/active-trips`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setActiveTrips(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
      setActiveTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedTrip) return;
    
    try {
      const res = await fetch(`${apiUrl}/requisitions/${selectedTrip.id}/security-checkout`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})  // No odometer needed - already recorded during inspection
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Checkout failed');
      }
      
      setShowModal(null);
      setSelectedTrip(null);
      fetchReadyVehicles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCheckin = async () => {
    if (!selectedTrip || !odometerReading) return;
    
    try {
      const res = await fetch(`${apiUrl}/requisitions/${selectedTrip.id}/security-checkin`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          ending_odometer: parseInt(odometerReading),
          notes 
        })
      });
      
      if (!res.ok) throw new Error('Checkin failed');
      
      setShowModal(null);
      setOdometerReading('');
      setNotes('');
      setSelectedTrip(null);
      fetchActiveTrips();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🔒 Security Gate Management</h1>
      
      {!canManageGate && (
        <div className="bg-yellow-50 p-4 rounded-lg text-yellow-800">
          ⚠️ View-only mode. Contact admin for checkout/checkin permissions.
        </div>
      )}

      {error && (
        <div className="bg-red-50 p-4 rounded-lg text-red-700">
          ❌ {error}
        </div>
      )}

      <div className="bg-gray-100 p-1 rounded-xl inline-flex">
        <button 
          onClick={() => setActiveTab('ready')} 
          className={`px-4 py-2 rounded-lg ${activeTab === 'ready' ? 'bg-white shadow' : ''}`}
        >
          🚗 Ready ({readyVehicles?.length || 0})
        </button>
        <button 
          onClick={() => setActiveTab('active')} 
          className={`px-4 py-2 rounded-lg ${activeTab === 'active' ? 'bg-white shadow' : ''}`}
        >
          🚙 Active ({activeTrips?.length || 0})
        </button>
      </div>

      {/* Ready for Departure */}
      {activeTab === 'ready' && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : readyVehicles?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No vehicles ready for departure</p>
          ) : (
            readyVehicles?.map((trip) => (
              <div key={trip.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{trip.registration_num}</span>
                      <span className="text-gray-500">{trip.make_model}</span>
                    </div>
                    <p className="text-gray-600">{trip.place_of_departure} → {trip.destination}</p>
                    <p className="text-sm text-gray-500">
                      Driver: {trip.driver_name} {trip.driver_phone && `(${trip.driver_phone})`}
                    </p>
                    <p className="text-sm text-gray-500">
                      Requested by: {trip.requester_name} | {trip.travel_date} {trip.travel_time}
                    </p>
                  </div>
                  {canManageGate && (
                    <button
                      onClick={() => { setSelectedTrip(trip); setShowModal('checkout'); }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      🚪 Check Out
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Active Trips */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : activeTrips?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No active trips</p>
          ) : (
            activeTrips?.map((trip) => (
              <div key={trip.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{trip.registration_num}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {trip.status}
                      </span>
                    </div>
                    <p className="text-gray-600">{trip.place_of_departure} → {trip.destination}</p>
                    <p className="text-sm text-gray-500">
                      Driver: {trip.driver_name}
                    </p>
                    <p className="text-sm text-blue-600">
                      🕐 Departed: {formatTime(trip.departed_at)}
                    </p>
                    {trip.starting_odometer && (
                      <p className="text-sm text-gray-500">
                        Odometer start: {trip.starting_odometer.toLocaleString()} km
                      </p>
                    )}
                  </div>
                  {canManageGate && (
                    <button
                      onClick={() => { setSelectedTrip(trip); setShowModal('checkin'); }}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
                    >
                      🏁 Check In
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Checkout Modal */}
      {showModal === 'checkout' && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">🚪 Check Out Vehicle</h3>
            <p className="text-gray-600 mb-4">
              {selectedTrip.registration_num} - {selectedTrip.driver_name}
            </p>
            
            {selectedTrip.starting_odometer ? (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Starting Odometer (Recorded during inspection)</p>
                <p className="text-lg font-semibold">{selectedTrip.starting_odometer.toLocaleString()} km</p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg text-yellow-800">
                ⚠️ Starting odometer not recorded. Inspection must be completed first.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={!selectedTrip.starting_odometer}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                Confirm Check Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkin Modal */}
      {showModal === 'checkin' && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">🏁 Check In Vehicle</h3>
            <p className="text-gray-600 mb-4">
              {selectedTrip.registration_num} - {selectedTrip.driver_name}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Starting Odometer
              </label>
              <input
                type="number"
                value={selectedTrip.starting_odometer || ''}
                disabled
                className="w-full border rounded-lg px-3 py-2 bg-gray-100"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ending Odometer Reading (km)
              </label>
              <input
                type="number"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="e.g. 45450"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (defects, incidents, etc.)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
                placeholder="Any issues observed..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckin}
                disabled={!odometerReading}
                className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
              >
                Confirm Check In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
