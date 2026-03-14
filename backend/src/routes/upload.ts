import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const upload = multer({ dest: '/tmp/uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const results: any = {};

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      if (data.length < 2) continue; // Skip empty sheets

      console.log(`Processing sheet: ${sheetName}, rows: ${data.length}`);

      try {
        switch (sheetName.toLowerCase()) {
          case 'vehicles':
          case 'fleet':
            results.vehicles = await importVehicles(data);
            break;
          case 'staff':
            results.staff = await importStaff(data);
            break;
          case 'routes':
            results.routes = await importRoutes(data);
            break;
          case 'fuel':
          case 'total fuel template':
            results.fuel = await importFuel(data);
            break;
          case 'repairs':
          case 'repairs template':
            results.repairs = await importRepairs(data);
            break;
          case 'accidents':
            results.accidents = await importAccidents(data);
            break;
          case 'requisitions':
            results.requisitions = await importRequisitions(data);
            break;
          default:
            console.log(`Unknown sheet: ${sheetName}`);
        }
      } catch (sheetError: any) {
        console.error(`Error processing ${sheetName}:`, sheetError);
        results[sheetName] = { error: sheetError.message };
      }
    }

    res.json({ 
      message: 'Excel import completed',
      imported: results
    });
  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Import failed', details: error.message });
  }
});

async function importVehicles(data: any[][]) {
  const headers = data[0].map((h: string) => h.toLowerCase().trim());
  console.log('Vehicle headers:', headers);
  
  // Find column indices
  const getCol = (name: string) => headers.findIndex((h: string) => h.includes(name.toLowerCase()));
  
  const regIdx = getCol('registration');
  const yearManIdx = getCol('manufacture');
  const yearPurIdx = getCol('purchase');
  const makeIdx = getCol('make');
  const ownershipIdx = getCol('ownership');
  const deptIdx = getCol('department');
  const branchIdx = getCol('branch');
  const minorIdx = getCol('minor');
  const mediumIdx = getCol('medium');
  const majorIdx = getCol('major');
  const rateIdx = getCol('consumption');
  const statusIdx = getCol('status');
  const mileageIdx = getCol('mileage');

  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const regNum = regIdx >= 0 ? row[regIdx] : row[0];
    
    if (!regNum) continue;

    try {
      const id = uuidv4();
      await query(`
        INSERT INTO vehicles (
          id, registration_num, year_of_manufacture, year_of_purchase,
          replacement_mileage, replacement_age, make_model, ownership,
          department, branch, minor_service_interval, medium_service_interval,
          major_service_interval, target_consumption_rate, status, current_mileage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (registration_num) DO UPDATE SET
          year_of_manufacture = EXCLUDED.year_of_manufacture,
          make_model = EXCLUDED.make_model,
          updated_at = CURRENT_TIMESTAMP
      `, [
        id, 
        String(regNum).trim(), 
        yearManIdx >= 0 ? parseInt(row[yearManIdx]) || null : null, 
        yearPurIdx >= 0 ? parseInt(row[yearPurIdx]) || null : null,
        200000, // replacement_mileage
        10, // replacement_age
        makeIdx >= 0 ? row[makeIdx] : 'Unknown', 
        ownershipIdx >= 0 ? row[ownershipIdx] : 'Company',
        deptIdx >= 0 ? row[deptIdx] : 'Transport', 
        branchIdx >= 0 ? row[branchIdx] : 'Nairobi HQ',
        minorIdx >= 0 ? parseInt(row[minorIdx]) || 5000 : 5000, 
        mediumIdx >= 0 ? parseInt(row[mediumIdx]) || 15000 : 15000,
        majorIdx >= 0 ? parseInt(row[majorIdx]) || 30000 : 30000, 
        rateIdx >= 0 ? parseFloat(row[rateIdx]) || 8.0 : 8.0,
        statusIdx >= 0 ? row[statusIdx] : 'Active',
        mileageIdx >= 0 ? parseInt(row[mileageIdx]) || 0 : 0
      ]);
      count++;
    } catch (e: any) {
      console.error('Vehicle row error:', e.message, row);
    }
  }
  return count;
}

