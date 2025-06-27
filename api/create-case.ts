// api/create-case.ts - FIXAD VERSION baserad på CreateCaseModal
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
      priority = 'normal',  // Matchar din modal default
      pest_type = '', 
      case_type = '', 
      address = '', 
      phone = '' 
    } = req.body

    // Validera required fields (samma som din modal)
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

    console.log('Customer found:', {
      company: customer.company_name,
      clickup_list: customer.clickup_list_id
    })

    // 2. Mappa prioritet till ClickUp format (baserat på din modal)
    const clickupPriority = mapPriorityToClickUp(priority)
    
    // 3. Generera case number
    const caseNumber = `${customer.company_name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

    // 4. Förbered beskrivning med extra info
    let fullDescription = description
    if (pest_type) {
      fullDescription += `\n\nSkadedjurstyp: ${pest_type}`
    }
    if (case_type) {
      fullDescription += `\nÄrendetyp: ${case_type}`
    }
    if (address) {
      fullDescription += `\nAdress: ${address}`
    }
    if (phone) {
      fullDescription += `\nKontakttelefon: ${phone}`
    }

    // 5. Skapa task i ClickUp (enklare struktur för att undvika 400-fel)
    console.log('Creating ClickUp task...')
    const clickupTaskData = {
      name: title,
      description: fullDescription,
      priority: clickupPriority,
      // Ta bort custom_fields tillfälligt för att undvika 400-fel
      // Vi kan lägga till dem senare när vi vet vilka fields som finns
    }

    console.log('ClickUp task data:', clickupTaskData)

    const clickupResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${customer.clickup_list_id}/task`,
      {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clickupTaskData)
      }
    )

    if (!clickupResponse.ok) {
      const errorData = await clickupResponse.text()
      console.error('ClickUp API error:', {
        status: clickupResponse.status,
        statusText: clickupResponse.statusText,
        body: errorData
      })
      
      // Ge mer specifik felmeddelande
      if (clickupResponse.status === 400) {
        throw new Error(`ClickUp API fel (400): Kontrollera att listan existerar och att API-token har rätt behörigheter. List ID: ${customer.clickup_list_id}`)
      } else {
        throw new Error(`ClickUp API fel: ${clickupResponse.status} ${clickupResponse.statusText}`)
      }
    }

    const clickupTask = await clickupResponse.json()
    console.log('ClickUp task created:', { id: clickupTask.id, name: clickupTask.name, url: clickupTask.url })

    // 6. Skapa case i databas
    console.log('Creating case in database...')
    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert({
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
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (caseError) {
      console.error('Database case creation error:', caseError)
      // Försök ta bort ClickUp task vid fel
      try {
        await fetch(`https://api.clickup.com/api/v2/task/${clickupTask.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': CLICKUP_API_TOKEN }
        })
        console.log('Cleaned up ClickUp task after database error')
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
        clickup_task_id: clickupTask.id,
        clickup_url: clickupTask.url || `https://app.clickup.com/t/${clickupTask.id}`
      }
    })

  } catch (error: any) {
    console.error('=== CREATE CASE API ERROR ===')
    console.error('Error:', error)
    console.error('Stack:', error.stack)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skapande av ärende'
    })
  }
}

// Hjälpfunktioner

function mapPriorityToClickUp(priority: string): number {
  // Matchar prioriteterna från din CreateCaseModal
  const priorityMap: { [key: string]: number } = {
    'urgent': 1,  // 🔴 Akut prioritet
    'high': 2,    // 🟠 Hög prioritet  
    'normal': 3,  // 🔹 Normal prioritet
    'low': 4      // 🔸 Låg prioritet
  }
  return priorityMap[priority] || 3 // Default till normal
}