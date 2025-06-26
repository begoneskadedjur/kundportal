// api/create-case.ts - Skapa nytt ärende i ClickUp + skicka email
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🔥 Create case request received:', JSON.stringify(req.body, null, 2))

    const { 
      customer_id, 
      title, 
      description, 
      priority, 
      pest_type, 
      case_type, 
      address, 
      phone 
    } = req.body

    // Validering
    if (!customer_id || !title || !description) {
      console.error('❌ Missing required fields:', { customer_id, title: !!title, description: !!description })
      return res.status(400).json({ error: 'customer_id, title och description krävs' })
    }

    console.log(`📋 Creating new case for customer: ${customer_id}`)

    // 1. Hämta kundinfo för ClickUp lista
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('company_name, contact_person, email, clickup_list_id, clickup_list_name')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      console.error('❌ Customer not found:', customerError)
      return res.status(404).json({ error: 'Kund hittades inte' })
    }

    console.log('✅ Customer found:', customer.company_name)

    // 2. Skapa task i ClickUp (förenklad version först)
    const clickupTaskData = {
      name: title,
      description: `${description}\n\n--- Kundinformation ---\nFöretag: ${customer.company_name}\nKontakt: ${customer.contact_person}\nEmail: ${customer.email}\nTelefon: ${phone || 'Ej angivet'}\nAdress: ${address || 'Ej angivet'}`,
      status: 'under hantering',
      priority: getPriorityValue(priority)
      // Ta bort custom_fields för nu för att isolera problemet
    }

    console.log('📤 Sending to ClickUp:', JSON.stringify(clickupTaskData, null, 2))

    const clickupResponse = await fetch(`https://api.clickup.com/api/v2/list/${customer.clickup_list_id}/task`, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(clickupTaskData)
    })

    const responseText = await clickupResponse.text()
    console.log('📥 ClickUp response status:', clickupResponse.status)
    console.log('📥 ClickUp response:', responseText)

    if (!clickupResponse.ok) {
      console.error('❌ ClickUp API error:', responseText)
      throw new Error(`ClickUp API fel: ${clickupResponse.status} - ${responseText}`)
    }

    let createdTask
    try {
      createdTask = JSON.parse(responseText)
    } catch (parseError) {
      console.error('❌ Failed to parse ClickUp response:', parseError)
      throw new Error('Kunde inte läsa svar från ClickUp')
    }

    console.log(`✅ Created ClickUp task: ${createdTask.id}`)

    // 3. Skicka email till arende@begone.se
    try {
      const emailSubject = `Nytt ärende från ${customer.company_name} - ${title}`
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #22c55e;">🆕 Nytt ärende skapat</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Ärendeinformation</h3>
            <p><strong>Titel:</strong> ${title}</p>
            <p><strong>Beskrivning:</strong> ${description}</p>
            <p><strong>Prioritet:</strong> ${priority || 'Normal'}</p>
            ${pest_type ? `<p><strong>Skadedjur:</strong> ${pest_type}</p>` : ''}
            ${case_type ? `<p><strong>Typ av ärende:</strong> ${case_type}</p>` : ''}
            ${address ? `<p><strong>Adress:</strong> ${address}</p>` : ''}
            ${phone ? `<p><strong>Telefon:</strong> ${phone}</p>` : ''}
          </div>

          <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Kundinformation</h3>
            <p><strong>Företag:</strong> ${customer.company_name}</p>
            <p><strong>Kontaktperson:</strong> ${customer.contact_person}</p>
            <p><strong>Email:</strong> ${customer.email}</p>
            <p><strong>ClickUp Lista:</strong> ${customer.clickup_list_name}</p>
          </div>

          <div style="margin: 30px 0; text-align: center;">
            <a href="https://app.clickup.com/t/${createdTask.id}" 
               style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              📋 Visa ärendet i ClickUp
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Detta ärende har automatiskt fått status "Under hantering" och din koordinator kommer att tilldelas via automation.
          </p>
        </div>
      `

      await transporter.sendMail({
        from: 'BeGone Kundportal <noreply@begone.se>',
        to: 'arende@begone.se',
        subject: emailSubject,
        html: emailHtml
      })

      console.log('✅ Email sent to arende@begone.se')
    } catch (emailError) {
      console.error('⚠️ Email sending failed (but task was created):', emailError)
      // Fortsätt ändå även om email misslyckas
    }

    // 4. Returnera framgång med task-info
    return res.status(200).json({
      success: true,
      message: 'Ärendet har skapats framgångsrikt',
      task: {
        id: createdTask.id,
        name: createdTask.name,
        url: createdTask.url || `https://app.clickup.com/t/${createdTask.id}`,
        status: 'under hantering'
      }
    })

  } catch (error: any) {
    console.error('❌ Create case error:', error)
    console.error('❌ Error stack:', error.stack)
    return res.status(500).json({ 
      error: 'Ett fel uppstod vid skapande av ärendet',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// Helper funktioner
function getPriorityValue(priority: string): number {
  switch (priority?.toLowerCase()) {
    case 'urgent': return 1
    case 'high': return 2
    case 'normal': return 3
    case 'low': return 4
    default: return 3
  }
}

function buildCustomFields(pest_type?: string, case_type?: string, address?: string, phone?: string) {
  // Ta bort custom fields för nu tills vi vet field IDs
  // Returnera tom array för att undvika fel
  return []
  
  /* Aktivera när du har field IDs från ClickUp:
  const fields = []

  if (pest_type) {
    fields.push({
      id: 'PEST_TYPE_FIELD_ID', // Ersätt med verkligt field ID
      value: pest_type
    })
  }

  if (case_type) {
    fields.push({
      id: 'CASE_TYPE_FIELD_ID', // Ersätt med verkligt field ID
      value: case_type
    })
  }

  if (address) {
    fields.push({
      id: 'ADDRESS_FIELD_ID', // Ersätt med verkligt field ID
      value: address
    })
  }

  return fields
  */
}