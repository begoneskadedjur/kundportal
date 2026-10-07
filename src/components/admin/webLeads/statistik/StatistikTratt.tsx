// Tratten Förfrågan, Kontaktad, Bokad, Vunnen: horisontella staplar med antal, andel av alla
// förfrågningar och tappet mellan stegen. En serie, en färg (brandfärgen).

import type { StatMatt } from '../../../../services/webLeadStatistikService'
import { tal } from '../../marknad/marknadFormat'
import { andelText } from './statistikData'
import { Delta } from './StatistikUi'

interface Steg {
  namn: string
  antal: number
  fore: number | null
  hjalp: string
}

export default function StatistikTratt({ m, fore }: { m: StatMatt; fore: StatMatt | null }) {
  const steg: Steg[] = [
    { namn: 'Förfrågan', antal: m.n, fore: fore?.n ?? null, hjalp: 'Alla förfrågningar för nyförsäljning' },
    { namn: 'Kontaktad', antal: m.kontaktade, fore: fore?.kontaktade ?? null, hjalp: 'Status ändrad från Ny, eller bokad' },
    { namn: 'Bokad', antal: m.bokade, fore: fore?.bokade ?? null, hjalp: 'Ett ärende har skapats eller kopplats' },
    { namn: 'Vunnen', antal: m.vunna, fore: fore?.vunna ?? null, hjalp: 'Ärendet fakturerat inom fristen' },
  ]
  const max = Math.max(m.n, 1)

  return (
    <ol className="space-y-1">
      {steg.map((s, i) => {
        const forra = steg[i - 1]
        const tapp = forra ? forra.antal - s.antal : 0
        const andelAvAlla = m.n ? s.antal / m.n : 0
        const foreAndel = fore && fore.n && s.fore != null ? s.fore / fore.n : null
        return (
          <li key={s.namn}>
            {forra && (
              <div className="flex items-center gap-2 pl-3 py-1 text-xs text-slate-500" aria-label={`Tapp från ${forra.namn} till ${s.namn}`}>
                <span className="w-px h-4 bg-slate-600" aria-hidden="true" />
                {forra.antal === 0 ? (
                  <span>inget underlag</span>
                ) : (
                  <span>
                    <span className="text-slate-300">{andelText(s.antal, forra.antal)}</span> gick vidare
                    {tapp > 0 && (
                      <>
                        , <span className="text-slate-400">{tal(tapp)}</span> föll bort eller väntar
                      </>
                    )}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-200" title={s.hjalp}>
                {s.namn}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-white">{tal(s.antal)}</span>
                <span className="text-xs text-slate-400 tabular-nums w-12 text-right">{i === 0 ? '100 %' : andelText(s.antal, m.n)}</span>
              </span>
            </div>
            <div className="mt-1 h-5 w-full bg-slate-700/25 rounded-[4px] overflow-hidden" role="img" aria-label={`${s.namn}: ${tal(s.antal)}`}>
              <div
                className="h-full bg-[#20c58f] rounded-r-[4px] transition-[width] duration-500"
                style={{ width: `${(s.antal / max) * 100}%`, opacity: 1 - i * 0.12 }}
              />
            </div>
            {fore && i > 0 && (
              <div className="mt-0.5 text-right">
                <Delta nu={andelAvAlla} fore={foreAndel} satt="pe" />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
