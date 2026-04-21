// src/services/caseCustomerService.ts
// Skapar eller återanvänder en customers-rad för privat- eller företagsärenden
// när ärendet avslutas och ska faktureras. Tilldelar kundnummer via
// CustomerGroupService.allocateNumber (atomisk RPC).

import { supabase } from '../lib/supabase'
import { CustomerGroupService } from './customerGroupService'

export interface GetOrCreateCaseCustomerParams {
  caseType: 'private' | 'business'
  name: string
  personnummer?: string | null
  organization_number?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  customerGroupId?: string
}

export interface CaseCustomerResult {
  customerId: string
  customerNumber: number
  created: boolean
}

export class CaseCustomerService {
  static async getOrCreateCaseCustomer(
    params: GetOrCreateCaseCustomerParams
  ): Promise<CaseCustomerResult> {
    const lookupKey = params.caseType === 'private'
      ? params.personnummer
      : params.organization_number

    // 1. Matcha på befintlig customer via organization_number-kolumnen
    //    (samma kolumn används för både org_nr och personnummer).
    if (lookupKey) {
      const { data: existing, error: lookupError } = await supabase
        .from('customers')
        .select('id, customer_number')
        .eq('organization_number', lookupKey)
        .not('customer_number', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (lookupError) {
        throw new Error(`Kunde inte slå upp befintlig kund: ${lookupError.message}`)
      }

      if (existing?.customer_number) {
        return {
          customerId: existing.id,
          customerNumber: existing.customer_number,
          created: false,
        }
      }
    }

    // 2. Bestäm kundgrupp
    let groupId: string | undefined = params.customerGroupId

    if (params.caseType === 'private') {
      const { data: privateGroup, error: groupError } = await supabase
        .from('customer_groups')
        .select('id')
        .eq('is_private_default', true)
        .eq('is_active', true)
        .maybeSingle()

      if (groupError) {
        throw new Error(`Kunde inte hitta privatkundsgrupp: ${groupError.message}`)
      }
      if (!privateGroup) {
        throw new Error('Ingen aktiv privatkundsgrupp hittad. Sätt is_private_default=true på rätt grupp i /admin/kundgrupper.')
      }
      groupId = privateGroup.id
    }

    if (!groupId) {
      throw new Error('Välj kundgrupp innan ärendet kan avslutas.')
    }

    // 3. Allokera kundnummer atomiskt via RPC
    const customerNumber = await CustomerGroupService.allocateNumber(groupId)

    // 4. Skapa customer-rad. company_name och contact_email är NOT NULL i schemat.
    const companyName = params.name || 'Okänd kund'
    const contactEmail = params.email || ''

    const { data: inserted, error: insertError } = await supabase
      .from('customers')
      .insert({
        company_name: companyName,
        contact_person: params.name || null,
        contact_email: contactEmail,
        contact_phone: params.phone || null,
        contact_address: params.address || null,
        billing_email: params.email || null,
        billing_address: params.address || null,
        organization_number: lookupKey || null,
        customer_group_id: groupId,
        customer_number: customerNumber,
        is_active: true,
        billing_active: false,
        source_type: 'case',
      })
      .select('id')
      .single()

    if (insertError) {
      throw new Error(`Kunde inte skapa kund: ${insertError.message}`)
    }

    return {
      customerId: inserted.id,
      customerNumber,
      created: true,
    }
  }
}
