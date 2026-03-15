import { useState, useEffect } from 'react';
import { getEffectiveRole } from '../../utils/roles';
import RequestForm from './RequestForm';

interface RequisitionModuleProps {
  apiUrl: string;
  user: any;
}

interface Requisition {
  id: string;
  request_no: string;
  place_of_departure: string;
  destination: string;
  purpose: string;
  travel_date: string;
  travel_time: string;
  status: string;
  requester_name?: string;
  driver_name?: string;
  driver_id?: string;
  registration_num?: string;
  approved_by?: string;
  approved_at?: string;
  driver_rating?: number;
  driver_rating_comment?: string;
  requested_by?: string;
}

export default function RequisitionModule({ apiUrl, user }: RequisitionModuleProps) {
  const [activeTab, setActiveTab] = useState('request');
  const [requests, setRequests] = useState<Requisition[]>([]);
  const [assignments, setAssignments] = useState<Requisition[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Requisition[]>([]);
  const [pendingAllocations, setPendingAllocations] = useState<Requisition[]>([]);
  const [completedTrips, setCompletedTrips] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(false);
  const [ratingTrip, setRatingTrip] = useState<Requisition | null>(null);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const token = localStorage.getItem('token');
  
  const effectiveRole = getEffectiveRole(user);
  const isDriver = effectiveRole === 'driver';
  const isManager = ['admin', 'manager'].includes(effectiveRole);
  const isTransport = effectiveRole === 'transport_supervisor';
  const isHOD = effectiveRole === 'hod';
  const canApprove = isManager || isHOD;
  const canAllocate = isManager || isTransport;
  
  // Debug: log user and role info
  console.log('User:', user);
  console.log('Effective Role:', effectiveRole);
  console.log('Can Approve:', canApprove);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'my-requests') loadRequests();
    if (activeTab === 'my-assignments') loadAssignments();
    if (activeTab === 'approvals') loadPendingApprovals();
    if (activeTab === 'allocations') loadPendingAllocations();
    if (activeTab === 'completed') loadCompletedTrips();
  }, [activeTab]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/requisitions/my-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/requisitions/my-assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(Array.isArray(data) ? data : []);
      } else {
        setAssignments([]);
      }
    } catch (err) {
      console.error('Failed to load assignments:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingApprovals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/requisitions/pending-approvals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingApprovals(Array.isArray(data) ? data : []);
      } else {
        setPendingApprovals([]);
      }
    } catch (err) {
      console.error('Failed to load approvals:', err);
      setPendingApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingAllocations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/requisitions/pending-allocations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingAllocations(Array.isArray(data) ? data : []);
      } else {
        setPendingAllocations([]);
      }
    } catch (err) {
      console.error('Failed to load allocations:', err);
      setPendingAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedTrips = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/requisitions/my-requests?status=completed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter only completed trips that haven't been rated
        const unrated = Array.isArray(data) ? data.filter((r: Requisition) => 
          r.status === 'completed' && !r.driver_rating
        ) : [];
        setCompletedTrips(unrated);
      } else {
        setCompletedTrips([]);
      }
    } catch (err) {
      console.error('Failed to load completed trips:', err);
      setCompletedTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`${apiUrl}/requisitions/${id}/approve`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, reason: status === 'approved' ? 'Approved' : 'Rejected' })
      });
      if (res.ok) {
        loadPendingApprovals();
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  const handleRateDriver = async () => {
    if (!ratingTrip) return;
    
    try {
      const res = await fetch(`${apiUrl}/requisitions/${ratingTrip.id}/rate`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating, comment: ratingComment })
      });
      if (res.ok) {
        setRatingTrip(null);
        setRating(5);
        setRatingComment('');
        loadCompletedTrips();
      }
    } catch (err) {
      console.error('Rate error:', err);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-blue-100 text-blue-800',
      'allocated': 'bg-purple-100 text-purple-800',
      'departed': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Vehicle Requisition</h1>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          Role: {effectiveRole} {canApprove && '(Can Approve)'}
        </span>
      </div>

      <div className="bg-gray-100 p-1 rounded-xl inline-flex flex-wrap">
        <button 
          onClick={() => setActiveTab('request')} 
          className={`px-4 py-2 rounded-lg ${activeTab === 'request' ? 'bg-white shadow' : ''}`}
        >
          New Request
        </button>
        
        <button 
          onClick={() => { setActiveTab('my-requests'); loadRequests(); }} 
          className={`px-4 py-2 rounded-lg ${activeTab === 'my-requests' ? 'bg-white shadow' : ''}`}
        >
          My Requests
        </button>
        
        {isDriver && (
          <button 
            onClick={() => { setActiveTab('my-assignments'); loadAssignments(); }} 
            className={`px-4 py-2 rounded-lg ${activeTab === 'my-assignments' ? 'bg-white shadow' : ''}`}
          >
            My Assignments
          </button>
        )}
        
        {canApprove && (
          <button 
            onClick={() => { setActiveTab('approvals'); loadPendingApprovals(); }} 
            className={`px-4 py-2 rounded-lg ${activeTab === 'approvals' ? 'bg-white shadow' : ''}`}
          >
            Approvals
          </button>
        )}
        
        {canAllocate && (
          <button 
            onClick={() => { setActiveTab('allocations'); loadPendingAllocations(); }} 
            className={`px-4 py-2 rounded-lg ${activeTab === 'allocations' ? 'bg-white shadow' : ''}`}
          >
            Allocations
          </button>
        )}
        
        <button 
          onClick={() => { setActiveTab('completed'); loadCompletedTrips(); }} 
          className={`px-4 py-2 rounded-lg ${activeTab === 'completed' ? 'bg-white shadow' : ''}`}
        >
          Rate Driver
        </button>
      </div>

      {/* New Request Form */}
      {activeTab === 'request' && (
        <RequestForm 
          apiUrl={apiUrl} 
          user={user}
          onSuccess={() => setActiveTab('my-requests')}
        />
      )}

      {/* My Requests */}
      {activeTab === 'my-requests' && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : requests?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No requests found</p>
          ) : (
            requests?.map((req) => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{req.request_no}</p>
                    <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
                    <p className="text-sm text-gray-500">{req.travel_date} {req.travel_time}</p>
                    {req.driver_name && (
                      <p className="text-sm text-blue-600">Driver: {req.driver_name}</p>
                    )}
                    {req.registration_num && (
                      <p className="text-sm text-blue-600">Vehicle: {req.registration_num}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-sm ${getStatusColor(req.status)}`}>
                    {req.status}
                  </span>
                </div>                
                {req.driver_rating && (
                  <div className="mt-2 flex items-center gap-1">
                    <span>⭐ {req.driver_rating}/5</span>
                    {req.driver_rating_comment && (
                      <span className="text-sm text-gray-500">- {req.driver_rating_comment}</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* My Assignments (Driver View) */}
      {activeTab === 'my-assignments' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">My Trip Assignments</h3>
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : assignments?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No assignments yet</p>
          ) : (
            assignments?.map((req) => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{req.request_no}</p>
                    <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
                    <p className="text-sm text-gray-500">{req.travel_date} {req.travel_time}</p>
                    {req.registration_num && (
                      <p className="text-sm text-blue-600">Vehicle: {req.registration_num}</p>
                    )}
                    <p className="text-sm text-gray-500">Requester: {req.requester_name}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm ${getStatusColor(req.status)}`}>
                    {req.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Approvals */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Pending Approvals</h3>
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : pendingApprovals?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No pending approvals</p>
          ) : (
            pendingApprovals?.map((req) => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{req.request_no}</p>
                    <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
                    <p className="text-sm text-gray-500">{req.travel_date} {req.travel_time}</p>
                    <p className="text-sm text-gray-500">Requested by: {req.requester_name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req.id, 'approved')}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApprove(req.id, 'rejected')}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Allocations */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Pending Allocations</h3>
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : pendingAllocations?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No pending allocations</p>
          ) : (
            pendingAllocations?.map((req) => (
              <AllocationCard 
                key={req.id} 
                req={req} 
                apiUrl={apiUrl}
                token={token}
                onAllocate={() => loadPendingAllocations()}
              />
            ))
          )}
        </div>
      )}

      {/* Rate Driver */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Rate Completed Trips</h3>
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : completedTrips?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No completed trips to rate</p>
          ) : (
            completedTrips?.map((req) => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{req.request_no}</p>
                    <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
                    <p className="text-sm text-gray-500">Driver: {req.driver_name}</p>
                  </div>
                  <button
                    onClick={() => setRatingTrip(req)}
                    className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                  >
                    ⭐ Rate Driver
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Rating Modal */}
      {ratingTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Rate Driver</h3>
            <p className="text-gray-600 mb-4">
              Trip: {ratingTrip.place_of_departure} → {ratingTrip.destination}
            </p>
            <p className="text-gray-600 mb-4">
              Driver: {ratingTrip.driver_name}
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating (1-5 stars)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Comment (optional)</label>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
                placeholder="How was the driver?"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => { setRatingTrip(null); setRating(5); setRatingComment(''); }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRateDriver}
                className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Allocation Card Component
function AllocationCard({ req, apiUrl, token, onAllocate }: { 
  req: Requisition; 
  apiUrl: string; 
  token: string | null;
  onAllocate: () => void;
}) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [showAllocate, setShowAllocate] = useState(false);

  const loadVehiclesAndDrivers = async () => {
    try {
      const [vRes, dRes] = await Promise.all([
        fetch(`${apiUrl}/vehicles?status=Active`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/staff?role=Driver`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (vRes.ok) setVehicles(await vRes.json());
      if (dRes.ok) setDrivers(await dRes.json());
    } catch (err) {
      console.error('Failed to load vehicles/drivers:', err);
    }
  };

  const handleAllocate = async () => {
    if (!selectedVehicle || !selectedDriver) return;
    
    try {
      const res = await fetch(`${apiUrl}/requisitions/${req.id}/allocate`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicle_id: selectedVehicle, driver_id: selectedDriver })
      });
      if (res.ok) {
        onAllocate();
      }
    } catch (err) {
      console.error('Allocate error:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold">{req.request_no}</p>
          <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
          <p className="text-sm text-gray-500">{req.travel_date} {req.travel_time}</p>
          <p className="text-sm text-gray-500">Requested by: {req.requester_name}</p>
        </div>
        {!showAllocate ? (
          <button
            onClick={() => { setShowAllocate(true); loadVehiclesAndDrivers(); }}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            Allocate
          </button>
        ) : null}
      </div>
      
      {showAllocate && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Vehicle</label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Vehicle</option>
              {vehicles?.map((v) => (
                <option key={v.id} value={v.id}>{v.registration_num} - {v.make_model}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Select Driver</label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Driver</option>
              {drivers?.map((d) => (
                <option key={d.id} value={d.id}>{d.staff_name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowAllocate(false)}
              className="px-3 py-1 border rounded text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAllocate}
              disabled={!selectedVehicle || !selectedDriver}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:bg-gray-400"
            >
              Confirm Allocation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