async function importStaff(data: any[][]) {
  const headers = data[0].map((h: string) => h.toLowerCase().trim());
  console.log('Staff headers:', headers);
  
  const getCol = (name: string) => headers.findIndex((h: string) => h.includes(name.toLowerCase()));
  
  const staffNoIdx = getCol('staff_no');
  const nameIdx = getCol('name');
  const emailIdx = getCol('email');
  const phoneIdx = getCol('phone');
  const desigIdx = getCol('designation');
  const deptIdx = getCol('department');
  const branchIdx = getCol('branch');
  const roleIdx = getCol('role');

  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const staffName = nameIdx >= 0 ? row[nameIdx] : row[1];
    
    if (!staffName) continue;

    try {
      const id = uuidv4();
      await query(`
        INSERT INTO staff (id, staff_no, staff_name, email, phone, designation, department, branch, role, comments)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (staff_no) DO UPDATE SET
          staff_name = EXCLUDED.staff_name,
          email = EXCLUDED.email,
          updated_at = CURRENT_TIMESTAMP
      `, [
        id, 
        staffNoIdx >= 0 ? row[staffNoIdx] : `ST${1000 + i}`, 
        staffName,
        emailIdx >= 0 ? row[emailIdx] : null,
        phoneIdx >= 0 ? row[phoneIdx] : null,
        desigIdx >= 0 ? row[desigIdx] : 'Driver',
        deptIdx >= 0 ? row[deptIdx] : 'Transport',
        branchIdx >= 0 ? row[branchIdx] : 'Nairobi HQ',
        roleIdx >= 0 ? row[roleIdx] : 'Driver',
        ''
      ]);
      count++;
    } catch (e: any) {
      console.error('Staff row error:', e.message, row);
    }
  }
  return count;
}

