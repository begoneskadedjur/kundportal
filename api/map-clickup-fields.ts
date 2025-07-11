// api/map-clickup-fields.ts - Mappa alla custom fields från BeGone listor
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

interface CustomField {
  id: string
  name: string
  type: string
  required?: boolean
  type_config?: any
}

interface ListInfo {
  id: string
  name: string
  fields: CustomField[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Härda listor från skärmdump - du kan uppdatera dessa med riktiga IDs
  const BEGONE_LISTS = [
    { id: 'PRIVATPERSON_LIST_ID', name: 'Privatperson' },
    { id: 'FÖRETAG_LIST_ID', name: 'Företag' }
  ]

  // Om specifika list IDs skickas som query params
  const { privatperson_id, foretag_id } = req.query
  
  if (privatperson_id) BEGONE_LISTS[0].id = privatperson_id as string
  if (foretag_id) BEGONE_LISTS[1].id = foretag_id as string

  try {
    const allListData: ListInfo[] = []

    // Hämta custom fields för varje lista
    for (const list of BEGONE_LISTS) {
      if (list.id.includes('LIST_ID')) {
        console.log(`Skippar ${list.name} - inget riktigt ID angivet`)
        continue
      }

      try {
        const response = await fetch(`https://api.clickup.com/api/v2/list/${list.id}/field`, {
          headers: {
            'Authorization': CLICKUP_API_TOKEN,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          const fields: CustomField[] = data.fields?.map((field: any) => ({
            id: field.id,
            name: field.name,
            type: field.type,
            required: field.required,
            type_config: field.type_config
          })) || []

          allListData.push({
            id: list.id,
            name: list.name,
            fields: fields
          })
        } else {
          console.error(`Fel vid hämtning av ${list.name}:`, response.status)
        }
      } catch (error) {
        console.error(`Fel för lista ${list.name}:`, error)
      }
    }

    // Analysera alla unika fälttyper och namn
    const allFields = allListData.flatMap(list => 
      list.fields.map(field => ({ ...field, source_list: list.name }))
    )

    const fieldTypes = [...new Set(allFields.map(f => f.type))]
    const fieldNames = [...new Set(allFields.map(f => f.name))]

    // Skapa Supabase tabell-förslag
    const supabaseSchema = generateSupabaseSchema(allFields)

    // Generera uppdaterade TypeScript types
    const typescriptTypes = generateTypescriptTypes(allFields)

    return res.status(200).json({
      success: true,
      summary: {
        total_lists: allListData.length,
        total_fields: allFields.length,
        unique_field_types: fieldTypes.length,
        unique_field_names: fieldNames.length
      },
      lists: allListData,
      analysis: {
        field_types: fieldTypes,
        field_names: fieldNames,
        common_fields: findCommonFields(allListData)
      },
      supabase_schema: supabaseSchema,
      typescript_types: typescriptTypes,
      next_steps: [
        "1. Kör denna API med riktiga list IDs",
        "2. Använd supabase_schema för att skapa/uppdatera cases tabellen",
        "3. Uppdatera TypeScript types i database.ts",
        "4. Modifiera clickup-webhook.ts för att mappa nya fält",
        "5. Skapa admin-komponenter för att visa/sortera datan"
      ]
    })

  } catch (error: any) {
    return res.status(500).json({
      error: 'Kunde inte mappa ClickUp fields',
      details: error.message
    })
  }
}

function findCommonFields(lists: ListInfo[]): any {
  if (lists.length < 2) return {}

  const [first, ...rest] = lists
  const commonFields: any = {}

  first.fields.forEach(field => {
    const isCommon = rest.every(list => 
      list.fields.some(f => f.name === field.name && f.type === field.type)
    )
    
    if (isCommon) {
      commonFields[field.name] = {
        type: field.type,
        id_privatperson: lists.find(l => l.name === 'Privatperson')?.fields.find(f => f.name === field.name)?.id,
        id_foretag: lists.find(l => l.name === 'Företag')?.fields.find(f => f.name === field.name)?.id
      }
    }
  })

  return commonFields
}

function generateSupabaseSchema(fields: any[]): string {
  const uniqueFields = fields.reduce((acc, field) => {
    if (!acc.find((f: any) => f.name === field.name)) {
      acc.push(field)
    }
    return acc
  }, [])

  let schema = `-- Uppdaterad cases tabell med alla custom fields från ClickUp\n`
  schema += `ALTER TABLE cases ADD COLUMN IF NOT EXISTS\n`

  uniqueFields.forEach((field, index) => {
    const sqlType = mapFieldTypeToSQL(field.type)
    const columnName = field.name.toLowerCase()
      .replace(/[åäö]/g, (match: string) => ({ 'å': 'a', 'ä': 'a', 'ö': 'o' }[match] || match))
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')

    schema += `  ${columnName} ${sqlType}`
    if (index < uniqueFields.length - 1) schema += `,`
    schema += ` -- ${field.name} (${field.type})\n`
  })

  schema += `;`
  return schema
}

function generateTypescriptTypes(fields: any[]): string {
  const uniqueFields = fields.reduce((acc, field) => {
    if (!acc.find((f: any) => f.name === field.name)) {
      acc.push(field)
    }
    return acc
  }, [])

  let types = `// Uppdaterade TypeScript types för cases tabellen\n`
  types += `interface CasesRow {\n`
  types += `  // Befintliga fält\n`
  types += `  id: string\n`
  types += `  customer_id: string\n`
  types += `  clickup_task_id: string\n`
  types += `  case_number: string\n`
  types += `  title: string\n`
  types += `  status: string\n`
  types += `  priority: string\n`
  types += `  description: string\n`
  types += `  created_at: string\n`
  types += `  updated_at: string\n\n`
  types += `  // Custom fields från ClickUp\n`

  uniqueFields.forEach(field => {
    const tsType = mapFieldTypeToTypeScript(field.type)
    const propertyName = field.name.toLowerCase()
      .replace(/[åäö]/g, (match: string) => ({ 'å': 'a', 'ä': 'a', 'ö': 'o' }[match] || match))
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')

    types += `  ${propertyName}?: ${tsType} // ${field.name}\n`
  })

  types += `}`
  return types
}

function mapFieldTypeToSQL(clickupType: string): string {
  const typeMap: { [key: string]: string } = {
    'text': 'TEXT',
    'textarea': 'TEXT',
    'number': 'DECIMAL',
    'currency': 'DECIMAL',
    'date': 'DATE',
    'datetime': 'TIMESTAMPTZ',
    'dropdown': 'TEXT',
    'labels': 'TEXT[]',
    'checkbox': 'BOOLEAN',
    'url': 'TEXT',
    'email': 'TEXT',
    'phone': 'TEXT',
    'location': 'JSONB',
    'attachment': 'JSONB',
    'formula': 'TEXT',
    'rating': 'INTEGER',
    'automatic_progress': 'INTEGER'
  }
  
  return typeMap[clickupType] || 'TEXT'
}

function mapFieldTypeToTypeScript(clickupType: string): string {
  const typeMap: { [key: string]: string } = {
    'text': 'string',
    'textarea': 'string', 
    'number': 'number',
    'currency': 'number',
    'date': 'string',
    'datetime': 'string',
    'dropdown': 'string',
    'labels': 'string[]',
    'checkbox': 'boolean',
    'url': 'string',
    'email': 'string',
    'phone': 'string',
    'location': 'any',
    'attachment': 'any[]',
    'formula': 'string',
    'rating': 'number',
    'automatic_progress': 'number'
  }
  
  return typeMap[clickupType] || 'any'
}