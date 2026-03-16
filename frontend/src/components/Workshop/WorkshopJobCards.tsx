import { useState, useEffect } from 'react';

interface WorkshopJobCardsProps {
  apiUrl: string;
}

interface JobCard {
  id: string;
  job_card_number: string;
  vehicle_id: string;
  registration_num: string;
  defect_description: string;
  breakdown_description?: string;
  repair_type: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Approved' | 'In Progress' | 'Completed' | 'Cancelled';
  estimated_cost: number;
  actual_cost: number;
  cost?: number;
  target_hours: number;
  actual_hours: number;
  reported_by_name: string;
  reported_at: string;
  approved_at: string;
  assigned_technician_name: string;
  service_provider: string;
}

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-orange-100 text-orange-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-gray-100 text-gray-800'
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-800',
  Medium: 'bg-blue-100 text-blue-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800'
};

export default function WorkshopJobCards({ apiUrl }: WorkshopJobCardsProps) {
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [defectiveVehicles, setDefectiveVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedJobCard, setSelectedJobCard] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [availableParts, setAvailableParts] = useState<any[]>([]);
  const token = localStorage.getItem('token');

  const [formData, setFormData] = useState({
    vehicle_id: '',
    defect_description: '',
    repair_type: 'Preventive',
    priority: 'Medium',
    estimated_cost: '',
    target_hours: '',
    service_provider: 'Internal'
  });

  useEffect(() => {
    fetchJobCards();
    fetchDefectiveVehicles();
    fetchAvailableParts();
  }, [statusFilter]);

  const fetchJobCards = async () => {
    setLoading(true);
    try {
      // Get from repairs endpoint which includes job cards
      const res = await fetch(`${apiUrl}/repairs/defective-vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setDefectiveVehicles(data);
      }
      
      // Get all job cards - need to get from a different endpoint
      const jcRes = await fetch(`${apiUrl}/repairs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (jcRes.ok) {
        const repairs = await jcRes.json();
        // Transform to job card format
        setJobCards(repairs.map((r: any) => ({
          ...r,
          job_card_number: r.id.substring(0, 8).toUpperCase(),
          status: r.status === 'Completed' ? 'Completed' : 'In Progress'
        })));
      }
    } catch (err) {
      console.error('Failed to fetch job cards:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDefectiveVehicles = async () => {
    try {
      const res = await fetch(`${apiUrl}/repairs/defective-vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDefectiveVehicles(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch defective vehicles:', err);
    }
  };

  const fetchAvailableParts = async () => {
    try {
      const res = await fetch(`${apiUrl}/workshop/parts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const parts = await res.json();
        setAvailableParts(parts.filter((p: any) => p.quantity_on_hand > 0));
      }
    } catch (err) {
      console.error('Failed to fetch parts:', err);
    }
  };

  const createJobCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create repair record which creates job card
      const res = await fetch(`${apiUrl}/repairs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          date_in: new Date().toISOString().split('T')[0],
          preventative_maintenance: formData.repair_type === 'Preventive' ? formData.defect_description : '',
          breakdown_description: formData.repair_type !== 'Preventive' ? formData.defect_description : ''
        })
      });
      
      if (res.ok) {
        setShowCreate(false);
        setFormData({
          vehicle_id: '', defect_description: '', repair_type: 'Preventive',
          priority: 'Medium', estimated_cost: '', target_hours: '', service_provider: 'Internal'
        });
        fetchJobCards();
      }
    } catch (err) {
      console.error('Failed to create job card:', err);
    }
  };

  const updateJobCardStatus = async (id: string, _status: string) => {
    try {
      const res = await fetch(`${apiUrl}/repairs/${id}/complete`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date_out: new Date().toISOString().split('T')[0],
          actual_repair_hours: 1
        })
      });
      
      if (res.ok) {
        fetchJobCards();
        if (selectedJobCard?.id === id) {
          setSelectedJobCard(null);
        }
      }
    } catch (err) {
      console.error('Failed to update job card:', err);
    }
  };

  const addPartToJobCard = async (jobCardId: string, partId: string, quantity: number) => {
    try {
      const res = await fetch(`${apiUrl}/workshop/usage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_card_id: jobCardId,
          part_id: partId,
          quantity_used: quantity
        })
      });
      
      if (res.ok) {
        fetchJobCards();
      }
    } catch (err) {
      console.error('Failed to add part:', err);
    }
  };

  const createInvoiceFromJobCard = async (jobCardId: string) => {
    try {
      const res = await fetch(`${apiUrl}/workshop/invoices/from-job-card`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_card_id: jobCardId,
          labor_hours: selectedJobCard?.actual_hours || 1,
          labor_rate: 50
        })
      });
      
      if (res.ok) {
        const invoice = await res.json();
        alert(`Invoice ${invoice.invoice_number} created!`);
        fetchJobCards();
      }
    } catch (err) {
      console.error('Failed to create invoice:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Create Job Card
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createJobCard} className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <select
              value={formData.vehicle_id}
              onChange={(e) => setFormData({...formData, vehicle_id: e.target.value})}
              className="border rounded-lg px-3 py-2"
              required
            >
              <option value="">Select Vehicle</option>
              {defectiveVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registration_num} - {v.make_model}</option>
              ))}
            </select>
            
            <select
              value={formData.repair_type}
              onChange={(e) => setFormData({...formData, repair_type: e.target.value})}
              className="border rounded-lg px-3 py-2"
            >
              <option>Preventive</option>
              <option>Corrective</option>
              <option>Emergency</option>
            </select>
          </div>
          
          <textarea
            placeholder="Defect / Work Description *"
            value={formData.defect_description}
            onChange={(e) => setFormData({...formData, defect_description: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
            rows={3}
            required
          />
          
          <div className="grid grid-cols-4 gap-4">
            <select
              value={formData.priority}
              onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
              className="border rounded-lg px-3 py-2"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
            
            <input
              type="number"
              placeholder="Est. Cost"
              value={formData.estimated_cost}
              onChange={(e) => setFormData({...formData, estimated_cost: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            
            <input
              type="number"
              placeholder="Target Hours"
              value={formData.target_hours}
              onChange={(e) => setFormData({...formData, target_hours: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            
            <select
              value={formData.service_provider}
              onChange={(e) => setFormData({...formData, service_provider: e.target.value})}
              className="border rounded-lg px-3 py-2"
            >
              <option>Internal</option>
              <option>External Garage</option>
              <option>Dealership</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg">Create Job Card</button>
            <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-300 px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {/*  Defective Vehicles Alert  */}
      {defectiveVehicles.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-semibold text-orange-800 mb-2">⚠️ {defectiveVehicles.length} Vehicle(s) Need Attention</h4>
          <div className="flex flex-wrap gap-2">
            {defectiveVehicles.slice(0, 5).map((v) => (
              <span key={v.id} className="bg-white px-3 py-1 rounded text-sm">
                {v.registration_num} - {v.defect_notes?.substring(0, 30)}...
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Job Card #</th>
                <th className="text-left p-3">Vehicle</th>
                <th className="text-left p-3">Description</th>
                <th className="text-center p-3">Priority</th>
                <th className="text-center p-3">Status</th>
                <th className="text-right p-3">Est. Cost</th>
                <th className="text-center p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobCards.map((jc) => (
                <tr key={jc.id} className="border-t">
                  <td className="p-3 font-mono">{jc.job_card_number}</td>
                  <td className="p-3">{jc.registration_num}</td>
                  <td className="p-3 max-w-xs truncate">{jc.defect_description || jc.breakdown_description}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${PRIORITY_COLORS[jc.priority || 'Medium']}`}>
                      {jc.priority || 'Medium'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[jc.status]}`}>
                      {jc.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">${parseFloat(String(jc.estimated_cost || jc.cost || 0)).toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelectedJobCard(jc)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedJobCard && (
        <JobCardDetailModal
          jobCard={selectedJobCard}
          availableParts={availableParts}
          onClose={() => setSelectedJobCard(null)}
          onUpdateStatus={updateJobCardStatus}
          onAddPart={addPartToJobCard}
          onCreateInvoice={createInvoiceFromJobCard}
        />
      )}
    </div>
  );
}

function JobCardDetailModal({ jobCard, availableParts, onClose, onUpdateStatus, onAddPart, onCreateInvoice }: {
  jobCard: any;
  availableParts: any[];
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddPart: (jobCardId: string, partId: string, qty: number) => void;
  onCreateInvoice: (id: string) => void;
}) {
  const [selectedPart, setSelectedPart] = useState('');
  const [partQty, setPartQty] = useState('1');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold">Job Card {jobCard.job_card_number || jobCard.id.substring(0, 8).toUpperCase()}</h2>
              <p className="text-gray-500">{jobCard.registration_num}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">Status</p>
              <span className={`px-2 py-1 rounded text-xs ${
                jobCard.status === 'Completed' ? 'bg-green-100 text-green-800' :
                jobCard.status === 'In Progress' ? 'bg-orange-100 text-orange-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {jobCard.status}
              </span>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-500">Service Provider</p>
              <p className="font-medium">{jobCard.service_provider || jobCard.garage_name || 'Internal'}</p>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold mb-2">Work Description</h4>
            <p className="text-gray-700 bg-gray-50 p-3 rounded">{jobCard.defect_description || jobCard.breakdown_description || 'No description'}</p>
          </div>

          {/*  Add Parts Section  */}
          <div className="border-t pt-4 mb-6">
            <h4 className="font-semibold mb-3">Add Parts</h4>
            <div className="flex gap-2">
              <select
                value={selectedPart}
                onChange={(e) => setSelectedPart(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2"
              >
                <option value="">Select Part</option>
                {availableParts.map((p) => (
                  <option key={p.id} value={p.id}>{p.part_number} - {p.part_name} (Stock: {p.quantity_on_hand})</option>
                ))}
              </select>
              
              <input
                type="number"
                min="1"
                value={partQty}
                onChange={(e) => setPartQty(e.target.value)}
                className="w-20 border rounded-lg px-3 py-2"
              />
              
              <button
                onClick={() => {
                  if (selectedPart) {
                    onAddPart(jobCard.id, selectedPart, parseInt(partQty));
                    setSelectedPart('');
                    setPartQty('1');
                  }
                }}
                disabled={!selectedPart}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/*  Actions  */}
          <div className="flex gap-2">
            {jobCard.status !== 'Completed' && (
              <>
                <button
                  onClick={() => onUpdateStatus(jobCard.id, 'In Progress')}
                  className="flex-1 bg-orange-600 text-white py-2 rounded-lg"
                >
                  Start Work
                </button>
                <button
                  onClick={() => onUpdateStatus(jobCard.id, 'Completed')}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg"
                >
                  Complete
                </button>
              </>
            )}
            
            {jobCard.status === 'Completed' && !jobCard.invoice_id && (
              <button
                onClick={() => onCreateInvoice(jobCard.id)}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg"
              >
                Create Invoice
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
