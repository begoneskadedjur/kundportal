// api/clickup-webhook.ts - FINAL WORKING VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!
const CLICKUP_WEBHOOK_SECRET = process.env.CLICKUP_WEBHOOK_SECRET

interface ClickUpWebhookPayload {
  event: 'taskCreated' | 'taskUpdated' | 'taskDeleted' // m.fl.
  task_id: string
  list_id?: string // Kan vara undefined, särskilt vid 'taskUpdated'
  webhook_id: string
  history_items?: Array<{
    id: string
    type: number
    date: string
    field: string
    parent_id: string // Detta är oftast listans ID
    data: object
    source: null | any
    user: object
    before: any
    after: any
  }>
}

// VIKTIGT: Disable body parsing för att hantera raw data
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🔔 ClickUp Webhook received')

    const rawBody = await getRawBody(req)
    console.log('📦 Raw body received, length:', rawBody.length)

    let payload: ClickUpWebhookPayload
    
    try {
      payload = JSON.parse(rawBody)
      console.log('✅ Payload parsed successfully:', {
        event: payload.event,
        task_id: payload.task_id,
        list_id: payload.list_id, // Loggar det som kommer in från början
        webhook_id: payload.webhook_id
      })
      console.log('📄 Full payload:', JSON.stringify(payload, null, 2))
      
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError)
      console.error('Raw body content:', rawBody.substring(0, 500))
      return res.status(400).json({ error: 'Invalid JSON payload' })
    }

    if (!payload.event && rawBody.includes('test')) {
      console.log('🧪 Test webhook received from ClickUp')
      return res.status(200).json({ message: 'Test webhook received successfully' })
    }

    if (CLICKUP_WEBHOOK_SECRET) {
      const signature = req.headers['x-signature'] as string
      if (!verifyWebhookSignature(rawBody, signature, CLICKUP_WEBHOOK_SECRET)) {
        console.error('❌ Invalid webhook signature')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    const supportedEvents = ['taskCreated', 'taskUpdated', 'taskDeleted', 'taskStatusUpdated', 'taskAssigneeUpdated']
    if (!payload.event || !supportedEvents.includes(payload.event)) {
      console.log(`ℹ️ Ignoring event: ${payload.event || 'undefined'}`)
      return res.status(200).json({ message: `Event ${payload.event || 'undefined'} ignored` })
    }

    if (!payload.task_id) {
      console.error('❌ Missing task_id in webhook payload')
      return res.status(400).json({ error: 'Missing task_id' })
    }

    // *** NY ROBUST LOGIK FÖR ATT HANTERA LIST-ID ***
    let listId: string | undefined = payload.list_id;

    // Om list_id saknas på toppnivån (vanligt vid 'taskUpdated'), hämta från history_items
    if (!listId && payload.history_items && payload.history_items.length > 0) {
      // parent_id i det första history item är oftast listans ID.
      listId = payload.history_items[0].parent_id;
      console.log(`ℹ️ list_id saknades. Hittade parent_id i history_items: ${listId}`);
    }

    // Validera att vi nu har ett list-ID innan vi fortsätter
    if (!listId) {
      console.error(`❌ Kunde inte fastställa list_id för task ${payload.task_id}.`);
      // Vi returnerar 200 OK så att ClickUp inte försöker skicka igen.
      return res.status(200).json({ message: 'Kunde inte fastställa list_id, ignorerar.' });
    }
    // *** SLUT PÅ NY LOGIK ***


    // Kontrollera om tasken tillhör en kundlista (använder den nya, pålitliga `listId`-variabeln)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, company_name, clickup_list_id')
      .eq('clickup_list_id', listId) // Använder den nya variabeln här!
      .single()

    if (customerError || !customer) {
      console.log(`ℹ️ Task ${payload.task_id} is not in a customer list (list_id: ${listId})`)
      return res.status(200).json({ message: 'Not a customer task' })
    }

    console.log(`📋 Processing ${payload.event} for customer: ${customer.company_name}`)

    switch (payload.event) {
      case 'taskCreated':
      case 'taskUpdated':
        await syncTaskFromClickUp(payload.task_id, customer.id)
        break
      
      case 'taskDeleted':
        await handleTaskDeleted(payload.task_id, customer.id)
        break
    }

    return res.status(200).json({ 
      success: true, 
      message: `${payload.event} processed for customer ${customer.company_name}` 
    })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      debug: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Hjälpfunktion för att läsa raw body från request
async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    
    req.on('data', (chunk) => {
      data += chunk
    })
    
    req.on('end', () => {
      resolve(data)
    })
    
    req.on('error', (err) => {
      reject(err)
    })
  })
}

