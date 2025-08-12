-- Migration: Add multisite support for contract customers
-- Purpose: Enable management of multiple sites/locations for large customers like Espresso House, Coop
-- Date: 2025-01-13

-- Create multisite organizations table
CREATE TABLE IF NOT EXISTS multisite_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization_number TEXT,
    billing_type TEXT CHECK (billing_type IN ('consolidated', 'per_site')) DEFAULT 'consolidated',
    primary_contact_email TEXT,
    primary_contact_phone TEXT,
    billing_address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create organization sites table
CREATE TABLE IF NOT EXISTS organization_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES multisite_organizations(id) ON DELETE CASCADE,
    site_name TEXT NOT NULL,
    site_code TEXT,
    address TEXT,
    region TEXT,
    contact_person TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(organization_id, site_code)
);

-- Create user roles for multisite management
CREATE TABLE IF NOT EXISTS multisite_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES multisite_organizations(id) ON DELETE CASCADE,
    role_type TEXT CHECK (role_type IN ('quality_manager', 'regional_manager', 'site_manager')) NOT NULL,
    site_ids UUID[], -- Array of site IDs for site managers
    region TEXT, -- For regional managers
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, organization_id, role_type)
);

-- Add multisite support to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES multisite_organizations(id),
ADD COLUMN IF NOT EXISTS is_multisite BOOLEAN DEFAULT false;

-- Add traffic light system to cases table (ONLY cases, not private_cases or business_cases)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS pest_level INTEGER CHECK (pest_level >= 0 AND pest_level <= 3),
ADD COLUMN IF NOT EXISTS problem_rating INTEGER CHECK (problem_rating >= 1 AND problem_rating <= 5),
ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES organization_sites(id),
ADD COLUMN IF NOT EXISTS assessment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assessed_by TEXT,
ADD COLUMN IF NOT EXISTS pest_level_trend TEXT CHECK (pest_level_trend IN ('improving', 'stable', 'worsening'));

-- Add multisite support to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES multisite_organizations(id),
ADD COLUMN IF NOT EXISTS multisite_role TEXT CHECK (multisite_role IN ('quality_manager', 'regional_manager', 'site_manager')),
ADD COLUMN IF NOT EXISTS site_access UUID[], -- Array of accessible site IDs
ADD COLUMN IF NOT EXISTS region_access TEXT; -- For regional managers

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organization_sites_org_id ON organization_sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_sites_region ON organization_sites(region);
CREATE INDEX IF NOT EXISTS idx_multisite_user_roles_user_id ON multisite_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_multisite_user_roles_org_id ON multisite_user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_site_id ON cases(site_id);
CREATE INDEX IF NOT EXISTS idx_cases_pest_level ON cases(pest_level);
CREATE INDEX IF NOT EXISTS idx_cases_problem_rating ON cases(problem_rating);
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- Create view for traffic light status overview
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

-- Row Level Security Policies

-- Enable RLS on new tables
ALTER TABLE multisite_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE multisite_user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their organization
CREATE POLICY "Users can view their organization" ON multisite_organizations
    FOR SELECT
    USING (
        id IN (
            SELECT organization_id FROM profiles WHERE user_id = auth.uid()
            UNION
            SELECT organization_id FROM multisite_user_roles WHERE user_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
    );

-- Policy: Users can see sites based on their role
CREATE POLICY "Users can view sites based on role" ON organization_sites
    FOR SELECT
    USING (
        -- Admins see all
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
        OR
        -- Quality managers see all sites in their organization
        EXISTS (
            SELECT 1 FROM multisite_user_roles 
            WHERE user_id = auth.uid() 
            AND organization_id = organization_sites.organization_id
            AND role_type = 'quality_manager'
        )
        OR
        -- Regional managers see sites in their region
        EXISTS (
            SELECT 1 FROM multisite_user_roles 
            WHERE user_id = auth.uid() 
            AND organization_id = organization_sites.organization_id
            AND role_type = 'regional_manager'
            AND region = organization_sites.region
        )
        OR
        -- Site managers see their assigned sites
        EXISTS (
            SELECT 1 FROM multisite_user_roles 
            WHERE user_id = auth.uid() 
            AND organization_id = organization_sites.organization_id
            AND role_type = 'site_manager'
            AND organization_sites.id = ANY(site_ids)
        )
    );

-- Policy: Users can view roles in their organization
CREATE POLICY "Users can view roles in their organization" ON multisite_user_roles
    FOR SELECT
    USING (
        -- Admins see all
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
        OR
        -- Users in the same organization
        organization_id IN (
            SELECT organization_id FROM multisite_user_roles WHERE user_id = auth.uid()
        )
    );

-- Policy: Only admins and quality managers can insert/update/delete
CREATE POLICY "Admin and quality managers can manage organizations" ON multisite_organizations
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
        OR
        EXISTS (
            SELECT 1 FROM multisite_user_roles 
            WHERE user_id = auth.uid() 
            AND organization_id = multisite_organizations.id
            AND role_type = 'quality_manager'
        )
    );

CREATE POLICY "Admin and quality managers can manage sites" ON organization_sites
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
        OR
        EXISTS (
            SELECT 1 FROM multisite_user_roles 
            WHERE user_id = auth.uid() 
            AND organization_id = organization_sites.organization_id
            AND role_type = 'quality_manager'
        )
    );

CREATE POLICY "Admin and quality managers can manage roles" ON multisite_user_roles
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
        OR
        EXISTS (
            SELECT 1 FROM multisite_user_roles 
            WHERE user_id = auth.uid() 
            AND organization_id = multisite_user_roles.organization_id
            AND role_type = 'quality_manager'
        )
    );

-- Grant permissions
GRANT SELECT ON traffic_light_overview TO authenticated;
GRANT ALL ON multisite_organizations TO authenticated;
GRANT ALL ON organization_sites TO authenticated;
GRANT ALL ON multisite_user_roles TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE multisite_organizations IS 'Organizations that have multiple sites/locations';
COMMENT ON TABLE organization_sites IS 'Individual sites/locations within an organization';
COMMENT ON TABLE multisite_user_roles IS 'Role-based access control for multisite organizations';
COMMENT ON COLUMN cases.pest_level IS 'Pest infestation level: 0=None, 1=Low, 2=Medium, 3=High';
COMMENT ON COLUMN cases.problem_rating IS 'Overall problem assessment: 1=Excellent, 2=Good, 3=Attention needed, 4=Serious, 5=Critical';