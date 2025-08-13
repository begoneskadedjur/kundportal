-- Create multisite user invitations table for tracking invitation status
CREATE TABLE IF NOT EXISTS multisite_user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES multisite_organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('verksamhetschef', 'regionchef', 'platsansvarig')) NOT NULL,
    invited_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(organization_id, email)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_multisite_invitations_org_id ON multisite_user_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_multisite_invitations_user_id ON multisite_user_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_multisite_invitations_email ON multisite_user_invitations(email);

-- Update multisite_user_roles to use correct role names
UPDATE multisite_user_roles 
SET role_type = 'verksamhetschef' 
WHERE role_type = 'quality_manager';

UPDATE multisite_user_roles 
SET role_type = 'regionchef' 
WHERE role_type = 'regional_manager';

UPDATE multisite_user_roles 
SET role_type = 'platsansvarig' 
WHERE role_type = 'site_manager';

-- Drop and recreate the check constraint with correct values
ALTER TABLE multisite_user_roles 
DROP CONSTRAINT IF EXISTS multisite_user_roles_role_type_check;

ALTER TABLE multisite_user_roles 
ADD CONSTRAINT multisite_user_roles_role_type_check 
CHECK (role_type IN ('verksamhetschef', 'regionchef', 'platsansvarig'));

-- Also update profiles table
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_multisite_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_multisite_role_check 
CHECK (multisite_role IN ('verksamhetschef', 'regionchef', 'platsansvarig'));

-- Add site_manager_email column to organization_sites if it doesn't exist
ALTER TABLE organization_sites 
ADD COLUMN IF NOT EXISTS site_manager_email TEXT;