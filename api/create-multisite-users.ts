// api/create-multisite-users.ts - Skapa multisite-användare
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

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

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('=== CREATE MULTISITE USERS API START ===')
    
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
        
        // Create auth user
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

        const userId = authUser.user.id
        console.log(`Created auth user ${userData.email} with ID: ${userId}`)

        // Find role assignment for this user
        const roleAssignment = roleAssignments?.find(r => r.userId === userData.id)
        
        if (!roleAssignment) {
          console.warn(`No role assignment found for user ${userData.email}`)
          continue
        }

        // Create profile
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
          // Try to clean up auth user
          await supabaseAdmin.auth.admin.deleteUser(userId)
          results.errors.push({
            email: userData.email,
            error: profileError.message
          })
          continue
        }

        // Create multisite role
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
      success: true,
      message: `Created ${results.success.length} users successfully`,
      results
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