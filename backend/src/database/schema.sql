-- Fleet Management System Database Schema
-- Based on Master Excel Template

-- Drop tables if exist (clean start)
DROP TABLE IF EXISTS fuel_records CASCADE;
DROP TABLE IF EXISTS repairs CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (for authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'viewer', -- admin, manager, viewer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff/Drivers table
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_no VARCHAR(50) UNIQUE,
    staff_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    designation VARCHAR(100),
    department VARCHAR(100),
    branch VARCHAR(100),
    role VARCHAR(50) DEFAULT 'Driver', -- Driver, Transport Supervisor, etc.
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fleet/Vehicles table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_num VARCHAR(50) UNIQUE NOT NULL,
    year_of_manufacture INTEGER,
    year_of_purchase INTEGER,
    replacement_mileage INTEGER,
    replacement_age INTEGER,
    make_model VARCHAR(255),
    ownership VARCHAR(100), -- Company, Leased, etc.
    department VARCHAR(100),
    branch VARCHAR(100),
    minor_service_interval INTEGER, -- in km
    medium_service_interval INTEGER,
    major_service_interval INTEGER,
    target_consumption_rate DECIMAL(5,2), -- km per liter
    status VARCHAR(50) DEFAULT 'Active', -- Active, Under Maintenance, Retired
    current_mileage INTEGER DEFAULT 0,
    last_service_date DATE,
    next_service_due DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routes/Operations table
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_date DATE NOT NULL,
    route_name VARCHAR(255),
    driver1_id UUID REFERENCES staff(id),
    driver2_id UUID REFERENCES staff(id),
    co_driver_id UUID REFERENCES staff(id),
    vehicle_id UUID REFERENCES vehicles(id),
    target_km DECIMAL(10,2),
    actual_km DECIMAL(10,2),
    target_fuel_consumption DECIMAL(8,2),
    actual_fuel DECIMAL(8,2),
    target_consumption_rate DECIMAL(5,2),
    actual_consumption_rate DECIMAL(5,2),
    variance DECIMAL(8,2),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fuel Records table
CREATE TABLE fuel_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department VARCHAR(100),
    fuel_date DATE,
    vehicle_id UUID REFERENCES vehicles(id),
    card_num VARCHAR(100),
    card_name VARCHAR(255),
    past_mileage INTEGER,
    current_mileage INTEGER,
    distance_km INTEGER GENERATED ALWAYS AS (current_mileage - past_mileage) STORED,
    quantity_liters DECIMAL(8,2),
    km_per_liter DECIMAL(5,2),
    amount DECIMAL(10,2),
    cost_per_km DECIMAL(8,4),
    place VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Repairs/Maintenance table
CREATE TABLE repairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_in DATE,
    vehicle_id UUID REFERENCES vehicles(id),
    preventative_maintenance TEXT,
    breakdown_description TEXT,
    odometer_reading INTEGER,
    driver_id UUID REFERENCES staff(id),
    assigned_technician VARCHAR(255),
    repairs_start_time TIMESTAMP,
    date_out DATE,
    repairs_end_time TIMESTAMP,
    actual_repair_hours DECIMAL(5,2),
    target_repair_hours DECIMAL(5,2),
    productivity_ratio DECIMAL(5,2), -- target/actual
    garage_name VARCHAR(255),
    cost DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, role) VALUES 
('admin@fleet.local', '$2a$10$YourHashHere', 'admin');

-- Create indexes for performance
CREATE INDEX idx_vehicles_registration ON vehicles(registration_num);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_staff_staff_no ON staff(staff_no);
CREATE INDEX idx_routes_date ON routes(route_date);
CREATE INDEX idx_routes_vehicle ON routes(vehicle_id);
CREATE INDEX idx_fuel_vehicle ON fuel_records(vehicle_id);
CREATE INDEX idx_fuel_date ON fuel_records(fuel_date);
CREATE INDEX idx_repairs_vehicle ON repairs(vehicle_id);
CREATE INDEX idx_repairs_status ON repairs(status);