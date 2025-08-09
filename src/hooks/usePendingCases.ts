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
      
      // Först hämta cases
      const { data: casesData, error: casesError } = await supabase
        .from('cases')
        .select('*')
        .eq('status', 'requested')
        .order('priority', { ascending: false }) // Urgent first
        .order('created_at', { ascending: true }) // Oldest first within priority
      
      if (casesError) throw casesError
      
      // Sen hämta customers för alla customer_ids
      const customerIds = [...new Set(casesData?.map(c => c.customer_id).filter(Boolean) || [])]
      
      let customersMap: Record<string, any> = {}
      if (customerIds.length > 0) {
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .in('id', customerIds)
        
        if (!customersError && customersData) {
          customersMap = Object.fromEntries(customersData.map(c => [c.id, c]))
        }
      }
      
      // Kombinera datan manuellt
      const data = casesData?.map(caseItem => ({
        ...caseItem,
        customer: customersMap[caseItem.customer_id] || null
      }))
      
      console.log('Fetching pending cases, found:', data?.length || 0) // Debug
      console.log('First case data:', data?.[0]) // Debug customer structure

      // No error to check here anymore since we handle it above

      // Map the data to include customer info directly
      const mappedData = (data || []).map(item => {
        // Debug: Check what we're getting
        if (item.customer === null) {
          console.log('Case without customer:', item.id, item.title)
        } else {
          console.log('Customer data for case:', item.customer) // Debug what customer data we get
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