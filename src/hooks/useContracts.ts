// src/hooks/useContracts.ts - Hook för contracts state management
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Contract, ContractInsert, ContractUpdate, ContractFile } from '../types/database'
import { 
  ContractService, 
  ContractWithSourceData, 
  ContractFilters, 
  ContractStats 
} from '../services/contractService'
import { ContractFilesService, ContractFileWithProgress } from '../services/contractFilesService'
import toast from 'react-hot-toast'

export interface UseContractsReturn {
  // State
  contracts: ContractWithSourceData[]
  loading: boolean
  error: string | null
  stats: ContractStats | null
  
  // Files state
  contractFiles: { [contractId: string]: ContractFile[] }
  filesLoading: { [contractId: string]: boolean }
  downloadingFiles: { [fileId: string]: boolean }
  
  // Actions
  loadContracts: (filters?: ContractFilters) => Promise<void>
  loadContractStats: (filters?: Pick<ContractFilters, 'date_from' | 'date_to'>) => Promise<void>
  getContract: (id: string) => Promise<ContractWithSourceData | null>
  updateContract: (id: string, updates: ContractUpdate) => Promise<void>
  deleteContract: (id: string) => Promise<void>
  refreshContracts: () => Promise<void>
  
  // Files actions
  loadContractFiles: (contractId: string, forceRefresh?: boolean) => Promise<ContractFile[]>
  downloadContractFile: (contractId: string, fileId: string) => Promise<void>
  getFileDownloadProgress: (fileId: string) => number
  hasContractFiles: (contractId: string) => boolean
  
  // Filters
  currentFilters: ContractFilters
  setFilters: (filters: ContractFilters) => void
  clearFilters: () => void
}

