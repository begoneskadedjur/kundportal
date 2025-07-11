// api/import-clickup-tasks.ts - UPPDATERAD med korrekt ClickUp status-mappning och completed_date
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getStatusName, getStatusId, isCompletedStatus, STATUS_ID_TO_NAME } from '../src/types/database'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

// Lista IDs från din ClickUp-analys
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

  const { list_type, page_size = 50, include_closed = true, force_reimport = false } = req.body

  if (!list_type || !['privatperson', 'foretag', 'both'].includes(list_type)) {
    return res.status(400).json({ 
      error: 'list_type krävs: "privatperson", "foretag", eller "both"' 
    })
  }

  try {
    console.log('=== BEGONE CLICKUP IMPORT START ===')
    console.log('Import type:', list_type)
    console.log('Force reimport:', force_reimport)
    console.log('Include closed:', include_closed)

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
        
        const listStats = await importListTasks(
          listInfo.id, 
          listInfo.table, 
          listInfo.name, 
          page_size, 
          include_closed, 
          force_reimport
        )
        
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

    console.log('=== BEGONE IMPORT COMPLETE ===')
    console.log('Total stats:', totalStats)

    return res.status(200).json({
      success: true,
      summary: totalStats,
      results: results,
      message: `Import slutförd: ${totalStats.imported} ärenden importerade av ${totalStats.processed} processade`,
      status_mapping_info: {
        total_clickup_statuses: Object.keys(STATUS_ID_TO_NAME).length,
        example_mappings: {
          'c127553498_E9tR4uKl': STATUS_ID_TO_NAME['c127553498_E9tR4uKl'],
          'c127553498_wQT5njhJ': STATUS_ID_TO_NAME['c127553498_wQT5njhJ']
        }
      }
    })

  } catch (error: any) {
    console.error('=== BEGONE IMPORT ERROR ===', error)
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
  includeClosed: boolean,
  forceReimport: boolean
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
            .select('id, status, completed_date')
            .eq('clickup_task_id', task.id)
            .single()

          if (existing && !forceReimport) {
            console.log(`Task ${task.id} already exists, skipping`)
            stats.skipped++
            continue
          }

          // Mappa task data till databas-format med korrekta statusar
          const caseData = mapTaskToDatabase(task, tableName)
          
          if (existing && forceReimport) {
            // Uppdatera befintligt ärende med ny status-mappning
            const { error: updateError } = await supabase
              .from(tableName)
              .update({
                ...caseData,
                updated_at: new Date().toISOString()
              })
              .eq('clickup_task_id', task.id)

            if (updateError) {
              console.error(`Error updating task ${task.id}:`, updateError)
              stats.errors++
            } else {
              console.log(`🔄 Updated task ${task.id}: ${task.name} -> Status: ${caseData.status}`)
              stats.imported++
            }
          } else {
            // Insertera nytt ärende
            const { error: insertError } = await supabase
              .from(tableName)
              .insert(caseData)

            if (insertError) {
              console.error(`Error inserting task ${task.id}:`, insertError)
              stats.errors++
            } else {
              console.log(`✅ Imported task ${task.id}: ${task.name} -> Status: ${caseData.status}`)
              stats.imported++
            }
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
  // 🆕 KORREKT STATUS-MAPPNING från ClickUp ID till namn
  const clickupStatusId = task.status?.id
  const statusName = getStatusName(clickupStatusId) // Konvertera ID till "Bokad", "Avslutat" etc.
  const isCompleted = isCompletedStatus(statusName)
  
  console.log(`📊 Task ${task.id} status mapping:`, {
    clickup_status_id: clickupStatusId,
    clickup_status_name: task.status?.status,
    mapped_status_name: statusName,
    is_completed: isCompleted
  })

  // Grundläggande fält för båda tabeller
  const baseData = {
    clickup_task_id: task.id,
    case_number: task.custom_id || `${task.id.slice(-6)}`,
    title: task.name,
    description: task.description || null,
    status: statusName,                    // 🆕 Kapitaliserad status ("Bokad")
    status_id: clickupStatusId,           // 🆕 ClickUp status ID för exakt mappning
    priority: mapClickUpPriority(task.priority?.priority),
    created_at: task.date_created ? new Date(parseInt(task.date_created)).toISOString() : new Date().toISOString(),
    updated_at: task.date_updated ? new Date(parseInt(task.date_updated)).toISOString() : new Date().toISOString()
  }

  // Assignees mapping (upp till 3 tekniker)
  const assigneeData = mapAssignees(task.assignees || [])
  
  // 🆕 FÖRBÄTTRAD DATUM MAPPING med completed_date
  const dateData = mapTaskDates(task, isCompleted)

  // Custom fields mapping
  const customFieldData = mapCustomFields(task.custom_fields || [], tableName)

  return { ...baseData, ...assigneeData, ...dateData, ...customFieldData }
}

// 🆕 FÖRBÄTTRAD DATUM-MAPPNING med completed_date logik
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
    
    console.log(`📅 Task ${task.id} completed_date set to: ${dateData.completed_date}`)
  } else {
    dateData.completed_date = null
  }
  
  return dateData
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
        // 🆕 FÖRBÄTTRAD DROPDOWN HANTERING
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

// 🆕 UPPDATERAD PRIORITY MAPPNING
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

// 🆕 UPPDATERAD ASSIGNEE-MAPPNING med riktiga UUID:er
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
    
    if (matchedTechnician) {
      console.log(`👤 Matched ${prefix} assignee: ${assignee.username} -> ${matchedTechnician.name} (${matchedTechnician.id})`)
    }
  })
  
  return assigneeData
}

// 🆕 UPPDATERAD TEKNIKER-MATCHNING med riktiga UUID:er från Supabase
function findMatchingTechnician(assignee: any): { id: string, name: string, email: string } | null {
  const assigneeName = assignee.username || assignee.name || ''
  const assigneeEmail = assignee.email || ''
  
  // RIKTIGA UUID:er från Supabase technicians tabell
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
  
  // Matcha på email först (mest exakt)
  if (assigneeEmail) {
    const emailMatch = knownTechnicians.find(tech => 
      tech.email.toLowerCase() === assigneeEmail.toLowerCase()
    )
    if (emailMatch) return emailMatch
  }
  
  // Matcha på namn (fuzzy matching)
  if (assigneeName) {
    const nameMatch = knownTechnicians.find(tech => {
      const techFirstName = tech.name.split(' ')[0].toLowerCase()
      const techLastName = tech.name.split(' ')[1]?.toLowerCase() || ''
      const assigneeNameLower = assigneeName.toLowerCase()
      
      // Matcha förnamn eller efternamn
      return assigneeNameLower.includes(techFirstName) || 
             assigneeNameLower.includes(techLastName) ||
             techFirstName.includes(assigneeNameLower) ||
             tech.name.toLowerCase().includes(assigneeNameLower)
    })
    if (nameMatch) return nameMatch
  }
  
  return null
}