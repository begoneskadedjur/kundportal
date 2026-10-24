// src/pages/shared/intranet/interactive/nyvy/Provisionsraknare.tsx
// Interaktiv del i guiden Förstå din provision (tekniker): räkna ut din provision på ett ärende.
// Samma regler och samma funktioner som portalen:
//   ProvisionService.getSettings()        procentsatsen och lägsta underlaget ur commission_settings
//                                         (i dag 6 % och 4 000 kr exkl. moms)
//   ProvisionService.calculateCommission  (pris exkl. moms minus avdrag) x procent x din andel
//   underProvisionsgrans                  texten när underlaget är under gränsen (steget Klart)
//   CommissionSection                     gränsen prövas på priset före avdraget, vid ROT/RUT på
//                                         priset före ROT/RUT-avdraget; andelarna ska bli 100 %
// Går inställningarna inte att hämta räknar delen med 6 % och 4 000 kr. Inget sparas.

import { useEffect, useState } from 'react'
import { ProvisionService } from '../../../../../services/provisionService'
import { underProvisionsgrans } from '../../../../../components/technician/ny/steg/provisionsgrans'

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`

function Tal({ etikett, varde, onChange, enhet, max, steg = 100 }: { etikett: string; varde: number; onChange: (v: number) => void; enhet: string; max?: number; steg?: number }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-slate-300">{etikett}</span>
      <span className="flex items-center gap-2">
        <input type="number" inputMode="numeric" min={0} max={max} step={steg} value={varde}
          onChange={e => onChange(Math.max(0, Math.min(max ?? Infinity, Number(e.target.value) || 0)))}
          className="min-h-[44px] w-32 rounded-lg border border-slate-600 bg-slate-800 px-3 text-right text-base text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]" />
        <span className="text-sm text-slate-400">{enhet}</span>
      </span>
    </label>
  )
}

export default function Provisionsraknare() {
  const [procentsats, setProcentsats] = useState(6)
  const [grans, setGrans] = useState(4000)
  const [hamtad, setHamtad] = useState(false)
  const [pris, setPris] = useState(8000)
  const [avdrag, setAvdrag] = useState(0)
  const [andel, setAndel] = useState(100)
  const [rot, setRot] = useState(false)

  useEffect(() => {
    let avbruten = false
    ProvisionService.getSettings()
      .then(s => { if (!avbruten) { setProcentsats(s.engangsjobb_percentage); setGrans(s.min_commission_base); setHamtad(true) } })
      .catch(() => { /* standardvärdena gäller */ })
    return () => { avbruten = true }
  }, [])

  const under = underProvisionsgrans(pris, grans)
  const din = under ? 0 : ProvisionService.calculateCommission(pris, procentsats, andel, avdrag)
  const total = under ? 0 : ProvisionService.calculateCommission(pris, procentsats, 100, avdrag)
  const kollega = 100 - andel

  return (
    <div className="my-5 grid gap-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Räkna ut din provision</p>
        <p className="text-sm text-slate-400">
          Skriv ärendets pris exklusive moms, eventuellt avdrag för underentreprenör och din andel. {hamtad ? 'Procent och gräns är portalens inställningar just nu' : 'Räknat med'}: {procentsats.toLocaleString('sv-SE')} % och lägst {kr(grans)} exkl. moms.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tal etikett={rot ? 'Pris exkl. moms, före ROT/RUT' : 'Pris exkl. moms'} varde={pris} onChange={setPris} enhet="kr" />
        <Tal etikett="Avdrag (underentreprenörskostnader)" varde={avdrag} onChange={setAvdrag} enhet="kr" />
        <Tal etikett="Din andel" varde={andel} onChange={setAndel} enhet="%" max={100} steg={10} />
      </div>
      <button type="button" role="switch" aria-checked={rot} onClick={() => setRot(v => !v)}
        className="flex min-h-[44px] items-center gap-3 self-start rounded-lg px-1 text-left text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <span className={`relative h-6 w-10 flex-none rounded-full transition-colors ${rot ? 'bg-[#20c58f]' : 'bg-slate-600'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#fff] shadow transition-all ${rot ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
        Ärendet har ROT- eller RUT-avdrag
      </button>
      {rot && <p className="-mt-2 text-sm text-slate-400">Provisionen räknas på priset före avdraget, inte på det kunden betalar efter avdraget.</p>}

      <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm" aria-live="polite">
        {under ? (
          <p className="text-amber-300">{under}</p>
        ) : (
          <>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
              <dt className="text-slate-400">Underlag</dt><dd className="text-right tabular-nums text-slate-200">{kr(pris)}{avdrag > 0 ? ` minus ${kr(avdrag)}` : ''}</dd>
              <dt className="text-slate-400">Provision på ärendet, {procentsats.toLocaleString('sv-SE')} %</dt><dd className="text-right tabular-nums text-slate-200">{kr(total)}</dd>
              <dt className="border-t border-slate-700 pt-1.5 font-semibold text-white">Din del, {andel} %</dt><dd className="border-t border-slate-700 pt-1.5 text-right font-semibold tabular-nums text-[#20c58f]">{kr(din)}</dd>
              {kollega > 0 && <><dt className="text-slate-400">Kollegans del, {kollega} %</dt><dd className="text-right tabular-nums text-slate-200">{kr(total - din)}</dd></>}
            </dl>
            {avdrag > 0 && <p className="text-slate-400">Gränsen {kr(grans)} prövas på priset före avdraget. Avdraget dras av innan procenten räknas.</p>}
          </>
        )}
      </div>
      <p className="text-xs text-slate-500">Exempel, inget sparas. Provisionen registreras när ärendet avslutas och betalas ut med lönen när kunden har betalat fakturan.</p>
    </div>
  )
}
