// src/shared/invoiceDelivery.ts
// Fakturavägen: hur kunden får sina fakturor (e-post, brev eller e-faktura).
// Ren logik utan databas, delas mellan webben och serverns signering och
// Fortnox-allokering.
//
// Beslut 2026-10-22 (Christian, fallet Nacka vatten och avfall): den som gör
// avtalet kan inte veta hur kunden vill betala, och ingen ska behöva välja.
// Vägen sätts automatiskt ur avtalets fakturafält (deriveDeliveryFromContract):
// e-post i fältet → e-post, adress → brev, inget → kontaktpersonens e-post.
// Den är en inställning på kundsidan (fliken Fakturering) som kan ändras.
// Saknas vägen helt (ingen kontaktperson heller) stoppas fakturan som skydd.
//
// Fortnox-fakta (kontrollerat 2026-10-22 mot alla 958 aktiva kundkort):
// DefaultDeliveryTypes.Invoice är EMAIL, ELECTRONICINVOICE eller PRINT, och
// en PUT med bara { Invoice } lämnar Order och Offer orörda.

import { isPersonnummer, orgDigits, parseSwedishAddress } from './fortnoxCustomerNumbers'

export type InvoiceDeliveryMethod = 'email' | 'print' | 'einvoice'
export type FortnoxInvoiceDeliveryType = 'EMAIL' | 'PRINT' | 'ELECTRONICINVOICE'

/** Vem som satte vägen: kunden i Oneflow, ekonomi i portalen, Fortnox-kortet eller vid uppläggning */
export type InvoiceDeliverySource = 'kund' | 'ekonomi' | 'fortnox' | 'upplaggning'

export const INVOICE_DELIVERY_METHODS: InvoiceDeliveryMethod[] = ['email', 'einvoice', 'print']

export const INVOICE_DELIVERY_LABEL: Record<InvoiceDeliveryMethod, string> = {
  email: 'E-post',
  einvoice: 'E-faktura',
  print: 'Brev',
}

export const INVOICE_DELIVERY_SOURCE_LABEL: Record<InvoiceDeliverySource, string> = {
  kund: 'avtalet',
  ekonomi: 'ändrad för hand',
  fortnox: 'Fortnox-kortet',
  upplaggning: 'kunduppgifterna',
}

const TO_FORTNOX: Record<InvoiceDeliveryMethod, FortnoxInvoiceDeliveryType> = {
  email: 'EMAIL',
  print: 'PRINT',
  einvoice: 'ELECTRONICINVOICE',
}

export function toFortnoxDeliveryType(method: InvoiceDeliveryMethod): FortnoxInvoiceDeliveryType {
  return TO_FORTNOX[method]
}

/** Fortnox-kortets värde till portalens. Okänt värde (t.ex. PRINTSERVICE) ger null. */
export function fromFortnoxDeliveryType(value: string | null | undefined): InvoiceDeliveryMethod | null {
  switch ((value ?? '').toUpperCase()) {
    case 'EMAIL': return 'email'
    case 'PRINT': return 'print'
    case 'ELECTRONICINVOICE': return 'einvoice'
    default: return null
  }
}

export function isInvoiceDeliveryMethod(value: unknown): value is InvoiceDeliveryMethod {
  return value === 'email' || value === 'print' || value === 'einvoice'
}

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/**
 * Adressen räcker för ett brev: gata/box, postnummer och ort. Orten får bara
 * vara bokstäver, så att text efter orten (t.ex. "Östersund. Referens: Ansvar
 * 28310") inte hamnar som ort på Fortnox-kortet. Referensen hör hemma i Er referens.
 */
export function isMailableAddress(value: string | null | undefined): boolean {
  const a = parseSwedishAddress(value)
  return !!a.address1 && !!a.zipCode && !!a.city && /^\p{L}[\p{L} .'-]{1,39}$/u.test(a.city)
}

// --- Oneflow-fältet "Faktura adress (PDF)" -------------------------------------

export interface OneflowBillingField {
  /** Giltig e-postadress, annars null */
  billingEmail: string | null
  /** Det kunden skrev när det inte var en e-postadress, annars null */
  billingText: string | null
}

/**
 * Tolkar det kunden skrev i fakturafältet. Bara en hel, giltig e-postadress
 * blir fakturamejl. Allt annat (postadress, skanningsadress, referens) sparas
 * oförändrat som text för ekonomi att bekräfta; texten delas aldrig upp
 * automatiskt eftersom skanningsadresser inte följer något fast mönster.
 */
export function classifyOneflowBillingField(raw: string | null | undefined): OneflowBillingField {
  const value = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!value) return { billingEmail: null, billingText: null }
  if (isValidEmail(value)) return { billingEmail: value, billingText: null }
  return { billingEmail: null, billingText: value }
}

