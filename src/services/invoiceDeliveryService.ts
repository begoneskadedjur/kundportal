// src/services/invoiceDeliveryService.ts
// Fakturavägen i webben: läser kundens väg, bedömer om en faktura kan
// godkännas eller skickas, och sparar ekonomis val i portalen och på
// Fortnox-kortet. Reglerna finns i src/shared/invoiceDelivery.ts.

import { supabase } from '../lib/supabase'
import { FortnoxService } from './fortnoxService'
import {
  buildFortnoxDeliveryUpdate,
  evaluateInvoiceDelivery,
  fromFortnoxDeliveryType,
  resolveDeliveryOwner,
  validateDeliveryChoice,
  type DeliveryChoice,
  type DeliveryCustomer,
  type DeliveryEvaluation,
  type InvoiceDeliveryMethod,
} from '../shared/invoiceDelivery'

const COLUMNS =
  'id, company_name, customer_number, organization_number, parent_customer_id, ' +
  'invoice_delivery_method, invoice_delivery_source, invoice_delivery_confirmed_at, invoice_delivery_confirmed_by_name, ' +
  'billing_email, billing_address, contact_address, contact_email, billing_reference'

export interface CustomerDelivery {
  evaluation: DeliveryEvaluation
  /** Kundraden vars väg gäller (huvudkontoret när enheten faktureras på dess kort) */
  owner: DeliveryCustomer
  /** Fakturan gäller en enhet men vägen styrs av huvudkontoret */
  inheritedFromParent: boolean
  /** Det som stod i senaste avtalets fakturafält, för sammanhang */
  contractBillingText: string | null
}

/** Fel när en faktura stoppas av fakturavägen. Meddelandet visas för användaren. */
export class InvoiceDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvoiceDeliveryError'
  }
}

async function loadRow(id: string): Promise<DeliveryCustomer | null> {
  const { data, error } = await supabase.from('customers').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`Kunde inte läsa kunden: ${error.message}`)
  return (data as unknown as DeliveryCustomer | null) ?? null
}

export class InvoiceDeliveryService {
  /** Kundens fakturaväg och om den räcker för att godkänna och skicka en faktura */
  static async getForCustomer(customerId: string): Promise<CustomerDelivery | null> {
    const own = await loadRow(customerId)
    if (!own) return null
    const parent = own.parent_customer_id ? await loadRow(own.parent_customer_id) : null
    const owner = resolveDeliveryOwner(own, parent)
    const { data: contract } = await supabase
      .from('contracts')
      .select('billing_email, billing_address')
      .eq('customer_id', owner.id)
      .eq('type', 'contract')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const c = contract as { billing_email: string | null; billing_address: string | null } | null
    return {
      evaluation: evaluateInvoiceDelivery(owner),
      owner,
      inheritedFromParent: owner.id !== own.id,
      contractBillingText: c?.billing_email?.trim() || c?.billing_address?.trim() || null,
    }
  }

  /**
   * Stoppar en faktura vars kund saknar bekräftad fakturaväg. Fakturor utan
   * kundrad (engångskund som skapas vid sändningen) bedöms vid sändningen.
   */
  static async assertInvoiceDeliverable(invoiceId: string): Promise<void> {
    const { data, error } = await supabase.from('invoices').select('customer_id').eq('id', invoiceId).maybeSingle()
    if (error) throw new Error(`Kunde inte läsa fakturan: ${error.message}`)
    const customerId = (data as { customer_id: string | null } | null)?.customer_id
    if (!customerId) return
    const delivery = await this.getForCustomer(customerId)
    if (delivery && !delivery.evaluation.ok) throw new InvoiceDeliveryError(delivery.evaluation.message ?? 'Fakturavägen är inte bekräftad.')
  }

  /**
   * Ekonomis val. Fortnox-kortet uppdateras FÖRST när kunden har ett kort:
   * misslyckas Fortnox sparas ingenting i portalen, så de två aldrig säger
   * olika. Därefter kundraden och kundens fakturor som inte skickats än.
   */
  static async saveChoice(ownerId: string, choice: DeliveryChoice, actorName: string): Promise<DeliveryCustomer> {
    const owner = await loadRow(ownerId)
    if (!owner) throw new Error('Kunden hittades inte')
    const invalid = validateDeliveryChoice(choice, owner.organization_number)
    if (invalid) throw new InvoiceDeliveryError(invalid)

    const email = choice.billingEmail?.trim() || null
    const address = choice.billingAddress?.trim() || null
    const reference = choice.billingReference?.trim() || null

    if (owner.customer_number) {
      await FortnoxService.updateCustomer(String(owner.customer_number), buildFortnoxDeliveryUpdate({
        method: choice.method, billingEmail: email, billingAddress: address, billingReference: reference,
      }) as Parameters<typeof FortnoxService.updateCustomer>[1])
    }

    const update: Record<string, unknown> = {
      invoice_delivery_method: choice.method,
      invoice_delivery_source: 'ekonomi',
      invoice_delivery_confirmed_at: new Date().toISOString(),
      invoice_delivery_confirmed_by_name: actorName,
      billing_reference: reference,
    }
    // Tomma fält skriver aldrig över det som finns: e-post vid brev får stå kvar
    if (email) update.billing_email = email
    if (address) update.billing_address = address
    const { error } = await supabase.from('customers').update(update).eq('id', ownerId)
    if (error) {
      throw new Error(
        owner.customer_number
          ? `Fortnox-kortet är uppdaterat men portalen kunde inte spara: ${error.message}. Spara igen.`
          : `Kunde inte spara fakturavägen: ${error.message}`
      )
    }

    // Kundens fakturor som inte skickats till Fortnox visar samma uppgifter
    const snapshot: Record<string, unknown> = {}
    if (email) snapshot.customer_email = email
    if (address) snapshot.customer_address = address
    if (Object.keys(snapshot).length > 0) {
      await supabase
        .from('invoices')
        .update(snapshot)
        .eq('customer_id', ownerId)
        .in('status', ['pending_approval', 'ready'])
        .is('fortnox_document_number', null)
    }
    if (reference) {
      await supabase
        .from('invoices')
        .update({ invoice_marking: reference })
        .eq('customer_id', ownerId)
        .in('status', ['pending_approval', 'ready'])
        .is('fortnox_document_number', null)
        .is('invoice_marking', null)
    }

    const saved = await loadRow(ownerId)
    if (!saved) throw new Error('Kunden hittades inte efter sparandet')
    return saved
  }

  /**
   * Fortnox-kortet är sanningen när fakturan skickas: har någon ändrat
   * leveranssättet direkt i Fortnox tar portalen över det, så att kundkortet
   * visar det som faktiskt gäller. Returnerar den nya vägen när den ändrades.
   */
  static async adoptFromFortnoxCard(ownerId: string, fortnoxInvoiceType: string | null | undefined): Promise<InvoiceDeliveryMethod | null> {
    const method = fromFortnoxDeliveryType(fortnoxInvoiceType)
    if (!method) return null
    const owner = await loadRow(ownerId)
    if (!owner || owner.invoice_delivery_method === method) return null
    const { error } = await supabase
      .from('customers')
      .update({
        invoice_delivery_method: method,
        invoice_delivery_source: 'fortnox',
        invoice_delivery_confirmed_at: new Date().toISOString(),
        invoice_delivery_confirmed_by_name: 'Fortnox-kortet',
      })
      .eq('id', ownerId)
    if (error) {
      console.warn('[InvoiceDeliveryService] Kunde inte ta över Fortnox-kortets fakturaväg:', error.message)
      return null
    }
    return method
  }
}
