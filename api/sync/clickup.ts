import { VercelRequest, VercelResponse } from '@vercel/node'
import { clickupService } from '../../src/lib/clickup.js'
import { supabaseAdminService } from '../../src/lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { customerId } = req.body

  if (!customerId) {
    return res.status(400).json({ error: 'Missing customerId in request body' })
  }

  try {
    // Hämta kundens ClickUp list ID från databasen
    const { data: customer, error: customerError } = await supabaseAdminService.supabase
      .from('customers')
      .select('id, company_name, clickup_list_id')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    if (!customer.clickup_list_id) {
      return res.status(400).json({ error: 'Customer has no ClickUp list assigned' })
    }

    console.log(`Starting sync for customer ${customer.company_name} (${customer.id}), list ID: ${customer.clickup_list_id}`)
    
    // Hämta tasks från ClickUp
    const clickupTasks = await clickupService.getTasks(customer.clickup_list_id)
    console.log(`Fetched ${clickupTasks.length} tasks from ClickUp`)

    let createdCount = 0
    let updatedCount = 0
    let errors: { taskId: string; taskName: string; error: string }[] = []

    // Synka varje task
    for (const clickupTask of clickupTasks) {
      try {
        const transformedTask = clickupService.transformTask(clickupTask)
        
        // Kolla om ärendet redan finns
        const existingCase = await supabaseAdminService.findExistingCase(clickupTask.id)

        if (existingCase) {
          // Uppdatera befintligt ärende
          await supabaseAdminService.updateCase(existingCase.id, transformedTask)
          updatedCount++
          console.log(`Updated case: ${transformedTask.title}`)
        } else {
          // Skapa nytt ärende
          await supabaseAdminService.createCase({
            ...transformedTask,
            customer_id: customer.id
          })
          createdCount++
          console.log(`Created new case: ${transformedTask.title}`)
        }

      } catch (taskError) {
        console.error(`Error processing task ${clickupTask.id}:`, taskError)
        
        let errorMessage = 'An unknown error occurred while processing a task.'
        if (taskError instanceof Error) {
          errorMessage = taskError.message
        }
        
        errors.push({
          taskId: clickupTask.id,
          taskName: clickupTask.name || 'Unknown',
          error: errorMessage
        })
      }
    }

    const summary = {
      success: true,
      customerId: customer.id,
      customerName: customer.company_name,
      listId: customer.clickup_list_id,
      totalTasks: clickupTasks.length,
      created: createdCount,
      updated: updatedCount,
      errors: errors.length,
      errorDetails: errors
    }

    console.log('Sync completed:', summary)
    return res.status(200).json(summary)

  } catch (error) {
    console.error('Sync error:', error)
    
    let errorMessage = 'An unknown error occurred during sync.'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return res.status(500).json({ 
      success: false, 
      error: errorMessage 
    })
  }
}