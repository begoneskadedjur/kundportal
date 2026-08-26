// src/pages/admin/DiscountApprovals.tsx
// Godkännandesida för rabatter: rabattansvariga (profiles.can_approve_discounts)
// granskar fakturor i pending_approval, ser teknikerns motivering och
// godkänner (→ ready) eller avslår (tekniker notifieras, fakturan ligger kvar).
// Avtalstillägg är pro rata och visas med förklaring - de är INTE rabatter.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  CheckCircle,
  FileText,
  Percent,
  Search,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  User,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import InvoiceDetailModal from '../../components/admin/invoicing/InvoiceDetailModal'
import { useAuth } from '../../contexts/AuthContext'
import {
  DiscountApprovalService,
  type ApprovalItem,
  type PremiumApprovalItem,
} from '../../services/discountApprovalService'
import { InvoiceService } from '../../services/invoiceService'
import { formatInvoiceAmount, type InvoiceType } from '../../types/invoice'

const TYPE_BADGE: Record<InvoiceType, { label: string; className: string }> = {
  private: { label: 'Privat', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  business: { label: 'Företag', className: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  adhoc: { label: 'Merförsäljning avtal', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  contract: { label: 'Avtal', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
}

const formatDate = (date: string | null) =>
  date ? new Date(date).toLocaleDateString('sv-SE') : '-'

const formatKr = (amount: number) => `${Math.round(amount).toLocaleString('sv-SE')} kr`

// Procent på svenska med kommatecken, max 2 decimaler (t.ex. "3,2")
const formatPercentSv = (percent: number) =>
  percent.toLocaleString('sv-SE', { maximumFractionDigits: 2 })

// Tolkar svensk inmatning: "3,2", "12 384", "-1,5" osv.
const parseSwedishNumber = (value: string): number | null => {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (!normalized || normalized === '-') return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

// Perioder som ligger > 12 månader fram markeras som "Kommande"
const isFarFuture = (date: string | null) => {
  if (!date) return false
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() + 12)
  return new Date(date) > cutoff
}

export default function DiscountApprovals() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  // Fakturor som avslagits i denna vy - ligger kvar i pending_approval
  // tills någon åtgärdar dem, så vi markerar dem lokalt
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())

  // Avslå-dialog
  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Fakturadetaljer
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null)

  // Flikar: rabatter/avtalstillägg respektive årspremiefakturor
  const [activeTab, setActiveTab] = useState<'discounts' | 'premiums'>('discounts')

  // Årspremier-fliken
  const [premiumItems, setPremiumItems] = useState<PremiumApprovalItem[]>([])
  const [premiumLoading, setPremiumLoading] = useState(true)
  const [premiumSearch, setPremiumSearch] = useState('')
  const [approvingPremiumId, setApprovingPremiumId] = useState<string | null>(null)

  // Indexjusteringsdialog: procent och belopp samspelar - ändras det ena
  // räknas det andra fram. Beloppet är alltid källan till sanning vid bekräftelse.
  const [indexTarget, setIndexTarget] = useState<PremiumApprovalItem | null>(null)
  const [percentInput, setPercentInput] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [applyingIndex, setApplyingIndex] = useState(false)

  const canApprove = !!profile?.can_approve_discounts
  const approverName = profile?.display_name || user?.email || 'Okänd'

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const data = await DiscountApprovalService.getPendingApprovals()
      setItems(data)
    } catch (error) {
      console.error('Error fetching pending approvals:', error)
      toast.error('Kunde inte hämta fakturor som väntar på godkännande')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPremiums = useCallback(async () => {
    try {
      setPremiumLoading(true)
      const data = await DiscountApprovalService.getPendingContractInvoices()
      setPremiumItems(data)
    } catch (error) {
      console.error('Error fetching pending contract invoices:', error)
      toast.error('Kunde inte hämta premiefakturor som väntar på godkännande')
    } finally {
      setPremiumLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canApprove) {
      fetchItems()
      fetchPremiums()
    }
  }, [canApprove, fetchItems, fetchPremiums])

  const handleApprove = async (item: ApprovalItem) => {
    if (approvingId || !user) return
    setApprovingId(item.invoice.id)
    try {
      await DiscountApprovalService.approve(item, user.id, approverName)
      setItems(prev => prev.filter(i => i.invoice.id !== item.invoice.id))
      toast.success(
        item.discountLines.length > 0
          ? 'Faktura godkänd - tekniker notifierad'
          : 'Faktura godkänd'
      )
    } catch (error) {
      console.error('Error approving invoice:', error)
      toast.error('Kunde inte godkänna fakturan')
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim() || rejecting) return
    setRejecting(true)
    try {
      await DiscountApprovalService.reject(rejectTarget, approverName, rejectReason.trim())
      setRejectedIds(prev => new Set(prev).add(rejectTarget.invoice.id))
      toast.success('Avslag sparat - tekniker notifierad')
      setRejectTarget(null)
      setRejectReason('')
    } catch (error) {
      console.error('Error rejecting invoice:', error)
      toast.error('Kunde inte avslå fakturan')
    } finally {
      setRejecting(false)
    }
  }

  // === Årspremier ===

  const handleApprovePremium = async (item: PremiumApprovalItem) => {
    if (approvingPremiumId || !user) return
    setApprovingPremiumId(item.invoice.id)
    try {
      await InvoiceService.approveInvoice(item.invoice.id, user.id, approverName)
      setPremiumItems(prev => prev.filter(i => i.invoice.id !== item.invoice.id))
      toast.success('Premiefaktura godkänd')
    } catch (error) {
      console.error('Error approving contract invoice:', error)
      toast.error('Kunde inte godkänna fakturan')
    } finally {
      setApprovingPremiumId(null)
    }
  }

  const openIndexDialog = (item: PremiumApprovalItem) => {
    setIndexTarget(item)
    setPercentInput('')
    setAmountInput('')
  }

  const currentPremium = indexTarget?.currentAnnualValue ?? 0

  // Procent ändras → beloppet räknas fram
  const handlePercentChange = (value: string) => {
    setPercentInput(value)
    const p = parseSwedishNumber(value)
    if (p !== null && indexTarget) {
      setAmountInput(String(Math.round(indexTarget.currentAnnualValue * (1 + p / 100))))
    } else {
      setAmountInput('')
    }
  }

  // Beloppet ändras → procenten räknas fram
  const handleAmountChange = (value: string) => {
    setAmountInput(value)
    const a = parseSwedishNumber(value)
    if (a !== null && a > 0 && indexTarget && indexTarget.currentAnnualValue > 0) {
      setPercentInput(formatPercentSv((a / indexTarget.currentAnnualValue - 1) * 100))
    } else {
      setPercentInput('')
    }
  }

  const newAnnualValue = parseSwedishNumber(amountInput)
  const indexPercent =
    newAnnualValue !== null && currentPremium > 0
      ? (newAnnualValue / currentPremium - 1) * 100
      : null
  const indexValid =
    newAnnualValue !== null &&
    newAnnualValue > 0 &&
    Math.round(newAnnualValue) !== Math.round(currentPremium)

  const handleApplyIndex = async () => {
    if (!indexTarget || !indexValid || newAnnualValue === null || applyingIndex) return
    if (!indexTarget.invoice.customer_id) {
      toast.error('Fakturan saknar kundkoppling och kan inte indexjusteras')
      return
    }
    setApplyingIndex(true)
    try {
      const pct = indexPercent ?? 0
      const result = await DiscountApprovalService.applyIndexAdjustment({
        customerId: indexTarget.invoice.customer_id,
        newAnnualValue: Math.round(newAnnualValue),
        effectiveFrom:
          indexTarget.invoice.billing_period_start ||
          new Date().toISOString().slice(0, 10),
        description: `Indexjustering ${pct >= 0 ? '+' : ''}${formatPercentSv(pct)} %`,
        createdByName: approverName,
      })
      toast.success(
        `Årspremien justerad: ${Math.round(result.previousAnnualValue).toLocaleString('sv-SE')} → ${Math.round(result.newAnnualValue).toLocaleString('sv-SE')} kr/år`
      )
      setIndexTarget(null)
      // Alla olåsta premiefakturor har räknats om - ladda om hela listan
      fetchPremiums()
    } catch (error) {
      console.error('Error applying index adjustment:', error)
      toast.error(
        error instanceof Error ? error.message : 'Kunde inte justera årspremien'
      )
    } finally {
      setApplyingIndex(false)
    }
  }

  const filteredPremiums = premiumItems.filter(item => {
    const q = premiumSearch.trim().toLowerCase()
    if (!q) return true
    return (
      item.invoice.customer_name.toLowerCase().includes(q) ||
      (item.invoice.invoice_number || '').toLowerCase().includes(q)
    )
  })

  // Spärrvy: bara rabattansvariga får granska (gäller även admins utan flaggan)
  if (!canApprove) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="max-w-lg mx-auto mt-12 p-8 bg-slate-800/30 border border-slate-700 rounded-xl text-center">
          <ShieldAlert className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-white mb-2">Du är inte rabattansvarig</h1>
          <p className="text-sm text-slate-400 mb-4">
            Den här sidan är till för utsedda rabattansvariga som granskar och
            godkänner rabatter på fakturor. Rollen tilldelas per person under{' '}
            <Link
              to="/admin/anvandarkonton-personal"
              className="text-[#20c58f] hover:underline"
            >
              Användarkonton (Personal)
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#20c58f]/10">
          <BadgeCheck className="w-6 h-6 text-[#20c58f]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Godkännanden</h1>
          <p className="text-sm text-slate-400">
            Granska rabatter, avtalstillägg och årspremiefakturor innan de går
            vidare till Fortnox.
          </p>
        </div>
      </div>

      {/* Flikar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('discounts')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#20c58f] ${
            activeTab === 'discounts'
              ? 'bg-[#20c58f]/15 text-[#20c58f] border border-[#20c58f]/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
          }`}
        >
          <Percent className="w-4 h-4" />
          Rabatter & tillägg
          <span
            className={`px-1.5 py-0.5 rounded-md text-xs font-semibold ${
              activeTab === 'discounts'
                ? 'bg-[#20c58f]/20 text-[#20c58f]'
                : 'bg-slate-700/60 text-slate-300'
            }`}
          >
            {items.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('premiums')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#20c58f] ${
            activeTab === 'premiums'
              ? 'bg-[#20c58f]/15 text-[#20c58f] border border-[#20c58f]/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Årspremier
          <span
            className={`px-1.5 py-0.5 rounded-md text-xs font-semibold ${
              activeTab === 'premiums'
                ? 'bg-[#20c58f]/20 text-[#20c58f]'
                : 'bg-slate-700/60 text-slate-300'
            }`}
          >
            {premiumItems.length}
          </span>
        </button>
      </div>

      {activeTab === 'discounts' && (loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-slate-400 mt-4">Laddar fakturor...</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        // Tom-läge
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl py-12">
          <div className="text-center">
            <CheckCircle className="w-10 h-10 text-[#20c58f] mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">
              Inga fakturor väntar på godkännande
            </h3>
            <p className="text-sm text-slate-400">
              Nya fakturor med rabatt dyker upp här när tekniker avslutar ärenden.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const { invoice, discountLines, additions } = item
            const typeBadge = TYPE_BADGE[invoice.invoice_type] || TYPE_BADGE.contract
            const isRejected = rejectedIds.has(invoice.id)

            return (
              <div
                key={invoice.id}
                className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3"
              >
                {/* Kortheader: fakturanr, typ, kund, status, belopp */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-white font-semibold">
                        {invoice.invoice_number || 'Utan fakturanummer'}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${typeBadge.className}`}>
                        {typeBadge.label}
                      </span>
                      {isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                          <XCircle className="w-3 h-3" />
                          Avslagen - väntar på åtgärd
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Kräver godkännande
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 mt-1 truncate">{invoice.customer_name}</p>
                    <p className="text-xs text-slate-500">Skapad {formatDate(invoice.created_at)}</p>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">Totalbelopp</p>
                    <p className="text-lg font-bold text-white font-mono">
                      {formatInvoiceAmount(invoice.total_amount)}
                    </p>
                  </div>
                </div>

                {/* Rabattrader */}
                {discountLines.length > 0 ? (
                  <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-white">Rabatter att granska</span>
                    </div>
                    {discountLines.map(line => (
                      <div
                        key={line.caseBillingItemId}
                        className="px-3 py-2 bg-slate-900/40 rounded-lg"
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm text-white">{line.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-amber-400">
                              -{line.discountPercent}%
                            </span>
                            <span className="text-sm text-slate-300 font-mono">
                              {formatInvoiceAmount(line.totalPrice)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 mt-1 flex-wrap">
                          {line.technicianName && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <User className="w-3 h-3" />
                              {line.technicianName}
                            </span>
                          )}
                          {line.motivation ? (
                            <span className="text-xs text-slate-400 italic">
                              "{line.motivation}"
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                              <AlertTriangle className="w-3 h-3" />
                              Motivering saknas
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Ingen rabatt - fakturan innehåller ett avtalstillägg (se nedan)
                  </p>
                )}

                {/* Avtalstillägg - pro rata, inte rabatt */}
                {additions.length > 0 && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">
                        Avtalstillägg - betalas pro rata, inte rabatt
                      </span>
                    </div>
                    {additions.map((add, idx) => (
                      <div key={idx} className="px-3 py-2 bg-slate-900/40 rounded-lg">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm text-white">{add.description}</span>
                          <span className="text-sm text-slate-300 font-mono">
                            {formatInvoiceAmount(add.proratedAmount)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Årspremie {formatInvoiceAmount(add.previousAnnualValue)} {'→'}{' '}
                          {formatInvoiceAmount(add.newAnnualValue)} per år från{' '}
                          {formatDate(add.effectiveFrom)}
                          {add.createdByName ? ` · Tillagt av ${add.createdByName}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Knappar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-700/50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenInvoiceId(invoice.id)}
                    className="flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Öppna faktura
                  </Button>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRejectTarget(item)
                        setRejectReason('')
                      }}
                      className="flex items-center justify-center gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <XCircle className="w-4 h-4" />
                      Avslå
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(item)}
                      loading={approvingId === invoice.id}
                      className="flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Godkänn
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Årspremier-fliken */}
      {activeTab === 'premiums' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Varje premiefaktura godkänns innan den kan skickas. Här kan du
            samtidigt indexjustera kundens årspremie - justeringen slår igenom
            på alla ännu ej bokförda premiefakturor och loggas i kundens
            avtalshistorik.
          </p>

          {/* Sök på kundnamn/fakturanummer */}
          {premiumItems.length > 0 && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={premiumSearch}
                onChange={e => setPremiumSearch(e.target.value)}
                placeholder="Sök på kundnamn eller fakturanummer..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
              />
            </div>
          )}

          {premiumLoading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <LoadingSpinner />
                <p className="text-slate-400 mt-4">Laddar premiefakturor...</p>
              </div>
            </div>
          ) : premiumItems.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700 rounded-xl py-12">
              <div className="text-center">
                <CheckCircle className="w-10 h-10 text-[#20c58f] mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white mb-1">
                  Inga premiefakturor väntar på godkännande
                </h3>
                <p className="text-sm text-slate-400">
                  Nya årspremiefakturor dyker upp här när de genereras.
                </p>
              </div>
            </div>
          ) : filteredPremiums.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700 rounded-xl py-8">
              <p className="text-sm text-slate-400 text-center">
                Inga premiefakturor matchar "{premiumSearch}"
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPremiums.map(item => {
                const { invoice } = item
                const farFuture = isFarFuture(invoice.billing_period_start)

                return (
                  <div
                    key={invoice.id}
                    className={`p-4 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3 ${
                      farFuture ? 'opacity-70' : ''
                    }`}
                  >
                    {/* Kortheader: fakturanr, badges, kund, period, belopp */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-white font-semibold">
                            {invoice.invoice_number || 'Utan fakturanummer'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Kräver godkännande
                          </span>
                          {farFuture && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600">
                              <CalendarClock className="w-3 h-3" />
                              Kommande
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 mt-1 truncate">
                          {invoice.customer_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Period {formatDate(invoice.billing_period_start)} -{' '}
                          {formatDate(invoice.billing_period_end)}
                        </p>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <p className="text-xs text-slate-400">Exkl. moms</p>
                        <p className="text-lg font-bold text-white font-mono">
                          {formatInvoiceAmount(invoice.subtotal)}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          {formatInvoiceAmount(invoice.total_amount)} inkl. moms
                        </p>
                      </div>
                    </div>

                    {/* Knappar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-700/50">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenInvoiceId(invoice.id)}
                        className="flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Öppna faktura
                      </Button>
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openIndexDialog(item)}
                          disabled={!invoice.customer_id}
                          className="flex items-center justify-center gap-2"
                        >
                          <TrendingUp className="w-4 h-4" />
                          Indexjustera
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprovePremium(item)}
                          loading={approvingPremiumId === invoice.id}
                          className="flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Godkänn
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Avslå-dialog */}
      <Modal
        isOpen={!!rejectTarget}
        onClose={() => {
          if (!rejecting) setRejectTarget(null)
        }}
        title="Avslå faktura"
        subtitle={rejectTarget?.invoice.invoice_number || undefined}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRejectTarget(null)}
              disabled={rejecting}
            >
              Avbryt
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              loading={rejecting}
              disabled={!rejectReason.trim()}
            >
              Avslå och notifiera tekniker
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-300">
            Fakturan ligger kvar under Godkännanden tills rabatten är åtgärdad.
            Teknikern notifieras med din anledning.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Anledning (obligatorisk)
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="T.ex. rabatten är för hög eller motivering saknas..."
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Indexjusteringsdialog */}
      <Modal
        isOpen={!!indexTarget}
        onClose={() => {
          if (!applyingIndex) setIndexTarget(null)
        }}
        title="Indexjustera årspremie"
        subtitle={indexTarget?.invoice.customer_name}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIndexTarget(null)}
              disabled={applyingIndex}
            >
              Avbryt
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyIndex}
              loading={applyingIndex}
              disabled={!indexValid}
            >
              Justera årspremien
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-3">
          {/* Nuvarande premie */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <p className="text-xs font-medium text-slate-400 mb-1">Nuvarande årspremie</p>
            <p className="text-lg font-bold text-white font-mono">
              {formatKr(currentPremium)}/år
            </p>
          </div>

          {/* Procent + belopp som samspelar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Justering i procent
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={percentInput}
                onChange={e => handlePercentChange(e.target.value)}
                placeholder="t.ex. 3,2"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Ny årspremie (kr, exkl. moms)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={e => handleAmountChange(e.target.value)}
                placeholder={String(Math.round(currentPremium))}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
              />
            </div>
          </div>

          {/* Förhandsvisning */}
          {indexValid && newAnnualValue !== null && (
            <p className="text-sm text-white font-medium">
              {formatKr(currentPremium)} {'→'} {formatKr(newAnnualValue)}/år{' '}
              <span className={indexPercent !== null && indexPercent < 0 ? 'text-red-400' : 'text-[#20c58f]'}>
                ({indexPercent !== null && indexPercent >= 0 ? '+' : ''}
                {formatPercentSv(indexPercent ?? 0)} %)
              </span>
            </p>
          )}

          {/* Info om vad justeringen gör */}
          <div className="flex items-start gap-2 p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">
              Justeringen ändrar kundens årspremie från och med{' '}
              {formatDate(indexTarget?.invoice.billing_period_start ?? null)} och
              räknar om alla premiefakturor som ännu inte är bokförda eller
              skickade. Ändringen loggas i kundens avtalshistorik.
            </p>
          </div>
        </div>
      </Modal>

      {/* Fakturadetaljer */}
      <InvoiceDetailModal
        isOpen={!!openInvoiceId}
        onClose={() => setOpenInvoiceId(null)}
        invoiceId={openInvoiceId}
        onStatusChange={() => {
          fetchItems()
          fetchPremiums()
        }}
      />
    </div>
  )
}