async function importRoutes(data: any[][]) {
  const headers = data[0].map((h: string) => h.toLowerCase().trim());
  console.log('Routes headers:', headers);
  
  const getCol = (name: string) => headers.findIndex((h: string) => h.includes(name.toLowerCase()));
  
  const dateIdx = getCol('route_date');
  const nameIdx = getCol('route_name');
  const driverIdx = getCol('driver1');
  const vehicleIdx = getCol('vehicle');
  const targetKmIdx = getCol('target_km');
  const actualKmIdx = getCol('actual_km');
  const targetFuelIdx = getCol('target_fuel');
  const actualFuelIdx = getCol('actual_fuel');
  const varianceIdx = getCol('variance');

  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const routeName = nameIdx >= 0 ? row[nameIdx] : row[1];
    
    if (!routeName) continue;

    try {
      // Look up driver by staff_no or name
      let driverId = null;
      const driverRef = driverIdx >= 0 ? row[driverIdx] : '';
      if (driverRef) {
        const driverRes = await query('SELECT id FROM staff WHERE staff_no = $1 OR staff_name = $1', [driverRef]);
        if (driverRes.length > 0) driverId = driverRes[0].id;
      }
      
      // Look up vehicle by registration_num
      let vehicleId = null;
      const vehicleRef = vehicleIdx >= 0 ? row[vehicleIdx] : '';
      if (vehicleRef) {
        const vehRes = await query('SELECT id FROM vehicles WHERE registration_num = $1', [vehicleRef]);
        if (vehRes.length > 0) vehicleId = vehRes[0].id;
      }

      const id = uuidv4();
      const targetKm = targetKmIdx >= 0 ? parseFloat(row[targetKmIdx]) || 0 : 0;
      const actualKm = actualKmIdx >= 0 ? parseFloat(row[actualKmIdx]) || 0 : 0;
      const targetFuel = targetFuelIdx >= 0 ? parseFloat(row[targetFuelIdx]) || 0 : 0;
      const actualFuel = actualFuelIdx >= 0 ? parseFloat(row[actualFuelIdx]) || 0 : 0;
      const variance = varianceIdx >= 0 ? parseFloat(row[varianceIdx]) || 0 : (actualFuel - targetFuel);
      
      await query(`
        INSERT INTO routes (id, route_date, route_name, driver1_id, vehicle_id, 
          target_km, actual_km, target_fuel_consumption, actual_fuel, variance, comments)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        id,
        dateIdx >= 0 ? row[dateIdx] : new Date().toISOString().split('T')[0],
        routeName,
        driverId,
        vehicleId,
        targetKm,
        actualKm,
        targetFuel,
        actualFuel,
        variance,
        ''
      ]);
      count++;
    } catch (e: any) {
      console.error('Routes row error:', e.message, row);
    }
  }
  
  console.log(`Imported ${count} routes`);
  return count;
}

async function importFuel(data: any[][]) {
  const headers = data[0].map((h: string) => h.toLowerCase().trim());
  console.log('Fuel headers:', headers);
  
  const getCol = (name: string) => headers.findIndex((h: string) => h.includes(name.toLowerCase()));
  
  const deptIdx = getCol('department');
  const dateIdx = getCol('date');
  const regIdx = getCol('registration');
  const cardNumIdx = getCol('card_num');
  const cardNameIdx = getCol('card_name');
  const pastIdx = getCol('past');
  const currentIdx = getCol('current');
  const qtyIdx = getCol('quantity');
  const amtIdx = getCol('amount');
  const placeIdx = getCol('place');

  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const regNum = regIdx >= 0 ? row[regIdx] : row[2];
    
    if (!regNum) continue;

    try {
      // Lookup vehicle
      const vehicleRes = await query('SELECT id FROM vehicles WHERE registration_num = $1', [String(regNum).trim()]);
      if (vehicleRes.length === 0) {
        console.log('Vehicle not found:', regNum);
        continue;
      }
      const vehicleId = vehicleRes[0].id;

      const past = pastIdx >= 0 ? parseInt(row[pastIdx]) || 0 : 0;
      const current = currentIdx >= 0 ? parseInt(row[currentIdx]) || 0 : 0;
      const qty = qtyIdx >= 0 ? parseFloat(row[qtyIdx]) || 0 : 0;
      const amt = amtIdx >= 0 ? parseFloat(row[amtIdx]) || 0 : 0;
      const kmpl = qty > 0 ? parseFloat(((current - past) / qty).toFixed(2)) : 0;
      const cpk = (current - past) > 0 ? parseFloat((amt / (current - past)).toFixed(4)) : 0;

      const id = uuidv4();
      await query(`
        INSERT INTO fuel_records 
        (id, department, fuel_date, vehicle_id, card_num, card_name, past_mileage, 
         current_mileage, quantity_liters, km_per_liter, amount, cost_per_km, place)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        id, 
        deptIdx >= 0 ? row[deptIdx] : 'Transport',
        dateIdx >= 0 ? row[dateIdx] : new Date().toISOString().split('T')[0],
        vehicleId, 
        cardNumIdx >= 0 ? row[cardNumIdx] : '',
        cardNameIdx >= 0 ? row[cardNameIdx] : 'Shell',
        past, 
        current,
        qty, 
        kmpl, 
        amt, 
        cpk, 
        placeIdx >= 0 ? row[placeIdx] : 'Nairobi'
      ]);
      count++;
    } catch (e: any) {
      console.error('Fuel row error:', e.message, row);
    }
  }
  return count;
}

