import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import type { Customer, Case, Stats, Visit } from '../types'

export function useCustomerData() {
  const { user } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [stats, setStats] = useState<Stats>({
    activeCases: 0,
    completedCases: 0,
    nextVisit: null,
  })
  const [loading, setLoading] = useState(true)

  const loadCustomerData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Steg 1: Hämta användarens profil och den kopplade kunden
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          customer:customer_id ( * ) 
        `)
        .eq('user_id', user.id)
        .single()

      if (profileError) throw profileError
      
      // Om ingen kund är kopplad till profilen, avbryt och visa ingenting
      if (!profile?.customer) {
          console.log("Ingen kund kopplad till denna profil.")
          setCustomer(null)
          setCases([])
          setStats({ activeCases: 0, completedCases: 0, nextVisit: null })
          setLoading(false)
          return
      }

      const customerData = profile.customer as Customer
      setCustomer(customerData)

      // Steg 2: Hämta alla ärenden och deras relaterade besök för kunden
      const { data: casesData, error: casesError } = await supabase
        .from('cases')
        .select(`
          *,
          visits ( * )
        `)
        .eq('customer_id', customerData.id)
        .order('created_date', { ascending: false })

      if (casesError) throw casesError

      const typedCases = (casesData || []) as Case[]
      setCases(typedCases)

      // Steg 3: Beräkna statistik baserat på den nya datan
      const activeCasesCount = typedCases.filter(c => c.status === 'pending' || c.status === 'in_progress').length
      const completedCasesCount = typedCases.filter(c => c.status === 'completed').length

      // ===== KORRIGERAD LOGIK FÖR "NÄSTA BESÖK" =====
      // 1. Samla alla besök från alla ärenden i en enda lista
      const allVisits = typedCases.flatMap(c => c.visits || []) as Visit[]

      // 2. Filtrera för att bara få framtida besök och sortera dem
      const futureVisits = allVisits
        .filter(v => v.visit_date && new Date(v.visit_date) > new Date())
        .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())

      // 3. Välj det första besöket i listan (det närmaste i tiden)
      const nextVisit = futureVisits.length > 0 ? futureVisits[0] : null
      
      setStats({
        activeCases: activeCasesCount,
        completedCases: completedCasesCount,
        nextVisit: nextVisit,
      })

    } catch (error) {
      console.error('Error loading customer data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadCustomerData()
  }, [loadCustomerData])

  return {
    customer,
    cases,
    stats,
    loading,
    // Byt namn från 'refetch' till 'reloadCustomerData' för tydlighet
    reloadCustomerData: loadCustomerData,
  }
}