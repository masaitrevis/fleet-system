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
    },
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 5000 // Return error after 5 seconds if connection not established
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

  // NOTE: Tables are NOT dropped to preserve data between deployments
  // Only create tables if they don't exist

  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'viewer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP,
      deleted_by UUID REFERENCES users(id)
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
      safety_score INTEGER DEFAULT 100,
      comments TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP,
      deleted_by UUID REFERENCES users(id)
    )
  `);
  
  // Driver behavior scores history
  await pool.query(`
    CREATE TABLE IF NOT EXISTS driver_behavior_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id UUID REFERENCES staff(id) ON DELETE CASCADE,
      score_date DATE DEFAULT CURRENT_DATE,
      overall_score INTEGER,
      fuel_efficiency_score INTEGER,
      safety_score INTEGER,
      reliability_score INTEGER,
      risk_level VARCHAR(20),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Vehicle risk profiles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_risk_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
      risk_level VARCHAR(20) DEFAULT 'low',
      risk_score INTEGER DEFAULT 0,
      factors JSONB DEFAULT '[]',
      recommendations JSONB DEFAULT '[]',
      calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Risk alerts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS risk_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      entity_id UUID,
      entity_type VARCHAR(50),
      entity_name VARCHAR(255),
      acknowledged BOOLEAN DEFAULT FALSE,
      acknowledged_by UUID REFERENCES users(id),
      acknowledged_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      defect_notes TEXT,
      defect_reported_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP,
      deleted_by UUID REFERENCES users(id)
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

  // Job Cards table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_card_number VARCHAR(50) UNIQUE NOT NULL,
      vehicle_id UUID REFERENCES vehicles(id),
      defect_description TEXT NOT NULL,
      repair_type VARCHAR(100),
      service_provider VARCHAR(100),
      priority VARCHAR(20) DEFAULT 'Medium',
      estimated_cost DECIMAL(10,2),
      actual_cost DECIMAL(10,2),
      target_hours DECIMAL(5,2),
      actual_hours DECIMAL(5,2),
      reported_by UUID REFERENCES staff(id),
      reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      approved_by UUID REFERENCES staff(id),
      approved_at TIMESTAMP,
      assigned_technician UUID REFERENCES staff(id),
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      repair_notes TEXT,
      cancellation_reason TEXT,
      status VARCHAR(50) DEFAULT 'Pending',
      source_type VARCHAR(50),
      source_id UUID,
      converted_to_repair_id UUID REFERENCES repairs(id),
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
      trip_duration_minutes INTEGER,
      returned_at TIMESTAMP,
      security_notes TEXT,
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

  // ==================== INTEGRATION TABLES ====================

  // API Keys table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key_hash VARCHAR(255) UNIQUE NOT NULL,
      key_prefix VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP,
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      permissions JSONB DEFAULT '["read"]',
      rate_limit_per_minute INTEGER DEFAULT 60,
      metadata JSONB DEFAULT '{}'
    )
  `);

  // Webhooks table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      url VARCHAR(500) NOT NULL,
      secret VARCHAR(255) NOT NULL,
      events JSONB NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_triggered_at TIMESTAMP,
      failure_count INTEGER DEFAULT 0,
      headers JSONB DEFAULT '{}'
    )
  `);

  // Webhook delivery logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL,
      response_status INTEGER,
      response_body TEXT,
      error_message TEXT,
      attempt_number INTEGER DEFAULT 1,
      delivered_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // API usage logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      endpoint VARCHAR(255) NOT NULL,
      method VARCHAR(10) NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      ip_address INET,
      user_agent TEXT,
      request_body JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Integrations configuration table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      provider VARCHAR(100) NOT NULL,
      config JSONB NOT NULL,
      is_active BOOLEAN DEFAULT false,
      last_sync_at TIMESTAMP,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, provider)
    )
  `);

  // System audit logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID,
      old_values JSONB,
      new_values JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==================== ACCIDENTS TABLES ====================
  
  // Main accidents table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accidents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_number VARCHAR(50) UNIQUE NOT NULL,
      accident_date TIMESTAMP NOT NULL,
      gps_location VARCHAR(255),
      route_id UUID REFERENCES routes(id),
      vehicle_id UUID REFERENCES vehicles(id),
      driver_id UUID REFERENCES staff(id),
      accident_type VARCHAR(100),
      severity VARCHAR(50),
      injuries_reported BOOLEAN DEFAULT false,
      police_notified BOOLEAN DEFAULT false,
      third_party_involved BOOLEAN DEFAULT false,
      weather_condition VARCHAR(100),
      road_condition VARCHAR(100),
      incident_description TEXT,
      reported_by UUID REFERENCES users(id),
      status VARCHAR(50) DEFAULT 'Reported',
      closed_by UUID REFERENCES users(id),
      closed_at TIMESTAMP,
      closure_remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Accident witnesses
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accident_witnesses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
      witness_name VARCHAR(255) NOT NULL,
      witness_contact VARCHAR(255),
      witness_statement TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Accident evidence (photos, documents)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accident_evidence (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
      evidence_type VARCHAR(50) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      description TEXT,
      uploaded_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Accident investigations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accident_investigations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
      investigator_id UUID REFERENCES staff(id),
      investigation_date TIMESTAMP,
      scene_findings TEXT,
      vehicle_condition_assessment TEXT,
      driver_condition_assessment TEXT,
      valid_license BOOLEAN,
      driver_training_compliant BOOLEAN,
      speed_compliance VARCHAR(50),
      fatigue_status VARCHAR(100),
      alcohol_drug_test VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Root cause analysis
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accident_root_causes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
      primary_category VARCHAR(100),
      primary_cause TEXT,
      contributing_factors JSONB,
      driver_causes JSONB,
      vehicle_causes JSONB,
      environmental_causes JSONB,
      organizational_causes JSONB,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // CAPA (Corrective and Preventive Actions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accident_capa (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
      action_description TEXT NOT NULL,
      responsible_person_id UUID REFERENCES staff(id),
      target_completion_date DATE,
      actual_completion_date DATE,
      priority VARCHAR(20) DEFAULT 'Medium',
      status VARCHAR(50) DEFAULT 'Open',
      completion_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Lessons learned
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accident_lessons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      accident_id UUID REFERENCES accidents(id) ON DELETE CASCADE,
      key_lesson TEXT NOT NULL,
      preventive_recommendations TEXT,
      training_required BOOLEAN DEFAULT false,
      training_details TEXT,
      policy_update_needed BOOLEAN DEFAULT false,
      policy_update_details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==================== WORKSHOP: STOCK & INVOICING ====================
  
  // Stock parts catalog
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_parts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      part_number VARCHAR(100) UNIQUE NOT NULL,
      part_name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      manufacturer VARCHAR(255),
      supplier VARCHAR(255),
      unit_cost DECIMAL(10,2) DEFAULT 0,
      quantity_on_hand INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 5,
      location_bin VARCHAR(100),
      compatible_vehicles JSONB DEFAULT '[]',
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    )
  `);
  
  // Stock usage (links parts to repairs/job cards)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      part_id UUID REFERENCES stock_parts(id),
      quantity_used DECIMAL(10,2) NOT NULL,
      unit_cost DECIMAL(10,2),
      repair_id UUID REFERENCES repairs(id),
      job_card_id UUID REFERENCES job_cards(id),
      notes TEXT,
      used_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Stock adjustments (manual corrections)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      part_id UUID REFERENCES stock_parts(id),
      adjustment INTEGER NOT NULL,
      reason TEXT,
      adjusted_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Customers (for invoicing)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255),
      customer_phone VARCHAR(50),
      customer_address TEXT,
      tax_number VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    )
  `);
  
  // Invoices
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(100) UNIQUE NOT NULL,
      customer_id UUID REFERENCES customers(id),
      job_card_id UUID REFERENCES job_cards(id),
      vehicle_id UUID REFERENCES vehicles(id),
      invoice_date DATE NOT NULL,
      due_date DATE,
      status VARCHAR(50) DEFAULT 'Draft',
      subtotal DECIMAL(10,2) DEFAULT 0,
      tax_amount DECIMAL(10,2) DEFAULT 0,
      total DECIMAL(10,2) DEFAULT 0,
      amount_paid DECIMAL(10,2) DEFAULT 0,
      labor_hours DECIMAL(5,2),
      labor_rate DECIMAL(10,2) DEFAULT 50,
      labor_total DECIMAL(10,2),
      notes TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    )
  `);
  
  // Invoice line items
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
      part_id UUID REFERENCES stock_parts(id),
      description TEXT NOT NULL,
      quantity DECIMAL(10,2) DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Invoice payments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(50) DEFAULT 'Cash',
      reference VARCHAR(255),
      notes TEXT,
      received_by UUID REFERENCES users(id),
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==================== CREATE INDEXES ====================
  await createIndexes(pool);
};

