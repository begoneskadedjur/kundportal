// src/components/admin/sales-pipeline/TopServicesBreakdown.tsx
// Topp-tjänster aggregerat över hela perioden.
// Horisontell bar-chart + tabell. Klick på rad → callback (filtrerar MarginTrendChart på gruppen).
import { useMemo, useState } from 'react'
import { Package, ArrowUpRight } from 'lucide-react'
import type { TopServiceRow } from '../../../services/contractService'

interface TopServicesBreakdownProps {
  data: TopServiceRow[]
  onServiceGroupClick?: (group: string) => void
}

function formatKr(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
  return `${Math.round(v)}`
}

function marginColor(pct: number | null): string {
  if (pct === null) return 'text-slate-500'
  if (pct >= 40) return 'text-green-400'
  if (pct >= 20) return 'text-amber-400'
  return 'text-red-400'
}

export default function TopServicesBreakdown({
  data,
  onServiceGroupClick,
}: TopServicesBreakdownProps) {
  const [groupFilter, setGroupFilter] = useState<string>('Alla')

  const groups = useMemo(() => {
    const s = new Set(data.map(d => d.group))
    return ['Alla', ...Array.from(s).sort()]
  }, [data])

  const filtered = useMemo(() => {
    if (groupFilter === 'Alla') return data
    return data.filter(d => d.group === groupFilter)
  }, [data, groupFilter])

  const top = filtered.slice(0, 10)
  const maxVolume = top.length > 0 ? top[0].volume : 0
  const totalVolume = useMemo(
    () => filtered.reduce((s, d) => s + d.volume, 0),
    [filtered]
  )

  if (data.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-[#20c58f]" />
          <h3 className="text-sm font-semibold text-white">Topp-tjänster</h3>
        </div>
        <div className="text-center text-xs text-slate-500 py-8">
          Ingen tjänstedata i vald period.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#20c58f]" />
          <h3 className="text-sm font-semibold text-white">Topp-tjänster</h3>
          <span className="text-[10px] text-slate-500">({filtered.length} st)</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="text-[11px] bg-slate-800/80 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          >
            {groups.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <div className="text-right">
            <div className="text-[10px] text-slate-500">Total</div>
            <div className="text-xs font-semibold text-white">{formatKr(totalVolume)} kr</div>
          </div>
        </div>
      </div>

      {/* Bar-chart */}
      <div className="space-y-1.5 mb-3">
        {top.map((s, idx) => {
          const pct = maxVolume > 0 ? (s.volume / maxVolume) * 100 : 0
          const sharePct = totalVolume > 0 ? (s.volume / totalVolume) * 100 : 0
          return (
            <button
              key={s.name}
              onClick={() => onServiceGroupClick?.(s.group)}
              className="w-full text-left group"
              title="Klicka för att filtrera marginalgrafen på denna tjänstegrupp"
            >
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-500 tabular-nums w-4">
                    {idx + 1}.
                  </span>
                  <span className="text-slate-200 truncate group-hover:text-white transition-colors">
                    {s.name}
                  </span>
                  <span className="text-[10px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                    {s.group}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-600 group-hover:text-[#20c58f] transition-colors" />
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-[10px] font-medium ${marginColor(s.margin_pct)}`}>
                    {s.margin_pct !== null ? `${s.margin_pct}%` : '—'}
                  </span>
                  <span className="text-slate-500 text-[10px] w-10 text-right tabular-nums">
                    {s.contract_count} avt
                  </span>
                  <span className="text-white font-medium tabular-nums w-16 text-right">
                    {formatKr(s.volume)}
                  </span>
                </div>
              </div>
              <div className="relative h-1.5 bg-slate-800/60 rounded overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#20c58f]/80 to-[#20c58f]/40 group-hover:from-[#20c58f] group-hover:to-[#20c58f]/60 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[9px] text-slate-600 text-right mt-0.5 tabular-nums">
                {sharePct.toFixed(1)}% av total
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
