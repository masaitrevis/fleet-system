import { useState, useEffect } from 'react';

interface AdminProps {
  apiUrl: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function Admin({ apiUrl }: AdminProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'viewer'
  });
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');

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
        setMessage('User created successfully!');
        setFormData({ email: '', password: '', role: 'viewer' });
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
        <div className={`p-4 rounded-lg mb-4 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input 
              type="email" 
              placeholder="Email" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="border p-2 rounded"
              required
            />
            <input 
              type="password" 
              placeholder="Password"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              className="border p-2 rounded"
              required
            />
            <select
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
              className="border p-2 rounded"
            >
              <option value="viewer">Viewer</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              For job roles (Driver, Transport, etc.), link user to Staff record by matching email
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Role</th>
              <th className="text-left p-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {users?.map(u => (
              <tr key={u.id} className="border-b">
                <td className="p-4">{u.email}</td>
                <td className="p-4"><span className="px-2 py-1 bg-blue-100 rounded text-sm">{u.role}</span></td>
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
