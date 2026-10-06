// src/pages/shared/intranet/interactive/sok/sokExempel.ts
// Påhittad exempeldata till övningssökrutan i guiden om sökrutan.
// Inga riktiga kunder, personer eller nummer. Sökningen sker lokalt och
// efterliknar RPC:n global_search grovt, utan att röra databasen.

import {
  normalize,
  type GlobalSearchResponse,
  type ParsedQuery,
  type RpcCase,
  type RpcCustomer,
  type RpcDocument,
  type RpcInvoice,
  type RpcLead,
  type RpcTechnician,
  type SearchPortal,
} from '../../../../../components/shared/search/searchModel'

interface ExCase extends RpcCase {
  /** Extra sökbara fält som inte visas i raden */
  phone?: string
  email?: string
  idnr?: string
  /** Ärendet delas med en annan tekniker eller tillhör någon annan (för teknikerns omfång) */
  mine: boolean
}

const CASES: ExCase[] = [
  {
    kind: 'case', id: 'ex-c1', case_type: 'private', number: 'BE-0009011', title: 'Getingbo under takfoten',
    status: 'Bokad', date: '2026-10-08T09:00:00+02:00', pest: 'Getingar', address: 'Exempelvägen 4, 186 97 Övningsby',
    technicians: 'Du', customer_name: 'Anna Exempelsson', customer_id: null, scheduled: true, archived: false, exact: false,
    phone: '070-123 45 67', email: 'anna@exempel.se', idnr: '800101-0000', mine: true,
  },
  {
    kind: 'case', id: 'ex-c2', case_type: 'business', number: 'BE-0009042', title: 'Råttor i lastkajen',
    status: 'Öppen', date: '2026-10-02', pest: 'Råttor', address: 'Industrigatan 12, 123 45 Teststad',
    technicians: 'Du och Kollega Ett', customer_name: 'Bageriet Solrosen AB', customer_id: null, scheduled: false, archived: false, exact: false,
    phone: '08-555 000 10', email: 'kontakt@solrosen.exempel', idnr: '559900-0001', mine: true,
  },
  {
    kind: 'case', id: 'ex-c3', case_type: 'contract', number: 'BE-0009105', title: 'Kontroll av stationer',
    status: 'Planerad', date: '2026-10-14T13:00:00+02:00', pest: 'Gnagare', address: 'Lagervägen 3, 123 45 Teststad',
    technicians: 'Du', customer_name: 'Lager Exempel AB', customer_id: 'ex-k2', scheduled: true, archived: false, exact: false,
    idnr: '559900-0002', mine: true,
  },
  {
    kind: 'case', id: 'ex-c4', case_type: 'private', number: 'BE-0009120', title: 'Vägglöss i sovrum',
    status: 'Öppen', date: '2026-10-05', pest: 'Vägglöss', address: 'Provgatan 7, 186 97 Övningsby',
    technicians: 'Kollega Två', customer_name: 'Bo Provsson', customer_id: null, scheduled: false, archived: false, exact: false,
    phone: '073-987 65 43', email: 'bo@prov.exempel', mine: false,
  },
  {
    kind: 'case', id: 'ex-c5', case_type: 'private', number: 'BE-0004120', title: 'Möss i källaren',
    status: 'Avslutat', date: '2025-11-20', pest: 'Möss', address: 'Exempelvägen 4, 186 97 Övningsby',
    technicians: 'Du', customer_name: 'Anna Exempelsson', customer_id: null, scheduled: false, archived: true, exact: false,
    phone: '070-123 45 67', email: 'anna@exempel.se', mine: true,
  },
]

const CUSTOMERS: RpcCustomer[] = [
  {
    kind: 'customer', id: 'ex-k1', title: 'Bageriet Solrosen AB', site_name: null, customer_number: 4711,
    contract_type: 'Skadedjursavtal', is_active: true, is_multisite: false, site_type: null, exact: false,
    company_name: 'Bageriet Solrosen AB', organization_number: '559900-0001', contact_person: 'Sara Testsson',
    contact_email: 'kontakt@solrosen.exempel', contact_phone: '08-555 000 10', contact_address: 'Industrigatan 12, 123 45 Teststad',
  },
  {
    kind: 'customer', id: 'ex-k2', title: 'Lager Exempel AB', site_name: null, customer_number: 4712,
    contract_type: 'Skadedjursavtal', is_active: true, is_multisite: false, site_type: null, exact: false,
    company_name: 'Lager Exempel AB', organization_number: '559900-0002', contact_person: 'Per Provare',
    contact_email: 'per@lager.exempel', contact_phone: '08-555 000 20', contact_address: 'Lagervägen 3, 123 45 Teststad',
  },
  {
    kind: 'customer', id: 'ex-k3', title: 'Anna Exempelsson', site_name: null, customer_number: 4713,
    contract_type: null, is_active: true, is_multisite: false, site_type: null, exact: false,
    company_name: null, organization_number: '800101-0000', contact_person: 'Anna Exempelsson',
    contact_email: 'anna@exempel.se', contact_phone: '070-123 45 67', contact_address: 'Exempelvägen 4, 186 97 Övningsby',
  },
]