// Verifiera webhook-signatur från ClickUp
function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  
  return signature === expectedSignature
}

// Synkronisera task från ClickUp till vår databas
async function syncTaskFromClickUp(taskId: string, customerId: string) {
  try {
    console.log(`🔄 Syncing task ${taskId} for customer ${customerId}`)
    
    const taskData = await fetchClickUpTask(taskId)
    if (!taskData) {
      console.error(`❌ Could not fetch task ${taskId} from ClickUp`)
      return
    }

    console.log(`📋 Task data fetched:`, {
      id: taskData.id,
      name: taskData.name,
      status: taskData.status?.status,
      list_id: taskData.list?.id,
      custom_fields_count: taskData.custom_fields?.length || 0
    })

    const caseData = mapClickUpTaskToCaseData(taskData, customerId)
    
    console.log(`💾 Saving case data:`, {
      customer_id: caseData.customer_id,
      clickup_task_id: caseData.clickup_task_id,
      case_number: caseData.case_number,
      title: caseData.title,
      status: caseData.status
    })
    
    const { error } = await supabase
      .from('cases')
      .upsert(caseData, {
        onConflict: 'clickup_task_id'
      })

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    console.log(`✅ Successfully synced task ${taskId}`)
    
  } catch (error) {
    console.error(`❌ Error syncing task ${taskId}:`, error)
    throw error
  }
}

// Hämta task från ClickUp API
async function fetchClickUpTask(taskId: string) {
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`ClickUp API error: ${response.status} ${response.statusText}`, errorBody)
      return null
    }

    const data = await response.json()
    // Vissa API-endpoints returnerar datan direkt, andra under en "task"-nyckel.
    return data.task || data 
    
  } catch (error) {
    console.error('Error fetching task from ClickUp:', error)
    return null
  }
}

// Mappa ClickUp status till våra tillåtna värden
function mapStatusValue(clickupStatus: string | undefined): string {
  if (!clickupStatus) return 'open'
  
  const statusMap: { [key: string]: string } = {
    // ClickUp svenska statusar till engelska databas-värden
    'att göra': 'open',
    'under hantering': 'in_progress', 
    'bokat': 'in_progress',
    'pågående': 'in_progress',
    'slutförd': 'completed',
    'klar': 'completed',
    'avslutad': 'completed',
    'stängd': 'closed',
    'avbruten': 'closed',
    
    // Engelska ClickUp statusar
    'to do': 'open',
    'in progress': 'in_progress',
    'review': 'in_progress', 
    'done': 'completed',
    'complete': 'completed',
    'completed': 'completed',
    'closed': 'closed',
    'cancelled': 'closed',
    
    // Fallbacks
    'open': 'open',
    'pending': 'open'
  }
  
  return statusMap[clickupStatus.toLowerCase()] || 'open'
}

