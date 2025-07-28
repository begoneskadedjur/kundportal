// src/services/clickup/client.ts
const CLICKUP_API_URL = 'https://api.clickup.com/api/v2'

export class ClickUpClient {
  private apiToken: string

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${CLICKUP_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': this.apiToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`ClickUp API error (${response.status}):`, errorText)
      throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`)
    }

    // Säker JSON parsing
    const responseText = await response.text()
    try {
      return JSON.parse(responseText)
    } catch (error) {
      console.error('ClickUp response was not valid JSON:', responseText.substring(0, 200))
      throw new Error('ClickUp returned invalid response format')
    }
  }

  // Skapa en ny lista i en folder
  async createList(folderId: string, name: string, content: string = '') {
    return this.request(`/folder/${folderId}/list`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        content,
        priority: 1,
        status: 'active'
      }),
    })
  }

  // Hämta en folder
  async getFolder(folderId: string) {
    return this.request(`/folder/${folderId}`)
  }

  // Skapa en task
  async createTask(listId: string, taskData: any) {
    return this.request(`/list/${listId}/task`, {
      method: 'POST',
      body: JSON.stringify(taskData),
    })
  }

  // Hämta en task
  async getTask(taskId: string) {
    return this.request(`/task/${taskId}`)
  }

  // Uppdatera en task
  async updateTask(taskId: string, taskData: any) {
    return this.request(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    })
  }
}

// src/services/clickup/lists.ts
import { supabase } from '../../lib/supabase'

export async function createClickUpListForCustomer(
  customerName: string,
  orgNumber: string,
  folderId: string,
  apiToken: string
) {
  const clickup = new ClickUpClient(apiToken)
  
  // Skapa lista med kundens namn och org.nummer
  const listName = `${customerName} - ${orgNumber}`
  
  try {
    const list = await clickup.createList(
      folderId,
      listName,
      `Kundportal för ${customerName}`
    )
    
    return {
      id: list.id,
      name: list.name
    }
  } catch (error) {
    console.error('Error creating ClickUp list:', error)
    throw error
  }
}