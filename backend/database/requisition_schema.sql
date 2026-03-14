-- Requisitions table for Vehicle Requisition Module
CREATE TABLE IF NOT EXISTS requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_no VARCHAR(50) UNIQUE NOT NULL,
    
    -- Request details
    requested_by UUID REFERENCES staff(id),
    place_of_departure VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    travel_date DATE NOT NULL,
    travel_time TIME NOT NULL,
    return_date DATE,
    return_time TIME,
    num_passengers INTEGER DEFAULT 1,
    passenger_names TEXT,
    
    -- Approval workflow
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, allocated, ready_for_departure, inspection_failed, in_transit, completed
    approved_by UUID REFERENCES staff(id),
    approved_at TIMESTAMP,
    approval_reason TEXT,
    
    -- Vehicle allocation
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES staff(id),
    allocated_by UUID REFERENCES staff(id),
    allocated_at TIMESTAMP,
    
    -- Inspection (10-point check)
    inspection_tires BOOLEAN,
    inspection_brakes BOOLEAN,
    inspection_lights BOOLEAN,
    inspection_oil BOOLEAN,
    inspection_coolant BOOLEAN,
    inspection_battery BOOLEAN,
    inspection_wipers BOOLEAN,
    inspection_mirrors BOOLEAN,
    inspection_seatbelts BOOLEAN,
    inspection_fuel BOOLEAN,
    defects_found TEXT,
    defect_photos JSONB,
    inspection_passed BOOLEAN,
    inspection_completed_at TIMESTAMP,
    
    -- Trip tracking
    starting_odometer INTEGER,
    ending_odometer INTEGER,
    distance_km INTEGER,
    security_cleared_by UUID REFERENCES staff(id),
    security_cleared_at TIMESTAMP,
    departed_at TIMESTAMP,
    
    -- Trip closure
    closed_by UUID REFERENCES staff(id),
    closed_at TIMESTAMP,
    
    -- Driver rating
    driver_rating INTEGER, -- 1-5 stars
    driver_rating_comment TEXT,
    rated_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON requisitions(status);
CREATE INDEX IF NOT EXISTS idx_requisitions_requested_by ON requisitions(requested_by);
CREATE INDEX IF NOT EXISTS idx_requisitions_vehicle ON requisitions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_driver ON requisitions(driver_id);
