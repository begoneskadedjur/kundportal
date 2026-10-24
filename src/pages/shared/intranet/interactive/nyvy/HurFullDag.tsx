// src/pages/shared/intranet/interactive/nyvy/HurFullDag.tsx
// Prova själv: hur full är dagen? Samma gränser som belastning() i
// components/technician/ny/schema/schemaLogik.ts: inget bokat, under 70 procent Plats kvar,
// under 90 procent Nästan fullt, annars Fullt. Texterna hämtas ur NIVA_TEXT.

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { NIVA_TEXT, bokadeText, type Belastning } from '../../../../../components/technician/ny/schema/schemaLogik'

const FARG = { tom: 'bg-slate-500', lag: 'bg-[#20c58f]', hog: 'bg-amber-500', full: 'bg-red-500' } as const

export default function HurFullDag() {
  const [arbetstid, setArbetstid] = useState(8)
  const [bokade, setBokade] = useState(5)
  const kvot = arbetstid > 0 ? Math.min(bokade / arbetstid, 1) : 0
  const niva = kvot === 0 ? 'tom' : kvot < 0.7 ? 'lag' : kvot < 0.9 ? 'hog' : 'full'
  const b: Belastning = { niva, bokadeTim: bokade, kapacitetTim: arbetstid, antal: 0 }

  const steg = (varde: number, satt: (n: number) => void, min: number, max: number, etikett: string) => (
    <div className="flex items-center gap-2">
      <span className="w-40 text-sm text-slate-300">{etikett}</span>
      <button type="button" onClick={() => satt(Math.max(min, varde - 0.5))} aria-label={`Minska ${etikett.toLowerCase()}`}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-lg font-bold text-white">−</button>
      <span className="w-16 text-center font-mono text-base font-bold text-white">{String(varde).replace('.', ',')} tim</span>
      <button type="button" onClick={() => satt(Math.min(max, varde + 0.5))} aria-label={`Öka ${etikett.toLowerCase()}`}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-lg font-bold text-white">+</button>
    </div>
  )

  return (
    <div className="my-5 grid gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex items-center gap-2">
        <Icon name="allman.kalender" size={20} className="text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Prova: vad står det under dagen?</p>
      </div>
      <p className="text-sm text-slate-300">Arbetstiden kommer från ditt arbetsschema. De bokade timmarna är besökens längd den dagen.</p>
      {steg(arbetstid, setArbetstid, 1, 12, 'Arbetstid den dagen')}
      {steg(bokade, setBokade, 0, 12, 'Bokade besök')}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-700 bg-slate-900 p-3" role="status" aria-live="polite">
        <span className="text-sm text-slate-200">{bokadeText(b)}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
          <span aria-hidden className={`h-2 w-2 rounded-full ${FARG[niva]}`} />{NIVA_TEXT[niva]}
        </span>
      </div>
      <p className="text-xs text-slate-500">Plats kvar under 70 procent, Nästan fullt från 70 procent och Fullt från 90 procent av arbetstiden.</p>
    </div>
  )
}
