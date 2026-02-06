// src/components/admin/customers/CustomerRevenueModal.tsx
// Modal för att visa ackumulerat avtalsvärde och intäktsöversikt per kund

import { useState, useEffect, useMemo } from 'react'
import { X, Coins, FileText, Briefcase, TrendingUp, Calendar } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import { supabase } from '../../../lib/supabase'
import type { ContractBillingItemStatus, ContractBillingItemType } from '../../../types/contractBilling'

interface CustomerRevenueModalProps {
  customer: ConsolidatedCustomer | null
  isOpen: boolean
  onClose: () => void
}

interface BillingItem {
  total_price: number
  status: ContractBillingItemStatus
  item_type: ContractBillingItemType
  billing_period_start: string
  billing_period_end: string
  article_name: string
  quantity: number
  unit_price: number
}

interface PeriodGroup {
  periodLabel: string
  periodStart: string
  total: number
  status: ContractBillingItemStatus
  itemCount: number
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)

const STATUS_LABELS: Record<ContractBillingItemStatus, string> = {
  paid: 'Betald',
  invoiced: 'Fakturerad',
  approved: 'Godkänd',
  pending: 'Väntande',
  cancelled: 'Avbruten'
}

const STATUS_COLORS: Record<ContractBillingItemStatus, string> = {
  paid: 'text-green-400 bg-green-500/10',
  invoiced: 'text-blue-400 bg-blue-500/10',
  approved: 'text-purple-400 bg-purple-500/10',
  pending: 'text-amber-400 bg-amber-500/10',
  cancelled: 'text-slate-400 bg-slate-500/10'
}

const STATUS_BAR_COLORS: Record<ContractBillingItemStatus, string> = {
  paid: 'bg-green-500',
  invoiced: 'bg-blue-500',
  approved: 'bg-purple-500',
  pending: 'bg-amber-500',
  cancelled: 'bg-slate-500'
}

