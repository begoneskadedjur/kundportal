// src/shared/fortnoxCustomerNumbers.ts
// Rena hjälpfunktioner för kundnummer från Fortnox. Delas av servern
// (api/_lib/fortnoxCustomerMirror.ts, api/fortnox/allocate-customer.ts) och
// frontend. Inga beroenden, ingen I/O. Se docs/kundnummer-fortnox-plan.md.

/**
 * Fortnox CustomerNumber är en sträng och får vara alfanumerisk. Bara rent
 * numeriska nummer utan inledande nolla räknas som "nummer i serien";
 * "0042" och "A123" lagras i spegeln men ignoreras i max-beräkningen.
 */
export function parseFortnoxCustomerNumber(nr: string | number | null | undefined): number | null {
  if (nr == null) return null
  const s = String(nr).trim()
  if (!/^[1-9]\d{0,8}$/.test(s)) return null
  return parseInt(s, 10)
}

/**
 * Org-/personnummer som bara siffror, för jämförelse oberoende av hur
 * ekonomi skrev det i Fortnox. 12-siffrigt personnummer (19YYMMDDXXXX)
 * trimmas till 10 så det matchar YYMMDD-XXXX.
 */
export function orgDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 12 && /^(18|19|20)/.test(digits)) return digits.slice(2)
  return digits
}

/**
 * Formatet Fortnox validerar: XXXXXX-XXXX för både bolag och privatpersoner.
 * Returnerar null om numret inte har 10 siffror (Fortnox avvisar då hela
 * POST:en, så fältet utelämnas hellre).
 */
export function formatOrgNrForFortnox(raw: string | null | undefined): string | null {
  const digits = orgDigits(raw)
  if (!digits || digits.length !== 10) return null
  return `${digits.slice(0, 6)}-${digits.slice(6)}`
}

/**
 * Skiljer personnummer från organisationsnummer: i personnummer är
 * månadssiffrorna (position 3-4) 01-12, i org.nr är mittparet alltid >= 20.
 */
export function isPersonnummer(nr: string | null | undefined): boolean {
  if (!nr) return false
  const digits = nr.replace(/\D/g, '')
  const core = digits.length === 12 ? digits.slice(2) : digits
  if (core.length !== 10) return false
  const month = parseInt(core.slice(2, 4), 10)
  return month >= 1 && month <= 12
}

/**
 * Delar upp en svensk enradsadress ("Gatan 1, 123 45 Ort, Sverige") i
 * Fortnox-fälten Address1 / ZipCode / City. Returnerar hela strängen som
 * Address1 om postnummer inte kan hittas.
 */
export function parseSwedishAddress(address: string | null | undefined): {
  address1: string | null
  zipCode: string | null
  city: string | null
} {
  if (!address) return { address1: null, zipCode: null, city: null }
  const cleaned = address.replace(/,?\s*Sverige\s*$/i, '').trim()
  const m = cleaned.match(/^(.*?),?\s*(\d{3}\s?\d{2})\s+(.+)$/)
  if (!m) return { address1: cleaned || null, zipCode: null, city: null }
  return {
    address1: m[1].replace(/,\s*$/, '').trim() || null,
    zipCode: m[2].replace(/\s+/, ' ').trim(),
    city: m[3].replace(/,\s*$/, '').trim() || null,
  }
}

export interface FortnoxCustomerCardInput {
  name: string
  organization_number?: string | null
  billing_email?: string | null
  billing_address?: string | null
  phone?: string | null
  customer_type?: 'PRIVATE' | 'COMPANY'
  terms_of_payment?: string | null
  show_price_vat_included?: boolean
  our_reference?: string | null
}

/**
 * Bygger Fortnox-kundkortet på samma sätt oavsett om det skapas från
 * frontendens findOrCreateCustomer eller serverns allocate-customer.
 * Org.nr skickas bara om det validerar (Fortnox avvisar annars hela POST:en);
 * anroparen får `orgNrSkipped` för att kunna varna.
 */
export function buildFortnoxCustomerCard(input: FortnoxCustomerCardInput): {
  card: Record<string, unknown>
  type: 'PRIVATE' | 'COMPANY'
  orgNrSkipped: boolean
} {
  const type = input.customer_type ?? (isPersonnummer(input.organization_number) ? 'PRIVATE' : 'COMPANY')
  const addr = parseSwedishAddress(input.billing_address)
  const formattedOrg = formatOrgNrForFortnox(input.organization_number)
  const orgDigits10 = formattedOrg ? formattedOrg.replace('-', '') : null
  const orgOk = !!orgDigits10 && luhnValid(orgDigits10)
  const card: Record<string, unknown> = {
    Name: input.name,
    Type: type,
    ...(orgOk ? { OrganisationNumber: formattedOrg } : {}),
    ...(input.billing_email ? { EmailInvoice: input.billing_email, Email: input.billing_email } : {}),
    ...(addr.address1 ? { Address1: addr.address1 } : {}),
    ...(addr.zipCode ? { ZipCode: addr.zipCode } : {}),
    ...(addr.city ? { City: addr.city } : {}),
    ...(input.phone ? { Phone1: input.phone } : {}),
    ...(input.terms_of_payment ? { TermsOfPayment: input.terms_of_payment } : {}),
    ...(input.show_price_vat_included != null ? { ShowPriceVATIncluded: input.show_price_vat_included } : {}),
    ...(input.our_reference ? { OurReference: input.our_reference } : {}),
  }
  return { card, type, orgNrSkipped: !!input.organization_number && !orgOk }
}