// Create database indexes for performance
const createIndexes = async (poolRef: any) => {
  if (!poolRef) return;

  const indexes = [
    // Vehicles indexes
    { name: 'idx_vehicles_status', table: 'vehicles', column: 'status' },
    { name: 'idx_vehicles_department', table: 'vehicles', column: 'department' },
    { name: 'idx_vehicles_deleted_at', table: 'vehicles', column: 'deleted_at' },
    { name: 'idx_vehicles_registration', table: 'vehicles', column: 'registration_num' },
    
    // Staff indexes
    { name: 'idx_staff_email', table: 'staff', column: 'email' },
    { name: 'idx_staff_role', table: 'staff', column: 'role' },
    { name: 'idx_staff_department', table: 'staff', column: 'department' },
    { name: 'idx_staff_deleted_at', table: 'staff', column: 'deleted_at' },
    
    // Accidents indexes
    { name: 'idx_accidents_vehicle_id', table: 'accidents', column: 'vehicle_id' },
    { name: 'idx_accidents_driver_id', table: 'accidents', column: 'driver_id' },
    { name: 'idx_accidents_date', table: 'accidents', column: 'accident_date' },
    { name: 'idx_accidents_status', table: 'accidents', column: 'status' },
    { name: 'idx_accidents_case_number', table: 'accidents', column: 'case_number' },
    { name: 'idx_accident_witnesses_accident_id', table: 'accident_witnesses', column: 'accident_id' },
    { name: 'idx_accident_evidence_accident_id', table: 'accident_evidence', column: 'accident_id' },
    { name: 'idx_accident_investigations_accident_id', table: 'accident_investigations', column: 'accident_id' },
    
    // Routes indexes
    { name: 'idx_routes_vehicle_id', table: 'routes', column: 'vehicle_id' },
    { name: 'idx_routes_driver1_id', table: 'routes', column: 'driver1_id' },
    { name: 'idx_routes_date', table: 'routes', column: 'route_date' },
    
    // Fuel records indexes
    { name: 'idx_fuel_vehicle_id', table: 'fuel_records', column: 'vehicle_id' },
    { name: 'idx_fuel_date', table: 'fuel_records', column: 'fuel_date' },
    
    // Requisitions indexes
    { name: 'idx_requisitions_status', table: 'requisitions', column: 'status' },
    { name: 'idx_requisitions_requested_by', table: 'requisitions', column: 'requested_by' },
    { name: 'idx_requisitions_vehicle_id', table: 'requisitions', column: 'vehicle_id' },
    { name: 'idx_requisitions_driver_id', table: 'requisitions', column: 'driver_id' },
    
    // Repairs indexes
    { name: 'idx_repairs_vehicle_id', table: 'repairs', column: 'vehicle_id' },
    { name: 'idx_repairs_status', table: 'repairs', column: 'status' },
    
    // Job cards indexes
    { name: 'idx_job_cards_vehicle_id', table: 'job_cards', column: 'vehicle_id' },
    { name: 'idx_job_cards_status', table: 'job_cards', column: 'status' },
    { name: 'idx_job_cards_number', table: 'job_cards', column: 'job_card_number' },
    
    // Training indexes
    { name: 'idx_training_enrollments_staff', table: 'training_enrollments', column: 'staff_id' },
    { name: 'idx_training_enrollments_course', table: 'training_enrollments', column: 'course_id' },
    { name: 'idx_training_courses_code', table: 'training_courses', column: 'course_code' },
    
    // API Keys indexes
    { name: 'idx_api_keys_hash', table: 'api_keys', column: 'key_hash' },
    { name: 'idx_api_keys_prefix', table: 'api_keys', column: 'key_prefix' },
    { name: 'idx_api_keys_active', table: 'api_keys', column: 'is_active' },
    
    // Webhook indexes
    { name: 'idx_webhooks_active', table: 'webhooks', column: 'is_active' },
    { name: 'idx_webhook_deliveries_webhook_id', table: 'webhook_deliveries', column: 'webhook_id' },
    
    // API usage indexes
    { name: 'idx_api_usage_created', table: 'api_usage_logs', column: 'created_at' },
    { name: 'idx_api_usage_key', table: 'api_usage_logs', column: 'api_key_id' },
    
    // Audit logs indexes
    { name: 'idx_audit_logs_user', table: 'system_audit_logs', column: 'user_id' },
    { name: 'idx_audit_logs_created', table: 'system_audit_logs', column: 'created_at' },
    { name: 'idx_audit_logs_entity', table: 'system_audit_logs', column: 'entity_type, entity_id' },
    
    // Stock/Parts indexes
    { name: 'idx_stock_parts_number', table: 'stock_parts', column: 'part_number' },
    { name: 'idx_stock_parts_category', table: 'stock_parts', column: 'category' },
    { name: 'idx_stock_usage_part_id', table: 'stock_usage', column: 'part_id' },
    { name: 'idx_stock_usage_repair_id', table: 'stock_usage', column: 'repair_id' },
    { name: 'idx_stock_usage_job_card_id', table: 'stock_usage', column: 'job_card_id' },
    
    // Invoice indexes
    { name: 'idx_invoices_number', table: 'invoices', column: 'invoice_number' },
    { name: 'idx_invoices_customer_id', table: 'invoices', column: 'customer_id' },
    { name: 'idx_invoices_job_card_id', table: 'invoices', column: 'job_card_id' },
    { name: 'idx_invoices_status', table: 'invoices', column: 'status' },
    { name: 'idx_invoices_date', table: 'invoices', column: 'invoice_date' },
    { name: 'idx_invoice_items_invoice_id', table: 'invoice_items', column: 'invoice_id' },
    { name: 'idx_invoice_payments_invoice_id', table: 'invoice_payments', column: 'invoice_id' }
  ];

  for (const idx of indexes) {
    try {
      await poolRef.query(`
        CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})
      `);
    } catch (err) {
      console.warn(`⚠️ Failed to create index ${idx.name}:`, (err as Error).message);
    }
  }
  
  console.log('✅ Database indexes created');

  // Create training tables
  await createTrainingTables();

  // Create audit tables and seed templates
  await createAuditTables();

  // Create or reset default admin user
  if (pool) {
    try {
      const adminResult = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', ['admin@fleet.local']);
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      
      if (adminResult.rows.length === 0) {
        // Create new admin user
        await pool.query(
          'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
          [uuidv4(), 'admin@fleet.local', hashedPassword, 'admin']
        );
        console.log('✅ Default admin user created: admin@fleet.local / admin123');
      } else {
        // Reset password to ensure it's correct
        await pool.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
          [hashedPassword, 'admin@fleet.local']
        );
        console.log('✅ Admin password reset: admin@fleet.local / admin123');
      }
    } catch (err) {
      console.error('❌ Error creating admin user:', err);
    }
  }
};

