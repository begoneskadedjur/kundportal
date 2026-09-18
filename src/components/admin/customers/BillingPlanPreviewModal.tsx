// src/components/admin/customers/BillingPlanPreviewModal.tsx
// Visar diff av faktureringsplan mot befintliga invoices innan apply.
// Historiska perioder filtreras bort från listan men räknas i summary.
// Passerade perioder utan faktura ("saknar faktura") kan markeras som
// fakturerade utanför portalen (systemet före Fortnox, manuell faktura)
// direkt i listan, så att planen räknar dem som täckta.

import React, { useState } from 'react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import LoadingSpinner from '../../shared/LoadingSpinner'
import type { BillingPlan, BillingPlanAction, BillingPlanEntry } from '../../../services/contractInvoiceGenerator'

export interface MarkOutsideInput {
  amount: number
  invoicedAt: string
  note: string | null
}

interface Props {
  isOpen: boolean
  plan: BillingPlan | null
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
  /** Registrera en passerad period som fakturerad utanför portalen. Saknas den visas ingen knapp. */
  onMarkOutside?: (entry: BillingPlanEntry, input: MarkOutsideInput) => Promise<void>
}

const formatAmount = (n: number | undefined) =>
  n != null ? new Intl.NumberFormat('sv-SE').format(Math.round(n)) + ' kr' : '-'

// TZ-säker: parse YYYY-MM-DD som lokal midnatt så månaden inte hoppar.
const formatPeriod = (start?: string) => {
  if (!start) return '-'
  const [y, m] = start.split('-').map(Number)
  if (!y || !m) return start
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
}

