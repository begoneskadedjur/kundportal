// src/pages/shared/intranet/interactive/nyvy/KundresaPerioder.tsx
// Interaktiv del i guiden Se hur det går för dina offerter och avtal (tekniker): vilka dagar
// perioderna 30, 90 och 365 dagar täcker i dag, vilken period de jämförs med och när det inte
// blir någon jämförelse. Räknas med samma funktion som Min kundresa (perioder i kundresaData.ts,
// rullande perioder i svensk tid, arkivgränsen 2026-05-01, minst 5 dokument i båda perioderna).

import { useMemo, useState } from 'react'
import { ARKIVGRANS, MINSTA_FOR_JAMFORELSE, perioder, type PeriodDagar } from '../../../../../components/technician/ny/kundresa/kundresaData'

export default function KundresaPerioder() {
  const [dagar, setDagar] = useState<PeriodDagar>(90)
  const per = useMemo(() => perioder(dagar), [dagar])
  const franNu = per.nuDelvis ? ARKIVGRANS : per.nu.fran
  const franFore = per.jamforelse === 'delvis' ? ARKIVGRANS : per.fore.fran

  return (
    <div className="my-5 grid gap-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Vilka dagar räknas i dag?</p>
        <p className="text-sm text-slate-400">Välj period och se vad Min kundresa visar och jämför med just i dag.</p>
      </div>
      <div role="radiogroup" aria-label="Period" className="flex flex-wrap gap-2">
        {([30, 90, 365] as PeriodDagar[]).map(p => (
          <button key={p} type="button" role="radio" aria-checked={dagar === p} onClick={() => setDagar(p)}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${dagar === p ? 'bg-[#20c58f] text-[#fff]' : 'border border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
            {p} dagar
          </button>
        ))}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm" aria-live="polite">
        <dt className="text-slate-400">Din period</dt>
        <dd className="font-mono text-white">{franNu} till {per.nu.till}</dd>
        <dt className="text-slate-400">Jämförs med</dt>
        <dd className="text-white">{per.jamforelse === 'ingen' ? 'Ingen jämförelse än' : <span className="font-mono">{franFore} till {per.fore.till}</span>}</dd>
      </dl>
      <p className="text-sm text-slate-300">
        {per.jamforelse === 'ingen'
          ? `Perioden före ligger före ${ARKIVGRANS}, då portalen tog över, så det finns inget att jämföra med än.`
          : per.jamforelse === 'delvis'
            ? `Perioden före börjar ${ARKIVGRANS}, eftersom inget före det datumet räknas. Jämförelsen skrivs när båda perioderna har minst ${MINSTA_FOR_JAMFORELSE} dokument.`
            : `Jämförelsen skrivs när båda perioderna har minst ${MINSTA_FOR_JAMFORELSE} dokument. Den görs bara mot dig själv, aldrig mot kollegor.`}
      </p>
    </div>
  )
}
