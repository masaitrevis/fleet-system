-- ============================================
-- VEHICLE INSPECTION MODULE MIGRATION
-- Run this to add inspection capabilities to fleet system
-- ============================================

-- ============================================
-- CORE INSPECTION TABLES
-- ============================================

-- Main Inspection Records Table
CREATE TABLE IF NOT EXISTS vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Links to other modules
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    requisition_id UUID REFERENCES requisitions(id) ON DELETE SET NULL,
    
    -- Inspection Type & Timing
    inspection_type VARCHAR(50) NOT NULL CHECK (inspection_type IN ('pre_trip', 'post_trip', 'periodic', 'maintenance', 'accident', 'security')),
    inspection_status VARCHAR(50) DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'in_progress', 'completed', 'failed', 'requires_attention')),
    
    -- Trip Context
    trip_purpose TEXT,
    estimated_distance_km INTEGER,
    route_from VARCHAR(255),
    route_to VARCHAR(255),
    
    -- Odometer Readings
    starting_odometer INTEGER,
    ending_odometer INTEGER,
    distance_traveled INTEGER,
    
    -- Inspection Timing
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Inspector Information
    inspected_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    inspected_by_name VARCHAR(255),
    inspector_role VARCHAR(100),
    
    -- Weather & Environment
    weather_condition VARCHAR(50),
    road_condition VARCHAR(50),
    temperature_celsius INTEGER,
    
    -- Overall Result
    overall_result VARCHAR(20) CHECK (overall_result IN ('pass', 'fail', 'conditional')),
    critical_defects_found BOOLEAN DEFAULT FALSE,
    total_defects_found INTEGER DEFAULT 0,
    defects_summary TEXT,
    
    -- Certification & Compliance
    certification_number VARCHAR(100),
    next_inspection_due DATE,
    compliance_status VARCHAR(50) DEFAULT 'compliant',
    
    -- Signatures
    driver_signature TEXT,
    inspector_signature TEXT,
    supervisor_signature TEXT,
    signed_at TIMESTAMP,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Inspection Categories (e.g., Exterior, Interior, Mechanical, Safety)
CREATE TABLE IF NOT EXISTS inspection_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inspection Items/Checklist (standard inspection points)
CREATE TABLE IF NOT EXISTS inspection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES inspection_categories(id) ON DELETE CASCADE,
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    inspection_type VARCHAR(50)[] DEFAULT ARRAY['pre_trip', 'post_trip', 'periodic'],
    is_critical BOOLEAN DEFAULT FALSE,
    requires_photo BOOLEAN DEFAULT FALSE,
    requires_notes BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, item_code)
);

-- Inspection Results (individual item check results)
CREATE TABLE IF NOT EXISTS inspection_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inspection_items(id),
    
    -- Result
    result_status VARCHAR(50) NOT NULL CHECK (result_status IN ('pass', 'fail', 'na', 'attention')),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Details
    notes TEXT,
    measured_value VARCHAR(255),
    expected_value VARCHAR(255),
    
    -- Photos
    photo_urls TEXT[],
    
    -- Correction Actions
    corrected_at TIMESTAMP,
    corrected_by UUID REFERENCES staff(id),
    correction_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(inspection_id, item_id)
);

