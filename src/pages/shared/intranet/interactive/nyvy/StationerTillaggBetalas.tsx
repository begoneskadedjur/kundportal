// src/pages/shared/intranet/interactive/nyvy/StationerTillaggBetalas.tsx
// Guiden Sätt ut en tilläggsstation: de tre sätten att betala, med portalens egna
// texter (ADDON_BILLING_MODEL_LABEL och ADDON_BILLING_MODEL_HELP). Läsaren kan slå
// av att kunden har ett avtal i avtalskartan och ser att bara per kontroll går då
// (AddonModelPicker: Kräver att kunden har ett avtal i avtalskartan).

import { useState } from 'react'
import { ADDON_BILLING_MODEL_HELP, ADDON_BILLING_MODEL_LABEL, type AddonBillingModel } from '../../../../../types/addonStations'

const MODELLER: AddonBillingModel[] = ['per_year', 'per_month', 'per_round']

export default function StationerTillaggBetalas() {
  const [avtal, setAvtal] = useState(true)
  const [vald, setVald] = useState<AddonBillingModel>('per_year')
  const giltig = avtal || vald === 'per_round' ? vald : 'per_round'

  return (
    <div className="my-5 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <p className="text-sm font-semibold text-white">Hur betalar kunden?</p>
      <p className="mt-0.5 text-sm text-slate-400">Samma val som under Betalas när Tillägg utöver avtal är ibockat. Priserna kommer från kundens prislista.</p>
      <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-slate-200">
        <input type="checkbox" checked={avtal} onChange={e => setAvtal(e.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]" />
        Kunden har ett avtal i avtalskartan
      </label>
      <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Betalas">
        {MODELLER.map(m => {
          const av = !avtal && m !== 'per_round'
          return (
            <button key={m} type="button" role="radio" aria-checked={giltig === m} disabled={av} onClick={() => setVald(m)}
              className={`rounded-xl border p-3 text-left ${giltig === m ? 'border-[#20c58f]/60 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-900/40'} ${av ? 'cursor-not-allowed opacity-50' : ''}`}>
              <span className="block text-sm font-semibold text-white">{ADDON_BILLING_MODEL_LABEL[m]}</span>
              <span className="mt-0.5 block text-sm text-slate-400">{av ? 'Kräver att kunden har ett avtal i avtalskartan' : ADDON_BILLING_MODEL_HELP[m]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
