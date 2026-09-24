// src/hooks/useProcurementBadge.ts
// Olästa upphandlingsträffar (matchpoäng från 60, senaste 60 dagarna) för
// sidomenyns räknare, badgeKey 'procurement'. Räknas i databasen av RPC
// procurement_unread_count. Modul-singleton med intervall, samma mönster som
// useTicketsBadge; realtid behövs inte för en räknare som synkas varje timme.
// Vyerna anropar refreshProcurementBadge() efter att något markerats som läst.

import { useEffect, useState } from 'react'
import { ProcurementService } from '../services/procurementService'
import { useProcurementAccess } from './useProcurementAccess'
import { useAuth } from '../contexts/AuthContext'

type Listener = (count: number) => void

const store = {
  count: 0,
  userId: null as string | null,
  listeners: new Set<Listener>(),
  interval: null as ReturnType<typeof setInterval> | null,
}

async function refetch() {
  if (!store.userId) return
  try {
    const next = await ProcurementService.getUnreadCount()
    if (next !== store.count) {
      store.count = next
      store.listeners.forEach((l) => l(next))
    }
  } catch {
    // Tyst: räknaren är inte kritisk
  }
}

function stop() {
  if (store.interval) clearInterval(store.interval)
  store.interval = null
  store.userId = null
  store.count = 0
}

/** Hämta om räknaren direkt, t.ex. efter att en upphandling öppnats */
export function refreshProcurementBadge(): void {
  void refetch()
}

export function useProcurementBadge(): number {
  const { user } = useAuth()
  const { allowed } = useProcurementAccess()
  const [count, setCount] = useState(store.count)

  useEffect(() => {
    const listener: Listener = (c) => setCount(c)
    store.listeners.add(listener)
    if (user?.id && allowed) {
      if (store.userId !== user.id) {
        stop()
        store.userId = user.id
        void refetch()
        store.interval = setInterval(() => void refetch(), 5 * 60 * 1000)
      }
    } else {
      stop()
    }
    setCount(store.count)
    return () => {
      store.listeners.delete(listener)
      if (store.listeners.size === 0) stop()
    }
  }, [user?.id, allowed])

  return allowed ? count : 0
}