-- Inspection Defects (for tracking defects that need follow-up)
CREATE TABLE IF NOT EXISTS inspection_defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
    result_id UUID REFERENCES inspection_results(id) ON DELETE SET NULL,
    
    -- Defect Details
    defect_description TEXT NOT NULL,
    defect_category VARCHAR(100),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Location/Component
    component_area VARCHAR(100),
    position_on_vehicle VARCHAR(100),
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'reported' CHECK (status IN ('reported', 'under_review', 'scheduled', 'in_repair', 'resolved', 'waived')),
    
    -- Resolution
    resolution_notes TEXT,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES staff(id),
    
    -- Linked Records
    job_card_id UUID REFERENCES job_cards(id),
    repair_id UUID,
    
    -- Photos
    photo_urls TEXT[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inspection Templates (for creating standardized inspection forms)
CREATE TABLE IF NOT EXISTS inspection_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(255) NOT NULL,
    template_code VARCHAR(50) UNIQUE,
    description TEXT,
    inspection_type VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(100),
    
    -- Template Items (JSON array of item requirements)
    required_items JSONB,
    
    -- Settings
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inspection Schedule (for periodic inspections)
CREATE TABLE IF NOT EXISTS inspection_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    
    -- Schedule Settings
    schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'mileage', 'quarterly', 'annual')),
    frequency_value INTEGER DEFAULT 1,
    
    -- Triggers
    next_mileage_threshold INTEGER,
    next_date DATE,
    
    -- Current Status
    last_inspection_id UUID REFERENCES vehicle_inspections(id),
    last_inspection_date DATE,
    last_inspection_mileage INTEGER,
    
    -- Notification Settings
    reminder_days_before INTEGER DEFAULT 3,
    notify_roles VARCHAR(50)[],
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inspections_vehicle ON vehicle_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspections_driver ON vehicle_inspections(driver_id);
CREATE INDEX IF NOT EXISTS idx_inspections_route ON vehicle_inspections(route_id);
CREATE INDEX IF NOT EXISTS idx_inspections_requisition ON vehicle_inspections(requisition_id);
CREATE INDEX IF NOT EXISTS idx_inspections_type ON vehicle_inspections(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON vehicle_inspections(inspection_status);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON vehicle_inspections(created_at);
CREATE INDEX IF NOT EXISTS idx_inspections_scheduled ON vehicle_inspections(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_inspections_next_due ON vehicle_inspections(next_inspection_due);

CREATE INDEX IF NOT EXISTS idx_results_inspection ON inspection_results(inspection_id);
CREATE INDEX IF NOT EXISTS idx_results_item ON inspection_results(item_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON inspection_results(result_status);

CREATE INDEX IF NOT EXISTS idx_defects_inspection ON inspection_defects(inspection_id);
CREATE INDEX IF NOT EXISTS idx_defects_status ON inspection_defects(status);
CREATE INDEX IF NOT EXISTS idx_defects_severity ON inspection_defects(severity);

CREATE INDEX IF NOT EXISTS idx_schedules_vehicle ON inspection_schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_date ON inspection_schedules(next_date);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON inspection_schedules(is_active);

-- ============================================
-- SEED DATA: Inspection Categories
-- ============================================

INSERT INTO inspection_categories (category_code, category_name, description, display_order) VALUES
('EXTERIOR', 'Exterior Inspection', 'Visual inspection of vehicle exterior components', 1),
('INTERIOR', 'Interior Inspection', 'Inspection of cabin and interior features', 2),
('MECHANICAL', 'Mechanical Systems', 'Engine, transmission, and mechanical components', 3),
('SAFETY', 'Safety Equipment', 'All safety-related equipment and features', 4),
('ELECTRICAL', 'Electrical Systems', 'Lights, battery, and electrical components', 5),
('FLUIDS', 'Fluid Levels', 'All fluid levels and conditions', 6),
('TIRES', 'Tires & Wheels', 'Tire condition, pressure, and wheel integrity', 7),
('BRAKES', 'Brake System', 'Brake components and functionality', 8),
('DOCUMENTS', 'Documentation', 'Required documents and permits', 9),
('CARGO', 'Cargo Area', 'Cargo space and securing equipment', 10)
ON CONFLICT (category_code) DO NOTHING;

-- ============================================
-- SEED DATA: Standard Inspection Items
-- ============================================

-- Exterior Items
INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'EXT_BODY', 'Body Condition', 'Check for damage, rust, or structural issues', ARRAY['pre_trip', 'post_trip', 'periodic'], FALSE, TRUE, 1
FROM inspection_categories c WHERE c.category_code = 'EXTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'EXT_WINDSHIELD', 'Windshield & Windows', 'Check for cracks, chips, or visibility obstructions', ARRAY['pre_trip', 'post_trip'], TRUE, TRUE, 2
FROM inspection_categories c WHERE c.category_code = 'EXTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'EXT_MIRRORS', 'Side Mirrors', 'Check all mirrors for damage and proper adjustment', ARRAY['pre_trip', 'post_trip'], TRUE, FALSE, 3
FROM inspection_categories c WHERE c.category_code = 'EXTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'EXT_LIGHTS', 'Exterior Lights', 'Headlights, taillights, brake lights, turn signals', ARRAY['pre_trip', 'post_trip'], TRUE, FALSE, 4
FROM inspection_categories c WHERE c.category_code = 'EXTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'EXT_WIPERS', 'Wiper Blades', 'Condition and operation of wiper blades', ARRAY['pre_trip', 'periodic'], FALSE, FALSE, 5
FROM inspection_categories c WHERE c.category_code = 'EXTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

-- Tire Items
INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'TIRE_PRESSURE', 'Tire Pressure', 'Check and record all tire pressures', ARRAY['pre_trip', 'post_trip'], TRUE, FALSE, 1
FROM inspection_categories c WHERE c.category_code = 'TIRES'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'TIRE_TREAD', 'Tire Tread Depth', 'Minimum tread depth check on all tires', ARRAY['pre_trip', 'periodic'], TRUE, TRUE, 2
FROM inspection_categories c WHERE c.category_code = 'TIRES'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'TIRE_DAMAGE', 'Tire Damage', 'Check for cuts, bulges, or other damage', ARRAY['pre_trip', 'post_trip'], TRUE, TRUE, 3
FROM inspection_categories c WHERE c.category_code = 'TIRES'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'TIRE_SPARE', 'Spare Tire', 'Spare tire condition and pressure', ARRAY['pre_trip', 'periodic'], FALSE, FALSE, 4
FROM inspection_categories c WHERE c.category_code = 'TIRES'
ON CONFLICT (category_id, item_code) DO NOTHING;

-- Brake Items
INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'BRAKE_PEDAL', 'Brake Pedal', 'Pedal feel, travel, and responsiveness', ARRAY['pre_trip', 'post_trip'], TRUE, FALSE, 1
FROM inspection_categories c WHERE c.category_code = 'BRAKES'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'BRAKE_PARKING', 'Parking Brake', 'Holds vehicle securely on incline', ARRAY['pre_trip', 'periodic'], TRUE, FALSE, 2
FROM inspection_categories c WHERE c.category_code = 'BRAKES'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'BRAKE_FLUID', 'Brake Fluid Level', 'Reservoir level and fluid condition', ARRAY['pre_trip', 'periodic'], TRUE, FALSE, 3
FROM inspection_categories c WHERE c.category_code = 'BRAKES'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'BRAKE_PADS', 'Brake Pads/Drums', 'Visual inspection of pad/drum condition', ARRAY['periodic'], FALSE, TRUE, 4
FROM inspection_categories c WHERE c.category_code = 'BRAKES'
ON CONFLICT (category_id, item_code) DO NOTHING;

-- Fluid Items
INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'FLUID_OIL', 'Engine Oil Level', 'Oil level on dipstick', ARRAY['pre_trip', 'periodic'], TRUE, FALSE, 1
FROM inspection_categories c WHERE c.category_code = 'FLUIDS'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'FLUID_COOLANT', 'Coolant Level', 'Radiator and reservoir levels', ARRAY['pre_trip', 'periodic'], TRUE, FALSE, 2
FROM inspection_categories c WHERE c.category_code = 'FLUIDS'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'FLUID_TRANS', 'Transmission Fluid', 'Level and condition of transmission fluid', ARRAY['periodic'], FALSE, FALSE, 3
FROM inspection_categories c WHERE c.category_code = 'FLUIDS'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'FLUID_POWER', 'Power Steering', 'Steering fluid level', ARRAY['pre_trip', 'periodic'], FALSE, FALSE, 4
FROM inspection_categories c WHERE c.category_code = 'FLUIDS'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'FLUID_WASHER', 'Washer Fluid', 'Windshield washer fluid level', ARRAY['pre_trip'], FALSE, FALSE, 5
FROM inspection_categories c WHERE c.category_code = 'FLUIDS'
ON CONFLICT (category_id, item_code) DO NOTHING;

-- Safety Equipment Items
INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'SAFE_SEATBELT', 'Seat Belts', 'All seat belts functional and not damaged', ARRAY['pre_trip', 'post_trip'], TRUE, FALSE, 1
FROM inspection_categories c WHERE c.category_code = 'SAFETY'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'SAFE_HORN', 'Horn', 'Horn operates correctly', ARRAY['pre_trip'], TRUE, FALSE, 2
FROM inspection_categories c WHERE c.category_code = 'SAFETY'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'SAFE_EXTINGUISHER', 'Fire Extinguisher', 'Present, charged, and accessible', ARRAY['pre_trip', 'periodic'], TRUE, TRUE, 3
FROM inspection_categories c WHERE c.category_code = 'SAFETY'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'SAFE_FIRSTAID', 'First Aid Kit', 'Complete and accessible', ARRAY['pre_trip', 'periodic'], TRUE, FALSE, 4
FROM inspection_categories c WHERE c.category_code = 'SAFETY'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'SAFE_TRIANGLES', 'Warning Triangles', 'Warning triangles present', ARRAY['pre_trip', 'periodic'], TRUE, FALSE, 5
FROM inspection_categories c WHERE c.category_code = 'SAFETY'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'SAFE_JACK', 'Jack & Tools', 'Jack and wheel changing tools present', ARRAY['pre_trip', 'periodic'], FALSE, FALSE, 6
FROM inspection_categories c WHERE c.category_code = 'SAFETY'
ON CONFLICT (category_id, item_code) DO NOTHING;

-- Interior Items
INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'INT_CLEAN', 'Interior Cleanliness', 'Clean cabin and cargo area', ARRAY['pre_trip', 'post_trip'], FALSE, FALSE, 1
FROM inspection_categories c WHERE c.category_code = 'INTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'INT_CONTROLS', 'Dashboard Controls', 'All gauges and controls functional', ARRAY['pre_trip'], TRUE, FALSE, 2
FROM inspection_categories c WHERE c.category_code = 'INTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'INT_ODOMETER', 'Odometer Reading', 'Record current mileage', ARRAY['pre_trip', 'post_trip'], TRUE, TRUE, 3
FROM inspection_categories c WHERE c.category_code = 'INTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'INT_SEATS', 'Driver Seat', 'Seat adjustment and condition', ARRAY['pre_trip'], FALSE, FALSE, 4
FROM inspection_categories c WHERE c.category_code = 'INTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'INT_HVAC', 'Heating/AC', 'Climate control functional', ARRAY['pre_trip'], FALSE, FALSE, 5
FROM inspection_categories c WHERE c.category_code = 'INTERIOR'
ON CONFLICT (category_id, item_code) DO NOTHING;

-- Mechanical Items
INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'MECH_ENGINE', 'Engine Operation', 'Starts smoothly, no unusual noises', ARRAY['pre_trip', 'post_trip'], TRUE, FALSE, 1
FROM inspection_categories c WHERE c.category_code = 'MECHANICAL'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'MECH_STEERING', 'Steering', 'Responsive, no excessive play', ARRAY['pre_trip', 'post_trip'], TRUE, FALSE, 2
FROM inspection_categories c WHERE c.category_code = 'MECHANICAL'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'MECH_SUSPENSION', 'Suspension', 'No unusual noises, proper ride height', ARRAY['pre_trip', 'periodic'], TRUE, FALSE, 3
FROM inspection_categories c WHERE c.category_code = 'MECHANICAL'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'MECH_EXHAUST', 'Exhaust System', 'No leaks or excessive smoke', ARRAY['pre_trip', 'periodic'], TRUE, FALSE, 4
FROM inspection_categories c WHERE c.category_code = 'MECHANICAL'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'MECH_LEAKS', 'Fluid Leaks', 'No visible fluid leaks under vehicle', ARRAY['pre_trip', 'post_trip'], TRUE, TRUE, 5
FROM inspection_categories c WHERE c.category_code = 'MECHANICAL'
ON CONFLICT (category_id, item_code) DO NOTHING;

-- Document Items
INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'DOC_REGISTRATION', 'Vehicle Registration', 'Valid registration document', ARRAY['pre_trip', 'periodic'], TRUE, TRUE, 1
FROM inspection_categories c WHERE c.category_code = 'DOCUMENTS'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'DOC_INSURANCE', 'Insurance Certificate', 'Valid insurance documentation', ARRAY['pre_trip', 'periodic'], TRUE, TRUE, 2
FROM inspection_categories c WHERE c.category_code = 'DOCUMENTS'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'DOC_LICENSE', 'Driver License', 'Valid driver license for vehicle class', ARRAY['pre_trip'], TRUE, TRUE, 3
FROM inspection_categories c WHERE c.category_code = 'DOCUMENTS'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'DOC_PERMIT', 'Operating Permit', 'Required operating permits present', ARRAY['pre_trip', 'periodic'], TRUE, TRUE, 4
FROM inspection_categories c WHERE c.category_code = 'DOCUMENTS'
ON CONFLICT (category_id, item_code) DO NOTHING;

INSERT INTO inspection_items (category_id, item_code, item_name, description, inspection_type, is_critical, requires_photo, display_order)
SELECT 
    c.id, 'DOC_LOG', 'Log Book', 'Vehicle log book present', ARRAY['pre_trip'], FALSE, FALSE, 5
FROM inspection_categories c WHERE c.category_code = 'DOCUMENTS'
ON CONFLICT (category_id, item_code) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger: Update vehicle status based on inspection
CREATE OR REPLACE FUNCTION update_vehicle_after_inspection()
RETURNS TRIGGER AS $$
BEGIN
    -- If inspection failed with critical defects, mark vehicle as defective
    IF NEW.overall_result = 'fail' AND NEW.critical_defects_found = TRUE THEN
        UPDATE vehicles 
        SET status = 'Defective', 
            defect_notes = NEW.defects_summary,
            defect_reported_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.vehicle_id;
    END IF;
    
    -- Update inspection schedule last inspection info
    UPDATE inspection_schedules
    SET last_inspection_id = NEW.id,
        last_inspection_date = CURRENT_DATE,
        last_inspection_mileage = NEW.starting_odometer,
        next_date = NEW.next_inspection_due
    WHERE vehicle_id = NEW.vehicle_id AND is_active = TRUE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vehicle_after_inspection ON vehicle_inspections;
CREATE TRIGGER trigger_update_vehicle_after_inspection
    AFTER INSERT OR UPDATE ON vehicle_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_after_inspection();

-- Trigger: Auto-create job card for critical defects
CREATE OR REPLACE FUNCTION create_job_card_for_defect()
RETURNS TRIGGER AS $$
DECLARE
    jc_id UUID;
    vehicle_reg VARCHAR(100);
BEGIN
    -- Only process critical or high severity defects
    IF NEW.severity IN ('critical', 'high') AND NEW.status = 'reported' THEN
        -- Get vehicle registration
        SELECT v.registration_num INTO vehicle_reg
        FROM vehicles v
        JOIN vehicle_inspections vi ON vi.vehicle_id = v.id
        WHERE vi.id = NEW.inspection_id;
        
        -- Create job card
        INSERT INTO job_cards (
            id,
            job_card_number,
            vehicle_id,
            defect_description,
            reported_by,
            reported_at,
            status,
            source_type,
            source_id,
            priority
        )
        SELECT 
            gen_random_uuid(),
            'JB-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
            vi.vehicle_id,
            NEW.defect_description,
            vi.inspected_by,
            CURRENT_TIMESTAMP,
            'Pending',
            'inspection',
            NEW.inspection_id,
            CASE NEW.severity 
                WHEN 'critical' THEN 'Critical'
                WHEN 'high' THEN 'High'
                ELSE 'Medium'
            END
        FROM vehicle_inspections vi
        WHERE vi.id = NEW.inspection_id
        RETURNING id INTO jc_id;
        
        -- Link defect to job card
        NEW.job_card_id := jc_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_job_card_for_defect ON inspection_defects;
CREATE TRIGGER trigger_create_job_card_for_defect
    BEFORE INSERT ON inspection_defects
    FOR EACH ROW
    EXECUTE FUNCTION create_job_card_for_defect();

-- ============================================
-- MIGRATION: Link requisitions to inspections
-- ============================================

-- Add inspection_id to requisitions if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'requisitions' AND column_name = 'inspection_id'
    ) THEN
        ALTER TABLE requisitions ADD COLUMN inspection_id UUID REFERENCES vehicle_inspections(id);
        ALTER TABLE requisitions ADD COLUMN inspection_status VARCHAR(50) DEFAULT 'not_required';
    END IF;
END $$;

-- Add inspection-related fields to routes if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'pre_trip_inspection_id'
    ) THEN
        ALTER TABLE routes ADD COLUMN pre_trip_inspection_id UUID REFERENCES vehicle_inspections(id);
        ALTER TABLE routes ADD COLUMN post_trip_inspection_id UUID REFERENCES vehicle_inspections(id);
        ALTER TABLE routes ADD COLUMN start_mileage INTEGER;
        ALTER TABLE routes ADD COLUMN end_mileage INTEGER;
    END IF;
END $$;

-- Create driver_assignments table if not exists (for assignment linking)
CREATE TABLE IF NOT EXISTS driver_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    requisition_id UUID REFERENCES requisitions(id) ON DELETE SET NULL,
    assignment_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_driver ON driver_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_vehicle ON driver_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON driver_assignments(assignment_date);

-- Add inspection_id to job_cards for linking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_cards' AND column_name = 'source_type'
    ) THEN
        ALTER TABLE job_cards ADD COLUMN source_type VARCHAR(50);
        ALTER TABLE job_cards ADD COLUMN source_id UUID;
    END IF;
END $$;

-- ============================================
-- NOTIFICATION: Add inspection reminders
-- ============================================

-- Create inspection_reminders table
CREATE TABLE IF NOT EXISTS inspection_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES inspection_schedules(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL,
    due_date DATE,
    due_mileage INTEGER,
    message TEXT,
    sent_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminders_vehicle ON inspection_reminders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON inspection_reminders(due_date);

-- ============================================
-- SUMMARY
-- ============================================
-- This migration creates:
-- 1. Core inspection tables (vehicle_inspections, inspection_items, inspection_results, inspection_defects)
-- 2. Inspection categories and standardized checklist items
-- 3. Integration with existing modules (requisitions, routes, job_cards)
-- 4. Automated triggers for vehicle status updates and job card creation
-- 5. Indexes for performance
-- 6. Seed data for standard inspection checklist
