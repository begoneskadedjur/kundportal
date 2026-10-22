// src/shared/contractCustomerMatch.ts
// Hittar en avtalskund som ett nytt engångsjobb troligen gäller, så att
// formuläret kan föreslå Extrabesök Avtalskund i stället. Arbete hos en
// avtalskund som inte ingår i avtalet ska vara Extrabesök, men lades hos WBAB
// upp som engångsjobb minst sex gånger hösten 2026 (och gav lösa kundrader).
// Ren modul utan DB.

export interface MatchableCustomer {
  id: string
  company_name: string | null
  organization_number?: string | null
  contact_address?: string | null
  billing_address?: string | null
  parent_customer_id?: string | null
  is_active?: boolean | null
  is_multisite?: boolean | null
  billing_active?: boolean | null
  annual_value?: number | string | null
  contract_status?: string | null
  source_type?: string | null
}

export interface ContractCustomerMatch {
  customer: MatchableCustomer
  reason: 'orgnr' | 'adress' | 'namn'
}

/**
 * Avtalskund = aktiv kund med premie, aktiv fakturering, multisite (huvudkontor
 * eller enhet) eller uppkommen ur ett Oneflow-avtal. Engångskunderna som
 * faktureringen skapar (caseCustomerService) har inget av det.
 */
export function isContractCustomer(c: MatchableCustomer): boolean {
  if (c.is_active === false) return false
  if (c.contract_status === 'terminated') return false
  return Number(c.annual_value ?? 0) > 0 || c.billing_active === true || c.is_multisite === true || c.source_type === 'oneflow'
}

const digits10 = (v: string | null | undefined): string | null => {
  const d = (v ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : null
}

/** "Saxdalsvägen 60, 771 65 Ludvika" → "saxdalsvägen 60". Kräver gatunummer. */
export function streetKey(address: string | null | undefined): string | null {
  const street = (address ?? '').split(',')[0].toLowerCase().replace(/\s+/g, ' ').trim()
  return /\d/.test(street) && /[a-zåäö]/.test(street) ? street : null
}

const nameKey = (v: string | null | undefined): string =>
  (v ?? '').toLowerCase().replace(/[^a-z0-9åäöéü ]/g, ' ').replace(/\b(ab|hb|kb)\b/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Bästa träff bland avtalskunderna: org-/personnummer före gatuadress före
 * namn. Namnet räcker när formulärets namn är hela kundnamnet eller dess
 * första ord ("WBAB" → "WBAB WessmanBarken ..."); bland flera namnträffar
 * väljs huvudkontoret.
 */
export function findContractCustomerMatch(
  form: { orgnr?: string | null; address?: string | null; name?: string | null },
  customers: MatchableCustomer[]
): ContractCustomerMatch | null {
  const candidates = customers.filter(isContractCustomer)

  const formOrg = digits10(form.orgnr)
  if (formOrg) {
    const hit = candidates.find((c) => digits10(c.organization_number) === formOrg)
    if (hit) return { customer: hit, reason: 'orgnr' }
  }

  const formStreet = streetKey(form.address)
  if (formStreet) {
    const hits = candidates.filter((c) => streetKey(c.contact_address) === formStreet || streetKey(c.billing_address) === formStreet)
    // En enhet på adressen går före huvudkontoret: där utförs jobbet
    const hit = hits.find((c) => c.parent_customer_id) ?? hits[0]
    if (hit) return { customer: hit, reason: 'adress' }
  }

  const formName = nameKey(form.name)
  if (formName.length >= 4) {
    const hits = candidates.filter((c) => {
      const n = nameKey(c.company_name)
      return n === formName || n.startsWith(formName + ' ')
    })
    const hit = hits.find((c) => !c.parent_customer_id) ?? hits[0]
    if (hit) return { customer: hit, reason: 'namn' }
  }

  return null
}
