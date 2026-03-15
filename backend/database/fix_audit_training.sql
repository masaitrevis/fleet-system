-- ============================================
-- FIX: Create missing training_courses table and seed data
-- ============================================

-- Create training_courses table (THIS WAS MISSING!)
CREATE TABLE IF NOT EXISTS training_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code VARCHAR(50) UNIQUE NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL, -- 'Safety', 'Compliance', 'Technical', 'Soft Skills'
    duration_hours INTEGER DEFAULT 1,
    validity_months INTEGER, -- Certificate validity period (null = never expires)
    mandatory BOOLEAN DEFAULT false,
    passing_score INTEGER DEFAULT 70,
    created_by UUID REFERENCES staff(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default training courses
INSERT INTO training_courses (course_code, course_name, description, category, duration_hours, validity_months, mandatory) VALUES
('DEF-001', 'Defensive Driving Fundamentals', 'Essential defensive driving techniques for fleet drivers including hazard awareness, safe following distances, and collision prevention.', 'Safety', 4, 12, true),
('DEF-002', 'Advanced Defensive Driving', 'Advanced techniques for challenging conditions including night driving, adverse weather, and emergency maneuvers.', 'Safety', 6, 24, false),
('HOS-001', 'Hours of Service Compliance', 'Understanding Hours of Service regulations, logbook requirements, and fatigue management.', 'Compliance', 2, 12, true),
('DVIR-001', 'Daily Vehicle Inspection Report', 'How to properly conduct pre-trip and post-trip vehicle inspections and complete DVIR documentation.', 'Compliance', 2, 12, true),
('HAZ-001', 'Hazmat Transportation Basics', 'Basic hazardous materials transportation requirements, placarding, and emergency response.', 'Compliance', 4, 12, false),
('ACC-001', 'Accident Prevention & Response', 'Techniques for preventing accidents and proper procedures when accidents occur.', 'Safety', 3, 12, true),
('FUE-001', 'Fuel Efficiency & Eco-Driving', 'Best practices for fuel-efficient driving to reduce costs and environmental impact.', 'Technical', 2, NULL, false),
('CUST-001', 'Customer Service Excellence', 'Professional communication and service skills for drivers interacting with customers.', 'Soft Skills', 2, NULL, false),
('SEC-001', 'Cargo Security & Theft Prevention', 'Procedures for securing cargo and preventing theft during transport.', 'Safety', 2, 12, false),
('DRUG-001', 'Drug & Alcohol Awareness', 'Understanding drug and alcohol policies, testing procedures, and impairment recognition.', 'Compliance', 1, 12, true)
ON CONFLICT (course_code) DO NOTHING;

-- ============================================
-- FIX: Ensure audit templates are seeded
-- ============================================

-- Create default audit template if not exists
INSERT INTO audit_templates (id, template_name, description, is_active)
SELECT 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    'G4S Fleet Standard Audit',
    'Comprehensive fleet operations audit covering 8 core modules with 45 checkpoint questions',
    true
WHERE NOT EXISTS (SELECT 1 FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit');

-- Insert audit questions if template exists but questions don't
DO $$
DECLARE
    template_id UUID;
BEGIN
    SELECT id INTO template_id FROM audit_templates WHERE template_name = 'G4S Fleet Standard Audit' LIMIT 1;
    
    IF template_id IS NOT NULL THEN
        -- Only insert if no questions exist for this template
        IF NOT EXISTS (SELECT 1 FROM audit_questions WHERE template_id = template_id) THEN
            
            -- Fleet Governance & Policy (1-6)
            INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
            (template_id, 'Fleet Governance & Policy', 'Fleet policy is available and approved', 1, true),
            (template_id, 'Fleet Governance & Policy', 'Vehicle usage policy is defined and communicated', 2, true),
            (template_id, 'Fleet Governance & Policy', 'Driver authorization procedures are in place', 3, false),
            (template_id, 'Fleet Governance & Policy', 'Fuel management policy exists', 4, true),
            (template_id, 'Fleet Governance & Policy', 'Accident reporting procedures are documented', 5, true),
            (template_id, 'Fleet Governance & Policy', 'Preventive maintenance policy is enforced', 6, true);

            -- Vehicle Compliance & Licensing (7-13)
            INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
            (template_id, 'Vehicle Compliance & Licensing', 'All vehicles have valid registration', 7, true),
            (template_id, 'Vehicle Compliance & Licensing', 'Insurance is valid for all vehicles', 8, true),
            (template_id, 'Vehicle Compliance & Licensing', 'Road licenses are current', 9, true),
            (template_id, 'Vehicle Compliance & Licensing', 'Inspection certificates are up to date', 10, true),
            (template_id, 'Vehicle Compliance & Licensing', 'Speed governors are installed and functional', 11, true),
            (template_id, 'Vehicle Compliance & Licensing', 'Vehicle tracking system is operational', 12, true),
            (template_id, 'Vehicle Compliance & Licensing', 'NTSA compliance is maintained (Kenya)', 13, true);

            -- Preventive Maintenance (14-19)
            INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
            (template_id, 'Preventive Maintenance', 'Preventive maintenance schedule is available', 14, true),
            (template_id, 'Preventive Maintenance', 'Service intervals are being followed', 15, true),
            (template_id, 'Preventive Maintenance', 'Maintenance records are updated', 16, true),
            (template_id, 'Preventive Maintenance', 'Breakdown frequency is monitored', 17, false),
            (template_id, 'Preventive Maintenance', 'Spare parts control system exists', 18, false),
            (template_id, 'Preventive Maintenance', 'Workshop quality control is in place', 19, false);

            -- Driver Management & Safety (20-25)
            INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
            (template_id, 'Driver Management & Safety', 'All drivers have valid licenses', 20, true),
            (template_id, 'Driver Management & Safety', 'Driver training records are maintained', 21, true),
            (template_id, 'Driver Management & Safety', 'Defensive driving certification is current', 22, true),
            (template_id, 'Driver Management & Safety', 'Driver working hours are monitored', 23, false),
            (template_id, 'Driver Management & Safety', 'Accident history is tracked per driver', 24, false),
            (template_id, 'Driver Management & Safety', 'Driver disciplinary records are maintained', 25, false);

            -- Fuel Management (26-30)
            INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
            (template_id, 'Fuel Management', 'Fuel monitoring system is installed', 26, true),
            (template_id, 'Fuel Management', 'Fuel consumption is tracked per vehicle', 27, true),
            (template_id, 'Fuel Management', 'Fuel variance is controlled', 28, true),
            (template_id, 'Fuel Management', 'Fuel card management system exists', 29, false),
            (template_id, 'Fuel Management', 'Fuel theft controls are in place', 30, false);

            -- Fleet Utilization (31-35)
            INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
            (template_id, 'Fleet Utilization', 'Vehicle usage is tracked', 31, true),
            (template_id, 'Fleet Utilization', 'Idle time is monitored', 32, false),
            (template_id, 'Fleet Utilization', 'Trip authorization system exists', 33, true),
            (template_id, 'Fleet Utilization', 'Route planning is optimized', 34, false),
            (template_id, 'Fleet Utilization', 'Vehicle downtime is tracked', 35, true);

            -- Cost Control (36-40)
            INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
            (template_id, 'Cost Control', 'Total cost of ownership is tracked', 36, true),
            (template_id, 'Cost Control', 'Maintenance costs are monitored', 37, true),
            (template_id, 'Cost Control', 'Fuel costs are monitored', 38, true),
            (template_id, 'Cost Control', 'Lease vs ownership analysis is performed', 39, false),
            (template_id, 'Cost Control', 'Cost per km is analyzed', 40, true);

            -- Incident & Risk Management (41-45)
            INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
            (template_id, 'Incident & Risk Management', 'Accident reporting system is functional', 41, true),
            (template_id, 'Incident & Risk Management', 'Incident investigations are conducted', 42, true),
            (template_id, 'Incident & Risk Management', 'Root cause analysis is performed', 43, true),
            (template_id, 'Incident & Risk Management', 'Corrective actions are tracked', 44, true),
            (template_id, 'Incident & Risk Management', 'Insurance claims are managed properly', 45, false);

        END IF;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_category ON training_courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_mandatory ON training_courses(mandatory);

-- ============================================
-- Additional Audit Templates
-- ============================================

-- DVIR (Daily Vehicle Inspection Report) Template
INSERT INTO audit_templates (id, template_name, description, is_active)
SELECT 
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    'Daily Vehicle Inspection (DVIR)',
    'Pre-trip and post-trip vehicle inspection checklist for drivers',
    true
WHERE NOT EXISTS (SELECT 1 FROM audit_templates WHERE template_name = 'Daily Vehicle Inspection (DVIR)');

-- DOT Compliance Audit Template  
INSERT INTO audit_templates (id, template_name, description, is_active)
SELECT 
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'DOT Compliance Audit',
    'Department of Transportation regulatory compliance inspection',
    true
WHERE NOT EXISTS (SELECT 1 FROM audit_templates WHERE template_name = 'DOT Compliance Audit');

-- Add DVIR questions if template exists
DO $$
DECLARE
    dvir_id UUID;
BEGIN
    SELECT id INTO dvir_id FROM audit_templates WHERE template_name = 'Daily Vehicle Inspection (DVIR)' LIMIT 1;
    
    IF dvir_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audit_questions WHERE template_id = dvir_id) THEN
        INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
        (dvir_id, 'Brakes', 'Service brakes functioning properly', 1, true),
        (dvir_id, 'Brakes', 'Parking brake holds vehicle', 2, true),
        (dvir_id, 'Steering', 'Steering mechanism operates smoothly', 3, true),
        (dvir_id, 'Tires', 'Tires properly inflated and have adequate tread', 4, true),
        (dvir_id, 'Wheels', 'Wheels and rims undamaged', 5, true),
        (dvir_id, 'Lights', 'All lights working (headlights, brake lights, turn signals)', 6, true),
        (dvir_id, 'Mirrors', 'Mirrors clean and properly adjusted', 7, false),
        (dvir_id, 'Windshield', 'Windshield clean and free of cracks', 8, false),
        (dvir_id, 'Wipers', 'Wiper blades in good condition', 9, false),
        (dvir_id, 'Horn', 'Horn functioning', 10, false),
        (dvir_id, 'Emergency', 'Emergency equipment present (fire extinguisher, triangles, first aid)', 11, true),
        (dvir_id, 'Fluid Levels', 'Oil, coolant, and other fluid levels adequate', 12, false),
        (dvir_id, 'Documentation', 'Registration and insurance documents present', 13, true);
    END IF;
END $$;

-- Add DOT questions if template exists
DO $$
DECLARE
    dot_id UUID;
BEGIN
    SELECT id INTO dot_id FROM audit_templates WHERE template_name = 'DOT Compliance Audit' LIMIT 1;
    
    IF dot_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audit_questions WHERE template_id = dot_id) THEN
        INSERT INTO audit_questions (template_id, module_name, question_text, question_order, requires_evidence) VALUES
        (dot_id, 'Brake System', 'Brake lines, hoses, and connections inspected', 1, true),
        (dot_id, 'Brake System', 'Brake drums/rotors within wear limits', 2, true),
        (dot_id, 'Brake System', 'Brake pads/shoes adequate thickness', 3, true),
        (dot_id, 'Steering & Suspension', 'Steering linkage tight and secure', 4, true),
        (dot_id, 'Steering & Suspension', 'Suspension components undamaged', 5, true),
        (dot_id, 'Tires', 'Tire tread depth minimum 2/32 inch', 6, true),
        (dot_id, 'Tires', 'No visible tire damage or bulges', 7, true),
        (dot_id, 'Lighting', 'All required lights operational', 8, true),
        (dot_id, 'Coupling Devices', 'Fifth wheel and coupling devices secure', 9, true),
        (dot_id, 'Exhaust System', 'Exhaust system intact and secure', 10, true);
    END IF;
END $$;
