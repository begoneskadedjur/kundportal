// src/services/contractInvoiceImportService.ts
// Koppla en redan skickad Fortnox-faktura till en avtalsperiod.
//
// Fakturaplaneringen skapar aldrig "betald historik" för riktiga avtal: en
// passerad period utan faktura i portalen visas som 'uncovered' (§ 7 på
// avtalskartan). Vägen att täcka perioden är att hämta fakturan från
// Fortnox och spara den som F-{nr} med is_historical = true, samma form som
// kundimporten ger. Täckningsfiltret i generatorn läser då perioden som
// fakturerad. FEV år 1 (Fortnox 643) och WBAB år 1 (642) är sådana fall.
//
// Samlad faktura: en Fortnox-faktura kan täcka flera avtal (fyra rader, en
// per prispost). Då sparas den med contract_id = null och is_consolidated =
// true och täcker perioden för alla kundens avtal.

import { supabase } from '../lib/supabase'
import { FortnoxService, type FortnoxInvoiceDetail } from './fortnoxService'
import { ContractScopeService } from './contractScopeService'

export interface ImportContractInvoiceInput {
  fortnoxNumber: string
  /** Kundraden fakturan bokförs på (huvudkontoret) */
  customerId: string
  /** Avtalet perioden gäller, eller null för samlad faktura över flera avtal */
  contractId: string | null
  /** Fakturatyp: premium (årspremie) eller equipment (tillägg utöver avtal per år) */
  kind?: 'premium' | 'equipment'
  periodStart: string
  periodEnd: string
  /** Avtal som fakturan täcker när den är samlad (för radkoppling och logg) */
  coveredContractIds?: string[]
}

export interface ImportContractInvoiceResult {
  invoiceId: string
  invoiceNumber: string
  subtotal: number
  rows: number
  alreadyImported: boolean
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

export class ContractInvoiceImportService {
  /** Hämta fakturan från Fortnox för förhandsvisning innan koppling. */
  static async preview(fortnoxNumber: string): Promise<FortnoxInvoiceDetail> {
    const nr = fortnoxNumber.trim().replace(/^F-/i, '')
    if (!/^\d+$/.test(nr)) throw new Error('Ange Fortnox fakturanummer (bara siffror)')
    return FortnoxService.getInvoice(nr)
  }