// Mappa ClickUp priority till våra tillåtna värden
function mapPriorityValue(clickupPriority: string | undefined): string {
  if (!clickupPriority) return 'low'
  
  const priorityMap: { [key: string]: string } = {
    'urgent': 'urgent',
    'high': 'high', 
    'normal': 'low',  // Mappa 'normal' till 'low' eftersom 'normal' inte är tillåtet
    'low': 'low',
    '1': 'urgent',
    '2': 'high',
    '3': 'low',
    '4': 'low'
  }
  
  return priorityMap[clickupPriority.toLowerCase()] || 'low'
}

// Mappa ClickUp task-data till vårt cases-format
function mapClickUpTaskToCaseData(taskData: any, customerId: string) {
  const getCustomField = (name: string) => {
    return taskData.custom_fields?.find((field: any) => 
      field.name.toLowerCase() === name.toLowerCase()
    )
  }

  const addressField = getCustomField('Adress')
  const pestField = getCustomField('Skadedjur')
  const caseTypeField = getCustomField('Ärende')
  const priceField = getCustomField('Pris')
  const reportField = getCustomField('Rapport')
  const filesField = getCustomField('Filer')

  const getDropdownText = (field: any) => {
    if (!field) {
      console.log('🔍 Field is null/undefined')
      return null
    }
    
    console.log('🔍 Processing dropdown field:', {
      name: field.name,
      type: field.type,
      has_value: !!field.value,
      value: field.value,
      type_config: field.type_config
    })
    
    if (!field.value) return null
    
    // Olika sätt att hantera dropdown-värden
    if (field.type_config?.options) {
      console.log('🔍 Options found:', field.type_config.options)
      
      // Försök matcha med orderindex
      let option = field.type_config.options.find((opt: any) => 
        opt.orderindex === field.value
      )
      
      // Om orderindex inte fungerar, försök matcha med ID eller namn
      if (!option) {
        option = field.type_config.options.find((opt: any) => 
          opt.id === field.value || opt.name === field.value
        )
      }
      
      console.log('🔍 Matched option:', option)
      return option?.name || field.value?.toString()
    }
    
    // Fallback för andra dropdown-typer
    return field.value?.toString()
  }

  const assignee = taskData.assignees?.[0]

  return {
    customer_id: customerId,
    clickup_task_id: taskData.id,
    case_number: taskData.custom_id || taskData.id,
    title: taskData.name,
    status: mapStatusValue(taskData.status?.status || taskData.status), // FIX: Använd status-mappning
    priority: mapPriorityValue(taskData.priority?.priority), // FIX: Använd mappningsfunktionen
    pest_type: getDropdownText(pestField),
    case_type: getDropdownText(caseTypeField),
    description: taskData.description || '',
    
    address_formatted: addressField?.value?.formatted_address || null,
    address_lat: addressField?.value?.location?.lat || null,
    address_lng: addressField?.value?.location?.lng || null,
    
    price: priceField?.value !== undefined ? priceField.value : null,
    technician_report: reportField?.value || null,
    
    files: filesField?.value && Array.isArray(filesField.value) 
      ? JSON.stringify(filesField.value) 
      : null,
    
    assigned_technician_name: assignee?.username || null,
    assigned_technician_email: assignee?.email || null,
    
    created_date: new Date(parseInt(taskData.date_created)).toISOString(),
    scheduled_date: taskData.due_date ? new Date(parseInt(taskData.due_date)).toISOString() : null,
    completed_date: taskData.date_closed ? new Date(parseInt(taskData.date_closed)).toISOString() : null,
    
    updated_at: new Date().toISOString()
  }
}

// Hantera när en task tas bort
async function handleTaskDeleted(taskId: string, customerId: string) {
  console.log(`🗑️ Handling deleted task ${taskId}`)
  
  const { error } = await supabase
    .from('cases')
    .update({ 
      status: 'deleted',
      updated_at: new Date().toISOString()
    })
    .eq('clickup_task_id', taskId)
    .eq('customer_id', customerId)

  if (error) {
    console.error('❌ Error handling deleted task:', error)
    throw error
  }

  console.log(`✅ Marked task ${taskId} as deleted`)
}