export function useContracts(): UseContractsReturn {
  const [contracts, setContracts] = useState<ContractWithSourceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ContractStats | null>(null)
  const [currentFilters, setCurrentFilters] = useState<ContractFilters>({})
  const currentFiltersRef = useRef<ContractFilters>({})
  
  // Files state
  const [contractFiles, setContractFiles] = useState<{ [contractId: string]: ContractFile[] }>({})
  const [filesLoading, setFilesLoading] = useState<{ [contractId: string]: boolean }>({})
  const [downloadingFiles, setDownloadingFiles] = useState<{ [fileId: string]: boolean }>({})
  const [filesLoadedAt, setFilesLoadedAt] = useState<{ [contractId: string]: number }>({}) // Cache timestamp
  
  // Contract list caching
  const [contractsLoadedAt, setContractsLoadedAt] = useState<number | null>(null)
  const [contractsCache, setContractsCache] = useState<{ [filterKey: string]: { data: ContractWithSourceData[], timestamp: number } }>({})

  // Ladda kontrakt med filter (med caching)
  const loadContracts = useCallback(async (filters: ContractFilters = {}) => {
    try {
      // Skapa cache-nyckel baserat på filter
      const filterKey = JSON.stringify(filters)
      const cached = contractsCache[filterKey]
      const isCached = cached && (Date.now() - cached.timestamp < 2 * 60 * 1000) // 2 minuter cache
      
      // Använd cache om tillgängligt
      if (isCached && cached.data) {
        console.log(`🔄 Använder cachade kontrakt för filter: ${filterKey}`)
        setContracts(cached.data)
        setCurrentFilters(filters)
        setLoading(false)
        return
      }
      
      // Förhindra multipla samtidiga requests för samma filter
      if (loading) {
        console.log(`⏳ Väntar på pågående request för filter: ${filterKey}`)
        return
      }
      
      console.log(`📄 Hämtar kontrakt från API med filter: ${filterKey}`)
      setLoading(true)
      setError(null)
      
      const contractList = await ContractService.getContracts(filters)
      setContracts(contractList)
      setCurrentFilters(filters)
      currentFiltersRef.current = filters
      
      // Uppdatera cache
      setContractsCache(prev => ({
        ...prev,
        [filterKey]: {
          data: contractList,
          timestamp: Date.now()
        }
      }))
      setContractsLoadedAt(Date.now())
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel vid hämtning av kontrakt'
      setError(errorMessage)
      console.error('useContracts.loadContracts fel:', err)
    } finally {
      setLoading(false)
    }
  }, []) // Inga externa dependencies för att undvika loop

  // Ladda kontraktstatistik
  const loadContractStats = useCallback(async (filters: Pick<ContractFilters, 'date_from' | 'date_to'> = {}) => {
    try {
      const contractStats = await ContractService.getContractStats(filters)
      setStats(contractStats)
    } catch (err) {
      console.error('useContracts.loadContractStats fel:', err)
      // Inte kritiskt fel, visa inte toast
    }
  }, [])

  // Hämta enstaka kontrakt
  const getContract = useCallback(async (id: string): Promise<ContractWithSourceData | null> => {
    try {
      return await ContractService.getContract(id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte hämta kontrakt'
      toast.error(errorMessage)
      throw err
    }
  }, [])

  // Uppdatera kontrakt
  const updateContract = useCallback(async (id: string, updates: ContractUpdate) => {
    try {
      const updatedContract = await ContractService.updateContract(id, updates)
      
      // Uppdatera local state
      setContracts(prev => 
        prev.map(contract => 
          contract.id === id 
            ? { ...contract, ...updatedContract }
            : contract
        )
      )
      
      toast.success('Kontrakt uppdaterat')
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte uppdatera kontrakt'
      toast.error(errorMessage)
      throw err
    }
  }, [])

  // Ta bort kontrakt
  const deleteContract = useCallback(async (id: string) => {
    try {
      await ContractService.deleteContract(id)
      
      // Ta bort från local state
      setContracts(prev => prev.filter(contract => contract.id !== id))
      
      toast.success('Kontrakt borttaget')
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte ta bort kontrakt'
      toast.error(errorMessage)
      throw err
    }
  }, [])

  // Ladda filer för ett kontrakt (med caching och lazy loading)
  const loadContractFiles = useCallback(async (contractId: string, forceRefresh: boolean = false): Promise<ContractFile[]> => {
    try {
      // Kontrollera cache - hämta bara om inte cached eller tvingad refresh
      const cacheTime = filesLoadedAt[contractId]
      const isCached = cacheTime && (Date.now() - cacheTime < 5 * 60 * 1000) // 5 minuter cache
      
      if (!forceRefresh && isCached && contractFiles[contractId]) {
        console.log(`🔄 Använder cachade filer för kontrakt ${contractId}`)
        return contractFiles[contractId]
      }
      
      // Förhindra multipla samtidiga requests för samma kontrakt
      if (filesLoading[contractId]) {
        console.log(`⏳ Väntar på pågående request för kontrakt ${contractId}`)
        // Vänta tills loading är klar och returnera cached result
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!filesLoading[contractId] && contractFiles[contractId]) {
              clearInterval(checkInterval)
              resolve(contractFiles[contractId])
            }
          }, 100)
        })
      }
      
      console.log(`📁 Hämtar filer från OneFlow API för kontrakt ${contractId}`)
      setFilesLoading(prev => ({ ...prev, [contractId]: true }))
      
      // Hämta från OneFlow API för att synka nya filer
      const response = await fetch(`/api/oneflow/contract-files?contractId=${contractId}`)
      const apiResponse = await response.json()
      
      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'Kunde inte hämta filer från OneFlow')
      }
      
      // Använd filer från vår databas (som nu är synkade)
      const files = apiResponse.data.contractFiles || []
      
      setContractFiles(prev => ({ ...prev, [contractId]: files }))
      setFilesLoadedAt(prev => ({ ...prev, [contractId]: Date.now() })) // Uppdatera cache timestamp
      
      return files
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte hämta filer'
      console.error(`❌ Fel vid hämtning av filer för ${contractId}:`, err)
      toast.error(errorMessage)
      throw err
    } finally {
      setFilesLoading(prev => ({ ...prev, [contractId]: false }))
    }
  }, [contractFiles, filesLoading, filesLoadedAt])

  // Ladda ner fil
  const downloadContractFile = useCallback(async (contractId: string, fileId: string) => {
    try {
      setDownloadingFiles(prev => ({ ...prev, [fileId]: true }))
      
      const response = await fetch('/api/oneflow/download-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contractId, fileId })
      })
      
      const apiResponse = await response.json()
      
      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'Kunde inte ladda ner fil')
      }
      
      // Uppdatera fil-status i local state
      setContractFiles(prev => ({
        ...prev,
        [contractId]: prev[contractId]?.map(file => 
          file.id === fileId 
            ? { ...file, download_status: 'completed', downloaded_at: new Date().toISOString() }
            : file
        ) || []
      }))
      
      // Öppna nedladdningslänken
      if (apiResponse.data.downloadUrl) {
        window.open(apiResponse.data.downloadUrl, '_blank')
      }
      
      toast.success(`Fil "${apiResponse.data.fileName}" nedladdad`)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte ladda ner fil'
      toast.error(errorMessage)
      throw err
    } finally {
      setDownloadingFiles(prev => ({ ...prev, [fileId]: false }))
    }
  }, [])

  // Hämta download progress för en fil
  const getFileDownloadProgress = useCallback((fileId: string): number => {
    // För nu returnera bara 0 eller 100 baserat på download status
    // I framtiden kan detta utökas med riktig progress tracking
    return downloadingFiles[fileId] ? 50 : 0
  }, [downloadingFiles])

  // Kontrollera om filer redan är cachade (utan att trigga fetch) - memoized
  const hasContractFiles = useCallback((contractId: string): boolean => {
    const cacheTime = filesLoadedAt[contractId]
    const isCached = cacheTime && (Date.now() - cacheTime < 5 * 60 * 1000) // 5 minuter cache
    return isCached && Boolean(contractFiles[contractId])
  }, [contractFiles, filesLoadedAt])

  // Filter functions med useCallback
  const setFilters = useCallback((filters: ContractFilters) => {
    setCurrentFilters(filters)
    loadContracts(filters)
  }, [loadContracts])

  const clearFilters = useCallback(() => {
    const emptyFilters = {}
    setCurrentFilters(emptyFilters)
    loadContracts(emptyFilters)
  }, [loadContracts])


  // Refresh kontrakt (rensa cache och ladda om)
  const refreshContracts = useCallback(async () => {
    console.log('🔄 Explicit refresh - rensar cache och laddar om kontrakt')
    
    // Rensa cache för att tvinga ny hämtning
    setContractsCache({})
    setFilesLoadedAt({}) // Rensa även filcache
    setContractFiles({})
    
    await loadContracts(currentFiltersRef.current)
    await loadContractStats()
  }, [loadContracts, loadContractStats])

  // Initial loading vid mount
  useEffect(() => {
    loadContracts()
    loadContractStats()
  }, [loadContracts, loadContractStats])

  // Real-time subscription för nya/uppdaterade kontrakt
  useEffect(() => {
    console.log('🔔 Sätter upp real-time subscription för kontrakt...')
    
    const subscription = supabase
      .channel('contracts_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Lyssna på INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'contracts'
        },
        async (payload) => {
          console.log('🔔 Kontrakt-förändring mottagen:', payload)
          
          switch (payload.eventType) {
            case 'INSERT':
              console.log('➕ Nytt kontrakt skapat:', payload.new)
              // Ladda om hela listan för att få relationer
              await refreshContracts()
              toast.success('Nytt kontrakt skapat')
              break
              
            case 'UPDATE':
              console.log('🔄 Kontrakt uppdaterat:', payload.new)
              // Uppdatera specifikt kontrakt i state
              const updatedContract = payload.new as Contract
              setContracts(prev => 
                prev.map(contract => 
                  contract.id === updatedContract.id
                    ? { ...contract, ...updatedContract }
                    : contract
                )
              )
              
              // Uppdatera stats också
              loadContractStats()
              break
              
            case 'DELETE':
              console.log('🗑️ Kontrakt borttaget:', payload.old)
              const deletedId = payload.old.id
              setContracts(prev => prev.filter(contract => contract.id !== deletedId))
              loadContractStats()
              break
          }
        }
      )
      .subscribe()

    return () => {
      console.log('🔕 Stänger av real-time subscription för kontrakt')
      subscription.unsubscribe()
    }
  }, [refreshContracts, loadContractStats])

  // Real-time subscription för contract_files
  useEffect(() => {
    console.log('🔔 Sätter upp real-time subscription för contract files...')
    
    const filesSubscription = supabase
      .channel('contract_files_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Lyssna på INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'contract_files'
        },
        (payload) => {
          console.log('🔔 Contract files-förändring mottagen:', payload)
          
          const fileData = payload.new as ContractFile || payload.old as ContractFile
          
          switch (payload.eventType) {
            case 'INSERT':
              console.log('➕ Ny contract file skapad:', payload.new)
              // Lägg till filen i rätt kontrakt
              setContractFiles(prev => ({
                ...prev,
                [fileData.contract_id]: [...(prev[fileData.contract_id] || []), payload.new as ContractFile]
              }))
              break
              
            case 'UPDATE':
              console.log('🔄 Contract file uppdaterad:', payload.new)
              // Uppdatera specifik fil i state
              const updatedFile = payload.new as ContractFile
              setContractFiles(prev => ({
                ...prev,
                [updatedFile.contract_id]: (prev[updatedFile.contract_id] || []).map(file => 
                  file.id === updatedFile.id ? updatedFile : file
                )
              }))
              
              // Om filen blev completed, visa notifikation
              if (updatedFile.download_status === 'completed' && payload.old.download_status !== 'completed') {
                toast.success(`Fil "${updatedFile.file_name}" nedladdad och sparad`)
              }
              break
              
            case 'DELETE':
              console.log('🗑️ Contract file borttagen:', payload.old)
              // Ta bort filen från state
              setContractFiles(prev => ({
                ...prev,
                [fileData.contract_id]: (prev[fileData.contract_id] || []).filter(file => file.id !== fileData.id)
              }))
              break
          }
        }
      )
      .subscribe()

    return () => {
      console.log('🔕 Stänger av real-time subscription för contract files')
      filesSubscription.unsubscribe()
    }
  }, [])

  return {
    // State
    contracts,
    loading,
    error,
    stats,
    
    // Files state
    contractFiles,
    filesLoading,
    downloadingFiles,
    
    // Actions
    loadContracts,
    loadContractStats,
    getContract,
    updateContract,
    deleteContract,
    refreshContracts,
    
    // Files actions
    loadContractFiles,
    downloadContractFile,
    getFileDownloadProgress,
    hasContractFiles,
    
    // Filters
    currentFilters,
    setFilters,
    clearFilters
  }
}

