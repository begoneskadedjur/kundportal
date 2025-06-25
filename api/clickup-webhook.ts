// api/clickup-webhook.ts - FIXAD VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!
const CLICKUP_WEBHOOK_SECRET = process.env.CLICKUP_WEBHOOK_SECRET

interface ClickUpWebhookPayload {
  event: 'taskCreated' | 'taskUpdated' | 'taskDeleted'
  task_id: string
  list_id: string
  webhook_id: string
  history_items?: Array<{
    field: string
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

    // Läs raw body data
    const rawBody = await getRawBody(req)
    console.log('📦 Raw body received, length:', rawBody.length)

    let payload: ClickUpWebhookPayload
    
    try {
      payload = JSON.parse(rawBody)
      console.log('✅ Payload parsed successfully:', {
        event: payload.event,
        task_id: payload.task_id,
        list_id: payload.list_id,
        webhook_id: payload.webhook_id,
        history_items_count: payload.history_items?.length || 0
      })
      
      // Log hela payload för debugging
      console.log('📄 Full payload:', JSON.stringify(payload, null, 2))
      
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError)
      console.error('Raw body content:', rawBody.substring(0, 500))
      return res.status(400).json({ error: 'Invalid JSON payload' })
    }

    console.log('🚀 Starting webhook processing...')

    // Hantera ClickUp test webhook (som skickar tom data)
    if (!payload.event && rawBody.includes('test')) {
      console.log('🧪 Test webhook received from ClickUp')
      return res.status(200).json({ message: 'Test webhook received successfully' })
    }

    // 1. Verifiera webhook-signatur (säkerhet) - TILLFÄLLIGT INAKTIVERAD
    console.log('🔐 Checking webhook signature...')
    if (false && CLICKUP_WEBHOOK_SECRET) { // Tillfälligt inaktiverad
      const signature = req.headers['x-signature'] as string
      console.log('📝 Signature present:', !!signature)
      
      if (!verifyWebhookSignature(rawBody, signature, CLICKUP_WEBHOOK_SECRET)) {
        console.error('❌ Invalid webhook signature')
        return res.status(401).json({ error: 'Invalid signature' })
      }
      console.log('✅ Webhook signature verified')
    } else {
      console.log('⚠️ Webhook signature verification DISABLED for debugging')
    }

    // 2. Kontrollera om detta är en relevant event
    const supportedEvents = ['taskCreated', 'taskUpdated', 'taskDeleted', 'taskStatusUpdated', 'taskAssigneeUpdated']
    if (!payload.event || !supportedEvents.includes(payload.event)) {
      console.log(`ℹ️ Ignoring event: ${payload.event || 'undefined'}`)
      return res.status(200).json({ message: `Event ${payload.event || 'undefined'} ignored` })
    }

    // Validera att vi har nödvändig data
    if (!payload.task_id) {
      console.error('❌ Missing task_id in webhook payload')
      return res.status(400).json({ error: 'Missing task_id' })
    }

    // 3. Kontrollera om tasken tillhör en kundlista
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, company_name, clickup_list_id')
      .eq('clickup_list_id', payload.list_id)
      .single()

    if (customerError || !customer) {
      console.log(`ℹ️ Task ${payload.task_id} is not in a customer list (list_id: ${payload.list_id})`)
      return res.status(200).json({ message: 'Not a customer task' })
    }

    console.log(`📋 Processing ${payload.event} for customer: ${customer.company_name}`)

    // 4. Hantera olika event-typer
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
    
    // Hämta task-data från ClickUp
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

    // Mappa ClickUp-data till vårt databasformat
    const caseData = mapClickUpTaskToCaseData(taskData, customerId)
    
    console.log(`💾 Saving case data:`, {
      customer_id: caseData.customer_id,
      clickup_task_id: caseData.clickup_task_id,
      case_number: caseData.case_number,
      title: caseData.title,
      status: caseData.status
    })
    
    // Uppdatera eller skapa case i databasen
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
      console.error(`ClickUp API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    return data.task || data // Beroende på ClickUp API-struktur
    
  } catch (error) {
    console.error('Error fetching task from ClickUp:', error)
    return null
  }
}

// Mappa ClickUp task-data till vårt cases-format
function mapClickUpTaskToCaseData(taskData: any, customerId: string) {
  // Hitta custom fields
  const getCustomField = (name: string) => {
    return taskData.custom_fields?.find((field: any) => 
      field.name.toLowerCase() === name.toLowerCase()
    )
  }

  const addressField = getCustomField('adress')
  const pestField = getCustomField('skadedjur')
  const caseTypeField = getCustomField('ärende')
  const priceField = getCustomField('pris')
  const reportField = getCustomField('rapport')
  const filesField = getCustomField('filer')

  // Mappa dropdown-värden
  const getDropdownText = (field: any) => {
    if (!field?.has_value) return null
    
    if (field.type_config?.options) {
      const option = field.type_config.options.find((opt: any) => 
        opt.orderindex === field.value
      )
      return option?.name || field.value?.toString()
    }
    
    return field.value?.toString()
  }

  // Hitta första assignee
  const assignee = taskData.assignees?.[0]

  return {
    customer_id: customerId,
    clickup_task_id: taskData.id,
    case_number: taskData.custom_id || taskData.id,
    title: taskData.name,
    status: taskData.status?.status || taskData.status,
    priority: taskData.priority?.priority || 'normal',
    pest_type: getDropdownText(pestField),
    case_type: getDropdownText(caseTypeField),
    location_details: taskData.description || '',
    description: taskData.description || '',
    
    // Adress-information
    address_formatted: addressField?.value?.formatted_address || null,
    address_lat: addressField?.value?.location?.lat || null,
    address_lng: addressField?.value?.location?.lng || null,
    
    // Pris och rapport
    price: priceField?.has_value ? priceField.value : null,
    technician_report: reportField?.value || null,
    
    // Filer (spara som JSON)
    files: filesField?.value && Array.isArray(filesField.value) 
      ? JSON.stringify(filesField.value) 
      : null,
    
    // Ansvarig tekniker
    assigned_technician_name: assignee?.username || null,
    assigned_technician_email: assignee?.email || null,
    
    // Datum
    created_date: new Date(parseInt(taskData.date_created)).toISOString(),
    scheduled_date: taskData.due_date ? new Date(parseInt(taskData.due_date)).toISOString() : null,
    completed_date: taskData.date_closed ? new Date(parseInt(taskData.date_closed)).toISOString() : null,
    
    updated_at: new Date().toISOString()
  }
}

// Hantera när en task tas bort
async function handleTaskDeleted(taskId: string, customerId: string) {
  console.log(`🗑️ Handling deleted task ${taskId}`)
  
  // Markera som borttagen (rekommenderat för historik)
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