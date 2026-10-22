// src/components/technician/ny/schema/useKortid.ts
// Körtid mellan två besök i schemat: förra besökets adress geokodas (samma minne som
// kartan) och restiden räknas med restidService.beraknaRestid till nästa adress.
//
// Anropen begränsas: bara de par som skickas in (vald dag i telefonen, vald vecka från
// idag och framåt på datorn), ett i taget, och varje adresspar räknas en gång per session.
// Går det inte att räkna sparas null och ingen rad visas.

import { useEffect, useMemo, useState } from 'react'
import { beraknaRestid, type Restid } from '../../../../services/restidService'
import { geokoda } from '../../../../services/geokodService'

export interface KortidPar {
  /** Nyckeln för besöket som körtiden leder till */
  nyckel: string
  fran: string
  till: string
}

// Adresspar som redan räknats under sessionen. null = gick inte att räkna.
const parCache = new Map<string, Restid | null>()

function parNyckel(fran: string, till: string): string {
  return `${fran.trim().toLowerCase()}|${till.trim().toLowerCase()}`
}

/** Körtid per besöksnyckel. Saknas nyckeln är den inte räknad (än). */
export function useKortid(par: KortidPar[], mapsKlar: boolean): Map<string, Restid | null> {
  const [, setVersion] = useState(0)
  const signatur = useMemo(() => par.map(p => `${p.nyckel}:${parNyckel(p.fran, p.till)}`).join('#'), [par])

  useEffect(() => {
    if (!mapsKlar || par.length === 0) return
    if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) return
    let avbruten = false
    const geocoder = new google.maps.Geocoder()
    ;(async () => {
      for (const p of par) {
        if (avbruten) return
        const k = parNyckel(p.fran, p.till)
        if (parCache.has(k)) continue
        const fran = await geokoda(geocoder, p.fran)
        if (avbruten) return
        const restid = fran ? await beraknaRestid(fran, p.till) : null
        parCache.set(k, restid)
        if (avbruten) return
        setVersion(v => v + 1)
        await new Promise(r => setTimeout(r, 150))
      }
    })()
    return () => { avbruten = true }
    // signatur fångar innehållet i par
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatur, mapsKlar])

  const ut = new Map<string, Restid | null>()
  for (const p of par) {
    const k = parNyckel(p.fran, p.till)
    if (parCache.has(k)) ut.set(p.nyckel, parCache.get(k) ?? null)
  }
  return ut
}

/** "12 min körning" */
export function kortidText(r: Restid): string {
  const tid = r.minuter < 60
    ? `${r.minuter} min`
    : `${Math.floor(r.minuter / 60)} tim${r.minuter % 60 ? ` ${r.minuter % 60} min` : ''}`
  return `${tid} körning`
}

/** "12 min" för veckorutnätet */
export function kortidKort(r: Restid): string {
  return r.minuter < 60 ? `${r.minuter} min` : `${Math.floor(r.minuter / 60)} tim${r.minuter % 60 ? ` ${r.minuter % 60}` : ''}`
}