interface ExDocument extends RpcDocument {
  mine: boolean
  orgnr?: string
  email?: string
}

const DOCUMENTS: ExDocument[] = [
  {
    kind: 'document', id: 'ex-d1', doc_type: 'offer', title: 'Bageriet Solrosen AB', company_name: 'Bageriet Solrosen AB',
    number: 'OF-2026-118', status: 'pending', contract_type: null, total_value: 8400, annual_value: null,
    end_date: null, date: '2026-10-01', customer_id: 'ex-k1', archived: false, mine: true,
    orgnr: '559900-0001', email: 'kontakt@solrosen.exempel',
  },
  {
    kind: 'document', id: 'ex-d2', doc_type: 'contract', title: 'Lager Exempel AB', company_name: 'Lager Exempel AB',
    number: null, status: 'active', contract_type: 'Skadedjursavtal', total_value: 36000, annual_value: 12000,
    end_date: '2028-12-31', date: '2026-01-10', customer_id: 'ex-k2', archived: false, mine: false,
    orgnr: '559900-0002', email: 'per@lager.exempel',
  },
]

const LEADS: (RpcLead & { phone?: string; email?: string; postal?: string })[] = [
  {
    kind: 'lead', id: 'ex-l1', title: 'Café Övningen', name: 'Lisa Lead', company_name: 'Café Övningen',
    number: 'W-2026-0412', status: 'ny', pest: 'Möss', city: 'Övningsby', date: '2026-10-05',
    phone: '072-111 22 33', email: 'lisa@cafe.exempel', postal: '186 97',
  },
]

const TECHNICIANS: RpcTechnician[] = [
  { kind: 'technician', id: 'ex-t1', title: 'Kollega Ett', role: 'Skadedjurstekniker', email: 'kollega.ett@exempel.se', phone: '070-000 00 01', is_active: true },
  { kind: 'technician', id: 'ex-t2', title: 'Kollega Två', role: 'Skadedjurstekniker', email: 'kollega.tva@exempel.se', phone: '070-000 00 02', is_active: true },
]

const INVOICES: (RpcInvoice & { orgnr?: string })[] = [
  {
    kind: 'invoice', id: 'ex-f1', number: 'F-2026-0315', fortnox_number: '7315', title: 'Bageriet Solrosen AB',
    status: 'sent', total_amount: 5625, date: '2026-09-30', paid_at: null, due_date: '2026-10-30', exact: false,
    orgnr: '559900-0001',
  },
]

// ---------------------------------------------------------------------------
// Lokal matchning, grovt som RPC:n. Extrafälten (telefon, e-post, mine)
// följer med raderna men läses aldrig av buildGroups.
// ---------------------------------------------------------------------------

const digitsOf = (s: string | null | undefined) => (s || '').replace(/\D/g, '')
const trimZeros = (s: string) => s.replace(/^0+/, '')
const phoneDigits = (s: string | null | undefined) => digitsOf(s).replace(/^46/, '0')
const postalOf = (s: string | null | undefined) => (s || '').replace(/\s/g, '')
const tenDigits = (s: string | null | undefined) => digitsOf(s).slice(-10)

function textHit(fields: Array<string | number | null | undefined>, term: string): boolean {
  const hay = normalize(fields.filter(f => f !== null && f !== undefined).join(' '))
  const tokens = normalize(term).split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every(t => hay.includes(t))
}

