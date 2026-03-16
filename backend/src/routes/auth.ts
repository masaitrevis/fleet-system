import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// JWT_SECRET must be set in environment - no fallback for security
const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

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
  
  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // Determine if this is a job role (Driver, Transport, etc.) or login role
  const jobRoles = ['Driver', 'Transport Supervisor', 'Departmental Supervisor', 'Head of Department', 'Security Personnel'];
  const isJobRole = jobRoles.includes(role);
  
  // Map job role to appropriate login role
  const loginRole = isJobRole ? 'viewer' : role;
  
  try {
    const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);
    const userId = uuidv4();
    
    // Create user record - using PostgreSQL $1, $2 syntax
    await query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [userId, email, hashedPassword, loginRole]
    );
    
    // If job role selected, also create staff record
    if (isJobRole && staffName) {
      const staffId = uuidv4();
      await query(
        `INSERT INTO staff (id, staff_no, staff_name, email, phone, department, branch, role) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [staffId, staffNo || null, staffName, email, phone || null, department || null, branch || null, role]
      );
    }
    
    res.status(201).json({ 
      message: 'User created successfully',
      role: isJobRole ? role : loginRole,
      isJobRole
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('duplicate key')) {
      res.status(400).json({ error: 'Email or staff number already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed: ' + (error.message || 'Unknown error') });
    }
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('Login attempt:', { email, passwordLength: password?.length });
  
  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    // Using PostgreSQL $1 syntax
    const users = await query('SELECT * FROM users WHERE email = $1', [email]);
    
    console.log('Users found:', users?.length || 0);
    
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = users[0];
    console.log('User found:', { id: user.id, email: user.email, role: user.role });
    
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    
    console.log('Password valid:', validPassword);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if user is linked to staff record
    const staffLink = await query(
      'SELECT s.id as staff_id, s.role as staff_role, s.department, s.branch, s.staff_name FROM staff s WHERE s.email = $1',
      [email]
    );
    
    const staffInfo = staffLink && staffLink.length > 0 ? staffLink[0] : null;
    
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
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed: ' + (error.message || 'Unknown error') });
  }
});

// Validate token endpoint
router.get('/validate', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(403).json({ valid: false, error: 'Invalid token' });
  }
});

export default router;
export { JWT_SECRET };
