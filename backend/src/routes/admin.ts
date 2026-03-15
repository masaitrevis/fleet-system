import { Router } from 'express';
import { query } from '../database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all users (admin only)
router.get('/users', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    console.log('Admin users request from:', req.user?.email, 'with role:', req.user?.role);
    const users = await query(`
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.created_at,
        s.staff_name,
        s.role as staff_role
      FROM users u
      LEFT JOIN staff s ON u.email = s.email
      ORDER BY u.created_at DESC
    `);
    console.log('Found users:', users.length);
    res.json(users);
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Run migration to add email and phone columns
router.post('/migrate-staff-contact', async (req, res) => {
  try {
    // Add email column if not exists
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'staff' AND column_name = 'email'
        ) THEN
          ALTER TABLE staff ADD COLUMN email VARCHAR(255);
        END IF;
      END $$;
    `);

    // Add phone column if not exists
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'staff' AND column_name = 'phone'
        ) THEN
          ALTER TABLE staff ADD COLUMN phone VARCHAR(50);
        END IF;
      END $$;
    `);

    // Update all staff with owner's contact info
    await query(`
      UPDATE staff 
      SET email = 'masatrevis@gmail.com',
          phone = '0740125664'
      WHERE email IS NULL OR email = '';
    `);

    // Also update for good measure
    await query(`
      UPDATE staff 
      SET email = 'masatrevis@gmail.com',
          phone = '0740125664';
    `);

    const result = await query('SELECT id, staff_no, staff_name, email, phone FROM staff');
    
    res.json({ 
      message: 'Migration complete',
      staff_updated: result.length,
      staff: result
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed', details: String(error) });
  }
});

// Get all staff with contact info
router.get('/staff-contact', async (req, res) => {
  try {
    const result = await query('SELECT id, staff_no, staff_name, email, phone FROM staff');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

export default router;
