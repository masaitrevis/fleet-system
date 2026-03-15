// Role-based access control utilities
// System supports both login roles (admin/manager/viewer) and staff job roles

export type SystemRole = 
  | 'admin' 
  | 'manager' 
  | 'viewer'
  | 'driver'
  | 'transport_supervisor'
  | 'dept_supervisor'
  | 'hod'
  | 'security';

// Map any role string to system role
export function mapRole(role: string): SystemRole {
  const normalized = role?.toLowerCase().replace(/\s+/g, '_') || 'viewer';
  
  const mapping: Record<string, SystemRole> = {
    // Login roles
    'admin': 'admin',
    'manager': 'manager',
    'viewer': 'viewer',
    // Staff job roles
    'driver': 'driver',
    'transport_supervisor': 'transport_supervisor',
    'transport supervisor': 'transport_supervisor',
    'departmental_supervisor': 'dept_supervisor',
    'departmental supervisor': 'dept_supervisor',
    'dept_supervisor': 'dept_supervisor',
    'head_of_department': 'hod',
    'head of department': 'hod',
    'hod': 'hod',
    'security_personnel': 'security',
    'security personnel': 'security',
    'security': 'security'
  };
  
  return mapping[normalized] || 'viewer';
}

// Get effective role from user object (handles both login and staff roles)
export function getEffectiveRole(user: any): SystemRole {
  if (!user) return 'viewer';
  // Prefer staff role if available, fallback to user role
  const roleToUse = user.staffRole || user.role || 'viewer';
  return mapRole(roleToUse);
}

// Permission checks
export const Permissions = {
  // View permissions
  canViewFleet: (role: SystemRole) => 
    ['admin', 'manager', 'viewer', 'driver', 'transport_supervisor', 'dept_supervisor', 'hod', 'security'].includes(role),
  
  canViewStaff: (role: SystemRole) => 
    ['admin', 'manager', 'hod', 'transport_supervisor'].includes(role),
  
  canViewRoutes: (role: SystemRole) => 
    ['admin', 'manager', 'viewer', 'transport_supervisor', 'hod'].includes(role),
  
  canViewFuel: (role: SystemRole) => 
    ['admin', 'manager', 'viewer', 'transport_supervisor', 'hod'].includes(role),
  
  canViewRepairs: (role: SystemRole) => 
    ['admin', 'manager', 'transport_supervisor', 'hod'].includes(role),
  
  canViewAnalytics: (role: SystemRole) => 
    ['admin', 'manager', 'hod'].includes(role),
  
  canViewReports: (role: SystemRole) => 
    ['admin', 'manager', 'hod', 'transport_supervisor'].includes(role),
  
  // Action permissions
  canCreateRequisition: (role: SystemRole) => 
    ['admin', 'manager', 'driver', 'dept_supervisor', 'hod'].includes(role),
  
  canApproveRequisition: (role: SystemRole, userDept?: string, reqDept?: string) => {
    if (['admin', 'manager'].includes(role)) return true;
    if (role === 'hod' && userDept === reqDept) return true;
    if (role === 'transport_supervisor') return true;
    return false;
  },
  
  canReportAccident: (role: SystemRole) => 
    ['admin', 'manager', 'driver', 'transport_supervisor', 'hod', 'security'].includes(role),
  
  canInvestigateAccident: (role: SystemRole) => 
    ['admin', 'manager', 'transport_supervisor', 'hod', 'security'].includes(role),
  
  canViewGateManagement: (role: SystemRole) => 
    ['admin', 'manager', 'transport_supervisor', 'security', 'hod'].includes(role),
  
  canManageGate: (role: SystemRole) =>
    ['admin', 'manager', 'security'].includes(role),
  
  canManageAudit: (role: SystemRole) => 
    ['admin', 'manager', 'auditor', 'transport_supervisor', 'hod'].includes(role),
  
  canImportData: (role: SystemRole) => 
    ['admin', 'manager'].includes(role),
  
  canEditFleet: (role: SystemRole) => 
    ['admin', 'manager', 'transport_supervisor'].includes(role),
  
  canEditStaff: (role: SystemRole) => 
    ['admin', 'manager'].includes(role),
  
  // Read-only check
  isReadOnly: (role: SystemRole) => 
    ['viewer'].includes(role),
};

// Get role display name
export function getRoleDisplayName(role: SystemRole | string): string {
  const names: Record<string, string> = {
    'admin': 'Administrator',
    'manager': 'Manager',
    'viewer': 'Viewer',
    'driver': 'Driver',
    'transport_supervisor': 'Transport Supervisor',
    'dept_supervisor': 'Departmental Supervisor',
    'hod': 'Head of Department',
    'security': 'Security Personnel'
  };
  return names[role] || role;
}
