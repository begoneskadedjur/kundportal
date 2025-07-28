-- Migration: Replace "Bokad" status with "Bokat" across all case tables
-- Run these commands in your Supabase SQL editor

-- Update private_cases table
UPDATE private_cases 
SET status = 'Bokat' 
WHERE status = 'Bokad';

-- Update business_cases table  
UPDATE business_cases 
SET status = 'Bokat' 
WHERE status = 'Bokad';

-- Update legacy cases table
UPDATE cases 
SET status = 'Bokat' 
WHERE status = 'Bokad';

-- Verify the migration (optional - check counts)
-- SELECT status, COUNT(*) FROM private_cases GROUP BY status ORDER BY status;
-- SELECT status, COUNT(*) FROM business_cases GROUP BY status ORDER BY status;
-- SELECT status, COUNT(*) FROM cases GROUP BY status ORDER BY status;