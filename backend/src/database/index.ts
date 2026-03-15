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
      defect_notes TEXT,
      defect_reported_at TIMESTAMP,
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

  console.log('✅ Tables created');
  
  // Create training tables
  await createTrainingTables();
  
  // Create audit tables and seed templates
  await createAuditTables();
  
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
