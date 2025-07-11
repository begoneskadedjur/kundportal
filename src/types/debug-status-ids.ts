// api/debug-status-ids.ts - Hämta EXAKTA status-ID:n från ClickUp API
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

// Era BeGone List IDs
const LISTS = {
  privatperson: '901204857438',
  foretag: '901204857574'
}

interface StatusInfo {
  id: string
  status: string
  color: string
  type: string
  orderindex: number
}

interface TaskStatusExample {
  task_id: string
  task_name: string
  status_object: any
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Endast GET tillåtet' })
  }

  try {
    console.log('=== HÄMTAR EXAKTA STATUS-ID:N FRÅN CLICKUP ===')
    
    const results: any[] = []
    const allStatusIds: { [key: string]: StatusInfo } = {}
    const taskExamples: TaskStatusExample[] = []

    // Analysera båda era listor
    for (const [listType, listId] of Object.entries(LISTS)) {
      console.log(`\nAnalyserar ${listType} lista (${listId})...`)
      
      try {
        // 1. Hämta list-konfiguration för officiella status-definitioner
        console.log('Hämtar list-konfiguration...')
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
          console.error(`List API error for ${listType}:`, listResponse.status)
          continue
        }

        const listData = await listResponse.json()
        const configuredStatuses = listData.statuses || []
        
        console.log(`List ${listType} har ${configuredStatuses.length} konfigurerade statusar`)

        // 2. Hämta några faktiska tasks för att se verklig status-struktur
        console.log('Hämtar exempel-tasks...')
        const tasksResponse = await fetch(
          `https://api.clickup.com/api/v2/list/${listId}/task?limit=10&include_closed=true`,
          {
            headers: {
              'Authorization': CLICKUP_API_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!tasksResponse.ok) {
          console.error(`Tasks API error for ${listType}:`, tasksResponse.status)
          continue
        }

        const tasksData = await tasksResponse.json()
        const tasks = tasksData.tasks || []

        // 3. Samla status-information från båda källor
        const listStatusInfo: { [key: string]: any } = {}

        // Från list-konfiguration (officiella definitioner)
        configuredStatuses.forEach((status: any) => {
          const key = status.status.toLowerCase()
          listStatusInfo[key] = {
            ...listStatusInfo[key],
            id: status.id,
            status: status.status,
            color: status.color,
            type: status.type,
            orderindex: status.orderindex,
            source: 'list_config'
          }
        })

        // Från faktiska tasks (verklig användning)
        tasks.forEach((task: any, index: number) => {
          if (task.status) {
            const key = task.status.status?.toLowerCase()
            
            if (key) {
              // Uppdatera med task-data
              listStatusInfo[key] = {
                ...listStatusInfo[key],
                task_status_id: task.status.id,
                task_status_status: task.status.status,
                task_status_color: task.status.color,
                task_status_type: task.status.type,
                source: listStatusInfo[key]?.source === 'list_config' ? 'both' : 'task_example'
              }

              // Spara task-exempel (första 3 per status)
              if (index < 3) {
                taskExamples.push({
                  task_id: task.id,
                  task_name: task.name,
                  status_object: task.status
                })
              }
            }
          }
        })

        // Lägg till i global samling
        Object.values(listStatusInfo).forEach((statusInfo: any) => {
          const globalKey = `${statusInfo.status}_${listType}`
          allStatusIds[globalKey] = statusInfo
        })

        results.push({
          list_type: listType,
          list_id: listId,
          configured_statuses: configuredStatuses.length,
          found_task_statuses: Object.keys(listStatusInfo).length,
          status_details: listStatusInfo
        })

      } catch (error) {
        console.error(`Error analyzing ${listType}:`, error)
        results.push({
          list_type: listType,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // 4. Skapa TypeScript kod för implementation
    const typeScriptMapping = generateTypeScriptMapping(allStatusIds)
    const statusConstant = generateStatusConstant(allStatusIds)

    console.log('=== STATUS-ID ANALYS SLUTFÖRD ===')

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_statuses: Object.keys(allStatusIds).length,
        lists_analyzed: Object.keys(LISTS).length,
        task_examples: taskExamples.length
      },
      detailed_results: results,
      all_status_ids: allStatusIds,
      task_examples: taskExamples,
      implementation: {
        typescript_mapping: typeScriptMapping,
        status_constant: statusConstant,
        usage_example: generateUsageExample()
      },
      verification: {
        status_id_pattern: detectStatusIdPattern(allStatusIds),
        consistency_check: checkStatusConsistency(allStatusIds)
      }
    })

  } catch (error: any) {
    console.error('=== STATUS-ID DEBUG ERROR ===', error)
    return res.status(500).json({
      error: 'Kunde inte hämta status-ID:n',
      details: error.message
    })
  }
}

function generateTypeScriptMapping(statusIds: { [key: string]: any }): string {
  const mappings: string[] = []
  
  Object.values(statusIds).forEach((statusInfo: any) => {
    if (statusInfo.id && statusInfo.status) {
      mappings.push(`  '${statusInfo.id}': '${statusInfo.status}', // ${statusInfo.status} (${statusInfo.color})`)
    }
  })

  return `// Status-ID till status-namn mappning
export const STATUS_ID_MAPPING: { [key: string]: string } = {
${mappings.join('\n')}
}

// Omvänd mappning: status-namn till ID
export const STATUS_NAME_TO_ID: { [key: string]: string } = {
${Object.values(statusIds).map((s: any) => 
  s.id && s.status ? `  '${s.status}': '${s.id}',` : ''
).filter(Boolean).join('\n')}
}`
}

function generateStatusConstant(statusIds: { [key: string]: any }): string {
  const statuses: string[] = []
  
  Object.values(statusIds).forEach((statusInfo: any) => {
    if (statusInfo.id && statusInfo.status) {
      statuses.push(`  {
    id: '${statusInfo.id}',
    name: '${statusInfo.status}',
    color: '${statusInfo.color}',
    type: '${statusInfo.type}',
    orderindex: ${statusInfo.orderindex || 0}
  }`)
    }
  })

  return `// Komplett status-information
export const CLICKUP_STATUSES = [
${statuses.join(',\n')}
]`
}

function generateUsageExample(): string {
  return `// Exempel på hur man använder status-ID:n

// 1. I database.ts
export type ClickUpStatusId = 
  | 'c127553498_fwlMbGKH'  // öppen
  | 'c127553498_E9tR4uKl'  // bokat
  // ... alla era ID:n

// 2. I API:er - spara både namn och ID
const caseData = {
  status: task.status?.status,     // "bokat"
  status_id: task.status?.id,     // "c127553498_E9tR4uKl"
}

// 3. I frontend - använd ID för säker mappning
function getStatusConfig(statusId: string) {
  return STATUS_ID_MAPPING[statusId] || 'Okänd status'
}`
}

function detectStatusIdPattern(statusIds: { [key: string]: any }): string {
  const ids = Object.values(statusIds)
    .map((s: any) => s.id)
    .filter(Boolean)
  
  if (ids.length === 0) return 'Inga ID:n hittade'
  
  // Analysera mönster
  const sampleId = ids[0]
  const hasUnderscore = sampleId.includes('_')
  const startsWithC = sampleId.startsWith('c')
  const length = sampleId.length
  
  return `Mönster: ${hasUnderscore ? 'har underscore' : 'ingen underscore'}, ${startsWithC ? 'börjar med c' : 'börjar inte med c'}, längd: ${length}`
}

function checkStatusConsistency(statusIds: { [key: string]: any }): any {
  const issues: string[] = []
  const statusNames = new Set()
  const statusIdsSet = new Set()
  
  Object.values(statusIds).forEach((statusInfo: any) => {
    // Kolla dubbletter
    if (statusNames.has(statusInfo.status)) {
      issues.push(`Dubblerat statusnamn: ${statusInfo.status}`)
    }
    if (statusIdsSet.has(statusInfo.id)) {
      issues.push(`Dubblerat status-ID: ${statusInfo.id}`)
    }
    
    statusNames.add(statusInfo.status)
    statusIdsSet.add(statusInfo.id)
    
    // Kolla att båda sources matchar
    if (statusInfo.source === 'both') {
      if (statusInfo.id !== statusInfo.task_status_id) {
        issues.push(`ID mismatch för ${statusInfo.status}: list=${statusInfo.id} vs task=${statusInfo.task_status_id}`)
      }
    }
  })
  
  return {
    issues: issues,
    total_statuses: statusNames.size,
    total_ids: statusIdsSet.size,
    is_consistent: issues.length === 0
  }
}