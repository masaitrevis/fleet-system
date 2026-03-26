import { Router, Request, Response } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

const router = Router();

// Demo company configuration
const DEMO_COMPANY = {
  name: 'NextFleet Logistics',
  slug: 'nextfleet-logistics',
  email: 'info@nextfleet.com',
  phone: '+1 (555) 123-4567',
  address: '123 Fleet Street, Logistics City, LC 12345'
};

// Demo users configuration
const DEMO_USERS = [
  {
    email: 'admin@nextfleet.com',
    password: 'Admin123!',
    role: 'admin',
    staffName: 'Alex Administrator',
    staffNo: 'ADM001',
    department: 'Management',
    branch: 'Head Office',
    phone: '+1 (555) 100-0001'
  },
  {
    email: 'manager@nextfleet.com',
    password: 'Manager123!',
    role: 'manager',
    staffName: 'Morgan Manager',
    staffNo: 'MGR001',
    department: 'Operations',
    branch: 'Head Office',
    phone: '+1 (555) 100-0002'
  },
  {
    email: 'staff@nextfleet.com',
    password: 'Staff123!',
    role: 'viewer',
    staffName: 'Sam Staff',
    staffNo: 'STF001',
    department: 'Operations',
    branch: 'Head Office',
    phone: '+1 (555) 100-0003'
  },
  {
    email: 'driver@nextfleet.com',
    password: 'Driver123!',
    role: 'viewer',
    staffName: 'David Driver',
    staffNo: 'DRV001',
    department: 'Transport',
    branch: 'Main Depot',
    phone: '+1 (555) 100-0004',
    driverRole: 'Driver'
  },
  {
    email: 'supervisor@nextfleet.com',
    password: 'Supervisor123!',
    role: 'manager',
    staffName: 'Sarah Supervisor',
    staffNo: 'SUP001',
    department: 'Transport',
    branch: 'Main Depot',
    phone: '+1 (555) 100-0005',
    driverRole: 'Transport Supervisor'
  }
];

// Vehicle data
const VEHICLE_DATA = [
  { reg: 'NF-1001', make: 'Toyota', model: 'Hilux Double Cab', year: 2022, status: 'Active', dept: 'Transport', type: 'Pickup' },
  { reg: 'NF-1002', make: 'Ford', model: 'Ranger XLT', year: 2023, status: 'Active', dept: 'Transport', type: 'Pickup' },
  { reg: 'NF-1003', make: 'Mercedes', model: 'Sprinter 316', year: 2021, status: 'Active', dept: 'Logistics', type: 'Van' },
  { reg: 'NF-1004', make: 'Isuzu', model: 'NPR 400', year: 2022, status: 'In Service', dept: 'Transport', type: 'Truck' },
  { reg: 'NF-1005', make: 'Mitsubishi', model: 'Fuso Canter', year: 2023, status: 'Active', dept: 'Logistics', type: 'Truck' },
  { reg: 'NF-1006', make: 'Toyota', model: 'Land Cruiser', year: 2021, status: 'Active', dept: 'Management', type: 'SUV' },
  { reg: 'NF-1007', make: 'Nissan', model: 'Navara Pro-4X', year: 2023, status: 'Active', dept: 'Transport', type: 'Pickup' },
  { reg: 'NF-1008', make: 'Volvo', model: 'FM 370', year: 2022, status: 'In Service', dept: 'Logistics', type: 'Heavy Truck' },
  { reg: 'NF-1009', make: 'Hino', model: '300 Series', year: 2021, status: 'Defect', dept: 'Transport', type: 'Truck' },
  { reg: 'NF-1010', make: 'Toyota', model: 'Coaster', year: 2023, status: 'Active', dept: 'Operations', type: 'Bus' }
];

// Driver data
const DRIVER_DATA = [
  { name: 'John Kamau', license: 'DL-K12345', class: 'C,D,E', expiry: '2026-06-15', phone: '+1 (555) 200-0001' },
  { name: 'Peter Ochieng', license: 'DL-K12346', class: 'C,D', expiry: '2025-12-20', phone: '+1 (555) 200-0002' },
  { name: 'Mary Wanjiku', license: 'DL-K12347', class: 'B,C', expiry: '2027-03-10', phone: '+1 (555) 200-0003' },
  { name: 'James Mwangi', license: 'DL-K12348', class: 'C,D,E', expiry: '2026-09-25', phone: '+1 (555) 200-0004' },
  { name: 'Grace Achieng', license: 'DL-K12349', class: 'C,D', expiry: '2025-11-30', phone: '+1 (555) 200-0005' },
  { name: 'Robert Kipchoge', license: 'DL-K12350', class: 'C,D,E,G', expiry: '2027-01-15', phone: '+1 (555) 200-0006' },
  { name: 'Alice Mutua', license: 'DL-K12351', class: 'B,C', expiry: '2026-04-20', phone: '+1 (555) 200-0007' },
  { name: 'Daniel Kimani', license: 'DL-K12352', class: 'C,D', expiry: '2026-08-05', phone: '+1 (555) 200-0008' }
];

