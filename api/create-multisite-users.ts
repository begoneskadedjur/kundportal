// api/create-multisite-users.ts - Skapa multisite-användare
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

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
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('multisite_organizations')
      .select('*')
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

        // Send invitation email directly
        if (RESEND_API_KEY) {
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
              tempPassword: isNewUser ? tempPassword : undefined
            })

            const transporter = nodemailer.createTransporter({
              host: 'smtp.resend.com',
              port: 587,
              secure: false,
              auth: {
                user: 'resend',
                pass: RESEND_API_KEY
              }
            })

            const subject = isNewUser 
              ? `Välkommen till Begone Multisite Portal - ${organizationName}`
              : `Ny organisation tillagd - ${organizationName}`

            const mailOptions = {
              from: 'Begone Kundportal <noreply@resend.dev>',
              to: userData.email,
              subject: subject,
              html: emailHtml
            }

            const info = await transporter.sendMail(mailOptions)
            console.log(`Invitation email sent to ${userData.email}:`, info.messageId)
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

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isNewUser ? 'Välkommen till Begone Multisite Portal' : 'Ny organisation tillagd'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0f172a; color: #e2e8f0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
        
        <!-- Header med gradient -->
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 2rem; text-align: center;">
            <div style="background-color: rgba(255, 255, 255, 0.1); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </div>
            <h1 style="margin: 0; color: white; font-size: 1.75rem; font-weight: bold;">
                ${isNewUser ? 'Välkommen till Begone Multisite Portal!' : 'Ny Organisation Tillagd'}
            </h1>
            <p style="margin: 0.5rem 0 0; color: rgba(255, 255, 255, 0.9); font-size: 1rem;">
                ${organization.name}
            </p>
        </div>

        <!-- Innehåll -->
        <div style="padding: 2rem;">
            <p style="font-size: 1.1rem; line-height: 1.6; margin-bottom: 1.5rem;">
                Hej ${recipientName},
            </p>

            ${isNewUser ? `
            <p style="line-height: 1.6; margin-bottom: 1.5rem;">
                Du har blivit inbjuden att delta i Begone Skadedjur & Sanering AB:s multisite-portal för organisationen <strong style="color: #a855f7;">${organization.name}</strong>.
            </p>

            <p style="line-height: 1.6; margin-bottom: 1.5rem;">
                Ett konto har skapats åt dig med rollen <strong style="color: #22c55e;">${roleName}</strong>. 
                Du får nu tillgång till kvalitetsövervakning, rapporter och hantering för alla anläggningar i organisationen.
            </p>
            ` : `
            <p style="line-height: 1.6; margin-bottom: 1.5rem;">
                Du har blivit tillagd till multisite-organisationen <strong style="color: #a855f7;">${organization.name}</strong> 
                med rollen <strong style="color: #22c55e;">${roleName}</strong>.
            </p>

            <p style="line-height: 1.6; margin-bottom: 1.5rem;">
                Du kan nu logga in med ditt befintliga konto och få tillgång till denna organisations anläggningar och data.
            </p>
            `}

            <!-- Inloggningsuppgifter om ny användare -->
            ${isNewUser && tempPassword ? `
            <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
                <h3 style="color: white; margin: 0 0 1rem; font-size: 1.1rem; font-weight: bold;">
                    📧 Dina inloggningsuppgifter
                </h3>
                <div style="background-color: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 6px; font-family: monospace;">
                    <p style="margin: 0.5rem 0; color: white;"><strong>E-post:</strong> ${recipientEmail}</p>
                    <p style="margin: 0.5rem 0; color: white;"><strong>Lösenord:</strong> ${tempPassword}</p>
                </div>
                <p style="margin: 1rem 0 0; color: rgba(255, 255, 255, 0.9); font-size: 0.9rem;">
                    ⚠️ <strong>Viktigt:</strong> Ändra ditt lösenord när du loggar in första gången
                </p>
            </div>
            ` : ''}

            <!-- Organisations-info -->
            <div style="background-color: #334155; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
                <h3 style="color: #a855f7; margin: 0 0 1rem; font-size: 1.1rem; font-weight: bold;">
                    🏢 Organisationsinfo
                </h3>
                <div style="color: #cbd5e1;">
                    <p style="margin: 0.5rem 0;"><strong>Organisation:</strong> ${organization.name}</p>
                    ${organization.organization_number ? `<p style="margin: 0.5rem 0;"><strong>Org.nr:</strong> ${organization.organization_number}</p>` : ''}
                    <p style="margin: 0.5rem 0;"><strong>Din roll:</strong> ${roleName}</p>
                    <p style="margin: 0.5rem 0;"><strong>Faktureringstyp:</strong> ${organization.billing_type === 'consolidated' ? 'Konsoliderad' : 'Per anläggning'}</p>
                </div>
            </div>

            <!-- Vad du kan göra -->
            <div style="background-color: #1e40af; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
                <h3 style="color: white; margin: 0 0 1rem; font-size: 1.1rem; font-weight: bold;">
                    ✨ Vad du kan göra i portalen
                </h3>
                <ul style="color: rgba(255, 255, 255, 0.9); margin: 0; padding-left: 1.2rem;">
                    <li style="margin: 0.5rem 0;">Övervaka kvalitetsindikatorer för alla anläggningar</li>
                    <li style="margin: 0.5rem 0;">Se detaljerade rapporter och trender</li>
                    <li style="margin: 0.5rem 0;">Hantera ärenden och uppföljning</li>
                    <li style="margin: 0.5rem 0;">Få meddelanden om viktiga händelser</li>
                    <li style="margin: 0.5rem 0;">Exportera data för analys</li>
                </ul>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 2rem 0;">
                <a href="${loginLink}" 
                   style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); 
                          color: white; 
                          text-decoration: none; 
                          padding: 1rem 2rem; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          display: inline-block; 
                          font-size: 1.1rem;
                          box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);">
                    🚀 Logga in i portalen
                </a>
            </div>

            <div style="border-top: 1px solid #475569; padding-top: 1.5rem; margin-top: 2rem; text-align: center; color: #94a3b8; font-size: 0.9rem;">
                <p>Länken är giltig i 7 dagar. Kontakta oss på <a href="mailto:info@begone.se" style="color: #a855f7;">info@begone.se</a> om du behöver hjälp.</p>
                <p style="margin-top: 1rem;">
                    Med vänliga hälsningar,<br>
                    <strong style="color: #e2e8f0;">Begone Skadedjur & Sanering AB</strong>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
  `
}