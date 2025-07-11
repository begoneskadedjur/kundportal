// api/simple-status-debug.ts - Enkel debug utan auth-problem
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Tillåt alla metoder och CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    console.log('=== SIMPLE STATUS DEBUG START ===')
    
    // Test 1: Bara hämta en lista
    const listId = '901204857438' // Privatperson
    
    console.log('Testar list-hämtning...')
    const listResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}`,
      {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!listResponse.ok) {
      return res.status(500).json({
        error: 'List API error',
        status: listResponse.status,
        statusText: listResponse.statusText
      })
    }

    const listData = await listResponse.json()
    
    // Test 2: Hämta en task
    console.log('Testar task-hämtning...')
    const tasksResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}/task?limit=1`,
      {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    )

    let taskData = null
    if (tasksResponse.ok) {
      const tasksJson = await tasksResponse.json()
      taskData = tasksJson.tasks?.[0] || null
    }

    // Extrahera status-info
    const statusInfo = {
      list_statuses: listData.statuses?.map((s: any) => ({
        id: s.id,
        status: s.status,
        color: s.color,
        type: s.type,
        orderindex: s.orderindex
      })) || [],
      
      task_status_example: taskData?.status ? {
        id: taskData.status.id,
        status: taskData.status.status,
        color: taskData.status.color,
        type: taskData.status.type
      } : null,
      
      full_task_status: taskData?.status || null
    }

    return res.status(200).json({
      success: true,
      message: 'Status debug lyckades!',
      list_id: listId,
      list_name: listData.name,
      status_info: statusInfo,
      raw_data: {
        list_statuses_count: listData.statuses?.length || 0,
        has_task_example: !!taskData,
        task_id: taskData?.id
      }
    })

  } catch (error: any) {
    console.error('Simple debug error:', error)
    return res.status(500).json({
      error: 'Debug misslyckades',
      details: error.message,
      stack: error.stack?.substring(0, 500)
    })
  }
}