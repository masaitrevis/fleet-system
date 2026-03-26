import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { allAuditTemplates, getMaturityRating } from '../../../shared/auditTemplates';

interface AuditDetailPageProps {
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
}

interface AuditResponse {
  id: string;
  question_id: string;
  question_text: string;
  module_name: string;
  question_order: number;
  score: number;
  max_score: number;
  notes: string;
  requires_evidence: boolean;
  evidence_attached: boolean;
  evidence_urls?: string[];
}

interface CorrectiveAction {
  id: string;
  issue_identified: string;
  corrective_action: string;
  responsible_person_id: string;
  responsible_person_name: string;
  deadline: string;
  status: 'Open' | 'In Progress' | 'Completed' | 'Overdue';
  completed_at: string | null;
  completion_notes: string;
}

const SCORE_OPTIONS = [
  { value: 0, label: 'Not Implemented', color: '#EF4444' },
  { value: 1, label: 'Partially Implemented', color: '#F59E0B' },
  { value: 2, label: 'Fully Implemented', color: '#10B981' }
];

const RISK_COLORS: Record<string, string> = {
  'Low': '#10B981',
  'Moderate': '#F59E0B',
  'High': '#EF4444',
  'Critical': '#7C3AED'
};

export default function AuditDetailPage({ apiUrl, user }: AuditDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AuditSession | null>(null);
  const [responses, setResponses] = useState<AuditResponse[]>([]);
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'summary' | 'actions'>('questions');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  
  // New corrective action form
  const [showActionForm, setShowActionForm] = useState(false);
  const [newAction, setNewAction] = useState({
    response_id: '',
    issue_identified: '',
    corrective_action: '',
    responsible_person_id: '',
    deadline: ''
  });

  const token = localStorage.getItem('token');

  const fetchAuditData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/audits/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch audit session');
      const data = await res.json();
      
      setSession(data);
      setResponses(data.responses || []);
      setCorrectiveActions(data.correctiveActions || []);
      
      // Expand all modules by default
      const modules = new Set((data.responses || []).map((r: AuditResponse) => r.module_name));
      setExpandedModules(modules);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, apiUrl, token]);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  const updateResponse = async (responseId: string, score: number, notes: string) => {
    try {
      const res = await fetch(`${apiUrl}/audits/responses/${responseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ score, notes })
      });
      
      if (!res.ok) throw new Error('Failed to update response');
      
      // Update local state
      setResponses(prev => prev.map(r => 
        r.id === responseId ? { ...r, score, notes } : r
      ));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const completeAudit = async () => {
    if (!id) return;
    
    // Check if all questions have been scored
    const unanswered = responses.filter(r => r.score === null || r.score === undefined);
    if (unanswered.length > 0) {
      if (!confirm(`${unanswered.length} questions are not scored. Continue with completion?`)) return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/audits/sessions/${id}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to complete audit');
      
      const result = await res.json();
      
      // Refresh data
      await fetchAuditData();
      setActiveTab('summary');
      
      alert(`Audit completed!\nScore: ${result.totalScore}/200\nCompliance: ${result.compliancePercentage.toFixed(1)}%\nRating: ${result.maturityRating}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createCorrectiveAction = async () => {
    if (!id || !newAction.response_id || !newAction.issue_identified) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/audits/sessions/${id}/corrective-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAction)
      });
      
      if (!res.ok) throw new Error('Failed to create corrective action');
      
      // Refresh data
      fetchAuditData();
      setShowActionForm(false);
      setNewAction({
        response_id: '',
        issue_identified: '',
        corrective_action: '',
        responsible_person_id: '',
        deadline: ''
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const updateActionStatus = async (actionId: string, status: string, completionNotes: string = '') => {
    try {
      const res = await fetch(`${apiUrl}/audits/corrective-actions/${actionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, completion_notes: completionNotes })
      });
      
      if (!res.ok) throw new Error('Failed to update action');
      fetchAuditData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const exportPDF = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${apiUrl}/audits/sessions/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to generate PDF');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${session?.audit_number || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleName)) {
        next.delete(moduleName);
      } else {
        next.add(moduleName);
      }
      return next;
    });
  };

  const getModuleProgress = (moduleName: string) => {
    const moduleResponses = responses.filter(r => r.module_name === moduleName);
    const answered = moduleResponses.filter(r => r.score !== null && r.score !== undefined).length;
    return { answered, total: moduleResponses.length };
  };

  // Group responses by module
  const groupedResponses = responses.reduce((acc, response) => {
    if (!acc[response.module_name]) {
      acc[response.module_name] = [];
    }
    acc[response.module_name].push(response);
    return acc;
  }, {} as Record<string, AuditResponse[]>);

  // Calculate scores
  const totalScore = responses.reduce((sum, r) => sum + (r.score || 0), 0);
  const maxPossibleScore = responses.length * 2;
  const compliancePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
  const maturity = getMaturityRating(totalScore);

  // Calculate module scores
  const moduleScores = Object.entries(groupedResponses).map(([moduleName, moduleResponses]) => {
    const moduleScore = moduleResponses.reduce((sum, r) => sum + (r.score || 0), 0);
    const moduleMax = moduleResponses.length * 2;
    const modulePercentage = moduleMax > 0 ? (moduleScore / moduleMax) * 100 : 0;
    return {
      name: moduleName,
      score: moduleScore,
      max: moduleMax,
      percentage: modulePercentage,
      responses: moduleResponses
    };
  });

  // Chart data
  const scoreDistribution = [
    { name: 'Not Implemented', value: responses.filter(r => r.score === 0).length, color: '#EF4444' },
    { name: 'Partially Implemented', value: responses.filter(r => r.score === 1).length, color: '#F59E0B' },
    { name: 'Fully Implemented', value: responses.filter(r => r.score === 2).length, color: '#10B981' }
  ].filter(d => d.value > 0);

  const radarData = moduleScores.map(m => ({
    subject: m.name.length > 20 ? m.name.substring(0, 20) + '...' : m.name,
    A: Math.round(m.percentage),
    fullMark: 100
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading audit session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error || 'Audit not found'}</p>
          <button 
            onClick={() => navigate('/audits')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            ← Back to Audits
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = session.status === 'Completed';
  const canEdit = !isCompleted && (user?.role === 'admin' || user?.id === session.auditor_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <button 
            onClick={() => navigate('/audits')}
            className="text-gray-500 hover:text-gray-700 mb-2"
          >
            ← Back to Audits
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            {session.audit_number}
          </h2>
          <p className="text-gray-500">{session.template_name}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isCompleted && (
            <button
              onClick={exportPDF}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📄 Download PDF
            </button>
          )}
          {canEdit && (
            <button
              onClick={completeAudit}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : '✓ Complete Audit'}
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Branch</p>
          <p className="text-lg font-medium text-gray-900">{session.branch || 'N/A'}</p>
          {session.department && (
            <p className="text-sm text-gray-500">{session.department}</p>
          )}
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Auditor</p>
          <p className="text-lg font-medium text-gray-900">{session.auditor_name || 'N/A'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Status</p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
            session.status === 'Completed' ? 'bg-green-100 text-green-800' :
            session.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {session.status}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Date</p>
          <p className="text-lg font-medium text-gray-900">
            {new Date(session.audit_date || session.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Score Summary (Always visible) */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Total Score</p>
            <p className="text-4xl font-bold text-gray-900">
              {isCompleted ? session.total_score : totalScore}/200
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Compliance</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${
                    (isCompleted ? session.compliance_percentage : compliancePercentage) >= 85 ? 'bg-green-500' :
                    (isCompleted ? session.compliance_percentage : compliancePercentage) >= 70 ? 'bg-yellow-500' :
                    (isCompleted ? session.compliance_percentage : compliancePercentage) >= 50 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(isCompleted ? session.compliance_percentage : compliancePercentage, 100)}%` }}
                />
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {(isCompleted ? session.compliance_percentage : compliancePercentage).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Risk Level</p>
            <span 
              className="inline-flex items-center px-4 py-1 rounded-full text-lg font-medium"
              style={{ 
                backgroundColor: `${RISK_COLORS[isCompleted ? session.risk_level : maturity.rating === 'World Class' ? 'Low' : maturity.rating === 'Strong' ? 'Low' : maturity.rating === 'Developing' ? 'Moderate' : maturity.rating === 'Weak' ? 'High' : 'Critical']}20`,
                color: RISK_COLORS[isCompleted ? session.risk_level : maturity.rating === 'World Class' ? 'Low' : maturity.rating === 'Strong' ? 'Low' : maturity.rating === 'Developing' ? 'Moderate' : maturity.rating === 'Weak' ? 'High' : 'Critical']
              }}
            >
              {isCompleted ? session.risk_level : maturity.rating === 'World Class' ? 'Low' : maturity.rating === 'Strong' ? 'Low' : maturity.rating === 'Developing' ? 'Moderate' : maturity.rating === 'Weak' ? 'High' : 'Critical'}
            </span>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Maturity Rating</p>
            <span 
              className="inline-flex items-center px-4 py-1 rounded-full text-lg font-medium"
              style={{ backgroundColor: `${maturity.color}20`, color: maturity.color }}
            >
              {isCompleted ? session.maturity_rating : maturity.rating}
            </span>
          </div>
        </div>
        
        {!isCompleted && (
          <p className="text-center text-sm text-gray-500 mt-4">
            ⚠️ This is a live preview. Scores will be finalized when you complete the audit.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { key: 'questions', label: 'Questions', icon: '📝' },
            { key: 'summary', label: 'Summary & Charts', icon: '📊' },
            { key: 'actions', label: 'Corrective Actions', icon: '✅' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.key === 'actions' && correctiveActions.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">
                  {correctiveActions.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {Object.entries(groupedResponses).map(([moduleName, moduleResponses]) => {
              const progress = getModuleProgress(moduleName);
              const isExpanded = expandedModules.has(moduleName);
              const moduleScore = moduleResponses.reduce((sum, r) => sum + (r.score || 0), 0);
              const moduleMax = moduleResponses.length * 2;
              const modulePercentage = moduleMax > 0 ? (moduleScore / moduleMax) * 100 : 0;
              
              return (
                <div key={moduleName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleModule(moduleName)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{moduleName}</h3>
                        <p className="text-sm text-gray-500">
                          {progress.answered} of {progress.total} questions scored
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{moduleScore}/{moduleMax} points</p>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                modulePercentage >= 85 ? 'bg-green-500' :
                                modulePercentage >= 70 ? 'bg-yellow-500' :
                                modulePercentage >= 50 ? 'bg-orange-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(modulePercentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12">{modulePercentage.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {moduleResponses.map((response, idx) => (
                        <div key={response.id} className="p-6">
                          <div className="flex items-start gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-gray-900 mb-4">{response.question_text}</p>
                              
                              <div className="flex flex-wrap gap-2 mb-4">
                                {SCORE_OPTIONS.map(option => (
                                  <button
                                    key={option.value}
                                    disabled={!canEdit}
                                    onClick={() => updateResponse(response.id, option.value, response.notes || '')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                      response.score === option.value
                                        ? 'ring-2 ring-offset-2'
                                        : 'hover:bg-gray-100'
                                    }`}
                                    style={{
                                      backgroundColor: response.score === option.value ? option.color : 'transparent',
                                      color: response.score === option.value ? 'white' : option.color,
                                      border: `1px solid ${option.color}`,
                                      ringColor: option.value
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                              
                              {response.requires_evidence && (
                                <div className="flex items-center gap-2 text-amber-600 text-sm mb-3">
                                  <span>📎</span>
                                  <span>Evidence required for this question</span>
                                </div>
                              )}
                              
                              <textarea
                                disabled={!canEdit}
                                value={response.notes || ''}
                                onChange={(e) => updateResponse(response.id, response.score || 0, e.target.value)}
                                placeholder="Add notes or comments..."
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                                rows={2}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Module Performance */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Module Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={moduleScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Compliance']} />
                  <Bar dataKey="percentage" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Score Distribution */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Score Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie 
                      data={scoreDistribution} 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={80} 
                      dataKey="value"
                      label={({ name, value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {scoreDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Radar Chart */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Performance Radar</h3>
                <ResponsiveContainer width="100%" height={250}>
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

            {/* Module Details Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Detailed Module Scores</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-700">Module</th>
                      <th className="text-center p-4 font-medium text-gray-700">Score</th>
                      <th className="text-center p-4 font-medium text-gray-700">Max</th>
                      <th className="text-center p-4 font-medium text-gray-700">Compliance</th>
                      <th className="text-center p-4 font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleScores.map((module) => (
                      <tr key={module.name} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium text-gray-900">{module.name}</td>
                        <td className="p-4 text-center">{module.score}</td>
                        <td className="p-4 text-center">{module.max}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  module.percentage >= 85 ? 'bg-green-500' :
                                  module.percentage >= 70 ? 'bg-yellow-500' :
                                  module.percentage >= 50 ? 'bg-orange-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(module.percentage, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm">{module.percentage.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            module.percentage >= 85 ? 'bg-green-100 text-green-800' :
                            module.percentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                            module.percentage >= 50 ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {module.percentage >= 85 ? 'Strong' :
                             module.percentage >= 70 ? 'Developing' :
                             module.percentage >= 50 ? 'Needs Attention' :
                             'Critical'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Maturity Rating Info */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Maturity Rating Guide</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { range: '170-200', rating: 'World Class', color: '#10B981', desc: 'Exemplary practices' },
                  { range: '140-169', rating: 'Strong', color: '#3B82F6', desc: 'Well-established' },
                  { range: '100-139', rating: 'Developing', color: '#F59E0B', desc: 'Basic systems' },
                  { range: '60-99', rating: 'Weak', color: '#EF4444', desc: 'Significant gaps' },
                  { range: '0-59', rating: 'High Risk', color: '#7C3AED', desc: 'Critical deficiencies' }
                ].map(item => (
                  <div key={item.rating} className="bg-white p-4 rounded-lg border"
                       style={{ borderColor: `${item.color}40` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="font-semibold text-sm" style={{ color: item.color }}>{item.rating}</span>
                    </div>
                    <p className="text-sm text-gray-600">{item.range} pts</p>
                    <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-6">
            {/* Create Action Button */}
            {canEdit && (
              <div className="flex justify-end">
                <button
                  onClick={() => setShowActionForm(!showActionForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {showActionForm ? 'Cancel' : '+ Add Corrective Action'}
                </button>
              </div>
            )}

            {/* New Action Form */}
            {showActionForm && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">New Corrective Action</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Related Question</label>
                    <select
                      value={newAction.response_id}
                      onChange={e => setNewAction({...newAction, response_id: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    >
                      <option value="">Select a question...</option>
                      {responses.filter(r => r.score < 2).map(response => (
                        <option key={response.id} value={response.id}>
                          [{response.module_name}] {response.question_text.substring(0, 80)}...
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Identified</label>
                    <textarea
                      value={newAction.issue_identified}
                      onChange={e => setNewAction({...newAction, issue_identified: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      rows={2}
                      placeholder="Describe the issue that needs to be addressed..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Corrective Action</label>
                    <textarea
                      value={newAction.corrective_action}
                      onChange={e => setNewAction({...newAction, corrective_action: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      rows={2}
                      placeholder="Describe the action to be taken..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                      <input
                        type="date"
                        value={newAction.deadline}
                        onChange={e => setNewAction({...newAction, deadline: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={createCorrectiveAction}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Create Action
                    </button>
                    <button
                      onClick={() => setShowActionForm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Actions List */}
            {correctiveActions.length === 0 ? (
              <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Corrective Actions</h3>
                <p className="text-gray-500">All audit findings have been addressed or no actions have been created yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {correctiveActions.map(action => (
                  <div key={action.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-gray-900">{action.issue_identified}</h4>
                        <p className="text-sm text-gray-500 mt-1">{action.corrective_action}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        action.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        action.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        action.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {action.status}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <div>
                        <span className="font-medium">Responsible:</span> {action.responsible_person_name || 'Unassigned'}
                      </div>
                      <div>
                        <span className="font-medium">Deadline:</span>{' '}
                        {action.deadline ? new Date(action.deadline).toLocaleDateString() : 'Not set'}
                      </div>
                      {action.completed_at && (
                        <div>
                          <span className="font-medium">Completed:</span>{' '}
                          {new Date(action.completed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    
                    {action.completion_notes && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                        <span className="font-medium">Completion Notes:</span> {action.completion_notes}
                      </div>
                    )}
                    
                    {canEdit && action.status !== 'Completed' && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => updateActionStatus(action.id, 'In Progress')}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          Mark In Progress
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt('Enter completion notes:');
                            if (notes !== null) {
                              updateActionStatus(action.id, 'Completed', notes);
                            }
                          }}
                          className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100"
                        >
                          Mark Complete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
