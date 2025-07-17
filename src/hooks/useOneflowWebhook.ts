// src/hooks/useOneflowWebhook.ts - Hook för att hantera Oneflow webhook status
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface OneflowWebhookLog {
  id: string
  event_type: string
  oneflow_contract_id: string
  status: string
  details: any
  created_at: string
}

interface UseOneflowWebhookReturn {
  // State
  webhookLogs: OneflowWebhookLog[]
  loading: boolean
  error: string | null
  
  // Actions
  fetchWebhookLogs: (contractId?: string) => Promise<void>
  clearLogs: () => void
  refreshLogs: () => Promise<void>
}

export function useOneflowWebhook(): UseOneflowWebhookReturn {
  const [webhookLogs, setWebhookLogs] = useState<OneflowWebhookLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWebhookLogs = useCallback(async (contractId?: string) => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('oneflow_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      // Filtrera på specifikt kontrakt om contractId anges
      if (contractId) {
        query = query.eq('oneflow_contract_id', contractId)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Fel vid hämtning av webhook logs:', fetchError)
        throw new Error(fetchError.message)
      }

      setWebhookLogs(data || [])
      console.log(`✅ Hämtade ${data?.length || 0} webhook logs`)
      
    } catch (err: any) {
      const errorMsg = `Kunde inte hämta webhook logs: ${err.message}`
      console.error('❌', errorMsg)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearLogs = () => {
    setWebhookLogs([])
    setError(null)
  }

  const refreshLogs = useCallback(async () => {
    await fetchWebhookLogs()
  }, [fetchWebhookLogs])

  // Auto-fetch logs vid mount
  useEffect(() => {
    fetchWebhookLogs()
  }, [fetchWebhookLogs])

  // Real-time subscription för nya webhook logs
  useEffect(() => {
    const subscription = supabase
      .channel('oneflow_webhook_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'oneflow_sync_log'
        },
        (payload) => {
          console.log('🔔 Ny webhook log mottagen:', payload.new)
          setWebhookLogs(current => [payload.new as OneflowWebhookLog, ...current])
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return {
    // State
    webhookLogs,
    loading,
    error,
    
    // Actions
    fetchWebhookLogs,
    clearLogs,
    refreshLogs
  }
}