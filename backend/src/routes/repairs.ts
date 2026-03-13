import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all repairs
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, v.registration_num, s.staff_name as driver_name
      FROM repairs r
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      LEFT JOIN staff s ON s.id = r.driver_id
      ORDER BY r.date_in DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repairs' });
  }
});

// Create repair record
router.post('/', async (req, res) => {
  const {
    date_in, vehicle_id, preventative_maintenance, breakdown_description,
    odometer_reading, driver_id, assigned_technician, repairs_start_time,
    target_repair_hours, garage_name, cost
  } = req.body;

  try {
    const id = uuidv4();
    await query(`
      INSERT INTO repairs (
        id, date_in, vehicle_id, preventative_maintenance, breakdown_description,
        odometer_reading, driver_id, assigned_technician, repairs_start_time,
        target_repair_hours, garage_name, cost, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'In Progress')
    `, [
      id, date_in, vehicle_id, preventative_maintenance, breakdown_description,
      odometer_reading, driver_id, assigned_technician, repairs_start_time,
      target_repair_hours, garage_name, cost
    ]);

    // Update vehicle status
    await query(`
      UPDATE vehicles SET status = 'Under Maintenance', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [vehicle_id]);

    const result = await query('SELECT * FROM repairs WHERE id = ?', [id]);
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create repair record' });
  }
});

// Complete repair
router.put('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { date_out, repairs_end_time, actual_repair_hours } = req.body;

  try {
    // Get target hours and vehicle_id
    const repairData = await query('SELECT target_repair_hours, vehicle_id FROM repairs WHERE id = ?', [id]);
    const target = repairData[0]?.target_repair_hours;
    const vehicleId = repairData[0]?.vehicle_id;
    
    // Calculate productivity
    const productivity = target && actual_repair_hours > 0 ? (target / actual_repair_hours).toFixed(2) : null;

    await query(`
      UPDATE repairs 
      SET date_out = ?, repairs_end_time = ?, actual_repair_hours = ?,
          productivity_ratio = ?, status = 'Completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [date_out, repairs_end_time, actual_repair_hours, productivity, id]);

    // Update vehicle status back to Active
    await query(`
      UPDATE vehicles SET status = 'Active', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [vehicleId]);

    const result = await query('SELECT * FROM repairs WHERE id = ?', [id]);
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete repair' });
  }
});

export default router;