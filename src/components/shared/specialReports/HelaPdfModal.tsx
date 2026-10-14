// src/components/shared/specialReports/HelaPdfModal.tsx
// "Hela PDF:en" (3.55.0): rapportens sidor i helskärm. Miniatyrer av alla sidor
// till vänster (klick visar sidan), den valda sidan i stort i mitten med samma
// sidrendering som förhandsvisningen. Föregående och nästa, piltangenterna och
// "Sida N av M". Ladda ner PDF och Skicka till kund finns i huvudet. Escape
// stänger. Det här är HTML-förhandsvisningen; den riktiga PDF:en skapas av
// servern när man laddar ner eller skickar.
// Egen portal till document.body enligt modalstandarden (Modal.tsx har ingen
// helskärmsstorlek). Inga kort, inga piller.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import type { SpecialReportFull } from '../../../types/specialReport'
import { RapportSida, SIDA_B, SIDA_H, SkaladSida, useRapportSidor } from './rapportSidor'

interface HelaPdfModalProps {
  isOpen: boolean
  onClose: () => void
  report: SpecialReportFull
  /** Vyn i redigeraren: modalen öppnar på den vyns första sida */
  vy: string
  hamtarPdf: boolean
  onLaddaNer: () => void
  onSkicka: () => void
}

export default function HelaPdfModal(props: HelaPdfModalProps) {
  if (!props.isOpen) return null
  return createPortal(<Innehall {...props} />, document.body)
}

