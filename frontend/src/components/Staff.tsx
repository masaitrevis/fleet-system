import { useState, useEffect } from 'react';

interface StaffProps {
  apiUrl: string;
}

interface StaffMember {
  id: string;
  staff_no: string;
  staff_name: string;
  designation: string;
  department: string;
  branch: string;
  role: string;
}

export default function Staff({ apiUrl }: StaffProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    staff_no: '',
    staff_name: '',
    designation: '',
    department: '',
    branch: '',
    role: 'Driver'
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchStaff();
  }, [apiUrl]);

  const fetchStaff = () => {
    fetch(`${apiUrl}/staff`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setStaff(data);
        setLoading(false);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${apiUrl}/staff`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });
    setShowForm(false);
    fetchStaff();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Staff Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Add Staff
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input placeholder="Staff No *" value={formData.staff_no} onChange={e => setFormData({...formData, staff_no: e.target.value})} className="border p-2 rounded" required />
            <input placeholder="Full Name *" value={formData.staff_name} onChange={e => setFormData({...formData, staff_name: e.target.value})} className="border p-2 rounded" required />
            <input placeholder="Designation" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="border p-2 rounded" />
            <input placeholder="Department" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="border p-2 rounded" />
            <input placeholder="Branch" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} className="border p-2 rounded" />
            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="border p-2 rounded">
              <option>Driver</option>
              <option>Transport Supervisor</option>
              <option>Departmental Supervisor</option>
              <option>Head of Department</option>
              <option>Security Personnel</option>
            </select>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Staff No</th>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Designation</th>
              <th className="text-left p-4">Department</th>
              <th className="text-left p-4">Branch</th>
              <th className="text-left p-4">Role</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{s.staff_no}</td>
                <td className="p-4">{s.staff_name}</td>
                <td className="p-4">{s.designation}</td>
                <td className="p-4">{s.department}</td>
                <td className="p-4">{s.branch}</td>
                <td className="p-4"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{s.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}