// Create training tables
const createTrainingTables = async () => {
  if (!pool) return;
  
  // Training courses
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_code VARCHAR(50) UNIQUE NOT NULL,
      course_name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      duration_hours INTEGER DEFAULT 1,
      validity_months INTEGER,
      mandatory BOOLEAN DEFAULT false,
      passing_score INTEGER DEFAULT 70,
      created_by UUID REFERENCES staff(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Training slides
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_slides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
      slide_order INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      media_url VARCHAR(500),
      duration_minutes INTEGER DEFAULT 5,
      ai_notes TEXT,
      ai_notes_generated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Quiz questions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_quiz_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
      explanation TEXT,
      difficulty VARCHAR(20) DEFAULT 'medium',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Enrollments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
      course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      enrolled_by UUID REFERENCES staff(id),
      status VARCHAR(50) DEFAULT 'enrolled',
      current_slide INTEGER DEFAULT 0,
      completed_slides INTEGER DEFAULT 0,
      total_slides INTEGER DEFAULT 0,
      quiz_attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      last_quiz_score INTEGER,
      passed_at TIMESTAMP,
      locked_at TIMESTAMP,
      locked_reason TEXT,
      unlocked_by UUID REFERENCES staff(id),
      unlocked_at TIMESTAMP,
      UNIQUE(staff_id, course_id)
    )
  `);
  
  // Quiz attempts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_quiz_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID REFERENCES training_enrollments(id) ON DELETE CASCADE,
      attempt_number INTEGER NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      score INTEGER,
      total_questions INTEGER,
      correct_answers INTEGER,
      passed BOOLEAN DEFAULT false,
      answers JSONB DEFAULT '{}',
      UNIQUE(enrollment_id, attempt_number)
    )
  `);
  
  // Quiz attempt details for tracking used questions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_quiz_attempt_details (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id UUID REFERENCES training_quiz_attempts(id) ON DELETE CASCADE,
      enrollment_id UUID REFERENCES training_enrollments(id) ON DELETE CASCADE,
      question_id UUID REFERENCES training_quiz_questions(id) ON DELETE CASCADE,
      selected_answer CHAR(1),
      is_correct BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(attempt_id, question_id)
    )
  `);
  
  // Certificates
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_certificates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certificate_number VARCHAR(100) UNIQUE NOT NULL,
      enrollment_id UUID REFERENCES training_enrollments(id) ON DELETE CASCADE,
      staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
      course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
      issue_date DATE NOT NULL,
      expiry_date DATE,
      score INTEGER,
      pdf_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Seed default courses if none exist
  const courseCount = await pool.query('SELECT COUNT(*) as count FROM training_courses');
  if (parseInt(courseCount.rows[0].count) === 0) {
    await pool.query(`
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
    `);
    console.log('✅ Training courses seeded');
    
    // Seed sample slides for courses
    await seedSampleSlides(pool);
  }
};

// Seed sample slides for courses
const seedSampleSlides = async (pool: Pool) => {
  // Check if slides already exist
  const slideCount = await pool.query('SELECT COUNT(*) as count FROM training_slides');
  if (parseInt(slideCount.rows[0].count) > 0) return;
  
  // Get courses
  const courses = await pool.query('SELECT id, course_code FROM training_courses');
  const courseMap: Record<string, string> = {};
  courses.rows.forEach((c: any) => courseMap[c.course_code] = c.id);
  
  const sampleSlides: Record<string, Array<{title: string, content: string, duration: number}>> = {
    'DEF-001': [
      { title: 'Introduction to Defensive Driving', content: 'Defensive driving is a set of driving skills that allows you to defend yourself against possible collisions caused by bad drivers, drunk drivers, and poor weather.\n\nKey Principles:\n• Stay alert and focused\n• Anticipate hazards\n• Maintain safe following distance\n• Adapt to road conditions', duration: 5 },
      { title: 'The 3-Second Rule', content: 'The 3-second rule helps you maintain a safe following distance:\n\n1. Pick a fixed point ahead (sign, tree, marking)\n2. When the vehicle ahead passes it, start counting\n3. You should reach that point after 3+ seconds\n\nIncrease to 4-5 seconds in bad weather or heavy traffic.', duration: 5 },
      { title: 'Scanning the Road', content: 'Effective scanning pattern:\n\n• Look 12-15 seconds ahead (city: 1-1.5 blocks, highway: 1/4 mile)\n• Check mirrors every 5-8 seconds\n• Scan intersections before entering\n• Watch for escape routes\n• Check blind spots before lane changes', duration: 5 },
      { title: 'Managing Distractions', content: 'Common distractions and how to avoid them:\n\n• Mobile phones - Use hands-free only when necessary\n• Eating/drinking - Do before or after driving\n• Passengers - Set expectations before departure\n• Navigation - Program before starting\n\nRemember: A 2-second glance at 60 km/h means 33 meters of blind travel.', duration: 5 }
    ],
    'HOS-001': [
      { title: 'Hours of Service Regulations', content: 'Hours of Service (HOS) regulations are designed to prevent driver fatigue:\n\nKey Limits:\n• 11 hours maximum driving time after 10 consecutive hours off-duty\n• 14-hour on-duty window\n• 60/70 hour weekly limits\n• 30-minute break after 8 hours of driving', duration: 5 },
      { title: 'Logbook Requirements', content: 'Your logbook must record:\n\n• Date and total miles driven\n• Truck/trailer numbers\n• Name of carrier\n• Driver signature\n• 24-hour period starting time\n• Total hours (driving, on-duty, off-duty)\n• Shipping document numbers\n\nElectronic logs (ELD) must be used when available.', duration: 5 },
      { title: 'Fatigue Warning Signs', content: 'Recognize these warning signs of fatigue:\n\n• Frequent yawning or blinking\n• Difficulty remembering recent exits\n• Missing traffic signs\n• Drifting between lanes\n• Heavy eyelids\n\nWhen you notice these signs, find a safe place to rest immediately.', duration: 5 }
    ],
    'DVIR-001': [
      { title: 'Introduction to DVIR', content: 'The Daily Vehicle Inspection Report (DVIR) is a legal requirement.\n\nPurpose:\n• Ensure vehicle safety before operation\n• Document defects found\n• Prove compliance with regulations\n• Protect you and your company\n\nYou must complete DVIR at the beginning AND end of each workday.', duration: 5 },
      { title: 'Pre-Trip Inspection', content: 'Systematic inspection order:\n\n1. Engine compartment (fluids, belts, hoses)\n2. Front of vehicle (lights, windshield)\n3. Driver side (tires, fuel tank, mirrors)\n4. Rear (lights, cargo securement)\n5. Passenger side\n6. Inside cab (gauges, controls, documents)\n\nDocument any defects on the DVIR.', duration: 5 },
      { title: 'Common Defects to Check', content: 'Critical items that can put vehicle out of service:\n\n• Brake defects (air leaks, worn pads)\n• Tire issues (under 2/32" tread, bulges)\n• Lighting problems (non-functional lights)\n• Steering defects (excessive play)\n• Suspension issues\n\nNever operate a vehicle with critical defects!', duration: 5 }
    ],
    'ACC-001': [
      { title: 'Accident Prevention', content: 'Most accidents are preventable through:\n\n• Proper training\n• Vehicle maintenance\n• Adherence to speed limits\n• Avoiding distractions\n• Managing fatigue\n\nRemember: Speeding is a factor in 30% of fatal crashes.', duration: 5 },
      { title: 'If an Accident Occurs', content: 'Immediate actions:\n\n1. Stop immediately and secure the scene\n2. Check for injuries and call emergency services\n3. Do not admit fault or make promises\n4. Document everything (photos, witness info)\n5. Notify your supervisor within 1 hour\n6. Complete accident report\n\nYour safety is the first priority.', duration: 5 }
    ],
    'DRUG-001': [
      { title: 'Drug & Alcohol Policy', content: 'Our zero-tolerance policy prohibits:\n\n• Alcohol within 8 hours of duty\n• Any illegal drug use\n• Misuse of prescription medications\n• Refusing a drug/alcohol test\n\nViolations result in immediate suspension and possible termination.', duration: 5 },
      { title: 'Recognizing Impairment', content: 'Signs of impairment in yourself or others:\n\n• Slurred speech\n• Unsteady balance\n• Bloodshot eyes\n• Unusual behavior\n• Delayed reactions\n\nIf you suspect impairment, do not drive. Contact your supervisor immediately.', duration: 5 }
    ]
  };
  
  // Insert slides for courses that have them defined
  for (const [courseCode, slides] of Object.entries(sampleSlides)) {
    const courseId = courseMap[courseCode];
    if (!courseId) continue;
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      await pool.query(`
        INSERT INTO training_slides (id, course_id, slide_order, title, content, duration_minutes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuidv4(), courseId, i + 1, slide.title, slide.content, slide.duration]);
    }
    console.log(`✅ Added ${slides.length} slides for ${courseCode}`);
  }
};

