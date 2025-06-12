import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import type { Customer, Case, Stats } from '../types'

export function useCustomerData() {
  const { user } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [stats, setStats] = useState<Stats>({
    activeCases: 0,
    completedCases: 0,
    nextVisit: null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.email) {
      loadCustomerData()
    }
  }, [user])

  const loadCustomerData = async () => {
    try {
      setLoading(true)

      // Load user profile and customer info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          customers (*)
        `)
        .eq('id', user?.id)
        .single()

      if (profileError) throw profileError

      if (profile?.customers && Array.isArray(profile.customers) && profile.customers.length > 0) {
        const customerData = profile.customers[0] as Customer
        setCustomer(customerData)

        // Load cases for this customer
        const { data: casesData, error: casesError } = await supabase
          .from('cases')
          .select(`
            *,
            visits (*)
          `)
          .eq('customer_id', customerData.id)
          .order('created_date', { ascending: false })

        if (casesError) throw casesError
        
        const typedCases = (casesData || []) as Case[]
        setCases(typedCases)

        // Calculate stats
        const activeCases = typedCases.filter((c: Case) => c.status === 'pending' || c.status === 'in_progress').length
        const completedCases = typedCases.filter((c: Case) => c.status === 'completed').length
        
        const nextVisit = typedCases
          .filter((c: Case) => c.scheduled_date && new Date(c.scheduled_date) > new Date())
          .sort((a: Case, b: Case) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())[0] || null

        setStats({
          activeCases,
          completedCases,
          nextVisit
        })
      }

    } catch (error) {
      console.error('Error loading customer data:', error)
    } finally {
      setLoading(false)
    }
  }

  return {
    customer,
    cases,
    stats,
    loading,
    refetch: loadCustomerData
  }
}