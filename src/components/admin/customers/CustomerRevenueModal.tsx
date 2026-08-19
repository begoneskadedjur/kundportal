// src/components/admin/customers/CustomerRevenueModal.tsx
// Modal för att visa ackumulerat avtalsvärde och intäktsöversikt per kund

import { useState, useEffect, useMemo } from 'react'
import { X, Coins, Calendar } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import { supabase } from '../../../lib/supabase'

type InvoiceStatus = 'paid' | 'sent' | 'booked' | 'ready' | 'pending_approval' | 'draft' | 'cancelled'

interface CustomerRevenueModalProps {
  customer: ConsolidatedCustomer | null
  // Multi-kontrakt-refaktor (Fas 12 bug D): scopa intäktsöversikten till ett
  // specifikt avtal när kunden har flera. null = customer-aggregerat (legacy).
  contractId?: string | null
  isOpen: boolean
  onClose: () => void
}

interface BillingItem {
  subtotal: number
  total_amount: number
  status: InvoiceStatus
  invoice_type: 'contract' | 'adhoc'
  billing_period_start: string | null
  billing_period_end: string | null
}

interface PeriodGroup {
  periodLabel: string
  periodStart: string
  total: number
  status: InvoiceStatus
  itemCount: number
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: 'Betald',
  sent: 'Skickad',
  booked: 'Bokförd',
  ready: 'Redo',
  pending_approval: 'Godkännas',
  draft: 'Utkast',
  cancelled: 'Avbruten',
}

// Statuspunkter i listans stil: ● punkt + text, #20c58f som enda accent
const STATUS_DOT_COLORS: Record<InvoiceStatus, string> = {
  paid: 'bg-[#20c58f]',
  sent: 'bg-slate-400',
  booked: 'bg-slate-500',
  ready: 'bg-slate-300',
  pending_approval: 'bg-amber-400',
  draft: 'bg-slate-600',
  cancelled: 'bg-slate-600',
}

