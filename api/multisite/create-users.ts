import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service client med admin-rättigheter för att skapa användare
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify user has valid session and proper permissions
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]
  
  // Verify the token with Supabase
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  // Check if user has admin or koordinator permissions
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, is_koordinator')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Unable to verify user permissions' })
  }

  // Verify user has admin or koordinator role
  if (profile.role !== 'admin' && !profile.is_koordinator) {
    return res.status(403).json({ error: 'Insufficient permissions. Only admin and koordinator roles can create multisite users.' })
  }

  const { organizationId, users, roleAssignments } = req.body

  if (!organizationId || !users || !roleAssignments) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const results = []

    // 1. Skapa användarkonton för varje användare
    for (const user of users) {
      try {
        // Generera ett tillfälligt lösenord
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
        
        // Skapa användaren i Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true, // Auto-bekräfta e-post
          user_metadata: {
            full_name: user.name,
            phone: user.phone,
            created_via: 'multisite_registration',
            organization_id: organizationId
          }
        })

        if (authError) {
          console.error(`Failed to create auth user for ${user.email}:`, authError)
          results.push({
            email: user.email,
            success: false,
            error: authError.message,
            step: 'auth_creation'
          })
          continue
        }

        // 2. Skapa profil i profiles-tabellen
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            email: user.email,
            display_name: user.name,
            role: 'customer', // Default till customer för multisite-användare
            created_at: new Date().toISOString()
          })

        if (profileError) {
          console.error(`Failed to create profile for ${user.email}:`, profileError)
          results.push({
            email: user.email,
            success: false,
            error: profileError.message,
            step: 'profile_creation'
          })
          continue
        }

        // 3. Hitta och skapa multisite-roll för denna användare
        const userAssignment = roleAssignments.find((assignment: any) => assignment.userId === user.id)
        if (userAssignment) {
          const { error: roleError } = await supabaseAdmin
            .from('multisite_user_roles')
            .insert({
              user_id: authData.user.id,
              organization_id: organizationId,
              role_type: userAssignment.role,
              site_ids: userAssignment.siteIds || null,
              sites: userAssignment.sites || null,
              is_active: true,
              created_at: new Date().toISOString()
            })

          if (roleError) {
            console.error(`Failed to create role for ${user.email}:`, roleError)
            results.push({
              email: user.email,
              success: false,
              error: roleError.message,
              step: 'role_creation'
            })
            continue
          }
        }

        // 4. Skicka inbjudan via e-post (återställning av lösenord)
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          user.email,
          {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password?type=invite`,
            data: {
              full_name: user.name,
              organization_id: organizationId,
              role: userAssignment?.role
            }
          }
        )

        if (inviteError) {
          console.error(`Failed to send invite to ${user.email}:`, inviteError)
          // Vi loggar detta men räknar det inte som ett totalt fel
        }

        results.push({
          email: user.email,
          success: true,
          userId: authData.user.id,
          role: userAssignment?.role
        })

      } catch (error) {
        console.error(`Unexpected error creating user ${user.email}:`, error)
        results.push({
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          step: 'unexpected_error'
        })
      }
    }

    // Sammanställ resultaten
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    res.status(200).json({
      success: failureCount === 0,
      message: `${successCount} användare skapade framgångsrikt, ${failureCount} misslyckades`,
      results,
      summary: {
        total: users.length,
        successful: successCount,
        failed: failureCount
      }
    })

  } catch (error) {
    console.error('Error in create-users API:', error)
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}