// Fuel station data
const FUEL_STATIONS = ['Shell Downtown', 'Total Highway', 'Oilibya Industrial', 'Rubis Central', 'Hashi Energy', 'Galana Oil', 'Engen Main', 'Petrobras Depot'];

// Inventory parts data
const INVENTORY_DATA = [
  { number: 'OIL-001', name: 'Engine Oil 15W-40', category: 'Fluids', cost: 45.00, qty: 50 },
  { number: 'FLT-001', name: 'Oil Filter', category: 'Filters', cost: 12.50, qty: 30 },
  { number: 'FLT-002', name: 'Air Filter', category: 'Filters', cost: 28.00, qty: 25 },
  { number: 'FLT-003', name: 'Fuel Filter', category: 'Filters', cost: 35.00, qty: 20 },
  { number: 'BRK-001', name: 'Brake Pads (Front)', category: 'Brakes', cost: 85.00, qty: 15 },
  { number: 'BRK-002', name: 'Brake Pads (Rear)', category: 'Brakes', cost: 75.00, qty: 12 },
  { number: 'BRK-003', name: 'Brake Discs', category: 'Brakes', cost: 120.00, qty: 8 },
  { number: 'TIR-001', name: 'Tire 205/65R16', category: 'Tires', cost: 180.00, qty: 20 },
  { number: 'TIR-002', name: 'Tire 265/65R17', category: 'Tires', cost: 220.00, qty: 16 },
  { number: 'BAT-001', name: 'Battery 12V 100Ah', category: 'Electrical', cost: 150.00, qty: 10 },
  { number: 'BUL-001', name: 'Headlight Bulb H4', category: 'Electrical', cost: 18.00, qty: 40 },
  { number: 'BUL-002', name: 'Tail Light Bulb', category: 'Electrical', cost: 8.50, qty: 50 },
  { number: 'WIP-001', name: 'Wiper Blades Set', category: 'Body', cost: 25.00, qty: 30 },
  { number: 'COOL-001', name: 'Coolant 5L', category: 'Fluids', cost: 32.00, qty: 24 },
  { number: 'GRE-001', name: 'Grease Cartridge', category: 'Fluids', cost: 15.00, qty: 40 },
  { number: 'BEL-001', name: 'Fan Belt', category: 'Engine', cost: 28.00, qty: 15 },
  { number: 'BEL-002', name: 'Timing Belt', category: 'Engine', cost: 95.00, qty: 8 },
  { number: 'SPK-001', name: 'Spark Plugs Set', category: 'Engine', cost: 45.00, qty: 20 },
  { number: 'CLU-001', name: 'Clutch Kit', category: 'Transmission', cost: 280.00, qty: 6 },
  { number: 'SHO-001', name: 'Shock Absorber', category: 'Suspension', cost: 110.00, qty: 12 }
];

// Supplier data
const SUPPLIER_DATA = [
  { name: 'AutoParts Kenya Ltd', email: 'orders@autoparts.co.ke', phone: '+254 720 123 456', address: 'Industrial Area, Nairobi' },
  { name: 'Toyota Kenya', email: 'parts@toyota.co.ke', phone: '+254 733 987 654', address: 'Mombasa Road, Nairobi' },
  { name: 'TotalEnergies Kenya', email: 'fleet@total.co.ke', phone: '+254 722 456 789', address: 'Nairobi West, Nairobi' }
];

// Document types
const DOCUMENT_TYPES = [
  { type: 'insurance', title: 'Comprehensive Insurance', months: 12 },
  { type: 'license', title: 'Vehicle License', months: 12 },
  { type: 'inspection', title: 'Annual Inspection', months: 12 },
  { type: 'tracking', title: 'GPS Tracking Subscription', months: 12 },
  { type: 'warranty', title: 'Extended Warranty', months: 24 }
];

