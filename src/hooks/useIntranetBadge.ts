// src/hooks/useIntranetBadge.ts
// Räknar okvitterade obligatoriska intranätdokument för badge i sidomenyn.
// Modul-singleton (samma mönster som useIncidentBadge) så att flera
// komponenter kan använda hooken utan dubbla prenumerationer.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { IntranetService } from '../services/intranetService'

type Listener = (count: number) => void

const store = {
  count: 0,
  listeners: new Set<Listener>(),
  userId: null as string | null,
  channel: null as ReturnType<typeof supabase.channel> | null,
  interval: null as ReturnType<typeof setInterval> | null,
}

function emit() {
  store.listeners.forEach(l => l(store.count))
}

async function refetch() {
  const userId = store.userId
  if (!userId) return
  try {
    const next = await IntranetService.getUnreadCount(userId)
    if (store.userId !== userId) return
    if (next !== store.count) {
      store.count = next
      emit()
    }
  } catch {
    // Tyst - badgen är inte kritisk
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
  refetch()
  store.channel = supabase
    .channel('intranet-badge')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'intranet_documents' }, () => refetch())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'intranet_acknowledgements' }, () => refetch())
    .subscribe()
  store.interval = setInterval(refetch, 180000)
}

/** Uppdatera badgen direkt (t.ex. efter kvittens) utan att vänta på realtid */
export function refreshIntranetBadge() {
  refetch()
}

/** Antal okvitterade obligatoriska intranätdokument för den inloggade */
export function useIntranetBadge(): number {
  const { user } = useAuth()
  const [count, setCount] = useState(store.count)

  useEffect(() => {
    const listener: Listener = n => setCount(n)
    store.listeners.add(listener)
    if (user?.id) {
      ensureStarted(user.id)
    } else {
      stop()
    }
    setCount(store.count)
    return () => {
      store.listeners.delete(listener)
      if (store.listeners.size === 0) stop()
    }
  }, [user?.id])

  return count
}