function Innehall({ onClose, report, vy, hamtarPdf, onLaddaNer, onSkicka }: HelaPdfModalProps) {
  const { sidor, logiska, matning } = useRapportSidor(report)
  // Utan eget val visas vyns första sida (räknas om när mätningen ändrar sidorna)
  const [valt, setValt] = useState<number | null>(null)
  const ytaRef = useRef<HTMLDivElement>(null)
  const stangRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [yta, setYta] = useState({ b: 0, h: 0 })

  // Sidantalet kan ändras när mätningen är klar: håll index inom ramarna
  const i = Math.min(valt ?? Math.max(0, sidor.findIndex(s => s.logisk === vy)), Math.max(0, sidor.length - 1))
  const setIndex = (n: number) => setValt(Math.max(0, Math.min(sidor.length - 1, n)))
  const sida = sidor[i]
  const logisk = sida ? logiska.get(sida.logisk) : undefined

  // Den valda sidan så stor som ytan tillåter
  useEffect(() => {
    const el = ytaRef.current
    if (!el) return
    const satt = () => {
      const r = el.getBoundingClientRect()
      setYta({ b: r.width, h: r.height })
    }
    satt()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(satt)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const storBredd = Math.max(200, Math.min(yta.b - 36, ((yta.h - 36) * SIDA_B) / SIDA_H, 760))

  // Rullar inte sidan bakom, fokus på Stäng
  useEffect(() => {
    const forra = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const tidigare = document.activeElement as HTMLElement | null
    stangRef.current?.focus()
    return () => {
      document.body.style.overflow = forra
      // Fokus tillbaka bara om ingen annan tagit det (Skicka till kund öppnar utskicket direkt)
      const nu = document.activeElement
      if ((!nu || nu === document.body) && tidigare?.isConnected) tidigare.focus()
    }
  }, [])

  // Escape stänger, piltangenterna bläddrar, Tab stannar i dialogen
  useEffect(() => {
    const tangent = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key === 'Tab') {
        const fokuserbara = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
          .filter(el => el.offsetParent !== null)
        if (fokuserbara.length === 0) return
        const forstaEl = fokuserbara[0]
        const sistaEl = fokuserbara[fokuserbara.length - 1]
        const aktivEl = document.activeElement as HTMLElement | null
        const inne = !!aktivEl && !!dialogRef.current?.contains(aktivEl)
        if (e.shiftKey && (!inne || aktivEl === forstaEl)) { e.preventDefault(); sistaEl.focus() }
        else if (!e.shiftKey && (!inne || aktivEl === sistaEl)) { e.preventDefault(); forstaEl.focus() }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setValt(Math.max(0, i - 1)) }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setValt(Math.min(sidor.length - 1, i + 1)) }
    }
    document.addEventListener('keydown', tangent)
    return () => document.removeEventListener('keydown', tangent)
  }, [onClose, i, sidor.length])

  // Miniatyren för den valda sidan hålls synlig
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [i])

  const knapp = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2.5 text-xs text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 disabled:opacity-40'

  return (
    <div className="fixed inset-0 z-[9990] flex bg-black/70 p-0 backdrop-blur-sm sm:p-5" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {matning}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="hela-pdf-titel" className="flex h-full w-full flex-col overflow-hidden border-slate-700 bg-slate-900 sm:rounded-2xl sm:border">
        {/* Huvud */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 sm:pl-4">
          <div className="min-w-0 flex-1">
            <h2 id="hela-pdf-titel" className="truncate text-[15px] font-bold text-white">Hela rapporten</h2>
            <p className="truncate text-xs text-slate-400">Förhandsvisning, den riktiga PDF:en skapas när du laddar ner eller skickar</p>
          </div>
          <button type="button" aria-label="Föregående sida" disabled={i <= 0} onClick={() => setIndex(i - 1)} className={`${knapp} w-8 px-0`}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[78px] text-center text-xs tabular-nums text-slate-300">Sida {i + 1} av {sidor.length}</span>
          <button type="button" aria-label="Nästa sida" disabled={i >= sidor.length - 1} onClick={() => setIndex(i + 1)} className={`${knapp} w-8 px-0`}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="mx-1 hidden h-5 w-px bg-slate-700 sm:block" aria-hidden="true" />
          <button type="button" onClick={onLaddaNer} disabled={hamtarPdf} className={knapp}>
            {hamtarPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="rapport.ladda" size={16} />}
            <span className="hidden sm:inline">Ladda ner PDF</span>
          </button>
          <button
            type="button"
            onClick={onSkicka}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#20c58f] px-3 text-xs font-bold text-[#04140d] hover:bg-[#1ba876] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
          >
            <Icon name="rapport.skicka" size={16} />
            <span className="hidden sm:inline">Skicka till kund</span>
          </button>
          <button ref={stangRef} type="button" aria-label="Stäng" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
            <Icon name="allman.stang" size={20} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Miniatyrer */}
          <div ref={listaRef} className="hidden w-[150px] flex-shrink-0 flex-col items-center gap-3 overflow-y-auto border-r border-slate-800 bg-slate-950/40 px-3 py-3 md:flex">
            {sidor.map((s, n) => {
              const l = logiska.get(s.logisk)
              if (!l) return null
              const vald = n === i
              return (
                <button
                  key={s.key}
                  type="button"
                  data-index={n}
                  onClick={() => setIndex(n)}
                  aria-label={`Sida ${n + 1}, ${l.namn}`}
                  aria-current={vald ? 'page' : undefined}
                  className="flex flex-col items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
                >
                  <span className="pointer-events-none block rounded-[3px]" style={{ boxShadow: `0 0 0 2px ${vald ? '#20c58f' : 'transparent'}` }}>
                    <SkaladSida bredd={84} hojd={s.hojd} style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.25)' }}>
                      <RapportSida report={report} sida={s} logisk={l} antal={sidor.length} miniatyr />
                    </SkaladSida>
                  </span>
                  <span className={`max-w-[110px] truncate text-[11px] ${vald ? 'font-semibold text-emerald-400' : 'text-slate-400'}`}>
                    {n + 1}. {l.namn}{s.del > 0 ? ' forts.' : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Den valda sidan */}
          <div ref={ytaRef} className="flex min-w-0 flex-1 items-start justify-center overflow-auto bg-slate-950 p-[18px]">
            {sida && logisk && (
              <SkaladSida bredd={storBredd} hojd={sida.hojd} style={{ boxShadow: '0 6px 20px rgba(15,23,42,0.3)', borderRadius: 2 }}>
                <RapportSida report={report} sida={sida} logisk={logisk} antal={sidor.length} />
              </SkaladSida>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