// Alert types
const ALERT_TYPES = [
  { type: 'maintenance', severity: 'medium', title: 'Service Due' },
  { type: 'license', severity: 'high', title: 'License Expiring' },
  { type: 'fuel', severity: 'low', title: 'Fuel Variance Detected' },
  { type: 'driver', severity: 'medium', title: 'Driver License Expiring' },
  { type: 'vehicle', severity: 'high', title: 'Vehicle Defect Reported' },
  { type: 'insurance', severity: 'high', title: 'Insurance Expiring' },
  { type: 'parts', severity: 'low', title: 'Low Stock Alert' },
  { type: 'route', severity: 'medium', title: 'Route Variance Alert' },
  { type: 'safety', severity: 'high', title: 'Safety Incident' },
  { type: 'system', severity: 'low', title: 'System Notification' }
];

/**
 * Check if demo data already exists
 */
const checkDemoDataExists = async (): Promise<boolean> => {
  try {
    // Check for demo company users
    const result = await query(
      "SELECT COUNT(*) as count FROM users WHERE email LIKE '%@nextfleet.com'"
    );
    return parseInt(result[0].count) > 0;
  } catch (error) {
    console.error('Error checking demo data:', error);
    return false;
  }
};

/**
 * Create demo company and users
 */
const createDemoUsers = async (): Promise<{ userId: string; staffId: string; role: string; email: string }[]> => {
  const createdUsers: { userId: string; staffId: string; role: string; email: string }[] = [];
  
  for (const userData of DEMO_USERS) {
    const userId = uuidv4();
    const staffId = uuidv4();
    const hashedPassword = bcrypt.hashSync(userData.password, 10);
    
    // Create user
    await query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [userId, userData.email, hashedPassword, userData.role]
    );
    
    // Create staff record
    const role = userData.driverRole || 'Staff';
    await query(
      `INSERT INTO staff (id, staff_no, staff_name, email, phone, department, branch, role, safety_score) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [staffId, userData.staffNo, userData.staffName, userData.email, userData.phone, 
       userData.department, userData.branch, role, 95]
    );
    
    createdUsers.push({ userId, staffId, role: userData.role, email: userData.email });
    console.log(`✅ Created user: ${userData.email} (${userData.role})`);
  }
  
  return createdUsers;
};

/**
 * Create demo vehicles
 */
const createVehicles = async (): Promise<string[]> => {
  const vehicleIds: string[] = [];
  
  for (const v of VEHICLE_DATA) {
    const id = uuidv4();
    const mileage = Math.floor(Math.random() * 80000) + 20000;
    const lastService = new Date();
    lastService.setMonth(lastService.getMonth() - Math.floor(Math.random() * 3));
    
    const nextService = new Date(lastService);
    nextService.setMonth(nextService.getMonth() + 3);
    
    await query(`
      INSERT INTO vehicles (
        id, registration_num, make_model, year_of_manufacture, year_of_purchase,
        department, branch, status, current_mileage, ownership,
        target_consumption_rate, last_service_date, next_service_due,
        minor_service_interval, medium_service_interval, major_service_interval,
        replacement_mileage, replacement_age
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      id, v.reg, `${v.make} ${v.model}`, v.year, v.year,
      v.dept, 'Head Office', v.status, mileage, 'Company Owned',
      8.5, lastService.toISOString().split('T')[0], nextService.toISOString().split('T')[0],
      5000, 15000, 45000, 200000, 5
    ]);
    
    vehicleIds.push(id);
    console.log(`✅ Created vehicle: ${v.reg}`);
  }
  
  return vehicleIds;
};

/**
 * Create demo drivers (additional to staff users)
 */
const createDrivers = async (vehicleIds: string[]): Promise<string[]> => {
  const driverIds: string[] = [];
  
  for (const d of DRIVER_DATA) {
    const id = uuidv4();
    const staffNo = `DRV${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
    
    await query(
      `INSERT INTO staff (id, staff_no, staff_name, email, phone, department, branch, role, safety_score) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, staffNo, d.name, `${staffNo.toLowerCase()}@nextfleet.com`, d.phone, 
       'Transport', 'Main Depot', 'Driver', Math.floor(Math.random() * 15) + 85]
    );
    
    driverIds.push(id);
    console.log(`✅ Created driver: ${d.name}`);
  }
  
  return driverIds;
};

/**
 * Create fuel transactions
 */
