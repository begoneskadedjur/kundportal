// src/components/shared/specialReports/ReportPreview.tsx
// Levande förhandsvisning, "Så ser kunden rapporten", byggd direkt från
// redigerarens lokala tillstånd (ingen väntan på sparning).
// 3.55.0: en rulle med alla sidor under varandra, med automatiska sidbrytningar
// (rapportSidor.tsx), sidfot "Sida N av M" och "2.x Namn, fortsättning" överst
// på fortsättningssidor. Delen man redigerar markeras med en tunn linje i
// delens färg vid sidkanten och rullen scrollar dit när man byter del. Klick på
// något på sidan väljer motsvarande fält i redigeraren. Huvudet visar vilka
// sidor delen ligger på och knappen "Hela PDF:en".
// Samma rulle används i spalten, i panelen och i mobilens "Visa som kund".

import { Fragment, useEffect, useRef, useState } from 'react'
import { Icon } from '../../icons/Icon'
import type { SpecialReportFull } from '../../../types/specialReport'
import { byggSidor, sidaForVy } from './specialReportUtils'
import { RapportSida, SIDA_B, SkaladSida, useRapportSidor } from './rapportSidor'

interface ReportPreviewProps {
  report: SpecialReportFull
  /** Vald vy i redigeraren */
  vy: string
  /** Fältet som har fokus (data-falt) */
  fokus: string | null
  /** Klick på något på sidan: välj vyn och fältet */
  onValj: (vy: string, falt: string | null) => void
  /** Öppna Hela PDF:en */
  onHelaPdf?: () => void
  className?: string
}

/** Närmaste förälder som rullar */
function rullandeForalder(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement
  while (p) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
    p = p.parentElement
  }
  return null
}

export default function ReportPreview({ report, vy, fokus, onValj, onHelaPdf, className = '' }: ReportPreviewProps) {
  const { sidor, logiska, matning } = useRapportSidor(report)
  const rotRef = useRef<HTMLDivElement>(null)
  const [bredd, setBredd] = useState(0)

  // Sidans bredd följer behållaren (högst 420 px, plats för linjen vid kanten)
  useEffect(() => {
    const el = rotRef.current
    if (!el) return
    const satt = () => setBredd(Math.round(el.getBoundingClientRect().width))
    satt()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(satt)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const sidBredd = Math.max(160, Math.min(SIDA_B, (bredd || SIDA_B + 24) - 24))

  // Vyn som visas: kartan utan översikt visar första sidan
  const logiskaNycklar = byggSidor(report)
  const aktiv = logiskaNycklar[sidaForVy(logiskaNycklar, vy)]?.key ?? 'om'
  const aktivaSidor = sidor.filter(s => s.logisk === aktiv)
  const forsta = aktivaSidor[0]?.nr ?? 1
  const sista = aktivaSidor[aktivaSidor.length - 1]?.nr ?? forsta
  const sidText = forsta === sista ? `Sida ${forsta} av ${sidor.length}` : `Sida ${forsta} till ${sista} av ${sidor.length}`

  // Byter man del rullar rullen dit (inte när innehållet ändras)
  useEffect(() => {
    const ram = requestAnimationFrame(() => {
      const el = rotRef.current?.querySelector<HTMLElement>(`[data-sida="${aktiv}:0"]`)
      if (!el) return
      const forelder = rullandeForalder(el)
      if (forelder) {
        const topp = el.getBoundingClientRect().top - forelder.getBoundingClientRect().top + forelder.scrollTop - 56
        forelder.scrollTo({ top: Math.max(0, topp), behavior: 'smooth' })
      } else {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    })
    return () => cancelAnimationFrame(ram)
  }, [aktiv])

  return (
    <div ref={rotRef} className={`relative flex w-full flex-col items-center ${className}`}>
      {matning}
      <div className="sticky top-0 z-10 -mx-1 mb-2 flex w-[calc(100%+0.5rem)] items-center gap-2 border-b border-slate-800 bg-slate-950/90 px-2 py-2 backdrop-blur">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-200">Så ser kunden rapporten</span>
        <span className="whitespace-nowrap text-xs tabular-nums text-slate-400">{sidText}</span>
        {onHelaPdf && (
          <button
            type="button"
            onClick={onHelaPdf}
            className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 text-xs text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
          >
            <Icon name="rapport.forhandsgranska" size={16} />
            Hela PDF:en
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-2.5 pb-2">
        {sidor.map(s => {
          const logisk = logiska.get(s.logisk)
          if (!logisk) return null
          const markerad = s.logisk === aktiv
          return (
            <Fragment key={s.key}>
              {s.del > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500" style={{ width: sidBredd }}>
                  <span className="h-px flex-1 bg-slate-700" />
                  <span className="truncate">Ny sida, {logisk.fortsattning.replace(/, fortsättning$/, '')} fortsätter</span>
                  <span className="h-px flex-1 bg-slate-700" />
                </div>
              )}
              <div data-sida={s.key} className="relative">
                {markerad && (
                  <span aria-hidden="true" className="absolute -left-2.5 top-3 bottom-3 w-[3px] rounded-full" style={{ background: logisk.farg }} />
                )}
                <SkaladSida bredd={sidBredd} hojd={s.hojd} style={{ boxShadow: '0 4px 16px rgba(15,23,42,0.22)', borderRadius: 2 }}>
                  <RapportSida report={report} sida={s} logisk={logisk} antal={sidor.length} fokus={fokus} onValj={onValj} />
                </SkaladSida>
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
