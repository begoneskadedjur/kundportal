// api/clickup-webhook.ts - UPPDATERAD med nya ClickUp status-mappningar och completed_date
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getStatusName, isCompletedStatus } from '../src/types/database'
import crypto from 'crypto'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!
const CLICKUP_WEBHOOK_SECRET = process.env.CLICKUP_WEBHOOK_SECRET

// BeGone listor för automatisk synkronisering
const BEGONE_LISTS = {
  PRIVATPERSON: '901204857438',
  FORETAG: '901204857574'
}

interface ClickUpWebhookPayload {
  event: 'taskCreated' | 'taskUpdated' | 'taskDeleted' | 'taskStatusUpdated' | 'taskAssigneeUpdated'
  task_id: string
  list_id?: string
  webhook_id: string
  history_items?: Array<{
    id: string
    type: number
    date: string
    field: string
    parent_id: string
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
        list_id: payload.list_id,
        webhook_id: payload.webhook_id
      })
      
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError)
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

    // Robust logik för att hantera list-ID
    let listId: string | undefined = payload.list_id

    if (!listId && payload.history_items && payload.history_items.length > 0) {
      listId = payload.history_items[0].parent_id
      console.log(`ℹ️ list_id saknades. Hittade parent_id i history_items: ${listId}`)
    }

    if (!listId) {
      console.error(`❌ Kunde inte fastställa list_id för task ${payload.task_id}`)
      return res.status(200).json({ message: 'Kunde inte fastställa list_id, ignorerar.' })
    }

    // Kontrollera vilken typ av lista detta är
    const listType = getListType(listId)
    
    switch (listType) {
      case 'customer':
        await handleCustomerTask(payload, listId)
        break
      case 'privatperson':
        await handleBeGoneTask(payload, listId, 'private_cases')
        break
      case 'foretag':
        await handleBeGoneTask(payload, listId, 'business_cases')
        break
      default:
        console.log(`ℹ️ Task ${payload.task_id} is not in a tracked list (list_id: ${listId})`)
        return res.status(200).json({ message: 'Not a tracked task' })
    }

    return res.status(200).json({ 
      success: true, 
      message: `${payload.event} processed for ${listType} list` 
    })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      debug: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Bestäm vilken typ av lista task:en tillhör
function getListType(listId: string): 'customer' | 'privatperson' | 'foretag' | 'unknown' {
  if (listId === BEGONE_LISTS.PRIVATPERSON) return 'privatperson'
  if (listId === BEGONE_LISTS.FORETAG) return 'foretag'
  
  // Om det inte är en BeGone-lista, antag att det är en kundlista
  // (kommer verifieras i handleCustomerTask)
  return 'customer'
}

// Hantera ärenden för avtalskunder (befintlig logik)
async function handleCustomerTask(payload: ClickUpWebhookPayload, listId: string) {
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, company_name, clickup_list_id')
    .eq('clickup_list_id', listId)
    .single()

  if (customerError || !customer) {
    console.log(`ℹ️ Task ${payload.task_id} is not in a customer list (list_id: ${listId})`)
    return
  }

  console.log(`📋 Processing ${payload.event} for customer: ${customer.company_name}`)

  switch (payload.event) {
    case 'taskCreated':
    case 'taskUpdated':
      await syncCustomerTaskFromClickUp(payload.task_id, customer.id)
      break
    
    case 'taskDeleted':
      await handleCustomerTaskDeleted(payload.task_id, customer.id)
      break
  }
}

// Hantera ärenden för BeGone listor (ny logik)
async function handleBeGoneTask(payload: ClickUpWebhookPayload, listId: string, tableName: 'private_cases' | 'business_cases') {
  const listDisplayName = tableName === 'private_cases' ? 'Privatperson' : 'Företag'
  console.log(`📋 Processing ${payload.event} for BeGone ${listDisplayName} list`)

  switch (payload.event) {
    case 'taskCreated':
    case 'taskUpdated':
      await syncBeGoneTaskFromClickUp(payload.task_id, tableName)
      break
    
    case 'taskDeleted':
      await handleBeGoneTaskDeleted(payload.task_id, tableName)
      break
  }
}

// Synkronisera avtalskund task (befintlig logik med nya statusar)
async function syncCustomerTaskFromClickUp(taskId: string, customerId: string) {
  try {
    console.log(`🔄 Syncing customer task ${taskId} for customer ${customerId}`)
    
    const taskData = await fetchClickUpTask(taskId)
    if (!taskData) {
      console.error(`❌ Could not fetch task ${taskId} from ClickUp`)
      return
    }

    const caseData = mapClickUpTaskToCustomerCaseData(taskData, customerId)
    
    const { error } = await supabase
      .from('cases')
      .upsert(caseData, {
        onConflict: 'clickup_task_id'
      })

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    console.log(`✅ Successfully synced customer task ${taskId} -> Status: ${caseData.status}`)
    
  } catch (error) {
    console.error(`❌ Error syncing customer task ${taskId}:`, error)
    throw error
  }
}

