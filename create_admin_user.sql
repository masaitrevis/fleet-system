-- Create admin user: pilot@g4s.com
-- Password: G4SPilot2024!
-- Run this in Render PostgreSQL console

-- Generate UUID for the new user
WITH new_user AS (
  INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'pilot@g4s.com',
    '$2a$10$efiw1vjkz1v5DrMjKQt0MO2X769tcmzIDPKKf1Hw6gW8r7b1JdM0.', -- bcrypt hash of 'G4SPilot2024!'
    'admin',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    password_hash = '$2a$10$efiw1vjkz1v5DrMjKQt0MO2X769tcmzIDPKKf1Hw6gW8r7b1JdM0.',
    updated_at = CURRENT_TIMESTAMP
  RETURNING id, email, role
)
SELECT 
  'User created/updated successfully:' as message,
  id,
  email,
  role
FROM new_user;

-- Verify user exists
SELECT id, email, role, created_at 
FROM users 
WHERE email = 'pilot@g4s.com';
