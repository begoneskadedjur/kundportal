// api/send-customer-invitation.ts - UPPDATERAD VERSION MED FIXAD NODEMAILER SYNTAX
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

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
    console.log('=== SEND CUSTOMER INVITATION API START ===')
    
    const { customerId, email, contactPerson, companyName } = req.body
    console.log('Invitation request:', { customerId, email, contactPerson, companyName })

    // 1. Validera inkommande data
    if (!customerId || !email || !contactPerson || !companyName) {
      return res.status(400).json({ error: 'Alla fält är obligatoriska: customerId, email, contactPerson, companyName' })
    }

    // 2. Validera e-post format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // 3. Hämta fullständig kundinfo från databas
    console.log('Fetching customer data...')
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('Customer fetch error:', customerError)
      return res.status(404).json({ error: 'Kund inte hittad' })
    }

    if (!customer.is_active) {
      return res.status(400).json({ error: 'Kan inte skicka inbjudan till inaktiv kund' })
    }

    console.log('Customer found:', customer.company_name)

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

      // Kontrollera om användaren redan har en profil för denna kund
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('customer_id', customerId)
        .single()

      if (existingProfile) {
        console.log('User already has profile for this customer')
        // Användaren har redan tillgång, skicka påminnelse-email istället
        const loginLink = `${process.env.VITE_APP_URL || 'https://begone-kundportal.vercel.app'}/login`
        
        await sendReminderEmail({
          email,
          contactPerson,
          companyName,
          loginLink,
          customer
        })

        // Uppdatera eller skapa invitation record
        await upsertInvitation(supabase, customerId, email, userId)

        return res.status(200).json({
          success: true,
          message: 'Påminnelse-email skickat (användaren har redan tillgång)',
          type: 'reminder'
        })
      }

      // Användaren existerar men har inte tillgång till denna kund
      // Skapa ny profil för denna kund
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: `${userId}_${customerId}`, // Unik ID för multi-customer support
          user_id: userId,
          customer_id: customerId,
          email: email,
          is_admin: false,
          is_active: true
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        return res.status(500).json({ error: 'Kunde inte skapa profil för kund' })
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
          company_name: companyName,
          contact_person: contactPerson,
          customer_id: customerId
        }
      })

      if (authError) {
        console.error('Auth creation error:', authError)
        return res.status(500).json({ error: `Kunde inte skapa användarkonto: ${authError.message}` })
      }
      
      userId = newAuthUser.user.id
      console.log('Created new auth user:', userId)

      // Skapa profil
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          user_id: userId,
          email: email,
          customer_id: customerId,
          is_admin: false,
          is_active: true
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Rensa upp auth user vid fel
        await supabase.auth.admin.deleteUser(userId)
        return res.status(500).json({ error: `Kunde inte skapa profil: ${profileError.message}` })
      }
    }

    // 5. Skicka inbjudan email
    const loginLink = `${process.env.VITE_APP_URL || 'https://begone-kundportal.vercel.app'}/login`
    
    if (isNewUser && tempPassword) {
      await sendWelcomeEmail({
        email,
        contactPerson,
        companyName,
        tempPassword,
        loginLink,
        customer
      })
    } else {
      await sendAccessEmail({
        email,
        contactPerson,
        companyName,
        loginLink,
        customer
      })
    }

    // 6. Registrera inbjudan i databas
    await upsertInvitation(supabase, customerId, email, userId)

    console.log('Invitation sent successfully')
    return res.status(200).json({
      success: true,
      message: 'Inbjudan skickad',
      type: isNewUser ? 'new_user' : 'existing_user'
    })

  } catch (error: any) {
    console.error('=== SEND INVITATION API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skickande av inbjudan'
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

async function upsertInvitation(supabase: any, customerId: string, email: string, userId: string) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 dagar utgång

  const { error } = await supabase
    .from('user_invitations')
    .upsert({
      customer_id: customerId,
      email: email,
      invited_by: userId, // I verkligheten skulle detta vara admin-användarens ID
      expires_at: expiresAt.toISOString(),
      accepted_at: null // Återställ vid ny inbjudan
    }, {
      onConflict: 'customer_id,email'
    })

  if (error) {
    console.error('Invitation upsert error:', error)
  }
}

// FIXAD FUNCTION: Använd nodemailer.createTransport (INTE createTransporter)
async function sendWelcomeEmail({ email, contactPerson, companyName, tempPassword, loginLink, customer }: any) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    auth: {
      user: 'resend',
      pass: RESEND_API_KEY
    }
  })

  const contractInfo = getContractInfoText(customer)

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Välkommen till BeGone Kundportal</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🚀 Välkommen till BeGone Kundportal!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Din digitala plattform för skadedjursbekämpning</p>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #22c55e; margin-top: 0;">Hej ${contactPerson}!</h2>
          
          <p>Vi är glada att välkomna <strong>${companyName}</strong> till BeGone Kundportal. Ditt konto är nu aktiverat och du kan börja använda alla funktioner.</p>

          <div style="background-color: #dcfce7; border: 1px solid #22c55e; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #22c55e; margin: 0 0 15px 0;">🔐 Dina inloggningsuppgifter</h3>
            <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
              <p style="margin: 5px 0;"><strong>E-post:</strong> ${email}</p>
              <p style="margin: 5px 0;"><strong>Tillfälligt lösenord:</strong> <code style="background-color: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
            </div>
            <p style="color: #dc2626; font-size: 14px; margin: 10px 0 0 0;">⚠️ <strong>Viktigt:</strong> Ändra ditt lösenord direkt efter första inloggningen av säkerhetsskäl.</p>
          </div>

          ${contractInfo}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginLink}" 
               style="display: inline-block; background-color: #22c55e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              🚀 Logga in på kundportalen
            </a>
          </div>

          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #475569; margin: 0 0 10px 0;">📋 Vad kan du göra i kundportalen?</h3>
            <ul style="margin: 0; padding-left: 20px; color: #64748b;">
              <li>Följ dina pågående ärenden i realtid</li>
              <li>Skapa nya serviceförfrågningar</li>
              <li>Se tekniker-rapporter och bilder</li>
              <li>Få notifikationer om viktiga uppdateringar</li>
              <li>Hantera dina kontaktuppgifter</li>
            </ul>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b;">
            <p><strong>Behöver du hjälp?</strong> Vi finns här för dig!</p>
            <p>📧 <a href="mailto:support@begone.se" style="color: #22c55e;">support@begone.se</a> | 📞 <a href="tel:010-123-45-67" style="color: #22c55e;">010-123 45 67</a></p>
            <p style="margin-top: 20px;">
              Med vänliga hälsningar,<br>
              <strong>BeGone Skadedjur Team</strong> 🐛🚫
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const mailOptions = {
    from: 'BeGone Kundportal <noreply@begone.se>',
    to: email,
    subject: `🚀 Välkommen till BeGone Kundportal - ${companyName}`,
    html: emailHtml
  }

  await transporter.sendMail(mailOptions)
  console.log('Welcome email sent to:', email)
}

