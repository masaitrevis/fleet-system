-- ============================================
-- ACCIDENT INVESTIGATION MODULE
-- ============================================

-- Accidents table
CREATE TABLE IF NOT EXISTS accidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  accident_date TIMESTAMP NOT NULL,
  gps_location VARCHAR(255),
  route_id UUID REFERENCES routes(id),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES staff(id),
  
  -- Accident classification
  accident_type VARCHAR(50) CHECK (accident_type IN ('Collision', 'Pedestrian', 'Property Damage', 'Rollover', 'Near Miss')),
  severity VARCHAR(20) CHECK (severity IN ('Minor', 'Major', 'Fatal')),
  injuries_reported BOOLEAN DEFAULT false,
  police_notified BOOLEAN DEFAULT false,
  third_party_involved BOOLEAN DEFAULT false,
  
  -- Conditions
  weather_condition VARCHAR(100),
  road_condition VARCHAR(100),
  
  -- Description
  incident_description TEXT,
  
  -- Status workflow
  status VARCHAR(50) DEFAULT 'Reported' CHECK (status IN ('Reported', 'Under Investigation', 'Root Cause Identified', 'CAPA In Progress', 'Closed')),
  
  -- Closure
  closed_by UUID REFERENCES staff(id),
  closed_at TIMESTAMP,
  closure_remarks TEXT,
  
  -- Metadata
  reported_by UUID REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accident witnesses
CREATE TABLE IF NOT EXISTS accident_witnesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
  witness_name VARCHAR(255),
  witness_contact VARCHAR(255),
  witness_statement TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accident photos/evidence
CREATE TABLE IF NOT EXISTS accident_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
  evidence_type VARCHAR(50) CHECK (evidence_type IN ('Photo', 'Video', 'Document', 'Police Report', 'Dashcam')),
  file_url TEXT,
  file_name VARCHAR(255),
  description TEXT,
  uploaded_by UUID REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accident investigation
CREATE TABLE IF NOT EXISTS accident_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
  investigator_id UUID REFERENCES staff(id),
  investigation_date TIMESTAMP,
  
  -- Scene findings
  scene_findings TEXT,
  vehicle_condition_assessment TEXT,
  driver_condition_assessment TEXT,
  
  -- Compliance checks
  valid_license BOOLEAN,
  driver_training_compliant BOOLEAN,
  speed_compliance BOOLEAN,
  fatigue_status VARCHAR(50),
  alcohol_drug_test VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Root cause analysis
CREATE TABLE IF NOT EXISTS accident_root_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
  
  -- Primary cause
  primary_category VARCHAR(50) CHECK (primary_category IN ('Driver Related', 'Vehicle Related', 'Environmental', 'Organizational')),
  primary_cause VARCHAR(255),
  
  -- Contributing factors (JSON array)
  contributing_factors JSONB DEFAULT '[]',
  
  -- Specific causes
  driver_causes JSONB DEFAULT '[]', -- ['Over speeding', 'Reckless driving', 'Distraction', 'Fatigue', 'Poor judgement']
  vehicle_causes JSONB DEFAULT '[]', -- ['Brake failure', 'Tire burst', 'Mechanical defect', 'Poor maintenance']
  environmental_causes JSONB DEFAULT '[]', -- ['Bad weather', 'Poor road condition', 'Visibility issues']
  organizational_causes JSONB DEFAULT '[]', -- ['Poor route planning', 'Inadequate training', 'Work pressure']
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Corrective and Preventive Actions (CAPA)
CREATE TABLE IF NOT EXISTS accident_capa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
  
  action_description TEXT NOT NULL,
  responsible_person_id UUID REFERENCES staff(id),
  target_completion_date DATE,
  priority VARCHAR(20) CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed', 'Overdue')),
  
  actual_completion_date DATE,
  completion_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lessons learned
CREATE TABLE IF NOT EXISTS accident_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
  
  key_lesson TEXT NOT NULL,
  preventive_recommendations TEXT,
  training_required BOOLEAN DEFAULT false,
  training_details TEXT,
  policy_update_needed BOOLEAN DEFAULT false,
  policy_update_details TEXT,
  
  -- For safety briefings
  shared_with_drivers BOOLEAN DEFAULT false,
  shared_date TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- FLEET OPERATIONS AUDIT TOOL
-- ============================================

-- Audit templates (predefined checklists)
CREATE TABLE IF NOT EXISTS audit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit questions
CREATE TABLE IF NOT EXISTS audit_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES audit_templates(id) ON DELETE CASCADE,
  
  module_name VARCHAR(100) NOT NULL, -- 'Governance', 'Compliance', 'Maintenance', etc.
  question_text TEXT NOT NULL,
  question_order INTEGER,
  
  -- Scoring
  max_score INTEGER DEFAULT 100,
  
  -- Evidence required
  requires_evidence BOOLEAN DEFAULT false,
  evidence_type VARCHAR(50), -- 'Photo', 'Document', 'Signature'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit sessions
