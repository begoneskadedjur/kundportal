// src/components/admin/invoicing/InvoiceMarkingSection.tsx
// Ärendemärkningspanel för kunder med aktiverad ärendemärkning
// (work_order_number/work_object/room_number-flaggorna på kundkortet).
// Visar ärendets värden + strängen som blir "Er referens" i Fortnox.
// Datat kommer från useInvoiceMarking (src/hooks) — read-only.

import { Tag, AlertTriangle } from 'lucide-react'
import type { InvoiceMarkingInfo } from '../../../hooks/useInvoiceMarking'

interface InvoiceMarkingSectionProps {
  marking: InvoiceMarkingInfo
  customerName: string
}

export default function InvoiceMarkingSection({ marking, customerName }: InvoiceMarkingSectionProps) {
  return (
    <div className="p-3 bg-[#20c58f]/5 border border-[#20c58f]/30 rounded-xl">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white mb-2">
        <Tag className="w-4 h-4 text-[#20c58f]" />
        <span className="truncate">Ärendemärkning · {customerName}</span>
      </h3>
      <div className="space-y-1.5">
        {marking.fields.map(f =>
          f.value?.trim() ? (
            <div
              key={f.key}
              className="flex items-center justify-between gap-3 px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg"
            >
              <span className="text-xs text-slate-400">{f.label}</span>
              <span className="text-xs font-mono font-semibold text-white">{f.value}</span>
            </div>
          ) : (
            <div
              key={f.key}
              className="flex items-center justify-between gap-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/40 rounded-lg"
            >
              <span className="text-xs text-slate-400">{f.label}</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                Saknas på ärendet
              </span>
            </div>
          )
        )}
      </div>
      <div className="mt-2 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-600 bg-slate-900/50 text-[11px] text-slate-400">
        Blir Er referens i Fortnox:{' '}
        <span className="font-mono text-[#20c58f]">{marking.effectiveReference || '–'}</span>
      </div>
    </div>
  )
}
