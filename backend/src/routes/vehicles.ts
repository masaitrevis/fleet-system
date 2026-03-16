import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all vehicles (excluding soft-deleted)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT v.* 
      FROM vehicles v
      WHERE v.deleted_at IS NULL
      ORDER BY v.created_at DESC
    `);
    res.json(result);
  } catch (error: any) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles', details: error.message });
  }
});

// Get single vehicle
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM vehicles WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(result[0]);
  } catch (error: any) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: error.message });
  }
});

// Create vehicle (Admin/Manager only)
router.post('/', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const {
    registration_num, year_of_manufacture, year_of_purchase,
    replacement_mileage, replacement_age, make_model, ownership,
    department, branch, minor_service_interval, medium_service_interval,
    major_service_interval, target_consumption_rate, status, current_mileage
  } = req.body;

  // Validation
  if (!registration_num) {
    return res.status(400).json({ error: 'Registration number is required' });
  }

  try {
    const id = uuidv4();
    await query(`
      INSERT INTO vehicles (
        id, registration_num, year_of_manufacture, year_of_purchase,
        replacement_mileage, replacement_age, make_model, ownership,
        department, branch, minor_service_interval, medium_service_interval,
        major_service_interval, target_consumption_rate, status, current_mileage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [
      id, registration_num, year_of_manufacture, year_of_purchase,
      replacement_mileage, replacement_age, make_model, ownership,
      department, branch, minor_service_interval, medium_service_interval,
      major_service_interval, target_consumption_rate, status || 'Active', current_mileage || 0
    ]);
    
    const result = await query('SELECT * FROM vehicles WHERE id = $1', [id]);
    
    if (!result || result.length === 0) {
      return res.status(500).json({ error: 'Vehicle created but could not be retrieved' });
    }
    
    // Emit real-time update
    const io = req.app.locals.io;
    if (io) {
      io.emit('vehicle:created', result[0]);
    }
    
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create vehicle error:', error);
    if (error.message?.includes('duplicate key') || error.message?.includes('UNIQUE')) {
      res.status(400).json({ error: 'Registration number already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create vehicle', details: error.message });
    }
  }
});

// Update vehicle
router.put('/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  try {
    // Build dynamic query with proper PostgreSQL parameters
    const allowedFields = ['registration_num', 'year_of_manufacture', 'year_of_purchase', 'replacement_mileage', 'replacement_age', 'make_model', 'ownership', 'department', 'branch', 'minor_service_interval', 'medium_service_interval', 'major_service_interval', 'target_consumption_rate', 'status', 'current_mileage', 'next_service_due', 'last_service_date'];
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
      WHERE id = $${paramIndex} AND deleted_at IS NULL
    `, values);
    
    const result = await query('SELECT * FROM vehicles WHERE id = $1', [id]);
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Emit real-time update
    const io = req.app.locals.io;
    if (io) {
      io.emit('vehicle:updated', result[0]);
    }
    
    res.json(result[0]);
  } catch (error: any) {
    console.error('Update vehicle error:', error);
    if (error.message?.includes('duplicate key') || error.message?.includes('UNIQUE')) {
      res.status(400).json({ error: 'Registration number already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update vehicle', details: error.message });
    }
  }
});

// Soft delete vehicle (Admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    // Soft delete - set deleted_at timestamp
    const result = await query(
      'UPDATE vehicles SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING *',
      [req.user?.userId, req.params.id]
    );
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or already deleted' });
    }
    
    // Emit real-time update
    const io = req.app.locals.io;
    if (io) {
      io.emit('vehicle:deleted', { id: req.params.id, soft: true });
    }
    
    res.json({ message: 'Vehicle deleted (soft)', vehicle: result[0] });
  } catch (error: any) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Failed to delete vehicle', details: error.message });
  }
});

// Get deleted vehicles (Admin only)
router.get('/deleted/list', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT v.*, u.email as deleted_by_email
      FROM vehicles v
      LEFT JOIN users u ON v.deleted_by = u.id
      WHERE v.deleted_at IS NOT NULL
      ORDER BY v.deleted_at DESC
    `);
    res.json(result);
  } catch (error: any) {
    console.error('Get deleted vehicles error:', error);
    res.status(500).json({ error: 'Failed to fetch deleted vehicles', details: error.message });
  }
});

// Restore soft-deleted vehicle (Admin only)
router.post('/:id/restore', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'UPDATE vehicles SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [req.params.id]
    );
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or not deleted' });
    }
    
    // Emit real-time update
    const io = req.app.locals.io;
    if (io) {
      io.emit('vehicle:restored', result[0]);
    }
    
    res.json({ message: 'Vehicle restored', vehicle: result[0] });
  } catch (error: any) {
    console.error('Restore vehicle error:', error);
    res.status(500).json({ error: 'Failed to restore vehicle', details: error.message });
  }
});

export default router;