const actionMeta: Partial<Record<BillingPlanAction, { label: string; className: string }>> = {
  create: { label: 'SKAPAS', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  update: { label: 'UPPDATERAS', className: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  delete: { label: 'RADERAS', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
  locked: { label: 'LÅST', className: 'bg-slate-600/40 text-slate-300 border-slate-500/40' },
  keep: { label: 'OFÖRÄNDRAD', className: 'bg-slate-700/40 text-slate-400 border-slate-600/40' },
  // Passerad period utan faktura på ett riktigt avtal: skapas aldrig här,
  // importeras från Fortnox (avtalskartan § 6) eller markeras som
  // fakturerad utanför portalen med knappen på raden.
  uncovered: { label: 'SAKNAR FAKTURA', className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  consolidated: { label: 'SAMLINGSFAKTURA', className: 'bg-slate-700/40 text-slate-400 border-slate-600/40' },
}

// Actions som inte visas i listan (historiska skapas/backfillas silent)
const HIDDEN_ACTIONS = new Set<BillingPlanAction>([
  'create-historical',
  'backfill-historical-paid',
])

const INPUT_CLASS =
  'bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent'

export default function BillingPlanPreviewModal({ isOpen, plan, loading, onConfirm, onCancel, onMarkOutside }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [invoicedAt, setInvoicedAt] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const hasVisibleChanges = plan
    ? (plan.summary.create + plan.summary.update + plan.summary.delete) > 0
    : false
  const hasHistorical = (plan?.summary.historical ?? 0) > 0
  const hasAnythingToApply = hasVisibleChanges || hasHistorical

  const visibleEntries = (plan?.entries ?? []).filter(
    e => !HIDDEN_ACTIONS.has(e.action) && e.action !== 'keep'
  )

  const startMark = (i: number, entry: BillingPlanEntry) => {
    setOpenIdx(i)
    setAmount(String(Math.round(entry.planned?.subtotal ?? 0)))
    setInvoicedAt(entry.planned?.periodStart ?? '')
    setNote('Fakturerad i systemet före Fortnox')
    setError(null)
  }

  const submitMark = async (entry: BillingPlanEntry) => {
    if (!onMarkOutside) return
    const parsed = Number(amount.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Ange ett belopp i kronor exkl. moms.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoicedAt)) {
      setError('Ange fakturadatum som ÅÅÅÅ-MM-DD.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onMarkOutside(entry, { amount: parsed, invoicedAt, note: note.trim() || null })
      setOpenIdx(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte registrera perioden')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Förhandsgranska fakturaplan" size="lg">
      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-slate-400">
            <LoadingSpinner />
            <span>Räknar ut plan...</span>
          </div>
        )}

        {!loading && plan && (
          <>
            <div className="mb-4 p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-1">
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <span className="text-emerald-400">{plan.summary.create} nya</span>
                <span className="text-blue-400">{plan.summary.update} ändras</span>
                <span className="text-red-400">{plan.summary.delete} raderas</span>
                <span className="text-slate-400">{plan.summary.locked} låsta</span>
                <span className="text-slate-500">{plan.summary.keep} oförändrade</span>
                <span className="text-slate-500 ml-auto">belopp exkl. moms</span>
              </div>
              {hasHistorical && (
                <div className="text-xs text-slate-500">
                  {plan.summary.historical} historiska perioder registreras som betalda (visas ej i fakturering).
                </div>
              )}
            </div>

            {visibleEntries.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                {hasAnythingToApply
                  ? 'Endast historiska perioder att registrera — inga aktiva ändringar att granska.'
                  : 'Inga fakturaändringar behövs — planen stämmer med befintliga fakturor.'}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-1">
                {visibleEntries.map((entry, i) => {
                  const meta = actionMeta[entry.action]
                  if (!meta) return null
                  const canMark = entry.action === 'uncovered' && !!onMarkOutside && !!entry.planned
                  const isOpenRow = openIdx === i
                  return (
                    <div key={i} className="bg-slate-800/20 border border-slate-700/50 rounded-lg text-xs">
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className={`px-2 py-0.5 rounded border font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                        <span className="text-slate-200 w-24">{formatPeriod(entry.planned?.periodStart)}</span>
                        {entry.kind && entry.kind !== 'premium' && (
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            {entry.kind === 'equipment_monthly' ? 'tillägg per månad' : 'tillägg per år'}
                          </span>
                        )}
                        {/* Exkl. moms, samma tal som § 6 på pappret och kundens avtal */}
                        <span className="text-slate-400 font-mono w-28" title="exkl. moms">
                          {entry.action === 'update' && entry.existingAmount != null && entry.planned
                            ? `${formatAmount(entry.existingSubtotal ?? entry.existingAmount)} → ${formatAmount(entry.planned.subtotal)}`
                            : entry.planned
                            ? formatAmount(entry.planned.subtotal)
                            : formatAmount(entry.existingSubtotal ?? entry.existingAmount)}
                        </span>
                        {entry.existingStatus && (
                          <span className="text-slate-500 ml-auto">status: {entry.existingStatus}</span>
                        )}
                        {entry.reason && !canMark && <span className="text-slate-500 ml-auto">{entry.reason}</span>}
                        {canMark && (
                          <span className="ml-auto flex items-center gap-3">
                            <span className="text-slate-500 hidden sm:inline">Importera från Fortnox i § 6, eller</span>
                            <button
                              type="button"
                              onClick={() => (isOpenRow ? setOpenIdx(null) : startMark(i, entry))}
                              className="text-[#20c58f] font-semibold underline decoration-dotted hover:brightness-110 whitespace-nowrap"
                            >
                              {isOpenRow ? 'avbryt' : 'fakturerad utanför portalen'}
                            </button>
                          </span>
                        )}
                      </div>
                      {canMark && isOpenRow && (
                        <div className="px-3 pb-3 pt-2 border-t border-slate-700/50 space-y-2">
                          <p className="text-slate-400">
                            Perioden registreras som betald historik med etiketten Import. Beloppet verifieras inte mot Fortnox.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="block">
                              <span className="block text-xs font-medium text-slate-400 mb-1">Belopp exkl. moms</span>
                              <input className={`${INPUT_CLASS} w-full`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                            </label>
                            <label className="block">
                              <span className="block text-xs font-medium text-slate-400 mb-1">Fakturadatum</span>
                              <input className={`${INPUT_CLASS} w-full`} type="date" lang="sv-SE" value={invoicedAt} onChange={(e) => setInvoicedAt(e.target.value)} />
                            </label>
                            <label className="block">
                              <span className="block text-xs font-medium text-slate-400 mb-1">Anteckning</span>
                              <input className={`${INPUT_CLASS} w-full`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="t.ex. fakturanummer i gamla systemet" />
                            </label>
                          </div>
                          {error && <p className="text-red-400">{error}</p>}
                          <div className="flex justify-end">
                            <Button variant="primary" size="sm" onClick={() => void submitMark(entry)} disabled={saving}>
                              {saving ? 'Registrerar…' : 'Registrera som fakturerad'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Avbryt</Button>
        <Button variant="primary" onClick={onConfirm} disabled={loading || !hasAnythingToApply}>
          Applicera plan
        </Button>
      </div>
    </Modal>
  )
}
