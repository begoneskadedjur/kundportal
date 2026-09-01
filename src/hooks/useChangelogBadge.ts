// src/hooks/useChangelogBadge.ts
// Håller reda på om användaren sett den senaste uppdateringen.
// Lagras lokalt per webbläsare - det här är en notis, inget som behöver
// följa med mellan enheter eller sparas i databasen.

import { useCallback, useEffect, useState } from 'react'
import { LATEST_VERSION } from '../constants/changelog'

const STORAGE_KEY = 'begone:changelog:seen-version'

type Listener = (seen: string | null) => void

const listeners = new Set<Listener>()

function readSeen(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Privat läge eller blockerad lagring - visa hellre pricken än att krascha
    return null
  }
}

/** Markera senaste versionen som sedd och uppdatera alla lyssnare direkt */
export function markChangelogSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, LATEST_VERSION)
  } catch {
    // Ignorera - då syns pricken igen nästa gång, vilket är ofarligt
  }
  listeners.forEach(l => l(LATEST_VERSION))
}

/** True när det finns en uppdatering användaren inte öppnat än */
export function useChangelogBadge(): { hasUnseen: boolean; markSeen: () => void } {
  const [seen, setSeen] = useState<string | null>(() => readSeen())

  useEffect(() => {
    const listener: Listener = value => setSeen(value)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const markSeen = useCallback(() => {
    markChangelogSeen()
  }, [])

  return {
    hasUnseen: Boolean(LATEST_VERSION) && seen !== LATEST_VERSION,
    markSeen,
  }
}
