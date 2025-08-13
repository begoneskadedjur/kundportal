// api/create-multisite-users.ts - Skapa multisite-användare
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Environment variables - Vercel uses different naming
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing required environment variables')
    return res.status(500).json({ 
      error: 'Server configuration error - missing environment variables' 
    })
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('=== CREATE MULTISITE USERS API START ===')
    console.log('Environment check:', {
      hasUrl: !!SUPABASE_URL,
      hasServiceKey: !!SUPABASE_SERVICE_KEY,
      urlPrefix: SUPABASE_URL?.substring(0, 30)
    })
    
    const { organizationId, users, roleAssignments } = req.body
    
    console.log('Request data:', {
      organizationId,
      userCount: users?.length,
      roleCount: roleAssignments?.length
    })

    // Validate required data
    if (!organizationId || !users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ 
        error: 'Organization ID and users array are required' 
      })
    }

    // Get organization name for invitation emails
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('multisite_organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    if (orgError || !orgData) {
      console.error('Failed to fetch organization:', orgError)
      return res.status(400).json({ 
        error: 'Organization not found' 
      })
    }

    const organizationName = orgData.name

    const results = {
      success: [],
      errors: []
    }

    // Create each user
    for (const userData of users) {
      try {
        console.log(`Creating user: ${userData.email}`)
        
        // Generate temporary password
        const tempPassword = generateSecurePassword()
        
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingAuthUser = existingUsers?.users?.find(u => u.email === userData.email)
        
        let userId: string
        
        if (existingAuthUser) {
          // User already exists, update their metadata instead
          console.log(`User ${userData.email} already exists, updating metadata`)
          userId = existingAuthUser.id
          
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: {
              name: userData.name,
              phone: userData.phone,
              organization_id: organizationId
            }
          })
          
          if (updateError) {
            console.error(`Failed to update existing user ${userData.email}:`, updateError)
            results.errors.push({
              email: userData.email,
              error: `Could not update existing user: ${updateError.message}`
            })
            continue
          }
        } else {
          // Create new auth user
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: userData.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              name: userData.name,
              phone: userData.phone,
              organization_id: organizationId
            }
          })

          if (authError) {
            console.error(`Failed to create auth user ${userData.email}:`, authError)
            results.errors.push({
              email: userData.email,
              error: authError.message
            })
            continue
          }
          
          userId = authUser.user.id
          console.log(`Created new auth user ${userData.email} with ID: ${userId}`)
        }

        // Find role assignment for this user
        const roleAssignment = roleAssignments?.find(r => r.userId === userData.id)
        
        if (!roleAssignment) {
          console.warn(`No role assignment found for user ${userData.email}`)
          continue
        }

        // Check if profile exists, update or create
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('user_id', userId)
          .single()

        if (existingProfile) {
          // Update existing profile
          const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({
              email: userData.email,
              email_verified: true,
              role: 'customer',
              multisite_role: roleAssignment.role,
              organization_id: organizationId,
              is_active: true
            })
            .eq('user_id', userId)

          if (profileUpdateError) {
            console.error(`Failed to update profile for ${userData.email}:`, profileUpdateError)
            results.errors.push({
              email: userData.email,
              error: `Could not update profile: ${profileUpdateError.message}`
            })
            continue
          }
          console.log(`Updated existing profile for ${userData.email}`)
        } else {
          // Create new profile
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              user_id: userId,
              email: userData.email,
              email_verified: true,
              role: 'customer',
              multisite_role: roleAssignment.role,
              organization_id: organizationId,
              is_active: true
            })

          if (profileError) {
            console.error(`Failed to create profile for ${userData.email}:`, profileError)
            // Don't delete auth user if they already existed
            if (!existingAuthUser) {
              await supabaseAdmin.auth.admin.deleteUser(userId)
            }
            results.errors.push({
              email: userData.email,
              error: profileError.message
            })
            continue
          }
          console.log(`Created new profile for ${userData.email}`)
        }

        // Check for existing role and update or create
        const { data: existingRole } = await supabaseAdmin
          .from('multisite_user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('organization_id', organizationId)
          .single()

        const roleData: any = {
          user_id: userId,
          organization_id: organizationId,
          role_type: roleAssignment.role,
          is_active: true
        }

        // Add site_ids for regionchef and platsansvarig
        if (roleAssignment.role === 'regionchef' && roleAssignment.siteIds) {
          roleData.site_ids = roleAssignment.siteIds
        } else if (roleAssignment.role === 'platsansvarig' && roleAssignment.siteIds?.length > 0) {
          roleData.site_ids = [roleAssignment.siteIds[0]] // Platsansvarig gets one site
        }

        if (existingRole) {
          // Update existing role
          const { error: roleUpdateError } = await supabaseAdmin
            .from('multisite_user_roles')
            .update(roleData)
            .eq('id', existingRole.id)

          if (roleUpdateError) {
            console.error(`Failed to update role for ${userData.email}:`, roleUpdateError)
            results.errors.push({
              email: userData.email,
              error: `Could not update role: ${roleUpdateError.message}`
            })
            continue
          }
          console.log(`Updated existing role for ${userData.email}`)
        } else {
          // Create new role
          const { error: roleError } = await supabaseAdmin
            .from('multisite_user_roles')
            .insert(roleData)

          if (roleError) {
            console.error(`Failed to create role for ${userData.email}:`, roleError)
            results.errors.push({
              email: userData.email,
              error: roleError.message
            })
            continue
          }
          console.log(`Created new role for ${userData.email}`)
        }

        // Send invitation email via separate API
        try {
          const inviteResponse = await fetch(`${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/api/send-multisite-invitation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              organizationId,
              email: userData.email,
              name: userData.name,
              role: roleAssignment.role,
              organizationName: organizationName
            })
          })

          if (!inviteResponse.ok) {
            console.error(`Failed to send invitation to ${userData.email}`)
          }
        } catch (emailError) {
          console.error(`Email error for ${userData.email}:`, emailError)
        }

        results.success.push({
          email: userData.email,
          userId,
          message: 'User created successfully'
        })

      } catch (error: any) {
        console.error(`Unexpected error for user ${userData.email}:`, error)
        results.errors.push({
          email: userData.email,
          error: error.message || 'Unexpected error'
        })
      }
    }

    console.log('=== CREATE MULTISITE USERS API COMPLETE ===')
    console.log(`Success: ${results.success.length}, Errors: ${results.errors.length}`)

    return res.status(200).json({
      success: results.success.length > 0,
      message: results.success.length > 0 
        ? `Created ${results.success.length} users successfully`
        : 'No users were created',
      summary: {
        successful: results.success.length,
        failed: results.errors.length,
        total: users.length
      },
      results: [
        ...results.success.map(s => ({ ...s, success: true })),
        ...results.errors.map(e => ({ ...e, success: false }))
      ]
    })

  } catch (error: any) {
    console.error('=== CREATE MULTISITE USERS API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Failed to create multisite users'
    })
  }
}

// Helper function to generate secure password
function generateSecurePassword(): string {
  const length = 12
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
  let password = ""
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  
  // Ensure password meets requirements
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%])/.test(password)) {
    return generateSecurePassword()
  }
  
  return password
}