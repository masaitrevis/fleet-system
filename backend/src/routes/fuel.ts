import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all fuel records
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT f.*, v.registration_num
      FROM fuel_records f
      LEFT JOIN vehicles v ON v.id = f.vehicle_id
      ORDER BY f.fuel_date DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fuel records' });
  }
});

// Create fuel record
router.post('/', async (req, res) => {
  const {
    department, fuel_date, vehicle_id, card_num, card_name,
    past_mileage, current_mileage, quantity_liters, amount, place
  } = req.body;

  try {
    // Calculate efficiency
    const distance = current_mileage - past_mileage;
    const km_per_liter = distance > 0 && quantity_liters > 0 ? (distance / quantity_liters).toFixed(2) : 0;
    const cost_per_km = distance > 0 && amount > 0 ? (amount / distance).toFixed(4) : 0;

    const id = uuidv4();
    await query(`
      INSERT INTO fuel_records 
      (id, department, fuel_date, vehicle_id, card_num, card_name, past_mileage, 
       current_mileage, distance_km, quantity_liters, km_per_liter, amount, cost_per_km, place)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, department, fuel_date, vehicle_id, card_num, card_name, past_mileage, current_mileage, 
      distance, quantity_liters, km_per_liter, amount, cost_per_km, place
    ]);

    // Update vehicle current mileage
    await query(`
      UPDATE vehicles 
      SET current_mileage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [current_mileage, vehicle_id]);

    const result = await query('SELECT * FROM fuel_records WHERE id = ?', [id]);
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create fuel record' });
  }
});

export default router;