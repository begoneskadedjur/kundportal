// api/delete-clickup-list.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    console.log('=== DELETE CLICKUP LIST API START ===')
    
    const { customerId, listId, archiveOnly = false, reason } = req.body
    console.log('Delete ClickUp list request:', { customerId, listId, archiveOnly, reason })

    // 1. Validera inkommande data
    if (!customerId || !listId) {
      return res.status(400).json({ error: 'customerId och listId är obligatoriska' })
    }

    // 2. Kontrollera att kunden existerar och har denna ClickUp lista
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, company_name, clickup_list_id, clickup_list_name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('Customer not found:', customerError)
      return res.status(404).json({ error: 'Kund hittades inte' })
    }

    if (customer.clickup_list_id !== listId) {
      return res.status(400).json({ 
        error: 'ClickUp lista-ID matchar inte kundens registrerade lista',
        details: `Kund har lista: ${customer.clickup_list_id}, begärd: ${listId}`
      })
    }

    if (!customer.clickup_list_id) {
      return res.status(400).json({ error: 'Kunden har ingen ClickUp lista att ta bort' })
    }

    console.log(`Deleting ClickUp list: ${customer.clickup_list_name} (${listId})`)

    // 3. Kontrollera om listan har aktiva tasks (valfri säkerhetskontroll)
    try {
      const tasksResponse = await fetch(
        `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=false`,
        {
          headers: { 'Authorization': CLICKUP_API_TOKEN }
        }
      )

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        const activeTasks = tasksData.tasks || []
        
        if (activeTasks.length > 0) {
          console.log(`Warning: List has ${activeTasks.length} active tasks`)
          
          // Om det finns aktiva tasks, ge användaren information
          if (!archiveOnly && !reason?.includes('force')) {
            return res.status(400).json({
              error: `Listan innehåller ${activeTasks.length} aktiva ärenden`,
              details: 'Alla ärenden kommer att försvinna permanent om du fortsätter',
              suggestion: 'Lägg till "force" i reason för att fortsätta ändå',
              activeTasks: activeTasks.slice(0, 5).map((task: any) => ({
                id: task.id,
                name: task.name,
                status: task.status?.status
              }))
            })
          }
        }
      }
    } catch (taskCheckError) {
      console.error('Could not check tasks (non-critical):', taskCheckError)
      // Fortsätt ändå - detta är bara en säkerhetskontroll
    }

    // 4. Ta bort ClickUp lista
    const deleteResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.text()
      console.error('ClickUp delete API error:', errorData)
      
      // Hantera specifika ClickUp fel
      if (deleteResponse.status === 404) {
        console.log('ClickUp list already deleted or not found')
        // Fortsätt ändå för att rensa database-referensen
      } else if (deleteResponse.status === 403) {
        return res.status(403).json({ 
          error: 'Ingen behörighet att ta bort denna ClickUp lista',
          details: 'Kontrollera API-token behörigheter'
        })
      } else {
        return res.status(500).json({ 
          error: `ClickUp API fel: ${deleteResponse.status}`,
          details: errorData.substring(0, 200)
        })
      }
    } else {
      console.log('ClickUp list deleted successfully from ClickUp')
    }

    // 5. Rensa ClickUp lista-referenser från databasen
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({
        clickup_list_id: null,
        clickup_list_name: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId)
      .select()
      .single()

    if (updateError) {
      console.error('Customer update error:', updateError)
      return res.status(500).json({ 
        error: 'ClickUp lista borttagen men kunde inte uppdatera databas',
        details: 'Kontakta support för manuell databasrensning'
      })
    }

    console.log('Customer database references cleared successfully')

    // 6. Rensa eventuella relaterade cases/tasks från lokal databas (valfritt)
    try {
      const { error: casesError } = await supabase
        .from('cases')
        .delete()
        .eq('customer_id', customerId)

      if (casesError) {
        console.error('Could not delete related cases (non-critical):', casesError)
        // Detta är inte kritiskt - ärenden kan behållas för historik
      } else {
        console.log('Related cases cleaned up from database')
      }
    } catch (casesCleanupError) {
      console.error('Cases cleanup error (non-critical):', casesCleanupError)
    }

    // 7. Logga borttagning (för framtida analytics och audit trail)
    try {
      // Här kan du lägga till logging till en activity_log tabell
      console.log(`ClickUp list deleted: Customer ${customerId}, List ${listId}, Reason: ${reason || 'manual'}`)
    } catch (logError) {
      console.error('Logging error (non-critical):', logError)
    }

    return res.status(200).json({
      success: true,
      message: 'ClickUp lista borttagen framgångsrikt',
      deletedList: {
        id: listId,
        name: customer.clickup_list_name,
        customerName: customer.company_name
      },
      customer: {
        id: updatedCustomer.id,
        company_name: updatedCustomer.company_name,
        clickup_list_id: updatedCustomer.clickup_list_id,
        clickup_list_name: updatedCustomer.clickup_list_name
      },
      cleanupPerformed: {
        clickupList: true,
        databaseReferences: true,
        relatedCases: true
      }
    })

  } catch (error: any) {
    console.error('=== DELETE CLICKUP LIST API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid borttagning av ClickUp lista'
    })
  }
}