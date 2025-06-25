// api/clickup-tasks.ts - FÖRBÄTTRAD DEBUG VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

if (!CLICKUP_API_TOKEN) {
  throw new Error('CLICKUP_API_TOKEN environment variable is required')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Endast GET tillåtet
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { list_id } = req.query

  if (!list_id || typeof list_id !== 'string') {
    return res.status(400).json({ error: 'list_id parameter is required' })
  }

  console.log('=== CLICKUP API DEBUG START ===')
  console.log('List ID:', list_id)
  console.log('API Token exists:', !!CLICKUP_API_TOKEN)
  console.log('API Token length:', CLICKUP_API_TOKEN.length)
  console.log('API Token starts with:', CLICKUP_API_TOKEN.substring(0, 5))

  try {
    // Först: Testa att hämta list-information för att verifiera åtkomst
    console.log('Step 1: Testing list access...')
    const listResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${list_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('List API response status:', listResponse.status)
    
    if (!listResponse.ok) {
      const listErrorText = await listResponse.text()
      console.error('List API error:', listErrorText)
      return res.status(500).json({
        error: 'Kunde inte komma åt ClickUp-listan',
        debug: {
          status: listResponse.status,
          error: listErrorText,
          list_id: list_id
        }
      })
    }

    const listData = await listResponse.json()
    console.log('List data:', {
      id: listData.id,
      name: listData.name,
      task_count: listData.task_count
    })

    // Steg 2: Hämta uppgifter från listan
    console.log('Step 2: Fetching tasks...')
    
    const response = await fetch(
      `https://api.clickup.com/api/v2/list/${list_id}/task?include_closed=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('Tasks API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Tasks API error:', response.status, errorText)
      
      if (response.status === 401) {
        throw new Error('Ogiltig ClickUp API-token')
      } else if (response.status === 403) {
        throw new Error('Ingen åtkomst till ClickUp-listan')
      } else if (response.status === 404) {
        throw new Error('ClickUp-listan hittades inte')
      } else {
        throw new Error(`ClickUp API fel: ${response.status}`)
      }
    }

    const data = await response.json()
    console.log('ClickUp API response:', {
      tasksCount: data.tasks?.length || 0,
      listId: list_id,
      tasks: data.tasks?.map((t: any) => ({ id: t.id, name: t.name, status: t.status?.status }))
    })

    const allTasks = data.tasks || []

    console.log('Final tasks count:', allTasks.length)

    // Bearbeta och rensa data
    const processedTasks = allTasks.map((task: any) => {
      console.log('Processing task:', {
        id: task.id,
        name: task.name,
        status: task.status,
        list_id: task.list?.id
      })

      return {
        id: task.id,
        name: task.name,
        description: task.description || task.text_content || '',
        status: {
          status: task.status?.status || task.status || 'Unknown',
          color: task.status?.color || '#808080'
        },
        priority: task.priority ? {
          priority: task.priority.priority || task.priority,
          color: task.priority.color || '#808080'
        } : null,
        due_date: task.due_date,
        date_created: task.date_created,
        date_updated: task.date_updated,
        assignees: (task.assignees || []).map((assignee: any) => ({
          id: assignee.id,
          username: assignee.username,
          email: assignee.email
        })),
        custom_fields: task.custom_fields || [],
        url: task.url,
        list: task.list ? {
          id: task.list.id,
          name: task.list.name
        } : null,
        // Lägg till extra fält som kan vara användbara
        creator: task.creator ? {
          id: task.creator.id,
          username: task.creator.username
        } : null,
        tags: task.tags || [],
        parent: task.parent,
        time_estimate: task.time_estimate,
        time_spent: task.time_spent
      }
    })

    // Sortera uppgifter
    processedTasks.sort((a: any, b: any) => {
      const aStatus = a.status.status.toLowerCase()
      const bStatus = b.status.status.toLowerCase()
      
      const aInProgress = aStatus.includes('progress') || aStatus.includes('doing')
      const bInProgress = bStatus.includes('progress') || bStatus.includes('doing')
      
      if (aInProgress && !bInProgress) return -1
      if (!aInProgress && bInProgress) return 1
      
      return parseInt(b.date_created || '0') - parseInt(a.date_created || '0')
    })

    console.log('=== CLICKUP API DEBUG SUCCESS ===')

    return res.status(200).json({
      success: true,
      tasks: processedTasks,
      total: processedTasks.length,
      list_id: list_id,
      debug: {
        successful_url: `https://api.clickup.com/api/v2/list/${list_id}/task?include_closed=true`,
        list_info: {
          id: listData.id,
          name: listData.name,
          task_count: listData.task_count
        },
        tasks_processed: processedTasks.length,
        raw_tasks: allTasks.length
      }
    })

  } catch (error: any) {
    console.error('=== CLICKUP API DEBUG ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid hämtning av ärenden',
      success: false,
      debug: {
        list_id: list_id,
        error_type: error.constructor.name,
        timestamp: new Date().toISOString()
      }
    })
  }
}