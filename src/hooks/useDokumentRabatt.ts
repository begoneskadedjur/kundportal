// src/hooks/useDokumentRabatt.ts
// Rabattraderna på en offert eller ett avtal (contracts.id). Ett dokument med
// rabatt som väntar eller är avslagen kan inte skickas till kunden
// (api/oneflow/draft.ts spärrar). Visas med DokumentRabattRuta.

import { useCallback, useEffect, useState } from 'react'
import { DiscountApprovalService, type DocumentDiscountLine } from '../services/discountApprovalService'

export interface DokumentRabattLage {
  lines: DocumentDiscountLine[]
  loading: boolean
  /** Någon rabatt väntar eller är avslagen: dokumentet kan inte skickas */
  blocked: boolean
  reload: () => Promise<void>
}

/** Dokumentets rabattrader. contractId = contracts.id; null = inget att läsa. */
export function useDokumentRabatt(contractId: string | null | undefined): DokumentRabattLage {
  const [lines, setLines] = useState<DocumentDiscountLine[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!contractId) { setLines([]); return }
    setLoading(true)
    try {
      setLines(await DiscountApprovalService.getDocumentDiscountLines(contractId))
    } catch (err) {
      console.error('Kunde inte läsa dokumentets rabatt:', err)
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => { void reload() }, [reload])

  return {
    lines,
    loading,
    blocked: lines.some(l => l.state.kind === 'pending' || l.state.kind === 'rejected'),
    reload,
  }
}
