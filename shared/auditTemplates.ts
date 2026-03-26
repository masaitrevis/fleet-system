// Fleet Management Audit Module - 10 Templates with 100 Questions
// Scoring: 0 = Not Implemented, 1 = Partially Implemented, 2 = Fully Implemented

export interface AuditQuestion {
  id: string;
  question_text: string;
  module_name: string;
  question_order: number;
  max_score: number;
  requires_evidence: boolean;
}

export interface AuditTemplate {
  id: string;
  template_name: string;
  description: string;
  category: string;
  questions: AuditQuestion[];
}

// =============================================================================
// TEMPLATE 1: FLEET POLICY & GOVERNANCE (10 Questions)
// =============================================================================
export const fleetPolicyGovernanceQuestions: AuditQuestion[] = [
  {
    id: 'FPG-001',
    question_text: 'Does the organization have a documented Fleet Management Policy that is approved by senior management?',
    module_name: 'Fleet Policy & Governance',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FPG-002',
    question_text: 'Is the Fleet Management Policy reviewed and updated at least annually?',
    module_name: 'Fleet Policy & Governance',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FPG-003',
    question_text: 'Are roles and responsibilities for fleet management clearly defined and documented?',
    module_name: 'Fleet Policy & Governance',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FPG-004',
    question_text: 'Is there a designated Fleet Manager with appropriate authority and resources?',
    module_name: 'Fleet Policy & Governance',
    question_order: 4,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'FPG-005',
    question_text: 'Does the organization have a fleet committee or governance structure for oversight?',
    module_name: 'Fleet Policy & Governance',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FPG-006',
    question_text: 'Are fleet management objectives aligned with organizational strategic goals?',
    module_name: 'Fleet Policy & Governance',
    question_order: 6,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'FPG-007',
    question_text: 'Is there a documented process for fleet-related decision-making and approvals?',
    module_name: 'Fleet Policy & Governance',
    question_order: 7,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FPG-008',
    question_text: 'Are fleet performance metrics and KPIs established and monitored regularly?',
    module_name: 'Fleet Policy & Governance',
    question_order: 8,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FPG-009',
    question_text: 'Does the organization conduct regular fleet management audits and reviews?',
    module_name: 'Fleet Policy & Governance',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FPG-010',
    question_text: 'Is there a documented business continuity plan for critical fleet operations?',
    module_name: 'Fleet Policy & Governance',
    question_order: 10,
    max_score: 2,
    requires_evidence: true
  }
];

// =============================================================================
// TEMPLATE 2: VEHICLE ACQUISITION & DISPOSAL (10 Questions)
// =============================================================================
export const vehicleAcquisitionDisposalQuestions: AuditQuestion[] = [
  {
    id: 'VAD-001',
    question_text: 'Is there a documented vehicle acquisition policy and procedure?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VAD-002',
    question_text: 'Are vehicle specifications defined based on operational requirements and not personal preference?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 2,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'VAD-003',
    question_text: 'Is a total cost of ownership (TCO) analysis conducted before vehicle acquisition?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VAD-004',
    question_text: 'Are competitive procurement processes followed for vehicle purchases?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 4,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VAD-005',
    question_text: 'Is there a documented vehicle replacement policy based on age, mileage, or condition criteria?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VAD-006',
    question_text: 'Are vehicles disposed of through transparent and competitive processes?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 6,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VAD-007',
    question_text: 'Is residual value optimization considered in disposal decisions?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 7,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'VAD-008',
    question_text: 'Are all vehicle acquisitions properly registered and documented in the fleet management system?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 8,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VAD-009',
    question_text: 'Is there a process for evaluating and selecting vehicle financing options (purchase, lease, rental)?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VAD-010',
    question_text: 'Are disposal transactions properly authorized and documented with audit trails?',
    module_name: 'Vehicle Acquisition & Disposal',
    question_order: 10,
    max_score: 2,
    requires_evidence: true
  }
];

