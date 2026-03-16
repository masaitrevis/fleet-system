import { useState, useEffect } from 'react';

interface WorkshopStockProps {
  apiUrl: string;
}

interface Part {
  id: string;
  part_number: string;
  part_name: string;
  description?: string;
  category?: string;
  manufacturer?: string;
  unit_cost: number;
  quantity_on_hand: number;
  reorder_level: number;
  location_bin?: string;
  total_used?: number;
}

const CATEGORIES = [
  'Engine', 'Transmission', 'Brakes', 'Electrical', 'Body', 'Filters', 
  'Fluids', 'Tires', 'Accessories', 'Tools', 'Other'
];

export default function WorkshopStock({ apiUrl }: WorkshopStockProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const token = localStorage.getItem('token');

  const [formData, setFormData] = useState({
    part_number: '',
    part_name: '',
    description: '',
    category: '',
    manufacturer: '',
    supplier: '',
    unit_cost: '',
    quantity_on_hand: '',
    reorder_level: '5',
    location_bin: ''
  });

  useEffect(() => {
    fetchParts();
  }, [categoryFilter, showLowStockOnly]);

  const fetchParts = async () => {
    setLoading(true);
    try {
      let url = `${apiUrl}/workshop/parts`;
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (showLowStockOnly) params.append('low_stock', 'true');
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setParts(data);
      }
    } catch (err) {
      console.error('Failed to fetch parts:', err);
    } finally {
      setLoading(false);
    }
  };

  const createPart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/workshop/parts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setShowCreate(false);
        setFormData({
          part_number: '', part_name: '', description: '', category: '',
          manufacturer: '', supplier: '', unit_cost: '', quantity_on_hand: '',
          reorder_level: '5', location_bin: ''
        });
        fetchParts();
      }
    } catch (err) {
      console.error('Failed to create part:', err);
    }
  };

  const adjustStock = async (partId: string, adjustment: number, reason: string) => {
    try {
      const res = await fetch(`${apiUrl}/workshop/parts/${partId}/adjust`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ adjustment, reason })
      });
      
      if (res.ok) {
        fetchParts();
      }
    } catch (err) {
      console.error('Failed to adjust stock:', err);
    }
  };

  const filteredParts = parts.filter(p => 
    p.part_number.toLowerCase().includes(filter.toLowerCase()) ||
    p.part_name.toLowerCase().includes(filter.toLowerCase())
  );

  const lowStockCount = parts.filter(p => p.quantity_on_hand <= p.reorder_level).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Search parts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
            />
            Low Stock Only {lowStockCount > 0 && `(${lowStockCount})`}
          </label>
        </div>
        
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Add Part
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createPart} className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              placeholder="Part Number *"
              value={formData.part_number}
              onChange={(e) => setFormData({...formData, part_number: e.target.value})}
              className="border rounded-lg px-3 py-2"
              required
            />
            <input
              placeholder="Part Name *"
              value={formData.part_name}
              onChange={(e) => setFormData({...formData, part_name: e.target.value})}
              className="border rounded-lg px-3 py-2"
              required
            />
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              placeholder="Unit Cost"
              type="number"
              step="0.01"
              value={formData.unit_cost}
              onChange={(e) => setFormData({...formData, unit_cost: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              placeholder="Initial Quantity"
              type="number"
              value={formData.quantity_on_hand}
              onChange={(e) => setFormData({...formData, quantity_on_hand: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              placeholder="Reorder Level"
              type="number"
              value={formData.reorder_level}
              onChange={(e) => setFormData({...formData, reorder_level: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              placeholder="Location/Bin"
              value={formData.location_bin}
              onChange={(e) => setFormData({...formData, location_bin: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
          </div>
          
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-300 px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Part Number</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Category</th>
                <th className="text-right p-3">Stock</th>
                <th className="text-right p-3">Unit Cost</th>
                <th className="text-left p-3">Location</th>
                <th className="text-center p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((part) => (
                <tr key={part.id} className="border-t">
                  <td className="p-3 font-mono">{part.part_number}</td>
                  <td className="p-3">{part.part_name}</td>
                  <td className="p-3">
                    <span className="bg-gray-100 px-2 py-1 rounded text-sm">{part.category || 'Uncategorized'}</span>
                  </td>
                  <td className="p-3 text-right">
                    <span className={part.quantity_on_hand <= part.reorder_level ? 'text-red-600 font-bold' : ''}>
                      {part.quantity_on_hand}
                    </span>
                    {part.quantity_on_hand <= part.reorder_level && (
                      <span className="text-red-500 text-xs ml-1">LOW</span>
                    )}
                  </td>
                  <td className="p-3 text-right">${parseFloat(part.unit_cost as any).toFixed(2)}</td>
                  <td className="p-3">{part.location_bin || '-'}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelectedPart(part)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPart && (
        <StockAdjustmentModal
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
          onAdjust={adjustStock}
        />
      )}
    </div>
  );
}

function StockAdjustmentModal({ part, onClose, onAdjust }: {
  part: Part;
  onClose: () => void;
  onAdjust: (id: string, qty: number, reason: string) => void;
}) {
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdjust(part.id, parseInt(adjustment), reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Adjust Stock: {part.part_name}</h3>
        <p className="text-gray-600 mb-4">Current: {part.quantity_on_hand} units</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Adjustment (+/-)</label>
            <input
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="+10 or -5"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Stock received / Damaged goods / etc"
              required
            />
          </div>
          
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg">Update Stock</button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-300 py-2 rounded-lg">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
