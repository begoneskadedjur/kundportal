// src/services/avtalsKundService.ts
// Kundvalet i Skapa avtal eller offert (3.100.0): sök befintlig kund, förslag
// på org.nr och organisationen (huvudkontor och enheter) för enhetsvalet.
//
// Alla roller som använder guiden (admin, koordinator, tekniker, säljare) får
// läsa customers (customers_consolidated_select). Avtal läses inte direkt:
// tekniker ser bara sina egna avtalsrader, så antalet levande avtal räknas via
// resolvern (RPC get_contract_candidates, SECURITY DEFINER).

import { supabase } from '../lib/supabase'
import { kundSokVillkor } from '../shared/kundSok'
import { identityNumberVariants } from '../shared/contractSigning'
import { idNummerSiffror } from '../shared/avtalsKundKoppling'
import { resolveContractCandidates } from './contractResolver'

export interface AvtalsKund {
  id: string
  company_name: string | null
  site_name: string | null
  site_type: string | null
  is_multisite: boolean | null
  is_active: boolean | null
  parent_customer_id: string | null
  organization_id: string | null
  organization_number: string | null
  customer_number: number | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  billing_email: string | null
  billing_reference: string | null
  customer_group_id: string | null
  price_list_id: string | null
}

export interface AvtalsKundOrganisation {
  /** Raden som valdes */
  kund: AvtalsKund
  /** Organisationens huvudkontor: kunden själv, dess förälder, eller null för en fristående kund */
  huvudkontor: AvtalsKund | null
  /** Huvudkontorets aktiva enheter, sorterade på namn */
  enheter: AvtalsKund[]
}

const KOLUMNER =
  'id, company_name, site_name, site_type, is_multisite, is_active, parent_customer_id, organization_id, organization_number, customer_number, contact_person, contact_email, contact_phone, contact_address, billing_email, billing_reference, customer_group_id, price_list_id'

const huvudkontorForst = (a: AvtalsKund, b: AvtalsKund) =>
  Number(b.site_type === 'huvudkontor') - Number(a.site_type === 'huvudkontor') ||
  (a.company_name ?? '').localeCompare(b.company_name ?? '', 'sv')

export class AvtalsKundService {
  /** Aktiva kunder på namn, org.nr eller kundnummer (högst 8). */
  static async sok(q: string): Promise<AvtalsKund[]> {
    const villkor = kundSokVillkor(q)
    if (!villkor) return []
    const { data, error } = await supabase
      .from('customers')
      .select(KOLUMNER)
      .eq('is_active', true)
      .or(villkor)
      .order('company_name')
      .limit(8)
    if (error) throw new Error(error.message || 'Kunderna kunde inte sökas')
    return (data ?? []) as unknown as AvtalsKund[]
  }

  /**
   * Aktiva kunder med exakt samma org- eller personnummer (alla skrivsätt).
   * Tomt svar när numret inte är fullständigt. Huvudkontor först.
   */
  static async forslagForIdNummer(raw: string): Promise<AvtalsKund[]> {
    if (!idNummerSiffror(raw)) return []
    const varianter = identityNumberVariants(raw)
    if (varianter.length === 0) return []
    const { data, error } = await supabase
      .from('customers')
      .select(KOLUMNER)
      .eq('is_active', true)
      .in('organization_number', varianter)
      .limit(10)
    if (error) return []
    return ((data ?? []) as unknown as AvtalsKund[]).sort(huvudkontorForst)
  }

  /** Kunden med organisationen runt den: huvudkontoret och dess aktiva enheter. */
  static async hamtaOrganisation(customerId: string): Promise<AvtalsKundOrganisation | null> {
    const { data, error } = await supabase.from('customers').select(KOLUMNER).eq('id', customerId).maybeSingle()
    if (error || !data) return null
    const kund = data as unknown as AvtalsKund

    let huvudkontor: AvtalsKund | null = null
    if (kund.parent_customer_id) {
      const { data: foralder } = await supabase.from('customers').select(KOLUMNER).eq('id', kund.parent_customer_id).maybeSingle()
      huvudkontor = (foralder as unknown as AvtalsKund | null) ?? null
    }
    const rotId = huvudkontor?.id ?? kund.id
    const { data: barn } = await supabase
      .from('customers')
      .select(KOLUMNER)
      .eq('parent_customer_id', rotId)
      .eq('is_active', true)
      .order('site_name', { ascending: true, nullsFirst: false })
      .limit(500)
    const enheter = (barn ?? []) as unknown as AvtalsKund[]
    if (!huvudkontor && (enheter.length > 0 || kund.site_type === 'huvudkontor')) huvudkontor = kund
    return { kund, huvudkontor, enheter }
  }

  /** Antal levande avtal som täcker kundraden idag (eget, via enhetsval eller huvudkontorets heltäckande). */
  static async antalLevandeAvtal(customerId: string): Promise<number> {
    try {
      const kandidater = await resolveContractCandidates(customerId)
      return kandidater.length
    } catch {
      return 0
    }
  }
}
