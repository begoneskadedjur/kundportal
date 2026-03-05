// src/hooks/useOfferStats.ts — Hook för offertstatistik (direkt från contracts-tabellen)
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { OfferStats } from '../types/casePipeline'
import { OFFER_TEMPLATES } from '../constants/oneflowTemplates'

const OFFER_TEMPLATE_IDS = OFFER_TEMPLATES.map(t => t.id)

export function useOfferStats() {
  const [stats, setStats] = useState<OfferStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('contracts')
      .select('status, total_value')
      .in('template_id', OFFER_TEMPLATE_IDS)
      .neq('status', 'draft')
      .neq('status', 'trashed')
      .then(({ data, error }) => {
        if (error || !data) return

        let signed = 0
        let declined = 0
        let pending = 0
        let overdue = 0
        let total_value_signed = 0
        let total_value_sent = 0

        for (const row of data) {
          const value = Number(row.total_value) || 0
          total_value_sent += value

          switch (row.status) {
            case 'signed':
              signed++
              total_value_signed += value
              break
            case 'declined':
              declined++
              break
            case 'pending':
              pending++
              break
            case 'overdue':
              overdue++
              break
          }
        }

        const resolved = signed + declined + overdue
        const sign_rate = resolved > 0
          ? Math.round((signed / resolved) * 100 * 100) / 100
          : 0

        setStats({
          total_sent: data.length,
          signed,
          declined,
          pending,
          overdue,
          sign_rate,
          total_value_sent,
          total_value_signed,
          last_synced_at: new Date().toISOString(),
        })
      })
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading }
}
