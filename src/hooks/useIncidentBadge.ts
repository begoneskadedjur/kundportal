// src/hooks/useIncidentBadge.ts
// Räknar ohanterade incidenter (status = 'ny') inom användarens mottagartyper,
// för badge i sidomenyn. Modul-singleton så att flera komponenter kan använda
// hooken utan dubbla prenumerationer. Realtid via postgres_changes med
// intervall-fallback ifall realtidskanalen inte levererar.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { IncidentRecipientService } from '../services/incidentRecipientService'

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
    const types = await IncidentRecipientService.getRecipientTypes(userId)
    if (store.userId !== userId) return
    if (types.size === 0) {
      if (store.count !== 0) { store.count = 0; emit() }
      return
    }
    const { count } = await supabase
      .from('case_incidents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ny')
      .in('type', [...types])
    if (store.userId !== userId) return
    const next = count || 0
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
    .channel('incident-badge')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'case_incidents' }, () => refetch())
    .subscribe()
  store.interval = setInterval(refetch, 120000)
}

/** Antal ohanterade incidenter inom den inloggades mottagartyper (0 för icke-mottagare) */
export function useIncidentBadge(): number {
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
