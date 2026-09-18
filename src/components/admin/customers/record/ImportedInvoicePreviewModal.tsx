// src/components/admin/customers/record/ImportedInvoicePreviewModal.tsx
//
// Läsvy för en faktura som hämtats från Fortnox (F-nummer) eller registrerats
// som historik: huvud, rader, moms, betalt och kvar att betala. Ingenting går
// att ändra här, fakturan ägs av Fortnox eller det gamla systemet.

import Modal from '../../../ui/Modal'
import Button from '../../../ui/Button'
import { formatDateSv, formatKr, type RecordInvoice } from '../../../../hooks/useCustomerRecord'

interface Props {
  invoice: RecordInvoice
  customerName: string
  onClose: () => void
}

export default function ImportedInvoicePreviewModal({ invoice, customerName, onClose }: Props) {
  const fromFortnox = (invoice.invoice_number ?? '').startsWith('F-') || !!invoice.fortnox_document_number
  const total = Number(invoice.total_amount ?? 0)
  const subtotal = Number(invoice.subtotal ?? 0)
  const vat = invoice.vat_amount != null ? Number(invoice.vat_amount) : Math.round((total - subtotal) * 100) / 100
  const balance = invoice.balance_due != null ? Number(invoice.balance_due) : invoice.status === 'paid' ? 0 : null
  const paidAmount = balance != null ? Math.round((total - balance) * 100) / 100 : null
  const items = invoice.items ?? []

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${fromFortnox ? 'Fortnox' : 'Historik'} · ${invoice.invoice_number ?? ''}`}
      subtitle={fromFortnox ? 'Hämtad från Fortnox, kan bara ändras där.' : 'Registrerad som historik, inte verifierad mot Fortnox.'}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3 px-4 py-2.5">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Stäng
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl grid grid-cols-2 gap-3 text-sm">
          <Field label="Kund" value={customerName} />
          <Field label="Period" value={invoice.billing_period_start ? `${formatDateSv(invoice.billing_period_start)} till ${formatDateSv(invoice.billing_period_end)}` : 'saknas'} />
          <Field label="Fakturadatum" value={formatDateSv(invoice.sent_at ?? invoice.created_at)} hint={invoice.due_date ? `förfaller ${formatDateSv(invoice.due_date)}` : undefined} />
          <Field label="Er referens" value={invoice.invoice_marking ?? 'saknas'} muted={!invoice.invoice_marking} />
          <Field label="Status" value={statusLabel(invoice.status, balance, total)} />
          <Field label="Betald" value={invoice.paid_at ? formatDateSv(invoice.paid_at) : paidAmount != null && paidAmount > 0 ? `delvis, ${formatKr(paidAmount)} inkl. moms` : 'nej'} />
        </div>

        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="text-xs font-medium text-slate-400 mb-2">Rader</div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Inga rader registrerade.</p>
          ) : (
            <ul className="divide-y divide-slate-700/60">
              {items.map((r, i) => (
                <li key={i} className="flex items-baseline gap-3 py-1.5 text-sm text-slate-200">
                  <span className="min-w-0 flex-1 truncate">{r.article_name ?? 'Rad'}</span>
                  {r.quantity != null && <span className="tabular-nums text-xs text-slate-400 w-12 text-right shrink-0">{r.quantity} st</span>}
                  {r.unit_price != null && <span className="tabular-nums text-xs text-slate-400 w-20 text-right shrink-0">{formatKr(Number(r.unit_price))}</span>}
                  <span className="tabular-nums w-24 text-right shrink-0">{formatKr(Number(r.total_price ?? 0))}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 pt-2 border-t border-slate-700/50 text-sm space-y-0.5">
            <Total label="Exkl. moms" value={subtotal} />
            <Total label="Moms" value={vat} muted />
            <Total label="Att betala" value={total} strong />
            {balance != null && balance > 0 && balance < total && (
              <>
                <Total label="Betalt" value={total - balance} muted />
                <Total label="Kvar att betala" value={balance} strong warn />
              </>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
            <div className="text-xs font-medium text-slate-400 mb-1">Anteckning</div>
            <p className="text-sm text-slate-300 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function statusLabel(status: string | null, balance: number | null, total: number): string {
  if (status === 'cancelled') return 'Makulerad'
  if (status === 'paid' || balance === 0) return 'Betald'
  if (balance != null && balance > 0 && balance < total) return `Delbetald, ${formatKr(balance)} kvar inkl. moms`
  if (status === 'sent' || status === 'invoiced' || status === 'booked') return 'Skickad, obetald'
  return status ?? 'okänd'
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

function Total({ label, value, muted, strong, warn }: { label: string; value: number; muted?: boolean; strong?: boolean; warn?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${warn ? 'text-amber-300' : muted ? 'text-slate-500' : strong ? 'text-slate-100 font-semibold' : 'text-slate-300'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatKr(value)}</span>
    </div>
  )
}
