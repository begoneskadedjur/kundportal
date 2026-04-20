// src/components/admin/sales-pipeline/PurchaseArticleBreakdown.tsx
// Pareto-vy över inköpta artiklar under perioden.
// Klick på artikel → modal med de 10 senaste avtal som innehöll artikeln.
import { useMemo, useState } from 'react'
import { ShoppingCart, ExternalLink } from 'lucide-react'
import Modal from '../../ui/Modal'
import type {
  PurchaseArticleRow,
  PurchaseArticleContract,
} from '../../../services/contractService'

interface PurchaseArticleBreakdownProps {
  data: PurchaseArticleRow[]
  onOpenContract?: (contractId: string) => void
}

function formatKr(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
  return `${Math.round(v)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PurchaseArticleBreakdown({
  data,
  onOpenContract,
}: PurchaseArticleBreakdownProps) {
  const [groupFilter, setGroupFilter] = useState<string>('Alla')
  const [selected, setSelected] = useState<PurchaseArticleRow | null>(null)

  const groups = useMemo(() => {
    const s = new Set(
      data.map(d => d.top_service_group || 'Okänd grupp').filter(Boolean)
    )
    return ['Alla', ...Array.from(s).sort()]
  }, [data])

  const filtered = useMemo(() => {
    if (groupFilter === 'Alla') return data
    return data.filter(d => (d.top_service_group || 'Okänd grupp') === groupFilter)
  }, [data, groupFilter])

  const top = filtered.slice(0, 10)
  const totalCost = useMemo(
    () => filtered.reduce((s, d) => s + d.total_cost, 0),
    [filtered]
  )

  // Kumulativ % för pareto-indikator
  const cumulative = useMemo(() => {
    let running = 0
    return top.map(r => {
      running += r.total_cost
      return totalCost > 0 ? (running / totalCost) * 100 : 0
    })
  }, [top, totalCost])

  if (data.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Inköps-analys (artiklar)</h3>
        </div>
        <div className="text-center text-xs text-slate-500 py-8">
          Inga inköpsartiklar i vald period.
        </div>
      </div>
    )
  }

  const maxCost = top.length > 0 ? top[0].total_cost : 0

  return (
    <>
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Inköps-analys (artiklar)</h3>
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
              <div className="text-[10px] text-slate-500">Total kostnad</div>
              <div className="text-xs font-semibold text-amber-400">
                {formatKr(totalCost)} kr
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {top.map((a, idx) => {
            const pct = maxCost > 0 ? (a.total_cost / maxCost) * 100 : 0
            const sharePct = totalCost > 0 ? (a.total_cost / totalCost) * 100 : 0
            return (
              <button
                key={a.name}
                onClick={() => setSelected(a)}
                className="w-full text-left group"
                title="Klicka för att se avtal som innehöll denna artikel"
              >
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-500 tabular-nums w-4">{idx + 1}.</span>
                    <span className="text-slate-200 truncate group-hover:text-white transition-colors">
                      {a.name}
                    </span>
                    {a.top_service_group && (
                      <span className="text-[10px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                        {a.top_service_group}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] text-slate-500 w-12 text-right tabular-nums">
                      {a.contract_count} avt
                    </span>
                    <span className="text-[10px] text-slate-400 w-20 text-right tabular-nums">
                      Ø {formatKr(a.avg_cost_per_contract)}
                    </span>
                    <span className="text-amber-400 font-medium tabular-nums w-16 text-right">
                      {formatKr(a.total_cost)}
                    </span>
                  </div>
                </div>
                <div className="relative h-1.5 bg-slate-800/60 rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500/80 to-amber-500/30 group-hover:from-amber-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                  {/* Pareto-kumulativ märke */}
                  {cumulative[idx] < 100 && (
                    <div
                      className="absolute top-0 bottom-0 w-[1px] bg-slate-500/60"
                      style={{ left: `${cumulative[idx]}%` }}
                    />
                  )}
                </div>
                <div className="text-[9px] text-slate-600 text-right mt-0.5 tabular-nums">
                  {sharePct.toFixed(1)}% av total · kum. {cumulative[idx].toFixed(0)}%
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Drill-down modal */}
      {selected && (
        <Modal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title={selected.name}
          subtitle={`${selected.contract_count} avtal · ${formatKr(selected.total_cost)} kr i kostnad · snitt ${formatKr(
            selected.avg_cost_per_contract
          )}/avtal`}
          size="md"
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-700/50 pb-2">
              <span>Senaste avtal ({selected.contracts.length} st)</span>
              {selected.top_service_group && (
                <span className="text-[10px] bg-slate-800/60 px-2 py-0.5 rounded text-slate-300">
                  Dominerande grupp: {selected.top_service_group}
                </span>
              )}
            </div>
            <ArticleContractList
              contracts={selected.contracts}
              onOpenContract={id => {
                setSelected(null)
                onOpenContract?.(id)
              }}
            />
          </div>
        </Modal>
      )}
    </>
  )
}

interface ArticleContractListProps {
  contracts: PurchaseArticleContract[]
  onOpenContract?: (id: string) => void
}

function ArticleContractList({ contracts, onOpenContract }: ArticleContractListProps) {
  if (contracts.length === 0) {
    return <div className="text-xs text-slate-500 text-center py-4">Inga avtal</div>
  }
  return (
    <div className="space-y-2">
      {contracts.map(c => (
        <div
          key={`${c.contract_id}-${c.signed_at}`}
          className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-800/50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-white truncate">
              {c.company_name}
            </div>
            <div className="text-[10px] text-slate-500">{formatDate(c.signed_at)}</div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-slate-500">Antal</div>
              <div className="text-xs text-slate-300 tabular-nums">{c.quantity}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500">Kostnad</div>
              <div className="text-xs font-medium text-amber-400 tabular-nums">
                {formatKr(c.cost)} kr
              </div>
            </div>
            {onOpenContract && (
              <button
                onClick={() => onOpenContract(c.contract_id)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-[#20c58f] transition-colors"
                title="Öppna avtal i tabellen"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