// =============================================================================
// TEMPLATE 3: DRIVER MANAGEMENT & SAFETY (10 Questions)
// =============================================================================
export const driverManagementSafetyQuestions: AuditQuestion[] = [
  {
    id: 'DMS-001',
    question_text: 'Are all drivers properly licensed and verified before assignment?',
    module_name: 'Driver Management & Safety',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMS-002',
    question_text: 'Is there a formal driver recruitment and vetting process including background checks?',
    module_name: 'Driver Management & Safety',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMS-003',
    question_text: 'Are drivers required to undergo initial and periodic training on defensive driving?',
    module_name: 'Driver Management & Safety',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMS-004',
    question_text: 'Is driver behavior monitored through telematics, dashcams, or other technologies?',
    module_name: 'Driver Management & Safety',
    question_order: 4,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMS-005',
    question_text: 'Are drivers subject to regular medical fitness assessments?',
    module_name: 'Driver Management & Safety',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMS-006',
    question_text: 'Is there a documented disciplinary process for traffic violations and unsafe driving?',
    module_name: 'Driver Management & Safety',
    question_order: 6,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMS-007',
    question_text: 'Are driver safety incentives or recognition programs in place?',
    module_name: 'Driver Management & Safety',
    question_order: 7,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'DMS-008',
    question_text: 'Is there a process for handling driver fatigue and working hour compliance?',
    module_name: 'Driver Management & Safety',
    question_order: 8,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMS-009',
    question_text: 'Are driver safety scores and performance metrics tracked and reviewed?',
    module_name: 'Driver Management & Safety',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMS-010',
    question_text: 'Is there a formal process for investigating and learning from driver-related incidents?',
    module_name: 'Driver Management & Safety',
    question_order: 10,
    max_score: 2,
    requires_evidence: true
  }
];

// =============================================================================
// TEMPLATE 4: VEHICLE MAINTENANCE & INSPECTIONS (10 Questions)
// =============================================================================
export const vehicleMaintenanceInspectionsQuestions: AuditQuestion[] = [
  {
    id: 'VMI-001',
    question_text: 'Is there a documented preventive maintenance schedule for all vehicles?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VMI-002',
    question_text: 'Are pre-trip and post-trip inspections conducted and documented?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VMI-003',
    question_text: 'Is there a system for tracking and scheduling routine maintenance activities?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VMI-004',
    question_text: 'Are maintenance records complete, accurate, and retained for audit purposes?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 4,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VMI-005',
    question_text: 'Is there a process for handling breakdowns and emergency repairs?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VMI-006',
    question_text: 'Are spare parts inventory levels monitored and managed effectively?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 6,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VMI-007',
    question_text: 'Are authorized workshops and service providers evaluated and approved?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 7,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VMI-008',
    question_text: 'Is vehicle downtime minimized through effective maintenance planning?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 8,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'VMI-009',
    question_text: 'Are warranty claims and manufacturer recalls tracked and acted upon promptly?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'VMI-010',
    question_text: 'Is there a process for analyzing maintenance costs and identifying improvement opportunities?',
    module_name: 'Vehicle Maintenance & Inspections',
    question_order: 10,
    max_score: 2,
    requires_evidence: true
  }
];

// =============================================================================
// TEMPLATE 5: FUEL MANAGEMENT & EFFICIENCY (10 Questions)
// =============================================================================
export const fuelManagementEfficiencyQuestions: AuditQuestion[] = [
  {
    id: 'FME-001',
    question_text: 'Is there a documented fuel management policy and control procedures?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FME-002',
    question_text: 'Are fuel consumption targets established for different vehicle categories?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FME-003',
    question_text: 'Is fuel consumption monitored and reported on a regular basis?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FME-004',
    question_text: 'Are fuel cards or controlled fueling methods used to prevent unauthorized purchases?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 4,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FME-005',
    question_text: 'Is there a process for investigating and addressing fuel variances and anomalies?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FME-006',
    question_text: 'Are fuel efficiency training programs provided to drivers?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 6,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'FME-007',
    question_text: 'Is vehicle utilization optimized to minimize unnecessary fuel consumption?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 7,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'FME-008',
    question_text: 'Are alternative fuel options and electric vehicles evaluated for fleet suitability?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 8,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'FME-009',
    question_text: 'Is fuel data integrated with telematics and fleet management systems?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FME-010',
    question_text: 'Are fuel cost benchmarks established and performance compared against industry standards?',
    module_name: 'Fuel Management & Efficiency',
    question_order: 10,
    max_score: 2,
    requires_evidence: true
  }
];

