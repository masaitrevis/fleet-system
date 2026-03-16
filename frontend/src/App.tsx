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
import Training from './components/Training';
import RequisitionModule from './components/requisition/RequisitionModule';
import SecurityDashboard from './components/SecurityDashboard';
import Integrations from './components/Integrations/Integrations';
import ErrorBoundary from './components/ErrorBoundary';
import { getEffectiveRole } from './utils/roles';

import Admin from './components/Admin';
import OperationsDashboard from './components/OperationsDashboard';
import Workshop from './components/Workshop/Workshop';
import AIChatbot from './components/AIChatbot';

export type View = 'dashboard' | 'fleet' | 'staff' | 'routes' | 'fuel' | 'repairs' | 'upload' | 'reports' | 'analytics' | 'accidents' | 'audits' | 'training' | 'requisitions' | 'security' | 'integrations' | 'operations' | 'workshop' | 'admin';

// Force correct API URL - env vars not reliable in Netlify
const API_URL = 'https://fleet-api-0272.onrender.com/api';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout, user } = useAuth();

  if (!isAuthenticated) {
    return <Login onLogin={() => {}} />;
  }

  const navItems: { key: View; label: string; icon: string; roles: string[] }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'dept_supervisor', 'hod', 'security'] },
    { key: 'security', label: 'Security', icon: '🔒', roles: ['admin', 'manager', 'security', 'transport_supervisor', 'hod'] },
    { key: 'requisitions', label: 'Requisitions', icon: '🚗', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'dept_supervisor', 'hod'] },
    { key: 'accidents', label: 'Accidents', icon: '🚨', roles: ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'hod', 'security'] },
    { key: 'audits', label: 'Audits', icon: '📋', roles: ['admin', 'manager', 'auditor', 'viewer', 'transport_supervisor', 'hod'] },
    { key: 'training', label: 'Training', icon: '🎓', roles: ['admin', 'manager', 'hod', 'driver', 'viewer', 'transport_supervisor', 'dept_supervisor', 'security', 'auditor'] },
    { key: 'fleet', label: 'Fleet', icon: '🚙', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'dept_supervisor', 'hod', 'security'] },
    { key: 'staff', label: 'Staff', icon: '👥', roles: ['admin', 'manager', 'hod'] },
    { key: 'routes', label: 'Routes', icon: '🛣️', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'hod'] },
    { key: 'operations', label: 'Operations', icon: '📺', roles: ['admin', 'manager', 'transport_supervisor', 'hod'] },
    { key: 'fuel', label: 'Fuel', icon: '⛽', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'hod'] },
    { key: 'repairs', label: 'Repairs', icon: '🔧', roles: ['admin', 'manager', 'transport_supervisor', 'hod'] },
    { key: 'workshop', label: 'Workshop', icon: '🏭', roles: ['admin', 'manager', 'transport_supervisor', 'hod'] },
    { key: 'analytics', label: 'Analytics', icon: '📈', roles: ['admin', 'manager', 'hod'] },
    { key: 'reports', label: 'Reports', icon: '📝', roles: ['admin', 'manager', 'hod', 'transport_supervisor'] },
    { key: 'upload', label: 'Import', icon: '📤', roles: ['admin', 'manager'] },
    { key: 'integrations', label: 'Integrations', icon: '🔗', roles: ['admin', 'manager'] },
    { key: 'admin', label: 'Admin', icon: '⚙️', roles: ['admin'] },
  ];

  const effectiveRole = getEffectiveRole(user);

  const filteredNav = navItems.filter(item => item.roles.includes(effectiveRole));

  const handleNavClick = (key: View) => {
    setCurrentView(key);
    setMobileMenuOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard apiUrl={API_URL} user={user} />;
      case 'security': return <SecurityDashboard apiUrl={API_URL} user={user} />;
      case 'requisitions': return <RequisitionModule apiUrl={API_URL} user={user} />;
      case 'accidents': return <Accidents apiUrl={API_URL} user={user} />;
      case 'audits': return <Audits apiUrl={API_URL} user={user} />;
      case 'training': return <Training apiUrl={API_URL} user={user} />;
      case 'operations': return <OperationsDashboard apiUrl={API_URL} user={user} />;
      case 'workshop': return <Workshop apiUrl={API_URL} user={user} />;
      case 'fleet': return <Fleet apiUrl={API_URL} />;
      case 'staff': return <Staff apiUrl={API_URL} />;
      case 'routes': return <Routes apiUrl={API_URL} />;
      case 'fuel': return <Fuel apiUrl={API_URL} />;
      case 'repairs': return <Repairs apiUrl={API_URL} />;
      case 'analytics': return <Analytics apiUrl={API_URL} />;
      case 'upload': return <Upload apiUrl={API_URL} />;
      case 'reports': return <Reports apiUrl={API_URL} />;
      case 'integrations': return <Integrations apiUrl={API_URL} />;
      case 'admin': return <Admin apiUrl={API_URL} />;
      default: return <Dashboard apiUrl={API_URL} user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚛</span>
          <h1 className="text-xl font-bold text-blue-600">FleetPro</h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar - Desktop: always visible, Mobile: conditional */}
      <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block md:w-64 bg-white shadow-md flex flex-col fixed md:static inset-0 z-40 md:z-auto pt-16 md:pt-0`}>
        <div className="hidden md:block p-6 border-b">
          <h1 className="text-2xl font-bold text-blue-600">🚛 FleetPro</h1>
          <p className="text-sm text-gray-500 mt-1">Management System</p>
        </div>
        
        <nav className="p-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
            {filteredNav.map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`text-left px-3 py-3 md:px-4 md:py-3 rounded-lg flex items-center gap-2 md:gap-3 transition-colors text-sm md:text-base ${
                  currentView === item.key
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg md:text-xl">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
        
        {/* User section */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
              {user?.staffName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.staffName || user?.email}</p>
              <p className="text-xs text-gray-500 truncate">{user?.staffRole || user?.role}</p>
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

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto min-h-0">
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </main>

      {/* AI Chatbot */}
      <AIChatbot apiUrl={API_URL} />
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
