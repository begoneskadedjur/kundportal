// api/create-clickup-list.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

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
    console.log('=== CREATE CLICKUP LIST API START ===')
    
    const { customerId, companyName, orgNumber, contractTypeId } = req.body
    console.log('Create ClickUp list request:', { customerId, companyName, orgNumber, contractTypeId })

    // 1. Validera inkommande data
    if (!customerId || !companyName || !contractTypeId) {
      return res.status(400).json({ error: 'customerId, companyName och contractTypeId är obligatoriska' })
    }

    // 2. Kontrollera att kunden existerar och inte redan har en ClickUp lista
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, company_name, clickup_list_id, clickup_list_name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('Customer not found:', customerError)
      return res.status(404).json({ error: 'Kund hittades inte' })
    }

    if (customer.clickup_list_id) {
      return res.status(400).json({ 
        error: 'Kunden har redan en ClickUp lista',
        details: `Befintlig lista: ${customer.clickup_list_name}`
      })
    }

    // 3. Hämta avtalstyp för att få folder ID
    const { data: contractType, error: contractError } = await supabase
      .from('contract_types')
      .select('id, name, clickup_folder_id')
      .eq('id', contractTypeId)
      .eq('is_active', true)
      .single()

    if (contractError || !contractType) {
      console.error('Contract type not found:', contractError)
      return res.status(404).json({ error: 'Avtalstyp hittades inte eller är inaktiv' })
    }

    if (!contractType.clickup_folder_id) {
      return res.status(400).json({ error: 'Avtalstypen saknar ClickUp folder ID' })
    }

    console.log('Contract type found:', contractType.name, 'Folder ID:', contractType.clickup_folder_id)

    // 4. Skapa unikt listnamn
    const uniqueListName = orgNumber 
      ? `${companyName} - ${orgNumber}` 
      : `${companyName} - ${contractType.name}`
    
    console.log('Creating ClickUp list with name:', uniqueListName)

    // 5. Skapa ClickUp lista via API
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
          content: `Kundlista för ${companyName}${orgNumber ? ` (${orgNumber})` : ''}\nAvtalstyp: ${contractType.name}\nSkapad manuellt via admin-portal`,
          due_date: null,
          due_date_time: false,
          priority: 3,
          assignee: null,
          status: 'active'
        })
      }
    )

    if (!clickupResponse.ok) {
      const errorData = await clickupResponse.text()
      console.error('ClickUp API error:', errorData)
      
      // Hantera specifika ClickUp fel
      if (errorData.includes('SUBCAT_016') || errorData.includes('List name taken')) {
        return res.status(400).json({ 
          error: `En ClickUp-lista med namnet "${uniqueListName}" finns redan i denna folder`,
          suggestion: 'Prova att lägga till något unikt i företagsnamnet eller välj annan avtalstyp'
        })
      }
      
      if (errorData.includes('FOLDER_NOT_FOUND')) {
        return res.status(400).json({ 
          error: 'ClickUp folder hittades inte',
          details: `Folder ID: ${contractType.clickup_folder_id}`
        })
      }
      
      return res.status(500).json({ 
        error: `ClickUp API fel: ${clickupResponse.status}`,
        details: errorData.substring(0, 200) // Begränsa felmeddelandet
      })
    }

    const clickupList = await clickupResponse.json()
    console.log('ClickUp list created successfully:', { id: clickupList.id, name: clickupList.name })

    // 6. Uppdatera kunden med nya ClickUp lista-uppgifter
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({
        clickup_list_id: clickupList.id,
        clickup_list_name: clickupList.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId)
      .select()
      .single()

    if (updateError) {
      console.error('Customer update error:', updateError)
      
      // Försök ta bort ClickUp-listan vid databasfel
      try {
        await fetch(`https://api.clickup.com/api/v2/list/${clickupList.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': CLICKUP_API_TOKEN }
        })
        console.log('Cleaned up ClickUp list after database error')
      } catch (cleanupError) {
        console.error('Failed to cleanup ClickUp list:', cleanupError)
      }
      
      return res.status(500).json({ error: 'Kunde inte uppdatera kund med ClickUp lista-information' })
    }

    console.log('Customer updated successfully with ClickUp list info')

    // 7. Logga framgångsrik skapande (för framtida analytics)
    try {
      // Här kan du lägga till logging till en activity_log tabell
      console.log(`ClickUp list created: Customer ${customerId}, List ${clickupList.id}`)
    } catch (logError) {
      console.error('Logging error (non-critical):', logError)
    }

    return res.status(200).json({
      success: true,
      message: 'ClickUp lista skapad framgångsrikt',
      clickupList: {
        id: clickupList.id,
        name: clickupList.name,
        url: clickupList.url || `https://app.clickup.com/t/${clickupList.id}`
      },
      customer: {
        id: updatedCustomer.id,
        company_name: updatedCustomer.company_name,
        clickup_list_id: updatedCustomer.clickup_list_id,
        clickup_list_name: updatedCustomer.clickup_list_name
      }
    })

  } catch (error: any) {
    console.error('=== CREATE CLICKUP LIST API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skapande av ClickUp lista'
    })
  }
}