// Synkronisera BeGone task (ny logik med korrekta statusar)
async function syncBeGoneTaskFromClickUp(taskId: string, tableName: 'private_cases' | 'business_cases') {
  try {
    console.log(`🔄 Syncing BeGone task ${taskId} to ${tableName}`)
    
    const taskData = await fetchClickUpTask(taskId)
    if (!taskData) {
      console.error(`❌ Could not fetch task ${taskId} from ClickUp`)
      return
    }

    const caseData = mapClickUpTaskToBeGoneCaseData(taskData, tableName)
    
    const { error } = await supabase
      .from(tableName)
      .upsert(caseData, {
        onConflict: 'clickup_task_id'
      })

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    console.log(`✅ Successfully synced BeGone task ${taskId} to ${tableName} -> Status: ${caseData.status}`)
    
  } catch (error) {
    console.error(`❌ Error syncing BeGone task ${taskId}:`, error)
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
    return data.task || data 
    
  } catch (error) {
    console.error('Error fetching task from ClickUp:', error)
    return null
  }
}

// 🆕 UPPDATERAD: Mappa BeGone task till databas-format med nya statusar
function mapClickUpTaskToBeGoneCaseData(taskData: any, tableName: 'private_cases' | 'business_cases') {
  // 🆕 KORREKT STATUS-MAPPNING från ClickUp ID till namn
  const clickupStatusId = taskData.status?.id
  const statusName = getStatusName(clickupStatusId) // "Bokad", "Avslutat" etc.
  const isCompleted = isCompletedStatus(statusName)
  
  console.log(`📊 BeGone task ${taskData.id} status mapping:`, {
    clickup_status_id: clickupStatusId,
    clickup_status_name: taskData.status?.status,
    mapped_status_name: statusName,
    is_completed: isCompleted
  })

  const getCustomField = (name: string) => {
    return taskData.custom_fields?.find((field: any) => 
      field.name.toLowerCase() === name.toLowerCase()
    )
  }

  const getDropdownText = (field: any): string | null => {
    if (!field || field.value === null || field.value === undefined) {
      return null
    }

    if (field.type_config?.options && Array.isArray(field.type_config.options)) {
      let option: any = null

      if (typeof field.value === 'number') {
        option = field.type_config.options.find(
          (opt: any) => opt.orderindex === field.value
        )
      } else if (typeof field.value === 'string') {
        option = field.type_config.options.find(
          (opt: any) => opt.id === field.value
        )
      }
      
      if (option) {
        return option.name
      }
    }

    return field.value.toString()
  }

  // Mappa assignees till tekniker
  const assignees = taskData.assignees || []
  const assigneeData = mapAssignees(assignees)

  // 🆕 FÖRBÄTTRAD DATUM-MAPPNING med completed_date
  const dateData = mapTaskDates(taskData, isCompleted)

  // Grundläggande data
  const baseData = {
    clickup_task_id: taskData.id,
    case_number: taskData.custom_id || `${taskData.id.slice(-6)}`,
    title: taskData.name,
    description: taskData.description || null,
    status: statusName,                    // 🆕 Kapitaliserad status ("Bokad")
    status_id: clickupStatusId,           // 🆕 ClickUp status ID för exakt mappning
    priority: mapPriorityValue(taskData.priority?.priority),
    ...assigneeData,
    ...dateData,
    updated_at: new Date().toISOString()
  }

  // Custom fields
  const customFieldData: any = {}
  
  if (taskData.custom_fields) {
    taskData.custom_fields.forEach((field: any) => {
      const columnName = sanitizeFieldName(field.name)
      let value = field.value

      switch (field.type) {
        case 'location':
          if (value && typeof value === 'object') {
            customFieldData[columnName] = JSON.stringify(value)
          }
          break
        
        case 'attachment':
          if (value && Array.isArray(value)) {
            customFieldData[columnName] = JSON.stringify(value)
          }
          break
        
        case 'drop_down':
          customFieldData[columnName] = getDropdownText(field)
          break
        
        case 'currency':
        case 'number':
          customFieldData[columnName] = value !== null && value !== undefined ? parseFloat(value) : null
          break
        
        case 'checkbox':
          customFieldData[columnName] = Boolean(value)
          break
        
        default:
          if (value !== null && value !== undefined) {
            customFieldData[columnName] = value.toString()
          }
      }
    })
  }

  return { ...baseData, ...customFieldData }
}

