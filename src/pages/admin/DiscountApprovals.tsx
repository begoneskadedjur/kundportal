// src/pages/admin/DiscountApprovals.tsx
// Godkännandesida för rabatter: rabattansvariga (profiles.can_approve_discounts)
// granskar fakturor i pending_approval, ser teknikerns motivering och
// godkänner (→ ready) eller avslår (tekniker notifieras, fakturan ligger kvar).
// Avtalstillägg är pro rata och visas med förklaring - de är INTE rabatter.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  CheckCircle,
  FileText,
  Percent,
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
import { DiscountApprovalService, type ApprovalItem } from '../../services/discountApprovalService'
import { formatInvoiceAmount, type InvoiceType } from '../../types/invoice'

const TYPE_BADGE: Record<InvoiceType, { label: string; className: string }> = {
  private: { label: 'Privat', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  business: { label: 'Företag', className: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  adhoc: { label: 'Merförsäljning avtal', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  contract: { label: 'Avtal', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
}

const formatDate = (date: string | null) =>
  date ? new Date(date).toLocaleDateString('sv-SE') : '-'

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

  useEffect(() => {
    if (canApprove) fetchItems()
  }, [canApprove, fetchItems])

  const handleApprove = async (item: ApprovalItem) => {
    if (approvingId) return
    setApprovingId(item.invoice.id)
    try {
      await DiscountApprovalService.approve(item, approverName)
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
            Granska rabatter och godkänn fakturor innan de går vidare till Fortnox
          </p>
        </div>
      </div>

      {loading ? (
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
                    Ingen rabatt - kräver godkännande enligt rutin
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

      {/* Fakturadetaljer */}
      <InvoiceDetailModal
        isOpen={!!openInvoiceId}
        onClose={() => setOpenInvoiceId(null)}
        invoiceId={openInvoiceId}
        onStatusChange={fetchItems}
      />
    </div>
  )
}
