-- Migration: Add email and phone columns to staff table
-- Update existing staff with owner's contact info

-- Add email column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'email'
    ) THEN
        ALTER TABLE staff ADD COLUMN email VARCHAR(255);
    END IF;
END $$;

-- Add phone column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff' AND column_name = 'phone'
    ) THEN
        ALTER TABLE staff ADD COLUMN phone VARCHAR(50);
    END IF;
END $$;

-- Update ALL existing staff with owner's contact info
UPDATE staff 
SET email = 'masatrevis@gmail.com',
    phone = '0740125664'
WHERE email IS NULL OR email = '';

-- Also update for good measure
UPDATE staff 
SET email = 'masatrevis@gmail.com',
    phone = '0740125664';

-- Verify update
SELECT staff_no, staff_name, email, phone FROM staff;
