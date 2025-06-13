import { VercelRequest, VercelResponse } from '@vercel/node'
// FIX 1: Lade till .js på slutet av importerna
import { clickupService } from '../../src/lib/clickup.js'
import { supabaseAdminService } from '../../src/lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { listId, customerName } = req.body

  if (!listId) {
    return res.status(400).json({ error: 'Missing listId in request body' })
  }

  try {
    console.log(`Starting sync for list ${listId}${customerName ? `, customer: ${customerName}` : ''}`)
    
    // 1. Fetch tasks from ClickUp
    const clickupTasks = await clickupService.getTasks(listId)
    console.log(`Fetched ${clickupTasks.length} tasks from ClickUp`)

    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0
    let errors: { taskId: string; taskName: string; error: string }[] = []

    // 2. Sync each task
    for (const clickupTask of clickupTasks) {
      try {
        const transformedTask = clickupService.transformTask(clickupTask)
        
        if (!transformedTask.clickup_list_name) {
          console.log(`Task ${clickupTask.id} has no list name, skipping`)
          skippedCount++
          continue
        }

        // 3. Find customer by ClickUp list name
        const customer = await supabaseAdminService.findCustomerByListName(transformedTask.clickup_list_name)
        
        if (!customer) {
          console.log(`No customer found for list: ${transformedTask.clickup_list_name}`)
          skippedCount++
          continue
        }

        console.log(`Found customer: ${customer.company_name} (${customer.id})`)

        // 4. Check if case already exists
        const existingCase = await supabaseAdminService.findExistingCase(clickupTask.id)

        if (existingCase) {
          // Update existing case
          await supabaseAdminService.updateCase(existingCase.id, transformedTask)
          updatedCount++
          console.log(`Updated case: ${transformedTask.title}`)
        } else {
          // Create new case
          await supabaseAdminService.createCase({
            ...transformedTask,
            customer_id: customer.id
          })
          createdCount++
          console.log(`Created new case: ${transformedTask.title}`)
        }

      } catch (taskError) {
        console.error(`Error processing task ${clickupTask.id}:`, taskError)
        
        // FIX 2: Hantera 'unknown' typ för taskError
        let errorMessage = 'An unknown error occurred while processing a task.'
        if (taskError instanceof Error) {
            errorMessage = taskError.message;
        }

        errors.push({
          taskId: clickupTask.id,
          taskName: clickupTask.name,
          error: errorMessage
        })
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalTasks: clickupTasks.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length
      },
      message: `Sync completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`,
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('Sync completed:', result.summary)
    res.status(200).json(result)

  } catch (error) {
    console.error('Sync error:', error)
    
    // FIX 3: Hantera 'unknown' typ för det övergripande error-objektet
    let errorMessage = 'An unknown sync error occurred.'
    if (error instanceof Error) {
        errorMessage = error.message;
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    })
  }
}