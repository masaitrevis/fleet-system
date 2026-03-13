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
  const { email, password, role = 'viewer' } = req.body;
  
  try {
    const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);
    const id = uuidv4();
    
    await query(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [id, email, hashedPassword, role]
    );
    
    res.status(201).json({ message: 'User created' });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Email already exists' });
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
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
export { JWT_SECRET };