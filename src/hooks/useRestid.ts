// src/hooks/useRestid.ts
// Hookar för restid i nya arbetsvyn (Idag och Karta), ovanpå restidService.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGoogleMaps } from './useGoogleMaps'
import {
  beraknaRestid, hamtaMinPosition, senastePosition,
  type LatLng, type MinPosition, type Restid,
} from '../services/restidService'

const UPPDATERA_MS = 5 * 60_000

/** useGoogleMaps rapporterar inte laddat om en annan instans lade till skriptet, därför pollar vi också */
export function useMapsKlar(): { klar: boolean; fel: string | null } {
  const { isLoaded, error } = useGoogleMaps({ libraries: ['geometry'] })
  const [klar, setKlar] = useState(() => typeof window !== 'undefined' && !!window.google?.maps)
  useEffect(() => {
    if (isLoaded) { setKlar(true); return }
    if (klar) return
    const t = window.setInterval(() => {
      if (window.google?.maps) { setKlar(true); window.clearInterval(t) }
    }, 300)
    return () => window.clearInterval(t)
  }, [isLoaded, klar])
  return { klar: klar || isLoaded, fel: error }
}

/**
 * Teknikerns position (bilen först, telefonen som reserv). Läses när sidan öppnas,
 * var femte minut medan fliken är synlig och när fliken blir synlig igen efter en paus.
 * uppdatera() läser om direkt, till exempel från knappen Min position.
 */
export function useMinPosition(aktiv = true): {
  position: MinPosition | null
  uppdatera: () => Promise<MinPosition | null>
} {
  const [position, setPosition] = useState<MinPosition | null>(() => senastePosition())
  const senast = useRef(0)

  const las = useCallback(async (tvinga: boolean) => {
    senast.current = Date.now()
    const p = await hamtaMinPosition(tvinga)
    setPosition(p)
    return p
  }, [])

  useEffect(() => {
    if (!aktiv) return
    void las(false)
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void las(true)
    }, UPPDATERA_MS)
    const synlig = () => {
      if (document.visibilityState === 'visible' && Date.now() - senast.current >= UPPDATERA_MS) void las(true)
    }
    document.addEventListener('visibilitychange', synlig)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', synlig)
    }
  }, [aktiv, las])

  const uppdatera = useCallback(() => las(true), [las])
  return { position, uppdatera }
}

/** Restid från positionen till målet. Null när något saknas eller inte går att räkna. */
export function useRestid(position: LatLng | null, till: string | null | undefined, mapsKlar: boolean): Restid | null {
  const [restid, setRestid] = useState<Restid | null>(null)
  const forraMal = useRef<string | null | undefined>(till)
  const lat = position?.lat
  const lng = position?.lng

  useEffect(() => {
    // Nytt mål: töm direkt. Ny position mot samma mål: behåll siffran tills den nya är räknad.
    if (forraMal.current !== till) {
      forraMal.current = till
      setRestid(null)
    }
    if (!mapsKlar || lat === undefined || lng === undefined || !till) return
    let avbruten = false
    beraknaRestid({ lat, lng }, till)
      .then(r => { if (!avbruten) setRestid(r) })
      .catch(() => { /* tyst, inget visas */ })
    return () => { avbruten = true }
  }, [mapsKlar, lat, lng, till])

  return restid
}
