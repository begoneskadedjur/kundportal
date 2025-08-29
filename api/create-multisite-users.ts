// api/create-multisite-users.ts - Skapa multisite-användare
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Environment variables - Vercel uses different naming
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY

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

    // Get organization details for invitation emails
    // Nu hämtar vi från customers-tabellen där huvudkontoret finns
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('site_type', 'huvudkontor')
      .eq('is_multisite', true)
      .single()

    if (orgError || !orgData) {
      console.error('Failed to fetch organization:', orgError)
      return res.status(400).json({ 
        error: 'Organization not found' 
      })
    }

    const organizationName = orgData.company_name

    const results = {
      success: [],
      errors: []
    }

    // Check if we have Resend API key for sending emails
    const canSendEmails = !!RESEND_API_KEY

    // Create each user
    for (const userData of users) {
      try {
        console.log(`Creating user: ${userData.email}`)
        
        // Generate temporary password
        let tempPassword = generateSecurePassword()
        
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingAuthUser = existingUsers?.users?.find((u: any) => u.email === userData.email)
        
        let userId: string
        
        if (existingAuthUser) {
          // User already exists, update their metadata and password
          console.log(`User ${userData.email} already exists, updating metadata and password`)
          userId = existingAuthUser.id
          
          // Generate new password for existing user
          tempPassword = generateSecurePassword()
          
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: tempPassword,
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
              display_name: userData.name,
              phone: userData.phone,
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
              display_name: userData.name,
              phone: userData.phone,
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
        // Regionchef uses 'sites' field, platsansvarig uses 'siteIds'
        if (roleAssignment.role === 'regionchef' && roleAssignment.sites) {
          roleData.site_ids = roleAssignment.sites
        } else if (roleAssignment.role === 'platsansvarig' && roleAssignment.siteIds) {
          roleData.site_ids = roleAssignment.siteIds
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

        // Send invitation email via Resend API
        if (canSendEmails) {
          try {
            const loginLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/login`
            const isNewUser = !existingAuthUser
            
            const emailHtml = getMultisiteInvitationEmailTemplate({
              organization: orgData,
              recipientEmail: userData.email,
              recipientName: userData.name,
              role: roleAssignment.role,
              loginLink,
              isNewUser,
              tempPassword: tempPassword  // Always include password
            })

            const subject = isNewUser 
              ? `Välkommen till Begone Organisationsportal - ${organizationName}`
              : `Ny organisation tillagd - ${organizationName}`

            // Use Resend API directly
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: 'Begone Kundportal <noreply@begone.se>',
                to: [userData.email],
                subject: subject,
                html: emailHtml
              }),
            })

            if (emailResponse.ok) {
              const emailData = await emailResponse.json()
              console.log(`Invitation email sent to ${userData.email} via Resend:`, emailData.id)
            } else {
              const error = await emailResponse.text()
              console.error(`Failed to send email to ${userData.email}:`, error)
            }
          } catch (emailError) {
            console.error(`Failed to send email to ${userData.email}:`, emailError)
            // Don't fail the whole process if email fails
          }
        } else {
          console.warn('RESEND_API_KEY not configured - skipping email invitations')
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

// Email template for multisite invitations
function getMultisiteInvitationEmailTemplate({
  organization,
  recipientEmail,
  recipientName,
  role,
  loginLink,
  isNewUser,
  tempPassword
}: {
  organization: any
  recipientEmail: string
  recipientName: string
  role: string
  loginLink: string
  isNewUser: boolean
  tempPassword?: string
}) {
  const roleNames: { [key: string]: string } = {
    'verksamhetschef': 'Verksamhetschef',
    'regionchef': 'Regionchef',
    'platsansvarig': 'Platsansvarig'
  }

  const roleName = roleNames[role] || role
  // Säkerställ att vi har organisationsnamn
  const orgName = organization.company_name || organization.name || 'BeGone Organisation'

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isNewUser ? 'Välkommen till BeGone Organisationsportal' : 'Ny organisation tillagd'}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8f9fa; line-height: 1.6;">
    <!-- Container -->
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 40px 30px; text-align: center;">
            <!-- Logo/Icon utan emoji -->
            <div style="background-color: rgba(255, 255, 255, 0.15); width: 60px; height: 60px; border-radius: 50%; display: inline-block; margin-bottom: 20px; line-height: 60px;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="vertical-align: middle;">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </div>
            
            <!-- Titel -->
            <h1 style="margin: 0 0 8px; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Välkommen till BeGone
            </h1>
            <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 500;">
                Organisationsportal
            </p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
            <!-- Välkomstmeddelande -->
            <div style="margin-bottom: 32px;">
                <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 20px; font-weight: 600;">
                    Hej ${recipientName}!
                </h2>
                <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">
                    Du har blivit inbjuden att delta i BeGone Skadedjur & Sanering AB:s organisationsportal för 
                    <strong style="color: #7c3aed;">${orgName}</strong>.
                </p>
                <p style="margin: 0; color: #374151; font-size: 16px;">
                    Ett konto har skapats åt dig med rollen <strong style="color: #10b981;">${roleName}</strong>.
                    ${isNewUser ? 'Du får nu tillgång till kvalitetsövervakning, rapporter och hantering för organisationens anläggningar.' : 'För din säkerhet har vi genererat ett nytt temporärt lösenord.'}
                </p>
            </div>

            <!-- Inloggningsuppgifter -->
            ${tempPassword ? `
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">
                    Dina inloggningsuppgifter
                </h3>
                <div style="background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace;">
                    <div style="margin-bottom: 8px; color: #374151;">
                        <strong>E-post:</strong> ${recipientEmail}
                    </div>
                    <div style="color: #374151;">
                        <strong>Lösenord:</strong> ${tempPassword}
                    </div>
                </div>
                <div style="margin-top: 16px; padding: 12px; background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                        <strong>⚠️ Viktigt:</strong> Ändra ditt lösenord när du loggar in första gången.
                    </p>
                </div>
            </div>
            ` : ''}

            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="${loginLink}" 
                   style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); 
                          color: white; 
                          text-decoration: none; 
                          padding: 16px 32px; 
                          border-radius: 8px; 
                          font-weight: 600; 
                          display: inline-block; 
                          font-size: 16px;
                          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);">
                    Logga in i portalen
                </a>
            </div>

            <!-- Organisationsinfo -->
            <div style="background-color: #fafbfc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px; color: #7c3aed; font-size: 16px; font-weight: 600;">
                    Organisationsinfo
                </h4>
                <div style="color: #4b5563; font-size: 14px;">
                    <div style="margin-bottom: 6px;"><strong>Organisation:</strong> ${orgName}</div>
                    ${organization.organization_number ? `<div style="margin-bottom: 6px;"><strong>Org.nr:</strong> ${organization.organization_number}</div>` : ''}
                    <div style="margin-bottom: 6px;"><strong>Din roll:</strong> ${roleName}</div>
                    <div><strong>Faktureringstyp:</strong> ${organization.billing_type === 'consolidated' ? 'Konsoliderad' : 'Per anläggning'}</div>
                </div>
            </div>

            <!-- Vad du kan göra (utan emoji) -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">
                    Vad du kan göra i portalen
                </h4>
                <ul style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px;">
                    <li style="margin: 6px 0;">Övervaka kvalitetsindikatorer för alla anläggningar</li>
                    <li style="margin: 6px 0;">Se detaljerade rapporter och trender</li>
                    <li style="margin: 6px 0;">Hantera ärenden och uppföljning</li>
                    <li style="margin: 6px 0;">Få meddelanden om viktiga händelser</li>
                    <li style="margin: 6px 0;">Exportera data för analys</li>
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 24px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                Länken är giltig i 7 dagar. Kontakta oss på 
                <a href="mailto:info@begone.se" style="color: #7c3aed; text-decoration: none;">info@begone.se</a> 
                om du behöver hjälp.
            </p>
            <p style="margin: 0; color: #1f2937; font-size: 14px; font-weight: 500;">
                Med vänliga hälsningar,<br>
                <strong>BeGone Skadedjur & Sanering AB</strong>
            </p>
        </div>
    </div>
</body>
</html>
  `
}