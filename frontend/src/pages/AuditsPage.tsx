import { useState, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { allAuditTemplates, getMaturityRating } from '../../../shared/auditTemplates';

interface AuditsPageProps {
  apiUrl: string;
  user: any;
}

interface AuditSession {
  id: string;
  audit_number: string;
  template_id: string;
  template_name: string;
  branch: string;
  department: string;
  auditor_id: string;
  auditor_name: string;
  status: 'Draft' | 'In Progress' | 'Completed' | 'Cancelled';
  total_score: number;
  max_possible_score: number;
  compliance_percentage: number;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical';
  maturity_rating: string;
  audit_date: string;
  completed_at: string | null;
  created_at: string;
  responses_count?: number;
}

interface AuditAnalytics {
  overall: {
    total_audits: number;
    avg_compliance: number;
    avg_score: number;
    low_count: number;
    moderate_count: number;
    high_count: number;
    critical_count: number;
  };
  byTemplate: Array<{
    template_id: string;
    template_name: string;
    audit_count: number;
    avg_score: number;
    avg_compliance: number;
  }>;
  trend: Array<{
    month: string;
    avg_compliance: number;
    audit_count: number;
  }>;
  maturityDistribution: Array<{
    rating: string;
    count: number;
  }>;
}

const RISK_COLORS: Record<string, string> = {
  'Low': '#10B981',
  'Moderate': '#F59E0B',
  'High': '#EF4444',
  'Critical': '#7C3AED'
};

const MATURITY_COLORS: Record<string, string> = {
  'World Class': '#10B981',
  'Strong': '#3B82F6',
  'Developing': '#F59E0B',
  'Weak': '#EF4444',
  'High Risk': '#7C3AED'
};

export default function AuditsPage({ apiUrl, user }: AuditsPageProps) {
  const [view, setView] = useState<'list' | 'new' | 'analytics'>('list');
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [analytics, setAnalytics] = useState<AuditAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [templateFilter, setTemplateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // New audit form
  const [newAudit, setNewAudit] = useState({
    template_id: '',
    branch: '',
    department: ''
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchSessions();
    fetchAnalytics();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (templateFilter) params.append('template_id', templateFilter);
      
      const res = await fetch(`${apiUrl}/audits/sessions?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${apiUrl}/audits/analytics/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (err: any) {
      console.error('Analytics error:', err);
    }
  };

  const createAudit = async () => {
    if (!newAudit.template_id) {
      alert('Please select an audit template');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/audits/sessions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAudit)
      });

      if (!res.ok) throw new Error('Failed to create audit');
      const session = await res.json();
      
      // Navigate to audit detail page
      window.location.href = `/audits/${session.id}`;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const deleteAudit = async (id: string) => {
    if (!confirm('Are you sure you want to delete this audit? This action cannot be undone.')) return;
    
    try {
      const res = await fetch(`${apiUrl}/audits/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to delete audit');
      fetchSessions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const exportPDF = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/audits/sessions/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to generate PDF');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getRiskBadge = (level: string) => {
    const colors: Record<string, string> = {
      'Low': 'bg-green-100 text-green-800 border-green-200',
      'Moderate': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'High': 'bg-orange-100 text-orange-800 border-orange-200',
      'Critical': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'Draft': 'bg-gray-100 text-gray-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'Completed': 'bg-green-100 text-green-800',
      'Cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100';
  };

  const getMaturityBadge = (rating: string) => {
    const colors: Record<string, string> = {
      'World Class': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Strong': 'bg-blue-100 text-blue-800 border-blue-200',
      'Developing': 'bg-amber-100 text-amber-800 border-amber-200',
      'Weak': 'bg-red-100 text-red-800 border-red-200',
      'High Risk': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[rating] || 'bg-gray-100 text-gray-800';
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.audit_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.template_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.branch?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.auditor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Analytics View
  if (view === 'analytics' && analytics) {
    const riskData = [
      { name: 'Low', value: analytics.overall?.low_count || 0, color: RISK_COLORS['Low'] },
      { name: 'Moderate', value: analytics.overall?.moderate_count || 0, color: RISK_COLORS['Moderate'] },
      { name: 'High', value: analytics.overall?.high_count || 0, color: RISK_COLORS['High'] },
      { name: 'Critical', value: analytics.overall?.critical_count || 0, color: RISK_COLORS['Critical'] }
    ].filter(d => d.value > 0);

    const maturityData = analytics.maturityDistribution?.map(d => ({
      name: d.rating,
      value: d.count,
      color: MATURITY_COLORS[d.rating] || '#9CA3AF'
    })) || [];

    const radarData = analytics.byTemplate?.map(t => ({
      subject: t.template_name.split(' ')[0],
      A: Math.round(t.avg_compliance || 0),
      fullMark: 100
    })) || [];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📊 Audit Analytics Dashboard</h2>
            <p className="text-gray-500 mt-1">Comprehensive fleet audit performance metrics</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back to List
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Audits</p>
                <p className="text-3xl font-bold text-gray-900">{analytics.overall?.total_audits || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Compliance</p>
                <p className="text-3xl font-bold text-gray-900">{parseFloat(analytics.overall?.avg_compliance || 0).toFixed(1)}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <span className="text-2xl">📈</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Score</p>
                <p className="text-3xl font-bold text-gray-900">{parseFloat(analytics.overall?.avg_score || 0).toFixed(1)}/200</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Critical Risk</p>
                <p className="text-3xl font-bold text-gray-900">{analytics.overall?.critical_count || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Distribution */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Risk Level Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie 
                  data={riskData} 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={100} 
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Maturity Distribution */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Maturity Rating Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie 
                  data={maturityData} 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={100} 
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {maturityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compliance Trend */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Compliance Trend (12 Months)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics.trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Compliance']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                />
                <Line 
                  type="monotone" 
                  dataKey="avg_compliance" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Template Performance Radar */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Performance by Template</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar
                  name="Compliance %"
                  dataKey="A"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
                <Tooltip formatter={(value: any) => [`${Number(value).toFixed(0)}%`, 'Compliance']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Template Breakdown Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Performance by Audit Template</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-700">Template</th>
                  <th className="text-center p-4 font-medium text-gray-700">Audits</th>
                  <th className="text-center p-4 font-medium text-gray-700">Avg Score</th>
                  <th className="text-center p-4 font-medium text-gray-700">Compliance %</th>
                  <th className="text-center p-4 font-medium text-gray-700">Trend</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byTemplate?.map((template, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{template.template_name}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {template.audit_count}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-medium">{parseFloat(template.avg_score?.toString() || '0').toFixed(1)}/20</span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              (template.avg_compliance || 0) >= 85 ? 'bg-green-500' :
                              (template.avg_compliance || 0) >= 70 ? 'bg-yellow-500' :
                              (template.avg_compliance || 0) >= 50 ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(template.avg_compliance || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12">{parseFloat(template.avg_compliance?.toString() || '0').toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {(template.avg_compliance || 0) >= 85 ? (
                        <span className="text-green-600">↑ Strong</span>
                      ) : (template.avg_compliance || 0) >= 70 ? (
                        <span className="text-yellow-600">→ Stable</span>
                      ) : (
                        <span className="text-red-600">↓ Needs Attention</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maturity Rating Guide */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Maturity Rating Scale</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="font-semibold text-emerald-800">World Class</span>
              </div>
              <p className="text-sm text-gray-600">170-200 points</p>
              <p className="text-xs text-gray-500 mt-1">Exemplary practices with continuous improvement</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="font-semibold text-blue-800">Strong</span>
              </div>
              <p className="text-sm text-gray-600">140-169 points</p>
              <p className="text-xs text-gray-500 mt-1">Well-established processes with good governance</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="font-semibold text-amber-800">Developing</span>
              </div>
              <p className="text-sm text-gray-600">100-139 points</p>
              <p className="text-xs text-gray-500 mt-1">Basic systems in place, needing development</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="font-semibold text-red-800">Weak</span>
              </div>
              <p className="text-sm text-gray-600">60-99 points</p>
              <p className="text-xs text-gray-500 mt-1">Significant gaps requiring immediate attention</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="font-semibold text-purple-800">High Risk</span>
              </div>
              <p className="text-sm text-gray-600">Below 60 points</p>
              <p className="text-xs text-gray-500 mt-1">Critical deficiencies with substantial risks</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // New Audit View
  if (view === 'new') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📋 Start New Audit</h2>
            <p className="text-gray-500 mt-1">Select a template to begin a comprehensive fleet audit</p>
          </div>
          <button 
            onClick={() => setView('list')} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Back to List
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-3xl">
          <div className="space-y-6">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audit Template <span className="text-red-500">*</span>
              </label>
              <select
                value={newAudit.template_id}
                onChange={e => setNewAudit({...newAudit, template_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an audit template...</option>
                {allAuditTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.template_name} ({template.questions.length} questions)
                  </option>
                ))}
              </select>
              {newAudit.template_id && (
                <p className="mt-2 text-sm text-gray-600">
                  {allAuditTemplates.find(t => t.id === newAudit.template_id)?.description}
                </p>
              )}
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch / Location
              </label>
              <input
                type="text"
                value={newAudit.branch}
                onChange={e => setNewAudit({...newAudit, branch: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Nairobi HQ, Mombasa Branch"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <input
                type="text"
                value={newAudit.department}
                onChange={e => setNewAudit({...newAudit, department: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Transport, Operations, Logistics"
              />
            </div>

            {/* Selected Template Preview */}
            {newAudit.template_id && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Template Overview</h4>
                {allAuditTemplates
                  .filter(t => t.id === newAudit.template_id)
                  .map(template => (
                    <div key={template.id} className="space-y-2">
                      <p className="text-sm text-blue-800">
                        <strong>Category:</strong> {template.category}
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>Questions:</strong> {template.questions.length}
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>Max Score:</strong> {template.questions.length * 2} points
                      </p>
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-xs text-blue-600 font-medium mb-1">Scoring System:</p>
                        <ul className="text-xs text-blue-600 space-y-1">
                          <li>• 0 = Not Implemented</li>
                          <li>• 1 = Partially Implemented</li>
                          <li>• 2 = Fully Implemented</li>
                        </ul>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={createAudit}
                disabled={!newAudit.template_id || loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Creating...' : 'Start Audit'}
              </button>
              <button 
                onClick={() => setView('list')} 
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* All Templates Info */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Available Audit Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allAuditTemplates.map(template => (
              <div 
                key={template.id} 
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  newAudit.template_id === template.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setNewAudit({...newAudit, template_id: template.id})}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                    newAudit.template_id === template.id 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-gray-300'
                  }`}>
                    {newAudit.template_id === template.id && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{template.template_name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{template.questions.length} questions</span>
                      <span>{template.category}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // List View (Default)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📋 Fleet Audits</h2>
          <p className="text-gray-500 mt-1">Comprehensive fleet management assessments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setView('analytics')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            📊 Analytics
          </button>
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'auditor') && (
            <button
              onClick={() => setView('new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + New Audit
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search audits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); fetchSessions(); }}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            value={templateFilter}
            onChange={(e) => { setTemplateFilter(e.target.value); fetchSessions(); }}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Templates</option>
            {allAuditTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.template_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Audits Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading audits...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">
            <p>Error: {error}</p>
            <button 
              onClick={fetchSessions}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No audits found</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || statusFilter || templateFilter 
                ? 'Try adjusting your filters'
                : 'Start your first fleet audit to assess compliance and maturity'
              }
            </p>
            {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'auditor') && (
              <button
                onClick={() => setView('new')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                + Create First Audit
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-700">Audit #</th>
                  <th className="text-left p-4 font-medium text-gray-700">Template</th>
                  <th className="text-left p-4 font-medium text-gray-700">Location</th>
                  <th className="text-left p-4 font-medium text-gray-700">Auditor</th>
                  <th className="text-center p-4 font-medium text-gray-700">Score</th>
                  <th className="text-center p-4 font-medium text-gray-700">Risk</th>
                  <th className="text-center p-4 font-medium text-gray-700">Maturity</th>
                  <th className="text-center p-4 font-medium text-gray-700">Status</th>
                  <th className="text-center p-4 font-medium text-gray-700">Date</th>
                  <th className="text-center p-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map(session => {
                  const maturity = getMaturityRating(session.total_score || 0);
                  return (
                    <tr key={session.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{session.audit_number}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-gray-900">{session.template_name}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-gray-900">{session.branch || 'N/A'}</div>
                        {session.department && (
                          <div className="text-xs text-gray-500">{session.department}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-gray-900">{session.auditor_name || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        {session.status === 'Completed' ? (
                          <div className="text-center">
                            <div className="font-medium">{session.total_score || 0}/200</div>
                            <div className="text-xs text-gray-500">{session.compliance_percentage?.toFixed(0)}%</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {session.status === 'Completed' ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskBadge(session.risk_level)}`}>
                            {session.risk_level}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {session.status === 'Completed' ? (
                          <span 
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMaturityBadge(session.maturity_rating || maturity.rating)}`}
                          >
                            {session.maturity_rating || maturity.rating}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(session.status)}`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="p-4 text-center text-sm text-gray-600">
                        {new Date(session.audit_date || session.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <a
                            href={`/audits/${session.id}`}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                          >
                            {session.status === 'Completed' ? 'View' : 'Continue'}
                          </a>
                          {session.status === 'Completed' && (
                            <button
                              onClick={() => exportPDF(session.id)}
                              className="px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                              title="Download PDF"
                            >
                              📄
                            </button>
                          )}
                          {(user?.role === 'admin' || user?.id === session.auditor_id) && session.status !== 'Completed' && (
                            <button
                              onClick={() => deleteAudit(session.id)}
                              className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {filteredSessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">Total Audits</p>
            <p className="text-2xl font-bold text-gray-900">{filteredSessions.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredSessions.filter(s => s.status === 'Completed').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">
              {filteredSessions.filter(s => s.status === 'In Progress').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">Avg Score</p>
            <p className="text-2xl font-bold text-purple-600">
              {filteredSessions.filter(s => s.status === 'Completed').length > 0
                ? (filteredSessions
                    .filter(s => s.status === 'Completed')
                    .reduce((sum, s) => sum + (s.total_score || 0), 0) / 
                   filteredSessions.filter(s => s.status === 'Completed').length
                  ).toFixed(0)
                : 0}/200
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
