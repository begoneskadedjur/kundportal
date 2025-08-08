// src/hooks/useTechnicians.ts
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Technician {
  id: string
  name: string
  email: string
  role: string
  is_active?: boolean
}

export function useTechnicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTechnicians()
  }, [])

  const fetchTechnicians = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: supabaseError } = await supabase
        .from('technicians')
        .select('id, name, email, role, is_active')
        .eq('is_active', true)
        .order('name')
      
      if (supabaseError) throw supabaseError
      
      setTechnicians(data || [])
    } catch (err) {
      console.error('Error fetching technicians:', err)
      setError('Kunde inte hämta tekniker')
    } finally {
      setLoading(false)
    }
  }

  // Filtrera endast de som kan vara avtalsansvariga (oftast alla aktiva)
  const accountManagers = technicians.filter(tech => 
    tech.role === 'Skadedjurstekniker' || 
    tech.role === 'admin' || 
    tech.role === 'koordinator'
  )

  return {
    technicians,
    accountManagers,
    loading,
    error,
    refetch: fetchTechnicians
  }
}