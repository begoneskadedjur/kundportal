// src/hooks/useVersionWatch.ts
// Versionsvakt: märker när en nyare version av portalen finns på servern.
//
// Bygget skriver /version.json med en byggstämpel och stämplar samma värde in
// i appen (__APP_BUILD__). Vakten hämtar filen när appen startar, när den
// kommer tillbaka i förgrunden och var femtonde minut, alltid förbi cachen.
// Skiljer sig stämpeln finns en ny version. Vakten laddar aldrig om själv:
// det gör UpdateWatcher vid nästa sidbyte, eller användaren via knappen.
//
// Fångar luckan i appläget: en app som legat pausad i bakgrunden över en
// deploy hämtar annars ingenting förrän den startas om på riktigt.

import { useCallback, useEffect, useRef, useState } from 'react'

const CHECK_INTERVAL_MS = 15 * 60 * 1000
const MIN_GAP_MS = 60 * 1000
const RELOADED_FOR_KEY = 'begone:version:reloaded-for'

interface RemoteVersion {
  build: string
  version: string
}

export interface VersionWatch {
  /** En nyare byggstämpel finns på servern */
  updateAvailable: boolean
  /** Versionsnumret ur uppdateringsloggen för den nya versionen */
  newVersion: string | null
  /** false efter att vi redan laddat om för den här stämpeln utan att få den - skydd mot loop */
  canAutoReload: boolean
  reload: () => void
}

function readReloadedFor(): string | null {
  try {
    return sessionStorage.getItem(RELOADED_FOR_KEY)
  } catch {
    return null
  }
}

function writeReloadedFor(build: string): void {
  try {
    sessionStorage.setItem(RELOADED_FOR_KEY, build)
  } catch {
    /* privat läge */
  }
}

export function useVersionWatch(): VersionWatch {
  const [remote, setRemote] = useState<RemoteVersion | null>(null)
  const lastCheckRef = useRef(0)

  useEffect(() => {
    // version.json finns bara i byggd form
    if (import.meta.env.DEV) return

    let cancelled = false

    const check = async (force = false) => {
      const now = Date.now()
      if (!force && now - lastCheckRef.current < MIN_GAP_MS) return
      lastCheckRef.current = now
      try {
        const res = await fetch(`/version.json?t=${now}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { build?: unknown; version?: unknown }
        if (cancelled || typeof data.build !== 'string') return
        if (data.build !== __APP_BUILD__) {
          setRemote({ build: data.build, version: typeof data.version === 'string' ? data.version : '' })
        }
      } catch {
        // Utan nät eller mitt i en deploy - försök igen nästa gång
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }

    void check(true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(timer)
    }
  }, [])

  const reload = useCallback(() => {
    if (remote) writeReloadedFor(remote.build)
    window.location.reload()
  }, [remote])

  return {
    updateAvailable: remote !== null,
    newVersion: remote?.version || null,
    canAutoReload: remote !== null && readReloadedFor() !== remote.build,
    reload,
  }
}
