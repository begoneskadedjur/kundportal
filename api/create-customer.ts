// api/create-customer.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// Initiera Supabase Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Konfiguration
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!
const RESEND_API_KEY = process.env.RESEND_API_KEY!
const BASE_URL = process.env.VITE_APP_URL || 'https://din-app.vercel.app'

// Email transporter setup
const transporter = nodemailer.createTransporter({
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  auth: {
    user: 'resend',
    pass: RESEND_API_KEY,
  },
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Endast POST tillåtet
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('=== CREATE CUSTOMER API START ===')
  console.log('Request body:', JSON.stringify(req.body, null, 2))

  try {
    const { customerData } = req.body

    if (!customerData) {
      return res.status(400).json({ error: 'Customer data required' })
    }

    console.log('Customer data received:', customerData)

    // 1. Validera att organisationsnummer är unikt (om det finns)
    if (customerData.org_number) {
      const { data: existingCustomerByOrg } = await supabase
        .from('customers')
        .select('id, company_name, org_number')
        .eq('org_number', customerData.org_number)
        .single()

      if (existingCustomerByOrg) {
        console.log('Customer with org_number already exists:', existingCustomerByOrg)
        return res.status(400).json({ 
          error: `Ett företag med organisationsnummer ${customerData.org_number} finns redan registrerat.` 
        })
      }
    }

    // 2. Hämta avtalstyp för ClickUp folder ID
    console.log('Fetching contract type with ID:', customerData.contract_type_id)
    const { data: contractType, error: contractError } = await supabase
      .from('contract_types')
      .select('clickup_folder_id, name')
      .eq('id', customerData.contract_type_id)
      .single()

    if (contractError || !contractType) {
      console.error('Contract type error:', contractError)
      throw new Error('Kunde inte hämta avtalstyp')
    }

    console.log('Contract type found:', contractType)

    // 3. Skapa unikt företagsnamn för ClickUp (lägg till avtalstyp för att undvika dubletter)
    const uniqueListName = `${customerData.company_name} - ${contractType.name}`
    console.log('Creating ClickUp list with name:', uniqueListName)

    // 4. Skapa ClickUp lista
    const clickupResponse = await fetch(
      `https://api.clickup.com/api/v2/folder/${contractType.clickup_folder_id}/list`,
      {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: uniqueListName,
          content: `Kundlista för ${customerData.company_name} (${contractType.name})`,
          due_date: null,
          due_date_time: false,
          priority: 3
        })
      }
    )

    if (!clickupResponse.ok) {
      const errorData = await clickupResponse.text()
      console.error('ClickUp API error:', errorData)
      
      if (errorData.includes('SUBCAT_016') || errorData.includes('List name taken')) {
        throw new Error(`En ClickUp-lista med namnet "${uniqueListName}" finns redan.`)
      }
      
      throw new Error(`ClickUp API fel: ${errorData}`)
    }

    const clickupList = await clickupResponse.json()
    console.log('ClickUp list created:', { id: clickupList.id, name: clickupList.name })

    // 5. Skapa kund i databasen FÖRST
    console.log('Creating customer in database...')
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        company_name: customerData.company_name,
        org_number: customerData.org_number || null,
        contact_person: customerData.contact_person,
        email: customerData.email,
        phone: customerData.phone || null,
        address: customerData.address || null,
        contract_type_id: customerData.contract_type_id,
        clickup_list_id: clickupList.id,
        clickup_list_name: clickupList.name,
        is_active: true
      })
      .select()
      .single()

    if (customerError) {
      console.error('Customer creation error:', customerError)
      // Försök ta bort ClickUp-listan vid fel
      try {
        await fetch(`https://api.clickup.com/api/v2/list/${clickupList.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': CLICKUP_API_TOKEN }
        })
      } catch (cleanupError) {
        console.error('Failed to cleanup ClickUp list:', cleanupError)
      }
      throw new Error(`Kunde inte skapa kund: ${customerError.message}`)
    }

    console.log('Customer created successfully:', customer)

    // 6. Kolla om det finns en befintlig användare med denna e-post
    console.log('Checking for existing auth user with email:', customerData.email)
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existingAuthUser = users.find(u => u.email === customerData.email)
    
    let userId: string
    let isNewUser = false
    let tempPassword: string | null = null
    
    if (existingAuthUser) {
      console.log('Found existing auth user:', existingAuthUser.id)
      userId = existingAuthUser.id
      
      // Kolla om användaren redan har en profil kopplad till en annan kund
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*, customers(*)')
        .eq('user_id', userId)
        .single()

      if (existingProfile && existingProfile.customer_id && existingProfile.customer_id !== customer.id) {
        console.log('User already has profile with different customer:', existingProfile)
        // Denna användare är redan kopplad till en annan kund
        // Vi behöver skapa en ny auth-användare för denna kund
        console.log('Creating new auth user for existing email (different customer)...')
        isNewUser = true
        tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
        
        // Skapa ny användare med modifierad e-post (tillfällig lösning)
        const modifiedEmail = `${customerData.email.split('@')[0]}+${customer.id}@${customerData.email.split('@')[1]}`
        
        const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
          email: modifiedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            actual_email: customerData.email, // Spara riktiga e-posten
            company_name: customerData.company_name,
            contact_person: customerData.contact_person,
            customer_id: customer.id
          }
        })

        if (authError) {
          console.error('Auth creation error:', authError)
          await supabase.from('customers').delete().eq('id', customer.id)
          throw new Error(`Kunde inte skapa användarkonto: ${authError.message}`)
        }
        
        userId = newAuthUser.user.id
        console.log('Created new auth user with modified email:', userId)
      }
    } else {
      // Skapa helt ny användare
      console.log('Creating new auth user...')
      isNewUser = true
      tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
      
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: customerData.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          company_name: customerData.company_name,
          contact_person: customerData.contact_person,
          customer_id: customer.id
        }
      })

      if (authError) {
        console.error('Auth creation error:', authError)
        await supabase.from('customers').delete().eq('id', customer.id)
        throw new Error(`Kunde inte skapa användarkonto: ${authError.message}`)
      }
      
      userId = newAuthUser.user.id
      console.log('Created new auth user:', userId)
    }

    // 7. Skapa eller uppdatera profil
    console.log('Creating/updating profile for user:', userId)
    
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existingProfile) {
      console.log('Updating existing profile...')
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          customer_id: customer.id,
          email: customerData.email, // Använd den riktiga e-posten
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (updateError) {
        console.error('Profile update error:', updateError)
        await supabase.from('customers').delete().eq('id', customer.id)
        if (isNewUser) {
          await supabase.auth.admin.deleteUser(userId)
        }
        throw new Error(`Kunde inte uppdatera profil: ${updateError.message}`)
      }
    } else {
      console.log('Creating new profile...')
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          user_id: userId,
          email: customerData.email, // Använd den riktiga e-posten
          customer_id: customer.id,
          is_admin: false,
          is_active: true
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        await supabase.from('customers').delete().eq('id', customer.id)
        if (isNewUser) {
          await supabase.auth.admin.deleteUser(userId)
        }
        throw new Error(`Kunde inte skapa profil: ${profileError.message}`)
      }
    }

    console.log('Profile created/updated successfully')

    // 8. Skicka välkomstmail
    console.log('Sending welcome email...')
    
    const loginUrl = `${BASE_URL}/login`
    let emailHtml: string

    if (isNewUser && tempPassword) {
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .credentials { background-color: #e5f3ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Välkommen till BeGone Kundportal!</h1>
            </div>
            <div class="content">
              <p>Hej ${customerData.contact_person},</p>
              
              <p>Ditt företag <strong>${customerData.company_name}</strong> har nu tillgång till BeGone Kundportal där ni kan:</p>
              
              <ul>
                <li>Se alla era aktiva ärenden</li>
                <li>Följa status på pågående uppdrag</li>
                <li>Se kommande besök</li>
                <li>Ta del av besöksrapporter</li>
              </ul>
              
              <div class="credentials">
                <h3>Dina inloggningsuppgifter:</h3>
                <p><strong>E-post:</strong> ${customerData.email}<br>
                <strong>Temporärt lösenord:</strong> ${tempPassword}</p>
              </div>
              
              <p style="text-align: center;">
                <a href="${loginUrl}" class="button">Logga in nu</a>
              </p>
              
              <p><em>Byt gärna lösenord efter första inloggningen för ökad säkerhet.</em></p>
              
              <div class="footer">
                <p>Med vänlig hälsning,<br>
                BeGone Team</p>
                
                <p>Har du frågor? Kontakta oss på support@begone.se</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    } else {
      // För befintliga användare
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ny företagskoppling - BeGone Kundportal</h1>
            </div>
            <div class="content">
              <p>Hej ${customerData.contact_person},</p>
              
              <p>Ditt konto har nu kopplats till företaget <strong>${customerData.company_name}</strong> med avtalstyp <strong>${contractType.name}</strong>.</p>
              
              <p>Du kan logga in med ditt befintliga lösenord och få tillgång till alla funktioner för detta företag.</p>
              
              <p style="text-align: center;">
                <a href="${loginUrl}" class="button">Logga in</a>
              </p>
              
              <div class="footer">
                <p>Med vänlig hälsning,<br>
                BeGone Team</p>
                
                <p>Har du frågor? Kontakta oss på support@begone.se</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    }

    const mailOptions = {
      from: 'BeGone Kundportal <noreply@begone.se>',
      to: customerData.email,
      subject: isNewUser ? 'Välkommen till BeGone Kundportal' : 'Ny företagskoppling - BeGone Kundportal',
      html: emailHtml
    }

    await transporter.sendMail(mailOptions)
    console.log('Welcome email sent successfully')

    // 9. Returnera framgång
    console.log('=== CREATE CUSTOMER API SUCCESS ===')
    return res.status(200).json({
      success: true,
      customer: {
        id: customer.id,
        company_name: customer.company_name,
        email: customer.email,
        clickup_list_id: customer.clickup_list_id,
        contract_type: contractType.name
      }
    })

  } catch (error: any) {
    console.error('=== CREATE CUSTOMER API ERROR ===')
    console.error('Error:', error)
    console.error('Stack:', error.stack)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skapande av kund'
    })
  }
}