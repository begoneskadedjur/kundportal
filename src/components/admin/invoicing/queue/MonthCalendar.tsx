// src/components/admin/invoicing/queue/MonthCalendar.tsx
// Månadskalendern i sidopanelen: skickdatum markerade (försenat, ska skickas,
// skickat). Måndag först, svensk tid.

import { useState } from 'react'
import { Icon } from '../../../icons/Icon'
import { TONE_DOT, type Tone } from './queueUtils'

const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']
const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

export interface CalendarLegend { tone: Tone; label: string }

export function MonthCalendar({
  today,
  marks,
  legend,
}: {
  /** ÅÅÅÅ-MM-DD */
  today: string
  /** Dag (ÅÅÅÅ-MM-DD) till markeringar */
  marks: Map<string, Tone[]>
  legend: CalendarLegend[]
}) {
  const [ty, tm] = today.split('-').map(Number)
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: ty, m: tm })

  const step = (d: number) =>
    setYm(({ y, m }) => {
      const idx = y * 12 + (m - 1) + d
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 }
    })

  const first = new Date(ym.y, ym.m - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(ym.y, ym.m, 0).getDate()
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{MONTHS[ym.m - 1]} {ym.y}</span>
        <div className="flex gap-1">
          <button type="button" aria-label="Föregående månad" onClick={() => step(-1)} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <Icon name="allman.chevron-vanster" size={16} />
          </button>
          <button type="button" aria-label="Nästa månad" onClick={() => step(1)} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <Icon name="allman.chevron" size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-slate-500 text-center mb-1">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />
          const iso = `${ym.y}-${pad(ym.m)}-${pad(d)}`
          const isToday = iso === today
          const tones = marks.get(iso) ?? []
          return (
            <div
              key={i}
              className={`h-9 rounded-md border flex flex-col items-center justify-center gap-0.5 text-xs tabular-nums ${
                isToday ? 'border-[#20c58f] bg-[#20c58f]/10 text-white font-semibold' : 'border-slate-800 bg-slate-950/30 ' + (iso < today ? 'text-slate-500' : 'text-slate-300')
              }`}
            >
              <span>{d}</span>
              <span className="flex gap-0.5 h-1.5">
                {tones.map((t) => <span key={t} className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[t]}`} />)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[l.tone]}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}