export function exampleSearch(portal: SearchPortal, parsed: ParsedQuery): GlobalSearchResponse {
  const kind = parsed.kind
  const term = parsed.term.trim().toLowerCase()
  const d = digitsOf(term)
  const tech = portal === 'technician'

  const caseHits: RpcCase[] = []
  for (const c of CASES) {
    if (c.archived && !parsed.includeArchived) continue
    if (tech && !c.mine) continue
    const num = trimZeros(digitsOf(c.number))
    let hit = false
    let exact = false
    switch (kind) {
      case 'case':
        hit = num.startsWith(trimZeros(d))
        exact = num === trimZeros(d)
        break
      case 'number':
        exact = num === trimZeros(d)
        hit = exact || (d.length >= 3 && num.startsWith(trimZeros(d)))
        break
      case 'email': hit = (c.email || '').toLowerCase().includes(term); break
      case 'phone': hit = phoneDigits(c.phone).includes(phoneDigits(term)); break
      case 'orgnr': hit = !!c.idnr && tenDigits(c.idnr) === tenDigits(term); break
      case 'postal': hit = postalOf(c.address).includes(d); break
      case 'text':
        hit = textHit([c.number, c.title, c.customer_name, c.pest, c.address, c.technicians, c.email, c.phone], term)
        break
    }
    if (hit) {
      caseHits.push({ ...c, exact })
    }
  }

  const customerHits: RpcCustomer[] = []
  for (const c of CUSTOMERS) {
    let exact = false
    let hit = false
    switch (kind) {
      case 'number': exact = String(c.customer_number) === trimZeros(d); hit = exact; break
      case 'orgnr': exact = tenDigits(c.organization_number) === tenDigits(term); hit = exact; break
      case 'email': hit = (c.contact_email || '').toLowerCase().includes(term); break
      case 'phone': hit = phoneDigits(c.contact_phone).includes(phoneDigits(term)); break
      case 'postal': hit = postalOf(c.contact_address).includes(d); break
      case 'text':
        hit = textHit([c.title, c.contact_person, c.contact_email, c.contact_phone, c.contact_address, c.organization_number], term)
        break
    }
    if (hit) customerHits.push({ ...c, exact })
  }

  const documentHits: RpcDocument[] = []
  for (const doc of DOCUMENTS) {
    if (tech && !doc.mine) continue
    let hit = false
    switch (kind) {
      case 'number': hit = (doc.number || '').toLowerCase().includes(term); break
      case 'orgnr': hit = tenDigits(doc.orgnr) === tenDigits(term); break
      case 'email': hit = (doc.email || '').toLowerCase().includes(term); break
      case 'text': hit = textHit([doc.title, doc.company_name, doc.number], term); break
    }
    if (hit) documentHits.push(doc)
  }

  const leads: RpcLead[] = []
  const technicians: RpcTechnician[] = []
  const invoices: RpcInvoice[] = []
  if (!tech) {
    for (const l of LEADS) {
      let hit = false
      switch (kind) {
        case 'number': hit = (l.number || '').toLowerCase().includes(term); break
        case 'email': hit = (l.email || '').toLowerCase().includes(term); break
        case 'phone': hit = phoneDigits(l.phone).includes(phoneDigits(term)); break
        case 'postal': hit = postalOf(l.postal) === d; break
        case 'text': hit = textHit([l.title, l.name, l.company_name, l.pest, l.city, l.number, l.email], term); break
      }
      if (hit) leads.push(l)
    }
    for (const t of TECHNICIANS) {
      let hit = false
      switch (kind) {
        case 'email': hit = (t.email || '').toLowerCase().includes(term); break
        case 'phone': hit = phoneDigits(t.phone).includes(phoneDigits(term)); break
        case 'text': hit = textHit([t.title, t.email, t.role], term); break
      }
      if (hit) technicians.push(t)
    }
    for (const inv of INVOICES) {
      let exact = false
      let hit = false
      switch (kind) {
        case 'number':
          exact = inv.fortnox_number === d || digitsOf(inv.number) === d
          hit = exact || (d.length >= 3 && (inv.number || '').toLowerCase().endsWith(term))
          break
        case 'orgnr': hit = tenDigits(inv.orgnr) === tenDigits(term); break
        case 'text':
          exact = (inv.number || '').toLowerCase() === term
          hit = textHit([inv.number, inv.fortnox_number, inv.title], term)
          break
      }
      if (hit) invoices.push({ ...inv, exact })
    }
  }

  caseHits.sort((a, b) => Number(b.exact) - Number(a.exact) || Number(a.archived) - Number(b.archived))
  customerHits.sort((a, b) => Number(b.exact) - Number(a.exact))

  return {
    scope: portal,
    kind,
    cases: caseHits,
    customers: customerHits,
    documents: documentHits,
    leads,
    technicians,
    invoices,
  }
}

/** Förslag att prova, per roll */
export const EXAMPLE_QUERIES: Record<'tekniker' | 'kontor', { query: string; note: string }[]> = {
  tekniker: [
    { query: '9011', note: 'ärendenummer' },
    { query: '559900-0001', note: 'org.nr' },
    { query: '070-123 45 67', note: 'telefon' },
    { query: '186 97', note: 'postnummer' },
    { query: 'solrosen', note: 'fritext' },
    { query: 'möss arkiv', note: 'med arkiv' },
  ],
  kontor: [
    { query: 'BE-0009011', note: 'ärendenummer' },
    { query: '4711', note: 'kundnummer' },
    { query: 'anna@exempel.se', note: 'e-post' },
    { query: '186 97', note: 'postnummer' },
    { query: 'boka in kollega', note: 'åtgärd' },
    { query: 'möss arkiv', note: 'med arkiv' },
  ],
}
