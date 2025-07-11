// api/analyze-clickup-statuses.ts - Analysera era FAKTISKA ClickUp-statusar
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

// Era faktiska List IDs
const LISTS = {
  privatperson: '901204857438',
  foretag: '901204857574'
}

interface StatusInfo {
  status: string
  status_id?: string
  color?: string
  count: number
  list_type: string
  example_tasks: Array<{
    id: string
    name: string
    created: string
  }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Endast GET tillåtet' })
  }

  try {
    console.log('=== ANALYSERAR ERA FAKTISKA CLICKUP STATUSAR ===')
    
    const allStatusData: { [key: string]: StatusInfo } = {}
    const listAnalysis: any[] = []

    // Analysera båda era listor
    for (const [listType, listId] of Object.entries(LISTS)) {
      console.log(`\nAnalyserar ${listType} lista (${listId})...`)
      
      try {
        // Hämta list-information för att se tillgängliga statusar
        console.log('Hämtar list-konfiguration...')
        const listConfigResponse = await fetch(
          `https://api.clickup.com/api/v2/list/${listId}`,
          {
            headers: {
              'Authorization': CLICKUP_API_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        )

        let availableStatuses: any[] = []
        if (listConfigResponse.ok) {
          const listConfig = await listConfigResponse.json()
          availableStatuses = listConfig.statuses || []
          console.log(`Hittade ${availableStatuses.length} konfigurerade statusar i listan`)
        }

        // Hämta alla tasks för att se vilka statusar som faktiskt används
        console.log('Hämtar alla tasks...')
        let allTasks: any[] = []
        let page = 0
        let hasMore = true

        while (hasMore) {
          const tasksResponse = await fetch(
            `https://api.clickup.com/api/v2/list/${listId}/task?page=${page}&limit=100&include_closed=true`,
            {
              headers: {
                'Authorization': CLICKUP_API_TOKEN,
                'Content-Type': 'application/json'
              }
            }
          )

          if (!tasksResponse.ok) {
            console.error(`Error fetching tasks page ${page}:`, tasksResponse.status)
            break
          }

          const tasksData = await tasksResponse.json()
          const tasks = tasksData.tasks || []
          
          if (tasks.length === 0) {
            hasMore = false
          } else {
            allTasks = allTasks.concat(tasks)
            page++
            console.log(`Hämtade ${tasks.length} tasks på sida ${page - 1}, totalt: ${allTasks.length}`)
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        console.log(`Totalt ${allTasks.length} tasks hämtade från ${listType}`)

        // Analysera statusar från faktiska tasks
        const statusCounts: { [key: string]: StatusInfo } = {}

        allTasks.forEach(task => {
          const status = task.status?.status || 'UNKNOWN'
          const statusId = task.status?.id
          const statusColor = task.status?.color

          const key = `${status}_${listType}`

          if (!statusCounts[key]) {
            statusCounts[key] = {
              status: status,
              status_id: statusId,
              color: statusColor,
              count: 0,
              list_type: listType,
              example_tasks: []
            }
          }

          statusCounts[key].count++

          // Lägg till exempel (max 3 per status)
          if (statusCounts[key].example_tasks.length < 3) {
            statusCounts[key].example_tasks.push({
              id: task.id,
              name: task.name || `Task ${task.id}`,
              created: task.date_created ? new Date(parseInt(task.date_created)).toISOString().split('T')[0] : 'unknown'
            })
          }
        })

        // Lägg till i global analys
        Object.assign(allStatusData, statusCounts)

        listAnalysis.push({
          list_type: listType,
          list_id: listId,
          total_tasks: allTasks.length,
          configured_statuses: availableStatuses.map(s => ({
            id: s.id,
            status: s.status,
            color: s.color,
            type: s.type
          })),
          used_statuses: Object.values(statusCounts).map(s => ({
            status: s.status,
            status_id: s.status_id,
            color: s.color,
            count: s.count
          }))
        })

      } catch (error) {
        console.error(`Fel vid analys av ${listType}:`, error)
        listAnalysis.push({
          list_type: listType,
          list_id: listId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Skapa sammanställning
    const uniqueStatuses = [...new Set(Object.values(allStatusData).map(s => s.status))]
    const statusSummary = uniqueStatuses.map(status => {
      const statusData = Object.values(allStatusData).filter(s => s.status === status)
      return {
        status: status,
        total_count: statusData.reduce((sum, s) => sum + s.count, 0),
        lists: statusData.map(s => ({ list_type: s.list_type, count: s.count })),
        sample_status_id: statusData[0]?.status_id,
        sample_color: statusData[0]?.color
      }
    }).sort((a, b) => b.total_count - a.total_count)

    // Generera korrekt mappning baserat på era faktiska statusar
    const correctMapping = generateCorrectMapping(statusSummary)

    console.log('=== ANALYS SLUTFÖRD ===')
    console.log('Hittade statusar:', uniqueStatuses)

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_unique_statuses: uniqueStatuses.length,
        total_tasks_analyzed: Object.values(allStatusData).reduce((sum, s) => sum + s.count, 0),
        lists_analyzed: Object.keys(LISTS).length
      },
      status_breakdown: statusSummary,
      detailed_analysis: listAnalysis,
      all_status_data: Object.values(allStatusData),
      correct_mapping: correctMapping,
      implementation: {
        typescript_function: generateMappingFunction(correctMapping),
        update_queries: generateUpdateQueries(correctMapping)
      }
    })

  } catch (error: any) {
    console.error('=== ANALYS ERROR ===', error)
    return res.status(500).json({
      error: 'Status-analys misslyckades',
      details: error.message
    })
  }
}

function generateCorrectMapping(statusSummary: any[]): { [key: string]: string } {
  const mapping: { [key: string]: string } = {}
  
  statusSummary.forEach(statusInfo => {
    const status = statusInfo.status.toLowerCase()
    
    // Intelligent mappning baserat på era faktiska statusar
    if (status.includes('att göra') || status.includes('todo') || 
        status.includes('ny') || status.includes('öppen') ||
        status.includes('väntar') || status.includes('planerad')) {
      mapping[statusInfo.status] = 'open'
    } 
    else if (status.includes('bokat') || status.includes('pågående') || 
             status.includes('under') || status.includes('påbörjad') ||
             status.includes('arbetar') || status.includes('progress') ||
             status.includes('genomförs') || status.includes('active')) {
      mapping[statusInfo.status] = 'in_progress'
    } 
    else if (status.includes('slutförd') || status.includes('klar') || 
             status.includes('genomförd') || status.includes('avslutad') ||
             status.includes('färdig') || status.includes('done') ||
             status.includes('complete') || status.includes('levererad')) {
      mapping[statusInfo.status] = 'completed'
    } 
    else if (status.includes('stängd') || status.includes('closed') ||
             status.includes('avbruten') || status.includes('cancelled') ||
             status.includes('inställd') || status.includes('pausad')) {
      mapping[statusInfo.status] = 'closed'
    } 
    else {
      // För okända statusar, logga och sätt som 'open' som fallback
      console.log(`⚠️ Okänd status "${statusInfo.status}" (${statusInfo.total_count} tasks) - sätter som 'open'`)
      mapping[statusInfo.status] = 'open'
    }
  })
  
  return mapping
}

function generateMappingFunction(mapping: { [key: string]: string }): string {
  return `
// KORREKT STATUS-MAPPNING baserat på era faktiska ClickUp-statusar
function mapClickUpStatus(status: string | undefined): string {
  if (!status) return 'open'
  
  const statusMap: { [key: string]: string } = {
${Object.entries(mapping).map(([clickupStatus, dbStatus]) => 
    `    '${clickupStatus.toLowerCase()}': '${dbStatus}', // ${clickupStatus}`
  ).join('\n')}
  }
  
  const mapped = statusMap[status.toLowerCase()]
  if (!mapped) {
    console.warn(\`⚠️ Okänd status "\${status}" - sätter som 'open'\`)
    return 'open'
  }
  
  return mapped
}
`
}

function generateUpdateQueries(mapping: { [key: string]: string }): string[] {
  const queries: string[] = []
  
  Object.entries(mapping).forEach(([clickupStatus, dbStatus]) => {
    if (dbStatus !== 'open') { // Bara skapa queries för non-default värden
      queries.push(`
-- Uppdatera ärenden med ClickUp status "${clickupStatus}" till "${dbStatus}"
UPDATE private_cases 
SET status = '${dbStatus}', updated_at = NOW() 
WHERE status = 'open' 
  AND clickup_task_id IN (
    SELECT clickup_task_id FROM private_cases 
    WHERE /* här behöver vi jämföra med faktisk ClickUp data */
  );

UPDATE business_cases 
SET status = '${dbStatus}', updated_at = NOW() 
WHERE status = 'open'
  AND clickup_task_id IN (
    SELECT clickup_task_id FROM business_cases 
    WHERE /* här behöver vi jämföra med faktisk ClickUp data */
  );`)
    }
  })
  
  return queries
}