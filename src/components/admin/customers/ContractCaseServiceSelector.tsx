// src/components/admin/customers/ContractCaseServiceSelector.tsx
// Tunn wrapper som säkerställer att en contract-container finns för importerade
// kunder, och sedan renderar samma CaseServiceSelector som används på
// Oneflow-wizardens steg 7 och i EditCaseModal.

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import CaseServiceSelector from '../../shared/CaseServiceSelector'
import { ImportedCustomerContractService } from '../../../services/importedCustomerContractService'

interface Props {
  customerId: string
  readOnly?: boolean
  /** Kallas när användaren ändrat något. `servicesSubtotal` = summan av
   *  tjänsterader (exkl. moms) — motsvarar "beräknat årsbelopp". */
  onChange?: (servicesSubtotal: number) => void
}

export default function ContractCaseServiceSelector({ customerId, readOnly, onChange }: Props) {
  const [contractId, setContractId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ImportedCustomerContractService.getOrCreateContract(customerId)
      .then(id => { if (!cancelled) setContractId(id) })
      .catch(err => { if (!cancelled) setError(err?.message || 'Kunde inte läsa kontrakt') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [customerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    )
  }

  if (error || !contractId) {
    return (
      <p className="text-sm text-red-400 py-3 text-center">
        {error || 'Kunde inte ladda avtalscontainer'}
      </p>
    )
  }

  return (
    <CaseServiceSelector
      caseId={contractId}
      caseType="contract"
      customerId={customerId}
      readOnly={readOnly}
      onChange={(_items, summary) => onChange?.(summary.subtotal)}
    />
  )
}
