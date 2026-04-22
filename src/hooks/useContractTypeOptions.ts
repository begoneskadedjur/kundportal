// src/hooks/useContractTypeOptions.ts
// Hämtar de tjänster som är flaggade som avtalstyp (services.is_contract_service=true)
// och returnerar dem som { value, label }-alternativ för Select-komponenter.
// Används av kund-redigeringsvyer där admin väljer Avtalstyp.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ContractTypeOption {
  value: string
  label: string
}

export function useContractTypeOptions() {
  const [options, setOptions] = useState<ContractTypeOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('services')
      .select('name')
      .eq('is_contract_service', true)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Kunde inte hämta avtalstyper:', error)
          setOptions([])
        } else {
          setOptions((data ?? []).map(s => ({ value: s.name, label: s.name })))
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { options, loading }
}
