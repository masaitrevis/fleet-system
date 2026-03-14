import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all vehicles
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT v.*, 
        COALESCE((SELECT staff_name FROM staff WHERE id = v.id), 'Unassigned') as assigned_driver
      FROM vehicles v
      ORDER BY v.created_at DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// Get single vehicle
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    if (result.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// Create vehicle (Admin/Manager only)
router.post('/', requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const {
    registration_num, year_of_manufacture, year_of_purchase,
    replacement_mileage, replacement_age, make_model, ownership,
    department, branch, minor_service_interval, medium_service_interval,
    major_service_interval, target_consumption_rate, status, current_mileage
  } = req.body;

  try {
    const id = uuidv4();
    await query(`
      INSERT INTO vehicles (
        id, registration_num, year_of_manufacture, year_of_purchase,
        replacement_mileage, replacement_age, make_model, ownership,
        department, branch, minor_service_interval, medium_service_interval,
        major_service_interval, target_consumption_rate, status, current_mileage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, registration_num, year_of_manufacture, year_of_purchase,
      replacement_mileage, replacement_age, make_model, ownership,
      department, branch, minor_service_interval, medium_service_interval,
      major_service_interval, target_consumption_rate, status || 'Active', current_mileage || 0
    ]);
    
    const result = await query('SELECT * FROM vehicles WHERE id = ?', [id]);
    
    // Emit real-time update
    const io = req.app.locals.io;
    io.emit('vehicle:created', result[0]);
    
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

// Update vehicle
router.put('/:id', requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  try {
    // Build dynamic query with proper PostgreSQL parameters
    const allowedFields = ['registration_num', 'year_of_manufacture', 'year_of_purchase', 'replacement_mileage', 'replacement_age', 'make_model', 'ownership', 'department', 'branch', 'minor_service_interval', 'medium_service_interval', 'major_service_interval', 'target_consumption_rate', 'status', 'current_mileage'];
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(id);
    
    await query(`
      UPDATE vehicles SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
    `, values);
    
    const result = await query('SELECT * FROM vehicles WHERE id = $1', [id]);
    if (result.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Emit real-time update
    const io = req.app.locals.io;
    io.emit('vehicle:updated', result[0]);
    
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// Delete vehicle (Admin only)
router.delete('/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    await query('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    
    // Emit real-time update
    const io = req.app.locals.io;
    io.emit('vehicle:deleted', { id: req.params.id });
    
    res.json({ message: 'Vehicle deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

export default router;