// api/create-customer.ts - FIXAD VERSION med korrekt email access
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('=== CREATE CUSTOMER API START ===')
    
    const customerData = req.body
    console.log('Customer data received:', {
      ...customerData,
      email: customerData.email ? 'REDACTED' : undefined
    })

    // 1. Validera inkommande data
    const requiredFields = ['company_name', 'contact_person', 'contact_email']
    for (const field of requiredFields) {
      if (!customerData[field]) {
        return res.status(400).json({ error: `Fält "${field}" är obligatoriskt` })
      }
    }

    // 2. Validera e-post format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerData.contact_email)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // 3. Hämta avtalstyp från databas (om det finns)
    let contractType = null
    if (customerData.contract_type_id) {
      console.log('Fetching contract type:', customerData.contract_type_id)
      const { data: ct, error: contractError } = await supabase
        .from('contract_types')
        .select('*')
        .eq('id', customerData.contract_type_id)
        .eq('is_active', true)
        .single()

      if (!contractError && ct) {
        contractType = ct
        console.log('Contract type found:', contractType.name)
      }
    }

    // 4. Kolla om kund redan finns - FIXAD med säker email access
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('company_name, organization_number, contact_email')
      .or(`company_name.eq.${customerData.company_name},organization_number.eq.${customerData.organization_number || ''},contact_email.eq.${customerData.contact_email}`)

    if (existingCustomers && existingCustomers.length > 0) {
      const existingCustomer = existingCustomers[0]
      if (existingCustomer.company_name === customerData.company_name) {
        return res.status(400).json({ error: `Företaget "${customerData.company_name}" finns redan` })
      }
      if (customerData.organization_number && existingCustomer.organization_number === customerData.organization_number) {
        return res.status(400).json({ error: `Organisationsnummer "${customerData.organization_number}" finns redan` })
      }
      if (existingCustomer.contact_email === customerData.contact_email) {
        return res.status(400).json({ error: `E-postadressen "${customerData.contact_email}" används redan` })
      }
    }

    // 5. Skapa ClickUp lista (om contractType finns)
    let clickupList = null
    if (contractType) {
      const uniqueListName = `${customerData.company_name} - ${contractType.name}`
      console.log('Creating ClickUp list with name:', uniqueListName)

      // 6. Skapa ClickUp lista
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
        return res.status(400).json({ error: `En ClickUp-lista med namnet "${uniqueListName}" finns redan.` })
      }
      
      return res.status(500).json({ error: `ClickUp API fel: ${errorData}` })
    }

      clickupList = await clickupResponse.json()
      console.log('ClickUp list created:', { id: clickupList.id, name: clickupList.name })
    }

    // 7. Förbered kunddata för databas
    const dbCustomerData: any = {
      company_name: customerData.company_name.trim(),
      organization_number: customerData.organization_number?.trim() || null,
      contact_person: customerData.contact_person.trim(),
      contact_email: customerData.contact_email.trim().toLowerCase(),
      contact_phone: customerData.contact_phone?.trim() || null,
      contact_address: customerData.contact_address?.trim() || null,
      
      // OneFlow fält
      oneflow_contract_id: customerData.oneflow_contract_id || null,
      contract_template_id: customerData.contract_template_id || null,
      contract_type: customerData.contract_type || contractType?.name || null,
      contract_status: customerData.contract_status || 'signed',
      
      // Avtalsfält
      contract_start_date: customerData.contract_start_date || null,
      contract_end_date: customerData.contract_end_date || null,
      contract_length: customerData.contract_length || null,
      annual_value: customerData.annual_value ? parseFloat(customerData.annual_value) : null,
      monthly_value: customerData.monthly_value ? parseFloat(customerData.monthly_value) : null,
      total_contract_value: customerData.total_contract_value ? parseFloat(customerData.total_contract_value) : null,
      agreement_text: customerData.agreement_text || null,
      
      // Account management
      assigned_account_manager: customerData.assigned_account_manager || null,
      account_manager_email: customerData.account_manager_email || null,
      sales_person: customerData.sales_person || null,
      sales_person_email: customerData.sales_person_email || null,
      
      // Affärstyp
      business_type: customerData.business_type || null,
      industry_category: customerData.industry_category || null,
      customer_size: customerData.customer_size || null,
      service_frequency: customerData.service_frequency || null,
      source_type: customerData.source_type || 'manual',
      
      is_active: true
    }
    
    // Lägg till ClickUp data om det finns
    if (clickupList) {
      dbCustomerData.clickup_list_id = clickupList.id
      dbCustomerData.clickup_list_name = clickupList.name
    }

    // 8. Skapa kund i databas
    console.log('Creating customer in database...')
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(dbCustomerData)
      .select()
      .single()

    if (customerError) {
      console.error('Customer creation error:', customerError)
      // Försök ta bort ClickUp-listan vid fel (om den skapades)
      if (clickupList) {
        try {
          await fetch(`https://api.clickup.com/api/v2/list/${clickupList.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': CLICKUP_API_TOKEN }
          })
        } catch (cleanupError) {
          console.error('Failed to cleanup ClickUp list:', cleanupError)
        }
      }
      return res.status(500).json({ error: `Kunde inte skapa kund: ${customerError.message}` })
    }

    console.log('Customer created successfully:', customer.id)

    // 9. Hantera autentisering och profil - FIXAD med säker email access
    console.log('Checking for existing auth user with email:', customerData.contact_email)
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existingAuthUser = users.find(u => u.email === customerData.contact_email)
    
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
        const modifiedEmail = `${customerData.contact_email.split('@')[0]}+${customer.id}@${customerData.contact_email.split('@')[1]}`
        
        const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
          email: modifiedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            actual_email: customerData.contact_email, // Spara riktiga e-posten
            company_name: customerData.company_name,
            contact_person: customerData.contact_person,
            customer_id: customer.id
          }
        })

        if (authError) {
          console.error('Auth creation error:', authError)
          await supabase.from('customers').delete().eq('id', customer.id)
          return res.status(500).json({ error: `Kunde inte skapa användarkonto: ${authError.message}` })
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
        email: customerData.contact_email,
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
        return res.status(500).json({ error: `Kunde inte skapa användarkonto: ${authError.message}` })
      }
      
      userId = newAuthUser.user.id
      console.log('Created new auth user:', userId)
    }

    // 10. Skapa eller uppdatera profil
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
          email: customerData.contact_email, // Använd den riktiga e-posten
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
        return res.status(500).json({ error: `Kunde inte uppdatera profil: ${updateError.message}` })
      }
    } else {
      console.log('Creating new profile...')
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          user_id: userId,
          email: customerData.contact_email, // Använd den riktiga e-posten
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
        return res.status(500).json({ error: `Kunde inte skapa profil: ${profileError.message}` })
      }
    }

    console.log('Profile created/updated successfully')

    // 11. Skicka välkomstmail
    console.log('Preparing welcome email...')
    
    const loginLink = `${process.env.VITE_APP_URL || 'https://begone-kundportal.vercel.app'}/login`
    
    // Förbättrat avtalsinformation med slutdatum
    const contractInfo = customer.contract_start_date || customer.annual_value ? `
      <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="color: #22c55e; margin: 0 0 12px 0;">📋 Avtalsinformation</h3>
        ${customer.contract_start_date ? `
          <p style="margin: 4px 0;"><strong>📅 Startdatum:</strong> ${new Date(customer.contract_start_date).toLocaleDateString('sv-SE')}</p>
        ` : ''}
        ${customer.contract_end_date ? `
          <p style="margin: 4px 0;"><strong>🏁 Slutdatum:</strong> ${new Date(customer.contract_end_date).toLocaleDateString('sv-SE')}</p>
        ` : ''}
        ${customer.contract_length ? `
          <p style="margin: 4px 0;"><strong>⏱️ Avtalslängd:</strong> ${customer.contract_length} år</p>
        ` : ''}
        ${customer.annual_value ? `
          <p style="margin: 4px 0;"><strong>💰 Årspremie:</strong> ${customer.annual_value.toLocaleString('sv-SE')} SEK</p>
        ` : ''}
        ${customer.total_contract_value ? `
          <p style="margin: 4px 0;"><strong>💎 Totalt avtalsvärde:</strong> ${customer.total_contract_value.toLocaleString('sv-SE')} SEK</p>
        ` : ''}
        ${customer.assigned_account_manager ? `
          <p style="margin: 4px 0;"><strong>👤 Avtalsansvarig:</strong> ${customer.assigned_account_manager}</p>
        ` : ''}
      </div>
    ` : ''

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Välkommen till BeGone Kundportal</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22c55e; margin: 0;">🐛 BeGone Skadedjur</h1>
          <h2 style="color: #64748b; margin: 10px 0;">Välkommen till vår kundportal!</h2>
        </div>

        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <p>Hej <strong>${customer.contact_person}</strong>!</p>
          
          <p>Tack för att du valt BeGone Skadedjur. Vi har nu skapat ett konto för ditt företag <strong>${customer.company_name}</strong> i vår kundportal.</p>
          
          ${contractInfo}
          
          <p>I portalen kan du:</p>
          <ul style="color: #475569;">
            <li>📊 Följa dina ärenden i realtid</li>
            <li>📷 Se tekniska rapporter och bilder</li>
            <li>➕ Skapa nya ärenden direkt</li>
            <li>⚙️ Hantera dina företagsuppgifter</li>
            <li>📈 Få översikt över avtalet och dess status</li>
          </ul>
        </div>

        ${isNewUser ? `
        <div style="background-color: #ecfdf5; border: 1px solid #22c55e; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h3 style="color: #22c55e; margin: 0 0 10px 0;">Dina inloggningsuppgifter</h3>
          <p><strong>E-post för inloggning:</strong> ${customerData.contact_email}</p>
          <p><strong>Tillfälligt lösenord:</strong> ${tempPassword}</p>
          <p style="color: #ef4444; font-size: 14px;">⚠️ Ändra ditt lösenord efter första inloggningen</p>
          <p style="color: #64748b; font-size: 12px;"><em>Obs: Om du har flera företag registrerade med samma e-post kan du byta mellan dem efter inloggning.</em></p>
        </div>
        ` : `
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h3 style="color: #f59e0b; margin: 0 0 10px 0;">Befintligt konto</h3>
          <p>Du kan logga in med ditt befintliga lösenord.</p>
          <p><strong>E-post:</strong> ${customerData.contact_email}</p>
          <p style="color: #64748b; font-size: 12px;"><em>Ditt konto har nu tillgång till företaget ${customer.company_name}.</em></p>
        </div>
        `}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginLink}" 
             style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            🚀 Logga in på kundportalen
          </a>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b;">
          <p>Vid frågor, kontakta oss gärna:</p>
          <p>📧 support@begone.se | 📞 010-123 45 67</p>
          <p style="margin-top: 15px;">
            Med vänliga hälsningar,<br>
            <strong>BeGone Skadedjur Team</strong>
          </p>
        </div>
      </body>
      </html>
    `

    // FIXAD: Konfigurera Nodemailer med Resend - använd createTransport
    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: RESEND_API_KEY
      }
    })

    // VIKTIGT: Skicka alltid till den email som användaren angav
    const mailOptions = {
      from: 'BeGone Kundportal <noreply@begone.se>',
      to: customerData.contact_email, // Skicka till original-emailen som kunden angav
      subject: isNewUser ? 'Välkommen till BeGone Kundportal - Avtal aktiverat' : 'Ny företagskoppling - BeGone Kundportal',
      html: emailHtml
    }

    try {
      await transporter.sendMail(mailOptions)
      console.log('Welcome email sent successfully to:', customerData.contact_email)
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
      // Fortsätt ändå - kunden är skapad
    }

    // 12. Returnera framgång
    console.log('=== CREATE CUSTOMER API SUCCESS ===')
    return res.status(200).json({
      success: true,
      customer: {
        id: customer.id,
        company_name: customer.company_name,
        email: customer.contact_email,
        clickup_list_id: customer.clickup_list_id,
        contract_type: customer.contract_type,
        contract_start_date: customer.contract_start_date,
        contract_end_date: customer.contract_end_date,
        contract_length: customer.contract_length,
        annual_value: customer.annual_value,
        total_contract_value: customer.total_contract_value,
        assigned_account_manager: customer.assigned_account_manager
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