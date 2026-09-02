// src/components/admin/customers/record/LinkFortnoxInvoiceModal.tsx
// Koppla en Fortnox-faktura till en avtalsperiod som saknar faktura i
// portalen (§ 7 på avtalskartan visar perioden som "saknar faktura").
// Hämtar fakturan från Fortnox, visar rader och belopp, och sparar den som
// historisk avtalsfaktura F-{nr} som täcker perioden.

import { useState } from 'react'
import { FileSearch, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../../ui/Modal'
import { ContractInvoiceImportService } from '../../../../services/contractInvoiceImportService'
import type { FortnoxInvoiceDetail } from '../../../../services/fortnoxService'
import { formatDateSv, formatKr } from '../../../../hooks/useCustomerRecord'

export interface LinkFortnoxTarget {
  customerId: string
  customerName: string
  /** null = samlad faktura som täcker alla avtal på kunden */
  contractId: string | null
  contractLabel: string | null
  coveredContractIds?: string[]
  periodStart: string
  periodEnd: string
  /** Förväntat belopp exkl. moms (för jämförelse i förhandsvisningen) */
  expectedSubtotal?: number | null
}

interface Props {
  target: LinkFortnoxTarget | null
  onClose: () => void
  onLinked: () => void | Promise<void>
}

export default function LinkFortnoxInvoiceModal({ target, onClose, onLinked }: Props) {
  const [number, setNumber] = useState('')
  const [preview, setPreview] = useState<FortnoxInvoiceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!target) return null

  const fetchPreview = async () => {
    if (!number.trim()) return
    setLoading(true)
    setPreview(null)
    try {
      setPreview(await ContractInvoiceImportService.preview(number))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte hämta fakturan från Fortnox')
    } finally {
      setLoading(false)
    }
  }

  const link = async () => {
    if (!preview) return
    setSaving(true)
    try {
      const result = await ContractInvoiceImportService.importForPeriod({
        fortnoxNumber: number,
        customerId: target.customerId,
        contractId: target.contractId,
        coveredContractIds: target.coveredContractIds,
        periodStart: target.periodStart,
        periodEnd: target.periodEnd,
      })
      toast.success(
        `${result.invoiceNumber} täcker nu perioden ${formatDateSv(target.periodStart)} t.o.m. ${formatDateSv(target.periodEnd)} (${formatKr(result.subtotal)} exkl. moms).`
      )
      await onLinked()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte koppla fakturan')
    } finally {
      setSaving(false)
    }
  }

  const net = preview ? Number(preview.Net) : 0
  const diff = preview && target.expectedSubtotal != null ? net - target.expectedSubtotal : null

  return (
    <Modal isOpen onClose={onClose} title="Koppla Fortnox-faktura till perioden" size="md">
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">
          {target.contractLabel ? <b className="text-slate-200">{target.contractLabel}</b> : <b className="text-slate-200">Alla avtal (samlad faktura)</b>}
          {' · '}
          {target.customerName} · period {formatDateSv(target.periodStart)} t.o.m. {formatDateSv(target.periodEnd)}
          {target.expectedSubtotal != null && <> · förväntat {formatKr(target.expectedSubtotal)} exkl. moms</>}
        </p>

        <div className="flex gap-2">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void fetchPreview()
            }}
            placeholder="Fortnox fakturanummer, t.ex. 643"
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => void fetchPreview()}
            disabled={loading || !number.trim()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-200 border border-slate-600 rounded-lg px-3 py-1.5 hover:border-[#20c58f] disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
            Hämta
          </button>
        </div>

        {preview && (
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2 text-sm">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-semibold text-slate-100">Fortnox {preview.DocumentNumber}</span>
              <span className="text-slate-400 text-xs">
                {preview.InvoiceDate} · {preview.CustomerName}
                {preview.YourReference ? ` · Er referens ${preview.YourReference}` : ''}
              </span>
              <span className="ml-auto text-xs">
                {Number(preview.Balance) === 0 ? (
                  <span className="text-[#20c58f]">betald</span>
                ) : (
                  <span className="text-amber-400">obetald {formatKr(Number(preview.Balance))}</span>
                )}
                {preview.Cancelled && <span className="text-red-400 ml-2">makulerad</span>}
              </span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1">
              {(preview.InvoiceRows ?? []).map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-1 truncate">{r.Description}</span>
                  <span className="tabular-nums text-slate-400">{Number(r.DeliveredQuantity).toLocaleString('sv-SE')} st</span>
                  <span className="tabular-nums w-24 text-right">{formatKr(Number(r.Total))}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline gap-3 pt-1 border-t border-slate-700/60 text-xs">
              <span className="text-slate-400">Exkl. moms</span>
              <span className="font-semibold text-slate-100 tabular-nums">{formatKr(net)}</span>
              {diff != null && Math.abs(diff) >= 1 && (
                <span className="text-amber-300">
                  skiljer {diff > 0 ? '+' : ''}
                  {formatKr(diff)} mot avtalets premie
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
          <button onClick={onClose} disabled={saving} className="text-xs text-slate-400 hover:text-slate-200">
            Avbryt
          </button>
          <button
            onClick={() => void link()}
            disabled={!preview || preview.Cancelled || saving}
            className="inline-flex items-center gap-1.5 bg-[#20c58f] text-[#fff] text-sm font-semibold rounded-xl px-4 py-2 hover:brightness-110 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Koppla till perioden
          </button>
        </div>
      </div>
    </Modal>
  )
}
