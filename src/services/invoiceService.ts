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
      invoice_marking?: string
    }
  ): Promise<InvoiceWithItems> {
    // Hämta billing items för ärendet
    const allBillingItems = await CaseBillingService.getCaseBillingItems(caseId, caseType)

    // Filtrera: fakturarader = item_type='service', eller alla om inga tjänsterader finns (bakåtkompatibilitet)
    const serviceItems = allBillingItems.filter(i => i.item_type === 'service')
    const billingItems = serviceItems.length > 0 ? serviceItems : allBillingItems.filter(i => i.item_type === 'article' || !i.item_type)

    if (billingItems.length === 0) {
      throw new Error('Inga fakturerbara tjänster på ärendet')
    }

    // Kolla om anpassat pris finns
    const customPrice = await CaseBillingService.getCustomPrice(caseId, caseType)

    // Beräkna summor — anpassat pris eller standard
    let subtotal: number
    let vat_amount: number
    let total_amount: number

    if (customPrice) {
      // Anpassat pris (lagrat exkl. moms)
      subtotal = customPrice
      vat_amount = customPrice * 0.25
      total_amount = customPrice * 1.25
    } else {
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
      subtotal = totals.subtotal
      vat_amount = totals.vat_amount
      total_amount = totals.total_amount
    }

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
        subtotal,
        vat_amount,
        total_amount,
        status: requiresApproval ? 'pending_approval' : 'ready',
        requires_approval: requiresApproval,
        due_date: calculateDueDate(30),
        rot_rut_type: billingItems.find(i => i.rot_rut_type)?.rot_rut_type || null,
        fastighetsbeteckning: billingItems.find(i => i.fastighetsbeteckning)?.fastighetsbeteckning || null,
        invoice_marking: customerInfo.invoice_marking || null
      })
      .select()
      .single()

    if (invoiceError) throw new Error(`Databasfel: ${invoiceError.message}`)

    // Skapa fakturarader
    const invoiceItems: InvoiceItem[] = []

    if (customPrice) {
      // Med anpassat pris: artikelrader som referens (pris 0) + en "Anpassat pris"-rad
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
            unit_price: 0,
            discount_percent: 0,
            total_price: 0,
            vat_rate: item.vat_rate,
            rot_rut_type: item.rot_rut_type || null,
            fastighetsbeteckning: item.fastighetsbeteckning || null
          })
          .select()
          .single()

        if (itemError) throw new Error(`Databasfel: ${itemError.message}`)
        invoiceItems.push(invoiceItem)
      }

      // Lägg till summeringsrad med det anpassade priset
      const { data: customItem, error: customItemError } = await supabase
        .from('invoice_items')
        .insert({
          invoice_id: invoice.id,
          case_billing_item_id: null,
          article_id: null,
          article_code: null,
          article_name: 'Anpassat pris',
          quantity: 1,
          unit_price: customPrice,
          discount_percent: 0,
          total_price: customPrice,
          vat_rate: 25,
          rot_rut_type: billingItems.find(i => i.rot_rut_type)?.rot_rut_type || null,
          fastighetsbeteckning: billingItems.find(i => i.fastighetsbeteckning)?.fastighetsbeteckning || null
        })
        .select()
        .single()

      if (customItemError) throw new Error(`Databasfel: ${customItemError.message}`)
      invoiceItems.push(customItem)
    } else {
      // Utan anpassat pris: standard — bara service-rader (eller artikel-rader för gamla ärenden)
      for (const item of billingItems) {
        // Välj rätt namn/kod beroende på om det är en tjänstrad eller artikelrad
        const displayName = item.item_type === 'service'
          ? (item.service_name || item.article_name)
          : item.article_name
        const displayCode = item.item_type === 'service'
          ? (item.service_code || item.article_code)
          : item.article_code

        const { data: invoiceItem, error: itemError } = await supabase
          .from('invoice_items')
          .insert({
            invoice_id: invoice.id,
            case_billing_item_id: item.id,
            article_id: item.item_type === 'service' ? null : item.article_id,
            article_code: displayCode,
            article_name: displayName,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            total_price: item.total_price,
            vat_rate: item.vat_rate,
            rot_rut_type: item.rot_rut_type || null,
            fastighetsbeteckning: item.fastighetsbeteckning || null
          })
          .select()
          .single()

        if (itemError) throw new Error(`Databasfel: ${itemError.message}`)
        invoiceItems.push(invoiceItem)
      }
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
   * Hämta faktura med rader (alias)
   */
  static async getInvoice(id: string): Promise<InvoiceWithItems | null> {
    return this.getInvoiceWithItems(id)
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
      case 'booked':
        updateData.booked_at = new Date().toISOString()
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
   * Markera faktura som bokförd i Fortnox
   */
  static async markAsBooked(id: string): Promise<Invoice> {
    return this.updateInvoiceStatus(id, 'booked')
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
   * Återställ makulerad faktura till "Redo att skicka"
   */
  static async restoreInvoice(id: string): Promise<Invoice> {
    return this.updateInvoiceStatus(id, 'ready')
  }

  /**
   * Radera faktura permanent (inkl. fakturarader)
   */
  static async deleteInvoice(id: string): Promise<void> {
    // Radera invoice_items först (FK-beroende)
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id)
    if (itemsError) throw new Error(`Databasfel: ${itemsError.message}`)

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Hämta statistik
   */
  static async getInvoiceStats(): Promise<InvoiceStats> {
    const statuses: InvoiceStatus[] = ['draft', 'pending_approval', 'ready', 'booked', 'sent', 'paid', 'cancelled']
    const stats: InvoiceStats = {
      draft: { count: 0, amount: 0 },
      pending_approval: { count: 0, amount: 0 },
      ready: { count: 0, amount: 0 },
      booked: { count: 0, amount: 0 },
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
   * Kontrollera om fakturan är inaktuell (artiklar ändrade sedan skapande)
   */
  static async isInvoiceStale(invoiceId: string): Promise<{ stale: boolean; reason?: string }> {
    const invoice = await this.getInvoiceWithItems(invoiceId)
    if (!invoice) return { stale: false }

    // Bara relevant för icke-skickade/betalda fakturor
    if (['sent', 'paid', 'cancelled'].includes(invoice.status)) return { stale: false }

    // Hämta aktuella case_billing_items (bara fakturarader)
    const allCaseItems = await CaseBillingService.getCaseBillingItems(
      invoice.case_id,
      invoice.case_type
    )
    const serviceItems2 = allCaseItems.filter(i => i.item_type === 'service')
    const caseItems = serviceItems2.length > 0 ? serviceItems2 : allCaseItems.filter(i => i.item_type === 'article' || !i.item_type)

    // Jämför antal (exkludera "Anpassat pris"-raden som har case_billing_item_id = null)
    const invoiceLinkedItems = invoice.items.filter(i => i.case_billing_item_id != null).length
    const countMismatch = caseItems.length !== invoiceLinkedItems

    // Kolla om artiklar uppdaterats efter fakturaskapande
    // Lägg till 10 sekunders tolerans — vid auto-fakturering skapas fakturan
    // i samma flöde som ärendet uppdateras, så timestamps kan vara nästan identiska
    const invoiceCreatedMs = new Date(invoice.created_at).getTime() + 10000
    const modifiedAfter = caseItems.some(item =>
      new Date(item.updated_at).getTime() > invoiceCreatedMs
    )

    // Kolla om anpassat pris ändrats
    const customPrice = await CaseBillingService.getCustomPrice(invoice.case_id, invoice.case_type)
    const invoiceCustomRow = invoice.items.find(i => i.case_billing_item_id === null && i.article_name === 'Anpassat pris')
    const customPriceChanged = customPrice
      ? (!invoiceCustomRow || invoiceCustomRow.unit_price !== customPrice)
      : (!!invoiceCustomRow)

    if (countMismatch) {
      return { stale: true, reason: 'Artiklar har lagts till eller tagits bort' }
    }
    if (customPriceChanged) {
      return { stale: true, reason: 'Anpassat pris har ändrats' }
    }
    if (modifiedAfter) {
      return { stale: true, reason: 'Artiklar har uppdaterats' }
    }
    return { stale: false }
  }

  /**
   * Regenerera fakturarader från aktuella case_billing_items
   */
  static async regenerateInvoiceItems(invoiceId: string): Promise<InvoiceWithItems> {
    const invoice = await this.getInvoiceWithItems(invoiceId)
    if (!invoice) throw new Error('Faktura hittades inte')
    if (['sent', 'paid', 'cancelled'].includes(invoice.status)) {
      throw new Error('Kan inte uppdatera en skickad/betald/avbruten faktura')
    }

    // Hämta aktuella billing items + custom price (bara fakturarader)
    const allBillingItemsRegen = await CaseBillingService.getCaseBillingItems(invoice.case_id, invoice.case_type)
    const serviceItemsRegen = allBillingItemsRegen.filter(i => i.item_type === 'service')
    const billingItems = serviceItemsRegen.length > 0 ? serviceItemsRegen : allBillingItemsRegen.filter(i => i.item_type === 'article' || !i.item_type)
    if (billingItems.length === 0) throw new Error('Inga fakturerbara tjänster på ärendet')

    const customPrice = await CaseBillingService.getCustomPrice(invoice.case_id, invoice.case_type)

    // Radera befintliga invoice_items
    const { error: deleteError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId)
    if (deleteError) throw new Error(`Databasfel: ${deleteError.message}`)

    // Skapa nya invoice_items (samma logik som createInvoiceFromCase)
    const invoiceItems: InvoiceItem[] = []

    if (customPrice) {
      for (const item of billingItems) {
        const { data: invoiceItem, error: itemError } = await supabase
          .from('invoice_items')
          .insert({
            invoice_id: invoiceId,
            case_billing_item_id: item.id,
            article_id: item.article_id,
            article_code: item.article_code,
            article_name: item.article_name,
            quantity: item.quantity,
            unit_price: 0,
            discount_percent: 0,
            total_price: 0,
            vat_rate: item.vat_rate,
            rot_rut_type: item.rot_rut_type || null,
            fastighetsbeteckning: item.fastighetsbeteckning || null
          })
          .select()
          .single()
        if (itemError) throw new Error(`Databasfel: ${itemError.message}`)
        invoiceItems.push(invoiceItem)
      }

      const { data: customItem, error: customItemError } = await supabase
        .from('invoice_items')
        .insert({
          invoice_id: invoiceId,
          case_billing_item_id: null,
          article_id: null,
          article_code: null,
          article_name: 'Anpassat pris',
          quantity: 1,
          unit_price: customPrice,
          discount_percent: 0,
          total_price: customPrice,
          vat_rate: 25,
          rot_rut_type: billingItems.find(i => i.rot_rut_type)?.rot_rut_type || null,
          fastighetsbeteckning: billingItems.find(i => i.fastighetsbeteckning)?.fastighetsbeteckning || null
        })
        .select()
        .single()
      if (customItemError) throw new Error(`Databasfel: ${customItemError.message}`)
      invoiceItems.push(customItem)
    } else {
      for (const item of billingItems) {
        const { data: invoiceItem, error: itemError } = await supabase
          .from('invoice_items')
          .insert({
            invoice_id: invoiceId,
            case_billing_item_id: item.id,
            article_id: item.article_id,
            article_code: item.article_code,
            article_name: item.article_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            total_price: item.total_price,
            vat_rate: item.vat_rate,
            rot_rut_type: item.rot_rut_type || null,
            fastighetsbeteckning: item.fastighetsbeteckning || null
          })
          .select()
          .single()
        if (itemError) throw new Error(`Databasfel: ${itemError.message}`)
        invoiceItems.push(invoiceItem)
      }
    }

    // Beräkna nya summor
    let subtotal: number, vat_amount: number, total_amount: number
    if (customPrice) {
      subtotal = customPrice
      vat_amount = customPrice * 0.25
      total_amount = customPrice * 1.25
    } else {
      const totals = calculateInvoiceTotals(invoiceItems)
      subtotal = totals.subtotal
      vat_amount = totals.vat_amount
      total_amount = totals.total_amount
    }

    // Uppdatera fakturans summor + ROT/RUT-info
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        subtotal,
        vat_amount,
        total_amount,
        requires_approval: billingItems.some(item => item.requires_approval),
        rot_rut_type: billingItems.find(i => i.rot_rut_type)?.rot_rut_type || null,
        fastighetsbeteckning: billingItems.find(i => i.fastighetsbeteckning)?.fastighetsbeteckning || null
      })
      .eq('id', invoiceId)
    if (updateError) throw new Error(`Databasfel: ${updateError.message}`)

    return {
      ...invoice,
      subtotal,
      vat_amount,
      total_amount,
      items: invoiceItems
    }
  }

  /**
   * Kolla om ärende har en icke-skickad faktura
   */
  static async hasUnsentInvoiceForCase(
    caseId: string,
    caseType: 'private' | 'business'
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .in('status', ['draft', 'pending_approval', 'ready'])

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (count || 0) > 0
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
