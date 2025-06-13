import { VercelRequest, VercelResponse } from '@vercel/node'
// FIX 1: Lade till .js på slutet av importerna
import { clickupService } from '../../src/lib/clickup.js'
import { supabaseAdminService } from '../../src/lib/supabase-admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const webhookData = req.body
    console.log('ClickUp webhook received:', JSON.stringify(webhookData, null, 2))

    const taskId = webhookData.task_id
    const eventType = webhookData.event
    
    if (!taskId) {
      console.log('No task_id in webhook, ignoring')
      return res.status(200).json({ message: 'No task_id, ignored' })
    }

    console.log(`Processing webhook: ${eventType} for task ${taskId}`)

    // Handle different webhook events
    switch (eventType) {
      case 'taskCreated':
      case 'taskUpdated':
      case 'taskMoved':
      case 'taskStatusUpdated':
      case 'taskPriorityUpdated':
      case 'taskDueDateUpdated':
        await handleTaskUpdate(taskId)
        break
        
      case 'taskDeleted':
        await handleTaskDeleted(taskId)
        break
        
      default:
        console.log(`Unhandled webhook event: ${eventType}`)
        return res.status(200).json({ message: `Event ${eventType} ignored` })
    }

    res.status(200).json({ 
      success: true, 
      message: `Processed ${eventType} for task ${taskId}`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Webhook error:', error)
    
    // FIX 2: Hantera 'unknown' typ för error-objektet
    let errorMessage = 'An unknown webhook error occurred.'
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

async function handleTaskUpdate(taskId: string) {
  try {
    console.log(`Updating task ${taskId} from webhook`)
    
    const clickupTask = await clickupService.getTask(taskId)
    
    if (!clickupTask) {
      console.log(`Task ${taskId} not found in ClickUp`)
      return
    }

    const transformedTask = clickupService.transformTask(clickupTask)
    
    if (!transformedTask.clickup_list_name) {
      console.log(`Task ${taskId} has no list name, skipping`)
      return
    }

    const customer = await supabaseAdminService.findCustomerByListName(transformedTask.clickup_list_name)
    
    if (!customer) {
      console.log(`No customer found for list: ${transformedTask.clickup_list_name}`)
      return
    }

    console.log(`Found customer: ${customer.company_name}`)

    const existingCase = await supabaseAdminService.findExistingCase(taskId)

    if (existingCase) {
      await supabaseAdminService.updateCase(existingCase.id, transformedTask)
      console.log(`Updated case from webhook: ${transformedTask.title}`)
    } else {
      await supabaseAdminService.createCase({
        ...transformedTask,
        customer_id: customer.id
      })
      console.log(`Created case from webhook: ${transformedTask.title}`)
    }

  } catch (error) {
    console.error(`Error handling task update for ${taskId}:`, error)
    // Felet kastas vidare för att fångas av den yttre catch-blocket
    throw error
  }
}

async function handleTaskDeleted(taskId: string) {
  try {
    console.log(`Handling deletion for task ${taskId}`)
    
    const existingCase = await supabaseAdminService.findExistingCase(taskId)
    
    if (existingCase) {
      // Markera som raderad
      await supabaseAdminService.updateCase(existingCase.id, {
        status: 'deleted' as any, // 'as any' för att tillåta en custom status
        updated_at: new Date().toISOString()
      })
      
      console.log(`Marked case as deleted: ${existingCase.id}`)
    } else {
      console.log(`No case found for deleted task ${taskId}`)
    }

  } catch (error) {
    console.error(`Error handling task deletion for ${taskId}:`, error)
    // Felet kastas vidare
    throw error
  }
}