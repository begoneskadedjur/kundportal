// api/admin/cleanup-duplicate-contracts.ts - Rensa duplikatkontrakt från databasen
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../_lib/auth'

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

// Hitta och ta bort orphaned filer
const cleanupOrphanedContractFiles = async (): Promise<{
  orphanedFilesFound: number
  orphanedFilesRemoved: number
}> => {
  try {
    console.log('🗂️ Söker efter orphaned contract files...')

    // Hämta alla contract_files med joinad contract info
    const { data: allFiles, error: filesError } = await supabase
      .from('contract_files')
      .select(`
        id, 
        contract_id, 
        oneflow_file_id, 
        file_name,
        contracts!inner(id, oneflow_contract_id)
      `)

    if (filesError) {
      throw new Error(`Fel vid hämtning av contract files: ${filesError.message}`)
    }

    if (!allFiles || allFiles.length === 0) {
      return { orphanedFilesFound: 0, orphanedFilesRemoved: 0 }
    }

    // Hitta filer där kontraktet inte existerar längre
    const orphanedFiles = allFiles.filter(file => !file.contracts)
    
    if (orphanedFiles.length === 0) {
      console.log('✅ Inga orphaned filer hittades')
      return { orphanedFilesFound: 0, orphanedFilesRemoved: 0 }
    }

    console.log(`🗑️ Hittade ${orphanedFiles.length} orphaned filer`)

    // Ta bort orphaned filer
    const orphanedFileIds = orphanedFiles.map(f => f.id)
    const { error: deleteError } = await supabase
      .from('contract_files')
      .delete()
      .in('id', orphanedFileIds)

    if (deleteError) {
      throw new Error(`Fel vid borttagning av orphaned filer: ${deleteError.message}`)
    }

    console.log(`✅ Tog bort ${orphanedFiles.length} orphaned filer`)

    return {
      orphanedFilesFound: orphanedFiles.length,
      orphanedFilesRemoved: orphanedFiles.length
    }

  } catch (error: any) {
    console.error('💥 Fel vid cleanup av orphaned filer:', error)
    throw error
  }
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

  // Död endpoint utan UI-anropare - låst till admin (säkerhetsaudit juni 2026)
  const auth = await requireAuth(req, res, ['admin'])
  if (!auth) return

  try {
    console.log('🧹 Startar cleanup av duplikatkontrakt och orphaned filer...')

    // 1. Rensa orphaned contract files först
    const filesResult = await cleanupOrphanedContractFiles()

    // 2. Rensa duplikatkontrakt
    const contractsResult = await cleanupDuplicateContracts()

    const totalMessage = [
      `Kontrakt: ${contractsResult.contractsRemoved} duplikater borttagna från ${contractsResult.duplicatesFound} grupper`,
      `Filer: ${filesResult.orphanedFilesRemoved} orphaned filer borttagna`
    ].join(' | ')

    return res.status(200).json({
      success: true,
      data: {
        message: `Cleanup slutförd - ${totalMessage}`,
        contracts: contractsResult,
        files: filesResult,
        summary: {
          contractsRemoved: contractsResult.contractsRemoved,
          filesRemoved: filesResult.orphanedFilesRemoved,
          totalItemsRemoved: contractsResult.contractsRemoved + filesResult.orphanedFilesRemoved
        }
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