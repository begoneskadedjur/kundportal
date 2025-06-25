// api/clickup-tasks.ts
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

  console.log('Fetching tasks for ClickUp list:', list_id)

  try {
    // Hämta uppgifter från ClickUp API
    const response = await fetch(
      `https://api.clickup.com/api/v2/list/${list_id}/task?archived=false&include_closed=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ClickUp API error:', response.status, errorText)
      
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
      listId: list_id
    })

    // Bearbeta och rensa data
    const processedTasks = (data.tasks || []).map((task: any) => ({
      id: task.id,
      name: task.name,
      description: task.description || '',
      status: {
        status: task.status?.status || 'Unknown',
        color: task.status?.color || '#808080'
      },
      priority: task.priority ? {
        priority: task.priority.priority,
        color: task.priority.color
      } : null,
      due_date: task.due_date,
      date_created: task.date_created,
      assignees: (task.assignees || []).map((assignee: any) => ({
        id: assignee.id,
        username: assignee.username,
        email: assignee.email
      })),
      custom_fields: task.custom_fields || [],
      url: task.url
    }))

    // Sortera uppgifter: pågående först, sedan efter skapelsedatum
    processedTasks.sort((a: any, b: any) => {
      const aStatus = a.status.status.toLowerCase()
      const bStatus = b.status.status.toLowerCase()
      
      // Prioritera pågående uppgifter
      const aInProgress = aStatus.includes('progress') || aStatus.includes('doing')
      const bInProgress = bStatus.includes('progress') || bStatus.includes('doing')
      
      if (aInProgress && !bInProgress) return -1
      if (!aInProgress && bInProgress) return 1
      
      // Sedan efter datum (nyast först)
      return parseInt(b.date_created) - parseInt(a.date_created)
    })

    return res.status(200).json({
      success: true,
      tasks: processedTasks,
      total: processedTasks.length,
      list_id: list_id
    })

  } catch (error: any) {
    console.error('Error fetching ClickUp tasks:', error)
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid hämtning av ärenden',
      success: false
    })
  }
}