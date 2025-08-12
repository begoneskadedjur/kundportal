-- Migration: Fix traffic_light_overview view for multisite support
-- Purpose: Correct the traffic light view to show proper multisite assessment data
-- Date: 2025-01-13

-- Drop the existing incorrect view
DROP VIEW IF EXISTS traffic_light_overview;

-- Create the correct traffic light overview view
CREATE OR REPLACE VIEW traffic_light_overview AS
SELECT 
    c.id as case_id,
    c.case_number,
    c.title,
    c.customer_id,
    cust.company_name as customer_name,
    c.site_id,
    s.site_name,
    s.region,
    c.pest_level,
    c.problem_rating,
    c.assessment_date,
    c.assessed_by,
    c.pest_level_trend,
    CASE 
        WHEN c.pest_level IS NULL OR c.problem_rating IS NULL THEN 'gray'
        WHEN c.pest_level >= 3 OR c.problem_rating >= 4 THEN 'red'
        WHEN c.pest_level = 2 OR c.problem_rating = 3 THEN 'yellow'
        ELSE 'green'
    END as traffic_light_color,
    c.created_at,
    c.updated_at
FROM cases c
LEFT JOIN customers cust ON c.customer_id = cust.id
LEFT JOIN organization_sites s ON c.site_id = s.id
WHERE c.customer_id IS NOT NULL; -- Only contract customers

-- Grant permissions
GRANT SELECT ON traffic_light_overview TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW traffic_light_overview IS 'Overview of traffic light assessment status for all contract customer cases with multisite support';