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

      switch (sheetName) {
        case 'Fleet':
          results.fleet = await importFleet(data);
          break;
        case 'Staff':
          results.staff = await importStaff(data);
          break;
        case 'Routes':
          results.routes = await importRoutes(data);
          break;
        case 'TOTAL FUEL TEMPLATE':
          results.fuel = await importFuel(data);
          break;
        case 'Repairs Template':
          results.repairs = await importRepairs(data);
          break;
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

async function importFleet(data: any[][]) {
  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // Skip empty rows

    try {
      const id = uuidv4();
      await query(`
        INSERT OR REPLACE INTO vehicles (
          id, registration_num, year_of_manufacture, year_of_purchase,
          replacement_mileage, replacement_age, make_model, ownership,
          department, branch, minor_service_interval, medium_service_interval,
          major_service_interval, target_consumption_rate, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
      `, [
        id, row[0], parseInt(row[1]) || null, parseInt(row[2]) || null,
        parseInt(row[3]) || null, parseInt(row[4]) || null, row[5], row[6],
        row[7], row[8], parseInt(row[9]) || 5000, parseInt(row[10]) || 15000,
        parseInt(row[11]) || 30000, parseFloat(row[12]) || 8.0
      ]);
      count++;
    } catch (e) {
      console.error('Fleet row error:', e);
    }
  }
  return count;
}

async function importStaff(data: any[][]) {
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue;

    try {
      const id = uuidv4();
      await query(`
        INSERT OR IGNORE INTO staff (id, staff_no, staff_name, designation, department, branch, role, comments)
        VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 'Driver'), ?)
      `, [id, row[1], row[2], row[3], row[4], row[5], row[3], row[6]]);
      count++;
    } catch (e) {
      console.error('Staff row error:', e);
    }
  }
  return count;
}

async function importRoutes(data: any[][]) {
  let count = 0;
  // Routes require vehicle/driver lookups - simplified for now
  return count;
}

async function importFuel(data: any[][]) {
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[2]) continue; // No vehicle reg

    try {
      // Lookup vehicle
      const vehicleRes = await query('SELECT id FROM vehicles WHERE registration_num = ?', [row[2]]);
      if (vehicleRes.length === 0) continue;
      const vehicleId = vehicleRes[0].id;

      const past = parseInt(row[5]) || 0;
      const current = parseInt(row[6]) || 0;
      const qty = parseFloat(row[8]) || 0;
      const amt = parseFloat(row[10]) || 0;
      const kmpl = qty > 0 ? ((current - past) / qty).toFixed(2) : 0;
      const cpk = (current - past) > 0 ? (amt / (current - past)).toFixed(4) : 0;

      const id = uuidv4();
      await query(`
        INSERT INTO fuel_records 
        (id, department, fuel_date, vehicle_id, card_num, card_name, past_mileage, 
         current_mileage, distance_km, quantity_liters, km_per_liter, amount, cost_per_km, place)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, row[0], row[1], vehicleId, row[3], row[4], past, current, 
        current - past, qty, kmpl, amt, cpk, row[13]
      ]);
      count++;
    } catch (e) {
      console.error('Fuel row error:', e);
    }
  }
  return count;
}

async function importRepairs(data: any[][]) {
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue;

    try {
      const vehicleRes = await query('SELECT id FROM vehicles WHERE registration_num = ?', [row[1]]);
      if (vehicleRes.length === 0) continue;
      
      const id = uuidv4();
      await query(`
        INSERT INTO repairs 
        (id, date_in, vehicle_id, preventative_maintenance, breakdown_description,
         odometer_reading, assigned_technician, garage_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
      `, [
        id, row[0], vehicleRes[0].id, row[2], row[3], parseInt(row[4]) || 0, row[6], row[13]
      ]);
      count++;
    } catch (e) {
      console.error('Repair row error:', e);
    }
  }
  return count;
}

export default router;