export default function CustomerRevenueModal({ customer, isOpen, onClose }: CustomerRevenueModalProps) {
  const [billingItems, setBillingItems] = useState<BillingItem[]>([])
  const [loading, setLoading] = useState(false)

  // Hämta alla billing items för kundens sites
  useEffect(() => {
    if (!isOpen || !customer) return

    const fetchBillingData = async () => {
      setLoading(true)
      try {
        // Hämta customer_ids från alla sites
        const customerIds = customer.sites.map(s => s.id)

        const { data, error } = await supabase
          .from('contract_billing_items')
          .select('total_price, status, item_type, billing_period_start, billing_period_end, article_name, quantity, unit_price')
          .in('customer_id', customerIds)
          .neq('status', 'cancelled')

        if (error) throw error
        setBillingItems(data || [])
      } catch (err) {
        console.error('Error fetching billing data:', err)
        setBillingItems([])
      } finally {
        setLoading(false)
      }
    }

    fetchBillingData()
  }, [isOpen, customer])

  // Beräkna aggregeringar
  const stats = useMemo(() => {
    if (!customer) return null

    // Kontraktsintäkter per status
    const byStatus: Record<string, number> = { paid: 0, invoiced: 0, approved: 0, pending: 0 }
    billingItems.forEach(item => {
      if (byStatus[item.status] !== undefined) {
        byStatus[item.status] += item.total_price
      }
    })

    const contractTotal = billingItems.reduce((sum, i) => sum + i.total_price, 0)

    // Uppdelning: avtal vs tillägg
    const recurringRevenue = billingItems
      .filter(i => i.item_type === 'contract')
      .reduce((sum, i) => sum + i.total_price, 0)
    const adHocRevenue = billingItems
      .filter(i => i.item_type === 'ad_hoc')
      .reduce((sum, i) => sum + i.total_price, 0)

    // Ärendeintäkter (från ConsolidatedCustomer)
    const casesRevenue = customer.totalCasesValue || 0

    // Totalt ackumulerat
    const totalAccumulated = contractTotal + casesRevenue

    // Max för bar-diagram
    const maxStatus = Math.max(byStatus.paid, byStatus.invoiced, byStatus.approved, byStatus.pending, 1)

    return {
      byStatus,
      contractTotal,
      recurringRevenue,
      adHocRevenue,
      casesRevenue,
      totalAccumulated,
      maxStatus
    }
  }, [billingItems, customer])

  // Gruppera per period (senaste 6)
  const periodGroups = useMemo((): PeriodGroup[] => {
    const groups = new Map<string, PeriodGroup>()

    billingItems.forEach(item => {
      const start = item.billing_period_start
      const end = item.billing_period_end
      const key = `${start}::${end}`

      // Formatera periodlabel
      const startDate = new Date(start)
      const isSingleDay = start === end
      const periodLabel = isSingleDay
        ? startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
        : `${startDate.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })}`

      if (!groups.has(key)) {
        groups.set(key, {
          periodLabel,
          periodStart: start,
          total: 0,
          status: item.status,
          itemCount: 0
        })
      }

      const group = groups.get(key)!
      group.total += item.total_price
      group.itemCount++
      // Lägsta status "vinner" (pending < approved < invoiced < paid)
      const statusOrder: ContractBillingItemStatus[] = ['pending', 'approved', 'invoiced', 'paid']
      if (statusOrder.indexOf(item.status) < statusOrder.indexOf(group.status)) {
        group.status = item.status
      }
    })

    return Array.from(groups.values())
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .slice(0, 8)
  }, [billingItems])

  if (!isOpen || !customer) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-green-500/10 p-2 rounded-lg">
              <Coins className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Intäktsöversikt</h2>
              <p className="text-sm text-slate-400">{customer.company_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Laddar intäktsdata...</p>
            </div>
          ) : stats ? (
            <>
              {/* KPI-kort */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Totalt ack. värde</span>
                  </div>
                  <div className="text-xl font-bold text-green-400">{formatCurrency(stats.totalAccumulated)}</div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Kontraktsintäkter</span>
                  </div>
                  <div className="text-xl font-bold text-purple-400">{formatCurrency(stats.contractTotal)}</div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Briefcase className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Ärendeintäkter</span>
                  </div>
                  <div className="text-xl font-bold text-blue-400">{formatCurrency(stats.casesRevenue)}</div>
                </div>
              </div>

              {/* Statusfördelning */}
              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Avtalsfakturering per status</h3>
                <div className="space-y-3">
                  {(['paid', 'invoiced', 'approved', 'pending'] as ContractBillingItemStatus[]).map(status => {
                    const amount = stats.byStatus[status] || 0
                    const barWidth = stats.maxStatus > 0 ? (amount / stats.maxStatus) * 100 : 0
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className={`text-xs font-medium w-24 px-2 py-1 rounded ${STATUS_COLORS[status]}`}>
                          {STATUS_LABELS[status]}
                        </span>
                        <div className="flex-1 h-5 bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${STATUS_BAR_COLORS[status]}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-300 font-mono w-28 text-right">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Uppdelning */}
              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Uppdelning</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avtalsdebitering</span>
                    <span className="text-white font-medium">{formatCurrency(stats.recurringRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tilläggstjänster</span>
                    <span className="text-white font-medium">{formatCurrency(stats.adHocRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Ärenden (direktfakturering)</span>
                    <span className="text-white font-medium">{formatCurrency(stats.casesRevenue)}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between text-sm font-semibold">
                    <span className="text-white">Totalt</span>
                    <span className="text-green-400">{formatCurrency(stats.totalAccumulated)}</span>
                  </div>
                </div>
              </div>

              {/* Senaste perioder */}
              {periodGroups.length > 0 && (
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Senaste faktureringsperioder
                  </h3>
                  <div className="space-y-2">
                    {periodGroups.map((group, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-slate-800/50"
                      >
                        <span className="text-slate-300">{group.periodLabel}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-white font-mono font-medium">{formatCurrency(group.total)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[group.status]}`}>
                            {STATUS_LABELS[group.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tom state */}
              {billingItems.length === 0 && stats.casesRevenue === 0 && (
                <div className="text-center py-8">
                  <Coins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Inga faktureringsdata registrerade för denna kund.</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
