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
const transporter = nodemailer.createTransport({
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

  try {
    const { customerData } = req.body

    if (!customerData) {
      return res.status(400).json({ error: 'Customer data required' })
    }

    // 1. Kontrollera om kunden redan finns
    const { data: existingCustomerByEmail } = await supabase
      .from('customers')
      .select('id, company_name, email')
      .eq('email', customerData.email)
      .single()

    if (existingCustomerByEmail) {
      return res.status(400).json({ 
        error: `En kund med e-postadressen ${customerData.email} finns redan registrerad.` 
      })
    }

    // Kontrollera också om företagsnamnet redan finns
    const { data: existingCustomerByName } = await supabase
      .from('customers')
      .select('id, company_name, email')
      .eq('company_name', customerData.company_name)
      .single()

    if (existingCustomerByName) {
      return res.status(400).json({ 
        error: `Företaget ${customerData.company_name} finns redan registrerat med e-post: ${existingCustomerByName.email}` 
      })
    }

    // 2. Hämta avtalstyp för ClickUp folder ID
    const { data: contractType, error: contractError } = await supabase
      .from('contract_types')
      .select('clickup_folder_id, name')
      .eq('id', customerData.contract_type_id)
      .single()

    if (contractError || !contractType) {
      throw new Error('Kunde inte hämta avtalstyp')
    }

    // 3. Skapa ClickUp lista
    const clickupResponse = await fetch(
      `https://api.clickup.com/api/v2/folder/${contractType.clickup_folder_id}/list`,
      {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customerData.company_name,
          content: `Kundlista för ${customerData.company_name}`,
          due_date: null,
          due_date_time: false,
          priority: 3
        })
      }
    )

    if (!clickupResponse.ok) {
      const errorData = await clickupResponse.text()
      console.error('ClickUp API error:', errorData)
      
      // Kontrollera om det är ett "namn upptaget" fel
      if (errorData.includes('SUBCAT_016') || errorData.includes('List name taken')) {
        throw new Error(`En ClickUp-lista med namnet "${customerData.company_name}" finns redan. Kontrollera om kunden redan är registrerad.`)
      }
      
      throw new Error('Kunde inte skapa ClickUp lista')
    }

    const clickupList = await clickupResponse.json()

    // 4. Skapa kund i databasen
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        ...customerData,
        clickup_list_id: clickupList.id,
        clickup_list_name: clickupList.name,
        is_active: true
      })
      .select()
      .single()

    if (customerError) {
      console.error('Customer creation error:', customerError)
      throw customerError
    }

    // 5. Skapa användarkonto
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: customerData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        company_name: customerData.company_name,
        contact_person: customerData.contact_person
      }
    })

    if (authError) {
      // Om användarskapande misslyckas, ta bort kunden
      await supabase.from('customers').delete().eq('id', customer.id)
      throw authError
    }

    // 6. Skapa profil
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        user_id: authData.user.id,
        email: customerData.email,
        customer_id: customer.id,
        is_admin: false,
        is_active: true
      })

    if (profileError) {
      // Rollback om profil inte kan skapas
      await supabase.auth.admin.deleteUser(authData.user.id)
      await supabase.from('customers').delete().eq('id', customer.id)
      throw profileError
    }

    // 7. Skicka välkomstmail
    const resetLink = `${BASE_URL}/set-password?token=${tempPassword}&email=${encodeURIComponent(customerData.email)}`

    const mailOptions = {
      from: 'BeGone Kundportal <noreply@begone.se>',
      to: customerData.email,
      subject: 'Välkommen till BeGone Kundportal',
      html: `
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
              <h1>Välkommen till BeGone Kundportal!</h1>
            </div>
            <div class="content">
              <p>Hej ${customerData.contact_person},</p>
              
              <p>Ditt företag ${customerData.company_name} har nu tillgång till BeGone Kundportal där ni kan:</p>
              
              <ul>
                <li>Se alla era aktiva ärenden</li>
                <li>Följa status på pågående uppdrag</li>
                <li>Se kommande besök</li>
                <li>Ta del av besöksrapporter</li>
              </ul>
              
              <p><strong>För att komma igång behöver du sätta ett lösenord:</strong></p>
              
              <p style="text-align: center;">
                <a href="${resetLink}" class="button">Sätt lösenord och logga in</a>
              </p>
              
              <p><strong>Dina inloggningsuppgifter:</strong><br>
              E-post: ${customerData.email}<br>
              Temporärt lösenord: ${tempPassword}</p>
              
              <p><em>OBS: Länken är giltig i 24 timmar. Efter det behöver du begära en ny.</em></p>
              
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

    await transporter.sendMail(mailOptions)

    // 8. Returnera framgång
    return res.status(200).json({
      success: true,
      customer: {
        id: customer.id,
        company_name: customer.company_name,
        email: customer.email,
        clickup_list_id: customer.clickup_list_id
      }
    })

  } catch (error: any) {
    console.error('API Error:', error)
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skapande av kund'
    })
  }
}