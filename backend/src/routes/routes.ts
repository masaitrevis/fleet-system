import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get my routes (for drivers)
router.get('/my-routes', authenticateToken, async (req: any, res) => {
  try {
    const staffId = req.user?.staffId;
    
    if (!staffId) {
      return res.json([]);
    }
    
    const result = await query(`
      SELECT r.*, 
        v.registration_num,
        d1.staff_name as driver1_name,
        d2.staff_name as driver2_name
      FROM routes r
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      LEFT JOIN staff d1 ON d1.id = r.driver1_id
      LEFT JOIN staff d2 ON d2.id = r.driver2_id
      WHERE r.driver1_id = $1 OR r.driver2_id = $1 OR r.co_driver_id = $1
      ORDER BY r.route_date DESC
    `, [staffId]);
    
    res.json(result);
  } catch (error: any) {
    console.error('My routes error:', error);
    res.status(500).json({ error: 'Failed to fetch my routes', details: error.message });
  }
});

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
  } catch (error: any) {
    console.error('Routes GET error:', error);
    res.status(500).json({ error: 'Failed to fetch routes', details: error.message });
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
    const calcRate = actual_km && actual_fuel ? parseFloat((actual_km / actual_fuel).toFixed(2)) : (actual_consumption_rate || 0);
    const calcVariance = target_fuel_consumption && actual_fuel ? parseFloat((actual_fuel - target_fuel_consumption).toFixed(2)) : (variance || 0);

    const id = uuidv4();
    await query(`
      INSERT INTO routes (
        id, route_date, route_name, driver1_id, driver2_id, co_driver_id,
        vehicle_id, target_km, actual_km, target_fuel_consumption, actual_fuel,
        target_consumption_rate, actual_consumption_rate, variance, comments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      id, route_date, route_name, driver1_id || null, driver2_id || null, co_driver_id || null,
      vehicle_id || null, target_km || 0, actual_km || 0, target_fuel_consumption || 0, actual_fuel || 0,
      target_consumption_rate || 0, calcRate, calcVariance, comments || ''
    ]);

    // Update vehicle mileage
    if (actual_km && vehicle_id) {
      await query(`
        UPDATE vehicles 
        SET current_mileage = current_mileage + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [actual_km, vehicle_id]);
    }

    const result = await query('SELECT * FROM routes WHERE id = $1', [id]);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Routes POST error:', error);
    res.status(500).json({ error: 'Failed to create route', details: error.message });
  }
});

// Delete route
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM routes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Route deleted' });
  } catch (error: any) {
    console.error('Routes DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete route', details: error.message });
  }
});

export default router;
