import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useCustomerData() {
  const { user } = useAuth()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState(null)

  useEffect(() => {
    if (!user) return

    const fetchCustomerData = async () => {
      try {
        // 1. Hitta kundens profil
        const { data: profile } = await supabase
          .from('user_profiles')
          .select(`
            customer_id,
            customers (
              id,
              company_name,
              contact_person
            )
          `)
          .eq('user_id', user.id)
          .single()

        if (!profile) {
          console.log('Ingen kundprofil hittad')
          setLoading(false)
          return
        }

        setCustomer(profile.customers)

        // 2. Hämta ärendena för denna kund
        const { data: casesData } = await supabase
          .from('cases')
          .select(`
            *,
            visits (
              id,
              visit_date,
              technician_name
            )
          `)
          .eq('customer_id', profile.customer_id)
          .order('created_date', { ascending: false })

        setCases(casesData || [])
      } catch (error) {
        console.error('Fel vid hämtning av kunddata:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCustomerData()
  }, [user])

  // Beräkna statistik
  const stats = {
    activeCases: cases.filter(c => c.status === 'pending' || c.status === 'in_progress').length,
    completedCases: cases.filter(c => c.status === 'completed').length,
    nextVisit: cases
      .filter(c => c.scheduled_date && new Date(c.scheduled_date) > new Date())
      .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0]
  }

  return {
    cases,
    customer,
    stats,
    loading
  }
}