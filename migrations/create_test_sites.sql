-- Create test sites for organization 'b3099b45-d0a7-450a-a407-55361b50e416'
-- First, let's check if there are any existing sites
DO $$
DECLARE
    org_id UUID := 'b3099b45-d0a7-450a-a407-55361b50e416';
    site_count INTEGER;
BEGIN
    -- Count existing sites
    SELECT COUNT(*) INTO site_count 
    FROM organization_sites 
    WHERE organization_id = org_id;
    
    -- Only insert if no sites exist
    IF site_count = 0 THEN
        -- Insert test sites
        INSERT INTO organization_sites (
            organization_id,
            site_name,
            address,
            postal_code,
            city,
            region,
            contact_person,
            contact_email,
            contact_phone,
            customer_id,
            is_active,
            created_at,
            updated_at
        ) VALUES 
        (
            org_id,
            'Huvudkontoret Stockholm',
            'Kungsgatan 45',
            '11156',
            'Stockholm',
            'Stockholm',
            'Anna Andersson',
            'anna@espresso900.se',
            '08-1234567',
            NULL,
            true,
            NOW(),
            NOW()
        ),
        (
            org_id,
            'Filial Göteborg',
            'Avenyn 12',
            '41136',
            'Göteborg',
            'Väst',
            'Bengt Bengtsson',
            'bengt@espresso900.se',
            '031-9876543',
            NULL,
            true,
            NOW(),
            NOW()
        ),
        (
            org_id,
            'Filial Malmö',
            'Storgatan 8',
            '21142',
            'Malmö',
            'Syd',
            'Cecilia Carlsson',
            'cecilia@espresso900.se',
            '040-5555555',
            NULL,
            true,
            NOW(),
            NOW()
        ),
        (
            org_id,
            'Lager Uppsala',
            'Industrivägen 23',
            '75323',
            'Uppsala',
            'Stockholm',
            'David Davidsson',
            'david@espresso900.se',
            '018-444444',
            NULL,
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created 4 test sites for organization';
    ELSE
        RAISE NOTICE 'Sites already exist for organization (count: %)', site_count;
    END IF;
END $$;

-- Verify the sites were created
SELECT 
    id,
    site_name,
    region,
    city,
    is_active
FROM organization_sites
WHERE organization_id = 'b3099b45-d0a7-450a-a407-55361b50e416'
ORDER BY region, site_name;