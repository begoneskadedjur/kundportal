// När kommer förfrågningarna: värmekarta veckodag × timme i svensk tid. En kulör (brandfärgen),
// ljus till mörk efter antal, med skalförklaring, summa per veckodag och avläsning vid hovring.

import { useMemo, useState } from 'react'
import type { StatRad } from '../../../../services/webLeadStatistikService'
import { tal } from '../../marknad/marknadFormat'
import { VECKODAG_KORT, VECKODAG_LANG, andelText } from './statistikData'

const TIMMAR = Array.from({ length: 24 }, (_, i) => i)

function alfa(n: number, max: number): number {
  if (!n || !max) return 0
  return 0.18 + 0.82 * (n / max)
}

export default function StatistikHeatmap({ rader }: { rader: StatRad[] }) {
  const [fokus, setFokus] = useState<{ d: number; h: number } | null>(null)

  const { rutor, max, perDag, perTimme, total } = useMemo(() => {
    const r: number[][] = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
    for (const x of rader) {
      if (x.g !== 'heat') continue
      const [d, h] = x.k.split('-').map(Number)
      if (d && d >= 1 && d <= 7 && h != null && h >= 0 && h < 24) r[d - 1]![h] += x.n
    }
    const pd = r.map((rad) => rad.reduce((a, b) => a + b, 0))
    const pt = TIMMAR.map((h) => r.reduce((a, rad) => a + rad[h]!, 0))
    return { rutor: r, max: Math.max(0, ...r.flat()), perDag: pd, perTimme: pt, total: pd.reduce((a, b) => a + b, 0) }
  }, [rader])

  if (!total) return <p className="py-6 text-center text-sm text-slate-500">Inga förfrågningar under perioden.</p>

  const toppTimme = perTimme.indexOf(Math.max(...perTimme))
  const toppDag = perDag.indexOf(Math.max(...perDag))
  const kontor = rutor.slice(0, 5).reduce((s, rad) => s + rad.slice(8, 17).reduce((a, b) => a + b, 0), 0)
  const fokusN = fokus ? rutor[fokus.d]![fokus.h]! : 0

  return (
    <div>
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="grid gap-[2px] min-w-[320px]"
          style={{ gridTemplateColumns: '2rem repeat(24, minmax(0, 1fr)) 2.25rem' }}
          onMouseLeave={() => setFokus(null)}
          role="img"
          aria-label={`Värmekarta över förfrågningar per veckodag och timme. Flest på ${VECKODAG_LANG[toppDag]} och klockan ${toppTimme} till ${toppTimme + 1}.`}
        >
          {rutor.map((rad, d) => (
            <div key={d} className="contents">
              <div className={`text-[11px] leading-none self-center ${fokus?.d === d ? 'text-white' : 'text-slate-400'}`}>{VECKODAG_KORT[d]}</div>
              {rad.map((n, h) => (
                <div
                  key={h}
                  onMouseEnter={() => setFokus({ d, h })}
                  title={`${VECKODAG_LANG[d]} ${String(h).padStart(2, '0')}–${String(h + 1).padStart(2, '0')}: ${tal(n)}`}
                  className={`aspect-square rounded-[3px] ${n ? '' : 'bg-slate-700/25'} ${
                    fokus?.d === d && fokus?.h === h ? 'ring-2 ring-white/70' : ''
                  }`}
                  style={n ? { backgroundColor: `rgba(32, 197, 143, ${alfa(n, max)})` } : undefined}
                />
              ))}
              <div className="text-[11px] leading-none self-center text-right text-slate-300 tabular-nums">{tal(perDag[d])}</div>
            </div>
          ))}
          <div />
          {TIMMAR.map((h) => (
            <div key={h} className={`text-[10px] leading-none pt-1 text-center tabular-nums ${fokus?.h === h ? 'text-white' : 'text-slate-500'}`}>
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </div>
          ))}
          <div />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
        <p className="text-slate-400 min-h-[1rem]" aria-live="polite">
          {fokus ? (
            <>
              <span className="text-white font-medium tabular-nums">{tal(fokusN)}</span>{' '}
              {fokusN === 1 ? 'förfrågan' : 'förfrågningar'} {VECKODAG_LANG[fokus.d]} {String(fokus.h).padStart(2, '0')}–
              {String(fokus.h + 1).padStart(2, '0')}
            </>
          ) : (
            <>
              Flest på {VECKODAG_LANG[toppDag]} och klockan {String(toppTimme).padStart(2, '0')}–{String(toppTimme + 1).padStart(2, '0')}.{' '}
              {andelText(kontor, total)} kom vardagar 08–17.
            </>
          )}
        </p>
        <div className="flex items-center gap-1.5 text-slate-500" aria-hidden="true">
          <span>Färre</span>
          {[0, 0.25, 0.5, 0.75, 1].map((s) => (
            <span
              key={s}
              className={`w-3 h-3 rounded-[3px] ${s === 0 ? 'bg-slate-700/25' : ''}`}
              style={s ? { backgroundColor: `rgba(32, 197, 143, ${0.18 + 0.82 * s})` } : undefined}
            />
          ))}
          <span>Fler</span>
        </div>
      </div>
    </div>
  )
}
