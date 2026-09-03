// src/services/caseCustomerService.ts
// Skapar eller återanvänder en customers-rad för privat- eller företagsärenden
// när ärendet avslutas och ska faktureras.
//
// Sedan 2026-09-03 (docs/kundnummer-fortnox-plan.md) tilldelas INGET kundnummer
// här: engångskunder får sitt nummer från Fortnox när fakturan skickas
// ("Till Fortnox" → api/fortnox/allocate-customer). Raden skapas utan nummer så
// att tekniker kan avsluta ärenden utan Fortnox-åtkomst. Portalens räknare
// (allocate_customer_number) används bara av Oneflow-webhooken för avtalskunder.

import { supabase } from '../lib/supabase'

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
  /** null tills Fortnox-numret allokerats vid "Till Fortnox" */
  customerNumber: number | null
  created: boolean
}

export class CaseCustomerService {
  static async getOrCreateCaseCustomer(
    params: GetOrCreateCaseCustomerParams
  ): Promise<CaseCustomerResult> {
    const lookupKey = params.caseType === 'private'
      ? params.personnummer
      : params.organization_number

    // 1. Matcha på befintlig customer via organization_number-kolumnen (samma
    //    kolumn för org.nr och personnummer). Rad MED nummer föredras, sedan
    //    äldst. Multisite-enheter (parent_customer_id) blir aldrig engångskund.
    if (lookupKey) {
      const { data: existing, error: lookupError } = await supabase
        .from('customers')
        .select('id, customer_number, customer_group_id')
        .eq('organization_number', lookupKey)
        .is('parent_customer_id', null)
        .order('customer_number', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (lookupError) {
        throw new Error(`Kunde inte slå upp befintlig kund: ${lookupError.message}`)
      }

      if (existing) {
        // Grupp från ärendet fyller på en rad som saknar grupp
        if (!existing.customer_group_id && params.customerGroupId) {
          await supabase
            .from('customers')
            .update({ customer_group_id: params.customerGroupId })
            .eq('id', existing.id)
        }
        return {
          customerId: existing.id,
          customerNumber: existing.customer_number ?? null,
          created: false,
        }
      }
    }

    // 2. Bestäm kundgrupp (styr Fortnox-nummerintervallet vid Till Fortnox)
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
      throw new Error('Välj kundgrupp för företagskunden (på ärendet) innan kunden kan läggas upp.')
    }

    // 3. Skapa customer-rad UTAN kundnummer. company_name och contact_email är
    //    NOT NULL i schemat.
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
        customer_number: null,
        is_active: true,
        billing_active: false,
        source_type: 'manual',
      })
      .select('id')
      .single()

    if (insertError) {
      throw new Error(`Kunde inte skapa kund: ${insertError.message}`)
    }

    return {
      customerId: inserted.id,
      customerNumber: null,
      created: true,
    }
  }
}
