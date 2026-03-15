import { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';

interface TrainingProps {
  apiUrl: string;
  user: any;
}

interface Course {
  id: string;
  course_code: string;
  course_name: string;
  description: string;
  category: string;
  duration_hours: number;
  validity_months: number;
  mandatory: boolean;
  provider: string;
}

interface TrainingRecord {
  id: string;
  staff_name: string;
  staff_no: string;
  department: string;
  course_name: string;
  course_code: string;
  category: string;
  completion_date: string;
  expiry_date: string;
  status: string;
  score: number;
  certificate_number: string;
  mandatory: boolean;
}

interface DashboardStats {
  trained_staff: number;
  active_certifications: number;
  expiring_soon: number;
  expired: number;
  missing_mandatory: number;
  by_category: any[];
}

const CATEGORY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const STATUS_COLORS: Record<string, string> = {
  'Active': 'bg-green-100 text-green-800',
  'Expiring Soon': 'bg-yellow-100 text-yellow-800',
  'Expired': 'bg-red-100 text-red-800'
};

export default function Training({ apiUrl }: TrainingProps) {
  const [view, setView] = useState<'dashboard' | 'courses' | 'records' | 'add-record'>('dashboard');
  const [courses, setCourses] = useState<Course[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('token');

  // Form states
  const [newCourse, setNewCourse] = useState({
    course_code: '', course_name: '', description: '', category: '',
    duration_hours: '', validity_months: '', mandatory: false, provider: ''
  });
  const [newRecord, setNewRecord] = useState({
    staff_id: '', course_id: '', completion_date: '', score: '', certificate_number: '', notes: ''
  });

  useEffect(() => {
    fetchDashboard();
    fetchCourses();
    fetchRecords();
    fetchStaff();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${apiUrl}/training/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error('Failed to fetch dashboard');
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${apiUrl}/training/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCourses(await res.json());
    } catch (err) {
      console.error('Failed to fetch courses');
    }
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${apiUrl}/training/records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setRecords(await res.json());
    } catch (err) {
      console.error('Failed to fetch records');
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch(`${apiUrl}/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setStaff(await res.json());
    } catch (err) {
      console.error('Failed to fetch staff');
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/training/courses`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newCourse,
          duration_hours: parseInt(newCourse.duration_hours) || null,
          validity_months: parseInt(newCourse.validity_months) || null
        })
      });
      if (res.ok) {
        setNewCourse({ course_code: '', course_name: '', description: '', category: '', duration_hours: '', validity_months: '', mandatory: false, provider: '' });
        fetchCourses();
        alert('Course created!');
      }
    } catch (err) {
      alert('Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/training/records`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newRecord,
          score: parseFloat(newRecord.score) || null
        })
      });
      if (res.ok) {
        setNewRecord({ staff_id: '', course_id: '', completion_date: '', score: '', certificate_number: '', notes: '' });
        fetchRecords();
        fetchDashboard();
        alert('Training record added!');
      }
    } catch (err) {
      alert('Failed to add record');
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    try {
      const res = await fetch(`${apiUrl}/training/records/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchRecords();
        fetchDashboard();
      }
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Training & Certifications</h1>
        <div className="flex gap-2">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Dashboard</button>
          <button onClick={() => setView('courses')} className={`px-4 py-2 rounded ${view === 'courses' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Courses</button>
          <button onClick={() => setView('records')} className={`px-4 py-2 rounded ${view === 'records' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Records</button>
          <button onClick={() => setView('add-record')} className={`px-4 py-2 rounded ${view === 'add-record' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Add Record</button>
        </div>
      </div>

      {/* Dashboard View */}
      {view === 'dashboard' && stats && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Trained Staff</p>
              <p className="text-2xl font-bold text-blue-600">{stats.trained_staff}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Active Certs</p>
              <p className="text-2xl font-bold text-green-600">{stats.active_certifications}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.expiring_soon}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Expired</p>
              <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Missing Mandatory</p>
              <p className="text-2xl font-bold text-purple-600">{stats.missing_mandatory}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-4">Training by Category</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.by_category} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={80}>
                    {stats.by_category.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-4">Expiring This Month</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {records.filter(r => r.status === 'Expiring Soon').slice(0, 5).map(r => (
                  <div key={r.id} className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{r.staff_name}</p>
                      <p className="text-xs text-gray-600">{r.course_name}</p>
                    </div>
                    <span className="text-xs text-red-600">{r.expiry_date}</span>
                  </div>
                ))}
                {records.filter(r => r.status === 'Expiring Soon').length === 0 && (
                  <p className="text-gray-500 text-sm">No certifications expiring soon</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Courses View */}
      {view === 'courses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Course List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Training Courses</h3>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {courses.map(c => (
                  <div key={c.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{c.course_name}</p>
                        <p className="text-sm text-gray-500">{c.course_code} • {c.category}</p>
                        <p className="text-xs text-gray-400">{c.duration_hours}h • Valid for {c.validity_months} months</p>
                      </div>
                      {c.mandatory && <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded">Mandatory</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create Course Form */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-4">Add New Course</h3>
              <form onSubmit={handleCreateCourse} className="space-y-3">
                <input type="text" placeholder="Course Code" className="w-full border rounded px-3 py-2"
                  value={newCourse.course_code} onChange={e => setNewCourse({...newCourse, course_code: e.target.value})} required />
                <input type="text" placeholder="Course Name" className="w-full border rounded px-3 py-2"
                  value={newCourse.course_name} onChange={e => setNewCourse({...newCourse, course_name: e.target.value})} required />
                <input type="text" placeholder="Category" className="w-full border rounded px-3 py-2"
                  value={newCourse.category} onChange={e => setNewCourse({...newCourse, category: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Duration (hrs)" className="w-full border rounded px-3 py-2"
                    value={newCourse.duration_hours} onChange={e => setNewCourse({...newCourse, duration_hours: e.target.value})} />
                  <input type="number" placeholder="Validity (months)" className="w-full border rounded px-3 py-2"
                    value={newCourse.validity_months} onChange={e => setNewCourse({...newCourse, validity_months: e.target.value})} />
                </div>
                <input type="text" placeholder="Provider" className="w-full border rounded px-3 py-2"
                  value={newCourse.provider} onChange={e => setNewCourse({...newCourse, provider: e.target.value})} />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newCourse.mandatory} 
                    onChange={e => setNewCourse({...newCourse, mandatory: e.target.checked})} />
                  <span className="text-sm">Mandatory Course</span>
                </label>
                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded disabled:bg-gray-400">
                  {loading ? 'Creating...' : 'Create Course'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Records View */}
      {view === 'records' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Training Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Staff</th>
                  <th className="px-4 py-2 text-left">Course</th>
                  <th className="px-4 py-2 text-left">Completed</th>
                  <th className="px-4 py-2 text-left">Expires</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.staff_name} <span className="text-gray-400">({r.staff_no})</span></td>
                    <td className="px-4 py-2">{r.course_name} {r.mandatory && <span className="text-red-500 text-xs">*</span>}</td>
                    <td className="px-4 py-2">{r.completion_date}</td>
                    <td className="px-4 py-2">{r.expiry_date || 'Never'}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[r.status] || 'bg-gray-100'}`}>{r.status}</span></td>
                    <td className="px-4 py-2">
                      <button onClick={() => deleteRecord(r.id)} className="text-red-600 text-xs hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Record View */}
      {view === 'add-record' && (
        <div className="max-w-xl mx-auto bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-4">Add Training Record</h3>
          <form onSubmit={handleAddRecord} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Staff Member</label>
              <select className="w-full border rounded px-3 py-2" 
                value={newRecord.staff_id} onChange={e => setNewRecord({...newRecord, staff_id: e.target.value})} required>
                <option value="">Select Staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.staff_name} ({s.staff_no})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Course</label>
              <select className="w-full border rounded px-3 py-2"
                value={newRecord.course_id} onChange={e => setNewRecord({...newRecord, course_id: e.target.value})} required>
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Completion Date</label>
              <input type="date" className="w-full border rounded px-3 py-2"
                value={newRecord.completion_date} onChange={e => setNewRecord({...newRecord, completion_date: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Score (%)</label>
              <input type="number" min="0" max="100" className="w-full border rounded px-3 py-2"
                value={newRecord.score} onChange={e => setNewRecord({...newRecord, score: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Certificate Number</label>
              <input type="text" className="w-full border rounded px-3 py-2"
                value={newRecord.certificate_number} onChange={e => setNewRecord({...newRecord, certificate_number: e.target.value})} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-2 rounded disabled:bg-gray-400">
              {loading ? 'Adding...' : 'Add Training Record'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
