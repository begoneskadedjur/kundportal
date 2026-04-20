// src/components/admin/contractBilling/AdhocSalesPipeline.tsx
// Merförsäljning Avtal — lista ad-hoc fakturaer från avslutade contract-ärenden
// Separat från MonthlyBillingPipeline (årspremier).

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  FileText,
  Plus,
  ExternalLink,
  Layers,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'
import { BILLING_ITEM_STATUS_CONFIG, formatBillingAmount } from '../../../types/contractBilling'
import type { AdhocSalesMonth, AdhocSalesEntry } from '../../../types/contractBilling'
import Button from '../../ui/Button'

export function AdhocSalesPipeline() {
  const navigate = useNavigate()

  const [months, setMonths] = useState<AdhocSalesMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [monthOffset, setMonthOffset] = useState(0)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  const { startMonth, endMonth, spanLabel } = useMemo(() => {
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - 2 + monthOffset, 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 6 + monthOffset, 1)
    const startLabel = startDate.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
    const endLabel = endDate.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
    return {
      startMonth: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
      endMonth: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`,
      spanLabel: `${startLabel} - ${endLabel}`,
    }
  }, [monthOffset])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ContractBillingService.getAdhocSalesPipelineData(startMonth, endMonth)
      setMonths(data)

      // Auto-expandera nuvarande månad
      if (data.length > 0 && expandedMonths.size === 0) {
        const now = new Date()
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const match = data.find(m => m.month_key === currentKey)
        setExpandedMonths(new Set([match?.month_key || data[0].month_key]))
      }
    } catch (error) {
      console.error('Fel vid laddning av merförsäljning:', error)
      toast.error('Kunde inte ladda merförsäljning')
    } finally {
      setLoading(false)
    }
  }, [startMonth, endMonth])

  useEffect(() => { loadData() }, [loadData])

  const filteredMonths = useMemo(() => {
    if (!searchTerm) return months
    const term = searchTerm.toLowerCase()
    return months.map(month => ({
      ...month,
      entries: month.entries.filter(e =>
        e.customer.company_name.toLowerCase().includes(term) ||
        e.customer.organization_number?.toLowerCase().includes(term) ||
        e.case?.case_number?.toLowerCase().includes(term) ||
        e.case?.title?.toLowerCase().includes(term)
      ),
    }))
  }, [months, searchTerm])

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }

  const totalStats = useMemo(() => {
    const stats = { pending: 0, approved: 0, invoiced: 0, paid: 0, totalAmount: 0, entries: 0 }
    for (const month of months) {
      stats.pending += month.status_breakdown.pending || 0
      stats.approved += month.status_breakdown.approved || 0
      stats.invoiced += month.status_breakdown.invoiced || 0
      stats.paid += month.status_breakdown.paid || 0
      stats.totalAmount += month.total_amount
      stats.entries += month.entry_count
    }
    return stats
  }, [months])

  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  return (
    <div className="space-y-3">
      {/* Filter-rad */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Sök kund eller ärende..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] w-60"
          />
        </div>

        <div className="flex-1" />

        {/* KPI-chips */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
            {totalStats.entries} poster
          </span>
          <span className="px-2 py-1 rounded-lg bg-[#20c58f]/10 border border-[#20c58f]/30 text-[#20c58f]">
            {formatBillingAmount(totalStats.totalAmount)}
          </span>
        </div>

        <div className="w-px h-6 bg-slate-700" />

        {/* Månad-navigering */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthOffset(o => o - 1)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="1 månad bakåt"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs text-slate-300 select-none">{spanLabel}</span>
          <button
            onClick={() => setMonthOffset(o => o + 1)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="1 månad framåt"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <Button variant="secondary" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Månadslista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-[#20c58f] animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMonths.map(month => {
            const isExpanded = expandedMonths.has(month.month_key)
            const isCurrent = month.month_key === currentMonthKey

            return (
              <div
                key={month.month_key}
                className={`bg-slate-800/50 border rounded-xl overflow-hidden transition-colors ${
                  isCurrent ? 'border-[#20c58f]/40' : 'border-slate-700'
                }`}
              >
                {/* Månad-header */}
                <button
                  onClick={() => toggleMonth(month.month_key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />}

                  <Calendar className={`w-4 h-4 ${isCurrent ? 'text-[#20c58f]' : 'text-slate-400'}`} />

                  <span className="font-medium text-white capitalize">
                    {month.month_label}
                  </span>

                  {isCurrent && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[#20c58f]/10 text-[#20c58f] border border-[#20c58f]/30">
                      Nu
                    </span>
                  )}

                  <div className="flex-1" />

                  <span className="text-sm text-slate-400">
                    {month.entry_count} {month.entry_count === 1 ? 'post' : 'poster'}
                  </span>

                  <span className="text-sm font-semibold text-white min-w-[100px] text-right">
                    {formatBillingAmount(month.total_amount)}
                  </span>
                </button>

                {/* Entries */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-700/50">
                        {month.entries.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 text-sm">
                            Inga merförsäljningsposter denna månad
                          </div>
                        ) : (
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs text-slate-500 bg-slate-900/50">
                                <th className="text-left px-4 py-2 font-medium">Kund</th>
                                <th className="text-left px-4 py-2 font-medium">Ärende / Period</th>
                                <th className="text-left px-4 py-2 font-medium">Fakturadatum</th>
                                <th className="text-right px-4 py-2 font-medium">Poster</th>
                                <th className="text-right px-4 py-2 font-medium">Belopp</th>
                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                <th className="px-4 py-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {month.entries.map(entry => (
                                <AdhocEntryRow
                                  key={entry.key}
                                  entry={entry}
                                  onNavigate={() => entry.case?.id && navigate(`/admin/fakturering/arenden/${entry.case.id}`)}
                                />
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* Info */}
      {!loading && months.every(m => m.entry_count === 0) && (
        <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <Plus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga merförsäljningsposter i den valda perioden</p>
          <p className="text-xs text-slate-500 mt-1">
            Avslutade avtalsärenden med fakturaposter dyker upp här automatiskt.
          </p>
        </div>
      )}
    </div>
  )
}

// =======================================================

function AdhocEntryRow({ entry, onNavigate }: { entry: AdhocSalesEntry; onNavigate: () => void }) {
  const statusConfig = BILLING_ITEM_STATUS_CONFIG[entry.derived_status]
  const isPerCase = entry.grouping === 'per_case' && entry.case

  return (
    <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="text-sm text-white font-medium">{entry.customer.company_name}</div>
        {entry.customer.organization_number && (
          <div className="text-xs text-slate-500">{entry.customer.organization_number}</div>
        )}
      </td>

      <td className="px-4 py-3">
        {isPerCase ? (
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <div>
              <div className="text-sm text-white">
                {entry.case?.case_number || 'Okänt ärende'}
              </div>
              {entry.case?.title && (
                <div className="text-xs text-slate-500 truncate max-w-[240px]">
                  {entry.case.title}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-300">
              Månadsbatch ({entry.item_count} rader)
            </span>
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        <span className="text-sm text-slate-300">{entry.invoice_date}</span>
      </td>

      <td className="px-4 py-3 text-right text-sm text-slate-300">
        {entry.item_count}
      </td>

      <td className="px-4 py-3 text-right text-sm font-medium text-white">
        {formatBillingAmount(entry.total_amount)}
      </td>

      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${statusConfig.color} ${statusConfig.bgColor} ${statusConfig.borderColor}`}
        >
          {statusConfig.label}
        </span>
      </td>

      <td className="px-4 py-3 text-right">
        {isPerCase && entry.case && (
          <button
            onClick={onNavigate}
            className="p-1 text-slate-400 hover:text-[#20c58f] transition-colors"
            title="Öppna ärende"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  )
}

