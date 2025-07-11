// api/import-clickup-tasks.ts - Importera befintliga ärenden från ClickUp
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

// List IDs från mappningen
const LISTS = {
  privatperson: '901204857438',
  foretag: '901204857574'
}

interface ImportStats {
  processed: number
  imported: number
  errors: number
  skipped: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Endast POST tillåtet' })
  }

  const { list_type, page_size = 50, include_closed = false } = req.body

  if (!list_type || !['privatperson', 'foretag', 'both'].includes(list_type)) {
    return res.status(400).json({ 
      error: 'list_type krävs: "privatperson", "foretag", eller "both"' 
    })
  }

  try {
    console.log('=== CLICKUP IMPORT START ===')
    console.log('Import type:', list_type)

    const listsToProcess = list_type === 'both' 
      ? [{ id: LISTS.privatperson, table: 'private_cases', name: 'Privatperson' },
         { id: LISTS.foretag, table: 'business_cases', name: 'Företag' }]
      : [{ 
          id: LISTS[list_type as keyof typeof LISTS], 
          table: list_type === 'privatperson' ? 'private_cases' : 'business_cases',
          name: list_type === 'privatperson' ? 'Privatperson' : 'Företag'
        }]

    const totalStats: ImportStats = { processed: 0, imported: 0, errors: 0, skipped: 0 }
    const results: any[] = []

    for (const listInfo of listsToProcess) {
      try {
        console.log(`\n--- Processing ${listInfo.name} (${listInfo.id}) ---`)
        
        const listStats = await importListTasks(listInfo.id, listInfo.table, listInfo.name, page_size, include_closed)
        
        totalStats.processed += listStats.processed
        totalStats.imported += listStats.imported
        totalStats.errors += listStats.errors
        totalStats.skipped += listStats.skipped

        results.push({
          list_name: listInfo.name,
          list_id: listInfo.id,
          table: listInfo.table,
          stats: listStats
        })

      } catch (error) {
        console.error(`Error processing ${listInfo.name}:`, error)
        totalStats.errors++
        results.push({
          list_name: listInfo.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log('=== IMPORT COMPLETE ===')
    console.log('Total stats:', totalStats)

    return res.status(200).json({
      success: true,
      summary: totalStats,
      results: results,
      message: `Import slutförd: ${totalStats.imported} ärenden importerade av ${totalStats.processed} processade`
    })

  } catch (error: any) {
    console.error('=== IMPORT ERROR ===', error)
    return res.status(500).json({
      error: 'Import misslyckades',
      details: error.message
    })
  }
}

async function importListTasks(
  listId: string, 
  tableName: string, 
  listName: string,
  pageSize: number,
  includeClosed: boolean
): Promise<ImportStats> {
  const stats: ImportStats = { processed: 0, imported: 0, errors: 0, skipped: 0 }
  
  try {
    // Hämta tasks från ClickUp med paginering
    let page = 0
    let hasMore = true

    while (hasMore) {
      console.log(`Fetching page ${page} for ${listName}...`)
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        include_closed: includeClosed.toString()
      })

      const response = await fetch(
        `https://api.clickup.com/api/v2/list/${listId}/task?${queryParams}`,
        {
          headers: {
            'Authorization': CLICKUP_API_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const tasks = data.tasks || []
      
      console.log(`Found ${tasks.length} tasks on page ${page}`)

      if (tasks.length === 0) {
        hasMore = false
        break
      }

      // Processa varje task
      for (const task of tasks) {
        stats.processed++
        
        try {
          // Kolla om task redan finns i databasen
          const { data: existing } = await supabase
            .from(tableName)
            .select('id')
            .eq('clickup_task_id', task.id)
            .single()

          if (existing) {
            console.log(`Task ${task.id} already exists, skipping`)
            stats.skipped++
            continue
          }

          // Mappa task data till databas-format
          const caseData = mapTaskToDatabase(task, tableName)
          
          // Insertera i databasen
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(caseData)

          if (insertError) {
            console.error(`Error inserting task ${task.id}:`, insertError)
            stats.errors++
          } else {
            console.log(`✅ Imported task ${task.id}: ${task.name}`)
            stats.imported++
          }

        } catch (taskError) {
          console.error(`Error processing task ${task.id}:`, taskError)
          stats.errors++
        }
      }

      // Kolla om det finns fler sidor
      if (tasks.length < pageSize) {
        hasMore = false
      } else {
        page++
      }

      // Rate limiting - vänta lite mellan requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }

  } catch (error) {
    console.error(`Error importing ${listName}:`, error)
    throw error
  }

  return stats
}

function mapTaskToDatabase(task: any, tableName: string): any {
  // Grundläggande fält för båda tabeller
  const baseData = {
    clickup_task_id: task.id,
    case_number: task.custom_id || `${task.id.slice(-6)}`,
    title: task.name,
    description: task.description || null,
    status: mapClickUpStatus(task.status?.status),
    priority: mapClickUpPriority(task.priority?.priority),
    created_at: task.date_created ? new Date(parseInt(task.date_created)).toISOString() : new Date().toISOString(),
    updated_at: task.date_updated ? new Date(parseInt(task.date_updated)).toISOString() : new Date().toISOString()
  }

  // Assignees mapping (upp till 3 tekniker)
  const assigneeData = mapAssignees(task.assignees || [])
  
  // Datum mapping (svenska format)
  const dateData = mapTaskDates(task)

  // Custom fields mapping
  const customFieldData = mapCustomFields(task.custom_fields || [], tableName)

  return { ...baseData, ...assigneeData, ...dateData, ...customFieldData }
}

function mapCustomFields(customFields: any[], tableName: string): any {
  const fieldData: any = {}

  customFields.forEach(field => {
    const columnName = sanitizeFieldName(field.name)
    let value = field.value

    // Hantera olika fälttyper
    switch (field.type) {
      case 'location':
        if (value && typeof value === 'object') {
          fieldData[columnName] = JSON.stringify(value)
        }
        break
      
      case 'attachment':
        if (value && Array.isArray(value)) {
          fieldData[columnName] = JSON.stringify(value)
        }
        break
      
      case 'drop_down':
        // Hantera dropdown värden
        if (field.type_config?.options && value !== null && value !== undefined) {
          const option = field.type_config.options.find((opt: any) => 
            opt.orderindex === value || opt.id === value
          )
          fieldData[columnName] = option ? option.name : value?.toString()
        } else if (value !== null && value !== undefined) {
          fieldData[columnName] = value.toString()
        }
        break
      
      case 'currency':
      case 'number':
        fieldData[columnName] = value !== null && value !== undefined ? parseFloat(value) : null
        break
      
      case 'checkbox':
        fieldData[columnName] = Boolean(value)
        break
      
      default:
        if (value !== null && value !== undefined) {
          fieldData[columnName] = value.toString()
        }
    }
  })

  return fieldData
}

function sanitizeFieldName(name: string): string {
  return name.toLowerCase()
    .replace(/[åäö]/g, (match: string) => ({ 'å': 'a', 'ä': 'a', 'ö': 'o' }[match] || match))
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
}

function mapClickUpStatus(status: string | undefined): string {
  if (!status) return 'open'
  
  const statusMap: { [key: string]: string } = {
    'att göra': 'open',
    'under hantering': 'in_progress',
    'bokat': 'in_progress', 
    'pågående': 'in_progress',
    'slutförd': 'completed',
    'klar': 'completed',
    'genomförd': 'completed',
    'avslutad': 'completed',
    'stängd': 'closed',
    'closed': 'closed'
  }
  
  return statusMap[status.toLowerCase()] || 'open'
}

function mapClickUpPriority(priority: any): string {
  if (!priority) return 'normal'
  
  if (typeof priority === 'number') {
    return priority === 1 ? 'urgent' : priority === 2 ? 'high' : 'normal'
  }
  
  const priorityMap: { [key: string]: string } = {
    'urgent': 'urgent',
    'high': 'high',
    'normal': 'normal',
    'low': 'normal'
  }
  
  return priorityMap[priority.toString().toLowerCase()] || 'normal'
}

// Ny funktion för att mappa assignees
function mapAssignees(assignees: any[]): any {
  const assigneeData: any = {}
  
  // Begränsa till max 3 assignees
  const limitedAssignees = assignees.slice(0, 3)
  
  limitedAssignees.forEach((assignee, index) => {
    const prefix = index === 0 ? 'primary' : index === 1 ? 'secondary' : 'tertiary'
    
    // Försök matcha med vår tekniker-databas baserat på namn eller email
    const matchedTechnician = findMatchingTechnician(assignee)
    
    assigneeData[`${prefix}_assignee_id`] = matchedTechnician?.id || null
    assigneeData[`${prefix}_assignee_name`] = assignee.username || assignee.name || null
    assigneeData[`${prefix}_assignee_email`] = assignee.email || matchedTechnician?.email || null
  })
  
  return assigneeData
}

// Hjälpfunktion för att hitta matchande tekniker
function findMatchingTechnician(assignee: any): { id: string, email: string } | null {
  const assigneeName = assignee.username || assignee.name || ''
  const assigneeEmail = assignee.email || ''
  
  // Kända tekniker från BeGone (uppdaterad lista)
  const knownTechnicians = [
    { id: 'sofia-id', name: 'Sofia Pålshagen', email: 'sofia.palshagen@begone.se' },
    { id: 'benny-id', name: 'Benny Linden', email: 'benny.linden@begone.se' },
    { id: 'kristian-id', name: 'Kristian Agnevik', email: 'kristian.agnevik@begone.se' },
    { id: 'christian-id', name: 'Christian Karlsson', email: 'christian.karlsson@begone.se' },
    { id: 'hans-id', name: 'Hans Norman', email: 'hans.norman@begone.se' },
    { id: 'mathias-id', name: 'Mathias Carlsson', email: 'mathias.carlsson@begone.se' },
    { id: 'kim-id', name: 'Kim Wahlberg', email: 'kim.wahlberg@begone.se' },
    { id: 'jakob-id', name: 'Jakob Wahlberg', email: 'jakob.wahlberg@begone.se' }
  ]
  
  // Matcha på email först
  if (assigneeEmail) {
    const emailMatch = knownTechnicians.find(tech => 
      tech.email.toLowerCase() === assigneeEmail.toLowerCase()
    )
    if (emailMatch) return { id: emailMatch.id, email: emailMatch.email }
  }
  
  // Matcha på namn
  if (assigneeName) {
    const nameMatch = knownTechnicians.find(tech =>
      tech.name.toLowerCase().includes(assigneeName.toLowerCase()) ||
      assigneeName.toLowerCase().includes(tech.name.toLowerCase())
    )
    if (nameMatch) return { id: nameMatch.id, email: nameMatch.email }
  }
  
  return null
}

// Ny funktion för att mappa datum
function mapTaskDates(task: any): any {
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
  
  // Completed datum (om ärendet är avslutat)
  if (task.date_closed && task.status?.status && 
      ['slutförd', 'klar', 'genomförd', 'avslutad', 'closed'].includes(task.status.status.toLowerCase())) {
    const completedDate = new Date(parseInt(task.date_closed))
    dateData.completed_date = completedDate.toISOString().split('T')[0] // YYYY-MM-DD format
  }
  
  return dateData
}