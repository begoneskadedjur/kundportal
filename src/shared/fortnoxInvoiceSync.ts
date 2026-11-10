// src/shared/fortnoxInvoiceSync.ts
// Regeln för hur en Fortnox-faktura speglas till portalens invoices-rad.
// Ren modul utan databas och utan importer: delas av webhooken
// (api/fortnox/webhook.ts) och finns som ordagrann kopia i edge-funktionen
// (supabase/functions/fortnox-sync/fortnoxInvoiceSync.ts, eftersom Deno inte
// kan nå src/). Testet fortnoxInvoiceSync.test.ts kontrollerar att kopian är
// identisk; ändra alltid båda filerna.
//
// Beslut 2026-11-10 (betalningsspärren):
// - Saldo (Balance), förfallodag (DueDate) och skattereduktion (TaxReduction)
//   speglas alltid, oavsett status.
// - Makulerad i Fortnox (Cancelled) blir 'cancelled' i portalen.
// - ROT/RUT: Balance innehåller Skatteverkets del tills utbetalningen bokas.
//   När kunden betalat sin del (Balance <= TaxReduction) är fakturan inte
//   förfallen för kunden. Den står då kvar som 'sent' (även om den tidigare
//   blev 'overdue') tills Skatteverket betalar och Balance blir 0, då den blir
//   'paid' som vanligt. Avslår Skatteverket (rot_rut_claim_status = 'rejected')
//   räknas hela saldot som kundens skuld igen.
// - Vanliga fakturor beter sig exakt som förut: paid före overdue före sent
//   före booked, med samma skyddslistor.

export type FortnoxSyncTarget = 'paid' | 'overdue' | 'sent' | 'booked' | 'cancelled'

export interface FortnoxInvoiceSnapshot {
  Sent?: boolean | null
  Booked?: boolean | null
  Cancelled?: boolean | null
  Balance?: number | string | null
  FinalPayDate?: string | null
  DueDate?: string | null
  TaxReduction?: number | string | null
}

export interface FortnoxSyncDecision {
  /** Målstatus, null = utkast i Fortnox (ingen statusändring) */
  status: FortnoxSyncTarget | null
  /** Tidsstämpel för statusfältet (paid_at = FinalPayDate, annars nu) */
  timestamp: string
  /** Statusar som INTE skrivs över när målstatusen sätts */
  protectedStatuses: string[]
  /** Fortnox Balance, avrundat till öre (null om Fortnox inte gav något) */
  balanceDue: number | null
  /** Fortnox DueDate (ÅÅÅÅ-MM-DD) */
  dueDate: string | null
  /** Fortnox TaxReduction (ROT/RUT-avdraget), null om inget */
  taxReduction: number | null
  /** Kundens egen skuld: max(0, saldo minus väntande skattereduktion) */
  customerDebt: number | null
  /** ROT/RUT där kunden betalat sin del och bara Skatteverkets del återstår */
  rotRutCustomerPaid: boolean
}

const PROTECTED_BY_TARGET: Record<FortnoxSyncTarget, string[]> = {
  paid: ['paid', 'cancelled'],
  overdue: ['paid', 'cancelled', 'overdue'],
  sent: ['paid', 'cancelled', 'overdue', 'sent'],
  booked: ['paid', 'cancelled', 'overdue', 'sent', 'booked', 'invoiced'],
  cancelled: ['paid', 'cancelled'],
}

/** När kundens del är betald får en förfallen ROT/RUT-faktura gå tillbaka till 'sent' */
const PROTECTED_ROT_RUT_CUSTOMER_PAID = ['paid', 'cancelled', 'sent']

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function roundOre(n: number): number {
  return Math.round(n * 100) / 100
}

export function decideFortnoxInvoiceSync(
  invoice: FortnoxInvoiceSnapshot,
  options: { now?: Date; rotRutClaimStatus?: string | null } = {},
): FortnoxSyncDecision {
  const nowDate = options.now ?? new Date()
  const now = nowDate.toISOString()

  const rawBalance = toNumber(invoice.Balance)
  const balanceDue = rawBalance === null ? null : roundOre(rawBalance)
  const rawTax = toNumber(invoice.TaxReduction)
  const taxReduction = rawTax !== null && rawTax > 0 ? roundOre(rawTax) : null
  const dueDate = invoice.DueDate ? String(invoice.DueDate).slice(0, 10) : null

  // Skattereduktionen väntar hos Skatteverket så länge den inte avslagits
  const pendingTax = taxReduction !== null && options.rotRutClaimStatus !== 'rejected' ? taxReduction : 0
  const customerDebt = balanceDue === null ? null : roundOre(Math.max(0, balanceDue - pendingTax))
  const rotRutCustomerPaid = pendingTax > 0 && balanceDue !== null && balanceDue > 0 && customerDebt === 0

  const base = { timestamp: now, balanceDue, dueDate, taxReduction, customerDebt, rotRutCustomerPaid }

  if (invoice.Cancelled === true) {
    return { ...base, status: 'cancelled', protectedStatuses: PROTECTED_BY_TARGET.cancelled }
  }

  // Samma regel som tidigare (Balance === 0 som nummer)
  const isPaid = toNumber(invoice.Balance) === 0 && invoice.FinalPayDate != null
  const isSent = invoice.Sent === true
  const isBooked = invoice.Booked === true
  const due = invoice.DueDate ? new Date(invoice.DueDate) : null
  const isOverdue = isSent && !isPaid && !rotRutCustomerPaid && due != null && due < nowDate

  if (isPaid) {
    return {
      ...base,
      status: 'paid',
      timestamp: new Date(invoice.FinalPayDate as string).toISOString(),
      protectedStatuses: PROTECTED_BY_TARGET.paid,
    }
  }
  if (isOverdue) return { ...base, status: 'overdue', protectedStatuses: PROTECTED_BY_TARGET.overdue }
  if (isSent) {
    return {
      ...base,
      status: 'sent',
      protectedStatuses: rotRutCustomerPaid ? PROTECTED_ROT_RUT_CUSTOMER_PAID : PROTECTED_BY_TARGET.sent,
    }
  }
  if (isBooked) return { ...base, status: 'booked', protectedStatuses: PROTECTED_BY_TARGET.booked }
  return { ...base, status: null, protectedStatuses: [] }
}

/** Fälten som alltid speglas till invoices, oavsett statusskydd */
export function fortnoxMirrorFields(decision: FortnoxSyncDecision): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (decision.balanceDue !== null) fields.balance_due = decision.balanceDue
  if (decision.dueDate !== null) fields.due_date = decision.dueDate
  if (decision.taxReduction !== null) fields.rot_rut_fortnox_amount = decision.taxReduction
  return fields
}

/** PostgREST-lista för .not('status', 'in', ...) */
export function toPostgrestInList(statuses: string[]): string {
  return `(${statuses.map((s) => `"${s}"`).join(',')})`
}

/**
 * ROT/RUT-faktura där kunden betalat sin del och bara Skatteverkets del
 * återstår (saldot är högst skattereduktionen). Visas inte som förfallen och
 * räknas inte in i betalningsspärren.
 */
export function isRotRutAwaitingTaxAgency(inv: {
  balance_due?: number | string | null
  rot_rut_fortnox_amount?: number | string | null
  rot_rut_claim_status?: string | null
}): boolean {
  const balance = toNumber(inv.balance_due)
  const tax = toNumber(inv.rot_rut_fortnox_amount)
  if (balance === null || tax === null || tax <= 0 || balance <= 0) return false
  if (inv.rot_rut_claim_status === 'rejected') return false
  return balance <= tax + 0.005
}
