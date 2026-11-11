// src/components/technician/ny/arendeText.ts
// Ärendets beskrivning och senaste rapport, hämtade för ett enskilt besök.
// Finns inte i besökslistornas data (för tungt att hämta för alla ärenden), så de
// läses först när ärendet väljs eller fälls ut. Med medKund hämtas också förra
// avslutade ärendet hos avtalskunden (ett annat ärende, ofta en kollegas).

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hamtaKundhistorik, type DagBesok, type KundhistorikRad } from '../../../services/teknikerDagService'

export interface ArendeText {
  beskrivning: string | null
  rapport: string | null
  /** Förra avslutade ärendet hos kunden. undefined = hämtades inte (ej avtalskund) */
  forra?: KundhistorikRad | null
}

/** Ren text ur fält som ibland innehåller HTML */
export function renText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim()
  return t || null
}

export function useArendeText(b: DagBesok | null, medKund = false): { text: ArendeText | null; laddar: boolean } {
  const [text, setText] = useState<ArendeText | null>(null)
  const [laddar, setLaddar] = useState(false)
  const kalla = b?.kalla
  const id = b?.id
  const kundId = medKund && kalla === 'cases' ? b?.customerId ?? null : null
  useEffect(() => {
    if (!kalla || !id) { setText(null); return }
    let avbruten = false
    setLaddar(true)
    setText(null)
    ;(async () => {
      try {
        const forraP = kundId
          ? hamtaKundhistorik(kundId, id, 1).then(r => r[0] ? { ...r[0], rapport: renText(r[0].rapport) } : null)
          : Promise.resolve(undefined)
        if (kalla === 'cases') {
          const [{ data }, forra] = await Promise.all([
            supabase.from('cases').select('description, work_report').eq('id', id).maybeSingle(),
            forraP,
          ])
          if (!avbruten) setText({ beskrivning: renText(data?.description), rapport: renText(data?.work_report), forra })
        } else {
          const tabell = kalla === 'private' ? 'private_cases' : 'business_cases'
          const { data } = await supabase.from(tabell).select('description, rapport').eq('id', id).maybeSingle()
          if (!avbruten) setText({ beskrivning: renText(data?.description), rapport: renText(data?.rapport) })
        }
      } catch {
        if (!avbruten) setText({ beskrivning: null, rapport: null })
      } finally {
        if (!avbruten) setLaddar(false)
      }
    })()
    return () => { avbruten = true }
  }, [kalla, id, kundId])
  return { text, laddar }
}
