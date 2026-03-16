#!/usr/bin/env node
/**
 * Direct database seed script for admin user
 * Run with: node scripts/seed-admin.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function seedAdmin() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database');
    
    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️ Users table does not exist, creating...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'viewer',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP,
          deleted_by UUID REFERENCES users(id)
        )
      `);
      console.log('✅ Users table created');
    }
    
    // Check for admin user
    const adminCheck = await client.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      ['admin@fleet.local']
    );
    
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    
    if (adminCheck.rows.length === 0) {
      // Create admin user
      await client.query(
        'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [uuidv4(), 'admin@fleet.local', hashedPassword, 'admin']
      );
      console.log('✅ Admin user created: admin@fleet.local / admin123');
    } else {
      const user = adminCheck.rows[0];
      console.log('📝 Admin user exists:', { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        passwordHashLength: user.password_hash?.length 
      });
      
      // Reset password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
        [hashedPassword, 'admin@fleet.local']
      );
      console.log('✅ Admin password reset to: admin123');
    }
    
    // Verify the password works
    const verify = await client.query(
      'SELECT password_hash FROM users WHERE email = $1',
      ['admin@fleet.local']
    );
    
    if (verify.rows.length > 0) {
      const testValid = bcrypt.compareSync('admin123', verify.rows[0].password_hash);
      console.log('🔐 Password verification test:', testValid ? '✅ PASS' : '❌ FAIL');
    }
    
    console.log('\n📋 Login Credentials:');
    console.log('   Email: admin@fleet.local');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin();