// Create audit tables and seed templates
const createAuditTables = async () => {
  if (!pool) return;
  
  // Audit templates
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_by UUID REFERENCES staff(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Audit questions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID REFERENCES audit_templates(id) ON DELETE CASCADE,
      module_name VARCHAR(100) NOT NULL,
      question_text TEXT NOT NULL,
      question_order INTEGER,
      max_score INTEGER DEFAULT 100,
      requires_evidence BOOLEAN DEFAULT false,
      evidence_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Audit sessions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      audit_number VARCHAR(50) UNIQUE NOT NULL,
      template_id UUID REFERENCES audit_templates(id),
      branch VARCHAR(100),
      department VARCHAR(100),
      vehicle_ids JSONB DEFAULT '[]',
      auditor_id UUID REFERENCES staff(id),
      status VARCHAR(50) DEFAULT 'In Progress',
      total_score INTEGER,
      max_possible_score INTEGER,
      compliance_percentage DECIMAL(5,2),
      risk_level VARCHAR(20),
      audit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Audit responses
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES audit_sessions(id) ON DELETE CASCADE,
      question_id UUID REFERENCES audit_questions(id),
      response VARCHAR(50),
      score INTEGER,
      evidence_attached BOOLEAN DEFAULT false,
      evidence_urls JSONB DEFAULT '[]',
      notes TEXT,
      gps_location VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Audit corrective actions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_corrective_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES audit_sessions(id) ON DELETE CASCADE,
      response_id UUID REFERENCES audit_responses(id),
      issue_identified TEXT NOT NULL,
      risk_level VARCHAR(20),
      corrective_action TEXT,
      responsible_person_id UUID REFERENCES staff(id),
      deadline DATE,
      status VARCHAR(50) DEFAULT 'Open',
      completed_at TIMESTAMP,
      completion_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Seed default templates if none exist
  const templateCount = await pool.query('SELECT COUNT(*) as count FROM audit_templates');
  if (parseInt(templateCount.rows[0].count) === 0) {
    // Insert G4S Fleet Standard Audit
    const g4sResult = await pool.query(`
      INSERT INTO audit_templates (id, template_name, description, is_active)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [uuidv4(), 'G4S Fleet Standard Audit', 'Comprehensive fleet operations audit covering 8 core modules with 45 checkpoint questions', true]);
    
    const g4sId = g4sResult.rows[0].id;
    
    // Insert G4S questions
    const g4sQuestions = [
      // Fleet Governance (1-6)
      { module: 'Fleet Governance & Policy', text: 'Fleet policy is available and approved', order: 1, evidence: true },
      { module: 'Fleet Governance & Policy', text: 'Vehicle usage policy is defined and communicated', order: 2, evidence: true },
      { module: 'Fleet Governance & Policy', text: 'Driver authorization procedures are in place', order: 3, evidence: false },
      { module: 'Fleet Governance & Policy', text: 'Fuel management policy exists', order: 4, evidence: true },
      { module: 'Fleet Governance & Policy', text: 'Accident reporting procedures are documented', order: 5, evidence: true },
      { module: 'Fleet Governance & Policy', text: 'Preventive maintenance policy is enforced', order: 6, evidence: true },
      // Vehicle Compliance (7-13)
      { module: 'Vehicle Compliance & Licensing', text: 'All vehicles have valid registration', order: 7, evidence: true },
      { module: 'Vehicle Compliance & Licensing', text: 'Insurance is valid for all vehicles', order: 8, evidence: true },
      { module: 'Vehicle Compliance & Licensing', text: 'Road licenses are current', order: 9, evidence: true },
      { module: 'Vehicle Compliance & Licensing', text: 'Inspection certificates are up to date', order: 10, evidence: true },
      { module: 'Vehicle Compliance & Licensing', text: 'Speed governors are installed and functional', order: 11, evidence: true },
      { module: 'Vehicle Compliance & Licensing', text: 'Vehicle tracking system is operational', order: 12, evidence: true },
      { module: 'Vehicle Compliance & Licensing', text: 'NTSA compliance is maintained (Kenya)', order: 13, evidence: true },
      // Preventive Maintenance (14-19)
      { module: 'Preventive Maintenance', text: 'Preventive maintenance schedule is available', order: 14, evidence: true },
      { module: 'Preventive Maintenance', text: 'Service intervals are being followed', order: 15, evidence: true },
      { module: 'Preventive Maintenance', text: 'Maintenance records are updated', order: 16, evidence: true },
      { module: 'Preventive Maintenance', text: 'Breakdown frequency is monitored', order: 17, evidence: false },
      { module: 'Preventive Maintenance', text: 'Spare parts control system exists', order: 18, evidence: false },
      { module: 'Preventive Maintenance', text: 'Workshop quality control is in place', order: 19, evidence: false },
      // Driver Management (20-25)
      { module: 'Driver Management & Safety', text: 'All drivers have valid licenses', order: 20, evidence: true },
      { module: 'Driver Management & Safety', text: 'Driver training records are maintained', order: 21, evidence: true },
      { module: 'Driver Management & Safety', text: 'Defensive driving certification is current', order: 22, evidence: true },
      { module: 'Driver Management & Safety', text: 'Driver working hours are monitored', order: 23, evidence: false },
      { module: 'Driver Management & Safety', text: 'Accident history is tracked per driver', order: 24, evidence: false },
      { module: 'Driver Management & Safety', text: 'Driver disciplinary records are maintained', order: 25, evidence: false },
      // Fuel Management (26-30)
      { module: 'Fuel Management', text: 'Fuel monitoring system is installed', order: 26, evidence: true },
      { module: 'Fuel Management', text: 'Fuel consumption is tracked per vehicle', order: 27, evidence: true },
      { module: 'Fuel Management', text: 'Fuel variance is controlled', order: 28, evidence: true },
      { module: 'Fuel Management', text: 'Fuel card management system exists', order: 29, evidence: false },
      { module: 'Fuel Management', text: 'Fuel theft controls are in place', order: 30, evidence: false },
      // Fleet Utilization (31-35)
      { module: 'Fleet Utilization', text: 'Vehicle usage is tracked', order: 31, evidence: true },
      { module: 'Fleet Utilization', text: 'Idle time is monitored', order: 32, evidence: false },
      { module: 'Fleet Utilization', text: 'Trip authorization system exists', order: 33, evidence: true },
      { module: 'Fleet Utilization', text: 'Route planning is optimized', order: 34, evidence: false },
      { module: 'Fleet Utilization', text: 'Vehicle downtime is tracked', order: 35, evidence: true },
      // Cost Control (36-40)
      { module: 'Cost Control', text: 'Total cost of ownership is tracked', order: 36, evidence: true },
      { module: 'Cost Control', text: 'Maintenance costs are monitored', order: 37, evidence: true },
      { module: 'Cost Control', text: 'Fuel costs are monitored', order: 38, evidence: true },
      { module: 'Cost Control', text: 'Lease vs ownership analysis is performed', order: 39, evidence: false },
      { module: 'Cost Control', text: 'Cost per km is analyzed', order: 40, evidence: true },
      // Incident & Risk Management (41-45)
      { module: 'Incident & Risk Management', text: 'Accident reporting system is functional', order: 41, evidence: true },
      { module: 'Incident & Risk Management', text: 'Incident investigations are conducted', order: 42, evidence: true },
      { module: 'Incident & Risk Management', text: 'Root cause analysis is performed', order: 43, evidence: true },
      { module: 'Incident & Risk Management', text: 'Corrective actions are tracked', order: 44, evidence: true },
      { module: 'Incident & Risk Management', text: 'Insurance claims are managed properly', order: 45, evidence: false }
    ];
    
    for (const q of g4sQuestions) {
      await pool.query(`
        INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, requires_evidence)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuidv4(), g4sId, q.module, q.text, q.order, q.evidence]);
    }
    
    // Insert DVIR template
    const dvirResult = await pool.query(`
      INSERT INTO audit_templates (id, template_name, description, is_active)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [uuidv4(), 'Daily Vehicle Inspection (DVIR)', 'Pre-trip and post-trip vehicle inspection checklist for drivers', true]);
    
    const dvirId = dvirResult.rows[0].id;
    const dvirQuestions = [
      { module: 'Brakes', text: 'Service brakes functioning properly', order: 1 },
      { module: 'Brakes', text: 'Parking brake holds vehicle', order: 2 },
      { module: 'Steering', text: 'Steering mechanism operates smoothly', order: 3 },
      { module: 'Tires', text: 'Tires properly inflated and have adequate tread', order: 4 },
      { module: 'Wheels', text: 'Wheels and rims undamaged', order: 5 },
      { module: 'Lights', text: 'All lights working (headlights, brake lights, turn signals)', order: 6 },
      { module: 'Mirrors', text: 'Mirrors clean and properly adjusted', order: 7 },
      { module: 'Windshield', text: 'Windshield clean and free of cracks', order: 8 },
      { module: 'Wipers', text: 'Wiper blades in good condition', order: 9 },
      { module: 'Horn', text: 'Horn functioning', order: 10 },
      { module: 'Emergency', text: 'Emergency equipment present (fire extinguisher, triangles, first aid)', order: 11 },
      { module: 'Fluid Levels', text: 'Oil, coolant, and other fluid levels adequate', order: 12 },
      { module: 'Documentation', text: 'Registration and insurance documents present', order: 13 }
    ];
    
    for (const q of dvirQuestions) {
      await pool.query(`
        INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, requires_evidence)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuidv4(), dvirId, q.module, q.text, q.order, true]);
    }
    
    console.log('✅ Audit templates seeded (G4S Fleet Standard, DVIR)');
  } else {
    // Templates exist but may have no questions - check and seed if needed
    await seedQuestionsIfMissing(pool);
  }
};

