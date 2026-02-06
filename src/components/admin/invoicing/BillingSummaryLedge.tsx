// src/components/admin/invoicing/BillingSummaryLedge.tsx
// Diskret, komprimerbar faktureringsoversikt mellan flikar och tabbinnehall

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import { InvoiceService } from '../../../services/invoiceService'
import { ContractBillingService } from '../../../services/contractBillingService'
import { formatCurrency } from '../../../utils/formatters'

interface MonthlyData {
  month: string
  label: string
  pending: number
  sent: number
  paid: number
  skip: number
  total: number
}

interface Totals {
  pending: number
  sent: number
  paid: number
  skip: number
  total: number
}

const STATUS_COLORS = {
  pending: '#eab308',
  sent: '#3b82f6',
  paid: '#22c55e',
  skip: '#64748b',
}

function formatCompact(n: number): string {
  if (n === 0) return '0 kr'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs < 1000) return `${sign}${Math.round(abs)} kr`
  if (abs < 1_000_000) {
    const k = abs / 1000
    return `${sign}${k >= 100 ? Math.round(k) : k.toFixed(k < 10 ? 1 : 0)}k`
  }
  const m = abs / 1_000_000
  return `${sign}${m.toFixed(1)}M`
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // "2026-01"
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
}

function getLast6Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push(key)
  }
  return months
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg text-xs">
      <p className="text-slate-300 font-medium mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="text-white font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function BillingSummaryLedge() {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [totals, setTotals] = useState<Totals>({ pending: 0, sent: 0, paid: 0, skip: 0, total: 0 })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [invoices, contractItems] = await Promise.all([
        InvoiceService.getInvoices(),
        ContractBillingService.getBillingItems()
      ])

      // Bygg manad-map
      const map = new Map<string, { pending: number; sent: number; paid: number; skip: number }>()

      // Procesera fakturor (privat/foretag)
      for (const inv of invoices) {
        const mk = getMonthKey(inv.created_at)
        if (!map.has(mk)) map.set(mk, { pending: 0, sent: 0, paid: 0, skip: 0 })
        const entry = map.get(mk)!

        if (inv.status === 'cancelled') continue

        if (['draft', 'pending_approval', 'ready'].includes(inv.status)) {
          entry.pending += inv.total_amount
        } else if (inv.status === 'sent') {
          entry.sent += inv.total_amount
        } else if (inv.status === 'paid') {
          entry.paid += inv.total_amount
        }
      }

      // Procesera contract billing items
      for (const item of contractItems) {
        const mk = getMonthKey(item.created_at)
        if (!map.has(mk)) map.set(mk, { pending: 0, sent: 0, paid: 0, skip: 0 })
        const entry = map.get(mk)!

        if (item.status === 'pending' || item.status === 'approved') {
          entry.pending += item.total_price
        } else if (item.status === 'invoiced') {
          entry.sent += item.total_price
        } else if (item.status === 'paid') {
          entry.paid += item.total_price
        } else if (item.status === 'cancelled') {
          entry.skip += item.total_price
        }
      }

      // Bygg 6 manader
      const months = getLast6Months()
      const data: MonthlyData[] = months.map(mk => {
        const entry = map.get(mk) || { pending: 0, sent: 0, paid: 0, skip: 0 }
        return {
          month: mk,
          label: getMonthLabel(mk),
          ...entry,
          total: entry.pending + entry.sent + entry.paid + entry.skip
        }
      })

      // Totaler (alla manader, inte bara 6)
      let tPending = 0, tSent = 0, tPaid = 0, tSkip = 0
      for (const [, entry] of map) {
        tPending += entry.pending
        tSent += entry.sent
        tPaid += entry.paid
        tSkip += entry.skip
      }

      setMonthlyData(data)
      setTotals({
        pending: tPending,
        sent: tSent,
        paid: tPaid,
        skip: tSkip,
        total: tPending + tSent + tPaid + tSkip
      })
    } catch (err) {
      console.error('BillingSummaryLedge: load error', err)
    } finally {
      setLoading(false)
    }
  }

  const statusItems = useMemo(() => [
    { key: 'pending' as const, label: 'vantar', color: STATUS_COLORS.pending, value: totals.pending },
    { key: 'sent' as const, label: 'skickade', color: STATUS_COLORS.sent, value: totals.sent },
    { key: 'paid' as const, label: 'betalda', color: STATUS_COLORS.paid, value: totals.paid },
    { key: 'skip' as const, label: 'skip', color: STATUS_COLORS.skip, value: totals.skip },
  ], [totals])

  if (loading) {
    return (
      <div className="bg-slate-800/30 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-10 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/30 border-b border-slate-700/50">
      {/* Collapsed summary row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full h-10 flex items-center gap-4 text-xs hover:bg-slate-800/30 transition-colors rounded"
        >
          {statusItems.map(item => (
            <div key={item.key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-400">
                <span className="text-slate-300 font-medium">{formatCompact(item.value)}</span>
                {' '}{item.label}
              </span>
            </div>
          ))}

          <div className="w-px h-4 bg-slate-700 mx-1" />

          <span className="text-slate-300 font-medium">
            {formatCompact(totals.total)}
          </span>

          <div className="flex-1" />

          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          }
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
            {/* Stacked area chart */}
            <div className="lg:col-span-2 bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-xs text-slate-400 mb-2">Faktureringshistorik (6 mån)</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={STATUS_COLORS.pending} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={STATUS_COLORS.pending} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={STATUS_COLORS.sent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={STATUS_COLORS.sent} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={STATUS_COLORS.paid} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={STATUS_COLORS.paid} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSkip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={STATUS_COLORS.skip} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={STATUS_COLORS.skip} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatCompact(v)}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="paid"
                    name="Betalda"
                    stackId="1"
                    stroke={STATUS_COLORS.paid}
                    fill="url(#gradPaid)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    name="Skickade"
                    stackId="1"
                    stroke={STATUS_COLORS.sent}
                    fill="url(#gradSent)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    name="Vantar"
                    stackId="1"
                    stroke={STATUS_COLORS.pending}
                    fill="url(#gradPending)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="skip"
                    name="Skip"
                    stackId="1"
                    stroke={STATUS_COLORS.skip}
                    fill="url(#gradSkip)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly table */}
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700/50">
                <p className="text-xs text-slate-400">Per manad</p>
              </div>
              <div className="max-h-[200px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Manad</th>
                      <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Vantar</th>
                      <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Skickade</th>
                      <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Betalda</th>
                      <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Totalt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {[...monthlyData].reverse().map(row => (
                      <tr key={row.month} className="hover:bg-slate-800/30">
                        <td className="px-2 py-1.5 text-slate-300">{row.label}</td>
                        <td className="px-2 py-1.5 text-right text-yellow-400/80">{formatCompact(row.pending)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-400/80">{formatCompact(row.sent)}</td>
                        <td className="px-2 py-1.5 text-right text-emerald-400/80">{formatCompact(row.paid)}</td>
                        <td className="px-2 py-1.5 text-right text-white font-medium">{formatCompact(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