// FIXAD FUNCTION: Använd nodemailer.createTransport (INTE createTransporter)
async function sendAccessEmail({ email, contactPerson, companyName, loginLink, customer }: any) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    auth: {
      user: 'resend',
      pass: RESEND_API_KEY
    }
  })

  const contractInfo = getContractInfoText(customer)

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ny företagskoppling - BeGone Kundportal</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 26px;">🏢 Ny företagskoppling tillagd!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">BeGone Kundportal</p>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #3b82f6; margin-top: 0;">Hej ${contactPerson}!</h2>
          
          <p>Vi har lagt till <strong>${companyName}</strong> till ditt befintliga BeGone Kundportal-konto. Du kan nu hantera detta företag tillsammans med dina andra företag.</p>

          <div style="background-color: #dbeafe; border: 1px solid #3b82f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #3b82f6; margin: 0 0 15px 0;">🔑 Inloggningsuppgifter</h3>
            <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <p style="margin: 5px 0;"><strong>E-post:</strong> ${email}</p>
              <p style="margin: 5px 0;"><strong>Lösenord:</strong> Använd ditt befintliga lösenord</p>
            </div>
            <p style="color: #1e40af; font-size: 14px; margin: 10px 0 0 0;">💡 <strong>Tips:</strong> Du kan växla mellan företag efter inloggning.</p>
          </div>

          ${contractInfo}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginLink}" 
               style="display: inline-block; background-color: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              🚀 Logga in på kundportalen
            </a>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b;">
            <p><strong>Frågor eller problem?</strong> Kontakta oss gärna!</p>
            <p>📧 <a href="mailto:support@begone.se" style="color: #3b82f6;">support@begone.se</a> | 📞 <a href="tel:010-123-45-67" style="color: #3b82f6;">010-123 45 67</a></p>
            <p style="margin-top: 20px;">
              Med vänliga hälsningar,<br>
              <strong>BeGone Skadedjur Team</strong> 🐛🚫
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const mailOptions = {
    from: 'BeGone Kundportal <noreply@begone.se>',
    to: email,
    subject: `🏢 Ny företagskoppling - ${companyName} | BeGone Kundportal`,
    html: emailHtml
  }

  await transporter.sendMail(mailOptions)
  console.log('Access email sent to:', email)
}

