// src/pages/shared/intranet/interactive/nyvy/RotRaknare.tsx
// Interaktiv del i guiden Sätt rätt pris i ärendet: ROT/RUT-räknare för ett privatärende.
// Samma regler som Dela upp för ROT/RUT i CaseServiceSelector: avdraget räknas bara på
// arbetskostnaden (ROT 30 %, RUT 50 %, DEFAULT_ROT_PERCENT/DEFAULT_RUT_PERCENT i
// rotRutConstants.ts), priserna i privatärenden står inkl. moms och totalen mot kunden
// ändras inte av uppdelningen. Provisionen: 6 % av underlaget exkl. moms, ingen provision
// under 4 000 kr exkl. moms (commission_settings, CommissionSection), räknat före avdraget.

import { useState } from 'react'

const ROT = 30
const RUT = 50
const PROVISION = 6
const GRANS = 4000

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`

function Tal({ etikett, varde, onChange, steg = 50, max }: { etikett: string; varde: number; onChange: (v: number) => void; steg?: number; max?: number }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-slate-300">{etikett}</span>
      <span className="flex items-center gap-2">
        <input type="number" inputMode="numeric" min={0} max={max} step={steg} value={varde}
          onChange={e => onChange(Math.max(0, Math.min(max ?? Infinity, Number(e.target.value) || 0)))}
          className="min-h-[44px] w-32 rounded-lg border border-slate-600 bg-slate-800 px-3 text-right text-base text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]" />
        <span className="text-sm text-slate-400">kr inkl. moms</span>
      </span>
    </label>
  )
}

export default function RotRaknare() {
  const [total, setTotal] = useState(3750)
  const [arbete, setArbete] = useState(2500)
  const [typ, setTyp] = useState<'ROT' | 'RUT'>('ROT')

  const arbeteGiltigt = Math.min(arbete, total)
  const pct = typ === 'ROT' ? ROT : RUT
  const avdrag = arbeteGiltigt * pct / 100
  const exkl = total / 1.25
  const underGrans = exkl < GRANS
  const provision = underGrans ? 0 : exkl * PROVISION / 100

  return (
    <div className="my-5 grid gap-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Räkna på ROT och RUT</p>
        <p className="text-sm text-slate-400">Skriv tjänstens totalpris och hur mycket av det som är arbete, så ser du avdraget, vad kunden betalar och din provision.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tal etikett="Totalpris på raden" varde={total} onChange={setTotal} />
        <Tal etikett="Varav arbetskostnad" varde={arbete} onChange={setArbete} max={total} />
      </div>
      <div role="radiogroup" aria-label="Avdrag" className="flex gap-2">
        {(['ROT', 'RUT'] as const).map(t => (
          <button key={t} type="button" role="radio" aria-checked={typ === t} onClick={() => setTyp(t)}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${typ === t ? 'bg-[#20c58f] text-[#fff]' : 'border border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
            {t} ({t === 'ROT' ? ROT : RUT} %)
          </button>
        ))}
      </div>
      {arbete > total && <p className="text-sm text-red-400">Arbetskostnaden kan inte vara högre än totalpriset {kr(total)}. Ändra tjänstens pris först om arbetet ska vara större.</p>}
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm" aria-live="polite">
        <dt className="text-slate-400">Material och övrigt</dt><dd className="text-right tabular-nums text-slate-200">{kr(total - arbeteGiltigt)}</dd>
        <dt className="text-slate-400">Arbetskostnad</dt><dd className="text-right tabular-nums text-slate-200">{kr(arbeteGiltigt)}</dd>
        <dt className="text-slate-400">{typ}-avdrag ({pct} %)</dt><dd className="text-right tabular-nums text-[#20c58f]">-{kr(avdrag)}</dd>
        <dt className="border-t border-slate-700 pt-1.5 font-semibold text-white">Kunden betalar</dt><dd className="border-t border-slate-700 pt-1.5 text-right font-semibold tabular-nums text-white">{kr(total - avdrag)}</dd>
        <dt className="text-slate-400">Skatteverket betalar</dt><dd className="text-right tabular-nums text-slate-200">{kr(avdrag)}</dd>
      </dl>
      <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm">
        <p className="font-semibold text-white">Provisionen</p>
        <p className="text-slate-300">Underlag {kr(exkl)} exkl. moms, före avdraget.</p>
        <p className={underGrans ? 'text-amber-300' : 'text-[#20c58f]'}>
          {underGrans
            ? `Under gränsen ${kr(GRANS)} exkl. moms. Ingen provision.`
            : `${PROVISION} % blir ${kr(provision)}, som delas efter teknikernas andelar.`}
        </p>
      </div>
      <p className="text-xs text-slate-500">Exempel, inget sparas. Har arbetstidstjänsten en egen procentsats i tjänstekatalogen räknar portalen med den.</p>
    </div>
  )
}
