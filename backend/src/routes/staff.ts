import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all staff
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM staff ORDER BY created_at DESC');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Get drivers only
router.get('/drivers', async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM staff WHERE role = 'Driver' OR designation LIKE '%driver%' ORDER BY staff_name"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// Create staff
router.post('/', async (req, res) => {
  const { staff_no, staff_name, email, phone, designation, department, branch, role, comments } = req.body;
  
  try {
    const id = uuidv4();
    await query(`
      INSERT INTO staff (id, staff_no, staff_name, email, phone, designation, department, branch, role, comments)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [id, staff_no, staff_name, email, phone, designation, department, branch, role, comments]);
    
    const result = await query('SELECT * FROM staff WHERE id = $1', [id]);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Failed to create staff', details: error.message });
  }
});

// Update staff
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  try {
    // Build dynamic query with proper PostgreSQL parameters
    const allowedFields = ['staff_no', 'staff_name', 'email', 'phone', 'designation', 'department', 'branch', 'role', 'comments'];
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
      UPDATE staff SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
    `, values);
    
    const result = await query('SELECT * FROM staff WHERE id = $1', [id]);
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

// Delete staff
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM staff WHERE id = $1', [req.params.id]);
    res.json({ message: 'Staff deleted' });
  } catch (error: any) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Failed to delete staff', details: error.message });
  }
});

export default router;