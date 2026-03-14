import { useState } from 'react';
import RequestForm from './RequestForm';

interface RequisitionModuleProps {
  apiUrl: string;
  user: any;
}

export default function RequisitionModule({ apiUrl, user }: RequisitionModuleProps) {
  const [activeTab, setActiveTab] = useState('request');
  const [requests, setRequests] = useState([]);
  const token = localStorage.getItem('token');

  const loadRequests = async () => {
    try {
      const res = await fetch(`${apiUrl}/requisitions/my-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Failed to load requests');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vehicle Requisition</h1>

      <div className="bg-gray-100 p-1 rounded-xl inline-flex flex-wrap">
        <button onClick={() => setActiveTab('request')} className={`px-4 py-2 rounded-lg ${activeTab === 'request' ? 'bg-white shadow' : ''}`}>New Request</button>
        <button onClick={() => { setActiveTab('my-requests'); loadRequests(); }} className={`px-4 py-2 rounded-lg ${activeTab === 'my-requests' ? 'bg-white shadow' : ''}`}>My Requests</button>
        {(user?.role === 'Manager' || user?.department === 'Transport') && (
          <>
            <button onClick={() => setActiveTab('approvals')} className={`px-4 py-2 rounded-lg ${activeTab === 'approvals' ? 'bg-white shadow' : ''}`}>Approvals</button>
            <button onClick={() => setActiveTab('allocations')} className={`px-4 py-2 rounded-lg ${activeTab === 'allocations' ? 'bg-white shadow' : ''}`}>Allocations</button>
          </>
        )}
      </div>

      {activeTab === 'request' && (
        <RequestForm 
          apiUrl={apiUrl} 
          user={user}
          onSuccess={() => setActiveTab('my-requests')}
        />
      )}

      {activeTab === 'my-requests' && (
        <div className="space-y-4">
          {requests.map((req: any) => (
            <div key={req.id} className="bg-white rounded-xl shadow-sm border p-4">
              <p className="font-bold">{req.request_no}</p>
              <p className="text-gray-600">{req.place_of_departure} → {req.destination}</p>
              <p className="text-sm text-gray-500">{req.travel_date}</p>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">{req.status}</span>
            </div>
          ))}
          {requests.length === 0 && <p className="text-gray-500 text-center py-8">No requests found</p>}
        </div>
      )}

      {activeTab === 'approvals' && <div className="text-center py-8 text-gray-500">Approvals view coming soon</div>}
      {activeTab === 'allocations' && <div className="text-center py-8 text-gray-500">Allocations view coming soon</div>}
    </div>
  );
}
