// api/send-multisite-invitation.ts - EMAIL INTEGRATION FÖR MULTISITE-ORGANISATIONER
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
const nodemailer = require('nodemailer')

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
    
    const { organizationId, email, name, role, organizationName } = req.body
    console.log('Multisite invitation request:', { organizationId, email, name, role, organizationName })

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
    const { data: organization, error: orgError } = await supabase
      .from('multisite_organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (orgError || !organization) {
      console.error('Organization fetch error:', orgError)
      return res.status(404).json({ error: 'Organisation inte hittad' })
    }

    console.log('Organization found:', organization.name)

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

      // Kontrollera om användaren redan har en multisite-profil för denna organisation
      const { data: existingProfile } = await supabase
        .from('multisite_user_profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single()

      if (existingProfile) {
        console.log('User already has multisite profile for this organization')
        return res.status(200).json({
          success: true,
          message: 'Användaren har redan tillgång till denna organisation',
          type: 'already_exists'
        })
      }

      // Användaren existerar men har inte tillgång till denna organisation
      // Skapa ny roll i multisite_user_roles
      const { error: roleError } = await supabase
        .from('multisite_user_roles')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          role_type: role,
          is_active: true
        })

      if (roleError) {
        console.error('Multisite role creation error:', roleError)
        return res.status(500).json({ error: 'Kunde inte skapa användarroll' })
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
          role: role
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
          site_ids: [],
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

    // 5. Skicka inbjudan email
    const loginLink = `${process.env.VITE_APP_URL || 'https://kundportal.vercel.app'}/login`
    
    const transporter = nodemailer.createTransporter({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: RESEND_API_KEY
      }
    })

    const emailHtml = getMultisiteInvitationEmailTemplate({
      organization,
      recipientEmail: email,
      recipientName: name,
      role: role,
      loginLink,
      isNewUser,
      tempPassword
    })

    const subject = isNewUser 
      ? `Välkommen till Begone Multisite Portal - ${organizationName}`
      : `Ny organisation tillagd - ${organizationName}`

    const mailOptions = {
      from: 'Begone Kundportal <noreply@resend.dev>',
      to: email,
      subject: subject,
      html: emailHtml
    }

    try {
      const info = await transporter.sendMail(mailOptions)
      console.log('Multisite invitation email sent successfully:', {
        to: email,
        messageId: info.messageId,
        response: info.response
      })
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