// src/lib/clickup-details.ts
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

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN

if (!CLICKUP_API_TOKEN) {
  throw new Error('CLICKUP_API_TOKEN is required')
}

export async function getTaskDetails(taskId: string): Promise<ProcessedTaskDetails> {
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const task: ClickUpTask = data

    // Processa custom fields
    const customFields: any = {}
    
    task.custom_fields?.forEach(field => {
      switch (field.name.toLowerCase()) {
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

    return {
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
  } catch (error) {
    console.error('Error fetching task details:', error)
    throw error
  }
}

export async function getMultipleTaskDetails(taskIds: string[]): Promise<ProcessedTaskDetails[]> {
  try {
    const tasks = await Promise.all(
      taskIds.map(taskId => getTaskDetails(taskId))
    )
    return tasks
  } catch (error) {
    console.error('Error fetching multiple task details:', error)
    throw error
  }
}