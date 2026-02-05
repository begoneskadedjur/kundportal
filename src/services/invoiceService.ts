// src/services/invoiceService.ts
// Service för hantering av fakturor (privat/företag direktfakturering)

import { supabase } from '../lib/supabase'
import type {
  Invoice,
  InvoiceWithItems,
  InvoiceItem,
  CreateInvoiceInput,
  CreateInvoiceItemInput,
  InvoiceFilters,
  InvoiceStats,
  InvoiceStatus
} from '../types/invoice'
import { calculateInvoiceTotals, calculateDueDate } from '../types/invoice'
import { CaseBillingService } from './caseBillingService'

export class InvoiceService {
  /**
   * Generera nästa fakturanummer
   */
  static async generateInvoiceNumber(): Promise<string> {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `INV-${year}${month}`

    // Räkna antal fakturor denna månad
    const { count, error } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .like('invoice_number', `${prefix}%`)

    if (error) throw new Error(`Databasfel: ${error.message}`)

    const seq = String((count || 0) + 1).padStart(4, '0')
    return `${prefix}-${seq}`
  }

  /**
   * Skapa faktura från ärende
   */
  static async createInvoiceFromCase(
    caseId: string,
    caseType: 'private' | 'business',
    customerInfo: {
      name: string
      email?: string
      phone?: string
      address?: string
      organization_number?: string
    }
  ): Promise<InvoiceWithItems> {
    // Hämta billing items för ärendet
    const billingItems = await CaseBillingService.getCaseBillingItems(caseId, caseType)

    if (billingItems.length === 0) {
      throw new Error('Inga fakturerbara artiklar på ärendet')
    }

    // Beräkna summor
    const totals = calculateInvoiceTotals(billingItems.map(item => ({
      id: item.id,
      invoice_id: '',
      case_billing_item_id: item.id,
      article_id: item.article_id,
      article_code: item.article_code,
      article_name: item.article_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      total_price: item.total_price,
      vat_rate: item.vat_rate,
      created_at: item.created_at
    })))

    // Kontrollera om godkännande krävs
    const requiresApproval = billingItems.some(item => item.requires_approval)

    // Generera fakturanummer
    const invoiceNumber = await this.generateInvoiceNumber()

    // Skapa faktura
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        case_id: caseId,
        case_type: caseType,
        customer_name: customerInfo.name,
        customer_email: customerInfo.email || null,
        customer_phone: customerInfo.phone || null,
        customer_address: customerInfo.address || null,
        organization_number: customerInfo.organization_number || null,
        subtotal: totals.subtotal,
        vat_amount: totals.vat_amount,
        total_amount: totals.total_amount,
        status: requiresApproval ? 'pending_approval' : 'ready',
        requires_approval: requiresApproval,
        due_date: calculateDueDate(30)
      })
      .select()
      .single()

    if (invoiceError) throw new Error(`Databasfel: ${invoiceError.message}`)

    // Skapa fakturarader
    const invoiceItems: InvoiceItem[] = []
    for (const item of billingItems) {
      const { data: invoiceItem, error: itemError } = await supabase
        .from('invoice_items')
        .insert({
          invoice_id: invoice.id,
          case_billing_item_id: item.id,
          article_id: item.article_id,
          article_code: item.article_code,
          article_name: item.article_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          total_price: item.total_price,
          vat_rate: item.vat_rate
        })
        .select()
        .single()

      if (itemError) throw new Error(`Databasfel: ${itemError.message}`)
      invoiceItems.push(invoiceItem)
    }

    // Uppdatera billing items status
    await CaseBillingService.updateCaseItemsStatus(caseId, caseType, 'billed')

    return {
      ...invoice,
      items: invoiceItems
    }
  }

  /**
   * Hämta fakturor med filter
   */
  static async getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    let query = supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }

    if (filters?.case_type) {
      query = query.eq('case_type', filters.case_type)
    }

    if (filters?.requires_approval !== undefined) {
      query = query.eq('requires_approval', filters.requires_approval)
    }

    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date)
    }

    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date)
    }

    if (filters?.search) {
      query = query.or(`customer_name.ilike.%${filters.search}%,invoice_number.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  /**
   * Hämta faktura med rader
   */
  static async getInvoiceWithItems(id: string): Promise<InvoiceWithItems | null> {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (invoiceError) {
      if (invoiceError.code === 'PGRST116') return null
      throw new Error(`Databasfel: ${invoiceError.message}`)
    }

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('created_at', { ascending: true })

    if (itemsError) throw new Error(`Databasfel: ${itemsError.message}`)

    return {
      ...invoice,
      items: items || []
    }
  }

  /**
   * Uppdatera fakturastatus
   */
  static async updateInvoiceStatus(
    id: string,
    status: InvoiceStatus,
    additionalData?: Partial<Invoice>
  ): Promise<Invoice> {
    const updateData: Record<string, unknown> = { status }

    // Sätt timestamp baserat på status
    switch (status) {
      case 'ready':
        updateData.approved_at = new Date().toISOString()
        updateData.requires_approval = false
        break
      case 'sent':
        updateData.sent_at = new Date().toISOString()
        break
      case 'paid':
        updateData.paid_at = new Date().toISOString()
        break
    }

    // Lägg till eventuell extra data
    if (additionalData) {
      Object.assign(updateData, additionalData)
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Godkänn faktura (för rabatterade)
   */
  static async approveInvoice(id: string): Promise<Invoice> {
    return this.updateInvoiceStatus(id, 'ready')
  }

  /**
   * Markera faktura som skickad
   */
  static async markAsSent(id: string): Promise<Invoice> {
    return this.updateInvoiceStatus(id, 'sent')
  }

  /**
   * Markera faktura som betald
   */
  static async markAsPaid(id: string): Promise<Invoice> {
    return this.updateInvoiceStatus(id, 'paid')
  }

  /**
   * Makulera faktura
   */
  static async cancelInvoice(id: string): Promise<Invoice> {
    return this.updateInvoiceStatus(id, 'cancelled')
  }

  /**
   * Hämta statistik
   */
  static async getInvoiceStats(): Promise<InvoiceStats> {
    const statuses: InvoiceStatus[] = ['draft', 'pending_approval', 'ready', 'sent', 'paid', 'cancelled']
    const stats: InvoiceStats = {
      draft: { count: 0, amount: 0 },
      pending_approval: { count: 0, amount: 0 },
      ready: { count: 0, amount: 0 },
      sent: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
      total: { count: 0, amount: 0 }
    }

    for (const status of statuses) {
      const { data, error } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('status', status)

      if (error) throw new Error(`Databasfel: ${error.message}`)

      const count = data?.length || 0
      const amount = data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0

      stats[status] = { count, amount }

      if (status !== 'cancelled') {
        stats.total.count += count
        stats.total.amount += amount
      }
    }

    return stats
  }

  /**
   * Exportera fakturor för Fortnox (CSV-format)
   */
  static async exportForFortnox(invoiceIds: string[]): Promise<string> {
    const rows: string[] = []

    // CSV-header
    rows.push([
      'Fakturanummer',
      'Fakturadatum',
      'Förfallodatum',
      'Kundnamn',
      'Organisationsnummer',
      'E-post',
      'Adress',
      'Artikelkod',
      'Artikelnamn',
      'Antal',
      'Enhetspris',
      'Rabatt %',
      'Radbelopp',
      'Moms %',
      'Totalt'
    ].join(';'))

    for (const id of invoiceIds) {
      const invoice = await this.getInvoiceWithItems(id)
      if (!invoice) continue

      for (const item of invoice.items) {
        rows.push([
          invoice.invoice_number || '',
          invoice.created_at.split('T')[0],
          invoice.due_date || '',
          invoice.customer_name,
          invoice.organization_number || '',
          invoice.customer_email || '',
          invoice.customer_address || '',
          item.article_code || '',
          item.article_name,
          item.quantity.toString(),
          item.unit_price.toFixed(2),
          item.discount_percent.toFixed(2),
          item.total_price.toFixed(2),
          item.vat_rate.toFixed(2),
          (item.total_price * (1 + item.vat_rate / 100)).toFixed(2)
        ].join(';'))
      }
    }

    return rows.join('\n')
  }

  /**
   * Kontrollera om ärende redan har faktura
   */
  static async caseHasInvoice(
    caseId: string,
    caseType: 'private' | 'business'
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .neq('status', 'cancelled')

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (count || 0) > 0
  }

  /**
   * Hämta faktura för ärende
   */
  static async getInvoiceByCase(
    caseId: string,
    caseType: 'private' | 'business'
  ): Promise<Invoice | null> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Databasfel: ${error.message}`)
    }
    return data
  }
}
