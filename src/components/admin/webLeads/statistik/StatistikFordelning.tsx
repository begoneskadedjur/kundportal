// Fördelning som horisontella staplar med antal och andel: tjänst (med tjänstikon), källa (med
// kanalikon), kundgrupp, ort och ingång. Topp N och resten samlat i Övriga, med Visa alla.
// En rad med underrader (AI-assistent) får en pil och fälls ut till en indragen rad per underrad;
// underradernas andel räknas på alla förfrågningar, stapeln mot samma skala som huvudraderna.

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { tal } from '../../marknad/marknadFormat'
import { andelText, type Fordelningsrad } from './statistikData'

export default function StatistikFordelning({
  rader,
  topp = 6,
  tomText = 'Inga förfrågningar under perioden.',
}: {
  rader: Fordelningsrad[]
  topp?: number
  tomText?: string
}) {
  const [alla, setAlla] = useState(false)
  const [oppna, setOppna] = useState<Set<string>>(() => new Set())
  const vaxla = (namn: string) =>
    setOppna((s) => {
      const ny = new Set(s)
      if (ny.has(namn)) ny.delete(namn)
      else ny.add(namn)
      return ny
    })
  const total = rader.reduce((s, r) => s + r.n, 0)
  if (!total) return <p className="py-6 text-center text-sm text-slate-500">{tomText}</p>

  const fall = !alla && rader.length > topp + 1
  const synliga = fall ? rader.slice(0, topp) : rader
  const ovriga = fall ? rader.slice(topp) : []
  const lista: Fordelningsrad[] = ovriga.length
    ? [...synliga, { namn: `Övriga (${ovriga.length})`, n: ovriga.reduce((s, r) => s + r.n, 0) }]
    : synliga
  const max = Math.max(...lista.map((r) => r.n), 1)

  return (
    <div>
      <ul className="space-y-2.5">
        {lista.map((r, i) => {
          const ovrig = ovriga.length > 0 && i === lista.length - 1
          const barn = r.under ?? []
          const oppen = barn.length > 0 && oppna.has(r.namn)
          return (
            <li key={r.namn} title={r.detalj ? `${r.namn}: ${tal(r.n)} förfrågningar, ${r.detalj}` : undefined}>
              <div className="flex items-center gap-2 text-sm">
                {r.ikon !== undefined && <span className="w-4 h-4 flex-none grid place-items-center text-slate-400">{r.ikon}</span>}
                {barn.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => vaxla(r.namn)}
                    aria-expanded={oppen}
                    className="min-w-0 inline-flex items-center gap-1 text-slate-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
                  >
                    <span className="truncate">{r.namn}</span>
                    <ChevronRight className={`w-3.5 h-3.5 flex-none text-slate-400 transition-transform ${oppen ? 'rotate-90' : ''}`} aria-hidden="true" />
                    <span className="sr-only">{oppen ? ', dölj uppdelningen' : ', visa uppdelningen'}</span>
                  </button>
                ) : (
                  <span className={`min-w-0 truncate ${ovrig ? 'text-slate-400' : 'text-slate-200'}`}>{r.namn}</span>
                )}
                <span className="ml-auto flex items-baseline gap-2 flex-none">
                  <span className="text-white font-medium tabular-nums">{tal(r.n)}</span>
                  <span className="text-xs text-slate-400 tabular-nums w-11 text-right">{andelText(r.n, total)}</span>
                </span>
              </div>
              <div className={`mt-1 h-1.5 bg-slate-700/30 rounded-r overflow-hidden ${r.ikon !== undefined ? 'ml-6' : ''}`} aria-hidden="true">
                <div
                  className={`h-full rounded-r ${ovrig ? 'bg-slate-500' : 'bg-[#20c58f]'}`}
                  style={{ width: `${(r.n / max) * 100}%` }}
                />
              </div>
              {oppen && (
                <ul className={`mt-2 space-y-2 border-l border-slate-700 pl-3 ${r.ikon !== undefined ? 'ml-6' : 'ml-1'}`}>
                  {barn.map((b) => (
                    <li key={b.namn} title={b.detalj ? `${b.namn}: ${tal(b.n)} förfrågningar, ${b.detalj}` : undefined}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 truncate text-slate-300">{b.namn}</span>
                        <span className="ml-auto flex items-baseline gap-2 flex-none">
                          <span className="text-slate-200 tabular-nums">{tal(b.n)}</span>
                          <span className="text-slate-400 tabular-nums w-11 text-right">{andelText(b.n, total)}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1 bg-slate-700/30 rounded-r overflow-hidden" aria-hidden="true">
                        <div className="h-full rounded-r bg-[#20c58f]/60" style={{ width: `${(b.n / max) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      {rader.length > topp + 1 && (
        <button
          type="button"
          onClick={() => setAlla((v) => !v)}
          className="mt-3 text-xs text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
        >
          {alla ? 'Visa färre' : `Visa alla ${tal(rader.length)}`}
        </button>
      )}
    </div>
  )
}
