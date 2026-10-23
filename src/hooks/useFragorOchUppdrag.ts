// src/hooks/useFragorOchUppdrag.ts
// Data för sidan Frågor och uppdrag: EN hämtning per vy (getInboxThreads) med filtret i
// frågan, realtid på case_comments och den inloggades läskvitton, och Visa fler för Klara.
// Räknaren i menyerna (useTicketsBadge) får samma siffra härifrån när sidan är öppen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getInboxThreads, type InkorgData } from '../services/communicationService'
import {
  analysKontor, analysMin, byggTradar, effektivaRoller, kvittonPerKommentar,
  type KontorAnalys, type Mig, type MinAnalys, type Trad,
} from '../components/fragor/fragorLogik'
import { publiceraVantarAntal } from './useTicketsBadge'

export type FragorLage = 'mine' | 'all'

const KLARA_SIDA = 20

export interface FragorRad {
  trad: Trad
  min: MinAnalys
  kontor: KontorAnalys
}

export function useMig(): Mig | null {
  const { user, profile, activeView } = useAuth()
  return useMemo(() => {
    if (!user || !profile) return null
    return {
      id: user.id,
      namn: profile.display_name || profile.technicians?.name || profile.email || '',
      roller: effektivaRoller(profile),
      arKontor: activeView === 'admin' || activeView === 'koordinator',
    }
  }, [user, profile, activeView])
}

export function useFragorOchUppdrag(lage: FragorLage) {
  const mig = useMig()
  const [data, setData] = useState<InkorgData | null>(null)
  const [dataLage, setDataLage] = useState<FragorLage | null>(null)
  const [laddar, setLaddar] = useState(true)
  const [fel, setFel] = useState<string | null>(null)
  const [klaraGrans, setKlaraGrans] = useState(KLARA_SIDA)
  const sekvens = useRef(0)

  const migId = mig?.id
  const rollNyckel = mig?.roller.join(',') || ''

  const hamta = useCallback(async () => {
    if (!migId) return
    const seq = ++sekvens.current
    try {
      const d = await getInboxThreads({
        userId: migId,
        roller: rollNyckel ? rollNyckel.split(',') : [],
        lage,
        klaraGrans,
      })
      if (seq !== sekvens.current) return
      setData(d)
      setDataLage(lage)
      setFel(null)
    } catch (e) {
      if (seq !== sekvens.current) return
      console.error('[FragorOchUppdrag]', e)
      setFel('Kunde inte hämta frågor och uppdrag')
    } finally {
      if (seq === sekvens.current) setLaddar(false)
    }
  }, [migId, rollNyckel, lage, klaraGrans])

  useEffect(() => {
    setLaddar(true)
    hamta()
  }, [hamta])

  // Realtid: nya, ändrade och borttagna kommentarer, och egna läskvitton
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!migId) return
    const om = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => { hamta() }, 500)
    }
    const kanal = supabase
      .channel(`fragor-${lage}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'case_comments' }, om)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_read_receipts' }, om)
      .subscribe()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(kanal)
    }
  }, [migId, lage, hamta])

  const rader: FragorRad[] = useMemo(() => {
    if (!data || !mig) return []
    const karta = kvittonPerKommentar(data.kvitton)
    return byggTradar(data).map(trad => ({
      trad,
      min: analysMin(trad, mig, data.kvitton, karta),
      kontor: analysKontor(trad, mig, data.kvitton, karta),
    }))
  }, [data, mig])

  // En räkning överallt: det som väntar på mig (Frågor till dig + Svar till dig)
  useEffect(() => {
    if (!data || !migId || lage !== 'mine') return
    publiceraVantarAntal(migId, rader.filter(r => r.min.grupp === 'fragor' || r.min.grupp === 'svar').length)
  }, [rader, data, migId, lage])

  const klaraTotalt = data?.klaraTotalt || 0

  return {
    mig,
    rader,
    kvitton: data?.kvitton || [],
    /** Laddar, eller datan hör till ett annat läge än det valda */
    laddar: laddar || dataLage !== lage,
    fel,
    uppdatera: hamta,
    klaraTotalt,
    harFlerKlara: klaraGrans < klaraTotalt,
    visaFlerKlara: () => setKlaraGrans(g => g + KLARA_SIDA),
  }
}
