// api/clickup/task/[taskId].ts
import { VercelRequest, VercelResponse } from '@vercel/node'

interface ClickUpCustomField {
  id: string
  name: string
  type: string
  value?: any
  type_config?: any
}

interface ClickUpTask {
  id: string
  name: string
  description: string
  status: {
    status: string
    color: string
  }
  date_created: string
  date_updated: string
  date_closed?: string
  due_date?: string
  start_date?: string
  assignees: Array<{
    id: string
    username: string
    email: string
    color: string
    initials: string
    profilePicture?: string
  }>
  custom_fields: ClickUpCustomField[]
  priority?: {
    priority: string
    color: string
  }
  time_estimate?: number
  time_spent?: number
}

interface ProcessedTaskDetails {
  id: string
  name: string
  description: string
  status: string
  statusColor: string
  dateCreated: string
  dateUpdated: string
  dateClosed?: string
  dueDate?: string
  startDate?: string
  assignees: Array<{
    name: string
    email: string
    initials: string
    profilePicture?: string
  }>
  priority?: string
  priorityColor?: string
  customFields: {
    address?: string
    price?: string
    files?: string[]
    report?: string
    [key: string]: any
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { taskId } = req.query

  if (!taskId || typeof taskId !== 'string') {
    return res.status(400).json({ error: 'Task ID is required' })
  }

  const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN

  if (!CLICKUP_API_TOKEN) {
    console.error('CLICKUP_API_TOKEN is not set')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`ClickUp API error: ${response.status} ${response.statusText}`)
      return res.status(response.status).json({ 
        error: `Failed to fetch task from ClickUp: ${response.statusText}` 
      })
    }

    const data = await response.json()
    const task: ClickUpTask = data

    // Processa custom fields
    const customFields: any = {}
    
    task.custom_fields?.forEach(field => {
      const fieldName = field.name.toLowerCase()
      
      switch (fieldName) {
        case 'address':
        case 'adress':
          customFields.address = field.value
          break
        case 'price':
        case 'pris':
          customFields.price = field.value
          break
        case 'files':
        case 'filer':
          // Om det är en array av filer
          if (Array.isArray(field.value)) {
            customFields.files = field.value
          } else if (field.value) {
            customFields.files = [field.value]
          }
          break
        case 'report':
        case 'rapport':
          customFields.report = field.value
          break
        default:
          // Spara alla andra custom fields med deras ursprungliga namn
          customFields[field.name] = field.value
      }
    })

    const processedTask: ProcessedTaskDetails = {
      id: task.id,
      name: task.name,
      description: task.description || '',
      status: task.status.status,
      statusColor: task.status.color,
      dateCreated: task.date_created,
      dateUpdated: task.date_updated,
      dateClosed: task.date_closed,
      dueDate: task.due_date,
      startDate: task.start_date,
      assignees: task.assignees.map(assignee => ({
        name: assignee.username,
        email: assignee.email,
        initials: assignee.initials,
        profilePicture: assignee.profilePicture
      })),
      priority: task.priority?.priority,
      priorityColor: task.priority?.color,
      customFields
    }

    res.status(200).json(processedTask)
  } catch (error) {
    console.error('Error fetching task details:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}