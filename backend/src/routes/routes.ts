import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all routes with details
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, 
        v.registration_num,
        d1.staff_name as driver1_name,
        d2.staff_name as driver2_name
      FROM routes r
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      LEFT JOIN staff d1 ON d1.id = r.driver1_id
      LEFT JOIN staff d2 ON d2.id = r.driver2_id
      ORDER BY r.route_date DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// Create route
router.post('/', async (req, res) => {
  const {
    route_date, route_name, driver1_id, driver2_id, co_driver_id,
    vehicle_id, target_km, actual_km, target_fuel_consumption, actual_fuel,
    target_consumption_rate, actual_consumption_rate, variance, comments
  } = req.body;

  try {
    // Calculate actual consumption rate if not provided
    const calcRate = actual_km && actual_fuel ? (actual_km / actual_fuel).toFixed(2) : actual_consumption_rate;
    const calcVariance = target_fuel_consumption && actual_fuel ? (actual_fuel - target_fuel_consumption).toFixed(2) : variance;

    const id = uuidv4();
    await query(`
      INSERT INTO routes (
        id, route_date, route_name, driver1_id, driver2_id, co_driver_id,
        vehicle_id, target_km, actual_km, target_fuel_consumption, actual_fuel,
        target_consumption_rate, actual_consumption_rate, variance, comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, route_date, route_name, driver1_id, driver2_id, co_driver_id,
      vehicle_id, target_km, actual_km, target_fuel_consumption, actual_fuel,
      target_consumption_rate, calcRate, calcVariance, comments
    ]);

    // Update vehicle mileage
    if (actual_km && vehicle_id) {
      await query(`
        UPDATE vehicles 
        SET current_mileage = current_mileage + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [actual_km, vehicle_id]);
    }

    const result = await query('SELECT * FROM routes WHERE id = ?', [id]);
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create route' });
  }
});

// Delete route
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM routes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Route deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

export default router;