// 🆕 FÖRBÄTTRAD DATUM-MAPPNING med completed_date logik (samma som import)
function mapTaskDates(task: any, isCompleted: boolean): any {
  const dateData: any = {}
  
  // Start datum (från ClickUp start_date eller date_created)
  if (task.start_date) {
    const startDate = new Date(parseInt(task.start_date))
    dateData.start_date = startDate.toISOString().split('T')[0] // YYYY-MM-DD format
  } else if (task.date_created) {
    const createdDate = new Date(parseInt(task.date_created))
    dateData.start_date = createdDate.toISOString().split('T')[0]
  }
  
  // Due datum (förfallodatum)
  if (task.due_date) {
    const dueDate = new Date(parseInt(task.due_date))
    dateData.due_date = dueDate.toISOString().split('T')[0] // YYYY-MM-DD format
  }
  
  // 🆕 COMPLETED DATE - baserat på status och date_closed
  if (isCompleted) {
    if (task.date_closed) {
      // Använd ClickUp:s date_closed om det finns
      const completedDate = new Date(parseInt(task.date_closed))
      dateData.completed_date = completedDate.toISOString().split('T')[0]
    } else if (task.date_updated) {
      // Fallback till senaste uppdateringsdatum
      const completedDate = new Date(parseInt(task.date_updated))
      dateData.completed_date = completedDate.toISOString().split('T')[0]
    } else {
      // Sista fallback till idag
      dateData.completed_date = new Date().toISOString().split('T')[0]
    }
    
    console.log(`📅 BeGone task ${task.id} completed_date set to: ${dateData.completed_date}`)
  } else {
    dateData.completed_date = null
  }
  
  return dateData
}

// Mappa assignees till tekniker (samma som import)
function mapAssignees(assignees: any[]): any {
  const assigneeData: any = {}
  
  const knownTechnicians = [
    { id: 'a9e21ebe-8994-4a49-ae31-859353457d3f', name: 'Benny Linden', email: 'benny.linden@begone.se' },
    { id: '2296a1e9-b466-4be9-92ea-0ed83a4829ff', name: 'Christian Karlsson', email: 'christian.karlsson@begone.se' },
    { id: '35e82f86-bcca-4d00-b079-d5dc3dad1b07', name: 'Hans Norman', email: 'hans.norman@begone.se' },
    { id: 'c21d3048-95b5-453a-b39c-0eb47c3e688b', name: 'Jakob Wahlberg', email: 'jakob.wahlberg@begone.se' },
    { id: '6a10fe98-d4d4-4e38-82a4-c4ecdf33a82c', name: 'Kim Wahlberg', email: 'kim.wahlberg@begone.se' },
    { id: '8846933d-abac-47b5-b73c-b3fe6a6f3df5', name: 'Kristian Agnevik', email: 'kristian.agnevik@begone.se' },
    { id: 'ecaf151a-44b2-4220-b105-998aa0f82d6e', name: 'Mathias Carlsson', email: 'mathias.carlsson@begone.se' },
    { id: 'e4db6838-f48d-4d7d-81cc-5ad3774acbf4', name: 'Sofia Pålshagen', email: 'sofia.palshagen@begone.se' }
  ]

  const limitedAssignees = assignees.slice(0, 3)
  
  limitedAssignees.forEach((assignee, index) => {
    const prefix = index === 0 ? 'primary' : index === 1 ? 'secondary' : 'tertiary'
    
    const matchedTechnician = knownTechnicians.find(tech => {
      const assigneeName = assignee.username || assignee.name || ''
      const assigneeEmail = assignee.email || ''
      
      // Matcha på email först (mest exakt)
      if (assigneeEmail && tech.email.toLowerCase() === assigneeEmail.toLowerCase()) {
        return true
      }
      
      // Matcha på namn (fuzzy matching)
      if (assigneeName) {
        const techFirstName = tech.name.split(' ')[0].toLowerCase()
        const techLastName = tech.name.split(' ')[1]?.toLowerCase() || ''
        const assigneeNameLower = assigneeName.toLowerCase()
        
        return assigneeNameLower.includes(techFirstName) || 
               assigneeNameLower.includes(techLastName) ||
               techFirstName.includes(assigneeNameLower) ||
               tech.name.toLowerCase().includes(assigneeNameLower)
      }
      
      return false
    })
    
    assigneeData[`${prefix}_assignee_id`] = matchedTechnician?.id || null
    assigneeData[`${prefix}_assignee_name`] = assignee.username || assignee.name || null
    assigneeData[`${prefix}_assignee_email`] = assignee.email || matchedTechnician?.email || null
    
    if (matchedTechnician) {
      console.log(`👤 Webhook matched ${prefix} assignee: ${assignee.username} -> ${matchedTechnician.name} (${matchedTechnician.id})`)
    }
  })
  
  return assigneeData
}