async function importRepairs(data: any[][]) {
  const headers = data[0].map((h: string) => h.toLowerCase().trim());
  console.log('Repairs headers:', headers);
  
  const getCol = (name: string) => headers.findIndex((h: string) => h.includes(name.toLowerCase()));
  
  const dateIdx = getCol('date_in');
  const regIdx = getCol('registration');
  const maintIdx = getCol('maintenance');
  const descIdx = getCol('description');
  const odoIdx = getCol('odometer');
  const techIdx = getCol('technician');
  const garageIdx = getCol('garage');

  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const regNum = regIdx >= 0 ? row[regIdx] : row[1];
    
    if (!regNum) continue;

    try {
      const vehicleRes = await query('SELECT id FROM vehicles WHERE registration_num = $1', [String(regNum).trim()]);
      if (vehicleRes.length === 0) {
        console.log('Vehicle not found for repair:', regNum);
        continue;
      }
      
      const id = uuidv4();
      await query(`
        INSERT INTO repairs 
        (id, date_in, vehicle_id, preventative_maintenance, breakdown_description,
         odometer_reading, assigned_technician, garage_name, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')
      `, [
        id, 
        dateIdx >= 0 ? row[dateIdx] : new Date().toISOString().split('T')[0],
        vehicleRes[0].id, 
        maintIdx >= 0 ? row[maintIdx] : 'General Service',
        descIdx >= 0 ? row[descIdx] : '',
        odoIdx >= 0 ? parseInt(row[odoIdx]) || 0 : 0,
        techIdx >= 0 ? row[techIdx] : 'Technician',
        garageIdx >= 0 ? row[garageIdx] : 'City Garage'
      ]);
      count++;
    } catch (e: any) {
      console.error('Repair row error:', e.message, row);
    }
  }
  return count;
}

// Generate case number for accidents
const generateCaseNumber = async () => {
  const year = new Date().getFullYear();
  const result = await query(
    "SELECT COUNT(*) as count FROM accidents WHERE EXTRACT(YEAR FROM created_at) = $1",
    [year]
  );
  const count = parseInt(result[0].count) + 1;
  return `ACC-${year}-${String(count).padStart(4, '0')}`;
};

async function importAccidents(data: any[][]) {
  const headers = data[0].map((h: string) => h.toLowerCase().trim());
  console.log('Accident headers:', headers);
  
  const getCol = (name: string) => headers.findIndex((h: string) => h.includes(name.toLowerCase()));
  
  const caseIdx = getCol('case_number');
  const dateIdx = getCol('accident_date');
  const gpsIdx = getCol('gps_location');
  const regIdx = getCol('registration');
  const driverIdx = getCol('driver');
  const typeIdx = getCol('accident_type');
  const severityIdx = getCol('severity');
  const injuriesIdx = getCol('injuries');
  const policeIdx = getCol('police');
  const thirdPartyIdx = getCol('third_party');
  const weatherIdx = getCol('weather');
  const roadIdx = getCol('road');
  const descIdx = getCol('description');
  const statusIdx = getCol('status');

  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (!row[0]) continue;

    try {
      // Look up vehicle by registration
      let vehicleId = null;
      const regRef = regIdx >= 0 ? row[regIdx] : '';
      if (regRef) {
        const vehRes = await query('SELECT id FROM vehicles WHERE registration_num = $1', [regRef]);
        if (vehRes.length > 0) vehicleId = vehRes[0].id;
      }
      
      // Look up driver by staff_no
      let driverId = null;
      const driverRef = driverIdx >= 0 ? row[driverIdx] : '';
      if (driverRef) {
        const drvRes = await query('SELECT id FROM staff WHERE staff_no = $1', [driverRef]);
        if (drvRes.length > 0) driverId = drvRes[0].id;
      }

      const caseNumber = caseIdx >= 0 && row[caseIdx] 
        ? row[caseIdx] 
        : await generateCaseNumber();
      
      const id = uuidv4();
      await query(`
        INSERT INTO accidents 
        (id, case_number, accident_date, gps_location, vehicle_id, driver_id,
         accident_type, severity, injuries_reported, police_notified, 
         third_party_involved, weather_condition, road_condition, 
         incident_description, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (case_number) DO UPDATE SET
          accident_date = EXCLUDED.accident_date,
          incident_description = EXCLUDED.incident_description,
          updated_at = CURRENT_TIMESTAMP
      `, [
        id,
        caseNumber,
        dateIdx >= 0 ? row[dateIdx] : new Date().toISOString(),
        gpsIdx >= 0 ? row[gpsIdx] : null,
        vehicleId,
        driverId,
        typeIdx >= 0 ? row[typeIdx] : 'Collision',
        severityIdx >= 0 ? row[severityIdx] : 'Minor',
        injuriesIdx >= 0 ? (row[injuriesIdx] === true || row[injuriesIdx] === 'true') : false,
        policeIdx >= 0 ? (row[policeIdx] === true || row[policeIdx] === 'true') : false,
        thirdPartyIdx >= 0 ? (row[thirdPartyIdx] === true || row[thirdPartyIdx] === 'true') : false,
        weatherIdx >= 0 ? row[weatherIdx] : 'Clear',
        roadIdx >= 0 ? row[roadIdx] : 'Dry',
        descIdx >= 0 ? row[descIdx] : '',
        statusIdx >= 0 ? row[statusIdx] : 'Reported'
      ]);
      count++;
    } catch (e: any) {
      console.error('Accident row error:', e.message, row);
    }
  }
  
  console.log(`Imported ${count} accidents`);
  return count;
}

