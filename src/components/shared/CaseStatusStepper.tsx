// src/components/shared/CaseStatusStepper.tsx
// Klickbar statusstepper för ärendemodalerna: Öppen ── Bokad ── Avslutat.
// Statusar utanför huvudflödet (Återbesök, Offert skickad m.fl.) visas som
// platt text med statuspunkt till höger om stegen, och hela statuslistan nås via en
// kompakt dropdown så att inga statusval försvinner jämfört med den gamla
// <select>-ytan. Komponenten är ren UI - själva statuslogiken (fakturering,
// provision osv. vid Avslutat) ligger kvar i modalernas submit-handlers.
import React, { Fragment, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Icon } from '../icons/Icon'

interface CaseStatusStepperProps {
  status: string
  /** Alla valbara statusar (samma lista som den gamla dropdownen) */
  statuses: string[]
  onChange: (status: string) => void
  disabled?: boolean
  /** Huvudflödets steg, default Öppen → Bokad → Avslutat */
  steps?: string[]
  /** Datum som visas under respektive steg (samma ordning som steps) */
  stepDates?: (string | null | undefined)[]
}

// Textfärger i samma språk som schemats getStatusStyle
function getStatusTextColor(status: string): string {
  const ls = (status || '').toLowerCase()
  if (ls.includes('avslutat')) return 'text-emerald-300'
  if (ls.startsWith('återbesök')) return 'text-blue-300'
  if (ls.includes('signerad') || ls.startsWith('avtal signerat')) return 'text-[#20c58f]'
  if (ls.includes('offert') || ls.startsWith('avtal s')) return 'text-cyan-300'
  if (ls.includes('bokad') || ls.includes('bokat')) return 'text-amber-300'
  if (ls.includes('pågående')) return 'text-purple-300'
  if (ls.includes('borttag') || ls.includes('stängt') || ls.includes('makuler')) return 'text-red-300'
  if (ls.includes('öppen')) return 'text-sky-300'
  return 'text-slate-300'
}

function formatStepDate(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export default function CaseStatusStepper({
  status,
  statuses,
  onChange,
  disabled = false,
  steps = ['Öppen', 'Bokad', 'Avslutat'],
  stepDates
}: CaseStatusStepperProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [menuOpen])

  const ls = (status || '').toLowerCase()
  const exactIdx = steps.findIndex(s => s.toLowerCase() === ls)
  // Auto-/mellanstatusar (Återbesök, Offert, Pågående...) pausar på mittsteget
  const isIntermediate = exactIdx === -1
  const currentIdx = isIntermediate
    ? (ls.includes('avslutat') ? steps.length - 1 : Math.min(1, steps.length - 1))
    : exactIdx

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/50">
      <div className="flex items-center flex-1 min-w-0">
        {steps.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx && !isIntermediate
          const date = formatStepDate(stepDates?.[i])
          return (
            <Fragment key={step}>
              {i > 0 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded transition-colors duration-300 ${
                    i <= currentIdx ? 'bg-[#20c58f]' : 'bg-slate-700'
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => !disabled && onChange(step)}
                disabled={disabled}
                className={`flex flex-col items-center gap-0.5 transition-colors duration-200 ${
                  disabled ? 'cursor-default' : 'cursor-pointer'
                }`}
                title={disabled ? undefined : `Sätt status till ${step}`}
              >
                <span className={`flex items-center gap-1.5 text-xs font-medium ${
                  done ? 'text-[#20c58f]' : active ? 'text-white' : 'text-slate-500 ' + (disabled ? '' : 'hover:text-slate-300')
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                    done
                      ? 'bg-[#20c58f] border-[#20c58f]'
                      : active
                        ? 'border-[#20c58f] bg-[#20c58f]/20'
                        : 'border-slate-600'
                  }`}>
                    {done
                      ? <Check className="w-3 h-3 text-[#fff]" />
                      : <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#20c58f]' : 'bg-slate-600'}`} />}
                  </span>
                  {step}
                </span>
                {date && <span className="text-[10px] text-slate-500 font-mono leading-none">{date}</span>}
              </button>
            </Fragment>
          )
        })}
      </div>

      {/* Mellanstatus som platt text med statuspunkt (inga piller) */}
      {isIntermediate && (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${getStatusTextColor(status)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {status}
        </span>
      )}

      {/* Fullständig statuslista - inga statusval försvinner. Grön kontur och
          egen ikon så att teknikerna hittar den (önskemål 2026-10-21). */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => !disabled && setMenuOpen(o => !o)}
          disabled={disabled}
          aria-expanded={menuOpen}
          className={`flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors duration-200 ${
            disabled
              ? 'text-slate-600 border-slate-800 cursor-default'
              : menuOpen
                ? 'text-[#20c58f] bg-[#20c58f]/20 border-[#20c58f]'
                : 'text-[#20c58f] bg-[#20c58f]/10 border-[#20c58f]/55 hover:bg-[#20c58f]/20 hover:border-[#20c58f]'
          }`}
          title="Alla statusar"
        >
          <Icon name="arende.status" size={16} />
          Ändra status
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-30 w-56 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 py-1">
            {statuses.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setMenuOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors duration-150 flex items-center gap-2 ${
                  s === status ? 'text-[#20c58f] bg-[#20c58f]/10' : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s === status ? 'bg-[#20c58f]' : 'bg-slate-600'}`} />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