// =============================================================================
// TEMPLATE 6: COMPLIANCE & REGULATORY (10 Questions)
// =============================================================================
export const complianceRegulatoryQuestions: AuditQuestion[] = [
  {
    id: 'CR-001',
    question_text: 'Are all vehicles registered and licensed in accordance with legal requirements?',
    module_name: 'Compliance & Regulatory',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-002',
    question_text: 'Is there a system for tracking and renewing vehicle licenses and permits before expiry?',
    module_name: 'Compliance & Regulatory',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-003',
    question_text: 'Are vehicles maintained to meet roadworthiness and safety inspection standards?',
    module_name: 'Compliance & Regulatory',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-004',
    question_text: 'Is there a process for ensuring compliance with emissions and environmental regulations?',
    module_name: 'Compliance & Regulatory',
    question_order: 4,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-005',
    question_text: 'Are all vehicles properly insured with adequate coverage levels?',
    module_name: 'Compliance & Regulatory',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-006',
    question_text: 'Is there a process for handling traffic violations and ensuring timely resolution?',
    module_name: 'Compliance & Regulatory',
    question_order: 6,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-007',
    question_text: 'Are weights and dimensions regulations complied with for commercial vehicles?',
    module_name: 'Compliance & Regulatory',
    question_order: 7,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-008',
    question_text: 'Is there a documented process for handling accidents and incident reporting to authorities?',
    module_name: 'Compliance & Regulatory',
    question_order: 8,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-009',
    question_text: 'Are hours of service and driver working time regulations complied with?',
    module_name: 'Compliance & Regulatory',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'CR-010',
    question_text: 'Is there a process for staying updated on changes to transportation and fleet regulations?',
    module_name: 'Compliance & Regulatory',
    question_order: 10,
    max_score: 2,
    requires_evidence: true
  }
];

// =============================================================================
// TEMPLATE 7: RISK MANAGEMENT & INSURANCE (10 Questions)
// =============================================================================
export const riskManagementInsuranceQuestions: AuditQuestion[] = [
  {
    id: 'RMI-001',
    question_text: 'Is there a formal fleet risk management policy and framework?',
    module_name: 'Risk Management & Insurance',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-002',
    question_text: 'Are fleet risks identified, assessed, and documented in a risk register?',
    module_name: 'Risk Management & Insurance',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-003',
    question_text: 'Is insurance coverage reviewed regularly to ensure adequacy and competitiveness?',
    module_name: 'Risk Management & Insurance',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-004',
    question_text: 'Are insurance claims processed efficiently with proper documentation?',
    module_name: 'Risk Management & Insurance',
    question_order: 4,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-005',
    question_text: 'Is there a process for investigating accidents and implementing preventive measures?',
    module_name: 'Risk Management & Insurance',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-006',
    question_text: 'Are high-risk drivers and vehicles identified and managed appropriately?',
    module_name: 'Risk Management & Insurance',
    question_order: 6,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-007',
    question_text: 'Is there a system for tracking and analyzing accident trends and patterns?',
    module_name: 'Risk Management & Insurance',
    question_order: 7,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-008',
    question_text: 'Are security measures in place to prevent vehicle theft and cargo loss?',
    module_name: 'Risk Management & Insurance',
    question_order: 8,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-009',
    question_text: 'Is business continuity planning in place for fleet-related disruptions?',
    module_name: 'Risk Management & Insurance',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'RMI-010',
    question_text: 'Are risk mitigation measures cost-effective and regularly reviewed for improvement?',
    module_name: 'Risk Management & Insurance',
    question_order: 10,
    max_score: 2,
    requires_evidence: false
  }
];

// =============================================================================
// TEMPLATE 8: DATA MANAGEMENT & TELEMATICS (10 Questions)
// =============================================================================
export const dataManagementTelematicsQuestions: AuditQuestion[] = [
  {
    id: 'DMT-001',
    question_text: 'Is a fleet management information system (FMIS) implemented and utilized effectively?',
    module_name: 'Data Management & Telematics',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-002',
    question_text: 'Are telematics or GPS tracking systems deployed across the fleet?',
    module_name: 'Data Management & Telematics',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-003',
    question_text: 'Is vehicle and driver data collected, stored, and managed securely?',
    module_name: 'Data Management & Telematics',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-004',
    question_text: 'Are data privacy and protection regulations complied with?',
    module_name: 'Data Management & Telematics',
    question_order: 4,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-005',
    question_text: 'Is telematics data used to monitor and improve driver behavior?',
    module_name: 'Data Management & Telematics',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-006',
    question_text: 'Are automated alerts configured for critical events (speeding, harsh braking, geofencing)?',
    module_name: 'Data Management & Telematics',
    question_order: 6,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-007',
    question_text: 'Is fleet data used for reporting, analytics, and decision-making?',
    module_name: 'Data Management & Telematics',
    question_order: 7,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-008',
    question_text: 'Are data backups performed regularly with tested recovery procedures?',
    module_name: 'Data Management & Telematics',
    question_order: 8,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-009',
    question_text: 'Is there integration between the FMIS and other business systems (ERP, HR, finance)?',
    module_name: 'Data Management & Telematics',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'DMT-010',
    question_text: 'Are system users trained and access controls properly managed?',
    module_name: 'Data Management & Telematics',
    question_order: 10,
    max_score: 2,
    requires_evidence: true
  }
];