const createFuelTransactions = async (vehicleIds: string[]): Promise<void> => {
  const today = new Date();
  
  for (let i = 0; i < 15; i++) {
    const vehicleId = vehicleIds[Math.floor(Math.random() * vehicleIds.length)];
    const fuelDate = new Date(today);
    fuelDate.setDate(fuelDate.getDate() - Math.floor(Math.random() * 45));
    
    const pastMileage = Math.floor(Math.random() * 80000) + 20000;
    const distance = Math.floor(Math.random() * 800) + 200;
    const currentMileage = pastMileage + distance;
    const quantity = parseFloat((distance / (Math.random() * 3 + 6)).toFixed(2));
    const kmPerLiter = parseFloat((distance / quantity).toFixed(2));
    const amount = parseFloat((quantity * (Math.random() * 0.5 + 1.5)).toFixed(2));
    const costPerKm = parseFloat((amount / distance).toFixed(4));
    
    await query(`
      INSERT INTO fuel_records (
        id, department, fuel_date, vehicle_id, card_num, card_name,
        past_mileage, current_mileage, quantity_liters, km_per_liter,
        amount, cost_per_km, place
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      uuidv4(), 'Transport', fuelDate.toISOString().split('T')[0], vehicleId,
      `CARD${String(Math.floor(Math.random() * 9000) + 1000)}`, 'Fleet Card',
      pastMileage, currentMileage, quantity, kmPerLiter, amount, costPerKm,
      FUEL_STATIONS[Math.floor(Math.random() * FUEL_STATIONS.length)]
    ]);
  }
  
  console.log('✅ Created 15 fuel transactions');
};

/**
 * Create routes/assignments
 */
const createAssignments = async (vehicleIds: string[], driverIds: string[]): Promise<string[]> => {
  const routeIds: string[] = [];
  const today = new Date();
  
  const statuses = ['completed', 'completed', 'completed', 'active', 'pending'];
  
  for (let i = 0; i < 5; i++) {
    const id = uuidv4();
    const vehicleId = vehicleIds[Math.floor(Math.random() * vehicleIds.length)];
    const driver1Id = driverIds[Math.floor(Math.random() * driverIds.length)];
    const routeDate = new Date(today);
    routeDate.setDate(routeDate.getDate() - (i * 3));
    
    const targetKm = Math.floor(Math.random() * 300) + 100;
    const actualKm = Math.floor(targetKm * (0.9 + Math.random() * 0.2));
    const targetFuel = parseFloat((targetKm / 8).toFixed(2));
    const actualFuel = parseFloat((actualKm / (7 + Math.random() * 3)).toFixed(2));
    
    await query(`
      INSERT INTO routes (
        id, route_date, route_name, driver1_id, vehicle_id,
        target_km, actual_km, target_fuel_consumption, actual_fuel,
        target_consumption_rate, actual_consumption_rate, variance, comments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      id, routeDate.toISOString().split('T')[0], `Route-${String(i + 1).padStart(3, '0')}`,
      driver1Id, vehicleId, targetKm, actualKm, targetFuel, actualFuel,
      8.0, parseFloat((actualKm / actualFuel).toFixed(2)),
      parseFloat((actualFuel - targetFuel).toFixed(2)),
      'Regular delivery route'
    ]);
    
    routeIds.push(id);
  }
  
  console.log('✅ Created 5 assignments/routes');
  return routeIds;
};

/**
 * Create trips (requisitions)
 */
const createTrips = async (vehicleIds: string[], driverIds: string[], staffIds: string[]): Promise<void> => {
  const today = new Date();
  const statuses = ['completed', 'completed', 'approved'];
  const purposes = ['Client Meeting', 'Delivery', 'Site Inspection', 'Training', 'Emergency Response'];
  
  for (let i = 0; i < 3; i++) {
    const id = uuidv4();
    const requestNo = `REQ${String(Math.floor(Math.random() * 90000) + 10000)}`;
    const vehicleId = vehicleIds[Math.floor(Math.random() * vehicleIds.length)];
    const driverId = driverIds[Math.floor(Math.random() * driverIds.length)];
    const requestedBy = staffIds[Math.floor(Math.random() * staffIds.length)];
    const travelDate = new Date(today);
    travelDate.setDate(travelDate.getDate() - (i * 7));
    
    const startingOdo = Math.floor(Math.random() * 80000) + 20000;
    const distance = Math.floor(Math.random() * 150) + 50;
    
    await query(`
      INSERT INTO requisitions (
        id, request_no, requested_by, place_of_departure, destination,
        purpose, travel_date, travel_time, num_passengers, status,
        approved_by, approved_at, vehicle_id, driver_id, allocated_by, allocated_at,
        inspection_tires, inspection_brakes, inspection_lights, inspection_oil,
        inspection_coolant, inspection_battery, inspection_wipers, inspection_mirrors,
        inspection_seatbelts, inspection_fuel, inspection_passed,
        starting_odometer, ending_odometer, distance_km,
        departed_at, returned_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
    `, [
      id, requestNo, requestedBy, 'Head Office', ['Nairobi CBD', 'Mombasa Road', 'Industrial Area', 'Westlands'][i],
      purposes[i], travelDate.toISOString().split('T')[0], '08:00:00', 2 + i,
      statuses[i], requestedBy, travelDate, vehicleId, driverId, requestedBy, travelDate,
      true, true, true, true, true, true, true, true, true, true, true,
      startingOdo, startingOdo + distance, distance,
      travelDate, new Date(travelDate.getTime() + 4 * 60 * 60 * 1000)
    ]);
  }
  
  console.log('✅ Created 3 trips');
};

