// src/components/admin/customers/record/PlannedInvoicePreviewModal.tsx
//
// Förhandsvisning av en KOMMANDE faktura som planeraren räknat fram men som
// inte finns i databasen ännu. Visar fakturan som Fortnox skulle få den:
// huvud, rader, moms och summa. Ingenting sparas härifrån.

import Modal from '../../../ui/Modal'
import Button from '../../../ui/Button'
import type { BillingPlanEntry } from '../../../../services/contractInvoiceGenerator'
import { formatDateSv, formatKr } from '../../../../hooks/useCustomerRecord'

interface Props {
  entry: BillingPlanEntry
  customerName: string
  /** Avtalens namn per id, för samlade fakturor */
  contractNames: Map<string, string>
  onClose: () => void
}

const KIND_LABEL: Record<string, string> = {
  premium: 'Årspremie',
  equipment: 'Tilläggsstationer, per år',
  equipment_monthly: 'Tilläggsstationer, per månad',
}

function periodLabel(start: string, end: string) {
  return `${formatDateSv(start)} till ${formatDateSv(end)}`
}

export default function PlannedInvoicePreviewModal({ entry, customerName, contractNames, onClose }: Props) {
  const p = entry.planned
  if (!p) return null
  const kind = KIND_LABEL[entry.kind ?? 'premium'] ?? 'Årspremie'
  const rows = entry.rows ?? []
  const contractIds = Array.from(new Set(rows.map((r) => r.contract_id).filter((x): x is string => !!x)))
  const scope = entry.consolidated
    ? `Samlad faktura · ${contractIds.length} avtal`
    : entry.contractLabel ?? (entry.contractId ? contractNames.get(entry.contractId) : null) ?? 'Avtal'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Kommande faktura · ${kind}`}
      subtitle="Räknad ur avtalskartan. Finns inte i databasen ännu."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="text-xs text-slate-500">
            Skapas som utkast av Planera fakturor i avtalskartan, eller automatiskt {formatDateSv(p.invoiceDate)}.
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Stäng
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl grid grid-cols-2 gap-3 text-sm">
          <Field label="Kund" value={customerName} />
          <Field label="Avser" value={scope} />
          <Field label="Period" value={periodLabel(p.periodStart, p.periodEnd)} />
          <Field label="Fakturadatum" value={formatDateSv(p.invoiceDate)} hint={`förfaller ${formatDateSv(p.dueDate)}`} />
          <Field label="Er referens" value={entry.marking ?? 'saknas'} muted={!entry.marking} />
          <Field label="Betalning" value={`${p.sequenceNumber} av ${p.totalSequenceCount}`} />
        </div>

        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="text-xs font-medium text-slate-400 mb-2">Rader som Fortnox får dem</div>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">
              Årspremie, {periodLabel(p.periodStart, p.periodEnd)} · {formatKr(p.amount)}
            </p>
          ) : (
            <ul className="divide-y divide-slate-700/60">
              {rows.map((r, i) => {
                const contractName = r.contract_id ? contractNames.get(r.contract_id) : null
                return (
                  <li key={i} className={`flex items-baseline gap-3 py-1.5 text-sm ${r.total_price > 0 ? 'text-slate-200' : 'text-slate-500'}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.article_name}</span>
                      {entry.consolidated && contractName && (
                        <span className="block text-[11px] text-slate-500 truncate">{contractName}</span>
                      )}
                    </span>
                    <span className="tabular-nums text-xs text-slate-400 w-12 text-right shrink-0">{r.quantity} st</span>
                    <span className="tabular-nums text-xs text-slate-400 w-20 text-right shrink-0">{formatKr(r.unit_price)}</span>
                    <span className="tabular-nums w-24 text-right shrink-0">{formatKr(r.total_price)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-2 pt-2 border-t border-slate-700/50 text-sm space-y-0.5">
            <Total label="Exkl. moms" value={p.subtotal} />
            <Total label="Moms" value={p.vatAmount} muted />
            <Total label="Att betala" value={p.totalAmount} strong />
          </div>
        </div>

        {entry.notes && (
          <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
            <div className="text-xs font-medium text-slate-400 mb-1">Anteckning på fakturan</div>
            <p className="text-sm text-slate-300">{entry.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, value, hint, muted }: { label: string; value: string; hint?: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-400 mb-0.5">{label}</div>
      <div className={`truncate ${muted ? 'text-slate-500' : 'text-slate-200'}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  )
}

function Total({ label, value, muted, strong }: { label: string; value: number; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${muted ? 'text-slate-500' : strong ? 'text-slate-100 font-semibold' : 'text-slate-300'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatKr(value)}</span>
    </div>
  )
}
