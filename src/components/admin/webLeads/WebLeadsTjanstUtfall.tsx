// src/components/admin/webLeads/WebLeadsTjanstUtfall.tsx
// Statistik i Leads (Webb): tjänsten kunden valde i formuläret mot tjänsten som bokades i ärendet.
// Visar till exempel hur ofta Vet inte blev möss. Bara förfrågningar med ett skapat ärende räknas.

import { useMemo } from 'react'
import { tjanstLabel, type WebInquiry } from '../../../types/webInquiry'

interface Grupp {
  kundensVal: string
  totalt: number
  utfall: [string, number][]
}

function andel(del: number, hel: number): string {
  if (!hel) return '0 %'
  return `${Math.round((del / hel) * 100)} %`
}

export default function WebLeadsTjanstUtfall({ urval }: { urval: WebInquiry[] }) {
  const grupper = useMemo<Grupp[]>(() => {
    const m = new Map<string, Map<string, number>>()
    for (const i of urval) {
      if (!i.bokad_tjanst) continue
      const val = tjanstLabel(i.pest_type)
      const rad = m.get(val) ?? new Map<string, number>()
      rad.set(i.bokad_tjanst, (rad.get(i.bokad_tjanst) ?? 0) + 1)
      m.set(val, rad)
    }
    return [...m.entries()]
      .map(([kundensVal, rad]) => ({
        kundensVal,
        totalt: [...rad.values()].reduce((a, b) => a + b, 0),
        utfall: [...rad.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv')),
      }))
      .sort((a, b) => b.totalt - a.totalt || a.kundensVal.localeCompare(b.kundensVal, 'sv'))
  }, [urval])

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <h3 className="text-sm font-semibold text-white mb-1">Kundens val mot bokad tjänst</h3>
      <p className="text-xs text-slate-500 mb-3">Tjänsten kunden valde på sajten och tjänsten som bokades i ärendet.</p>
      {grupper.length === 0 ? (
        <p className="text-sm text-slate-500">Inga bokade förfrågningar med tjänst i perioden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="px-2 py-1.5 font-medium">Kundens val</th>
                <th className="px-2 py-1.5 font-medium">Bokad tjänst</th>
                <th className="px-2 py-1.5 font-medium text-right">Antal</th>
                <th className="px-2 py-1.5 font-medium text-right">Andel</th>
              </tr>
            </thead>
            <tbody>
              {grupper.flatMap((g) =>
                g.utfall.map(([tjanst, antal], idx) => (
                  <tr key={`${g.kundensVal}|${tjanst}`} className={idx === g.utfall.length - 1 ? 'border-b border-slate-700/50 last:border-0' : ''}>
                    <td className="px-2 py-1.5 text-white">{idx === 0 ? `${g.kundensVal} (${g.totalt})` : ''}</td>
                    <td className="px-2 py-1.5 text-slate-300">{tjanst}</td>
                    <td className="px-2 py-1.5 text-white font-mono text-right">{antal}</td>
                    <td className="px-2 py-1.5 text-slate-400 font-mono text-right">{andel(antal, g.totalt)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
