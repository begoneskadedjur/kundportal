// src/pages/shared/intranet/interactive/nyvy/StationerForbrukning.tsx
// Guiden Gör en stationskontroll: prova förbrukningen i stationsarket. Läsaren väljer
// stationstyp och trycker − och + (5 gram för gram, annars 1) och ser rutans färg och
// statusen som sparas. Gränserna är station_types 2026-10-24, statusen räknas med
// portalens egen calculateInspectionStatus och INSPECTION_STATUS_CONFIG.

import { useState } from 'react'
import { calculateInspectionStatus, INSPECTION_STATUS_CONFIG } from '../../../../../types/indoor'
import { MATNING, TYPER, TypRutaLiten, matFarg, type TypNyckel } from '../../guider/_nyvy_stationer'

const VAL: TypNyckel[] = ['betong', 'mekanisk', 'ljus']
const RAM = { gron: 'border-green-500', gul: 'border-amber-500', rod: 'border-red-500', ingen: 'border-slate-700' } as const
const TEXT = { gron: 'text-green-400', gul: 'text-amber-400', rod: 'text-red-400', ingen: 'text-white' } as const
const ORD = { gron: 'Grön', gul: 'Gul', rod: 'Röd', ingen: 'Ingen färg' } as const

export default function StationerForbrukning() {
  const [typ, setTyp] = useState<TypNyckel>('betong')
  const [varde, setVarde] = useState(0)
  const m = MATNING[typ]!
  const farg = matFarg(varde, m)
  const status = calculateInspectionStatus(varde, m.varning, m.kritisk, 'above')
  const statusText = INSPECTION_STATUS_CONFIG[status]?.label ?? status

  return (
    <div className="my-5 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <p className="text-sm font-semibold text-white">Prova förbrukningen</p>
      <p className="mt-0.5 text-sm text-slate-400">Välj stationstyp och tryck − och +. Rutan får färg efter gränserna under den.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Stationstyp">
        {VAL.map(k => (
          <button key={k} type="button" role="radio" aria-checked={typ === k} onClick={() => { setTyp(k); setVarde(0) }}
            className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm ${typ === k ? 'border-[#20c58f] bg-[#20c58f]/10 text-white' : 'border-slate-700 text-slate-300'}`}>
            <TypRutaLiten typ={TYPER[k]} storlek={24} />{TYPER[k].namn}
          </button>
        ))}
      </div>
      <div className="mt-4 max-w-sm">
        <p className="mb-1.5 text-[13px] font-medium text-slate-300">{m.etikett}</p>
        <div className="flex items-stretch gap-2">
          <button type="button" onClick={() => setVarde(v => Math.max(0, v - m.steg))} aria-label={`Minska med ${m.steg}`}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-2xl text-slate-200">−</button>
          <div className={`flex h-14 flex-1 items-center justify-center gap-1.5 rounded-2xl border bg-slate-950 ${RAM[farg]}`}>
            <span className={`text-2xl font-bold tabular-nums ${TEXT[farg]}`}>{varde}</span>
            <span className="text-sm text-slate-400">{m.enhet}</span>
          </div>
          <button type="button" onClick={() => setVarde(v => v + m.steg)} aria-label={`Öka med ${m.steg}`}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-2xl text-slate-200">+</button>
        </div>
        <p className="mt-1.5 flex gap-4 text-xs">
          {m.varning !== null && <span className="text-amber-400">Varning: {m.varning}</span>}
          {m.kritisk !== null && <span className="text-red-400">Kritisk: {m.kritisk}</span>}
        </p>
      </div>
      <div className="mt-3 grid gap-1 rounded-lg bg-slate-900/60 p-3 text-sm" role="status" aria-live="polite">
        <p className="flex justify-between gap-3"><span className="text-slate-400">Rutans färg</span><span className={`font-semibold ${TEXT[farg]}`}>{ORD[farg]}</span></p>
        <p className="flex justify-between gap-3"><span className="text-slate-400">Sparas som</span><span className="font-semibold text-white">{statusText}</span></p>
        <p className="flex justify-between gap-3"><span className="text-slate-400">Varje tryck</span><span className="text-slate-200">{m.steg} {m.enhet}</span></p>
      </div>
      <p className="mt-2 text-xs text-slate-500">Väljer du ett preparat i stationsarket kan gränserna följa preparatet i stället för stationstypen.</p>
    </div>
  )
}