// FIXAD FUNCTION: Använd nodemailer.createTransport (INTE createTransporter)
async function sendReminderEmail({ email, contactPerson, companyName, loginLink, customer }: any) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    auth: {
      user: 'resend',
      pass: RESEND_API_KEY
    }
  })

  const contractInfo = getContractInfoText(customer)

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Påminnelse - BeGone Kundportal</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 26px;">🔔 Påminnelse om BeGone Kundportal</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Ditt konto väntar på dig</p>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #f59e0b; margin-top: 0;">Hej ${contactPerson}!</h2>
          
          <p>Vi vill påminna dig om att du har tillgång till BeGone Kundportal för <strong>${companyName}</strong>. Logga in för att se dina ärenden och hantera ditt konto.</p>

          ${contractInfo}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginLink}" 
               style="display: inline-block; background-color: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              🚀 Logga in nu
            </a>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b;">
            <p><strong>Behöver du hjälp med inloggning?</strong> Kontakta oss!</p>
            <p>📧 <a href="mailto:support@begone.se" style="color: #f59e0b;">support@begone.se</a> | 📞 <a href="tel:010-123-45-67" style="color: #f59e0b;">010-123 45 67</a></p>
            <p style="margin-top: 20px;">
              Med vänliga hälsningar,<br>
              <strong>BeGone Skadedjur Team</strong> 🐛🚫
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const mailOptions = {
    from: 'BeGone Kundportal <noreply@begone.se>',
    to: email,
    subject: `🔔 Påminnelse: Din BeGone Kundportal väntar - ${companyName}`,
    html: emailHtml
  }

  await transporter.sendMail(mailOptions)
  console.log('Reminder email sent to:', email)
}

function getContractInfoText(customer: any): string {
  if (!customer.annual_value && !customer.contract_start_date) {
    return ''
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  let contractText = `
    <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <h3 style="color: #0ea5e9; margin: 0 0 15px 0;">📄 Avtalsinformation</h3>
      <div style="background-color: white; padding: 15px; border-radius: 8px;">
  `

  if (customer.contract_types?.name) {
    contractText += `<p style="margin: 5px 0;"><strong>Avtalstyp:</strong> ${customer.contract_types.name}</p>`
  }

  if (customer.annual_value) {
    contractText += `<p style="margin: 5px 0;"><strong>Årspremie:</strong> ${formatCurrency(customer.annual_value)}</p>`
  }

  if (customer.contract_start_date) {
    contractText += `<p style="margin: 5px 0;"><strong>Avtalets startdatum:</strong> ${formatDate(customer.contract_start_date)}</p>`
  }

  if (customer.contract_end_date) {
    contractText += `<p style="margin: 5px 0;"><strong>Avtalets slutdatum:</strong> ${formatDate(customer.contract_end_date)}</p>`
  }

  if (customer.assigned_account_manager) {
    contractText += `<p style="margin: 5px 0;"><strong>Din kontakt hos oss:</strong> ${customer.assigned_account_manager}</p>`
  }

  contractText += `
      </div>
    </div>
  `

  return contractText
}