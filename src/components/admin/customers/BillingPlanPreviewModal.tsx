// src/components/admin/customers/BillingPlanPreviewModal.tsx
// Visar diff av faktureringsplan mot befintliga invoices innan apply.
// Historiska perioder filtreras bort från listan men räknas i summary.

import React from 'react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import LoadingSpinner from '../../shared/LoadingSpinner'
import type { BillingPlan, BillingPlanEntry, BillingPlanAction } from '../../../services/contractInvoiceGenerator'

interface Props {
  isOpen: boolean
  plan: BillingPlan | null
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
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
}

// Actions som inte visas i listan (historiska skapas/backfillas silent)
const HIDDEN_ACTIONS = new Set<BillingPlanAction>([
  'create-historical',
  'backfill-historical-paid',
])

export default function BillingPlanPreviewModal({ isOpen, plan, loading, onConfirm, onCancel }: Props) {
  if (!isOpen) return null

  const hasVisibleChanges = plan
    ? (plan.summary.create + plan.summary.update + plan.summary.delete) > 0
    : false
  const hasHistorical = (plan?.summary.historical ?? 0) > 0
  const hasAnythingToApply = hasVisibleChanges || hasHistorical

  const visibleEntries = (plan?.entries ?? []).filter(
    e => !HIDDEN_ACTIONS.has(e.action) && e.action !== 'keep'
  )

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
              </div>
              {hasHistorical && (
                <div className="text-xs text-slate-500">
                  {plan.summary.historical} historiska perioder registreras som betalda (visas ej i fakturering).
                </div>
              )}
            </div>

            {!hasAnythingToApply ? (
              <div className="py-6 text-center text-sm text-slate-400">
                Inga fakturaändringar behövs — planen stämmer med befintliga fakturor.
              </div>
            ) : visibleEntries.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                Endast historiska perioder att registrera — inga aktiva ändringar att granska.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-1">
                {visibleEntries.map((entry, i) => {
                  const meta = actionMeta[entry.action]
                  if (!meta) return null
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-lg text-xs"
                    >
                      <span className={`px-2 py-0.5 rounded border font-medium ${meta.className}`}>
                        {meta.label}
                      </span>
                      <span className="text-slate-200 w-24">{formatPeriod(entry.planned?.periodStart)}</span>
                      <span className="text-slate-400 font-mono w-28">
                        {entry.action === 'update' && entry.existingAmount != null && entry.planned
                          ? `${formatAmount(entry.existingAmount)} → ${formatAmount(entry.planned.totalAmount)}`
                          : entry.planned
                          ? formatAmount(entry.planned.totalAmount)
                          : formatAmount(entry.existingAmount)}
                      </span>
                      {entry.existingStatus && (
                        <span className="text-slate-500 ml-auto">status: {entry.existingStatus}</span>
                      )}
                      {entry.reason && <span className="text-slate-500 ml-auto">{entry.reason}</span>}
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
          {hasAnythingToApply ? 'Applicera plan' : 'Stäng'}
        </Button>
      </div>
    </Modal>
  )
}
