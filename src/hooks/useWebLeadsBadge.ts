// src/hooks/useWebLeadsBadge.ts
// Antal webbförfrågningar med status ny, för sidomenyns räknare (badgeKey 'webLeads') på Leads (Webb).
// Räknas i databasen av RPC web_inquiries_new_count (0 för den som inte är admin, koordinator eller
// säljare). Modul-singleton med realtid på web_inquiries och intervall som reserv, samma mönster som
// useIncidentBadge. Ersätter notisen i klockan tills notistypen web_inquiry är tillåten.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { WebInquiryService } from '../services/webInquiryService'

type Listener = (count: number) => void

const store = {
  count: 0,
  listeners: new Set<Listener>(),
  userId: null as string | null,
  channel: null as ReturnType<typeof supabase.channel> | null,
  interval: null as ReturnType<typeof setInterval> | null,
}

function emit() {
  store.listeners.forEach((l) => l(store.count))
}

async function refetch() {
  const userId = store.userId
  if (!userId) return
  try {
    const next = await WebInquiryService.getNewCount()
    if (store.userId !== userId) return
    if (next !== store.count) {
      store.count = next
      emit()
    }
  } catch {
    // Tyst: räknaren är inte kritisk
  }
}

function stop() {
  if (store.channel) {
    supabase.removeChannel(store.channel)
    store.channel = null
  }
  if (store.interval) {
    clearInterval(store.interval)
    store.interval = null
  }
  store.userId = null
  store.count = 0
}

function ensureStarted(userId: string) {
  if (store.userId === userId) return
  stop()
  store.userId = userId
  void refetch()
  store.channel = supabase
    .channel('web-leads-badge')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'web_inquiries' }, () => void refetch())
    .subscribe()
  store.interval = setInterval(() => void refetch(), 120000)
}

/** Hämta om räknaren direkt, t.ex. efter ett statusbyte */
export function refreshWebLeadsBadge(): void {
  void refetch()
}

const ROLLER = ['admin', 'koordinator', 'säljare']

export function useWebLeadsBadge(): number {
  const { user, profile } = useAuth()
  const behorig =
    !!profile &&
    (ROLLER.includes(profile.role ?? '') || (profile.extra_roles ?? []).some((r) => ROLLER.includes(r)))
  const [count, setCount] = useState(store.count)

  useEffect(() => {
    const listener: Listener = (n) => setCount(n)
    store.listeners.add(listener)
    if (user?.id && behorig) {
      ensureStarted(user.id)
    } else {
      stop()
    }
    setCount(store.count)
    return () => {
      store.listeners.delete(listener)
      if (store.listeners.size === 0) stop()
    }
  }, [user?.id, behorig])

  return behorig ? count : 0
}