  /**
   * Spara Fortnox-fakturan som historisk avtalsfaktura för perioden.
   * Idempotent: finns F-{nr} redan uppdateras period och avtalskoppling.
   */
  static async importForPeriod(input: ImportContractInvoiceInput): Promise<ImportContractInvoiceResult> {
    const nr = input.fortnoxNumber.trim().replace(/^F-/i, '')
    if (!/^\d+$/.test(nr)) throw new Error('Ange Fortnox fakturanummer (bara siffror)')
    if (!input.periodStart || !input.periodEnd || input.periodEnd < input.periodStart) {
      throw new Error('Perioden är ogiltig')
    }

    const invoiceNumber = `F-${nr}`
    const detail = await FortnoxService.getInvoice(nr)
    if (detail.Cancelled) throw new Error(`Fortnox ${nr} är makulerad och kan inte täcka en period`)

    const subtotal = Math.round(num(detail.Net) * 100) / 100
    const vat = Math.round(num(detail.TotalVAT) * 100) / 100
    const total = Math.round(num(detail.Total) * 100) / 100
    const paid = num(detail.Balance) === 0 && (detail.Booked || detail.Sent)
    const status = paid ? 'paid' : detail.Sent ? 'sent' : detail.Booked ? 'booked' : 'sent'
    const consolidated = !input.contractId

    const { data: customer, error: cErr } = await supabase
      .from('customers')
      .select('id, company_name, organization_number, billing_email, contact_email, contact_phone, billing_address, contact_address')
      .eq('id', input.customerId)
      .single()
    if (cErr || !customer) throw new Error(`Kunde inte hämta kunden: ${cErr?.message ?? 'okänt fel'}`)

    // Finns fakturan redan (kundimporten eller en tidigare koppling)?
    const { data: existing } = await supabase
      .from('invoices')
      .select('id, customer_id')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle()

    const payload = {
      invoice_number: invoiceNumber,
      invoice_type: 'contract',
      customer_id: input.customerId,
      contract_id: input.contractId,
      is_consolidated: consolidated,
      contract_invoice_kind: input.kind ?? 'premium',
      case_id: null,
      case_type: null,
      customer_name: customer.company_name,
      customer_email: customer.billing_email ?? customer.contact_email,
      customer_phone: customer.contact_phone,
      customer_address: customer.billing_address ?? customer.contact_address,
      organization_number: customer.organization_number,
      subtotal,
      vat_amount: vat,
      total_amount: total,
      status,
      requires_approval: false,
      billing_period_start: input.periodStart,
      billing_period_end: input.periodEnd,
      due_date: detail.DueDate || null,
      sent_at: detail.InvoiceDate ? `${detail.InvoiceDate}T12:00:00+02:00` : null,
      booked_at: detail.Booked && detail.InvoiceDate ? `${detail.InvoiceDate}T12:00:00+02:00` : null,
      paid_at: paid ? `${detail.FinalPayDate ?? detail.DueDate ?? detail.InvoiceDate}T12:00:00+02:00` : null,
      is_historical: true,
      fortnox_document_number: nr,
      invoice_marking: detail.YourReference || null,
      notes: `Importerad från Fortnox ${nr}. ${input.kind === 'equipment' ? 'Tilläggsstationer utöver avtal' : 'Årspremie'}, period ${input.periodStart} t.o.m. ${input.periodEnd}${
        detail.Remarks ? ` · ${detail.Remarks.replace(/\s+/g, ' ').trim().slice(0, 200)}` : ''
      }`,
      created_at: detail.InvoiceDate ? `${detail.InvoiceDate}T12:00:00+02:00` : new Date().toISOString(),
    }

    let invoiceId: string
    if (existing) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', existing.id)
      if (error) throw new Error(`Kunde inte uppdatera ${invoiceNumber}: ${error.message}`)
      invoiceId = existing.id
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    } else {
      const { data: inv, error } = await supabase.from('invoices').insert(payload).select('id').single()
      if (error || !inv) throw new Error(`Kunde inte spara ${invoiceNumber}: ${error?.message ?? 'okänt fel'}`)
      invoiceId = inv.id
    }

    // Rader: avtal per rad kan inte härledas ur Fortnox; en enkel faktura får
    // avtalet på alla rader, en samlad får null (täckningen är per kund).
    const rows = (detail.InvoiceRows ?? [])
      .filter((r) => num(r.DeliveredQuantity) !== 0 || num(r.Total) !== 0)
      .map((r) => ({
        invoice_id: invoiceId,
        contract_id: input.contractId,
        line_kind: input.kind === 'equipment' ? 'equipment_annual' : 'premium',
        article_code: r.ArticleNumber || null,
        article_name: (r.Description || 'Årspremie').trim(),
        quantity: num(r.DeliveredQuantity) || 1,
        unit_price: num(r.Price),
        total_price: num(r.Total),
        vat_rate: num(r.VAT),
        discount_percent: num(r.Discount),
      }))
    if (rows.length > 0) {
      const { error: rErr } = await supabase.from('invoice_items').insert(rows)
      if (rErr) throw new Error(`Kunde inte spara fakturaraderna: ${rErr.message}`)
    }

    const logTargets = input.contractId ? [input.contractId] : (input.coveredContractIds ?? [])
    for (const contractId of logTargets) {
      await ContractScopeService.logEvent(contractId, {
        event_type: 'billing',
        title: `Fortnox ${nr} kopplad till perioden ${input.periodStart} t.o.m. ${input.periodEnd}`,
        detail: `${subtotal.toLocaleString('sv-SE')} kr exkl. moms · ${paid ? 'betald' : status}${consolidated ? ' · samlad faktura' : ''}`,
        metadata: { fortnox_document_number: nr, invoice_id: invoiceId },
      })
    }

    return { invoiceId, invoiceNumber, subtotal, rows: rows.length, alreadyImported: !!existing }
  }
}
