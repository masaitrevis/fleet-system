import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fleet-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// Register
router.post('/register', async (req, res) => {
  const { 
    email, 
    password, 
    role = 'viewer',
    staffName,
    staffNo,
    department,
    branch,
    phone
  } = req.body;
  
  // Determine if this is a job role (Driver, Transport, etc.) or login role
  const jobRoles = ['Driver', 'Transport Supervisor', 'Departmental Supervisor', 'Head of Department', 'Security Personnel'];
  const isJobRole = jobRoles.includes(role);
  
  // Map job role to appropriate login role
  const loginRole = isJobRole ? 'viewer' : role;
  
  try {
    const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);
    const userId = uuidv4();
    
    // Create user record
    await query(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [userId, email, hashedPassword, loginRole]
    );
    
    // If job role selected, also create staff record
    if (isJobRole && staffName) {
      const staffId = uuidv4();
      await query(
        `INSERT INTO staff (id, staff_no, staff_name, email, phone, department, branch, role) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [staffId, staffNo || null, staffName, email, phone || null, department || null, branch || null, role]
      );
    }
    
    res.status(201).json({ 
      message: 'User created successfully',
      role: isJobRole ? role : loginRole,
      isJobRole
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Email or staff number already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is linked to staff record
    const staffLink = await query(
      'SELECT s.id as staff_id, s.role as staff_role, s.department, s.branch, s.staff_name FROM staff s WHERE s.email = ?',
      [email]
    );
    
    const staffInfo = staffLink.length > 0 ? staffLink[0] : null;
    
    // Use staff role if available, otherwise use user role
    const effectiveRole = staffInfo?.staff_role || user.role;
    
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        staffRole: staffInfo?.staff_role || null,
        staffId: staffInfo?.staff_id || null,
        department: staffInfo?.department || null,
        branch: staffInfo?.branch || null
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        staffRole: staffInfo?.staff_role || null,
        staffId: staffInfo?.staff_id || null,
        staffName: staffInfo?.staff_name || null,
        department: staffInfo?.department || null,
        branch: staffInfo?.branch || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
export { JWT_SECRET };