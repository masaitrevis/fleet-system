import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

let db: Database | null = null;

export const initDatabase = async () => {
  const dbPath = process.env.DB_PATH || '/root/.openclaw/workspace/fleet-system/fleet.db';
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  console.log('✅ SQLite connected:', dbPath);
  
  // Create tables
  await createTables();
  
  return db;
};

const createTables = async () => {
  if (!db) throw new Error('Database not initialized');

  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Staff table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      staff_no TEXT UNIQUE,
      staff_name TEXT NOT NULL,
      designation TEXT,
      department TEXT,
      branch TEXT,
      role TEXT DEFAULT 'Driver',
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Vehicles table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      registration_num TEXT UNIQUE NOT NULL,
      year_of_manufacture INTEGER,
      year_of_purchase INTEGER,
      replacement_mileage INTEGER,
      replacement_age INTEGER,
      make_model TEXT,
      ownership TEXT,
      department TEXT,
      branch TEXT,
      minor_service_interval INTEGER,
      medium_service_interval INTEGER,
      major_service_interval INTEGER,
      target_consumption_rate REAL,
      status TEXT DEFAULT 'Active',
      current_mileage INTEGER DEFAULT 0,
      last_service_date TEXT,
      next_service_due TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Routes table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      route_date TEXT NOT NULL,
      route_name TEXT,
      driver1_id TEXT,
      driver2_id TEXT,
      co_driver_id TEXT,
      vehicle_id TEXT,
      target_km REAL,
      actual_km REAL,
      target_fuel_consumption REAL,
      actual_fuel REAL,
      target_consumption_rate REAL,
      actual_consumption_rate REAL,
      variance REAL,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (driver1_id) REFERENCES staff(id)
    )
  `);

  // Fuel records table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_records (
      id TEXT PRIMARY KEY,
      department TEXT,
      fuel_date TEXT,
      vehicle_id TEXT,
      card_num TEXT,
      card_name TEXT,
      past_mileage INTEGER,
      current_mileage INTEGER,
      distance_km INTEGER,
      quantity_liters REAL,
      km_per_liter REAL,
      amount REAL,
      cost_per_km REAL,
      place TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Repairs table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS repairs (
      id TEXT PRIMARY KEY,
      date_in TEXT,
      vehicle_id TEXT,
      preventative_maintenance TEXT,
      breakdown_description TEXT,
      odometer_reading INTEGER,
      driver_id TEXT,
      assigned_technician TEXT,
      repairs_start_time TEXT,
      date_out TEXT,
      repairs_end_time TEXT,
      actual_repair_hours REAL,
      target_repair_hours REAL,
      productivity_ratio REAL,
      garage_name TEXT,
      cost REAL,
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Tables created');
  
  // Create default admin user
  const adminExists = await db.get('SELECT id FROM users WHERE email = ?', ['admin@fleet.local']);
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await db.run(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), 'admin@fleet.local', hashedPassword, 'admin']
    );
    console.log('✅ Default admin user created: admin@fleet.local / admin123');
  }
};

export const query = async (sql: string, params?: any[]): Promise<any> => {
  if (!db) throw new Error('Database not initialized');
  
  // Handle both SELECT and INSERT/UPDATE/DELETE
  const trimmed = sql.trim().toLowerCase();
  if (trimmed.startsWith('select')) {
    return db.all(sql, params);
  } else {
    return db.run(sql, params);
  }
};

export default db;