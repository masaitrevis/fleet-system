import { useState, useEffect } from 'react';

interface StaffProps {
  apiUrl: string;
}

interface StaffMember {
  id: string;
  staff_no: string;
  staff_name: string;
  email: string;
  designation: string;
  department: string;
  branch: string;
  role: string;
  phone: string;
}

export default function Staff({ apiUrl }: StaffProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    staff_no: '',
    staff_name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    branch: '',
    role: 'Driver'
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchStaff();
  }, [apiUrl]);

  const fetchStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch staff');
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Staff fetch error:', err);
      setError(err.message || 'Failed to load staff');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const url = editingId 
        ? `${apiUrl}/staff/${editingId}` 
        : `${apiUrl}/staff`;
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save staff');
      }
      
      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchStaff();
    } catch (err: any) {
      console.error('Staff submit error:', err);
      setError(err.message || 'Failed to save staff');
    }
  };

  const handleEdit = (member: StaffMember) => {
    setFormData({
      staff_no: member.staff_no || '',
      staff_name: member.staff_name || '',
      email: member.email || '',
      phone: member.phone || '',
      designation: member.designation || '',
      department: member.department || '',
      branch: member.branch || '',
      role: member.role || 'Driver'
    });
    setEditingId(member.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      staff_no: '',
      staff_name: '',
      email: '',
      phone: '',
      designation: '',
      department: '',
      branch: '',
      role: 'Driver'
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  };

  if (loading && staff.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading staff...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Staff Management</h2>
        <button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Staff'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Staff' : 'Add New Staff'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Staff No *</label>
              <input 
                placeholder="e.g., ST001" 
                value={formData.staff_no} 
                onChange={e => setFormData({...formData, staff_no: e.target.value})} 
                className="border p-2 rounded w-full" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input 
                placeholder="e.g., John Kamau" 
                value={formData.staff_name} 
                onChange={e => setFormData({...formData, staff_name: e.target.value})} 
                className="border p-2 rounded w-full" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input 
                type="email"
                placeholder="e.g., john@company.com" 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                className="border p-2 rounded w-full" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input 
                placeholder="e.g., +254712345678" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
                className="border p-2 rounded w-full" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Designation</label>
              <input 
                placeholder="e.g., Senior Driver" 
                value={formData.designation} 
                onChange={e => setFormData({...formData, designation: e.target.value})} 
                className="border p-2 rounded w-full" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <input 
                placeholder="e.g., Transport" 
                value={formData.department} 
                onChange={e => setFormData({...formData, department: e.target.value})} 
                className="border p-2 rounded w-full" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Branch</label>
              <input 
                placeholder="e.g., Nairobi" 
                value={formData.branch} 
                onChange={e => setFormData({...formData, branch: e.target.value})} 
                className="border p-2 rounded w-full" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select 
                value={formData.role} 
                onChange={e => setFormData({...formData, role: e.target.value})} 
                className="border p-2 rounded w-full"
              >
                <option>Driver</option>
                <option>Transport Supervisor</option>
                <option>Departmental Supervisor</option>
                <option>Head of Department</option>
                <option>Security Personnel</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              {editingId ? 'Update' : 'Save'}
            </button>
            <button type="button" onClick={handleCancel} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Staff No</th>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Phone</th>
              <th className="text-left p-4">Department</th>
              <th className="text-left p-4">Role</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff?.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">No staff members found</td>
              </tr>
            ) : (
              staff?.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-medium">{s.staff_no || '-'}</td>
                  <td className="p-4">{s.staff_name || '-'}</td>
                  <td className="p-4">
                    {s.email ? (
                      <span>{s.email}</span>
                    ) : (
                      <span className="text-red-500 text-sm">⚠️ Missing</span>
                    )}
                  </td>
                  <td className="p-4">{s.phone || '-'}</td>
                  <td className="p-4">{s.department || '-'}</td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{s.role || 'Driver'}</span>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => handleEdit(s)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
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