// --- Automatisk väg ur avtalet (beslut 2026-10-22, Christian) -------------------
//
// Ingen ska behöva välja. Vägen sätts ur det kunden skrev i avtalets fakturafält:
//   1. Fältet innehåller en e-postadress → e-post till den.
//   2. Fältet innehåller en adress med postnummer och ort → brev dit.
//   3. Fältet saknas eller går inte att använda → e-post till kontaktpersonen.
// Vägen kan ändras på kundsidan (fliken Fakturering) när det behövs.

const EMAIL_IN_TEXT = /[^\s@,;:<>()"']+@[^\s@,;:<>()"']+\.[^\s@,;:<>()"'.]+/

/**
 * Gör kundens fritext till en brevadress "Adressrad, 123 45 Ort". Sista
 * postnumret följt av en ort räknas, så att referenser och boxnummer före det
 * stannar i adressraden. Bolagsnamnet först i texten tas bort: Fortnox skriver
 * namnet ovanför adressen. Ger null när texten inte har postnummer och ort.
 */
export function normalizeBillingAddress(text: string | null | undefined, companyName?: string | null): string | null {
  if (!text) return null
  const cleaned = text.replace(/\s+/g, ' ').replace(/,?\s*Sverige\s*\.?$/i, '').trim()
  const m = cleaned.match(/^(.*?)[,.]?\s*(\d{3})\s?(\d{2})\s+(\p{L}[\p{L} '-]{1,39}?)\s*\.?$/u)
  if (!m) return null
  let line = m[1].replace(/[,.\s]+$/, '').trim()
  const name = companyName?.replace(/\s+/g, ' ').trim()
  if (name && line.toLowerCase().startsWith(name.toLowerCase())) {
    line = line.slice(name.length).replace(/^[,.\s]+/, '').trim()
  }
  if (!line) return null
  return `${line}, ${m[2]} ${m[3]} ${m[4].trim()}`
}

export interface DerivedDelivery {
  method: InvoiceDeliveryMethod
  billingEmail: string | null
  billingAddress: string | null
  /** Sparas som invoice_delivery_confirmed_by_name och visas på kundsidan */
  reason: string
}

/**
 * Fakturavägen ur avtalets fakturafält. Null bara när varken fältet eller
 * kontaktpersonen ger något att skicka till.
 */
export function deriveDeliveryFromContract(params: {
  billingText: string | null | undefined
  contactEmail: string | null | undefined
  companyName?: string | null
}): DerivedDelivery | null {
  const text = (params.billingText ?? '').replace(/\s+/g, ' ').trim()
  const found = text.match(EMAIL_IN_TEXT)?.[0] ?? null
  if (found && isValidEmail(found)) {
    return { method: 'email', billingEmail: found, billingAddress: null, reason: 'Fakturamejl i avtalet' }
  }
  const address = normalizeBillingAddress(text, params.companyName)
  if (address) {
    return { method: 'print', billingEmail: null, billingAddress: address, reason: 'Fakturaadress i avtalet' }
  }
  const contact = params.contactEmail?.trim() ?? ''
  if (isValidEmail(contact)) {
    return {
      method: 'email', billingEmail: contact, billingAddress: null,
      reason: text ? 'Kontaktpersonens e-post (avtalets fakturauppgift gick inte att använda)' : 'Kontaktpersonens e-post (avtalet saknade fakturauppgift)',
    }
  }
  return null
}

// --- Vilken kundrad äger fakturavägen ------------------------------------------

export interface DeliveryCustomer {
  id: string
  company_name?: string | null
  customer_number: number | string | null
  organization_number: string | null
  parent_customer_id: string | null
  invoice_delivery_method: string | null
  invoice_delivery_source?: string | null
  invoice_delivery_confirmed_at?: string | null
  invoice_delivery_confirmed_by_name?: string | null
  billing_email: string | null
  billing_address: string | null
  contact_address?: string | null
  contact_email?: string | null
  billing_reference?: string | null
}

/**
 * Fakturan går på det Fortnox-kort som kunden faktureras på, och kortets
 * leveranssätt gäller. Samma regel som resolveFortnoxCustomerNumber: en enhet
 * med eget kundnummer har eget kort; en enhet utan eget nummer och utan eget
 * org.nr (eller med huvudkontorets) faktureras på huvudkontorets kort.
 */
export function resolveDeliveryOwner<T extends DeliveryCustomer>(own: T, parent: T | null): T {
  if (own.customer_number) return own
  if (!parent) return own
  const ownOrg = orgDigits(own.organization_number)
  const parentOrg = orgDigits(parent.organization_number)
  if (!ownOrg || (parentOrg && ownOrg === parentOrg)) return parent
  return own
}

// --- Bedömningen -----------------------------------------------------------------

export type DeliveryIssue = 'unconfirmed' | 'email_missing' | 'address_missing' | 'einvoice_private'

export interface DeliveryEvaluation {
  ok: boolean
  method: InvoiceDeliveryMethod | null
  issue: DeliveryIssue | null
  /** Svensk text till användaren, null när allt är klart */
  message: string | null
  /** Kundraden vars väg gäller (huvudkontoret för enheter på dess kort) */
  ownerId: string
  ownerName: string | null
  /** Ägaren har redan ett Fortnox-kort: kortet bär adress och e-post */
  hasFortnoxCard: boolean
}

/**
 * Kan en faktura till kunden godkännas och skickas? Kräver en bekräftad väg.
 * Finns inget Fortnox-kort än skapar portalen kortet, och då måste uppgifterna
 * för vägen finnas: e-post kräver giltigt fakturamejl, brev en adress med
 * postnummer och ort, e-faktura ett företag (Fortnox skickar på org.nr).
 */
export function evaluateInvoiceDelivery(owner: DeliveryCustomer): DeliveryEvaluation {
  const method = isInvoiceDeliveryMethod(owner.invoice_delivery_method) ? owner.invoice_delivery_method : null
  const hasFortnoxCard = !!owner.customer_number
  const name = owner.company_name?.trim() || null
  const base = { method, ownerId: owner.id, ownerName: name, hasFortnoxCard }
  const who = name ?? 'kunden'

  if (!method) {
    return {
      ...base, ok: false, issue: 'unconfirmed',
      message: `Fakturavägen för ${who} saknas. Ange den på kundsidan under fliken Fakturering.`,
    }
  }
  if (!hasFortnoxCard) {
    if (method === 'email' && !isValidEmail(owner.billing_email)) {
      return { ...base, ok: false, issue: 'email_missing', message: `Fakturavägen för ${who} är e-post men fakturamejlet saknas eller är ogiltigt.` }
    }
    if (method === 'print' && !isMailableAddress(owner.billing_address || owner.contact_address)) {
      return { ...base, ok: false, issue: 'address_missing', message: `Fakturavägen för ${who} är brev men fakturaadressen saknar gata, postnummer eller ort.` }
    }
    if (method === 'einvoice' && (!orgDigits(owner.organization_number) || isPersonnummer(owner.organization_number))) {
      return { ...base, ok: false, issue: 'einvoice_private', message: `E-faktura kräver ett organisationsnummer. ${who} har inget, välj e-post eller brev.` }
    }
  }
  return { ...base, ok: true, issue: null, message: null }
}

// --- Ekonomis val ------------------------------------------------------------------

export interface DeliveryChoice {
  method: InvoiceDeliveryMethod
  billingEmail: string | null
  billingAddress: string | null
  billingReference: string | null
}

/** Kontrollerar ekonomis val innan det sparas. Returnerar felet, eller null. */
export function validateDeliveryChoice(choice: DeliveryChoice, organizationNumber: string | null): string | null {
  if (choice.method === 'email' && !isValidEmail(choice.billingEmail)) {
    return 'Ange en giltig e-postadress för fakturan.'
  }
  if (choice.method === 'print' && !isMailableAddress(choice.billingAddress)) {
    return 'Ange fakturaadressen med gata eller box, postnummer och ort, t.ex. "Box 123, 831 90 Östersund".'
  }
  if (choice.method === 'einvoice' && (!orgDigits(organizationNumber) || isPersonnummer(organizationNumber))) {
    return 'E-faktura kräver ett organisationsnummer på kunden.'
  }
  return null
}

/**
 * Fälten som skickas till ett befintligt Fortnox-kort när ekonomi väljer väg.
 * Bara leveranssättet och det ekonomi angett skrivs; tomma fält skickas aldrig
 * så att uppgifter som bara finns i Fortnox inte raderas.
 */
export function buildFortnoxDeliveryUpdate(choice: DeliveryChoice): Record<string, unknown> {
  const update: Record<string, unknown> = {
    DefaultDeliveryTypes: { Invoice: toFortnoxDeliveryType(choice.method) },
  }
  const email = choice.billingEmail?.trim()
  if (email && isValidEmail(email)) update.EmailInvoice = email
  const addr = parseSwedishAddress(choice.billingAddress)
  if (addr.address1 && addr.zipCode && addr.city) {
    update.Address1 = addr.address1
    update.ZipCode = addr.zipCode
    update.City = addr.city
  }
  const ref = choice.billingReference?.trim()
  if (ref) update.YourReference = ref
  return update
}