async function importRequisitions(data: any[][]) {
  const headers = data[0].map((h: string) => h.toLowerCase().trim());
  console.log('Requisition headers:', headers);
  
  const getCol = (name: string) => headers.findIndex((h: string) => h.includes(name.toLowerCase()));
  
  const requesterIdx = getCol('requested_by');
  const originIdx = getCol('departure');
  const destIdx = getCol('destination');
  const purposeIdx = getCol('purpose');
  const travelDateIdx = getCol('travel_date');
  const travelTimeIdx = getCol('travel_time');
  const returnDateIdx = getCol('return_date');
  const returnTimeIdx = getCol('return_time');
  const passengersIdx = getCol('passengers');
  const namesIdx = getCol('passenger_names');
  const statusIdx = getCol('status');

  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (!row[0]) continue;

    try {
      // Look up requester by staff_no
      let requesterId = null;
      const reqRef = requesterIdx >= 0 ? row[requesterIdx] : '';
      if (reqRef) {
        const reqRes = await query('SELECT id FROM staff WHERE staff_no = $1', [reqRef]);
        if (reqRes.length > 0) requesterId = reqRes[0].id;
      }

      const id = uuidv4();
      const reqNumber = `REQ-${new Date().getFullYear()}-${String(i).padStart(4, '0')}`;
      
      await query(`
        INSERT INTO requisitions 
        (id, request_no, requested_by, department_id, purpose,
         place_of_departure, destination, travel_date, travel_time,
         return_date, return_time, num_passengers, passenger_names, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        id,
        reqNumber,
        requesterId,
        null, // department_id - can be looked up from staff
        purposeIdx >= 0 ? row[purposeIdx] : '',
        originIdx >= 0 ? row[originIdx] : '',
        destIdx >= 0 ? row[destIdx] : '',
        travelDateIdx >= 0 ? row[travelDateIdx] : new Date().toISOString().split('T')[0],
        travelTimeIdx >= 0 ? row[travelTimeIdx] : '09:00',
        returnDateIdx >= 0 ? row[returnDateIdx] : new Date().toISOString().split('T')[0],
        returnTimeIdx >= 0 ? row[returnTimeIdx] : '17:00',
        passengersIdx >= 0 ? parseInt(row[passengersIdx]) || 1 : 1,
        namesIdx >= 0 ? row[namesIdx] : '',
        statusIdx >= 0 ? row[statusIdx] : 'Draft'
      ]);
      count++;
    } catch (e: any) {
      console.error('Requisition row error:', e.message, row);
    }
  }
  
  console.log(`Imported ${count} requisitions`);
  return count;
}

export default router;
