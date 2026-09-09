// src/components/customer/CustomerContractsSection.tsx
// Kundportalen: kundens avtal som papper, ur my_contract_views(). Samma
// komponent som admin ser i "Visa som kund" i avtalskartan.

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { CustomerContractPaperView, fetchMyContractViews, type CustomerContractView } from '../shared/CustomerContractPaper'

export default function CustomerContractsSection({ customerId }: { customerId?: string | null }) {
  const [views, setViews] = useState<CustomerContractView[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchMyContractViews(customerId).then((v) => {
      if (!cancelled) setViews(v)
    })
    return () => {
      cancelled = true
    }
  }, [customerId])
  if (!views || views.length === 0) return null
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-[#20c58f]" />
        <h2 className="text-base font-semibold text-white">
          {views.length === 1 ? 'Ert avtal' : `Era avtal · ${views.length}`}
        </h2>
      </div>
      <div className="space-y-5">
        {views.map((v) => (
          <CustomerContractPaperView key={v.id} view={v} />
        ))}
      </div>
    </section>
  )
}
