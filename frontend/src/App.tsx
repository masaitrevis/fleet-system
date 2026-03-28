import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import { getEffectiveRole } from './utils/roles';

// Lazy load all page components for code-splitting
// This creates separate chunks for each route, reducing initial bundle size
const Dashboard = lazy(() => import('./components/Dashboard'));
const Fleet = lazy(() => import('./components/Fleet'));
const Staff = lazy(() => import('./components/Staff'));
const RoutesComponent = lazy(() => import('./components/Routes'));
const Fuel = lazy(() => import('./components/Fuel'));
const Repairs = lazy(() => import('./components/Repairs'));
const Upload = lazy(() => import('./components/Upload'));
const Reports = lazy(() => import('./components/Reports'));
const Analytics = lazy(() => import('./components/Analytics'));
const Accidents = lazy(() => import('./components/Accidents'));
const Training = lazy(() => import('./components/Training'));
const RequisitionModule = lazy(() => import('./components/requisition/RequisitionModule'));
const SecurityDashboard = lazy(() => import('./components/SecurityDashboard'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuditsPage = lazy(() => import('./pages/AuditsPage'));
const AuditDetailPage = lazy(() => import('./pages/AuditDetailPage'));
const Admin = lazy(() => import('./components/Admin'));
const OperationsDashboard = lazy(() => import('./components/OperationsDashboard'));
const Workshop = lazy(() => import('./components/Workshop/Workshop'));
const AIChatbot = lazy(() => import('./components/AIChatbot'));

export type View = 'dashboard' | 'fleet' | 'staff' | 'routes' | 'fuel' | 'repairs' | 'upload' | 'reports' | 'analytics' | 'accidents' | 'audits' | 'training' | 'requisitions' | 'security' | 'integrations' | 'settings' | 'operations' | 'workshop' | 'admin';

// Force correct API URL - env vars not reliable in Netlify
const API_URL = 'https://fleet-api-0272.onrender.com/api';

// Navigation items configuration
const navItems: { key: View; label: string; icon: string; roles: string[]; path: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'dept_supervisor', 'hod', 'security'], path: '/' },
  { key: 'security', label: 'Security', icon: '🔒', roles: ['admin', 'manager', 'security', 'transport_supervisor', 'hod'], path: '/security' },
  { key: 'requisitions', label: 'Requisitions', icon: '🚗', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'dept_supervisor', 'hod'], path: '/requisitions' },
  { key: 'accidents', label: 'Accidents', icon: '🚨', roles: ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'hod', 'security'], path: '/accidents' },
  { key: 'audits', label: 'Audits', icon: '📋', roles: ['admin', 'manager', 'auditor', 'viewer', 'transport_supervisor', 'hod'], path: '/audits' },
  { key: 'training', label: 'Training', icon: '🎓', roles: ['admin', 'manager', 'hod', 'driver', 'viewer', 'transport_supervisor', 'dept_supervisor', 'security', 'auditor'], path: '/training' },
  { key: 'fleet', label: 'Fleet', icon: '🚙', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'dept_supervisor', 'hod', 'security'], path: '/fleet' },
  { key: 'staff', label: 'Staff', icon: '👥', roles: ['admin', 'manager', 'hod'], path: '/staff' },
  { key: 'routes', label: 'Routes', icon: '🛣️', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'hod'], path: '/routes' },
  { key: 'operations', label: 'Operations', icon: '📺', roles: ['admin', 'manager', 'transport_supervisor', 'hod'], path: '/operations' },
  { key: 'fuel', label: 'Fuel', icon: '⛽', roles: ['admin', 'manager', 'viewer', 'transport_supervisor', 'hod'], path: '/fuel' },
  { key: 'repairs', label: 'Repairs', icon: '🔧', roles: ['admin', 'manager', 'transport_supervisor', 'hod'], path: '/repairs' },
  { key: 'workshop', label: 'Workshop', icon: '🏭', roles: ['admin', 'manager', 'transport_supervisor', 'hod'], path: '/workshop' },
  { key: 'analytics', label: 'Analytics', icon: '📈', roles: ['admin', 'manager', 'hod'], path: '/analytics' },
  { key: 'reports', label: 'Reports', icon: '📝', roles: ['admin', 'manager', 'hod', 'transport_supervisor'], path: '/reports' },
  { key: 'upload', label: 'Import', icon: '📤', roles: ['admin', 'manager'], path: '/upload' },
  { key: 'integrations', label: 'Integrations', icon: '🔗', roles: ['admin', 'manager'], path: '/integrations' },
  { key: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin', 'manager', 'hod'], path: '/settings' },
  { key: 'admin', label: 'Admin', icon: '🔧', roles: ['admin'], path: '/admin' },
];

// Loading fallback component for Suspense
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-gray-500">Loading page...</p>
      </div>
    </div>
  );
}

function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Login onLogin={() => {}} />;
  }

  const effectiveRole = getEffectiveRole(user);
  const filteredNav = navItems.filter(item => item.roles.includes(effectiveRole));

  // Find current view based on path
  const currentView = navItems.find(item => 
    location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  )?.key || 'dashboard';

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
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
                onClick={() => handleNavClick(item.path)}
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

      {/* Main Content with Suspense for lazy-loaded routes */}
      <main className="flex-1 p-4 md:p-8 overflow-auto min-h-0">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard apiUrl={API_URL} user={user} />} />
              <Route path="/security" element={<SecurityDashboard apiUrl={API_URL} user={user} />} />
              <Route path="/requisitions" element={<RequisitionModule apiUrl={API_URL} user={user} />} />
              <Route path="/accidents" element={<Accidents apiUrl={API_URL} user={user} />} />
              <Route path="/audits" element={<AuditsPage apiUrl={API_URL} user={user} />} />
              <Route path="/audits/:id" element={<AuditDetailPage apiUrl={API_URL} user={user} />} />
              
              <Route path="/training" element={<Training apiUrl={API_URL} user={user} />} />
              <Route path="/operations" element={<OperationsDashboard apiUrl={API_URL} user={user} />} />
              <Route path="/workshop" element={<Workshop apiUrl={API_URL} user={user} />} />
              <Route path="/fleet" element={<Fleet apiUrl={API_URL} />} />
              <Route path="/staff" element={<Staff apiUrl={API_URL} />} />
              <Route path="/routes" element={<RoutesComponent apiUrl={API_URL} />} />
              <Route path="/fuel" element={<Fuel apiUrl={API_URL} />} />
              <Route path="/repairs" element={<Repairs apiUrl={API_URL} />} />
              <Route path="/analytics" element={<Analytics apiUrl={API_URL} />} />
              <Route path="/upload" element={<Upload apiUrl={API_URL} />} />
              <Route path="/reports" element={<Reports apiUrl={API_URL} />} />
              <Route path="/integrations" element={<IntegrationsPage apiUrl={API_URL} />} />
              <Route path="/settings" element={<SettingsPage apiUrl={API_URL} />} />
              <Route path="/admin" element={<Admin apiUrl={API_URL} />} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
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
      <AppLayout />
    </AuthProvider>
  );
}

export default App;
