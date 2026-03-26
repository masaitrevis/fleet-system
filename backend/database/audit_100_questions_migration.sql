-- ============================================
-- AUDIT MODULE MIGRATION - 100 Questions Support
-- Run this after the base schema is created
-- ============================================

-- Add category column to audit_templates
ALTER TABLE audit_templates 
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add maturity_rating column to audit_sessions
ALTER TABLE audit_sessions 
ADD COLUMN IF NOT EXISTS maturity_rating VARCHAR(50),
ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Update max_score default to 2 (0=Not Implemented, 1=Partially, 2=Fully)
ALTER TABLE audit_questions 
ALTER COLUMN max_score SET DEFAULT 2;

-- Add score column to audit_responses (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_responses' AND column_name = 'score') THEN
    ALTER TABLE audit_responses ADD COLUMN score INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add updated_at to audit_responses
ALTER TABLE audit_responses 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update constraints
ALTER TABLE audit_sessions 
DROP CONSTRAINT IF EXISTS audit_sessions_status_check;

ALTER TABLE audit_sessions 
ADD CONSTRAINT audit_sessions_status_check 
CHECK (status IN ('Draft', 'In Progress', 'Completed', 'Cancelled'));

ALTER TABLE audit_sessions 
DROP CONSTRAINT IF EXISTS audit_sessions_risk_level_check;

ALTER TABLE audit_sessions 
ADD CONSTRAINT audit_sessions_risk_level_check 
CHECK (risk_level IN ('Low', 'Moderate', 'High', 'Critical'));

ALTER TABLE audit_corrective_actions 
DROP CONSTRAINT IF EXISTS audit_corrective_actions_status_check;

ALTER TABLE audit_corrective_actions 
ADD CONSTRAINT audit_corrective_actions_status_check 
CHECK (status IN ('Open', 'In Progress', 'Completed', 'Overdue'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_sessions_status ON audit_sessions(status);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_template ON audit_sessions(template_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_auditor ON audit_sessions(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audit_responses_session ON audit_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_responses_question ON audit_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_audit_questions_template ON audit_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_audit_corrective_actions_session ON audit_corrective_actions(session_id);

-- ============================================
-- INSERT 10 AUDIT TEMPLATES WITH 100 QUESTIONS
-- ============================================

-- Helper function to check if template exists
CREATE OR REPLACE FUNCTION template_exists(template_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM audit_templates WHERE id = template_id);
END;
$$ LANGUAGE plpgsql;

-- Template 1: Fleet Policy & Governance
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-fleet-policy-governance', 'Fleet Policy & Governance', 
       'Evaluates the existence and effectiveness of fleet management policies, governance structures, and oversight mechanisms.', 
       'Governance', true
WHERE NOT template_exists('template-fleet-policy-governance'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('FPG-001', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Does the organization have a documented Fleet Management Policy that is approved by senior management?', 1, 2, true),
('FPG-002', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Is the Fleet Management Policy reviewed and updated at least annually?', 2, 2, true),
('FPG-003', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Are roles and responsibilities for fleet management clearly defined and documented?', 3, 2, true),
('FPG-004', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Is there a designated Fleet Manager with appropriate authority and resources?', 4, 2, false),
('FPG-005', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Does the organization have a fleet committee or governance structure for oversight?', 5, 2, true),
('FPG-006', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Are fleet management objectives aligned with organizational strategic goals?', 6, 2, false),
('FPG-007', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Is there a documented process for fleet-related decision-making and approvals?', 7, 2, true),
('FPG-008', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Are fleet performance metrics and KPIs established and monitored regularly?', 8, 2, true),
('FPG-009', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Does the organization conduct regular fleet management audits and reviews?', 9, 2, true),
('FPG-010', 'template-fleet-policy-governance', 'Fleet Policy & Governance', 'Is there a documented business continuity plan for critical fleet operations?', 10, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Template 2: Vehicle Acquisition & Disposal
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 
       'Assesses processes for vehicle procurement, replacement planning, and disposal to ensure cost-effectiveness and transparency.', 
       'Asset Management', true
WHERE NOT template_exists('template-vehicle-acquisition-disposal'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('VAD-001', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Is there a documented vehicle acquisition policy and procedure?', 1, 2, true),
('VAD-002', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Are vehicle specifications defined based on operational requirements and not personal preference?', 2, 2, false),
('VAD-003', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Is a total cost of ownership (TCO) analysis conducted before vehicle acquisition?', 3, 2, true),
('VAD-004', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Are competitive procurement processes followed for vehicle purchases?', 4, 2, true),
('VAD-005', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Is there a documented vehicle replacement policy based on age, mileage, or condition criteria?', 5, 2, true),
('VAD-006', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Are vehicles disposed of through transparent and competitive processes?', 6, 2, true),
('VAD-007', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Is residual value optimization considered in disposal decisions?', 7, 2, false),
('VAD-008', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Are all vehicle acquisitions properly registered and documented in the fleet management system?', 8, 2, true),
('VAD-009', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Is there a process for evaluating and selecting vehicle financing options (purchase, lease, rental)?', 9, 2, true),
('VAD-010', 'template-vehicle-acquisition-disposal', 'Vehicle Acquisition & Disposal', 'Are disposal transactions properly authorized and documented with audit trails?', 10, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Template 3: Driver Management & Safety
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-driver-management-safety', 'Driver Management & Safety', 
       'Reviews driver recruitment, training, monitoring, and safety programs to minimize risk and improve performance.', 
       'Safety', true
WHERE NOT template_exists('template-driver-management-safety'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('DMS-001', 'template-driver-management-safety', 'Driver Management & Safety', 'Are all drivers properly licensed and verified before assignment?', 1, 2, true),
('DMS-002', 'template-driver-management-safety', 'Driver Management & Safety', 'Is there a formal driver recruitment and vetting process including background checks?', 2, 2, true),
('DMS-003', 'template-driver-management-safety', 'Driver Management & Safety', 'Are drivers required to undergo initial and periodic training on defensive driving?', 3, 2, true),
('DMS-004', 'template-driver-management-safety', 'Driver Management & Safety', 'Is driver behavior monitored through telematics, dashcams, or other technologies?', 4, 2, true),
('DMS-005', 'template-driver-management-safety', 'Driver Management & Safety', 'Are drivers subject to regular medical fitness assessments?', 5, 2, true),
('DMS-006', 'template-driver-management-safety', 'Driver Management & Safety', 'Is there a documented disciplinary process for traffic violations and unsafe driving?', 6, 2, true),
('DMS-007', 'template-driver-management-safety', 'Driver Management & Safety', 'Are driver safety incentives or recognition programs in place?', 7, 2, false),
('DMS-008', 'template-driver-management-safety', 'Driver Management & Safety', 'Is there a process for handling driver fatigue and working hour compliance?', 8, 2, true),
('DMS-009', 'template-driver-management-safety', 'Driver Management & Safety', 'Are driver safety scores and performance metrics tracked and reviewed?', 9, 2, true),
('DMS-010', 'template-driver-management-safety', 'Driver Management & Safety', 'Is there a formal process for investigating and learning from driver-related incidents?', 10, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Template 4: Vehicle Maintenance & Inspections
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 
       'Evaluates preventive maintenance programs, inspection processes, and workshop management practices.', 
       'Operations', true
WHERE NOT template_exists('template-vehicle-maintenance-inspections'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('VMI-001', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Is there a documented preventive maintenance schedule for all vehicles?', 1, 2, true),
('VMI-002', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Are pre-trip and post-trip inspections conducted and documented?', 2, 2, true),
('VMI-003', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Is there a system for tracking and scheduling routine maintenance activities?', 3, 2, true),
('VMI-004', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Are maintenance records complete, accurate, and retained for audit purposes?', 4, 2, true),
('VMI-005', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Is there a process for handling breakdowns and emergency repairs?', 5, 2, true),
('VMI-006', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Are spare parts inventory levels monitored and managed effectively?', 6, 2, true),
('VMI-007', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Are authorized workshops and service providers evaluated and approved?', 7, 2, true),
('VMI-008', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Is vehicle downtime minimized through effective maintenance planning?', 8, 2, false),
('VMI-009', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Are warranty claims and manufacturer recalls tracked and acted upon promptly?', 9, 2, true),
('VMI-010', 'template-vehicle-maintenance-inspections', 'Vehicle Maintenance & Inspections', 'Is there a process for analyzing maintenance costs and identifying improvement opportunities?', 10, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Template 5: Fuel Management & Efficiency
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 
       'Assesses fuel procurement, consumption monitoring, efficiency programs, and cost control measures.', 
       'Operations', true
WHERE NOT template_exists('template-fuel-management-efficiency'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('FME-001', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Is there a documented fuel management policy and control procedures?', 1, 2, true),
('FME-002', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Are fuel consumption targets established for different vehicle categories?', 2, 2, true),
('FME-003', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Is fuel consumption monitored and reported on a regular basis?', 3, 2, true),
('FME-004', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Are fuel cards or controlled fueling methods used to prevent unauthorized purchases?', 4, 2, true),
('FME-005', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Is there a process for investigating and addressing fuel variances and anomalies?', 5, 2, true),
('FME-006', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Are fuel efficiency training programs provided to drivers?', 6, 2, false),
('FME-007', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Is vehicle utilization optimized to minimize unnecessary fuel consumption?', 7, 2, false),
('FME-008', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Are alternative fuel options and electric vehicles evaluated for fleet suitability?', 8, 2, false),
('FME-009', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Is fuel data integrated with telematics and fleet management systems?', 9, 2, true),
('FME-010', 'template-fuel-management-efficiency', 'Fuel Management & Efficiency', 'Are fuel cost benchmarks established and performance compared against industry standards?', 10, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Template 6: Compliance & Regulatory
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-compliance-regulatory', 'Compliance & Regulatory', 
       'Reviews compliance with vehicle licensing, insurance, safety regulations, and legal requirements.', 
       'Compliance', true
WHERE NOT template_exists('template-compliance-regulatory'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('CR-001', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Are all vehicles registered and licensed in accordance with legal requirements?', 1, 2, true),
('CR-002', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Is there a system for tracking and renewing vehicle licenses and permits before expiry?', 2, 2, true),
('CR-003', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Are vehicles maintained to meet roadworthiness and safety inspection standards?', 3, 2, true),
('CR-004', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Is there a process for ensuring compliance with emissions and environmental regulations?', 4, 2, true),
('CR-005', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Are all vehicles properly insured with adequate coverage levels?', 5, 2, true),
('CR-006', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Is there a process for handling traffic violations and ensuring timely resolution?', 6, 2, true),
('CR-007', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Are weights and dimensions regulations complied with for commercial vehicles?', 7, 2, true),
('CR-008', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Is there a documented process for handling accidents and incident reporting to authorities?', 8, 2, true),
('CR-009', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Are hours of service and driver working time regulations complied with?', 9, 2, true),
('CR-010', 'template-compliance-regulatory', 'Compliance & Regulatory', 'Is there a process for staying updated on changes to transportation and fleet regulations?', 10, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Template 7: Risk Management & Insurance
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-risk-management-insurance', 'Risk Management & Insurance', 
       'Evaluates risk identification, mitigation strategies, insurance coverage, and claims management processes.', 
       'Risk', true
WHERE NOT template_exists('template-risk-management-insurance'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('RMI-001', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Is there a formal fleet risk management policy and framework?', 1, 2, true),
('RMI-002', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Are fleet risks identified, assessed, and documented in a risk register?', 2, 2, true),
('RMI-003', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Is insurance coverage reviewed regularly to ensure adequacy and competitiveness?', 3, 2, true),
('RMI-004', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Are insurance claims processed efficiently with proper documentation?', 4, 2, true),
('RMI-005', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Is there a process for investigating accidents and implementing preventive measures?', 5, 2, true),
('RMI-006', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Are high-risk drivers and vehicles identified and managed appropriately?', 6, 2, true),
('RMI-007', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Is there a system for tracking and analyzing accident trends and patterns?', 7, 2, true),
('RMI-008', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Are security measures in place to prevent vehicle theft and cargo loss?', 8, 2, true),
('RMI-009', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Is business continuity planning in place for fleet-related disruptions?', 9, 2, true),
('RMI-010', 'template-risk-management-insurance', 'Risk Management & Insurance', 'Are risk mitigation measures cost-effective and regularly reviewed for improvement?', 10, 2, false)
ON CONFLICT (id) DO NOTHING;

-- Template 8: Data Management & Telematics
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-data-management-telematics', 'Data Management & Telematics', 
       'Assesses the use of fleet management systems, telematics, data security, and analytics capabilities.', 
       'Technology', true
WHERE NOT template_exists('template-data-management-telematics'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('DMT-001', 'template-data-management-telematics', 'Data Management & Telematics', 'Is a fleet management information system (FMIS) implemented and utilized effectively?', 1, 2, true),
('DMT-002', 'template-data-management-telematics', 'Data Management & Telematics', 'Are telematics or GPS tracking systems deployed across the fleet?', 2, 2, true),
('DMT-003', 'template-data-management-telematics', 'Data Management & Telematics', 'Is vehicle and driver data collected, stored, and managed securely?', 3, 2, true),
('DMT-004', 'template-data-management-telematics', 'Data Management & Telematics', 'Are data privacy and protection regulations complied with?', 4, 2, true),
('DMT-005', 'template-data-management-telematics', 'Data Management & Telematics', 'Is telematics data used to monitor and improve driver behavior?', 5, 2, true),
('DMT-006', 'template-data-management-telematics', 'Data Management & Telematics', 'Are automated alerts configured for critical events (speeding, harsh braking, geofencing)?', 6, 2, true),
('DMT-007', 'template-data-management-telematics', 'Data Management & Telematics', 'Is fleet data used for reporting, analytics, and decision-making?', 7, 2, true),
('DMT-008', 'template-data-management-telematics', 'Data Management & Telematics', 'Are data backups performed regularly with tested recovery procedures?', 8, 2, true),
('DMT-009', 'template-data-management-telematics', 'Data Management & Telematics', 'Is there integration between the FMIS and other business systems (ERP, HR, finance)?', 9, 2, true),
('DMT-010', 'template-data-management-telematics', 'Data Management & Telematics', 'Are system users trained and access controls properly managed?', 10, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Template 9: Environmental & Sustainability
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-environmental-sustainability', 'Environmental & Sustainability', 
       'Reviews environmental policies, emissions monitoring, sustainability initiatives, and eco-driving programs.', 
       'Sustainability', true
WHERE NOT template_exists('template-environmental-sustainability'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('ES-001', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Is there a documented environmental policy for fleet operations?', 1, 2, true),
('ES-002', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Are carbon emissions and environmental impact monitored and reported?', 2, 2, true),
('ES-003', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Are fuel efficiency targets set to reduce environmental impact?', 3, 2, true),
('ES-004', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Is the adoption of electric, hybrid, or alternative fuel vehicles actively considered?', 4, 2, false),
('ES-005', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Are vehicles regularly maintained to ensure optimal emissions performance?', 5, 2, true),
('ES-006', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Is route optimization used to minimize unnecessary mileage and emissions?', 6, 2, true),
('ES-007', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Are waste products (oil, tires, batteries) disposed of in an environmentally responsible manner?', 7, 2, true),
('ES-008', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Is driver training provided on eco-driving techniques?', 8, 2, false),
('ES-009', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Are sustainability metrics included in fleet performance reporting?', 9, 2, true),
('ES-010', 'template-environmental-sustainability', 'Environmental & Sustainability', 'Is there a commitment to continuous improvement in environmental performance?', 10, 2, false)
ON CONFLICT (id) DO NOTHING;

-- Template 10: Financial Management & Cost Control
INSERT INTO audit_templates (id, template_name, description, category, is_active) 
SELECT 'template-financial-management-cost-control', 'Financial Management & Cost Control', 
       'Evaluates budgeting, cost tracking, financial reporting, and cost reduction initiatives for fleet operations.', 
       'Finance', true
WHERE NOT template_exists('template-financial-management-cost-control'::UUID);

INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence) VALUES
('FMCC-001', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Is there a documented fleet budget with clear cost categories and allocations?', 1, 2, true),
('FMCC-002', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Are fleet costs tracked and analyzed against budget on a regular basis?', 2, 2, true),
('FMCC-003', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Is total cost of ownership (TCO) calculated and used for decision-making?', 3, 2, true),
('FMCC-004', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Are cost per kilometer/mile and cost per vehicle metrics calculated and monitored?', 4, 2, true),
('FMCC-005', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Is there a process for approving and controlling fleet-related expenditures?', 5, 2, true),
('FMCC-006', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Are fleet costs allocated appropriately to departments or cost centers?', 6, 2, true),
('FMCC-007', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Are cost reduction initiatives identified and implemented regularly?', 7, 2, true),
('FMCC-008', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Are fleet financial reports accurate, timely, and distributed to stakeholders?', 8, 2, true),
('FMCC-009', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Is lease vs. buy analysis conducted for vehicle acquisition decisions?', 9, 2, true),
('FMCC-010', 'template-financial-management-cost-control', 'Financial Management & Cost Control', 'Are fleet costs benchmarked against industry standards and best practices?', 10, 2, true)
ON CONFLICT (id) DO NOTHING;

-- Verify counts
SELECT 'Templates created: ' || COUNT(*)::text as result FROM audit_templates WHERE id LIKE 'template-%';
SELECT 'Questions created: ' || COUNT(*)::text as result FROM audit_questions WHERE id ~ '^(FPG|VAD|DMS|VMI|FME|CR|RMI|DMT|ES|FMCC)-';

-- Drop helper function
DROP FUNCTION IF EXISTS template_exists(UUID);
