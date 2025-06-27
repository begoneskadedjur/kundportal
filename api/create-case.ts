// api/create-case.ts - REN API för att skapa ärenden (INGEN JSX)
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
      priority = 'low', 
      pest_type = '', 
      case_type = 'bekämpning', 
      address = '', 
      phone = '' 
    } = req.body

    // Validate required fields
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

    // 2. Mappa prioritet till ClickUp format
    const clickupPriority = mapPriorityToClickUp(priority)
    
    // 3. Generera case number (enkel implementation)
    const caseNumber = `${customer.company_name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

    // 4. Skapa task i ClickUp
    console.log('Creating ClickUp task...')
    const clickupTaskData = {
      name: title,
      description: description,
      priority: clickupPriority,
      status: 'att göra', // Default status för nya ärenden
      custom_fields: []
    }

    // Lägg till custom fields om de finns
    const customFieldIds = await getCustomFieldIds(customer.clickup_list_id)
    
    if (pest_type && customFieldIds.pest_type) {
      clickupTaskData.custom_fields.push({
        id: customFieldIds.pest_type,
        value: pest_type
      })
    }

    if (case_type && customFieldIds.case_type) {
      clickupTaskData.custom_fields.push({
        id: customFieldIds.case_type,
        value: case_type
      })
    }

    if (address && customFieldIds.address) {
      clickupTaskData.custom_fields.push({
        id: customFieldIds.address,
        value: address
      })
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
      console.error('ClickUp API error:', errorData)
      throw new Error(`ClickUp API fel: ${clickupResponse.status} ${clickupResponse.statusText}`)
    }

    const clickupTask = await clickupResponse.json()
    console.log('ClickUp task created:', { id: clickupTask.id, name: clickupTask.name })

    // 5. Skapa case i databas (webhook kommer synka senare, men vi skapar en initial post)
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
      } catch (cleanupError) {
        console.error('Failed to cleanup ClickUp task:', cleanupError)
      }
      throw new Error(`Kunde inte skapa ärende: ${caseError.message}`)
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
        clickup_task_id: clickupTask.id,
        clickup_url: clickupTask.url
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
  const priorityMap: { [key: string]: number } = {
    'urgent': 1,
    'high': 2, 
    'normal': 3,
    'low': 4
  }
  return priorityMap[priority] || 4
}

async function getCustomFieldIds(listId: string): Promise<{[key: string]: string}> {
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch custom fields for list ${listId}`)
      return {}
    }

    const data = await response.json()
    const fields = data.fields || []
    
    const fieldMap: {[key: string]: string} = {}
    
    fields.forEach((field: any) => {
      const fieldName = field.name.toLowerCase()
      
      if (fieldName.includes('skadedjur') || fieldName.includes('pest')) {
        fieldMap.pest_type = field.id
      } else if (fieldName.includes('ärende') || fieldName.includes('case') || fieldName.includes('type')) {
        fieldMap.case_type = field.id
      } else if (fieldName.includes('adress') || fieldName.includes('address')) {
        fieldMap.address = field.id
      }
    })

    console.log('Found custom field IDs:', fieldMap)
    return fieldMap

  } catch (error) {
    console.error('Error fetching custom field IDs:', error)
    return {}
  }
}