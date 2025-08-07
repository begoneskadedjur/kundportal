// api/admin/cleanup-duplicate-contracts.ts - Rensa duplikatkontrakt från databasen
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Interface för duplikatrapport
interface DuplicateReport {
  oneflow_contract_id: string
  duplicates: Array<{
    id: string
    created_at: string
    updated_at: string
  }>
  kept: string // ID för det kontrakt som behålls
  removed: string[] // IDs för kontrakten som tas bort
}

// Sätt CORS headers
const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Hitta och ta bort duplikater
const cleanupDuplicateContracts = async (): Promise<{
  duplicatesFound: number
  contractsRemoved: number
  reports: DuplicateReport[]
}> => {
  try {
    console.log('🔍 Söker efter duplikatkontrakt...')

    // Hämta alla kontrakt med oneflow_contract_id
    const { data: allContracts, error: fetchError } = await supabase
      .from('contracts')
      .select('id, oneflow_contract_id, created_at, updated_at')
      .not('oneflow_contract_id', 'is', null)
      .order('oneflow_contract_id')

    if (fetchError) {
      throw new Error(`Fel vid hämtning av kontrakt: ${fetchError.message}`)
    }

    if (!allContracts || allContracts.length === 0) {
      return { duplicatesFound: 0, contractsRemoved: 0, reports: [] }
    }

    // Gruppera kontrakt per oneflow_contract_id
    const contractGroups = allContracts.reduce((groups, contract) => {
      if (!contract.oneflow_contract_id) return groups
      
      if (!groups[contract.oneflow_contract_id]) {
        groups[contract.oneflow_contract_id] = []
      }
      groups[contract.oneflow_contract_id].push(contract)
      return groups
    }, {} as { [key: string]: typeof allContracts })

    // Hitta dubbletter (grupper med fler än 1 kontrakt)
    const duplicateGroups = Object.entries(contractGroups).filter(
      ([_, contracts]) => contracts.length > 1
    )

    console.log(`📊 Hittade ${duplicateGroups.length} duplikatgrupper`)

    const reports: DuplicateReport[] = []
    let totalRemoved = 0

    // Bearbeta varje duplikatgrupp
    for (const [oneflowId, duplicates] of duplicateGroups) {
      console.log(`🔄 Bearbetar duplikater för ${oneflowId}: ${duplicates.length} kontrakt`)

      // Sortera för att hitta det senast uppdaterade kontraktet
      const sortedDuplicates = duplicates.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )

      const toKeep = sortedDuplicates[0] // Behåll det senast uppdaterade
      const toRemove = sortedDuplicates.slice(1) // Ta bort resten

      console.log(`  ✅ Behåller: ${toKeep.id} (uppdaterad: ${toKeep.updated_at})`)
      console.log(`  🗑️ Tar bort: ${toRemove.map(c => c.id).join(', ')}`)

      // Ta bort duplikaterna från databasen
      const idsToRemove = toRemove.map(c => c.id)
      const { error: deleteError } = await supabase
        .from('contracts')
        .delete()
        .in('id', idsToRemove)

      if (deleteError) {
        console.error(`❌ Fel vid borttagning av duplikater för ${oneflowId}:`, deleteError)
        continue
      }

      // Skapa rapport
      reports.push({
        oneflow_contract_id: oneflowId,
        duplicates: duplicates.map(d => ({
          id: d.id,
          created_at: d.created_at,
          updated_at: d.updated_at
        })),
        kept: toKeep.id,
        removed: idsToRemove
      })

      totalRemoved += idsToRemove.length
    }

    console.log(`✅ Cleanup slutförd: ${totalRemoved} duplikater borttagna`)

    return {
      duplicatesFound: duplicateGroups.length,
      contractsRemoved: totalRemoved,
      reports
    }

  } catch (error: any) {
    console.error('💥 Fel vid cleanup av duplikater:', error)
    throw error
  }
}

// Huvudfunktion
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCorsHeaders(res)

  // Hantera OPTIONS request för CORS
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // Acceptera endast POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Endast POST-anrop tillåtna'
    })
  }

  try {
    console.log('🧹 Startar cleanup av duplikatkontrakt...')

    const result = await cleanupDuplicateContracts()

    return res.status(200).json({
      success: true,
      data: {
        message: `Cleanup slutförd: ${result.contractsRemoved} duplikater borttagna från ${result.duplicatesFound} grupper`,
        ...result
      }
    })

  } catch (error: any) {
    console.error('❌ Cleanup API fel:', error)

    return res.status(500).json({
      success: false,
      error: 'Internt serverfel vid cleanup av duplikater',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}