export default function CustomerRevenueModal({ customer, contractId = null, isOpen, onClose }: CustomerRevenueModalProps) {
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

        // Multi-kontrakt: filtrera på contract_id när modalen är scopad till ett
        // specifikt avtal (synth-id sparas inte → ignorera). Annars (single-
        // kontrakt-kunder eller legacy) aggregera alla customer-invoices.
        let query = supabase
          .from('invoices')
          .select('subtotal, total_amount, status, invoice_type, billing_period_start, billing_period_end')
          .in('customer_id', customerIds)
          .in('invoice_type', ['contract', 'adhoc'])
          .neq('status', 'cancelled')

        if (contractId && !contractId.startsWith('synth-')) {
          query = query.eq('contract_id', contractId)
        }

        const { data, error } = await query

        if (error) throw error
        setBillingItems((data as any) || [])
      } catch (err) {
        console.error('Error fetching billing data:', err)
        setBillingItems([])
      } finally {
        setLoading(false)
      }
    }

    fetchBillingData()
  }, [isOpen, customer, contractId])

  // Beräkna aggregeringar
  const stats = useMemo(() => {
    if (!customer) return null

    // Fakturaintäkter per status (alla statusar från invoices)
    const byStatus: Record<string, number> = {
      paid: 0, sent: 0, booked: 0, ready: 0, pending_approval: 0, draft: 0,
    }
    billingItems.forEach(item => {
      if (byStatus[item.status] !== undefined) {
        byStatus[item.status] += item.subtotal
      }
    })

    const contractTotal = billingItems.reduce((sum, i) => sum + i.subtotal, 0)

    // Uppdelning: avtal vs tillägg
    const recurringRevenue = billingItems
      .filter(i => i.invoice_type === 'contract')
      .reduce((sum, i) => sum + i.subtotal, 0)
    const adHocRevenue = billingItems
      .filter(i => i.invoice_type === 'adhoc')
      .reduce((sum, i) => sum + i.subtotal, 0)

    // Ärendeintäkter (från ConsolidatedCustomer)
    const casesRevenue = customer.totalCasesValue || 0

    // Totalt ackumulerat — casesRevenue exkluderas eftersom adhoc-fakturor
    // redan ingår i contractTotal via invoices (undviker dubbelräkning)
    const totalAccumulated = contractTotal

    // Max för bar-diagram
    const maxStatus = Math.max(...Object.values(byStatus), 1)

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

  // Gruppera per period (senaste 8)
  const periodGroups = useMemo((): PeriodGroup[] => {
    const groups = new Map<string, PeriodGroup>()

    billingItems.forEach(item => {
      const start = item.billing_period_start
      const end = item.billing_period_end
      if (!start) return
      const key = `${start}::${end ?? ''}`

      const startDate = new Date(start)
      const isSingleDay = start === end
      const periodLabel = isSingleDay
        ? startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
        : startDate.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })

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
      group.total += item.subtotal
      group.itemCount++
      // Lägsta status "vinner" (draft < pending_approval < ready < booked < sent < paid)
      const statusOrder: InvoiceStatus[] = ['draft', 'pending_approval', 'ready', 'booked', 'sent', 'paid']
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
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-700 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white truncate">Intäktsöversikt</h2>
            <p className="text-xs text-slate-400 truncate mt-0.5">{customer.company_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[#20c58f] border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Laddar intäktsdata...</p>
            </div>
          ) : stats ? (
            <>
              {/* Summering — textrader istället för KPI-kort */}
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Totalt ack. värde</span>
                  <span className="text-sm font-semibold text-slate-100 tabular-nums">{formatCurrency(stats.totalAccumulated)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Avtalsintäkter</span>
                  <span className="text-sm text-slate-200 tabular-nums">{formatCurrency(stats.recurringRevenue)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Ärendeintäkter</span>
                  <span className="text-sm text-slate-200 tabular-nums">{formatCurrency(stats.adHocRevenue)}</span>
                </div>
              </div>

              {/* Statusfördelning */}
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Avtalsfakturering per status</h3>
                <div className="space-y-1.5">
                  {(['paid', 'sent', 'booked', 'ready', 'pending_approval', 'draft'] as InvoiceStatus[]).map(status => {
                    const amount = stats.byStatus[status] || 0
                    return (
                      <div key={status} className="flex items-center gap-2 text-sm">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT_COLORS[status]}`} aria-hidden />
                        <span className={amount > 0 ? 'text-slate-300' : 'text-slate-500'}>{STATUS_LABELS[status]}</span>
                        <span className={`ml-auto tabular-nums ${amount > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Uppdelning */}
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Uppdelning</h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avtalsdebitering</span>
                    <span className="text-slate-200 tabular-nums">{formatCurrency(stats.recurringRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tilläggstjänster</span>
                    <span className="text-slate-200 tabular-nums">{formatCurrency(stats.adHocRevenue)}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-1.5 mt-1.5 flex justify-between text-sm font-semibold">
                    <span className="text-slate-100">Totalt</span>
                    <span className="text-[#20c58f] tabular-nums">{formatCurrency(stats.totalAccumulated)}</span>
                  </div>
                </div>
              </div>

              {/* Senaste perioder */}
              {periodGroups.length > 0 && (
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Senaste faktureringsperioder
                  </h3>
                  <div className="divide-y divide-slate-800/70">
                    {periodGroups.map((group, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className="text-slate-300 flex-1 truncate">{group.periodLabel}</span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLORS[group.status]}`} aria-hidden />
                          <span className="text-xs text-slate-500">{STATUS_LABELS[group.status]}</span>
                        </span>
                        <span className="text-slate-200 tabular-nums shrink-0 w-24 text-right">{formatCurrency(group.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tom state */}
              {billingItems.length === 0 && stats.casesRevenue === 0 && (
                <div className="text-center py-4">
                  <Coins className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Inga faktureringsdata registrerade för denna kund.</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
