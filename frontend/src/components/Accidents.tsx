import { useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface AccidentsProps {
  apiUrl: string;
  user: any;
}

interface Accident {
  id: string;
  case_number: string;
  accident_date: string;
  accident_type: string;
  severity: string;
  status: string;
  registration_num: string;
  driver_name: string;
  injuries_reported: boolean;
  police_notified: boolean;
}

interface AccidentDetails extends Accident {
  witnesses: any[];
  evidence: any[];
  investigation: any;
  rootCause: any;
  capa: any[];
  lessons: any[];
  reported_by_name?: string;
}

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

export default function Accidents({ apiUrl, user }: AccidentsProps) {
  const [view, setView] = useState<'list' | 'form' | 'details' | 'analytics'>('list');
  const [accidents, setAccidents] = useState<Accident[]>([]);
  const [selectedAccident, setSelectedAccident] = useState<AccidentDetails | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ status: '', severity: '' });

  // Form states
  const [formData, setFormData] = useState({
    accident_date: new Date().toISOString().slice(0, 16),
    gps_location: '',
    vehicle_id: '',
    driver_id: '',
    accident_type: 'Collision',
    severity: 'Minor',
    injuries_reported: false,
    police_notified: false,
    third_party_involved: false,
    weather_condition: '',
    road_condition: '',
    incident_description: ''
  });

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAccidents();
    fetchVehiclesAndDrivers();
    fetchAnalytics();
  }, []);

  const fetchAccidents = async () => {
    setLoading(true);
    try {
      let url = `${apiUrl}/accidents`;
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.severity) params.append('severity', filter.severity);
      if (params.toString()) url += '?' + params.toString();

      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAccidents(data);
      }
    } catch (err) {
      console.error('Failed to fetch accidents');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehiclesAndDrivers = async () => {
    try {
      const [vehRes, drvRes] = await Promise.all([
        fetch(`${apiUrl}/vehicles`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/staff/drivers`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (vehRes.ok) setVehicles(await vehRes.json());
      if (drvRes.ok) setDrivers(await drvRes.json());
    } catch (err) {
      console.error('Failed to fetch vehicles/drivers');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${apiUrl}/accidents/analytics/dashboard?period=year`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAnalytics(await res.json());
    } catch (err) {
      console.error('Failed to fetch analytics');
    }
  };

  const fetchAccidentDetails = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/accidents/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAccident(data);
        setView('details');
      }
    } catch (err) {
      console.error('Failed to fetch accident details');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        vehicle_id: formData.vehicle_id || undefined,
        driver_id: formData.driver_id || undefined
      };
      
      const res = await fetch(`${apiUrl}/accidents`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        fetchAccidents();
        setView('list');
        // Reset form
        setFormData({
          accident_date: new Date().toISOString().slice(0, 16),
          gps_location: '',
          vehicle_id: '',
          driver_id: '',
          accident_type: 'Collision',
          severity: 'Minor',
          injuries_reported: false,
          police_notified: false,
          third_party_involved: false,
          weather_condition: '',
          road_condition: '',
          incident_description: ''
        });
      } else {
        const errorData = await res.json();
        console.error('Failed to create accident:', errorData);
        alert('Failed to report accident: ' + (errorData.error || errorData.details || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('Failed to create accident:', err);
      alert('Network error: ' + err.message);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Fatal': return 'bg-red-600 text-white';
      case 'Major': return 'bg-orange-500 text-white';
      case 'Minor': return 'bg-yellow-400 text-black';
      default: return 'bg-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Closed': return 'bg-green-100 text-green-800';
      case 'CAPA In Progress': return 'bg-blue-100 text-blue-800';
      case 'Root Cause Identified': return 'bg-purple-100 text-purple-800';
      case 'Under Investigation': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Views
  if (view === 'form') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">🚨 Report New Accident</h2>
          <button onClick={() => setView('list')} className="text-gray-600">← Back</button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                value={formData.accident_date}
                onChange={e => setFormData({...formData, accident_date: e.target.value})}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">GPS Location</label>
              <input
                value={formData.gps_location}
                onChange={e => setFormData({...formData, gps_location: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="e.g., -1.2921, 36.8219"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle *</label>
              <select
                value={formData.vehicle_id}
                onChange={e => setFormData({...formData, vehicle_id: e.target.value})}
                className="w-full border p-2 rounded"
                required
              >
                <option value="">Select Vehicle</option>
                {vehicles?.map(v => <option key={v.id} value={v.id}>{v.registration_num}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Driver *</label>
              <select
                value={formData.driver_id}
                onChange={e => setFormData({...formData, driver_id: e.target.value})}
                className="w-full border p-2 rounded"
                required
              >
                <option value="">Select Driver</option>
                {drivers?.map(d => <option key={d.id} value={d.id}>{d.staff_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Accident Type *</label>
              <select
                value={formData.accident_type}
                onChange={e => setFormData({...formData, accident_type: e.target.value})}
                className="w-full border p-2 rounded"
                required
              >
                <option>Collision</option>
                <option>Pedestrian</option>
                <option>Property Damage</option>
                <option>Rollover</option>
                <option>Near Miss</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity *</label>
              <select
                value={formData.severity}
                onChange={e => setFormData({...formData, severity: e.target.value})}
                className="w-full border p-2 rounded"
                required
              >
                <option>Minor</option>
                <option>Major</option>
                <option>Fatal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.injuries_reported}
                onChange={e => setFormData({...formData, injuries_reported: e.target.checked})}
              />
              Injuries Reported
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.police_notified}
                onChange={e => setFormData({...formData, police_notified: e.target.checked})}
              />
              Police Notified
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.third_party_involved}
                onChange={e => setFormData({...formData, third_party_involved: e.target.checked})}
              />
              Third Party Involved
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Weather Condition</label>
              <input
                value={formData.weather_condition}
                onChange={e => setFormData({...formData, weather_condition: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="e.g., Clear, Rainy, Foggy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Road Condition</label>
              <input
                value={formData.road_condition}
                onChange={e => setFormData({...formData, road_condition: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="e.g., Dry, Wet, Potholed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Incident Description *</label>
            <textarea
              value={formData.incident_description}
              onChange={e => setFormData({...formData, incident_description: e.target.value})}
              className="w-full border p-2 rounded h-32"
              required
              placeholder="Describe what happened..."
            />
          </div>

          <div className="flex gap-4">
            <button type="submit" className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">
              🚨 Report Accident
            </button>
            <button type="button" onClick={() => setView('list')} className="bg-gray-300 px-6 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'details' && selectedAccident) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <button onClick={() => setView('list')} className="text-gray-600 mb-2">← Back to List</button>
            <h2 className="text-2xl font-bold">Accident Case: {selectedAccident.case_number}</h2>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedAccident.status)}`}>
            {selectedAccident.status}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-semibold mb-4">📋 Accident Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600">Date & Time</p>
                  <p className="font-medium">{new Date(selectedAccident.accident_date).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Type</p>
                  <p className="font-medium">{selectedAccident.accident_type}</p>
                </div>
                <div>
                  <p className="text-gray-600">Severity</p>
                  <span className={`px-2 py-1 rounded text-sm ${getSeverityColor(selectedAccident.severity)}`}>
                    {selectedAccident.severity}
                  </span>
                </div>
                <div>
                  <p className="text-gray-600">Vehicle</p>
                  <p className="font-medium">{selectedAccident.registration_num}</p>
                </div>
                <div>
                  <p className="text-gray-600">Driver</p>
                  <p className="font-medium">{selectedAccident.driver_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Reported By</p>
                  <p className="font-medium">{selectedAccident.reported_by_name}</p>
                </div>
              </div>
            </div>

            {/* Investigation */}
            {selectedAccident.investigation && (
              <div className="bg-white p-6 rounded-xl shadow">
                <h3 className="text-lg font-semibold mb-4">🔍 Investigation</h3>
                <div className="space-y-4">
                  <p><span className="text-gray-600">Investigator:</span> {selectedAccident.investigation.investigator_name}</p>
                  <p><span className="text-gray-600">Scene Findings:</span> {selectedAccident.investigation.scene_findings}</p>
                </div>
              </div>
            )}

            {/* Root Cause */}
            {selectedAccident.rootCause && (
              <div className="bg-white p-6 rounded-xl shadow">
                <h3 className="text-lg font-semibold mb-4">🎯 Root Cause Analysis</h3>
                <div className="space-y-2">
                  <p><span className="text-gray-600">Primary Category:</span> {selectedAccident.rootCause.primary_category}</p>
                  <p><span className="text-gray-600">Primary Cause:</span> {selectedAccident.rootCause.primary_cause}</p>
                  {selectedAccident.rootCause.notes && (
                    <p><span className="text-gray-600">Notes:</span> {selectedAccident.rootCause.notes}</p>
                  )}
                </div>
              </div>
            )}

            {/* CAPA */}
            {selectedAccident.capa?.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow">
                <h3 className="text-lg font-semibold mb-4">✅ Corrective Actions</h3>
                <div className="space-y-4">
                  {selectedAccident.capa?.map((action: any) => (
                    <div key={action.id} className="border p-4 rounded-lg">
                      <p className="font-medium">{action.action_description}</p>
                      <div className="flex gap-4 text-sm mt-2">
                        <span className="text-gray-600">Responsible: {action.responsible_person_name}</span>
                        <span className={`px-2 py-1 rounded ${
                          action.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          action.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {action.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {selectedAccident.witnesses?.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow">
                <h4 className="font-semibold mb-3">👥 Witnesses</h4>
                <div className="space-y-3">
                  {selectedAccident.witnesses?.map((w: any) => (
                    <div key={w.id} className="text-sm">
                      <p className="font-medium">{w.witness_name}</p>
                      <p className="text-gray-500">{w.witness_contact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedAccident.evidence?.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow">
                <h4 className="font-semibold mb-3">📎 Evidence</h4>
                <div className="space-y-2">
                  {selectedAccident.evidence?.map((e: any) => (
                    <div key={e.id} className="text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded">{e.evidence_type}</span>
                      <p className="text-gray-500 mt-1">{e.file_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'analytics' && analytics) {
    const severityData = analytics.bySeverity?.map((s: any) => ({
      name: s.severity,
      value: parseInt(s.count)
    })) || [];

    const typeData = analytics.byType?.map((t: any) => ({
      name: t.accident_type,
      value: parseInt(t.count)
    })) || [];

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">📊 Accident Analytics</h2>
          <button onClick={() => setView('list')} className="text-gray-600">← Back</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-red-50 p-4 rounded-xl">
            <p className="text-gray-600">Total Accidents</p>
            <p className="text-3xl font-bold">{analytics.total || 0}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-xl">
            <p className="text-gray-600">Fatal</p>
            <p className="text-3xl font-bold">{analytics.bySeverity?.find((s: any) => s.severity === 'Fatal')?.count || 0}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl">
            <p className="text-gray-600">Major</p>
            <p className="text-3xl font-bold">{analytics.bySeverity?.find((s: any) => s.severity === 'Major')?.count || 0}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl">
            <p className="text-gray-600">Minor</p>
            <p className="text-3xl font-bold">{analytics.bySeverity?.find((s: any) => s.severity === 'Minor')?.count || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">By Severity</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={severityData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {severityData.map((_: any, i: number) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">By Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // List View (Default)
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-2xl font-bold">🚨 Accident Management</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setView('analytics')}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              📊 Analytics
            </button>
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <button
                onClick={() => setView('form')}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                + Report Accident
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <select
            value={filter.status}
            onChange={e => { setFilter({...filter, status: e.target.value}); fetchAccidents(); }}
            className="border p-2 rounded"
          >
            <option value="">All Statuses</option>
            <option>Reported</option>
            <option>Under Investigation</option>
            <option>Root Cause Identified</option>
            <option>CAPA In Progress</option>
            <option>Closed</option>
          </select>
          <select
            value={filter.severity}
            onChange={e => { setFilter({...filter, severity: e.target.value}); fetchAccidents(); }}
            className="border p-2 rounded"
          >
            <option value="">All Severities</option>
            <option>Minor</option>
            <option>Major</option>
            <option>Fatal</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">Case #</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Vehicle</th>
                <th className="text-left p-4">Driver</th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Severity</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center">Loading...</td></tr>
              ) : accidents.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No accidents reported</td></tr>
              ) : (
                accidents?.map(accident => (
                  <tr key={accident.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{accident.case_number}</td>
                    <td className="p-4">{new Date(accident.accident_date).toLocaleDateString()}</td>
                    <td className="p-4">{accident.registration_num}</td>
                    <td className="p-4">{accident.driver_name}</td>
                    <td className="p-4">{accident.accident_type}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(accident.severity)}`}>
                        {accident.severity}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(accident.status)}`}>
                        {accident.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => fetchAccidentDetails(accident.id)}
                        className="text-blue-600 hover:underline"
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ErrorBoundary>
  );
}
