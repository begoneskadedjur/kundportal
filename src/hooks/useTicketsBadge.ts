// src/hooks/useTicketsBadge.ts
// Räknar tickets som väntar på den inloggades svar (obesvarade @mentions),
// för badge i sidomenyn — samma siffra som "Väntar på ditt svar" på Tickets-sidan.
// Modul-singleton så att flera komponenter kan använda hooken utan dubbla
// prenumerationer. Realtid via postgres_changes på case_comments med
// intervall-fallback ifall realtidskanalen inte levererar.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getTicketsWithEvents } from '../services/communicationService'

type Listener = (count: number) => void

const store = {
  count: 0,
  listeners: new Set<Listener>(),
  userId: null as string | null,
  channel: null as ReturnType<typeof supabase.channel> | null,
  interval: null as ReturnType<typeof setInterval> | null,
  refetching: false,
}

function emit() {
  store.listeners.forEach(l => l(store.count))
}

async function refetch() {
  const userId = store.userId
  if (!userId || store.refetching) return
  store.refetching = true
  try {
    const { tickets } = await getTicketsWithEvents(userId, 1000, 0, false)
    if (store.userId !== userId) return
    const next = tickets.filter(t => t.unanswered_mentions > 0).length
    if (next !== store.count) {
      store.count = next
      emit()
    }
  } catch {
    // Tyst - badgen är inte kritisk
  } finally {
    store.refetching = false
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
    .channel('tickets-badge')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'case_comments' }, () => refetch())
    .subscribe()
  store.interval = setInterval(refetch, 180000)
}

/** Antal tickets med obesvarade frågor till den inloggade ("Väntar på ditt svar") */
export function useTicketsBadge(): number {
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