/**
 * Create inventory items
 */
const createInventory = async (): Promise<string[]> => {
  const partIds: string[] = [];
  
  for (const item of INVENTORY_DATA) {
    const id = uuidv4();
    
    await query(`
      INSERT INTO stock_parts (
        id, part_number, part_name, description, category,
        manufacturer, supplier, unit_cost, quantity_on_hand, reorder_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      id, item.number, item.name, `Quality ${item.name} for fleet vehicles`, item.category,
      'OEM Parts Ltd', SUPPLIER_DATA[Math.floor(Math.random() * SUPPLIER_DATA.length)].name,
      item.cost, item.qty, 5
    ]);
    
    partIds.push(id);
  }
  
  console.log('✅ Created 20 inventory items');
  return partIds;
};

/**
 * Create suppliers
 */
const createSuppliers = async (): Promise<void> => {
  for (const s of SUPPLIER_DATA) {
    await query(`
      INSERT INTO customers (id, customer_name, customer_email, customer_phone, customer_address)
      VALUES ($1, $2, $3, $4, $5)
    `, [uuidv4(), s.name, s.email, s.phone, s.address]);
  }
  
  console.log('✅ Created 3 suppliers');
};

/**
 * Create invoices
 */
const createInvoices = async (vehicleIds: string[]): Promise<void> => {
  const today = new Date();
  
  for (let i = 0; i < 5; i++) {
    const id = uuidv4();
    const invoiceNumber = `INV-2024-${String(i + 1).padStart(4, '0')}`;
    const invoiceDate = new Date(today);
    invoiceDate.setDate(invoiceDate.getDate() - (i * 15));
    
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    
    const subtotal = parseFloat((Math.random() * 2000 + 500).toFixed(2));
    const tax = parseFloat((subtotal * 0.16).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));
    const paid = i < 3 ? total : parseFloat((total * 0.5).toFixed(2));
    
    await query(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, vehicle_id, invoice_date, due_date,
        status, subtotal, tax_amount, total, amount_paid, labor_hours, labor_rate, labor_total, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      id, invoiceNumber, null, vehicleIds[Math.floor(Math.random() * vehicleIds.length)],
      invoiceDate.toISOString().split('T')[0], dueDate.toISOString().split('T')[0],
      i < 3 ? 'Paid' : (i === 3 ? 'Sent' : 'Overdue'),
      subtotal, tax, total, paid,
      Math.floor(Math.random() * 8) + 2, 50, parseFloat((Math.random() * 400 + 100).toFixed(2)),
      'Vehicle maintenance and repairs'
    ]);
  }
  
  console.log('✅ Created 5 invoices');
};

/**
 * Create alerts
 */
const createAlerts = async (vehicleIds: string[], driverIds: string[]): Promise<void> => {
  const today = new Date();
  
  for (let i = 0; i < 10; i++) {
    const alert = ALERT_TYPES[i];
    const entityId = i % 2 === 0 
      ? vehicleIds[Math.floor(Math.random() * vehicleIds.length)]
      : driverIds[Math.floor(Math.random() * driverIds.length)];
    
    const createdAt = new Date(today);
    createdAt.setHours(createdAt.getHours() - (i * 6));
    
    await query(`
      INSERT INTO risk_alerts (
        id, alert_type, severity, title, description,
        entity_id, entity_type, entity_name, acknowledged, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      uuidv4(), alert.type, alert.severity, `${alert.title} #${i + 1}`,
      `Demo alert for ${alert.type} tracking and management`,
      entityId, i % 2 === 0 ? 'vehicle' : 'driver',
      i % 2 === 0 ? `Vehicle-${String(i + 1).padStart(3, '0')}` : `Driver-${String(i + 1).padStart(3, '0')}`,
      i > 5, createdAt
    ]);
  }
  
  console.log('✅ Created 10 alerts');
};