// Sanitera fältnamn (samma som import)
function sanitizeFieldName(name: string): string {
  return name.toLowerCase()
    .replace(/[åäö]/g, (match: string) => ({ 'å': 'a', 'ä': 'a', 'ö': 'o' }[match] || match))
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
}

// 🆕 UPPDATERAD: Mappa avtalskund task med nya statusar
function mapClickUpTaskToCustomerCaseData(taskData: any, customerId: string) {
  // 🆕 KORREKT STATUS-MAPPNING även för avtalskunder
  const clickupStatusId = taskData.status?.id
  const statusName = getStatusName(clickupStatusId) // "Bokad", "Avslutat" etc.
  const isCompleted = isCompletedStatus(statusName)
  
  console.log(`📊 Customer task ${taskData.id} status mapping:`, {
    clickup_status_id: clickupStatusId,
    clickup_status_name: taskData.status?.status,
    mapped_status_name: statusName,
    is_completed: isCompleted
  })

  const getCustomField = (name: string) => {
    return taskData.custom_fields?.find((field: any) => 
      field.name.toLowerCase() === name.toLowerCase()
    )
  }

  const getDropdownText = (field: any): string | null => {
    if (!field || field.value === null || field.value === undefined) {
      return null
    }

    if (field.type_config?.options && Array.isArray(field.type_config.options)) {
      let option: any = null

      if (typeof field.value === 'number') {
        option = field.type_config.options.find(
          (opt: any) => opt.orderindex === field.value
        )
      } else if (typeof field.value === 'string') {
        option = field.type_config.options.find(
          (opt: any) => opt.id === field.value
        )
      }
      
      if (option) {
        return option.name
      }
    }

    return field.value.toString()
  }

  const addressField = getCustomField('Adress')
  const pestField = getCustomField('Skadedjur')
  const caseTypeField = getCustomField('Ärende')
  const priceField = getCustomField('Pris')
  const reportField = getCustomField('Rapport')
  const filesField = getCustomField('Filer')

  const assignee = taskData.assignees?.[0]

  return {
    customer_id: customerId,
    clickup_task_id: taskData.id,
    case_number: taskData.custom_id || taskData.id,
    title: taskData.name,
    status: statusName,                    // 🆕 Kapitaliserad status
    status_id: clickupStatusId,           // 🆕 ClickUp status ID
    priority: mapPriorityValue(taskData.priority?.priority),
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
    // 🆕 COMPLETED DATE för avtalskunder också
    completed_date: isCompleted ? (
      taskData.date_closed ? new Date(parseInt(taskData.date_closed)).toISOString() :
      taskData.date_updated ? new Date(parseInt(taskData.date_updated)).toISOString() :
      new Date().toISOString()
    ) : null,
    
    updated_at: new Date().toISOString()
  }
}

// 🆕 UPPDATERAD PRIORITY MAPPNING (samma som import)
function mapPriorityValue(clickupPriority: string | undefined): string {
  if (!clickupPriority) return 'normal'
  
  const priorityMap: { [key: string]: string } = {
    'urgent': 'urgent',
    'high': 'high', 
    'normal': 'normal',
    'low': 'normal',
    '1': 'urgent',
    '2': 'high',
    '3': 'normal',
    '4': 'normal'
  }
  
  return priorityMap[clickupPriority.toString().toLowerCase()] || 'normal'
}

// Hantera raderade avtalskund tasks
async function handleCustomerTaskDeleted(taskId: string, customerId: string) {
  console.log(`🗑️ Handling deleted customer task ${taskId}`)
  
  const { error } = await supabase
    .from('cases')
    .update({ 
      status: 'Borttagen',  // 🆕 Använd kapitaliserad status
      updated_at: new Date().toISOString()
    })
    .eq('clickup_task_id', taskId)
    .eq('customer_id', customerId)

  if (error) {
    console.error('❌ Error handling deleted customer task:', error)
    throw error
  }

  console.log(`✅ Marked customer task ${taskId} as deleted`)
}

// Hantera raderade BeGone tasks
async function handleBeGoneTaskDeleted(taskId: string, tableName: 'private_cases' | 'business_cases') {
  console.log(`🗑️ Handling deleted BeGone task ${taskId} from ${tableName}`)
  
  const { error } = await supabase
    .from(tableName)
    .update({ 
      status: 'Borttagen',  // 🆕 Använd kapitaliserad status
      updated_at: new Date().toISOString()
    })
    .eq('clickup_task_id', taskId)

  if (error) {
    console.error('❌ Error handling deleted BeGone task:', error)
    throw error
  }

  console.log(`✅ Marked BeGone task ${taskId} as deleted in ${tableName}`)
}

// Hjälpfunktioner
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

function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  
  return signature === expectedSignature
}