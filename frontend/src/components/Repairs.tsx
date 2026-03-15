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
  make_model?: string;
  status?: string;
}

interface DefectiveVehicle {
  id: string;
  registration_num: string;
  make_model: string;
  defect_notes: string;
  defect_reported_at: string;
  job_card_id?: string;
  job_card_number?: string;
  job_card_status?: string;
}

interface JobCard {
  id: string;
  job_card_number: string;
  registration_num: string;
  make_model?: string;
  defect_description: string;
  repair_type?: string;
  service_provider?: string;
  priority: string;
  estimated_cost?: number;
  actual_cost?: number;
  target_hours?: number;
  actual_hours?: number;
  status: string;
  reported_by_name?: string;
  approved_by_name?: string;
  reported_at: string;
  approved_at?: string;
}

export default function Repairs({ apiUrl }: RepairsProps) {
  const [activeTab, setActiveTab] = useState<'repairs' | 'job-cards' | 'defective'>('repairs');
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [defectiveVehicles, setDefectiveVehicles] = useState<DefectiveVehicle[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form states
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [showJobCardForm, setShowJobCardForm] = useState(false);
  const [selectedDefectiveVehicle, setSelectedDefectiveVehicle] = useState<DefectiveVehicle | null>(null);
  
  const [repairFormData, setRepairFormData] = useState({
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

  const [jobCardFormData, setJobCardFormData] = useState({
    vehicle_id: '',
    defect_description: '',
    repair_type: 'Preventive',
    service_provider: 'Internal Garage',
    priority: 'Medium',
    estimated_cost: ''
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchRepairs();
    fetchVehicles();
    fetchDefectiveVehicles();
    fetchJobCards();
  }, [apiUrl]);

  const fetchRepairs = async () => {
    setLoading(true);
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

  const fetchDefectiveVehicles = async () => {
    try {
      const res = await fetch(`${apiUrl}/repairs/defective-vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch defective vehicles');
      const data = await res.json();
      setDefectiveVehicles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Defective vehicles fetch error:', err);
      setDefectiveVehicles([]);
    }
  };

  const fetchJobCards = async () => {
    try {
      const res = await fetch(`${apiUrl}/repairs/job-cards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch job cards');
      const data = await res.json();
      setJobCards(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Job cards fetch error:', err);
      setJobCards([]);
    }
  };

  const handleRepairSubmit = async (e: React.FormEvent) => {
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
          ...repairFormData,
          odometer_reading: parseInt(repairFormData.odometer_reading) || 0,
          target_repair_hours: parseFloat(repairFormData.target_repair_hours) || 0,
          cost: parseFloat(repairFormData.cost) || 0
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save repair');
      }
      
      setShowRepairForm(false);
      setRepairFormData({
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
      fetchDefectiveVehicles();
    } catch (err: any) {
      console.error('Repair submit error:', err);
      setError(err.message || 'Failed to save repair');
    }
  };

  const handleJobCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch(`${apiUrl}/repairs/job-cards`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...jobCardFormData,
          estimated_cost: parseFloat(jobCardFormData.estimated_cost) || 0
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create job card');
      }
      
      setShowJobCardForm(false);
      setJobCardFormData({
        vehicle_id: '',
        defect_description: '',
        repair_type: 'Preventive',
        service_provider: 'Internal Garage',
        priority: 'Medium',
        estimated_cost: ''
      });
      fetchJobCards();
      fetchDefectiveVehicles();
    } catch (err: any) {
      console.error('Job card submit error:', err);
      setError(err.message || 'Failed to create job card');
    }
  };

  const scheduleRepair = (vehicle: DefectiveVehicle) => {
    setSelectedDefectiveVehicle(vehicle);
    setJobCardFormData({
      ...jobCardFormData,
      vehicle_id: vehicle.id,
      defect_description: vehicle.defect_notes || ''
    });
    setShowJobCardForm(true);
  };

  const approveJobCard = async (jobCardId: string) => {
    try {
      const res = await fetch(`${apiUrl}/repairs/job-cards/${jobCardId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to approve job card');
      fetchJobCards();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const completeJobCard = async (jobCardId: string) => {
    const actualHours = prompt('Enter actual repair hours:');
    if (!actualHours) return;
    
    const actualCost = prompt('Enter actual cost:');
    if (!actualCost) return;
    
    try {
      const res = await fetch(`${apiUrl}/repairs/job-cards/${jobCardId}/complete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          actual_hours: parseFloat(actualHours),
          actual_cost: parseFloat(actualCost),
          repair_notes: 'Job card completed'
        })
      });
      
      if (!res.ok) throw new Error('Failed to complete job card');
      fetchJobCards();
      fetchDefectiveVehicles();
    } catch (err: any) {
      alert('Error: ' + err.message);
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
      case 'Approved': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Pending': return 'bg-orange-100 text-orange-800';
      case 'Defective': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && repairs.length === 0 && jobCards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-gray-800">Repairs & Maintenance</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('repairs')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'repairs' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Repairs
          </button>
          <button
            onClick={() => setActiveTab('job-cards')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'job-cards' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Job Cards
          </button>
          <button
            onClick={() => setActiveTab('defective')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'defective' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800'}`}
          >
            Defective ({defectiveVehicles.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
      )}

      {/* Repairs Tab */}
      {activeTab === 'repairs' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Repair Records</h3>
            <button
              onClick={() => setShowRepairForm(!showRepairForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {showRepairForm ? 'Cancel' : '+ New Repair'}
            </button>
          </div>

          {showRepairForm && (
            <form onSubmit={handleRepairSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="date" value={repairFormData.date_in} onChange={e => setRepairFormData({...repairFormData, date_in: e.target.value})} className="border p-2 rounded" required />
                
                <select value={repairFormData.vehicle_id} onChange={e => setRepairFormData({...repairFormData, vehicle_id: e.target.value})} className="border p-2 rounded" required>
                  <option value="">Select Vehicle</option>
                  {vehicles?.map(v => <option key={v.id} value={v.id}>{v.registration_num}</option>)}
                </select>
                
                <input placeholder="Odometer Reading" type="number" value={repairFormData.odometer_reading} onChange={e => setRepairFormData({...repairFormData, odometer_reading: e.target.value})} className="border p-2 rounded" required />
                
                <input placeholder="Technician" value={repairFormData.assigned_technician} onChange={e => setRepairFormData({...repairFormData, assigned_technician: e.target.value})} className="border p-2 rounded" />
                
                <input placeholder="Garage Name" value={repairFormData.garage_name} onChange={e => setRepairFormData({...repairFormData, garage_name: e.target.value})} className="border p-2 rounded" />
                
                <input placeholder="Target Hours" type="number" step="0.5" value={repairFormData.target_repair_hours} onChange={e => setRepairFormData({...repairFormData, target_repair_hours: e.target.value})} className="border p-2 rounded" />
                
                <input placeholder="Cost ($)" type="number" step="0.01" value={repairFormData.cost} onChange={e => setRepairFormData({...repairFormData, cost: e.target.value})} className="border p-2 rounded" />
              </div>
              
              <textarea 
                placeholder="Preventative Maintenance Description" 
                value={repairFormData.preventative_maintenance} 
                onChange={e => setRepairFormData({...repairFormData, preventative_maintenance: e.target.value})} 
                className="border p-2 rounded w-full mt-4" 
                rows={2}
              />
              
              <textarea 
                placeholder="Breakdown/Repairs Description" 
                value={repairFormData.breakdown_description} 
                onChange={e => setRepairFormData({...repairFormData, breakdown_description: e.target.value})} 
                className="border p-2 rounded w-full mt-4" 
                rows={2}
              />
              
              <div className="mt-4 flex gap-2">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
                <button type="button" onClick={() => setShowRepairForm(false)} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
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
        </>
      )}

      {/* Job Cards Tab */}
      {activeTab === 'job-cards' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Job Cards</h3>
            <button
              onClick={() => setShowJobCardForm(!showJobCardForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {showJobCardForm ? 'Cancel' : '+ Create Job Card'}
            </button>
          </div>

          {showJobCardForm && (
            <form onSubmit={handleJobCardSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select 
                  value={jobCardFormData.vehicle_id} 
                  onChange={e => setJobCardFormData({...jobCardFormData, vehicle_id: e.target.value})} 
                  className="border p-2 rounded" 
                  required
                  disabled={!!selectedDefectiveVehicle}
                >
                  <option value="">Select Vehicle</option>
                  {vehicles?.filter(v => v.status === 'Defective' || v.status === 'Active').map(v => (
                    <option key={v.id} value={v.id}>{v.registration_num}</option>
                  ))}
                </select>
                
                <select 
                  value={jobCardFormData.repair_type} 
                  onChange={e => setJobCardFormData({...jobCardFormData, repair_type: e.target.value})}
                  className="border p-2 rounded"
                >
                  <option value="Preventive">Preventive Maintenance</option>
                  <option value="Corrective">Corrective Maintenance</option>
                  <option value="Breakdown">Breakdown Repair</option>
                  <option value="Inspection">Inspection Defect</option>
                </select>
                
                <select 
                  value={jobCardFormData.service_provider} 
                  onChange={e => setJobCardFormData({...jobCardFormData, service_provider: e.target.value})}
                  className="border p-2 rounded"
                >
                  <option value="Internal Garage">Internal Garage</option>
                  <option value="Toyota Kenya">Toyota Kenya</option>
                  <option value="CMC Motors">CMC Motors</option>
                  <option value="Other">Other</option>
                </select>
                
                <select 
                  value={jobCardFormData.priority} 
                  onChange={e => setJobCardFormData({...jobCardFormData, priority: e.target.value})}
                  className="border p-2 rounded"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
                
                <input 
                  placeholder="Estimated Cost ($)" 
                  type="number" 
                  step="0.01"
                  value={jobCardFormData.estimated_cost} 
                  onChange={e => setJobCardFormData({...jobCardFormData, estimated_cost: e.target.value})} 
                  className="border p-2 rounded" 
                />
              </div>
              
              <textarea 
                placeholder="Defect Description" 
                value={jobCardFormData.defect_description} 
                onChange={e => setJobCardFormData({...jobCardFormData, defect_description: e.target.value})} 
                className="border p-2 rounded w-full mt-4" 
                rows={3}
                required
              />
              
              <div className="mt-4 flex gap-2">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Create Job Card</button>
                <button 
                  type="button" 
                  onClick={() => { setShowJobCardForm(false); setSelectedDefectiveVehicle(null); }} 
                  className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4">Job Card #</th>
                  <th className="text-left p-4">Vehicle</th>
                  <th className="text-left p-4">Defect</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Provider</th>
                  <th className="text-left p-4">Priority</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobCards?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">No job cards found</td>
                  </tr>
                ) : (
                  jobCards?.map(jc => (
                    <tr key={jc.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-mono font-medium">{jc.job_card_number}</td>
                      <td className="p-4">{jc.registration_num}</td>
                      <td className="p-4 max-w-xs truncate">{jc.defect_description}</td>
                      <td className="p-4">{jc.repair_type}</td>
                      <td className="p-4">{jc.service_provider || '-'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-sm ${getPriorityColor(jc.priority)}`}>
                          {jc.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-sm ${getStatusColor(jc.status)}`}>
                          {jc.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {jc.status === 'Pending' && (
                            <button 
                              onClick={() => approveJobCard(jc.id)}
                              className="bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700"
                            >
                              Approve
                            </button>
                          )}
                          {jc.status === 'Approved' && (
                            <button 
                              onClick={() => completeJobCard(jc.id)}
                              className="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Defective Vehicles Tab */}
      {activeTab === 'defective' && (
        <>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-red-600">⚠️ Defective Vehicles</h3>
            <p className="text-sm text-gray-600">Vehicles flagged from failed inspections or reported defects</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {defectiveVehicles?.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                No defective vehicles found
              </div>
            ) : (
              defectiveVehicles?.map(v => (
                <div key={v.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-red-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-lg">{v.registration_num}</h4>
                      <p className="text-gray-600">{v.make_model}</p>
                    </div>
                    <span className="px-2 py-1 rounded text-sm bg-red-100 text-red-800">
                      Defective
                    </span>
                  </div>
                  
                  <div className="mt-3 p-3 bg-red-50 rounded text-sm">
                    <p className="font-medium text-red-800">Defect:</p>
                    <p className="text-red-700">{v.defect_notes}</p>
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-500">
                    Reported: {new Date(v.defect_reported_at).toLocaleDateString()}
                  </div>
                  
                  {v.job_card_id ? (
                    <div className="mt-3 p-2 bg-blue-50 rounded">
                      <p className="text-sm text-blue-800">
                        Job Card: {v.job_card_number} ({v.job_card_status})
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => scheduleRepair(v)}
                      className="mt-3 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Schedule Repair
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}