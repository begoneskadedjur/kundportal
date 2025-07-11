// api/map-clickup-fields.ts - Mappa custom fields för SEPARATA tabeller
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

interface CustomField {
  id: string
  name: string
  type: string
  required?: boolean
  type_config?: any
}

interface ListAnalysis {
  list_id: string
  list_name: string
  fields: CustomField[]
  table_name: string
  sql_schema: string
  typescript_types: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { privatperson_id, foretag_id } = req.query

  if (!privatperson_id || !foretag_id) {
    return res.status(400).json({
      error: 'Både privatperson_id och foretag_id krävs',
      usage: '/api/map-clickup-fields?privatperson_id=901204857438&foretag_id=901204857574'
    })
  }

  try {
    const lists = [
      { id: privatperson_id as string, name: 'Privatperson', table: 'private_cases' },
      { id: foretag_id as string, name: 'Företag', table: 'business_cases' }
    ]

    const analyses: ListAnalysis[] = []

    // Analysera varje lista separat
    for (const list of lists) {
      try {
        console.log(`Hämtar custom fields för ${list.name}...`)
        
        const response = await fetch(`https://api.clickup.com/api/v2/list/${list.id}/field`, {
          headers: {
            'Authorization': CLICKUP_API_TOKEN,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.error(`Fel för ${list.name}:`, response.status, response.statusText)
          continue
        }

        const data = await response.json()
        const fields: CustomField[] = data.fields?.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: field.type,
          required: field.required,
          type_config: field.type_config
        })) || []

        // Generera SQL schema för denna specifika lista
        const sqlSchema = generateTableSchema(list.table, fields)
        
        // Generera TypeScript types för denna lista
        const typescriptTypes = generateListTypes(list.table, fields)

        analyses.push({
          list_id: list.id,
          list_name: list.name,
          fields: fields,
          table_name: list.table,
          sql_schema: sqlSchema,
          typescript_types: typescriptTypes
        })

        console.log(`✅ ${list.name}: ${fields.length} custom fields hittade`)

      } catch (error) {
        console.error(`Fel vid analys av ${list.name}:`, error)
      }
    }

    // Skapa sammansatt resultat
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        privatperson_fields: analyses.find(a => a.list_name === 'Privatperson')?.fields.length || 0,
        foretag_fields: analyses.find(a => a.list_name === 'Företag')?.fields.length || 0,
        total_unique_fields: [...new Set(analyses.flatMap(a => a.fields.map(f => f.name)))].length
      },
      analyses: analyses,
      implementation_steps: [
        "1. Kopiera SQL schemas nedan och kör i Supabase",
        "2. Uppdatera src/types/database.ts med nya TypeScript types",
        "3. Skapa services för private_cases och business_cases",
        "4. Uppdatera clickup-webhook.ts för att hantera båda tabellerna",
        "5. Skapa admin-komponenter för att visa och hantera båda typerna",
        "6. Uppdatera create-case.ts för att skapa rätt typ baserat på lista"
      ],
      combined_sql: generateCombinedSQL(analyses),
      combined_typescript: generateCombinedTypeScript(analyses)
    }

    return res.status(200).json(result)

  } catch (error: any) {
    return res.status(500).json({
      error: 'Kunde inte mappa ClickUp custom fields',
      details: error.message
    })
  }
}

