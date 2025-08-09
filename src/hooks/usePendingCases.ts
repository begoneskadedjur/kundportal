// src/hooks/usePendingCases.ts - Hook for fetching and managing pending case requests
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Case } from '../types/cases'
import toast from 'react-hot-toast'

interface UsePendingCasesReturn {
  pendingCases: Case[]
  loading: boolean
  error: string | null
  urgentCount: number
  oldRequestsCount: number
  totalCount: number
  refresh: () => Promise<void>
}

export const usePendingCases = (): UsePendingCasesReturn => {
  const [pendingCases, setPendingCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch pending cases
  const fetchPendingCases = async () => {
    try {
      setError(null)
      
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          customer:customers (
            company_name,
            contact_person,
            contact_email,
            contact_phone,
            organization_number
          )
        `)
        .eq('status', 'requested')
        .order('priority', { ascending: false }) // Urgent first
        .order('created_at', { ascending: true }) // Oldest first within priority
      
      console.log('Fetching pending cases, found:', data?.length || 0) // Debug
      console.log('First case data:', data?.[0]) // Debug customer structure

      if (error) throw error

      // Map the data to include customer info directly
      const mappedData = (data || []).map(item => {
        // Debug: Check what we're getting
        if (item.customer === null) {
          console.log('Case without customer:', item.id, item.title)
        }
        
        return {
          ...item,
          customer_name: item.customer?.company_name || 'Okänd kund',
          customer_contact: item.customer?.contact_person,
          customer_email: item.customer?.contact_email,
          customer_phone: item.customer?.contact_phone,
          customer_org_number: item.customer?.organization_number
        }
      })

      setPendingCases(mappedData)
    } catch (error: any) {
      console.error('Error fetching pending cases:', error)
      setError('Kunde inte hämta väntande ärenden')
      toast.error('Kunde inte hämta väntande ärenden')
    } finally {
      setLoading(false)
    }
  }

  // Set up real-time subscription
  useEffect(() => {
    fetchPendingCases()

    const subscription = supabase
      .channel('pending-cases-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
          filter: 'status=eq.requested'
        },
        () => {
          fetchPendingCases() // Refetch on any change
        }
      )
      .subscribe()

    // Also listen for status changes (when cases are scheduled)
    const statusSubscription = supabase
      .channel('case-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cases'
        },
        (payload) => {
          // If a case was just scheduled (no longer requested), remove it
          if (payload.old.status === 'requested' && payload.new.status !== 'requested') {
            setPendingCases(prev => prev.filter(c => c.id !== payload.new.id))
          }
          // If a case became requested, fetch all again
          else if (payload.new.status === 'requested') {
            fetchPendingCases()
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      statusSubscription.unsubscribe()
    }
  }, [])

  // Calculate counts
  const urgentCount = pendingCases.filter(c => c.priority === 'urgent').length
  
  const oldRequestsCount = pendingCases.filter(c => {
    const createdAt = new Date(c.created_at)
    const now = new Date()
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    return hoursDiff > 24
  }).length

  const totalCount = pendingCases.length

  return {
    pendingCases,
    loading,
    error,
    urgentCount,
    oldRequestsCount,
    totalCount,
    refresh: fetchPendingCases
  }
}