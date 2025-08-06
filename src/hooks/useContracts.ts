// src/hooks/useContracts.ts - Hook för contracts state management
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Contract, ContractInsert, ContractUpdate } from '../types/database'
import { 
  ContractService, 
  ContractWithSourceData, 
  ContractFilters, 
  ContractStats 
} from '../services/contractService'
import toast from 'react-hot-toast'

export interface UseContractsReturn {
  // State
  contracts: ContractWithSourceData[]
  loading: boolean
  error: string | null
  stats: ContractStats | null
  
  // Actions
  loadContracts: (filters?: ContractFilters) => Promise<void>
  loadContractStats: (filters?: Pick<ContractFilters, 'date_from' | 'date_to'>) => Promise<void>
  getContract: (id: string) => Promise<ContractWithSourceData | null>
  updateContract: (id: string, updates: ContractUpdate) => Promise<void>
  deleteContract: (id: string) => Promise<void>
  refreshContracts: () => Promise<void>
  
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

  // Ladda kontrakt med filter
  const loadContracts = useCallback(async (filters: ContractFilters = {}) => {
    try {
      setLoading(true)
      setError(null)
      
      const contractList = await ContractService.getContracts(filters)
      setContracts(contractList)
      setCurrentFilters(filters)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel vid hämtning av kontrakt'
      setError(errorMessage)
      console.error('useContracts.loadContracts fel:', err)
    } finally {
      setLoading(false)
    }
  }, [])

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

  // Uppdatera filter
  const setFilters = useCallback((filters: ContractFilters) => {
    setCurrentFilters(filters)
    loadContracts(filters)
  }, [loadContracts])

  // Rensa filter
  const clearFilters = useCallback(() => {
    const emptyFilters = {}
    setCurrentFilters(emptyFilters)
    loadContracts(emptyFilters)
  }, [loadContracts])

  // Refresh kontrakt (använd nuvarande filter)
  const refreshContracts = useCallback(async () => {
    await loadContracts(currentFilters)
    await loadContractStats()
  }, [loadContracts, loadContractStats, currentFilters])

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

  return {
    // State
    contracts,
    loading,
    error,
    stats,
    
    // Actions
    loadContracts,
    loadContractStats,
    getContract,
    updateContract,
    deleteContract,
    refreshContracts,
    
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