function generateTableSchema(tableName: string, fields: CustomField[]): string {
  let schema = `-- ${tableName.toUpperCase()} TABELL\n`
  schema += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`
  
  // Grundläggande fält som alla tabeller behöver
  schema += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`
  schema += `  clickup_task_id TEXT NOT NULL UNIQUE,\n`
  schema += `  case_number TEXT,\n`
  schema += `  title TEXT NOT NULL,\n`
  schema += `  description TEXT,\n`
  schema += `  status TEXT DEFAULT 'open',\n`
  schema += `  priority TEXT DEFAULT 'normal',\n`
  schema += `  created_at TIMESTAMPTZ DEFAULT NOW(),\n`
  schema += `  updated_at TIMESTAMPTZ DEFAULT NOW(),\n`
  schema += `  \n`
  schema += `  -- Custom fields från ClickUp\n`

  fields.forEach((field, index) => {
    const sqlType = mapFieldTypeToSQL(field.type)
    const columnName = sanitizeColumnName(field.name)
    
    schema += `  ${columnName} ${sqlType}`
    if (index < fields.length - 1) {
      schema += `,`
    }
    schema += ` -- ${field.name} (${field.type})\n`
  })

  schema += `);\n\n`
  
  // Lägg till index
  schema += `-- Index för prestanda\n`
  schema += `CREATE INDEX IF NOT EXISTS idx_${tableName}_clickup_task_id ON ${tableName}(clickup_task_id);\n`
  schema += `CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName}(status);\n`
  schema += `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at);\n\n`

  return schema
}

function generateListTypes(tableName: string, fields: CustomField[]): string {
  const interfaceName = tableName.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('') + 'Row'

  let types = `// ${tableName.toUpperCase()} TypeScript Interface\n`
  types += `export interface ${interfaceName} {\n`
  
  // Grundläggande fält
  types += `  id: string\n`
  types += `  clickup_task_id: string\n`
  types += `  case_number?: string\n`
  types += `  title: string\n`
  types += `  description?: string\n`
  types += `  status: string\n`
  types += `  priority: string\n`
  types += `  created_at: string\n`
  types += `  updated_at: string\n`
  types += `  \n`
  types += `  // Custom fields\n`

  fields.forEach(field => {
    const tsType = mapFieldTypeToTypeScript(field.type)
    const propertyName = sanitizeColumnName(field.name)
    
    types += `  ${propertyName}?: ${tsType} // ${field.name}\n`
  })

  types += `}\n\n`
  return types
}

function generateCombinedSQL(analyses: ListAnalysis[]): string {
  let combined = `-- KOMPLETT SQL SCHEMA FÖR BEGONE ÄRENDEN\n`
  combined += `-- Kör detta i Supabase SQL Editor\n\n`
  
  analyses.forEach(analysis => {
    combined += analysis.sql_schema + '\n'
  })

  // Lägg till RLS policies
  combined += `-- Row Level Security Policies\n`
  analyses.forEach(analysis => {
    combined += `ALTER TABLE ${analysis.table_name} ENABLE ROW LEVEL SECURITY;\n`
    combined += `\n`
    combined += `-- Admin kan se allt\n`
    combined += `CREATE POLICY "${analysis.table_name}_admin_all" ON ${analysis.table_name}\n`
    combined += `  FOR ALL USING (true);\n`
    combined += `\n`
  })

  return combined
}

function generateCombinedTypeScript(analyses: ListAnalysis[]): string {
  let combined = `// KOMPLETTA TYPESCRIPT TYPES FÖR database.ts\n`
  combined += `// Lägg till dessa i src/types/database.ts\n\n`
  
  analyses.forEach(analysis => {
    combined += analysis.typescript_types + '\n'
  })

  // Lägg till union types
  combined += `// Union types för flexibel hantering\n`
  combined += `export type BeGoneCaseRow = PrivateCasesRow | BusinessCasesRow\n\n`
  
  combined += `// Helper type för att identifiera case-typ\n`
  combined += `export interface CaseTypeInfo {\n`
  combined += `  table: 'private_cases' | 'business_cases'\n`
  combined += `  list_id: string\n`
  combined += `  display_name: string\n`
  combined += `}\n\n`

  return combined
}

function sanitizeColumnName(name: string): string {
  return name.toLowerCase()
    .replace(/[åäö]/g, (match: string) => ({ 'å': 'a', 'ä': 'a', 'ö': 'o' }[match] || match))
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
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
    'automatic_progress': 'INTEGER',
    'short_text': 'TEXT',
    'long_text': 'TEXT'
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
    'automatic_progress': 'number',
    'short_text': 'string',
    'long_text': 'string'
  }
  
  return typeMap[clickupType] || 'any'
}