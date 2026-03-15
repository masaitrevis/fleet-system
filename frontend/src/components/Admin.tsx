import { useState, useEffect } from 'react';

interface AdminProps {
  apiUrl: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  staff_name?: string;
  staff_role?: string;
  created_at: string;
}

const ALL_ROLES = [
  // Login roles
  { value: 'admin', label: '👑 Administrator', type: 'login' },
  { value: 'manager', label: '💼 Manager', type: 'login' },
  { value: 'viewer', label: '👁️ Viewer', type: 'login' },
  // Job roles
  { value: 'Driver', label: '🚗 Driver', type: 'job' },
  { value: 'Transport Supervisor', label: '📋 Transport Supervisor', type: 'job' },
  { value: 'Departmental Supervisor', label: '🏢 Departmental Supervisor', type: 'job' },
  { value: 'Head of Department', label: '👔 Head of Department', type: 'job' },
  { value: 'Security Personnel', label: '🔒 Security Personnel', type: 'job' },
];

const DEPARTMENTS = ['Transport', 'Operations', 'HR', 'Finance', 'IT', 'Security', 'Administration'];
const BRANCHES = ['Nairobi HQ', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'];

export default function Admin({ apiUrl }: AdminProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'viewer',
    staffName: '',
    staffNo: '',
    department: '',
    branch: '',
    phone: ''
  });
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');

  const selectedRole = ALL_ROLES.find(r => r.value === formData.role);
  const isJobRole = selectedRole?.type === 'job';

  useEffect(() => {
    fetchUsers().then(() => setLoading(false));
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 403) {
        setMessage('Error: You do not have admin permissions');
        return;
      }
      
      if (!res.ok) {
        const error = await res.json();
        setMessage('Error: ' + (error.error || 'Failed to fetch users'));
        return;
      }
      
      const data = await res.json();
      setUsers(data);
      
      if (data.length === 0) {
        setMessage('No users found in database. Only default admin exists.');
      }
    } catch (err: any) {
      setMessage('Network error: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    
    // Validation for job roles
    if (isJobRole && !formData.staffName) {
      setMessage('Error: Staff name is required for job roles');
      return;
    }
    
    try {
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const result = await res.json();
        setMessage(`User created successfully! Role: ${result.role}`);
        setFormData({ 
          email: '', 
          password: '', 
          role: 'viewer',
          staffName: '',
          staffNo: '',
          department: '',
          branch: '',
          phone: ''
        });
        fetchUsers();
        setTimeout(() => setShowForm(false), 1000);
      } else {
        const error = await res.json();
        setMessage('Error: ' + (error.error || 'Failed to create user'));
      }
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'admin': 'bg-purple-100 text-purple-800',
      'manager': 'bg-blue-100 text-blue-800',
      'viewer': 'bg-gray-100 text-gray-800',
      'Driver': 'bg-green-100 text-green-800',
      'Transport Supervisor': 'bg-orange-100 text-orange-800',
      'Departmental Supervisor': 'bg-yellow-100 text-yellow-800',
      'Head of Department': 'bg-red-100 text-red-800',
      'Security Personnel': 'bg-indigo-100 text-indigo-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Admin Panel</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Add User
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-4 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Default Admin Info */}
      <div className="bg-yellow-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold text-yellow-800 mb-2">Default Admin Login</h3>
        <p className="text-yellow-700 text-sm">Email: admin@fleet.local</p>
        <p className="text-yellow-700 text-sm">Password: admin123</p>
      </div>

      {loading && <div className="text-center py-8">Loading users...</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New User</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input 
                type="email" 
                placeholder="john@company.com" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input 
                type="password" 
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="w-full border p-2 rounded"
                required
                minLength={6}
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className="w-full border p-2 rounded"
              >
                <optgroup label="Login Roles">
                  {ALL_ROLES.filter(r => r.type === 'login').map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Job Roles (Auto-creates Staff Record)">
                  {ALL_ROLES.filter(r => r.type === 'job').map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {isJobRole 
                  ? "This will create both a login account and a staff record"
                  : "Standard login role only"
                }
              </p>
            </div>
            
            {isJobRole && (
              <>
                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <h4 className="font-medium text-gray-800 mb-3">Staff Information</h4>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff Name *</label>
                  <input 
                    type="text" 
                    placeholder="John Kamau"
                    value={formData.staffName}
                    onChange={e => setFormData({...formData, staffName: e.target.value})}
                    className="w-full border p-2 rounded"
                    required={isJobRole}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff Number</label>
                  <input 
                    type="text" 
                    placeholder="EMP001"
                    value={formData.staffNo}
                    onChange={e => setFormData({...formData, staffNo: e.target.value})}
                    className="w-full border p-2 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input 
                    type="tel" 
                    placeholder="+254 712 345 678"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full border p-2 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    className="w-full border p-2 rounded"
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select
                    value={formData.branch}
                    onChange={e => setFormData({...formData, branch: e.target.value})}
                    className="w-full border p-2 rounded"
                  >
                    <option value="">Select Branch</option>
                    {BRANCHES.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-6 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Create User</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Role</th>
              <th className="text-left p-4">Staff Name</th>
              <th className="text-left p-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {users?.map(u => (
              <tr key={u.id} className="border-b">
                <td className="p-4">{u.email}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-sm ${getRoleBadgeColor(u.staff_role || u.role)}`}>
                    {u.staff_role || u.role}
                  </span>
                </td>
                <td className="p-4 text-gray-600">{u.staff_name || '-'}</td>
                <td className="p-4 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users?.length === 0 && (
          <p className="text-center py-8 text-gray-500">No users found</p>
        )}
      </div>
    </div>
  );
}
