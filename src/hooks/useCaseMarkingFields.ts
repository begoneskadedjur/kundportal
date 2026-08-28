// src/hooks/useCaseMarkingFields.ts
// Vilka ärendemärkningsfält (Arbetsorder nr / Objekt / Rum nr) som är obligatoriska
// för en given kund. Flaggorna sätts på huvudkontoret och ÄRVS av enheterna —
// läs aldrig enhetens egen kolumn rått, den är false även när HK har true.
// Samma arvslogik som requiresWorkOrderFlag i koordinatorns CreateCaseModal.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type MarkingFieldKey = 'work_order_number' | 'work_object' | 'room_number'

export interface MarkingField {
  key: MarkingFieldKey
  label: string
}

const FIELD_DEFS: { key: MarkingFieldKey; flag: string; label: string }[] = [
  { key: 'work_order_number', flag: 'work_order_number_enabled', label: 'Arbetsorder nr' },
  { key: 'work_object', flag: 'work_object_enabled', label: 'Objekt' },
  { key: 'room_number', flag: 'room_number_enabled', label: 'Rum nr' },
]

/**
 * Returnerar de märkningsfält kunden kräver. Tom lista = inga fält ska visas.
 * customerId får vara en enhet eller ett huvudkontor — arvet löses här.
 */
export function useCaseMarkingFields(customerId: string | null | undefined) {
  const [fields, setFields] = useState<MarkingField[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customerId) {
      setFields([])
      return
    }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const columns = 'work_order_number_enabled, work_object_enabled, room_number_enabled, parent_customer_id'
        const { data: own } = await supabase
          .from('customers')
          .select(columns)
          .eq('id', customerId)
          .maybeSingle()

        if (cancelled) return
        if (!own) {
          setFields([])
          return
        }

        // Enheter ärver från huvudkontoret — hämta det när kunden har en förälder
        let parent: Record<string, unknown> | null = null
        if (own.parent_customer_id) {
          const { data } = await supabase
            .from('customers')
            .select(columns)
            .eq('id', own.parent_customer_id)
            .maybeSingle()
          parent = data
        }
        if (cancelled) return

        const enabled = FIELD_DEFS.filter(
          ({ flag }) => own[flag as keyof typeof own] === true || parent?.[flag] === true
        )
        setFields(enabled.map(({ key, label }) => ({ key, label })))
      } catch {
        if (!cancelled) setFields([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [customerId])

  return { fields, loading }
}
