// src/components/admin/customers/analytics/ProductOccurrenceTable.tsx

import React from 'react'
import type { TopProduct } from '../../../../hooks/useContractInsights'

interface Props {
  data: TopProduct[]
  maxRows?: number
}

export default function ProductOccurrenceTable({ data, maxRows = 15 }: Props) {
  const rows = data.slice(0, maxRows)
  const maxOcc = rows[0]?.occurrences ?? 1

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full text-xs">
        <thead className="bg-slate-800/60 border-b border-slate-700/50">
          <tr>
            <th className="px-3 py-2.5 text-left text-slate-400 font-medium w-8">#</th>
            <th className="px-3 py-2.5 text-left text-slate-400 font-medium">Produkt</th>
            <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Förekomster</th>
            <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Total värde</th>
            <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Snitt/avtal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {rows.map((row, i) => (
            <tr key={row.name} className="hover:bg-slate-800/30 transition-colors">
              <td className="px-3 py-2.5 text-slate-600 tabular-nums">{i + 1}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 rounded-full bg-[#20c58f] opacity-70 shrink-0"
                    style={{ width: `${Math.max(8, (row.occurrences / maxOcc) * 60)}px` }}
                  />
                  <span className="text-slate-200">{row.name}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right text-white font-semibold tabular-nums">
                {row.occurrences}
              </td>
              <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">
                {row.totalValue > 0 ? `${row.totalValue.toLocaleString('sv-SE')} kr` : '–'}
              </td>
              <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">
                {row.avgPrice > 0 ? `${row.avgPrice.toLocaleString('sv-SE')} kr` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
