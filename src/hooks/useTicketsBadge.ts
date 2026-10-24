// src/hooks/useTicketsBadge.ts
// EN räkning för Tickets överallt (sidomenyer, klockan och nya teknikervyn):
// antalet trådar som väntar på den inloggade: Frågor till dig + Svar till dig, och
// olästa obesvarade frågor till ens roll eller Alla (Christian 2026-10-24). Samma uträkning som sidan (fragorLogik.analysMin), och när sidan är öppen
// skickar den sin siffra hit (publiceraVantarAntal) så att de aldrig visar olika.
// Modul-singleton så att flera komponenter kan använda hooken utan dubbla
// prenumerationer. Realtid via postgres_changes på case_comments och läskvitton,
// med intervall-fallback ifall realtidskanalen inte levererar.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getInboxThreads } from '../services/communicationService'
import { analysMin, byggTradar, effektivaRoller, kvittonPerKommentar, raknasPaKlockan, type Mig } from '../components/fragor/fragorLogik'

type Listener = (count: number) => void

const store = {
  count: 0,
  listeners: new Set<Listener>(),
  userId: null as string | null,
  roller: [] as string[],
  channel: null as ReturnType<typeof supabase.channel> | null,
  interval: null as ReturnType<typeof setInterval> | null,
  timer: null as ReturnType<typeof setTimeout> | null,
  refetching: false,
}

function emit() {
  store.listeners.forEach(l => l(store.count))
}

function satt(n: number) {
  if (n !== store.count) {
    store.count = n
    emit()
  }
}

async function refetch() {
  const userId = store.userId
  if (!userId || store.refetching) return
  store.refetching = true
  try {
    const data = await getInboxThreads({ userId, roller: store.roller, lage: 'mine', klaraGrans: 0 })
    if (store.userId !== userId) return
    const mig: Mig = { id: userId, namn: '', roller: store.roller as Mig['roller'], arKontor: false }
    const karta = kvittonPerKommentar(data.kvitton)
    const n = byggTradar(data)
      .map(t => analysMin(t, mig, data.kvitton, karta))
      .filter(raknasPaKlockan).length
    satt(n)
  } catch {
    // Tyst - räknaren är inte kritisk
  } finally {
    store.refetching = false
  }
}

function snartIgen() {
  if (store.timer) clearTimeout(store.timer)
  store.timer = setTimeout(refetch, 800)
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
  if (store.timer) {
    clearTimeout(store.timer)
    store.timer = null
  }
  store.userId = null
  store.count = 0
}

function ensureStarted(userId: string, roller: string[]) {
  const rollNyckel = roller.join(',')
  if (store.userId === userId && store.roller.join(',') === rollNyckel) return
  stop()
  store.userId = userId
  store.roller = roller
  refetch()
  store.channel = supabase
    .channel('tickets-badge')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'case_comments' }, snartIgen)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comment_read_receipts', filter: `user_id=eq.${userId}` }, snartIgen)
    .subscribe()
  store.interval = setInterval(refetch, 180000)
}

/** Sidan Tickets skickar sin siffra hit, så att menyn visar samma sak */
export function publiceraVantarAntal(userId: string, n: number) {
  if (store.userId && store.userId !== userId) return
  satt(n)
}

/** Antal trådar som väntar på den inloggade (Frågor till dig + Svar till dig) */
export function useTicketsBadge(): number {
  const { user, profile } = useAuth()
  const [count, setCount] = useState(store.count)
  const roller = effektivaRoller(profile)
  const rollNyckel = roller.join(',')

  useEffect(() => {
    const listener: Listener = n => setCount(n)
    store.listeners.add(listener)
    if (user?.id) {
      ensureStarted(user.id, rollNyckel ? rollNyckel.split(',') : [])
    } else {
      stop()
    }
    setCount(store.count)
    return () => {
      store.listeners.delete(listener)
      if (store.listeners.size === 0) stop()
    }
  }, [user?.id, rollNyckel])

  return count
}