// Seed questions for existing templates that have none
const seedQuestionsIfMissing = async (pool: Pool) => {
  // Check G4S template
  const g4sResult = await pool.query(
    "SELECT id FROM audit_templates WHERE template_name = $1",
    ['G4S Fleet Standard Audit']
  );
  
  if (g4sResult.rows.length > 0) {
    const g4sId = g4sResult.rows[0].id;
    const questionCount = await pool.query(
      'SELECT COUNT(*) as count FROM audit_questions WHERE template_id = $1',
      [g4sId]
    );
    
    if (parseInt(questionCount.rows[0].count) === 0) {
      // G4S template has no questions - seed them
      const g4sQuestions = [
        { module: 'Fleet Governance & Policy', text: 'Fleet policy is available and approved', order: 1, evidence: true },
        { module: 'Fleet Governance & Policy', text: 'Vehicle usage policy is defined and communicated', order: 2, evidence: true },
        { module: 'Fleet Governance & Policy', text: 'Driver authorization procedures are in place', order: 3, evidence: false },
        { module: 'Fleet Governance & Policy', text: 'Fuel management policy exists', order: 4, evidence: true },
        { module: 'Fleet Governance & Policy', text: 'Accident reporting procedures are documented', order: 5, evidence: true },
        { module: 'Fleet Governance & Policy', text: 'Preventive maintenance policy is enforced', order: 6, evidence: true },
        { module: 'Vehicle Compliance & Licensing', text: 'All vehicles have valid registration', order: 7, evidence: true },
        { module: 'Vehicle Compliance & Licensing', text: 'Insurance is valid for all vehicles', order: 8, evidence: true },
        { module: 'Vehicle Compliance & Licensing', text: 'Road licenses are current', order: 9, evidence: true },
        { module: 'Vehicle Compliance & Licensing', text: 'Inspection certificates are up to date', order: 10, evidence: true },
        { module: 'Vehicle Compliance & Licensing', text: 'Speed governors are installed and functional', order: 11, evidence: true },
        { module: 'Vehicle Compliance & Licensing', text: 'Vehicle tracking system is operational', order: 12, evidence: true },
        { module: 'Vehicle Compliance & Licensing', text: 'NTSA compliance is maintained (Kenya)', order: 13, evidence: true },
        { module: 'Preventive Maintenance', text: 'Preventive maintenance schedule is available', order: 14, evidence: true },
        { module: 'Preventive Maintenance', text: 'Service intervals are being followed', order: 15, evidence: true },
        { module: 'Preventive Maintenance', text: 'Maintenance records are updated', order: 16, evidence: true },
        { module: 'Preventive Maintenance', text: 'Breakdown frequency is monitored', order: 17, evidence: false },
        { module: 'Preventive Maintenance', text: 'Spare parts control system exists', order: 18, evidence: false },
        { module: 'Preventive Maintenance', text: 'Workshop quality control is in place', order: 19, evidence: false },
        { module: 'Driver Management & Safety', text: 'All drivers have valid licenses', order: 20, evidence: true },
        { module: 'Driver Management & Safety', text: 'Driver training records are maintained', order: 21, evidence: true },
        { module: 'Driver Management & Safety', text: 'Defensive driving certification is current', order: 22, evidence: true },
        { module: 'Driver Management & Safety', text: 'Driver working hours are monitored', order: 23, evidence: false },
        { module: 'Driver Management & Safety', text: 'Accident history is tracked per driver', order: 24, evidence: false },
        { module: 'Driver Management & Safety', text: 'Driver disciplinary records are maintained', order: 25, evidence: false },
        { module: 'Fuel Management', text: 'Fuel monitoring system is installed', order: 26, evidence: true },
        { module: 'Fuel Management', text: 'Fuel consumption is tracked per vehicle', order: 27, evidence: true },
        { module: 'Fuel Management', text: 'Fuel variance is controlled', order: 28, evidence: true },
        { module: 'Fuel Management', text: 'Fuel card management system exists', order: 29, evidence: false },
        { module: 'Fuel Management', text: 'Fuel theft controls are in place', order: 30, evidence: false },
        { module: 'Fleet Utilization', text: 'Vehicle usage is tracked', order: 31, evidence: true },
        { module: 'Fleet Utilization', text: 'Idle time is monitored', order: 32, evidence: false },
        { module: 'Fleet Utilization', text: 'Trip authorization system exists', order: 33, evidence: true },
        { module: 'Fleet Utilization', text: 'Route planning is optimized', order: 34, evidence: false },
        { module: 'Fleet Utilization', text: 'Vehicle downtime is tracked', order: 35, evidence: true },
        { module: 'Cost Control', text: 'Total cost of ownership is tracked', order: 36, evidence: true },
        { module: 'Cost Control', text: 'Maintenance costs are monitored', order: 37, evidence: true },
        { module: 'Cost Control', text: 'Fuel costs are monitored', order: 38, evidence: true },
        { module: 'Cost Control', text: 'Lease vs ownership analysis is performed', order: 39, evidence: false },
        { module: 'Cost Control', text: 'Cost per km is analyzed', order: 40, evidence: true },
        { module: 'Incident & Risk Management', text: 'Accident reporting system is functional', order: 41, evidence: true },
        { module: 'Incident & Risk Management', text: 'Incident investigations are conducted', order: 42, evidence: true },
        { module: 'Incident & Risk Management', text: 'Root cause analysis is performed', order: 43, evidence: true },
        { module: 'Incident & Risk Management', text: 'Corrective actions are tracked', order: 44, evidence: true },
        { module: 'Incident & Risk Management', text: 'Insurance claims are managed properly', order: 45, evidence: false }
      ];
      
      for (const q of g4sQuestions) {
        await pool.query(`
          INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, requires_evidence)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [uuidv4(), g4sId, q.module, q.text, q.order, q.evidence]);
      }
      console.log('✅ G4S Fleet Standard questions seeded (45 questions)');
    }
  }
  
  // Check DVIR template
  const dvirResult = await pool.query(
    "SELECT id FROM audit_templates WHERE template_name = $1",
    ['Daily Vehicle Inspection (DVIR)']
  );
  
  if (dvirResult.rows.length > 0) {
    const dvirId = dvirResult.rows[0].id;
    const questionCount = await pool.query(
      'SELECT COUNT(*) as count FROM audit_questions WHERE template_id = $1',
      [dvirId]
    );
    
    if (parseInt(questionCount.rows[0].count) === 0) {
      const dvirQuestions = [
        { module: 'Brakes', text: 'Service brakes functioning properly', order: 1 },
        { module: 'Brakes', text: 'Parking brake holds vehicle', order: 2 },
        { module: 'Steering', text: 'Steering mechanism operates smoothly', order: 3 },
        { module: 'Tires', text: 'Tires properly inflated and have adequate tread', order: 4 },
        { module: 'Wheels', text: 'Wheels and rims undamaged', order: 5 },
        { module: 'Lights', text: 'All lights working (headlights, brake lights, turn signals)', order: 6 },
        { module: 'Mirrors', text: 'Mirrors clean and properly adjusted', order: 7 },
        { module: 'Windshield', text: 'Windshield clean and free of cracks', order: 8 },
        { module: 'Wipers', text: 'Wiper blades in good condition', order: 9 },
        { module: 'Horn', text: 'Horn functioning', order: 10 },
        { module: 'Emergency', text: 'Emergency equipment present (fire extinguisher, triangles, first aid)', order: 11 },
        { module: 'Fluid Levels', text: 'Oil, coolant, and other fluid levels adequate', order: 12 },
        { module: 'Documentation', text: 'Registration and insurance documents present', order: 13 }
      ];
      
      for (const q of dvirQuestions) {
        await pool.query(`
          INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, requires_evidence)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [uuidv4(), dvirId, q.module, q.text, q.order, true]);
      }
      console.log('✅ DVIR questions seeded (13 questions)');
    }
  }
  
  // ========== MIGRATIONS ==========
  // Add missing columns to existing tables
  console.log('🔧 Running database migrations...');
  
  try {
    // Add soft delete columns to vehicles
    await pool.query(`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id)
    `);
    console.log('✅ Vehicles soft-delete columns added');
  } catch (err: any) {
    console.error('❌ Migration failed (soft-delete):', err.message);
  }
  
  try {
    // Check and add defect_notes to vehicles
    await pool.query(`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS defect_notes TEXT,
      ADD COLUMN IF NOT EXISTS defect_reported_at TIMESTAMP
    `);
    console.log('✅ Vehicles defect columns added');
  } catch (err: any) {
    console.error('❌ Migration failed (defect):', err.message);
  }
  
  try {
    // Add service columns if missing
    await pool.query(`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS last_service_date DATE,
      ADD COLUMN IF NOT EXISTS next_service_due DATE
    `);
    console.log('✅ Vehicles service columns added');
  } catch (err: any) {
    console.error('❌ Migration failed (service):', err.message);
  }
  
  console.log('🔧 Migrations complete');
};

