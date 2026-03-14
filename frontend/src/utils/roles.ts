// Role-based access control utilities

export type StaffRole = 
  | 'admin' 
  | 'manager' 
  | 'viewer'
  | 'auditor'
  | 'Driver'
  | 'Transport Supervisor'
  | 'Departmental Supervisor'
  | 'Head of Department'
  | 'Security Personnel';

export type SystemRole = 
  | 'admin' 
  | 'manager' 
  | 'viewer'
  | 'auditor'
  | 'driver'
  | 'transport_supervisor'
  | 'dept_supervisor'
  | 'hod'
  | 'security';

// Map staff role to system role
export function mapStaffRole(staffRole: string): SystemRole {
  const mapping: Record<string, SystemRole> = {
    'Driver': 'driver',
    'Transport Supervisor': 'transport_supervisor',
    'Departmental Supervisor': 'dept_supervisor',
    'Head of Department': 'hod',
    'Security Personnel': 'security',
    'admin': 'admin',
    'manager': 'manager',
    'viewer': 'viewer',
    'auditor': 'auditor'
  };
  return mapping[staffRole] || 'viewer';
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
    ['viewer', 'driver', 'security'].includes(role),
};

// Get role display name
export function getRoleDisplayName(role: SystemRole | StaffRole): string {
  const names: Record<string, string> = {
    'admin': 'Administrator',
    'manager': 'Manager',
    'viewer': 'Viewer',
    'auditor': 'Auditor',
    'driver': 'Driver',
    'transport_supervisor': 'Transport Supervisor',
    'dept_supervisor': 'Departmental Supervisor',
    'hod': 'Head of Department',
    'security': 'Security Personnel',
    'Driver': 'Driver',
    'Transport Supervisor': 'Transport Supervisor',
    'Departmental Supervisor': 'Departmental Supervisor',
    'Head of Department': 'Head of Department',
    'Security Personnel': 'Security Personnel'
  };
  return names[role] || role;
}
