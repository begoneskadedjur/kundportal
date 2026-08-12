// src/components/shared/CaseStatusStepper.tsx
// Klickbar statusstepper för ärendemodalerna: Öppen ── Bokad ── Avslutat.
// Statusar utanför huvudflödet (Återbesök, Offert skickad m.fl.) visas som
// färgat chip vid det pausade steget, och hela statuslistan nås via en
// kompakt dropdown så att inga statusval försvinner jämfört med den gamla
// <select>-ytan. Komponenten är ren UI - själva statuslogiken (fakturering,
// provision osv. vid Avslutat) ligger kvar i modalernas submit-handlers.
import React, { Fragment, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

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

// Chipfärger i samma språk som schemats getStatusStyle
function getChipStyle(status: string): string {
  const ls = (status || '').toLowerCase()
  if (ls.includes('avslutat')) return 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
  if (ls.startsWith('återbesök')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  if (ls.includes('signerad')) return 'bg-[#20c58f]/20 text-[#20c58f] border-[#20c58f]/30'
  if (ls.includes('offert')) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
  if (ls.includes('bokad') || ls.includes('bokat')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  if (ls.includes('pågående')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  if (ls.includes('borttag') || ls.includes('stängt') || ls.includes('makuler')) return 'bg-red-500/20 text-red-300 border-red-500/30'
  if (ls.includes('öppen')) return 'bg-sky-500/20 text-sky-300 border-sky-500/30'
  return 'bg-slate-500/15 text-slate-300 border-slate-600/50'
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

      {isIntermediate && (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getChipStyle(status)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {status}
        </span>
      )}

      {/* Fullständig statuslista - inga statusval försvinner */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => !disabled && setMenuOpen(o => !o)}
          disabled={disabled}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors duration-200 ${
            disabled
              ? 'text-slate-600 border-slate-800 cursor-default'
              : 'text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-500'
          }`}
          title="Alla statusar"
        >
          Status
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
