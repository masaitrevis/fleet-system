import { useState, useEffect } from 'react';
import WorkshopStock from './WorkshopStock';
import WorkshopInvoices from './WorkshopInvoices';
import WorkshopJobCards from './WorkshopJobCards';

interface WorkshopProps {
  apiUrl: string;
  user?: any;
}

type WorkshopTab = 'overview' | 'job-cards' | 'stock' | 'invoices';

export default function Workshop({ apiUrl }: WorkshopProps) {
  const [activeTab, setActiveTab] = useState<WorkshopTab>('overview');
  const [stats, setStats] = useState<any>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [stockRes, invoiceRes, jobCardRes] = await Promise.all([
        fetch(`${apiUrl}/workshop/parts?low_stock=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/workshop/financial-summary`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/repairs/defective-vehicles`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (stockRes.ok && invoiceRes.ok && jobCardRes) {
        setStats({
          lowStock: (await stockRes.json()).length,
          financials: await invoiceRes.json(),
          defectiveVehicles: (await jobCardRes.json()).length
        });
      }
    } catch (err) {
      console.error('Failed to fetch workshop stats:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">🔧 Workshop Management</h1>
          <p className="text-gray-500">Job cards, stock parts, and invoicing</p>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Job Cards"
            value="Manage"
            subtitle="Create & track repairs"
            icon="📋"
            color="blue"
            onClick={() => setActiveTab('job-cards')}
          />
          <StatCard
            title="Stock Parts"
            value={stats?.lowStock || 0}
            subtitle="Low stock alerts"
            icon="📦"
            color={stats?.lowStock > 0 ? 'red' : 'green'}
            onClick={() => setActiveTab('stock')}
          />
          <StatCard
            title="Invoices"
            value={stats?.financials?.invoices?.total_outstanding > 0 ? `$${parseFloat(stats.financials.invoices.total_outstanding).toFixed(0)}` : '$0'}
            subtitle="Outstanding"
            icon="💰"
            color="yellow"
            onClick={() => setActiveTab('invoices')}
          />
          <StatCard
            title="Defective"
            value={stats?.defectiveVehicles || 0}
            subtitle="Vehicles needing repair"
            icon="⚠️"
            color={stats?.defectiveVehicles > 0 ? 'orange' : 'green'}
            onClick={() => setActiveTab('job-cards')}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'job-cards', label: 'Job Cards', icon: '📋' },
              { key: 'stock', label: 'Stock Parts', icon: '📦' },
              { key: 'invoices', label: 'Invoices', icon: '💰' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as WorkshopTab)}
                className={`px-6 py-4 flex items-center gap-2 font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'job-cards' && <WorkshopJobCards apiUrl={apiUrl} />}
          {activeTab === 'stock' && <WorkshopStock apiUrl={apiUrl} />}
          {activeTab === 'invoices' && <WorkshopInvoices apiUrl={apiUrl} />}
          {activeTab === 'overview' && (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">Select a module above to get started</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setActiveTab('job-cards')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Job Card
                </button>
                <button
                  onClick={() => setActiveTab('stock')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Check Stock
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color, onClick }: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  color: string;
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200'
  };

  return (
    <button
      onClick={onClick}
      className={`p-6 rounded-lg border text-left hover:shadow-md transition-shadow ${colors[color]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-medium opacity-75">{title}</span>
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-sm opacity-75">{subtitle}</p>
    </button>
  );
}