// Separate migration function for complex operations
export const runMigrations = async () => {
  if (!pool) throw new Error('Database not initialized');
  
  console.log('🔧 Running additional migrations...');
  
  // Run inspection module migration
  await runInspectionMigration(pool);
  
  // Add deleted_at to staff table for consistency
  try {
    await pool.query(`
      ALTER TABLE staff 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id)
    `);
    console.log('✅ Staff soft-delete columns added');
  } catch (err: any) {
    console.error('❌ Staff migration failed:', err.message);
  }

  // ==================== PHOTO EVIDENCE TABLES ====================
  
  // Audit photos table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL,
        audit_session_id UUID,
        question_id UUID NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        thumbnail_url VARCHAR(500),
        file_size INTEGER,
        mime_type VARCHAR(50),
        uploaded_by UUID REFERENCES users(id),
        company_id UUID,
        issue_type VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Audit photos table created');
  } catch (err: any) {
    console.error('❌ Audit photos migration failed:', err.message);
  }

  // Inspection photos table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspection_photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inspection_id UUID NOT NULL,
        job_card_id UUID,
        image_url VARCHAR(500) NOT NULL,
        thumbnail_url VARCHAR(500),
        file_size INTEGER,
        mime_type VARCHAR(50),
        issue_description TEXT,
        severity VARCHAR(20) DEFAULT 'medium',
        uploaded_by UUID REFERENCES users(id),
        company_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Inspection photos table created');
  } catch (err: any) {
    console.error('❌ Inspection photos migration failed:', err.message);
  }

  // Add company_id to existing tables for multi-tenant isolation
  const tablesNeedingCompanyId = [
    'vehicles', 'staff', 'routes', 'fuel_records', 'repairs', 
    'inventory_items', 'inventory_categories', 'training_courses',
    'audit_sessions', 'job_cards', 'accidents'
  ];
  
  for (const table of tablesNeedingCompanyId) {
    try {
      await pool.query(`
        ALTER TABLE ${table} 
        ADD COLUMN IF NOT EXISTS company_id UUID
      `);
    } catch (err: any) {
      console.error(`❌ Failed to add company_id to ${table}:`, err.message);
    }
  }
  console.log('✅ Company ID columns added for multi-tenant support');
};

// Run inspection module migration
const runInspectionMigration = async (pool: Pool) => {
  console.log('🔧 Running inspection module migration...');
  
  try {
    // Check if inspection tables already exist
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'vehicle_inspections'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Inspection tables already exist, skipping migration');
      return;
    }
    
    // Read and execute the migration SQL
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(__dirname, '../../database/migrations_20250324_inspection_module.sql');
    
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
      console.log('✅ Inspection module migration completed');
    } else {
      console.log('⚠️ Inspection migration file not found, skipping');
    }
  } catch (err: any) {
    console.error('❌ Inspection migration failed:', err.message);
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
