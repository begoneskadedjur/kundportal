// src/components/technician/ny/arendeText.ts
// Ärendets beskrivning och senaste rapport, hämtade för ett enskilt besök.
// Finns inte i besökslistornas data (för tungt att hämta för alla ärenden), så de
// läses först när ärendet väljs eller fälls ut.

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { DagBesok } from '../../../services/teknikerDagService'

export interface ArendeText { beskrivning: string | null; rapport: string | null }

/** Ren text ur fält som ibland innehåller HTML */
export function renText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim()
  return t || null
}

export function useArendeText(b: DagBesok | null): { text: ArendeText | null; laddar: boolean } {
  const [text, setText] = useState<ArendeText | null>(null)
  const [laddar, setLaddar] = useState(false)
  const kalla = b?.kalla
  const id = b?.id
  useEffect(() => {
    if (!kalla || !id) { setText(null); return }
    let avbruten = false
    setLaddar(true)
    setText(null)
    ;(async () => {
      try {
        if (kalla === 'cases') {
          const { data } = await supabase.from('cases').select('description, work_report').eq('id', id).maybeSingle()
          if (!avbruten) setText({ beskrivning: renText(data?.description), rapport: renText(data?.work_report) })
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
  }, [kalla, id])
  return { text, laddar }
}