/**
 * Create documents with expiry dates
 */
const createDocuments = async (vehicleIds: string[]): Promise<void> => {
  const today = new Date();
  
  for (let i = 0; i < 5; i++) {
    const doc = DOCUMENT_TYPES[i];
    const vehicleId = vehicleIds[i % vehicleIds.length];
    
    const issueDate = new Date(today);
    issueDate.setMonth(issueDate.getMonth() - Math.floor(Math.random() * 6));
    
    const expiryDate = new Date(issueDate);
    expiryDate.setMonth(expiryDate.getMonth() + doc.months);
    
    await query(`
      INSERT INTO accident_evidence (
        id, accident_id, evidence_type, file_url, description, uploaded_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      uuidv4(), vehicleId, 'document',
      `https://storage.nextfleet.com/documents/${doc.type}_${i + 1}.pdf`,
      `${doc.title} - Valid until ${expiryDate.toISOString().split('T')[0]}`,
      null, issueDate
    ]);
  }
  
  console.log('✅ Created 5 documents with expiry dates');
};

// GET /api/seed-demo - Check and create demo data
router.get('/', async (req: Request, res: Response) => {
  try {
    const exists = await checkDemoDataExists();
    
    if (exists) {
      return res.json({
        success: true,
        message: 'Demo data already exists',
        alreadySeeded: true,
        credentials: DEMO_USERS.map(u => ({
          email: u.email,
          password: u.password,
          role: u.role,
          staffName: u.staffName
        })),
        company: DEMO_COMPANY
      });
    }
    
    // Create all demo data
    console.log('🌱 Starting demo data seeding...');
    
    // 1. Create users
    const createdUsers = await createDemoUsers();
    
    // 2. Create vehicles
    const vehicleIds = await createVehicles();
    
    // 3. Create drivers
    const driverIds = await createDrivers(vehicleIds);
    const allDriverIds = [...driverIds, ...createdUsers.filter(u => u.role === 'viewer').map(u => u.staffId)];
    const allStaffIds = createdUsers.map(u => u.staffId);
    
    // 4. Create fuel transactions
    await createFuelTransactions(vehicleIds);
    
    // 5. Create assignments/routes
    const routeIds = await createAssignments(vehicleIds, allDriverIds);
    
    // 6. Create trips
    await createTrips(vehicleIds, allDriverIds, allStaffIds);
    
    // 7. Create inventory
    const partIds = await createInventory();
    
    // 8. Create suppliers
    await createSuppliers();
    
    // 9. Create invoices
    await createInvoices(vehicleIds);
    
    // 10. Create alerts
    await createAlerts(vehicleIds, allDriverIds);
    
    // 11. Create documents
    await createDocuments(vehicleIds);
    
    console.log('✅ Demo data seeding completed!');
    
    res.json({
      success: true,
      message: 'Demo data created successfully',
      alreadySeeded: false,
      credentials: DEMO_USERS.map(u => ({
        email: u.email,
        password: u.password,
        role: u.role,
        staffName: u.staffName
      })),
      company: DEMO_COMPANY,
      summary: {
        users: DEMO_USERS.length,
        vehicles: VEHICLE_DATA.length,
        drivers: DRIVER_DATA.length + 2, // +2 from demo users
        fuelTransactions: 15,
        assignments: 5,
        trips: 3,
        inventoryItems: INVENTORY_DATA.length,
        invoices: 5,
        alerts: 10,
        documents: 5,
        suppliers: SUPPLIER_DATA.length
      }
    });
    
  } catch (error: any) {
    console.error('Demo seeding error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create demo data',
      details: error.message
    });
  }
});

// POST /api/seed-demo - Force reseed (optional)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { force } = req.body;
    
    if (force) {
      // Delete existing demo data
      await query("DELETE FROM users WHERE email LIKE '%@nextfleet.com'");
      console.log('🗑️  Cleared existing demo users');
    }
    
    // Redirect to GET handler
    res.redirect('/api/seed-demo');
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to reseed demo data',
      details: error.message
    });
  }
});

export default router;