CREATE TABLE IF NOT EXISTS audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_number VARCHAR(50) UNIQUE NOT NULL,
  template_id UUID REFERENCES audit_templates(id),
  
  -- Audit scope
  branch VARCHAR(100),
  department VARCHAR(100),
  vehicle_ids JSONB DEFAULT '[]', -- Array of vehicle IDs if vehicle-specific
  
  -- Auditor
  auditor_id UUID REFERENCES staff(id),
  
  -- Status
  status VARCHAR(50) DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'Closed')),
  
  -- Scores
  total_score INTEGER,
  max_possible_score INTEGER,
  compliance_percentage DECIMAL(5,2),
  risk_level VARCHAR(20), -- 'Low', 'Moderate', 'High', 'Critical'
  
  -- Dates
  audit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit responses
CREATE TABLE IF NOT EXISTS audit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES audit_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES audit_questions(id),
  
  -- Response
  response VARCHAR(50) CHECK (response IN ('Fully Compliant', 'Partially Compliant', 'Non Compliant', 'Not Applicable')),
  score INTEGER, -- 100, 50, 0, or NULL for N/A
  
  -- Evidence
  evidence_attached BOOLEAN DEFAULT false,
  evidence_urls JSONB DEFAULT '[]',
  
  -- Notes
  notes TEXT,
  gps_location VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit corrective actions
CREATE TABLE IF NOT EXISTS audit_corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES audit_sessions(id) ON DELETE CASCADE,
  response_id UUID REFERENCES audit_responses(id),
  
  issue_identified TEXT NOT NULL,
  risk_level VARCHAR(20) CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
  
  corrective_action TEXT,
  responsible_person_id UUID REFERENCES staff(id),
  deadline DATE,
  status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed', 'Overdue')),
  
  completed_at TIMESTAMP,
  completion_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default audit template
INSERT INTO audit_templates (template_name, description) VALUES 
('G4S Fleet Standard Audit', 'Comprehensive fleet operations audit covering 8 core modules');

-- Insert sample audit questions
INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
-- Fleet Governance (1-6)
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Governance & Policy', 'Fleet policy is available and approved', 1, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Governance & Policy', 'Vehicle usage policy is defined and communicated', 2, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Governance & Policy', 'Driver authorization procedures are in place', 3, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Governance & Policy', 'Fuel management policy exists', 4, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Governance & Policy', 'Accident reporting procedures are documented', 5, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Governance & Policy', 'Preventive maintenance policy is enforced', 6, true),

-- Vehicle Compliance (7-13)
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Vehicle Compliance & Licensing', 'All vehicles have valid registration', 7, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Vehicle Compliance & Licensing', 'Insurance is valid for all vehicles', 8, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Vehicle Compliance & Licensing', 'Road licenses are current', 9, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Vehicle Compliance & Licensing', 'Inspection certificates are up to date', 10, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Vehicle Compliance & Licensing', 'Speed governors are installed and functional', 11, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Vehicle Compliance & Licensing', 'Vehicle tracking system is operational', 12, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Vehicle Compliance & Licensing', 'NTSA compliance is maintained (Kenya)', 13, true),

-- Preventive Maintenance (14-19)
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Preventive Maintenance', 'Preventive maintenance schedule is available', 14, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Preventive Maintenance', 'Service intervals are being followed', 15, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Preventive Maintenance', 'Maintenance records are updated', 16, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Preventive Maintenance', 'Breakdown frequency is monitored', 17, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Preventive Maintenance', 'Spare parts control system exists', 18, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Preventive Maintenance', 'Workshop quality control is in place', 19, false),

-- Driver Management (20-25)
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Driver Management & Safety', 'All drivers have valid licenses', 20, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Driver Management & Safety', 'Driver training records are maintained', 21, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Driver Management & Safety', 'Defensive driving certification is current', 22, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Driver Management & Safety', 'Driver working hours are monitored', 23, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Driver Management & Safety', 'Accident history is tracked per driver', 24, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Driver Management & Safety', 'Driver disciplinary records are maintained', 25, false),

-- Fuel Management (26-30)
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fuel Management', 'Fuel monitoring system is installed', 26, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fuel Management', 'Fuel consumption is tracked per vehicle', 27, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fuel Management', 'Fuel variance is controlled', 28, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fuel Management', 'Fuel card management system exists', 29, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fuel Management', 'Fuel theft controls are in place', 30, false),

-- Fleet Utilization (31-35)
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Utilization', 'Vehicle usage is tracked', 31, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Utilization', 'Idle time is monitored', 32, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Utilization', 'Trip authorization system exists', 33, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Utilization', 'Route planning is optimized', 34, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Fleet Utilization', 'Vehicle downtime is tracked', 35, true),

-- Cost Control (36-40)
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Cost Control', 'Total cost of ownership is tracked', 36, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Cost Control', 'Maintenance costs are monitored', 37, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Cost Control', 'Fuel costs are monitored', 38, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Cost Control', 'Lease vs ownership analysis is performed', 39, false),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Cost Control', 'Cost per km is analyzed', 40, true),

-- Incident & Risk Management (41-45)
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Incident & Risk Management', 'Accident reporting system is functional', 41, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Incident & Risk Management', 'Incident investigations are conducted', 42, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Incident & Risk Management', 'Root cause analysis is performed', 43, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Incident & Risk Management', 'Corrective actions are tracked', 44, true),
((SELECT id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit'), 'Incident & Risk Management', 'Insurance claims are managed properly', 45, false);

-- Update staff table to add safety_score
ALTER TABLE staff ADD COLUMN IF NOT EXISTS safety_score INTEGER DEFAULT 100;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS safety_rating VARCHAR(20) DEFAULT 'Excellent';
