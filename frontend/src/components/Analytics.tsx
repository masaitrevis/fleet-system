import { useState, useEffect } from 'react';

interface AnalyticsProps {
  apiUrl: string;
}

interface AnalyticsData {
  totalVehicles: number;
  activeVehicles: number;
  totalStaff: number;
  totalDrivers: number;
  totalFuelCost: number;
  avgConsumption: number;
  pendingRepairs: number;
  completedRepairs: number;
}

export default function Analytics({ apiUrl }: AnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${apiUrl}/analytics/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📈 Analytics Dashboard</h1>
      
      {data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600">Total Vehicles</p>
              <p className="text-2xl font-bold">{data.totalVehicles}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600">Active Vehicles</p>
              <p className="text-2xl font-bold">{data.activeVehicles}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold">{data.totalStaff}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600">Total Drivers</p>
              <p className="text-2xl font-bold">{data.totalDrivers}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl shadow">
              <p className="text-sm text-gray-600">Total Fuel Cost</p>
              <p className="text-xl font-bold">KES {data.totalFuelCost?.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow">
              <p className="text-sm text-gray-600">Avg Consumption</p>
              <p className="text-xl font-bold">{data.avgConsumption?.toFixed(2)} km/l</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow">
              <p className="text-sm text-gray-600">Pending Repairs</p>
              <p className="text-xl font-bold">{data.pendingRepairs}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 p-8 rounded-xl text-center">
          <p className="text-gray-600">No analytics data available.</p>
          <p className="text-sm text-gray-500 mt-2">Import data to see analytics.</p>
        </div>
      )}
    </div>
  );
}
