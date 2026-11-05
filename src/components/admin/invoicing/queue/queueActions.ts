// src/components/admin/invoicing/queue/queueActions.ts
// Godkänn flera och Skicka godkända till Fortnox för arbetslistorna i
// /admin/fakturering. Samma vägar som fakturalistan använt sedan tidigare
// (PrivateBusinessInvoicing): InvoiceService.approveInvoice per faktura och
// InvoiceService.exportForFortnox för fakturor med status ready.

import toast from 'react-hot-toast'
import { InvoiceService } from '../../../../services/invoiceService'
import { InvoiceDeliveryError } from '../../../../services/invoiceDeliveryService'
import { swedishDay } from '../../../../shared/invoiceSchedule'

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

/** Fortnox-filen (CSV) för fakturor med status ready, som knappen Till Fortnox. */
export async function exportReadyInvoices(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    toast.error('Inga godkända fakturor att skicka')
    return
  }
  try {
    const csv = await InvoiceService.exportForFortnox(ids)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fortnox-export-${swedishDay(new Date())}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${ids.length} fakturor exporterade`)
  } catch (error) {
    console.error('Fel vid export:', error)
    toast.error('Kunde inte exportera')
  }
}
