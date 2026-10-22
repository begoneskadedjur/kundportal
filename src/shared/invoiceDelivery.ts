// src/shared/invoiceDelivery.ts
// Fakturavägen: hur kunden får sina fakturor (e-post, brev eller e-faktura).
// Ren logik utan databas, delas mellan webben och serverns signering och
// Fortnox-allokering.
//
// Beslut 2026-10-22 (Christian, fallet Nacka vatten och avfall): den som gör
// avtalet kan inte veta hur kunden vill betala. Kunden skriver det själv i
// Oneflow-fältet "Faktura adress (PDF)". Är det en e-postadress är vägen e-post.
// Annars sparas texten som fakturaadress och ekonomi väljer vägen vid första
// fakturan. Ingen faktura godkänns eller skickas till Fortnox utan bekräftad väg.
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
  kund: 'kunden i avtalet',
  ekonomi: 'ekonomi',
  fortnox: 'Fortnox-kortet',
  upplaggning: 'fakturamejlet vid uppläggning',
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

/** Adressen räcker för ett brev: gata/box, postnummer och ort */
export function isMailableAddress(value: string | null | undefined): boolean {
  const a = parseSwedishAddress(value)
  return !!a.address1 && !!a.zipCode && !!a.city
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
      message: `Fakturavägen för ${who} är inte bekräftad. Välj e-post, e-faktura eller brev innan fakturan godkänns.`,
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
