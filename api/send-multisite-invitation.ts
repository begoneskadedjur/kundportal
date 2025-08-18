// api/send-multisite-invitation.ts - EMAIL INTEGRATION FÖR MULTISITE-ORGANISATIONER
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('=== SEND MULTISITE INVITATION API START ===')
    
    const { organizationId, email, name, role, organizationName, siteIds } = req.body
    console.log('Multisite invitation request:', { organizationId, email, name, role, organizationName, siteIds })

    // 1. Validera inkommande data
    if (!organizationId || !email || !name || !role || !organizationName) {
      return res.status(400).json({ 
        error: 'Alla fält är obligatoriska: organizationId, email, name, role, organizationName' 
      })
    }

    // 2. Validera e-post format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // 3. Kontrollera om organisationen existerar
    // Nu hämtar vi från customers-tabellen där huvudkontoret finns
    const { data: organization, error: orgError } = await supabase
      .from('customers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('site_type', 'huvudkontor')
      .eq('is_multisite', true)
      .single()

    if (orgError || !organization) {
      console.error('Organization fetch error:', orgError)
      return res.status(404).json({ error: 'Organisation inte hittad' })
    }

    console.log('Organization found:', organization.company_name)

    // 4. Kontrollera om användaren redan existerar
    console.log('Checking for existing auth user...')
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existingAuthUser = users.find(u => u.email === email)
    
    let userId: string
    let tempPassword: string | null = null
    let isNewUser = false

    if (existingAuthUser) {
      console.log('Found existing auth user:', existingAuthUser.id)
      userId = existingAuthUser.id

      // Generera nytt temporärt lösenord för befintlig användare
      tempPassword = generateSecurePassword()
      console.log('Generated new temporary password for existing user')

      // Uppdatera användarens lösenord
      const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
        password: tempPassword,
        user_metadata: {
          ...existingAuthUser.user_metadata,
          organization_name: organizationName,
          organization_id: organizationId,
          role: role
        }
      })

      if (passwordError) {
        console.error('Failed to update password for existing user:', passwordError)
        return res.status(500).json({ error: 'Kunde inte uppdatera lösenord för befintlig användare' })
      }

      // Uppdatera eller skapa profil för befintlig användare
      const { error: profileUpsertError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          email: email,
          email_verified: true,
          role: 'customer',
          multisite_role: role, // Sätt multisite_role för check constraint
          organization_id: organizationId,
          is_active: true
        }, {
          onConflict: 'user_id'
        })

      if (profileUpsertError) {
        console.error('Profile upsert error for existing user:', profileUpsertError)
        return res.status(500).json({ error: 'Kunde inte uppdatera användarprofil' })
      }

      // Kontrollera om användaren redan har en roll för denna organisation
      const { data: existingRole } = await supabase
        .from('multisite_user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (existingRole) {
        console.log('User already has role in organization, updating and sending email with new password')
        // Uppdatera befintlig roll för att säkerställa att den är aktiv
        const { error: updateRoleError } = await supabase
          .from('multisite_user_roles')
          .update({
            role_type: role,
            site_ids: siteIds || [],  // Uppdatera site_ids
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRole.id)

        if (updateRoleError) {
          console.error('Failed to update existing role:', updateRoleError)
        }
      } else {
        // Användaren existerar men har inte denna roll i organisationen
        // Skapa ny roll
        const { error: roleError } = await supabase
          .from('multisite_user_roles')
          .insert({
            user_id: userId,
            organization_id: organizationId,
            role_type: role,
            site_ids: siteIds || [],  // Lägg till site_ids
            is_active: true
          })

        if (roleError) {
          console.error('Multisite role creation error:', roleError)
          return res.status(500).json({ error: 'Kunde inte skapa användarroll' })
        }
        console.log('Created new role for existing user')
      }

    } else {
      // Skapa helt ny användare
      console.log('Creating new auth user...')
      isNewUser = true
      tempPassword = generateSecurePassword()

      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: name,
          organization_name: organizationName,
          organization_id: organizationId,
          role: role,
          temp_password: true,
          must_change_password: true
        }
      })

      if (authError) {
        console.error('Auth creation error:', authError)
        return res.status(500).json({ error: `Kunde inte skapa användarkonto: ${authError.message}` })
      }
      
      userId = newAuthUser.user.id
      console.log('Created new auth user:', userId)

      // Skapa eller uppdatera profil i profiles-tabellen
      // Använd upsert för att hantera om profilen redan existerar
      const { error: profileCreateError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          email: email,
          email_verified: true,
          is_admin: false,
          is_koordinator: false,
          role: 'customer', // Sätt standard roll för multisite-användare
          multisite_role: role, // VIKTIGT: Sätt multisite_role för att uppfylla check constraint
          organization_id: organizationId,
          is_active: true
        }, {
          onConflict: 'user_id'
        })

      if (profileCreateError) {
        console.error('Profile creation error:', profileCreateError)
        // Rensa upp auth user vid fel
        await supabase.auth.admin.deleteUser(userId)
        return res.status(500).json({ error: `Kunde inte skapa användarprofil: ${profileCreateError.message}` })
      }

      // Skapa multisite-roll
      const { error: roleError } = await supabase
        .from('multisite_user_roles')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          role_type: role,
          site_ids: siteIds || [],  // Använd site_ids från request
          region: null,
          is_active: true
        })

      if (roleError) {
        console.error('Multisite role creation error:', roleError)
        // Rensa upp auth user och profil vid fel
        await supabase.auth.admin.deleteUser(userId)
        return res.status(500).json({ error: `Kunde inte skapa multisite-roll: ${roleError.message}` })
      }
    }

    // 5. Skicka inbjudan email via Resend API
    const loginLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/login`
    
    const emailHtml = getMultisiteInvitationEmailTemplate({
      organization,
      recipientEmail: email,
      recipientName: name,
      role: role,
      loginLink,
      isNewUser,
      tempPassword  // Nu har även befintliga användare ett temporärt lösenord
    })

    const subject = isNewUser 
      ? `Välkommen till Begone Organisationsportal - ${organizationName}`
      : `Ny organisation tillagd - ${organizationName}`

    try {
      // Använd Resend API direkt
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Begone Kundportal <noreply@begone.se>',
          to: [email],
          subject: subject,
          html: emailHtml
        }),
      })

      if (!emailResponse.ok) {
        const error = await emailResponse.text()
        console.error('Failed to send email via Resend:', error)
        throw new Error('Failed to send email')
      }

      const emailData = await emailResponse.json()
      console.log('Multisite invitation email sent via Resend:', emailData)
    } catch (emailError: any) {
      console.error('Failed to send multisite invitation email:', emailError)
      // Log but don't fail - user is created in database
      console.log('User created but email not sent. User can still login with credentials.')
    }

    // 6. Registrera inbjudan i databas
    await upsertMultisiteInvitation(supabase, organizationId, email, userId, role)

    console.log('Multisite invitation sent successfully')
    return res.status(200).json({
      success: true,
      message: 'Inbjudan skickad',
      type: isNewUser ? 'new_user' : 'existing_user'
    })

  } catch (error: any) {
    console.error('=== SEND MULTISITE INVITATION API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skickande av multisite-inbjudan'
    })
  }
}

// Hjälpfunktioner
function generateSecurePassword(): string {
  const length = 12
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
  let password = ""
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  
  // Säkerställ att lösenordet innehåller minst en stor bokstav, en liten bokstav, en siffra och ett specialtecken
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%])/.test(password)) {
    return generateSecurePassword() // Generera nytt om kriterierna inte uppfylls
  }
  
  return password
}

async function upsertMultisiteInvitation(supabase: any, organizationId: string, email: string, userId: string, role: string) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 dagar utgång

  const { error } = await supabase
    .from('multisite_user_invitations')
    .upsert({
      organization_id: organizationId,
      email: email,
      user_id: userId,
      role: role,
      invited_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      accepted_at: null // Återställ vid ny inbjudan
    }, {
      onConflict: 'organization_id,email'
    })

  if (error) {
    console.error('Multisite invitation upsert error:', error)
  }
}

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
    'regionschef': 'Regionschef',
    'platsansvarig': 'Platsansvarig'
  }

  const roleName = roleNames[role] || role
  // Säker null-checking för att undvika undefined
  const companyName = organization?.company_name || 'Din organisation'
  const orgNumber = organization?.organization_number || ''

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isNewUser ? 'Välkommen till Begone Organisationsportal' : 'Ny organisation tillagd'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border: 1px solid #e5e7eb;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #2563eb; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">
                                BeGone Skadedjur & Sanering AB
                            </h1>
                            <p style="margin: 15px 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">
                                ${isNewUser ? 'Välkommen till Organisationsportalen' : 'Ny Organisation Tillagd'}
                            </p>
                            <p style="margin: 10px 0 0; color: #ffffff; font-size: 20px; font-weight: bold;">
                                ${companyName}
                            </p>
                        </td>
                    </tr>

                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                                Hej ${recipientName},
                            </p>

                            ${isNewUser ? `
                            <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                                Du har blivit inbjuden att delta i Begone Skadedjur & Sanering AB:s multisite-portal för organisationen <strong style="color: #2563eb;">${companyName}</strong>.
                            </p>

                            <p style="margin: 0 0 30px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                                Ett konto har skapats åt dig med rollen <strong style="color: #059669;">${roleName}</strong>. 
                                Du får nu tillgång till kvalitetsövervakning, rapporter och hantering för alla anläggningar i organisationen.
                            </p>
                            ` : `
                            <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                                Du har blivit tillagd till multisite-organisationen <strong style="color: #2563eb;">${companyName}</strong> 
                                med rollen <strong style="color: #059669;">${roleName}</strong>.
                            </p>

                            <p style="margin: 0 0 30px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                                För din säkerhet har vi genererat ett nytt temporärt lösenord. Använd de inloggningsuppgifter som finns nedan 
                                för att komma åt denna organisations anläggningar och data.
                            </p>
                            `}

                            <!-- Inloggningsuppgifter -->
                            ${tempPassword ? `
                            <table role="presentation" style="width: 100%; margin: 30px 0; border: 2px solid #dc2626; background-color: #fef2f2;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #dc2626; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                                            Inloggningsuppgifter
                                        </h3>
                                        <table role="presentation" style="width: 100%; background-color: #ffffff; border: 1px solid #fecaca;">
                                            <tr>
                                                <td style="padding: 15px; font-family: 'Courier New', monospace;">
                                                    <p style="margin: 0 0 10px; color: #1f2937; font-size: 14px;">
                                                        <strong>E-post:</strong> ${recipientEmail}
                                                    </p>
                                                    <p style="margin: 0; color: #1f2937; font-size: 14px;">
                                                        <strong>Lösenord:</strong> ${tempPassword}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="margin: 15px 0 0; color: #dc2626; font-size: 14px; font-weight: bold;">
                                            VIKTIGT: Ändra ditt lösenord när du loggar in första gången
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            ` : ''}

                            <!-- Organisations-info -->
                            <table role="presentation" style="width: 100%; margin: 30px 0; background-color: #f8fafc; border: 1px solid #e5e7eb;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: bold; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
                                            ORGANISATIONSINFO
                                        </h3>
                                        <table role="presentation" style="width: 100%;">
                                            <tr>
                                                <td style="padding: 5px 0;">
                                                    <p style="margin: 0; color: #4b5563; font-size: 15px;">
                                                        <strong style="color: #1f2937;">Organisation:</strong> ${companyName}
                                                    </p>
                                                </td>
                                            </tr>
                                            ${orgNumber ? `
                                            <tr>
                                                <td style="padding: 5px 0;">
                                                    <p style="margin: 0; color: #4b5563; font-size: 15px;">
                                                        <strong style="color: #1f2937;">Org.nr:</strong> ${orgNumber}
                                                    </p>
                                                </td>
                                            </tr>
                                            ` : ''}
                                            <tr>
                                                <td style="padding: 5px 0;">
                                                    <p style="margin: 0; color: #4b5563; font-size: 15px;">
                                                        <strong style="color: #1f2937;">Din roll:</strong> ${roleName}
                                                    </p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 5px 0;">
                                                    <p style="margin: 0; color: #4b5563; font-size: 15px;">
                                                        <strong style="color: #1f2937;">Faktureringstyp:</strong> Konsoliderad
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Vad du kan göra -->
                            <table role="presentation" style="width: 100%; margin: 30px 0; background-color: #eff6ff; border: 1px solid #bfdbfe;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: bold; border-left: 4px solid #2563eb; padding-left: 15px;">
                                            VAD DU KAN GÖRA I PORTALEN
                                        </h3>
                                        <table role="presentation" style="width: 100%; margin-left: 20px;">
                                            <tr><td style="padding: 5px 0; color: #4b5563; font-size: 15px;">• Övervaka kvalitetsindikatorer för alla anläggningar</td></tr>
                                            <tr><td style="padding: 5px 0; color: #4b5563; font-size: 15px;">• Se detaljerade rapporter och trender</td></tr>
                                            <tr><td style="padding: 5px 0; color: #4b5563; font-size: 15px;">• Hantera ärenden och uppföljning</td></tr>
                                            <tr><td style="padding: 5px 0; color: #4b5563; font-size: 15px;">• Få meddelanden om viktiga händelser</td></tr>
                                            <tr><td style="padding: 5px 0; color: #4b5563; font-size: 15px;">• Exportera data för analys</td></tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin: 40px 0;">
                                <tr>
                                    <td align="center">
                                        <table role="presentation">
                                            <tr>
                                                <td style="background-color: #2563eb; padding: 15px 40px; text-align: center;">
                                                    <a href="${loginLink}" 
                                                       style="color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                                                        LOGGA IN I PORTALEN
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                                Länken är giltig i 7 dagar. Kontakta oss på 
                                <a href="mailto:info@begone.se" style="color: #2563eb; text-decoration: none;">info@begone.se</a> 
                                om du behöver hjälp.
                            </p>
                            <p style="margin: 15px 0 0; color: #6b7280; font-size: 14px;">
                                Med vänliga hälsningar,<br>
                                <strong style="color: #1f2937; font-size: 16px;">Begone Skadedjur & Sanering AB</strong>
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `
}