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
  return_date?: string;
  return_time?: string;
  num_passengers: number;
  passenger_names?: string;
  status: 'pending' | 'approved' | 'rejected' | 'allocated' | 'inspected' | 'ready_for_departure' | 'departed' | 'completed' | 'inspection_failed';
  requester_name?: string;
  driver_name?: string;
  driver_id?: string;
  registration_num?: string;
  vehicle_id?: string;
  approved_by?: string;
  approved_at?: string;
  approval_reason?: string;
  allocated_by?: string;
  allocated_at?: string;
  starting_odometer?: number;
  ending_odometer?: number;
  inspection_notes?: string;
  driver_rating?: number;
  driver_rating_comment?: string;
  requested_by?: string;
  department?: string;
  created_at?: string;
}

interface DashboardStats {
  totalRequests: number;
  pendingApprovals: number;
  pendingAllocations: number;
  myAssignments: number;
  completedToday: number;
}

export default function RequisitionModule({ apiUrl, user }: RequisitionModuleProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [requests, setRequests] = useState<Requisition[]>([]);
  const [assignments, setAssignments] = useState<Requisition[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Requisition[]>([]);
  const [pendingAllocations, setPendingAllocations] = useState<Requisition[]>([]);
  const [failedInspections, setFailedInspections] = useState<Requisition[]>([]);
  const [completedTrips, setCompletedTrips] = useState<Requisition[]>([]);
  const [activeTrips, setActiveTrips] = useState<Requisition[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0, pendingApprovals: 0, pendingAllocations: 0, myAssignments: 0, completedToday: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [ratingTrip, setRatingTrip] = useState<Requisition | null>(null);
  const [inspectingTrip, setInspectingTrip] = useState<Requisition | null>(null);
  const [completingTrip, setCompletingTrip] = useState<Requisition | null>(null);
  const [departingTrip, setDepartingTrip] = useState<Requisition | null>(null);
  const [viewingTrip, setViewingTrip] = useState<Requisition | null>(null);
  
  // Form states
  const [inspectionChecks, setInspectionChecks] = useState({
    tires_ok: true, brakes_ok: true, lights_ok: true, oil_ok: true, coolant_ok: true,
    battery_ok: true, wipers_ok: true, mirrors_ok: true, seatbelts_ok: true, fuel_ok: true,
  });
  const [inspectionDefects, setInspectionDefects] = useState('');
  const [startingOdometer, setStartingOdometer] = useState('');
  const [endingOdometer, setEndingOdometer] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  
  const [processingId, setProcessingId] = useState<string | null>(null);
  const token = localStorage.getItem('token');
  
  const effectiveRole = getEffectiveRole(user);
  const isDriver = effectiveRole === 'driver';
  const isManager = ['admin', 'manager'].includes(effectiveRole);
  const isTransport = effectiveRole === 'transport_supervisor';
  const isHOD = effectiveRole === 'hod';
  const canApprove = isManager || isHOD;
  const canAllocate = isManager || isTransport;

  // Load data based on active tab
  useEffect(() => {
    loadDashboardStats();
    if (activeTab === 'my-requests') loadRequests();
    if (activeTab === 'my-assignments') loadAssignments();
    if (activeTab === 'approvals') loadPendingApprovals();
    if (activeTab === 'allocations') {
      loadPendingAllocations();
      loadFailedInspections();
    }
    if (activeTab === 'completed') loadCompletedTrips();
    if (activeTab === 'active') loadActiveTrips();
  }, [activeTab]);

  const loadDashboardStats = async () => {
    try {
      const res = await fetch(`${apiUrl}/requisitions/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Stats load error:', err);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/requisitions/my-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
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
      }
    } catch (err) {
      console.error('Failed to load allocations:', err);
      setPendingAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFailedInspections = async () => {
    try {
      const res = await fetch(`${apiUrl}/requisitions?status=inspection_failed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFailedInspections(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load failed inspections:', err);
      setFailedInspections([]);
    }
  };

  const loadActiveTrips = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/requisitions/active-trips`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTrips(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load active trips:', err);
      setActiveTrips([]);
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
        const unrated = Array.isArray(data) ? data.filter((r: Requisition) => 
          r.status === 'completed' && !r.driver_rating
        ) : [];
        setCompletedTrips(unrated);
      }
    } catch (err) {
      console.error('Failed to load completed trips:', err);
      setCompletedTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    setError('');
    setProcessingId(id);
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
        loadDashboardStats();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to approve/reject request');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDepart = async () => {
    if (!departingTrip) return;
    
    try {
      const res = await fetch(`${apiUrl}/requisitions/${departingTrip.id}/depart`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ starting_odometer: parseInt(startingOdometer) })
      });
      
      if (res.ok) {
        setDepartingTrip(null);
        setStartingOdometer('');
        loadAssignments();
        loadActiveTrips();
        loadDashboardStats();
      }
    } catch (err) {
      console.error('Depart error:', err);
    }
  };

  const handleCompleteTrip = async () => {
    if (!completingTrip) return;
    
    if (!endingOdometer || parseInt(endingOdometer) <= 0) {
      alert('Please enter a valid ending odometer reading');
      return;
    }
    
    try {
      const res = await fetch(`${apiUrl}/requisitions/${completingTrip.id}/complete`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          ending_odometer: parseInt(endingOdometer),
          notes: completionNotes 
        })
      });
      
      if (res.ok) {
        setCompletingTrip(null);
        setEndingOdometer('');
        setCompletionNotes('');
        loadAssignments();
        loadActiveTrips();
        loadDashboardStats();
      }
    } catch (err) {
      console.error('Complete error:', err);
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
        loadDashboardStats();
      }
    } catch (err) {
      console.error('Rate error:', err);
    }
  };

  const handleSubmitInspection = async () => {
    if (!inspectingTrip) return;
    
    if (!startingOdometer || parseInt(startingOdometer) <= 0) {
      alert('Please enter a valid starting odometer reading');
      return;
    }
    
    const allPassed = Object.values(inspectionChecks).every(v => v);
    
    try {
      const res = await fetch(`${apiUrl}/requisitions/${inspectingTrip.id}/inspection`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...inspectionChecks,
          defects_found: inspectionDefects,
          defect_photos: [],
          passed: allPassed && !inspectionDefects.trim(),
          starting_odometer: parseInt(startingOdometer)
        })
      });
      
      if (res.ok) {
        setInspectingTrip(null);
        setInspectionChecks({
          tires_ok: true, brakes_ok: true, lights_ok: true, oil_ok: true, coolant_ok: true,
          battery_ok: true, wipers_ok: true, mirrors_ok: true, seatbelts_ok: true, fuel_ok: true,
        });
        setInspectionDefects('');
        setStartingOdometer('');
        loadAssignments();
        loadDashboardStats();
      }
    } catch (err) {
      console.error('Inspection error:', err);
    }
  };

  const handleRetryInspection = async (reqId: string) => {
    try {
      const res = await fetch(`${apiUrl}/requisitions/${reqId}/retry-inspection`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        loadAssignments();
        loadDashboardStats();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to retry inspection');
      }
    } catch (err) {
      console.error('Retry inspection error:', err);
      alert('Network error. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-blue-100 text-blue-800',
      'allocated': 'bg-purple-100 text-purple-800',
      'inspected': 'bg-indigo-100 text-indigo-800',
      'ready_for_departure': 'bg-cyan-100 text-cyan-800',
      'departed': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'inspection_failed': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Vehicle Requisition</h1>
          <p className="text-sm text-gray-500">Manage vehicle requests, approvals, and assignments</p>
        </div>
        <span className="text-xs md:text-sm text-gray-500 bg-gray-100 px-2 md:px-3 py-1 rounded-full">
          Role: {effectiveRole}
        </span>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">{stats.totalRequests}</p>
          <p className="text-xs text-gray-600">Total Requests</p>
        </div>
        {canApprove && (
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingApprovals}</p>
            <p className="text-xs text-gray-600">Pending Approval</p>
          </div>
        )}
        {canAllocate && (
          <div className="bg-purple-50 p-3 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{stats.pendingAllocations}</p>
            <p className="text-xs text-gray-600">Pending Allocation</p>
          </div>
        )}
        {isDriver && (
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{stats.myAssignments}</p>
            <p className="text-xs text-gray-600">My Assignments</p>
          </div>
        )}
        <div className="bg-green-50 p-3 rounded-lg">
          <p className="text-2xl font-bold text-green-600">{stats.completedToday}</p>
          <p className="text-xs text-gray-600">Completed Today</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-100 p-1 rounded-xl overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <button onClick={() => setActiveTab('dashboard')} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white shadow' : ''}`}>
            📊 Dashboard
          </button>
          <button onClick={() => setActiveTab('request')} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === 'request' ? 'bg-white shadow' : ''}`}>
            ➕ New Request
          </button>
          <button onClick={() => { setActiveTab('my-requests'); loadRequests(); }} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === 'my-requests' ? 'bg-white shadow' : ''}`}>
            📝 My Requests
          </button>
          {isDriver && (
            <button onClick={() => { setActiveTab('my-assignments'); loadAssignments(); }} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === 'my-assignments' ? 'bg-white shadow' : ''}`}>
              🚗 My Assignments
            </button>
          )}
          {canApprove && (
            <button onClick={() => { setActiveTab('approvals'); loadPendingApprovals(); }} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === 'approvals' ? 'bg-white shadow' : ''}`}>
              ✅ Approvals ({stats.pendingApprovals})
            </button>
          )}
          {canAllocate && (
            <button onClick={() => { setActiveTab('allocations'); loadPendingAllocations(); }} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === 'allocations' ? 'bg-white shadow' : ''}`}>
              🎯 Allocations ({stats.pendingAllocations})
            </button>
          )}
          <button onClick={() => { setActiveTab('active'); loadActiveTrips(); }} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === 'active' ? 'bg-white shadow' : ''}`}>
            🚀 Active Trips
          </button>
          <button onClick={() => { setActiveTab('completed'); loadCompletedTrips(); }} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === 'completed' ? 'bg-white shadow' : ''}`}>
            ⭐ Rate Driver
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => setActiveTab('request')} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
                ➕ Create New Request
              </button>
              <button onClick={() => { setActiveTab('my-requests'); loadRequests(); }} className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200">
                📋 View My Requests
              </button>
              {isDriver && (
                <button onClick={() => { setActiveTab('my-assignments'); loadAssignments(); }} className="w-full bg-orange-100 text-orange-700 py-3 rounded-lg hover:bg-orange-200">
                  🚗 View My Assignments
                </button>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Workflow Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-yellow-50 rounded">
                <span>Pending Approval</span>
                <span className="font-semibold">{stats.pendingApprovals}</span>
              </div>
              <div className="flex justify-between p-2 bg-purple-50 rounded">
                <span>Pending Allocation</span>
                <span className="font-semibold">{stats.pendingAllocations}</span>
              </div>
              <div className="flex justify-between p-2 bg-cyan-50 rounded">
                <span>Ready for Departure</span>
                <span className="font-semibold">{activeTrips.filter(t => t.status === 'ready_for_departure').length}</span>
              </div>
              <div className="flex justify-between p-2 bg-orange-50 rounded">
                <span>On Trip</span>
                <span className="font-semibold">{activeTrips.filter(t => t.status === 'departed').length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Request Form */}
      {activeTab === 'request' && (
        <RequestForm apiUrl={apiUrl} user={user} onSuccess={() => setActiveTab('my-requests')} />
      )}

      {/* My Requests */}
      {activeTab === 'my-requests' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">My Requests</h3>
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : requests?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No requests found</p>
          ) : (
            requests?.map((req) => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{req.request_no}</p>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(req.status)}`}>
                        {formatStatus(req.status)}
                      </span>
                    </div>
                    <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
                    <p className="text-sm text-gray-500">{req.travel_date} at {req.travel_time}</p>
                    <p className="text-sm text-gray-500">Purpose: {req.purpose}</p>
                    {req.driver_name && (
                      <p className="text-sm text-blue-600">🧑‍✈️ Driver: {req.driver_name}</p>
                    )}
                    {req.registration_num && (
                      <p className="text-sm text-blue-600">🚙 Vehicle: {req.registration_num}</p>
                    )}
                    {req.starting_odometer && (
                      <p className="text-sm text-gray-500">📊 Odometer: {req.starting_odometer} km</p>
                    )}
                  </div>
                  <button onClick={() => setViewingTrip(req)} className="text-blue-600 hover:text-blue-800 text-sm">
                    View Details
                  </button>
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
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{req.request_no}</p>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(req.status)}`}>
                        {formatStatus(req.status)}
                      </span>
                    </div>
                    <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
                    <p className="text-sm text-gray-500">{req.travel_date} at {req.travel_time}</p>
                    {req.registration_num && (
                      <p className="text-sm text-blue-600">🚙 Vehicle: {req.registration_num}</p>
                    )}
                    <p className="text-sm text-gray-500">👤 Requester: {req.requester_name}</p>
                  </div>
                </div>
                
                {/* Action Buttons based on status */}
                {req.status === 'allocated' && (
                  <div className="mt-4 pt-4 border-t">
                    <button onClick={() => setInspectingTrip(req)} className="w-full bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600">
                      🔍 Start Pre-Trip Inspection
                    </button>
                  </div>
                )}
                
                {req.status === 'ready_for_departure' && (
                  <div className="mt-4 pt-4 border-t">
                    <button onClick={() => { setDepartingTrip(req); setStartingOdometer(req.starting_odometer?.toString() || ''); }} className="w-full bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700">
                      🚀 Mark as Departed
                    </button>
                  </div>
                )}
                
                {req.status === 'departed' && (
                  <div className="mt-4 pt-4 border-t">
                    <button onClick={() => setCompletingTrip(req)} className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                      ✅ Complete Trip
                    </button>
                  </div>
                )}
                
                {req.status === 'inspection_failed' && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                      ❌ Inspection failed - Contact supervisor
                    </div>
                    <button onClick={() => handleRetryInspection(req.id)} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                      🔄 Retry Inspection (After Fixes)
                    </button>
                  </div>
                )}
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
                    <p className="text-sm text-gray-500">{req.travel_date} at {req.travel_time}</p>
                    <p className="text-sm text-gray-500">👤 Requested by: {req.requester_name} ({req.department})</p>
                    <p className="text-sm text-gray-500">🎯 Purpose: {req.purpose}</p>
                    <p className="text-sm text-gray-500">👥 Passengers: {req.num_passengers}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(req.id, 'approved')} disabled={processingId === req.id} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-400">
                      {processingId === req.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button onClick={() => handleApprove(req.id, 'rejected')} disabled={processingId === req.id} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:bg-gray-400">
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
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pending Allocations</h3>
            {pendingAllocations?.length === 0 ? (
              <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">No pending allocations</p>
            ) : (
              pendingAllocations?.map((req) => (
                <AllocationCard key={req.id} req={req} apiUrl={apiUrl} token={token} onAllocate={() => { loadPendingAllocations(); loadDashboardStats(); }} mode="allocate" />
              ))
            )}
          </div>

          {failedInspections?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-600">⚠️ Failed Inspections (Need Reallocation)</h3>
              {failedInspections?.map((req) => (
                <AllocationCard key={req.id} req={req} apiUrl={apiUrl} token={token} onAllocate={() => { loadPendingAllocations(); loadFailedInspections(); loadDashboardStats(); }} mode="reallocate" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Trips */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Active Trips</h3>
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : activeTrips?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No active trips</p>
          ) : (
            activeTrips?.map((req) => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{req.request_no}</p>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(req.status)}`}>
                        {formatStatus(req.status)}
                      </span>
                    </div>
                    <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
                    <p className="text-sm text-gray-500">🚙 {req.registration_num} | 🧑‍✈️ {req.driver_name}</p>
                    <p className="text-sm text-gray-500">👤 Requester: {req.requester_name}</p>
                    {req.starting_odometer && (
                      <p className="text-sm text-gray-500">📊 Started at: {req.starting_odometer} km</p>
                    )}
                  </div>
                </div>
              </div>
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
                    <p className="text-sm text-gray-500">🧑‍✈️ Driver: {req.driver_name}</p>
                    <p className="text-sm text-gray-500">🚙 Vehicle: {req.registration_num}</p>
                  </div>
                  <button onClick={() => setRatingTrip(req)} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600">
                    ⭐ Rate Driver
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODALS */}

      {/* View Trip Modal */}
      {viewingTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Trip Details</h3>
            <div className="space-y-3 text-sm">
              <p><strong>Request #:</strong> {viewingTrip.request_no}</p>
              <p><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${getStatusColor(viewingTrip.status)}`}>{formatStatus(viewingTrip.status)}</span></p>
              <p><strong>From:</strong> {viewingTrip.place_of_departure}</p>
              <p><strong>To:</strong> {viewingTrip.destination}</p>
              <p><strong>Date:</strong> {viewingTrip.travel_date} at {viewingTrip.travel_time}</p>
              <p><strong>Purpose:</strong> {viewingTrip.purpose}</p>
              <p><strong>Passengers:</strong> {viewingTrip.num_passengers}</p>
              {viewingTrip.driver_name && <p><strong>Driver:</strong> {viewingTrip.driver_name}</p>}
              {viewingTrip.registration_num && <p><strong>Vehicle:</strong> {viewingTrip.registration_num}</p>}
              {viewingTrip.starting_odometer && <p><strong>Starting Odometer:</strong> {viewingTrip.starting_odometer} km</p>}
              {viewingTrip.ending_odometer && <p><strong>Ending Odometer:</strong> {viewingTrip.ending_odometer} km</p>}
              {viewingTrip.driver_rating && (
                <p><strong>Driver Rating:</strong> ⭐ {viewingTrip.driver_rating}/5</p>
              )}
            </div>
            <button onClick={() => setViewingTrip(null)} className="mt-4 w-full px-4 py-2 border rounded-lg hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Rate Driver</h3>
            <p className="text-gray-600 mb-4">Trip: {ratingTrip.place_of_departure} → {ratingTrip.destination}</p>
            <p className="text-gray-600 mb-4">Driver: {ratingTrip.driver_name}</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating (1-5 stars)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Comment (optional)</label>
              <textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={3} placeholder="How was the driver?" />
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => { setRatingTrip(null); setRating(5); setRatingComment(''); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleRateDriver} className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600">
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Modal */}
      {inspectingTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-2">🔍 Pre-Trip Inspection</h3>
            <p className="text-gray-600 mb-4 text-sm">{inspectingTrip.registration_num} - {inspectingTrip.place_of_departure} → {inspectingTrip.destination}</p>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">Starting Odometer Reading (km) *</label>
              <input type="number" value={startingOdometer} onChange={(e) => setStartingOdometer(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. 45230" min="0" required />
              <p className="text-xs text-gray-500 mt-1">Record the odometer before departure</p>
            </div>
            
            <div className="space-y-2 mb-4">
              {Object.entries(inspectionChecks).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer">
                  <span className="text-sm capitalize">{key.replace('_ok', '').replace('_', ' ')}</span>
                  <input type="checkbox" checked={value} onChange={(e) => setInspectionChecks({...inspectionChecks, [key]: e.target.checked})} className="w-5 h-5 text-blue-600" />
                </label>
              ))}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Defects found (optional)</label>
              <textarea value={inspectionDefects} onChange={(e) => setInspectionDefects(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Describe any defects..." />
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => { setInspectingTrip(null); setInspectionDefects(''); setStartingOdometer(''); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button onClick={handleSubmitInspection} disabled={!startingOdometer || parseInt(startingOdometer) <= 0} className="flex-1 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 text-sm disabled:bg-gray-400">
                Submit Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Depart Modal */}
      {departingTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">🚀 Mark as Departed</h3>
            <p className="text-gray-600 mb-4">{departingTrip.place_of_departure} → {departingTrip.destination}</p>
            
            <div className="mb-4 p-3 bg-cyan-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Starting Odometer (km) *</label>
              <input type="number" value={startingOdometer} onChange={(e) => setStartingOdometer(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. 45230" min="0" required />
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => { setDepartingTrip(null); setStartingOdometer(''); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDepart} disabled={!startingOdometer || parseInt(startingOdometer) <= 0} className="flex-1 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 disabled:bg-gray-400">
                Confirm Departure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Trip Modal */}
      {completingTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">✅ Complete Trip</h3>
            <p className="text-gray-600 mb-4">{completingTrip.place_of_departure} → {completingTrip.destination}</p>
            <p className="text-sm text-gray-500 mb-4">Starting Odometer: {completingTrip.starting_odometer} km</p>
            
            <div className="mb-4 p-3 bg-green-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ending Odometer Reading (km) *</label>
              <input type="number" value={endingOdometer} onChange={(e) => setEndingOdometer(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. 45350" min={completingTrip.starting_odometer || 0} required />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip Notes (optional)</label>
              <textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} placeholder="Any issues or notes..." />
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => { setCompletingTrip(null); setEndingOdometer(''); setCompletionNotes(''); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleCompleteTrip} disabled={!endingOdometer || parseInt(endingOdometer) <= (completingTrip.starting_odometer || 0)} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                Complete Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Allocation Card Component
function AllocationCard({ req, apiUrl, token, onAllocate, mode = 'allocate' }: { 
  req: Requisition; 
  apiUrl: string; 
  token: string | null;
  onAllocate: () => void;
  mode?: 'allocate' | 'reallocate';
}) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState(req.vehicle_id || '');
  const [selectedDriver, setSelectedDriver] = useState(req.driver_id || '');
  const [showAllocate, setShowAllocate] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadVehiclesAndDrivers = async () => {
    setError('');
    try {
      const [vRes, dRes] = await Promise.all([
        fetch(`${apiUrl}/vehicles?status=Active`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/staff?role=Driver`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (vRes.ok) setVehicles(await vRes.json());
      else setError('Failed to load vehicles');
      if (dRes.ok) setDrivers(await dRes.json());
      else setError('Failed to load drivers');
    } catch (err) {
      console.error('Failed to load vehicles/drivers:', err);
      setError('Network error loading data');
    }
  };

  const handleAllocate = async () => {
    if (!selectedVehicle || !selectedDriver) {
      setError('Please select both vehicle and driver');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const endpoint = mode === 'reallocate' ? 'reallocate' : 'allocate';
    
    try {
      const res = await fetch(`${apiUrl}/requisitions/${req.id}/${endpoint}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicle_id: selectedVehicle, driver_id: selectedDriver })
      });
      
      if (res.ok) {
        setShowAllocate(false);
        setSelectedVehicle('');
        setSelectedDriver('');
        onAllocate();
      } else {
        const data = await res.json();
        setError(data.error || `Failed to ${mode}`);
      }
    } catch (err) {
      console.error(`${mode} error:`, err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold">{req.request_no}</p>
          <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
          <p className="text-sm text-gray-500">{req.travel_date} {req.travel_time}</p>
          <p className="text-sm text-gray-500">👤 Requested by: {req.requester_name}</p>
          {mode === 'reallocate' && req.registration_num && (
            <p className="text-sm text-red-600">Failed Vehicle: {req.registration_num}</p>
          )}
        </div>
        {!showAllocate ? (
          <button onClick={() => { setShowAllocate(true); loadVehiclesAndDrivers(); }} className={`px-3 py-1 rounded text-sm text-white ${mode === 'reallocate' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {mode === 'reallocate' ? 'Reallocate' : 'Allocate'}
          </button>
        ) : null}
      </div>
      
      {showAllocate && (
        <div className="mt-4 space-y-3 border-t pt-4">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{error}</div>}
          {mode === 'reallocate' && (
            <div className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm">
              ⚠️ Select a different vehicle/driver for this trip
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Select Vehicle</label>
            <select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">Select Vehicle</option>
              {vehicles?.map((v) => (
                <option key={v.id} value={v.id}>{v.registration_num} - {v.make_model}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Select Driver</label>
            <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">Select Driver</option>
              {drivers?.map((d) => (
                <option key={d.id} value={d.id}>{d.staff_name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setShowAllocate(false)} className="px-3 py-1 border rounded text-sm" disabled={loading}>Cancel</button>
            <button onClick={handleAllocate} disabled={!selectedVehicle || !selectedDriver || loading} className={`px-3 py-1 text-white rounded text-sm disabled:bg-gray-400 ${mode === 'reallocate' ? 'bg-red-600' : 'bg-green-600'}`}>
              {loading ? (mode === 'reallocate' ? 'Reallocating...' : 'Allocating...') : (mode === 'reallocate' ? 'Confirm Reallocation' : 'Confirm Allocation')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
