// src/components/admin/invoicing/queue/queueActions.ts
// Godkänn flera och Skicka godkända till Fortnox för arbetslistorna i
// /admin/fakturering. Godkännandet går via InvoiceService.approveInvoice per
// faktura. Skicka godkända skapar sedan 3.125.0 ett utkast i Fortnox per
// faktura, en i taget, via sendInvoiceToFortnox (samma väg som knappen Skapa
// utkast i Fortnox i fakturamodalen). Förut laddades en CSV-fil ner.

import toast from 'react-hot-toast'
import { InvoiceService } from '../../../../services/invoiceService'
import { InvoiceDeliveryError } from '../../../../services/invoiceDeliveryService'
import type { FortnoxSendNotify, FortnoxSendResult } from '../../../../services/invoiceFortnoxSendService'

export interface ApprovableInvoice {
  id: string
  status: string
  customer_name: string
}

/**
 * Godkänner varje faktura för sig: en kund utan bekräftad fakturaväg eller med
 * obekräftad premie stoppar bara sina egna fakturor, resten godkänns.
 */
export async function approveInvoices(list: ApprovableInvoice[], userId: string, approverName: string): Promise<number> {
  const toApprove = list.filter((i) => i.status === 'pending_approval')
  if (toApprove.length === 0) {
    toast.error('Inga markerade fakturor väntar på godkännande')
    return 0
  }
  const results = await Promise.allSettled(toApprove.map((i) => InvoiceService.approveInvoice(i.id, userId, approverName)))
  const approved = results.filter((r) => r.status === 'fulfilled').length
  const blocked = toApprove.filter((_, idx) => {
    const r = results[idx]
    return r.status === 'rejected' && r.reason instanceof InvoiceDeliveryError
  })
  const failed = results.length - approved - blocked.length
  if (approved > 0) toast.success(`${approved} ${approved === 1 ? 'faktura godkänd' : 'fakturor godkända'}`)
  if (blocked.length > 0) {
    toast.error(
      `${blocked.length} ${blocked.length === 1 ? 'faktura' : 'fakturor'} väntar på fakturaväg: ${[...new Set(blocked.map((i) => i.customer_name))].join(', ')}. Öppna fakturan och välj väg.`,
      { duration: 10000 }
    )
  }
  if (failed > 0) {
    const reasons = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected' && !(r.reason instanceof InvoiceDeliveryError))
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
    console.error('Fel vid godkännande:', reasons)
    toast.error(`${failed} ${failed === 1 ? 'faktura' : 'fakturor'} kunde inte godkännas. ${[...new Set(reasons)][0] ?? ''}`.trim(), { duration: 10000 })
  }
  return approved
}

// --- Skapa utkast i Fortnox för flera fakturor ------------------------------

/** En rad i bekräftelsedialogen */
export interface BatchInvoice {
  id: string
  customerName: string
  invoiceNumber: string | null
  amount: number
}

export type BatchStatus = 'created' | 'failed' | 'skipped'

export interface BatchOutcome {
  id: string
  status: BatchStatus
  /** Fortnox-numret för lyckade, annars orsaken */
  message: string
  documentNumber?: string
  /** Övriga besked under sändningen (ny Fortnox-kund, ROT/RUT som inte gick in ...) */
  notes: string[]
}

/** Fortnox tillåter 25 anrop per 5 sekunder; en faktura kostar flera anrop. */
export const FORTNOX_BATCH_PAUSE_MS = 1500

/** Besked i listan skrivs med kommatecken i stället för tankstreck. */
export const plainText = (s: string) => s.replace(/\s*[—–]\s*/g, ', ')

export function outcomeOf(id: string, result: FortnoxSendResult, notes: string[]): BatchOutcome {
  const resultMessage = 'message' in result ? result.message : null
  const extra = notes.filter((n) => n !== resultMessage && !n.startsWith('Utkast skapat i Fortnox')).map(plainText)
  if (result.status === 'created') {
    return { id, status: 'created', message: `Fortnox nr ${result.documentNumber}`, documentNumber: result.documentNumber, notes: extra }
  }
  if (result.status === 'failed') return { id, status: 'failed', message: plainText(result.message), notes: extra }
  if (result.status === 'candidates') {
    return {
      id,
      status: 'skipped',
      message: result.kind === 'multiple'
        ? 'Flera Fortnox-kunder har samma org.nr. Öppna fakturan och välj kund.'
        : 'Kunden är inaktiv i Fortnox. Öppna fakturan och välj återaktivering eller nytt nummer.',
      notes: extra,
    }
  }
  return { id, status: 'skipped', message: plainText(result.message), notes: extra }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Skapar utkast en faktura i taget, med paus mellan för Fortnox gräns för
 * antal anrop. Ett fel stoppar inte resten. send är sendInvoiceToFortnox i
 * appen och en mock i testerna.
 */
export async function runFortnoxBatch(
  invoices: BatchInvoice[],
  deps: {
    send: (invoiceId: string, notify: FortnoxSendNotify) => Promise<FortnoxSendResult>
    onProgress?: (outcome: BatchOutcome, done: number) => void
    pauseMs?: number
    sleep?: (ms: number) => Promise<void>
  }
): Promise<BatchOutcome[]> {
  const pause = deps.pauseMs ?? FORTNOX_BATCH_PAUSE_MS
  const sleep = deps.sleep ?? wait
  const out: BatchOutcome[] = []
  for (let i = 0; i < invoices.length; i++) {
    if (i > 0 && pause > 0) await sleep(pause)
    const inv = invoices[i]
    const notes: string[] = []
    const collect: FortnoxSendNotify = {
      success: (m) => { notes.push(m) },
      error: (m) => { notes.push(m) },
      info: (m) => { notes.push(m) },
    }
    let outcome: BatchOutcome
    try {
      outcome = outcomeOf(inv.id, await deps.send(inv.id, collect), notes)
    } catch (err) {
      outcome = {
        id: inv.id,
        status: 'failed',
        message: plainText('Kunde inte skicka till Fortnox: ' + (err instanceof Error ? err.message : String(err))),
        notes: [],
      }
    }
    out.push(outcome)
    deps.onProgress?.(outcome, i + 1)
  }
  return out
}
