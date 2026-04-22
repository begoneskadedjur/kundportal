// src/services/importedCustomerContractService.ts
// Hanterar kontrakts-container för importerade kunder (utan Oneflow).
// Kunder som migrerats från Fortnox har riktiga avtal men saknar digital
// container — denna service skapar och redigerar en `contracts`-rad + tillhörande
// `case_billing_items` med exakt samma struktur som wizard-/Oneflow-flödet.

import { supabase } from '../lib/supabase'
import { CaseBillingService } from './caseBillingService'
import type { CaseBillingItemWithRelations } from '../types/caseBilling'

const IMPORTED_ONEFLOW_PREFIX = 'imported-'

export interface ImportedContractItems {
  contractId: string
  services: CaseBillingItemWithRelations[]
  articles: CaseBillingItemWithRelations[]
}

export class ImportedCustomerContractService {
  /**
   * Hitta kundens importerade kontrakt (skapar INTE om det saknas).
   * Returnerar null om kunden inte har något importerat kontrakt.
   */
  static async findContract(customerId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('contracts')
      .select('id')
      .eq('customer_id', customerId)
      .eq('oneflow_contract_id', `${IMPORTED_ONEFLOW_PREFIX}${customerId}`)
      .maybeSingle()

    if (error) throw new Error(`Kunde inte läsa kontrakt: ${error.message}`)
    return data?.id ?? null
  }

  /**
   * Hämta eller skapa kontraktscontainer för en importerad kund.
   * oneflow_contract_id sätts till "imported-<customer_id>" för att uppfylla
   * UNIQUE/NOT NULL-constraints och samtidigt vara spårbart.
   */
  static async getOrCreateContract(customerId: string): Promise<string> {
    const existing = await this.findContract(customerId)
    if (existing) return existing

    const { data: customer } = await supabase
      .from('customers')
      .select('company_name, organization_number, contact_email, contact_person')
      .eq('id', customerId)
      .single()

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        customer_id: customerId,
        oneflow_contract_id: `${IMPORTED_ONEFLOW_PREFIX}${customerId}`,
        source_type: 'manual',
        type: 'contract',
        status: 'active',
        template_id: 'imported',
        company_name: customer?.company_name ?? null,
        organization_number: customer?.organization_number ?? null,
        contact_email: customer?.contact_email ?? null,
        contact_person: customer?.contact_person ?? null,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Kunde inte skapa kontrakt: ${error.message}`)
    return data.id
  }

  /**
   * Läs kontraktscontainerns items (tjänster + artiklar).
   */
  static async getItems(contractId: string): Promise<{
    services: CaseBillingItemWithRelations[]
    articles: CaseBillingItemWithRelations[]
  }> {
    const items = await CaseBillingService.getCaseBillingItems(contractId, 'contract')
    return {
      services: items.filter(i => i.item_type === 'service'),
      articles: items.filter(i => i.item_type === 'article'),
    }
  }

  /**
   * Radera hela kontraktscontainern + dess items.
   * Används om admin vill rensa ett avtal (t.ex. när Oneflow-kontrakt senare skapats).
   */
  static async deleteContract(customerId: string): Promise<void> {
    const contractId = await this.findContract(customerId)
    if (!contractId) return

    await supabase
      .from('case_billing_items')
      .delete()
      .eq('case_id', contractId)
      .eq('case_type', 'contract')

    const { error } = await supabase.from('contracts').delete().eq('id', contractId)
    if (error) throw new Error(`Kunde inte ta bort kontrakt: ${error.message}`)
  }
}
