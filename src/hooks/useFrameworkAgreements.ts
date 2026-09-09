// src/hooks/useFrameworkAgreements.ts
// Ramavtal som är relevanta för kundkortet: kundens egna, organisationens
// och de som kundens avtal pekar på. Laddas om med kartans reloadKey.

import { useEffect, useMemo, useState } from 'react'
import { FrameworkAgreementService, type FrameworkAgreement } from '../services/contractScopeService'

export function useFrameworkAgreements(customerId: string | null, contractFrameworkIds: Array<string | null | undefined>, reloadKey = 0) {
  const [list, setList] = useState<FrameworkAgreement[]>([])
  const idsKey = contractFrameworkIds.filter(Boolean).sort().join(',')
  useEffect(() => {
    if (!customerId) {
      setList([])
      return
    }
    let cancelled = false
    FrameworkAgreementService.listForCustomer(customerId, idsKey ? idsKey.split(',') : []).then((l) => {
      if (!cancelled) setList(l)
    })
    return () => {
      cancelled = true
    }
  }, [customerId, idsKey, reloadKey])
  const byId = useMemo(() => new Map(list.map((f) => [f.id, f])), [list])
  return { list, byId }
}
