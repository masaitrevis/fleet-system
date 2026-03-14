import { Pool, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

let pool: Pool | null = null;

export const initDatabase = async () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL
    }
  });

  // Test connection
  const client = await pool.connect();
  console.log('✅ PostgreSQL connected');
  client.release();
  
  // Create tables
  await createTables();
  
  return pool;
};

const createTables = async () => {
  if (!pool) throw new Error('Database not initialized');

  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'viewer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Staff table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_no VARCHAR(50) UNIQUE,
      staff_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      designation VARCHAR(100),
      department VARCHAR(100),
      branch VARCHAR(100),
      role VARCHAR(50) DEFAULT 'Driver',
      comments TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Vehicles table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registration_num VARCHAR(50) UNIQUE NOT NULL,
      year_of_manufacture INTEGER,
      year_of_purchase INTEGER,
      replacement_mileage INTEGER,
      replacement_age INTEGER,
      make_model VARCHAR(255),
      ownership VARCHAR(100),
      department VARCHAR(100),
      branch VARCHAR(100),
      minor_service_interval INTEGER,
      medium_service_interval INTEGER,
      major_service_interval INTEGER,
      target_consumption_rate DECIMAL(5,2),
      status VARCHAR(50) DEFAULT 'Active',
      current_mileage INTEGER DEFAULT 0,
      last_service_date DATE,
      next_service_due DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Routes table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS routes (
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
    )
  `);

  // Fuel records table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fuel_records (
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
    )
  `);

  // Repairs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS repairs (
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
      productivity_ratio DECIMAL(5,2),
      garage_name VARCHAR(255),
      cost DECIMAL(10,2),
      status VARCHAR(50) DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Requisitions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requisitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_no VARCHAR(50) UNIQUE NOT NULL,
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
      status VARCHAR(50) DEFAULT 'pending',
      approved_by UUID REFERENCES staff(id),
      approved_at TIMESTAMP,
      approval_reason TEXT,
      vehicle_id UUID REFERENCES vehicles(id),
      driver_id UUID REFERENCES staff(id),
      allocated_by UUID REFERENCES staff(id),
      allocated_at TIMESTAMP,
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
      starting_odometer INTEGER,
      ending_odometer INTEGER,
      distance_km INTEGER,
      security_cleared_by UUID REFERENCES staff(id),
      security_cleared_at TIMESTAMP,
      departed_at TIMESTAMP,
      closed_by UUID REFERENCES staff(id),
      closed_at TIMESTAMP,
      driver_rating INTEGER,
      driver_rating_comment TEXT,
      rated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Analytics cache table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_cache (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      data JSONB NOT NULL,
      cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Tables created');
  
  // Create default admin user
  const adminResult = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@fleet.local']);
  if (adminResult.rows.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [uuidv4(), 'admin@fleet.local', hashedPassword, 'admin']
    );
    console.log('✅ Default admin user created: admin@fleet.local / admin123');
  }
};

export const query = async (sql: string, params?: any[]): Promise<any> => {
  if (!pool) throw new Error('Database not initialized');
  
  // Convert SQLite ? to PostgreSQL $n
  let pgSql = sql;
  let paramIndex = 1;
  while (pgSql.includes('?')) {
    pgSql = pgSql.replace('?', `$${paramIndex}`);
    paramIndex++;
  }
  
  const result = await pool.query(pgSql, params);
  return result.rows;
};

export default pool;
