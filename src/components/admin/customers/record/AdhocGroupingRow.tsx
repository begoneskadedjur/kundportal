// src/components/admin/customers/record/AdhocGroupingRow.tsx
// Kundkortets flik Fakturering: "Ärenden faktureras: per ärende / samlat per
// månad" (customers.adhoc_invoice_grouping), steg 12 i
// docs/planer/avtalsar-exakt-arsdag-teknik.md. Samma värde som avtalskartan
// visar för avrop och som BillingSettingsModal skriver.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import {
  ADHOC_GROUPING_LABEL,
  CustomerBillingService,
  adhocGroupingOf,
  type AdhocInvoiceGrouping,
} from '../../../../services/customerBillingService'

interface Props {
  customerId: string
  value: string | null | undefined
  canEdit: boolean
  className?: string
  onSaved?: () => void | Promise<void>
}

export default function AdhocGroupingRow({ customerId, value, canEdit, className = '', onSaved }: Props) {
  const current = adhocGroupingOf(value)
  const [saving, setSaving] = useState(false)

  const change = async (next: AdhocInvoiceGrouping) => {
    if (next === current) return
    setSaving(true)
    try {
      await CustomerBillingService.setAdhocGrouping(customerId, next)
      toast.success(`Ärenden faktureras nu ${ADHOC_GROUPING_LABEL[next]}.`)
      await onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara ärendefaktureringen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 min-w-0 text-xs text-slate-400 ${className}`}>
      <Icon name="kund.fakturavag" size={16} className="flex-shrink-0 text-slate-500" />
      <span className="flex-shrink-0">Ärenden faktureras:</span>
      {canEdit ? (
        <select
          value={current}
          disabled={saving}
          onChange={(e) => void change(e.target.value as AdhocInvoiceGrouping)}
          className="bg-transparent border-0 border-b border-dotted border-slate-600 rounded-none px-0 py-0 text-xs font-medium text-slate-200 focus:ring-0 focus:border-[#20c58f] disabled:opacity-50"
          aria-label="Ärenden faktureras"
        >
          <option value="per_case">{ADHOC_GROUPING_LABEL.per_case}</option>
          <option value="monthly_batch">{ADHOC_GROUPING_LABEL.monthly_batch}</option>
        </select>
      ) : (
        <span className="font-medium text-slate-200">{ADHOC_GROUPING_LABEL[current]}</span>
      )}
    </div>
  )
}
