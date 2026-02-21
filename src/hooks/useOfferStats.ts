// src/hooks/useOfferStats.ts — Hook för offertstatistik (cache i Supabase)
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { OfferStats } from '../types/casePipeline'

export function useOfferStats() {
  const [stats, setStats] = useState<OfferStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Läs cachad statistik från Supabase
    supabase
      .from('offer_statistics')
      .select('*')
      .eq('period', 'all_time')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStats({
            total_sent: data.total_sent,
            signed: data.signed,
            declined: data.declined,
            pending: data.pending,
            overdue: data.overdue,
            sign_rate: Number(data.sign_rate),
            total_value_sent: Number(data.total_value_sent),
            total_value_signed: Number(data.total_value_signed),
            last_synced_at: data.last_synced_at,
          })
        }
      })
      .finally(() => setLoading(false))

    // Trigga bakgrunds-refresh via serverless-funktion
    fetch('/api/oneflow/offer-stats').catch(() => {})
  }, [])

  return { stats, loading }
}