// =============================================================================
// TEMPLATE 9: ENVIRONMENTAL & SUSTAINABILITY (10 Questions)
// =============================================================================
export const environmentalSustainabilityQuestions: AuditQuestion[] = [
  {
    id: 'ES-001',
    question_text: 'Is there a documented environmental policy for fleet operations?',
    module_name: 'Environmental & Sustainability',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'ES-002',
    question_text: 'Are carbon emissions and environmental impact monitored and reported?',
    module_name: 'Environmental & Sustainability',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'ES-003',
    question_text: 'Are fuel efficiency targets set to reduce environmental impact?',
    module_name: 'Environmental & Sustainability',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'ES-004',
    question_text: 'Is the adoption of electric, hybrid, or alternative fuel vehicles actively considered?',
    module_name: 'Environmental & Sustainability',
    question_order: 4,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'ES-005',
    question_text: 'Are vehicles regularly maintained to ensure optimal emissions performance?',
    module_name: 'Environmental & Sustainability',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'ES-006',
    question_text: 'Is route optimization used to minimize unnecessary mileage and emissions?',
    module_name: 'Environmental & Sustainability',
    question_order: 6,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'ES-007',
    question_text: 'Are waste products (oil, tires, batteries) disposed of in an environmentally responsible manner?',
    module_name: 'Environmental & Sustainability',
    question_order: 7,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'ES-008',
    question_text: 'Is driver training provided on eco-driving techniques?',
    module_name: 'Environmental & Sustainability',
    question_order: 8,
    max_score: 2,
    requires_evidence: false
  },
  {
    id: 'ES-009',
    question_text: 'Are sustainability metrics included in fleet performance reporting?',
    module_name: 'Environmental & Sustainability',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'ES-010',
    question_text: 'Is there a commitment to continuous improvement in environmental performance?',
    module_name: 'Environmental & Sustainability',
    question_order: 10,
    max_score: 2,
    requires_evidence: false
  }
];

// =============================================================================
// TEMPLATE 10: FINANCIAL MANAGEMENT & COST CONTROL (10 Questions)
// =============================================================================
export const financialManagementCostControlQuestions: AuditQuestion[] = [
  {
    id: 'FMCC-001',
    question_text: 'Is there a documented fleet budget with clear cost categories and allocations?',
    module_name: 'Financial Management & Cost Control',
    question_order: 1,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-002',
    question_text: 'Are fleet costs tracked and analyzed against budget on a regular basis?',
    module_name: 'Financial Management & Cost Control',
    question_order: 2,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-003',
    question_text: 'Is total cost of ownership (TCO) calculated and used for decision-making?',
    module_name: 'Financial Management & Cost Control',
    question_order: 3,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-004',
    question_text: 'Are cost per kilometer/mile and cost per vehicle metrics calculated and monitored?',
    module_name: 'Financial Management & Cost Control',
    question_order: 4,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-005',
    question_text: 'Is there a process for approving and controlling fleet-related expenditures?',
    module_name: 'Financial Management & Cost Control',
    question_order: 5,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-006',
    question_text: 'Are fleet costs allocated appropriately to departments or cost centers?',
    module_name: 'Financial Management & Cost Control',
    question_order: 6,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-007',
    question_text: 'Are cost reduction initiatives identified and implemented regularly?',
    module_name: 'Financial Management & Cost Control',
    question_order: 7,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-008',
    question_text: 'Are fleet financial reports accurate, timely, and distributed to stakeholders?',
    module_name: 'Financial Management & Cost Control',
    question_order: 8,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-009',
    question_text: 'Is lease vs. buy analysis conducted for vehicle acquisition decisions?',
    module_name: 'Financial Management & Cost Control',
    question_order: 9,
    max_score: 2,
    requires_evidence: true
  },
  {
    id: 'FMCC-010',
    question_text: 'Are fleet costs benchmarked against industry standards and best practices?',
    module_name: 'Financial Management & Cost Control',
    question_order: 10,
    max_score: 2,
    requires_evidence: true
  }
];

