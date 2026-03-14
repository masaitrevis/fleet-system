import { useState } from 'react';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Fleet from './components/Fleet';
import Staff from './components/Staff';
import Routes from './components/Routes';
import Fuel from './components/Fuel';
import Repairs from './components/Repairs';
import Upload from './components/Upload';
import Reports from './components/Reports';
import Analytics from './components/Analytics';
import Accidents from './components/Accidents';
import Audits from './components/Audits';
import RequisitionModule from './components/requisition/RequisitionModule';

export type View = 'dashboard' | 'fleet' | 'staff' | 'routes' | 'fuel' | 'repairs' | 'upload' | 'reports' | 'analytics' | 'accidents' | 'audits' | 'requisitions';

// Force correct API URL - env vars not reliable in Netlify
const API_URL = 'https://fleet-api-0272.onrender.com/api';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { isAuthenticated, logout, user } = useAuth();

  if (!isAuthenticated) {
    return <Login onLogin={() => {}} />;
  }

  const navItems: { key: View; label: string; icon: string; roles: string[] }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'dept_supervisor', 'hod', 'security'] },
    { key: 'requisitions', label: 'Vehicle Requisition', icon: '🚗', roles: ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'dept_supervisor', 'hod'] },
    { key: 'accidents', label: 'Accidents', icon: '🚨', roles: ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'hod', 'security'] },
    { key: 'audits', label: 'Fleet Audit', icon: '📋', roles: ['admin', 'manager', 'auditor', 'viewer', 'transport_supervisor', 'hod'] },
    { key: 'fleet', label: 'Fleet', icon: '🚙', roles: ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'dept_supervisor', 'hod', 'security'] },
    { key: 'staff', label: 'Staff', icon: '👥', roles: ['admin', 'manager', 'hod'] },
    { key: 'routes', label: 'Routes', icon: '🛣️', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'hod'] },
    { key: 'fuel', label: 'Fuel', icon: '⛽', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'hod'] },
    { key: 'repairs', label: 'Repairs', icon: '🔧', roles: ['admin', 'manager', 'transport_supervisor', 'hod'] },
    { key: 'analytics', label: 'Analytics', icon: '📈', roles: ['admin', 'manager', 'hod'] },
    { key: 'reports', label: 'Reports', icon: '📝', roles: ['admin', 'manager', 'hod', 'transport_supervisor'] },
    { key: 'upload', label: 'Import', icon: '📤', roles: ['admin', 'manager'] },
  ];

  const effectiveRole = user?.staffRole 
    ? user.staffRole.toLowerCase().replace(/\s+/g, '_').replace('head_of_department', 'hod').replace('departmental', 'dept')
    : user?.role || 'viewer';

  const filteredNav = navItems.filter(item => item.roles.includes(effectiveRole));

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard apiUrl={API_URL} />;
      case 'requisitions': return <RequisitionModule apiUrl={API_URL} user={user} />;
      case 'accidents': return <Accidents apiUrl={API_URL} user={user} />;
      case 'audits': return <Audits apiUrl={API_URL} user={user} />;
      case 'fleet': return <Fleet apiUrl={API_URL} />;
      case 'staff': return <Staff apiUrl={API_URL} />;
      case 'routes': return <Routes apiUrl={API_URL} />;
      case 'fuel': return <Fuel apiUrl={API_URL} />;
      case 'repairs': return <Repairs apiUrl={API_URL} />;
      case 'analytics': return <Analytics apiUrl={API_URL} />;
      case 'upload': return <Upload apiUrl={API_URL} />;
      case 'reports': return <Reports apiUrl={API_URL} />;
      default: return <Dashboard apiUrl={API_URL} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-blue-600">🚛 FleetPro</h1>
          <p className="text-sm text-gray-500 mt-1">Management System</p>
        </div>
        <nav className="p-4 flex-1">
          {filteredNav.map((item) => (
            <button
              key={item.key}
              onClick={() => setCurrentView(item.key)}
              className={`w-full text-left px-4 py-3 rounded-lg mb-2 flex items-center gap-3 transition-colors ${
                currentView === item.key
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        
        {/* User section */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
              {user?.staffName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.staffName || user?.email}</p>
              <p className="text-xs text-gray-500">{user?.staffRole || user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;