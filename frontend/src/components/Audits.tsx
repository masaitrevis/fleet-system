import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface AuditsProps {
  apiUrl: string;
  user: any;
}

interface AuditSession {
  id: string;
  audit_number: string;
  template_name: string;
  branch: string;
  auditor_name: string;
  status: string;
  compliance_percentage: number;
  risk_level: string;
  audit_date: string;
}

interface AuditTemplate {
  id: string;
  template_name: string;
  questions: AuditQuestion[];
  question_count?: number;
}

interface AuditQuestion {
  id: string;
  module_name: string;
  question_text: string;
  requires_evidence: boolean;
}

const RISK_COLORS = {
  'Low': '#10B981',
  'Moderate': '#F59E0B',
  'High': '#EF4444',
  'Critical': '#7C3AED'
};

export default function Audits({ apiUrl, user }: AuditsProps) {
  const [view, setView] = useState<'list' | 'new' | 'conduct' | 'details' | 'analytics'>('list');
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // New audit form
  const [newAudit, setNewAudit] = useState({
    template_id: '',
    branch: '',
    department: '',
    vehicle_ids: [] as string[]
  });

  // Conduct audit
  const [currentResponses, setCurrentResponses] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchSessions();
    fetchTemplates();
    fetchAnalytics();
    fetchVehicles();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${apiUrl}/audits/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error('Failed to fetch sessions');
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${apiUrl}/audits/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setTemplates(await res.json());
    } catch (err) {
      console.error('Failed to fetch templates');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${apiUrl}/audits/analytics/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAnalytics(await res.json());
    } catch (err) {
      console.error('Failed to fetch analytics');
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await fetch(`${apiUrl}/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setVehicles(await res.json());
    } catch (err) {
      console.error('Failed to fetch vehicles');
    }
  };

  const fetchSessionDetails = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/audits/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedSession(await res.json());
        setView('details');
      }
    } catch (err) {
      console.error('Failed to fetch session details');
    }
  };

  const createAudit = async () => {
    try {
      const res = await fetch(`${apiUrl}/audits/sessions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAudit)
      });
      if (res.ok) {
        const session = await res.json();
        await fetchSessionDetails(session.id);
        setView('conduct');
      }
    } catch (err) {
      console.error('Failed to create audit');
    }
  };

  const submitResponses = async () => {
    if (!selectedSession) return;
    
    try {
      await fetch(`${apiUrl}/audits/sessions/${selectedSession.id}/responses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ responses: currentResponses })
      });

      // Complete audit
      const completeRes = await fetch(`${apiUrl}/audits/sessions/${selectedSession.id}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (completeRes.ok) {
        await fetchSessions();
        setView('list');
      }
    } catch (err) {
      console.error('Failed to submit audit');
    }
  };

  const getRiskBadge = (level: string) => {
    const colors: any = {
      'Low': 'bg-green-100 text-green-800',
      'Moderate': 'bg-yellow-100 text-yellow-800',
      'High': 'bg-orange-100 text-orange-800',
      'Critical': 'bg-red-100 text-red-800'
    };
    return colors[level] || 'bg-gray-100';
  };

  // Views
  if (view === 'new') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">📋 Start New Audit</h2>
          <button onClick={() => setView('list')} className="text-gray-600">← Back</button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium mb-1">Audit Template *</label>
            <select
              value={newAudit.template_id}
              onChange={e => setNewAudit({...newAudit, template_id: e.target.value})}
              className="w-full border p-2 rounded"
            >
              <option value="">Select Template</option>
              {templates?.map(t => (
                <option key={t.id} value={t.id}>{t.template_name} ({t.question_count || 0} questions)</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Branch</label>
              <input
                value={newAudit.branch}
                onChange={e => setNewAudit({...newAudit, branch: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="e.g., Nairobi HQ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <input
                value={newAudit.department}
                onChange={e => setNewAudit({...newAudit, department: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="e.g., Transport"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select Vehicles to Audit (Optional)</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto border p-4 rounded">
              {vehicles?.map(v => (
                <label key={v.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newAudit.vehicle_ids.includes(v.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setNewAudit({...newAudit, vehicle_ids: [...newAudit.vehicle_ids, v.id]});
                      } else {
                        setNewAudit({...newAudit, vehicle_ids: newAudit.vehicle_ids.filter(id => id !== v.id)});
                      }
                    }}
                  />
                  <span className="text-sm">{v.registration_num}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={createAudit}
              disabled={!newAudit.template_id}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Start Audit
            </button>
            <button onClick={() => setView('list')} className="bg-gray-300 px-6 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'conduct' && selectedSession) {
    const groupedQuestions = selectedSession.responses?.reduce((acc: any, r: any) => {
      if (!acc[r.module_name]) acc[r.module_name] = [];
      acc[r.module_name].push(r);
      return acc;
    }, {}) || {};

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <button onClick={() => setView('list')} className="text-gray-600 mb-2">← Cancel</button>
            <h2 className="text-2xl font-bold">Conducting Audit: {selectedSession.audit_number}</h2>
          </div>
          <button
            onClick={submitResponses}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            Complete Audit
          </button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <p><strong>Template:</strong> {selectedSession.template_name}</p>
          <p><strong>Branch:</strong> {selectedSession.branch || 'N/A'}</p>
          <p><strong>Auditor:</strong> {selectedSession.auditor_name}</p>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedQuestions || {}).map(([module, responses]: [string, any]) => (
            <div key={module} className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-semibold mb-4 text-blue-800">{module}</h3>
              <div className="space-y-4">
                {responses?.map((r: any, idx: number) => (
                  <div key={r.id} className="border-b pb-4 last:border-0">
                    <p className="font-medium mb-2">{idx + 1}. {r.question_text}</p>
                    <div className="flex flex-wrap gap-2">
                      {['Fully Compliant', 'Partially Compliant', 'Non Compliant', 'Not Applicable'].map(option => (
                        <button
                          key={option}
                          onClick={() => {
                            const existing = currentResponses.find((cr: any) => cr.response_id === r.id);
                            if (existing) {
                              existing.response = option;
                            } else {
                              setCurrentResponses([...currentResponses, {
                                response_id: r.id,
                                response: option,
                                notes: '',
                                evidence_attached: false
                              }]);
                            }
                          }}
                          className={`px-4 py-2 rounded text-sm ${
                            (currentResponses.find((cr: any) => cr.response_id === r.id)?.response === option)
                              ? option === 'Fully Compliant' ? 'bg-green-600 text-white' :
                                option === 'Partially Compliant' ? 'bg-yellow-500 text-white' :
                                option === 'Non Compliant' ? 'bg-red-600 text-white' :
                                'bg-gray-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {r.requires_evidence && (
                      <p className="text-sm text-orange-600 mt-1">📎 Evidence required</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'details' && selectedSession) {
    const groupedResponses = selectedSession.responses?.reduce((acc: any, r: any) => {
      if (!acc[r.module_name]) acc[r.module_name] = [];
      acc[r.module_name].push(r);
      return acc;
    }, {}) || {};

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <button onClick={() => setView('list')} className="text-gray-600 mb-2">← Back</button>
            <h2 className="text-2xl font-bold">Audit Report: {selectedSession.audit_number}</h2>
          </div>
          <div className="flex gap-3">
            <span className={`px-4 py-2 rounded-full ${getRiskBadge(selectedSession.risk_level)}`}>
              {selectedSession.risk_level} Risk
            </span>
            <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full">
              {Number(selectedSession.compliance_percentage || 0).toFixed(1)}% Compliant
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-gray-600">Template</p>
            <p className="font-medium">{selectedSession.template_name}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-gray-600">Branch</p>
            <p className="font-medium">{selectedSession.branch || 'N/A'}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-gray-600">Auditor</p>
            <p className="font-medium">{selectedSession.auditor_name}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-gray-600">Date</p>
            <p className="font-medium">{new Date(selectedSession.audit_date).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedResponses || {}).map(([module, responses]: [string, any]) => {
            const moduleScore = responses?.reduce((sum: number, r: any) => sum + (r.score > 0 ? r.score : 0), 0) || 0;
            const moduleMax = responses?.reduce((sum: number, r: any) => sum + (r.score >= 0 ? r.max_score : 0), 0) || 0;
            const percentage = moduleMax > 0 ? (moduleScore / moduleMax) * 100 : 0;

            return (
              <div key={module} className="bg-white p-6 rounded-xl shadow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">{module}</h3>
                  <span className={`px-3 py-1 rounded ${
                    percentage >= 85 ? 'bg-green-100 text-green-800' :
                    percentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                    percentage >= 50 ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-3">
                  {responses?.map((r: any, idx: number) => (
                    <div key={r.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm">{idx + 1}. {r.question_text}</p>
                        {r.notes && <p className="text-xs text-gray-500 mt-1">Notes: {r.notes}</p>}
                      </div>
                      <span className={`px-3 py-1 rounded text-sm ${
                        r.response === 'Fully Compliant' ? 'bg-green-100 text-green-800' :
                        r.response === 'Partially Compliant' ? 'bg-yellow-100 text-yellow-800' :
                        r.response === 'Non Compliant' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {r.response || 'Not Answered'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {selectedSession.correctiveActions?.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">📝 Corrective Actions</h3>
            <div className="space-y-3">
              {selectedSession.correctiveActions?.map((action: any) => (
                <div key={action.id} className="border p-4 rounded-lg">
                  <p className="font-medium">{action.issue_identified}</p>
                  <div className="flex gap-4 text-sm mt-2">
                    <span>Responsible: {action.responsible_person_name || 'N/A'}</span>
                    <span>Deadline: {action.deadline ? new Date(action.deadline).toLocaleDateString() : 'N/A'}</span>
                    <span className={`px-2 py-1 rounded ${
                      action.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      action.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>{action.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'analytics' && analytics) {
    const riskData = [
      { name: 'Low', value: analytics.overall?.low_count || 0 },
      { name: 'Moderate', value: analytics.overall?.moderate_count || 0 },
      { name: 'High', value: analytics.overall?.high_count || 0 },
      { name: 'Critical', value: analytics.overall?.critical_count || 0 }
    ].filter(d => d.value > 0);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">📊 Audit Analytics</h2>
          <button onClick={() => setView('list')} className="text-gray-600">← Back</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-xl">
            <p className="text-gray-600">Total Audits</p>
            <p className="text-3xl font-bold">{analytics.overall?.total_audits || 0}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl">
            <p className="text-gray-600">Avg Compliance</p>
            <p className="text-3xl font-bold">{parseFloat(analytics.overall?.avg_compliance || 0).toFixed(1)}%</p>
          </div>
          <div className="bg-red-50 p-4 rounded-xl">
            <p className="text-gray-600">Critical Audits</p>
            <p className="text-3xl font-bold">{analytics.overall?.critical_count || 0}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-xl">
            <p className="text-gray-600">High Risk</p>
            <p className="text-3xl font-bold">{analytics.overall?.high_count || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={riskData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {riskData.map((entry: any) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name as keyof typeof RISK_COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-4">Module Compliance</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.byModule || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="module_name" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="avg_score" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-2xl font-bold">📋 Fleet Operations Audit</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setView('analytics')}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            📊 Analytics
          </button>
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'auditor') && (
            <button
              onClick={() => setView('new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + New Audit
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Audit #</th>
              <th className="text-left p-4">Template</th>
              <th className="text-left p-4">Branch</th>
              <th className="text-left p-4">Auditor</th>
              <th className="text-left p-4">Compliance</th>
              <th className="text-left p-4">Risk Level</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No audits conducted yet</td></tr>
            ) : (
              sessions?.map(session => (
                <tr key={session.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-medium">{session.audit_number}</td>
                  <td className="p-4">{session.template_name}</td>
                  <td className="p-4">{session.branch || 'N/A'}</td>
                  <td className="p-4">{session.auditor_name}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            (session.compliance_percentage || 0) >= 85 ? 'bg-green-500' :
                            (session.compliance_percentage || 0) >= 70 ? 'bg-yellow-500' :
                            (session.compliance_percentage || 0) >= 50 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${session.compliance_percentage || 0}%` }}
                        />
                      </div>
                      <span className="text-sm">{Number(session.compliance_percentage || 0).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${getRiskBadge(session.risk_level)}`}>
                      {session.risk_level}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-sm ${
                      session.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => fetchSessionDetails(session.id)}
                      className="text-blue-600 hover:underline"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
