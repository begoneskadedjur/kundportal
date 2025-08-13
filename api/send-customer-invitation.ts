// api/send-customer-invitation.ts - UPPDATERAD VERSION MED FIXAD NODEMAILER SYNTAX
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { getWelcomeEmailTemplate, getAccessEmailTemplate, getReminderEmailTemplate } from './email-templates'

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
        
        // Skicka påminnelse med ny professionell mall
        const transporter = nodemailer.createTransport({
          host: 'smtp.resend.com',
          port: 587,
          secure: false,
          auth: {
            user: 'resend',
            pass: RESEND_API_KEY
          }
        })

        const emailHtml = getReminderEmailTemplate({
          customer,
          recipientEmail: email,
          recipientName: contactPerson,
          loginLink,
          isNewUser: false
        })

        const mailOptions = {
          from: 'Begone Skadedjur & Sanering AB <info@begone.se>',
          to: email,
          subject: `Påminnelse: Er kundportal väntar - ${companyName}`,
          html: emailHtml
        }

        await transporter.sendMail(mailOptions)
        console.log('Professional reminder email sent to:', email)

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
    
    // Använd professionella e-postmallar
    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: RESEND_API_KEY
      }
    })

    let emailHtml: string
    let subject: string
    
    if (isNewUser && tempPassword) {
      emailHtml = getWelcomeEmailTemplate({
        customer,
        recipientEmail: email,
        recipientName: contactPerson,
        loginLink,
        isNewUser: true,
        tempPassword
      })
      subject = `Välkommen till Begone Kundportal - ${companyName}`
    } else {
      emailHtml = getAccessEmailTemplate({
        customer,
        recipientEmail: email,
        recipientName: contactPerson,
        loginLink,
        isNewUser: false
      })
      subject = `Ny företagskoppling tillagd - ${companyName}`
    }

    const mailOptions = {
      from: 'Begone Skadedjur & Sanering AB <info@begone.se>',
      to: email,
      subject: subject,
      html: emailHtml
    }

    await transporter.sendMail(mailOptions)
    console.log('Professional invitation email sent to:', email)

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

// Gamla funktioner borttagna - ersatta med professionella mallar från email-templates.ts