// =============================================================================
// ALL AUDIT TEMPLATES COMBINED
// =============================================================================
export const allAuditTemplates: AuditTemplate[] = [
  {
    id: 'template-fleet-policy-governance',
    template_name: 'Fleet Policy & Governance',
    description: 'Evaluates the existence and effectiveness of fleet management policies, governance structures, and oversight mechanisms.',
    category: 'Governance',
    questions: fleetPolicyGovernanceQuestions
  },
  {
    id: 'template-vehicle-acquisition-disposal',
    template_name: 'Vehicle Acquisition & Disposal',
    description: 'Assesses processes for vehicle procurement, replacement planning, and disposal to ensure cost-effectiveness and transparency.',
    category: 'Asset Management',
    questions: vehicleAcquisitionDisposalQuestions
  },
  {
    id: 'template-driver-management-safety',
    template_name: 'Driver Management & Safety',
    description: 'Reviews driver recruitment, training, monitoring, and safety programs to minimize risk and improve performance.',
    category: 'Safety',
    questions: driverManagementSafetyQuestions
  },
  {
    id: 'template-vehicle-maintenance-inspections',
    template_name: 'Vehicle Maintenance & Inspections',
    description: 'Evaluates preventive maintenance programs, inspection processes, and workshop management practices.',
    category: 'Operations',
    questions: vehicleMaintenanceInspectionsQuestions
  },
  {
    id: 'template-fuel-management-efficiency',
    template_name: 'Fuel Management & Efficiency',
    description: 'Assesses fuel procurement, consumption monitoring, efficiency programs, and cost control measures.',
    category: 'Operations',
    questions: fuelManagementEfficiencyQuestions
  },
  {
    id: 'template-compliance-regulatory',
    template_name: 'Compliance & Regulatory',
    description: 'Reviews compliance with vehicle licensing, insurance, safety regulations, and legal requirements.',
    category: 'Compliance',
    questions: complianceRegulatoryQuestions
  },
  {
    id: 'template-risk-management-insurance',
    template_name: 'Risk Management & Insurance',
    description: 'Evaluates risk identification, mitigation strategies, insurance coverage, and claims management processes.',
    category: 'Risk',
    questions: riskManagementInsuranceQuestions
  },
  {
    id: 'template-data-management-telematics',
    template_name: 'Data Management & Telematics',
    description: 'Assesses the use of fleet management systems, telematics, data security, and analytics capabilities.',
    category: 'Technology',
    questions: dataManagementTelematicsQuestions
  },
  {
    id: 'template-environmental-sustainability',
    template_name: 'Environmental & Sustainability',
    description: 'Reviews environmental policies, emissions monitoring, sustainability initiatives, and eco-driving programs.',
    category: 'Sustainability',
    questions: environmentalSustainabilityQuestions
  },
  {
    id: 'template-financial-management-cost-control',
    template_name: 'Financial Management & Cost Control',
    description: 'Evaluates budgeting, cost tracking, financial reporting, and cost reduction initiatives for fleet operations.',
    category: 'Finance',
    questions: financialManagementCostControlQuestions
  }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export const getMaturityRating = (totalScore: number): { rating: string; color: string; description: string } => {
  if (totalScore >= 170) {
    return { 
      rating: 'World Class', 
      color: '#10B981', 
      description: 'Exemplary fleet management practices with continuous improvement culture' 
    };
  } else if (totalScore >= 140) {
    return { 
      rating: 'Strong', 
      color: '#3B82F6', 
      description: 'Well-established processes with good governance and control' 
    };
  } else if (totalScore >= 100) {
    return { 
      rating: 'Developing', 
      color: '#F59E0B', 
      description: 'Basic systems in place but requiring further development' 
    };
  } else if (totalScore >= 60) {
    return { 
      rating: 'Weak', 
      color: '#EF4444', 
      description: 'Significant gaps in processes and controls requiring immediate attention' 
    };
  } else {
    return { 
      rating: 'High Risk', 
      color: '#7C3AED', 
      description: 'Critical deficiencies posing substantial operational and compliance risks' 
    };
  }
};

export const getScoreLabel = (score: number): string => {
  switch (score) {
    case 0: return 'Not Implemented';
    case 1: return 'Partially Implemented';
    case 2: return 'Fully Implemented';
    default: return 'Not Rated';
  }
};

export const getScoreColor = (score: number): string => {
  switch (score) {
    case 0: return '#EF4444'; // Red
    case 1: return '#F59E0B'; // Orange
    case 2: return '#10B981'; // Green
    default: return '#9CA3AF'; // Gray
  }
};

export const calculateTemplateScore = (responses: { question_id: string; score: number }[]): { 
  totalScore: number; 
  maxScore: number; 
  percentage: number;
} => {
  const totalScore = responses.reduce((sum, r) => sum + (r.score || 0), 0);
  const maxScore = responses.length * 2;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  return { totalScore, maxScore, percentage };
};

export default allAuditTemplates;
