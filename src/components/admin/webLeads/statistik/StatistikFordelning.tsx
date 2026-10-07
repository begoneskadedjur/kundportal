// Fördelning som horisontella staplar med antal och andel: tjänst (med tjänstikon), källa (med
// kanalikon), kundgrupp, ort och ingång. Topp N och resten samlat i Övriga, med Visa alla.

import { useState } from 'react'
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
          return (
            <li key={r.namn} title={r.detalj ? `${r.namn}: ${tal(r.n)} förfrågningar, ${r.detalj}` : undefined}>
              <div className="flex items-center gap-2 text-sm">
                {r.ikon !== undefined && <span className="w-4 h-4 flex-none grid place-items-center text-slate-400">{r.ikon}</span>}
                <span className={`min-w-0 truncate ${ovrig ? 'text-slate-400' : 'text-slate-200'}`}>{r.namn}</span>
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