// Specialiserad hook för kontraktstatistik (för dashboard)
export function useContractStats(
  filters: Pick<ContractFilters, 'date_from' | 'date_to'> = {}
) {
  const [stats, setStats] = useState<ContractStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const contractStats = await ContractService.getContractStats(filters)
      setStats(contractStats)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte hämta kontraktstatistik'
      setError(errorMessage)
      console.error('useContractStats fel:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return {
    stats,
    loading,
    error,
    refreshStats: loadStats
  }
}

// Hook för enstaka kontrakt (för detaljer)
export function useContract(id: string | null) {
  const [contract, setContract] = useState<ContractWithSourceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadContract = useCallback(async () => {
    if (!id) {
      setContract(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const contractData = await ContractService.getContract(id)
      setContract(contractData)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte hämta kontrakt'
      setError(errorMessage)
      console.error('useContract fel:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadContract()
  }, [loadContract])

  // Real-time uppdateringar för detta specifika kontrakt
  useEffect(() => {
    if (!id) return

    const subscription = supabase
      .channel(`contract_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contracts',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('🔄 Kontrakt uppdaterat (enstaka):', payload.new)
          setContract(prev => prev ? { ...prev, ...payload.new } : null)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [id])

  return {
    contract,
    loading,
    error,
    refreshContract: loadContract
  }
}