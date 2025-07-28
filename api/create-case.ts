// api/create-case.ts - FIXAD VERSION som tar bort felaktiga custom fields
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ClickUp configuration
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('=== CREATE CASE API START ===')
  console.log('Request body:', JSON.stringify(req.body, null, 2))

  try {
    const { 
      customer_id, 
      title, 
      description, 
      priority = 'normal',
      pest_type = '', 
      case_type = '', 
      address = '', 
      phone = '',
      assigned_technician_email = ''
    } = req.body

    // Validera required fields
    if (!customer_id || !title || !description) {
      return res.status(400).json({ 
        error: 'customer_id, title och description är obligatoriska' 
      })
    }

    // 1. Hämta kund info för ClickUp list
    console.log('Fetching customer info for ID:', customer_id)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        company_name,
        contact_person,
        email,
        clickup_list_id,
        clickup_list_name,
        contract_types (
          name
        )
      `)
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      console.error('Customer fetch error:', customerError)
      return res.status(400).json({ error: 'Kunde inte hitta kund' })
    }

    if (!customer.clickup_list_id) {
      console.error('Customer missing ClickUp list ID')
      return res.status(400).json({ error: 'Kund saknar ClickUp lista' })
    }

    // 2. Hämta tekniker-info om tilldelad
    let assignedTechnician = null
    if (assigned_technician_email) {
      console.log('Fetching technician info for email:', assigned_technician_email)
      const { data: technicianData, error: technicianError } = await supabase
        .from('technicians')
        .select('id, name, email, direct_phone, role')
        .eq('email', assigned_technician_email)
        .eq('is_active', true)
        .single()

      if (technicianError) {
        console.error('Technician fetch error:', technicianError)
        // Fortsätt utan tekniker-tilldelning istället för att stoppa
      } else {
        assignedTechnician = technicianData
        console.log('Technician found:', assignedTechnician.name)
      }
    }

    console.log('Customer found:', {
      company: customer.company_name,
      clickup_list: customer.clickup_list_id,
      assigned_technician: assignedTechnician?.name || 'Ingen tilldelad'
    })

    // 3. Generera case number
    const caseNumber = `${customer.company_name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

    // 4. Förbered beskrivning med extra info
    let fullDescription = description
    if (pest_type) fullDescription += `\n\n🐛 Skadedjurstyp: ${pest_type}`
    if (case_type) fullDescription += `\n📋 Ärendetyp: ${case_type}`
    if (address) fullDescription += `\n📍 Adress: ${address}`
    if (phone) fullDescription += `\n📞 Kontakttelefon: ${phone}`
    if (assignedTechnician) {
      fullDescription += `\n👤 Tilldelad tekniker: ${assignedTechnician.name} (${assignedTechnician.email})`
    }

    // 5. Skapa task i ClickUp - FIXAD VERSION utan felaktiga custom fields
    console.log('Creating ClickUp task...')
    const clickupPayload = {
      name: `${caseNumber}: ${title}`,
      description: fullDescription,
      status: 'bokad', // Sätt alla nya ärenden till status "bokad"
      priority: priority === 'urgent' ? 1 : priority === 'high' ? 2 : priority === 'normal' ? 3 : 4
      // TA BORT CUSTOM FIELDS TILLS VI HAR RÄTT IDs
      // custom_fields: [] - Kommenterat ut för att förhindra fel
    }

    const clickupResponse = await fetch(`https://api.clickup.com/api/v2/list/${customer.clickup_list_id}/task`, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(clickupPayload)
    })

    if (!clickupResponse.ok) {
      const errorText = await clickupResponse.text()
      console.error('ClickUp task creation failed:', errorText)
      console.error('Failed payload:', JSON.stringify(clickupPayload, null, 2))
      throw new Error(`ClickUp API error: ${clickupResponse.status} - ${errorText}`)
    }

    const clickupTask = await clickupResponse.json()
    console.log('ClickUp task created:', clickupTask.id)

    // 6. Skapa case i databas med tekniker-info
    console.log('Creating case in database...')
    const caseData = {
      customer_id: customer_id,
      clickup_task_id: clickupTask.id,
      case_number: caseNumber,
      title: title,
      description: description,
      status: 'open',
      priority: priority,
      pest_type: pest_type || null,
      case_type: case_type || null,
      address_formatted: address || null,
      // Tekniker-info
      assigned_technician_id: assignedTechnician?.id || null,
      assigned_technician_name: assignedTechnician?.name || null,
      assigned_technician_email: assignedTechnician?.email || null,
      created_at: new Date().toISOString()
    }

    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert(caseData)
      .select()
      .single()

    if (caseError) {
      console.error('Database case creation error:', caseError)
      // Cleanup ClickUp task vid fel
      try {
        await fetch(`https://api.clickup.com/api/v2/task/${clickupTask.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': CLICKUP_API_TOKEN }
        })
      } catch (cleanupError) {
        console.error('Failed to cleanup ClickUp task:', cleanupError)
      }
      throw new Error(`Kunde inte skapa ärende i databas: ${caseError.message}`)
    }

    console.log('Case created successfully:', newCase.id)
    console.log('=== CREATE CASE API SUCCESS ===')
    
    return res.status(200).json({
      success: true,
      case: {
        id: newCase.id,
        case_number: newCase.case_number,
        title: newCase.title,
        status: newCase.status,
        priority: newCase.priority,
        assigned_technician: assignedTechnician ? {
          id: assignedTechnician.id,
          name: assignedTechnician.name,
          email: assignedTechnician.email
        } : null,
        clickup_task_id: clickupTask.id,
        clickup_url: clickupTask.url || `https://app.clickup.com/t/${clickupTask.id}`
      }
    })

  } catch (error: any) {
    console.error('=== CREATE CASE API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skapande av ärende'
    })
  }
}