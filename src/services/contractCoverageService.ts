// src/services/contractCoverageService.ts
// "Ingår i avtalet": vilka tjänster täcks av kundens avtal (§ 4 Tjänster i
// avtalet) för ett ärende? Används av ärendemodalens tjänsteväljare för att
// skapa raden med covered_by_contract = true och pris 0, så att det som
// ingår i premien aldrig debiteras som merförsäljning av misstag.
//
// Avtalet löses via ärendets cases.contract_id, annars via resolvern (eget
// avtal, omfattning, täcker-alla). Läsningen går genom en SECURITY DEFINER-
// RPC när den finns, eftersom tekniker saknar läsrätt på contracts.

import { supabase } from '../lib/supabase'
import { resolveContractForCustomer } from './contractResolver'

export interface ContractCoverage {
  contractId: string | null
  /** service_id för tjänster som ingår i premien (billing_model = premium) */
  coveredServiceIds: Set<string>
  contractLabel: string | null
}

const EMPTY: ContractCoverage = { contractId: null, coveredServiceIds: new Set(), contractLabel: null }

export class ContractCoverageService {
  static async forCase(customerId: string | null | undefined, caseId?: string | null, caseType?: string | null): Promise<ContractCoverage> {
    if (!customerId) return EMPTY
    try {
      let contractId: string | null = null
      if (caseId && (caseType === 'contract' || !caseType)) {
        const { data } = await supabase.from('cases').select('contract_id').eq('id', caseId).maybeSingle()
        contractId = (data as { contract_id?: string | null } | null)?.contract_id ?? null
      }
      if (!contractId) contractId = await resolveContractForCustomer(customerId)
      if (!contractId) return EMPTY
      return this.forContract(contractId)
    } catch (err) {
      console.warn('[ContractCoverageService] kunde inte läsa avtalstäckning:', err)
      return EMPTY
    }
  }

  static async forContract(contractId: string): Promise<ContractCoverage> {
    const [{ data: rows }, { data: contract }] = await Promise.all([
      supabase
        .from('case_billing_items')
        .select('service_id, billing_model, status')
        .eq('case_id', contractId)
        .eq('case_type', 'contract')
        .eq('item_type', 'service')
        .neq('status', 'cancelled'),
      supabase.from('contracts').select('label, contract_type').eq('id', contractId).maybeSingle(),
    ])
    const covered = new Set<string>()
    for (const r of (rows ?? []) as { service_id: string | null; billing_model: string | null }[]) {
      if (r.service_id && (r.billing_model ?? 'premium') === 'premium') covered.add(r.service_id)
    }
    const c = contract as { label?: string | null; contract_type?: string | null } | null
    return { contractId, coveredServiceIds: covered, contractLabel: c?.label ?? c?.contract_type ?? null }
  }
}