/**
 * Radpris inklusive moms, avrundat till öre. Fortnox tolkar radens Price som
 * inklusive moms när fakturan har VATIncluded=true (kundkortets "priser inkl.
 * moms" är standard för privatpersoner), så portalens exkl-pris måste räknas
 * upp innan det skickas. Annars blir en 1 000 kr-rad 1 000 kr inkl. moms.
 */
export function toVatInclusivePrice(unitPriceExclVat: number, vatRatePercent: number | null | undefined): number {
  const rate = Number(vatRatePercent ?? 0)
  return Math.round(unitPriceExclVat * (1 + rate / 100) * 100) / 100
}

/** Luhn-kontroll (mod 10) för svenska org-/personnummer med 10 siffror. */
export function luhnValid(digits10: string): boolean {
  if (!/^\d{10}$/.test(digits10)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    let d = parseInt(digits10[i], 10)
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

/**
 * Nästa lediga nummer i ett intervall. Luckor fylls aldrig nedåt: Fortnox
 * återanvänder inte raderade nummer, och raderade syns inte i listan.
 * `floor` är portalens räknare eller annat känt golv. null = serien full.
 */
export function nextFreeNumber(params: {
  seriesStart: number
  seriesEnd: number
  taken: Iterable<number | null | undefined>
  floor?: number | null
}): number | null {
  const { seriesStart, seriesEnd, taken, floor } = params
  let max = seriesStart - 1
  for (const n of taken) {
    if (n == null) continue
    if (n >= seriesStart && n <= seriesEnd && n > max) max = n
  }
  if (floor != null && floor >= seriesStart && floor <= seriesEnd && floor > max) max = floor
  const next = max + 1
  return next > seriesEnd ? null : next
}

/** Fortnox felkod för "kundnumret används redan / har använts men raderats". */
export const FORTNOX_DUPLICATE_CUSTOMER_CODE = 2000637

interface FortnoxErrorBody {
  ErrorInformation?: {
    error?: number
    Error?: number
    message?: string
    Message?: string
    code?: number | string
    Code?: number | string
  }
  error?: string
}

export function fortnoxErrorCode(body: unknown): number | null {
  const info = (body as FortnoxErrorBody | null)?.ErrorInformation
  const raw = info?.code ?? info?.Code
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : null
}

export function fortnoxErrorMessage(body: unknown, fallback = 'Okänt Fortnox-fel'): string {
  const b = body as FortnoxErrorBody | null
  return b?.ErrorInformation?.message || b?.ErrorInformation?.Message || b?.error || fallback
}

export function isFortnoxDuplicateCustomerError(body: unknown): boolean {
  if (fortnoxErrorCode(body) === FORTNOX_DUPLICATE_CUSTOMER_CODE) return true
  const msg = fortnoxErrorMessage(body, '')
  return /används redan|already been used|already exists/i.test(msg)
}

export interface FortnoxMirrorHit {
  customer_number: string
  numeric_value: number | null
  name: string | null
  organisation_number: string | null
  active: boolean
  missing_since: string | null
}

export type CandidateDecision =
  | { kind: 'none' }
  | { kind: 'single'; hit: FortnoxMirrorHit }
  | { kind: 'multiple'; candidates: FortnoxMirrorHit[] }
  | { kind: 'inactive-only'; candidates: FortnoxMirrorHit[] }

/**
 * Regel vid org.nr-träffar i spegeln (beslut 2026-09-03: aldrig auto-val vid
 * flera aktiva). Raderade (missing_since) räknas inte som träff.
 * Sortering: nummer inom föredraget intervall först, sedan lägst nummer.
 */
export function decideCandidate(
  hits: FortnoxMirrorHit[],
  preferredRange?: { start: number; end: number } | null
): CandidateDecision {
  const live = hits.filter(h => !h.missing_since)
  if (live.length === 0) return { kind: 'none' }
  const inRange = (h: FortnoxMirrorHit) =>
    !!preferredRange && h.numeric_value != null &&
    h.numeric_value >= preferredRange.start && h.numeric_value <= preferredRange.end
  const sorted = [...live].sort((a, b) => {
    const ra = inRange(a) ? 0 : 1
    const rb = inRange(b) ? 0 : 1
    if (ra !== rb) return ra - rb
    const na = a.numeric_value ?? Number.MAX_SAFE_INTEGER
    const nb = b.numeric_value ?? Number.MAX_SAFE_INTEGER
    return na - nb
  })
  const active = sorted.filter(h => h.active)
  if (active.length === 1) return { kind: 'single', hit: active[0] }
  if (active.length > 1) return { kind: 'multiple', candidates: sorted }
  return { kind: 'inactive-only', candidates: sorted }
}
