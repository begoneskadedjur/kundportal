// src/hooks/useClickUpSync.ts
// REACT HOOK FÖR ENKEL INTEGRATION MED BEFINTLIGA KOMPONENTER

import { useState, useCallback } from 'react'
import { syncCaseToClickUp, updateClickUpTask, SyncResult } from '../services/clickupSync'
import toast from 'react-hot-toast'

interface ClickUpSyncState {
  syncing: boolean
  lastResult: SyncResult | null
}

export function useClickUpSync() {
  const [state, setState] = useState<ClickUpSyncState>({
    syncing: false,
    lastResult: null
  })

  /**
   * Synkronisera case till ClickUp efter skapande
   * Använd denna i CreateCaseModal efter lyckad Supabase insert
   */
  const syncAfterCreate = useCallback(async (caseId: string, caseType: 'private' | 'business', showToast = true) => {
    setState(prev => ({ ...prev, syncing: true }))

    try {
      const result = await syncCaseToClickUp(caseId, caseType)
      
      setState(prev => ({ 
        ...prev, 
        syncing: false, 
        lastResult: result 
      }))

      if (showToast) {
        if (result.success) {
          toast.success(`✅ Ärendet synkroniserat till ClickUp (${result.clickup_task_id})`)
        } else {
          toast.error(`❌ Kunde inte synkronisera till ClickUp: ${result.error}`)
        }
      }

      return result

    } catch (error) {
      const errorResult: SyncResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      setState(prev => ({ 
        ...prev, 
        syncing: false, 
        lastResult: errorResult 
      }))

      if (showToast) {
        toast.error(`❌ Synkroniseringsfel: ${errorResult.error}`)
      }

      return errorResult
    }
  }, [])

  /**
   * Uppdatera ClickUp task efter redigering
   * Använd denna i EditCaseModal efter lyckad Supabase update
   */
  const syncAfterUpdate = useCallback(async (caseId: string, caseType: 'private' | 'business', showToast = true) => {
    setState(prev => ({ ...prev, syncing: true }))

    try {
      const result = await updateClickUpTask(caseId, caseType)
      
      setState(prev => ({ 
        ...prev, 
        syncing: false, 
        lastResult: result 
      }))

      if (showToast) {
        if (result.success) {
          toast.success(`✅ ClickUp uppdaterat (${result.clickup_task_id})`)
        } else {
          toast.error(`❌ Kunde inte uppdatera ClickUp: ${result.error}`)
        }
      }

      return result

    } catch (error) {
      const errorResult: SyncResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      setState(prev => ({ 
        ...prev, 
        syncing: false, 
        lastResult: errorResult 
      }))

      if (showToast) {
        toast.error(`❌ Uppdateringsfel: ${errorResult.error}`)
      }

      return errorResult
    }
  }, [])

  /**
   * Tyst synkronisering utan toast-meddelanden
   */
  const syncSilent = useCallback(async (caseId: string, caseType: 'private' | 'business', operation: 'create' | 'update') => {
    if (operation === 'create') {
      return syncAfterCreate(caseId, caseType, false)
    } else {
      return syncAfterUpdate(caseId, caseType, false)
    }
  }, [syncAfterCreate, syncAfterUpdate])

  /**
   * Återställ state
   */
  const resetState = useCallback(() => {
    setState({
      syncing: false,
      lastResult: null
    })
  }, [])

  return {
    // State
    syncing: state.syncing,
    lastResult: state.lastResult,
    
    // Actions
    syncAfterCreate,
    syncAfterUpdate,
    syncSilent,
    resetState
  }
}