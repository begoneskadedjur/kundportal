// src/components/admin/customers/analytics/SalesPersonTable.tsx

import React, { useState } from 'react'
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { SalesPersonStat } from '../../../../hooks/useContractInsights'

interface Props {
  data: SalesPersonStat[]
}

type SortKey = keyof SalesPersonStat
type SortDir = 'asc' | 'desc'

function MarginBadge({ margin, sampleSize }: { margin: number | null; sampleSize: number }) {
  if (margin === null) return <span className="text-slate-600 text-xs">–</span>
  const color = margin >= 50 ? 'text-[#20c58f]' : margin >= 20 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className={`text-xs font-medium ${color}`} title={`Baserat på ${sampleSize} kunder`}>
      {margin}%
    </span>
  )
}

export default function SalesPersonTable({ data }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'totalArr', dir: 'desc' })

  const toggle = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })

  const sorted = [...data].sort((a, b) => {
    const va = a[sort.key] ?? 0
    const vb = b[sort.key] ?? 0
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb))
    return sort.dir === 'desc' ? -cmp : cmp
  })

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sort.key !== k) return <ChevronUp className="w-3 h-3 text-slate-600" />
    return sort.dir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-slate-400" />
      : <ChevronUp className="w-3 h-3 text-slate-400" />
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggle(k)}
      className={`px-3 py-2.5 text-xs font-medium text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon k={k} />
      </span>
    </th>
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/60 border-b border-slate-700/50">
          <tr>
            <Th k="name" label="Säljare" />
            <Th k="active" label="Aktiva" right />
            <Th k="totalArr" label="Total ARR" right />
            <Th k="avgArr" label="Snitt ARR" right />
            <Th k="margin" label="Marginal" right />
            <Th k="avgTenureYears" label="Snitt löptid" right />
            <Th k="renewalCount12m" label="Förnyelse 12m" right />
            <Th k="churned" label="Uppsagda" right />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {sorted.map(row => (
            <tr key={row.name} className="hover:bg-slate-800/30 transition-colors">
              <td className="px-3 py-2.5 text-slate-200 font-medium">{row.name}</td>
              <td className="px-3 py-2.5 text-slate-300 text-right">{row.active}</td>
              <td className="px-3 py-2.5 text-white font-semibold text-right">
                {row.totalArr.toLocaleString('sv-SE')} kr
              </td>
              <td className="px-3 py-2.5 text-slate-300 text-right">
                {row.avgArr.toLocaleString('sv-SE')} kr
              </td>
              <td className="px-3 py-2.5 text-right">
                <MarginBadge margin={row.margin} sampleSize={row.marginSampleSize} />
              </td>
              <td className="px-3 py-2.5 text-slate-400 text-right text-xs">
                {row.avgTenureYears ? `${row.avgTenureYears} år` : '–'}
              </td>
              <td className="px-3 py-2.5 text-right">
                {row.renewalCount12m > 0 ? (
                  <span className="text-amber-400 text-xs font-medium">
                    {row.renewalCount12m} ({row.renewalArr12m.toLocaleString('sv-SE')} kr)
                  </span>
                ) : (
                  <span className="text-slate-600 text-xs">–</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                {row.churned > 0
                  ? <span className="text-red-400 text-xs">{row.churned}</span>
                  : <span className="text-slate-600 text-xs">0</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
