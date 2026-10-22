// src/pages/shared/intranet/guideSporning.ts
// Läsloggen för handbokens guider (2026-10-22). En rad i intranet_guide_views
// per gång en guide öppnas, uppdaterad medan den är öppen. Admin ser loggen
// under Läskvittenser > Guider.
//
// Aktiv tid räknas bara när fliken syns och man har scrollat, klickat eller
// skrivit den senaste minuten, så en guide som står öppen i bakgrunden inte
// räknas. Loggen skrivs var 20:e sekund och när man lämnar sidan.

import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { IntranetService } from '../../../services/intranetService'
import type { IntranetDocument } from '../../../types/intranet'

export interface GuideSporning {
  /** Ett steg i Gör så här visades (1-baserat) */
  steg: (nr: number) => void
  /** Övningen i Prova själv rördes */
  ovning: () => void
  /** Läget i Kolla att du kan efter ett svar */
  quiz: (besvarade: number, ratt: number, forstaRatt: number) => void
}

const TOM: GuideSporning = { steg: () => {}, ovning: () => {}, quiz: () => {} }

export const GuideSporningContext = createContext<GuideSporning>(TOM)
export const useGuideSporningen = () => useContext(GuideSporningContext)

const TICK_S = 5
const SPARA_VAR_S = 20
const INAKTIV_EFTER_MS = 60_000

interface Lage {
  active_seconds: number
  scroll_pct: number
  max_step: number
  exercise_started_at: string | null
  quiz_answered: number
  quiz_correct: number
  quiz_first_correct: number
}

/**
 * Startar loggningen för en öppnad guide. doc = null stänger av (policys,
 * admin som granskar alla rollers guider, eller medan sidan laddar).
 */
export function useGuideSporning(
  doc: IntranetDocument | null,
  user: { id: string; name: string | null } | null,
  activeView: string
): GuideSporning {
  const lage = useRef<Lage | null>(null)
  const andrad = useRef(false)
  const id = useRef<string | null>(null)
  const start = useRef<Promise<void> | null>(null)

  const docId = doc?.id
  const userId = user?.id

  useEffect(() => {
    if (!doc || !user) return
    const radId = crypto.randomUUID()
    id.current = radId
    lage.current = { active_seconds: 0, scroll_pct: 0, max_step: 0, exercise_started_at: null, quiz_answered: 0, quiz_correct: 0, quiz_first_correct: 0 }
    andrad.current = false

    const visning = doc.content.find(b => b.type === 'visning')
    const quiz = doc.content.find(b => b.type === 'quiz')
    start.current = IntranetService.startGuideView({
      id: radId,
      document_id: doc.id,
      user_id: user.id,
      user_name: user.name,
      version: doc.version,
      active_view: activeView,
      steps_total: visning?.type === 'visning' ? visning.steg.length : null,
      quiz_total: quiz?.type === 'quiz' ? quiz.fragor.length : null,
    }).catch(() => { id.current = null })

    let senastAktiv = Date.now()
    let sedanSparat = 0
    const aktiv = () => { senastAktiv = Date.now() }

    const spara = () => {
      const l = lage.current
      if (!l || !andrad.current || !start.current) return
      andrad.current = false
      const kopia = { ...l, last_seen_at: new Date().toISOString() }
      start.current.then(() => {
        if (id.current === radId) IntranetService.updateGuideView(radId, kopia).catch(() => {})
      })
    }

    const onScroll = () => {
      aktiv()
      const el = document.documentElement
      const total = el.scrollHeight - el.clientHeight
      const pct = total > 0 ? Math.round(Math.min(100, (el.scrollTop / total) * 100)) : 100
      if (lage.current && pct > lage.current.scroll_pct) {
        lage.current.scroll_pct = pct
        andrad.current = true
      }
    }

    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - senastAktiv < INAKTIV_EFTER_MS && lage.current) {
        lage.current.active_seconds += TICK_S
        andrad.current = true
      }
      sedanSparat += TICK_S
      if (sedanSparat >= SPARA_VAR_S) {
        sedanSparat = 0
        spara()
      }
    }, TICK_S * 1000)

    const onSynlighet = () => {
      if (document.visibilityState === 'hidden') spara()
      else aktiv()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointerdown', aktiv, { passive: true })
    window.addEventListener('keydown', aktiv)
    window.addEventListener('pagehide', spara)
    document.addEventListener('visibilitychange', onSynlighet)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointerdown', aktiv)
      window.removeEventListener('keydown', aktiv)
      window.removeEventListener('pagehide', spara)
      document.removeEventListener('visibilitychange', onSynlighet)
      spara()
      lage.current = null
    }
    // Ny rad bara när en annan guide eller person öppnas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, userId])

  return useMemo<GuideSporning>(() => {
    if (!docId || !userId) return TOM
    const satt = (f: (l: Lage) => boolean) => {
      const l = lage.current
      if (l && f(l)) andrad.current = true
    }
    return {
      steg: nr => satt(l => {
        if (nr <= l.max_step) return false
        l.max_step = nr
        return true
      }),
      ovning: () => satt(l => {
        if (l.exercise_started_at) return false
        l.exercise_started_at = new Date().toISOString()
        return true
      }),
      quiz: (besvarade, ratt, forstaRatt) => satt(l => {
        l.quiz_answered = Math.max(l.quiz_answered, besvarade)
        l.quiz_correct = Math.max(l.quiz_correct, ratt)
        l.quiz_first_correct = Math.max(l.quiz_first_correct, forstaRatt)
        return true
      }),
    }
  }, [docId, userId])
}
