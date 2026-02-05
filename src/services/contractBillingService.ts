// src/services/contractBillingService.ts
// Service för avtalsfakturering

import { supabase } from '../lib/supabase'
import {
  ContractBillingItem,
  ContractBillingItemWithRelations,
  ContractBillingBatch,
  ContractBillingItemStatus,
  ContractBillingBatchStatus,
  BillingFrequency,
  CreateBillingItemInput,
  ContractBillingItemType,
  ContractBillingItemFilters,
  ContractInvoice,
  BillingPeriodSummary,
  ContractBillingPipelineFilters,
  deriveInvoiceStatus,
  formatBillingPeriod
} from '../types/contractBilling'
import { CaseBillingService } from './caseBillingService'

export class ContractBillingService {
  /**
   * Hämta kunder som ska faktureras med viss frekvens
   */
  static async getCustomersForBilling(frequency: BillingFrequency): Promise<any[]> {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        company_name,
        organization_number,
        billing_email,
        billing_frequency,
        price_list_id,
        price_list:price_lists(id, name, is_default)
      `)
      .eq('is_active', true)
      .eq('billing_frequency', frequency)
      .not('price_list_id', 'is', null)

    if (error) throw new Error(`Kunde inte hämta kunder: ${error.message}`)
    return data || []
  }

  /**
   * Hämta artikelpriser för en kunds prislista
   */
  static async getCustomerPriceListItems(customerId: string): Promise<any[]> {
    // Först hämta kundens prislista
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('price_list_id')
      .eq('id', customerId)
      .single()

    if (customerError) throw new Error(`Kunde inte hämta kund: ${customerError.message}`)
    if (!customer?.price_list_id) return []

    // Hämta artikelpriser från prislistan
    const { data, error } = await supabase
      .from('price_list_items')
      .select(`
        id,
        custom_price,
        article:articles(
          id,
          code,
          name,
          default_price,
          vat_rate,
          unit,
          category,
          is_active
        )
      `)
      .eq('price_list_id', customer.price_list_id)

    if (error) throw new Error(`Kunde inte hämta artikelpriser: ${error.message}`)

    // Filtrera bort inaktiva artiklar
    return (data || []).filter(item => item.article?.is_active)
  }

  /**
   * Generera faktureringsrader för en kund
   */
  static async generateBillingItems(
    customerId: string,
    periodStart: string,
    periodEnd: string,
    batchId?: string
  ): Promise<ContractBillingItem[]> {
    const priceListItems = await this.getCustomerPriceListItems(customerId)

    if (priceListItems.length === 0) {
      return []
    }

    const billingItems: CreateBillingItemInput[] = priceListItems.map(item => ({
      customer_id: customerId,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      article_id: item.article?.id || null,
      article_code: item.article?.code || null,
      article_name: item.article?.name || 'Okänd artikel',
      quantity: 1,
      unit_price: item.custom_price,
      total_price: item.custom_price,
      vat_rate: item.article?.vat_rate || 25,
      batch_id: batchId || null
    }))

    const { data, error } = await supabase
      .from('contract_billing_items')
      .insert(billingItems)
      .select()

    if (error) throw new Error(`Kunde inte skapa faktureringsrader: ${error.message}`)
    return data || []
  }

  /**
   * Hämta faktureringsrader med filter
   */
  static async getBillingItems(filters?: ContractBillingItemFilters): Promise<ContractBillingItemWithRelations[]> {
    let query = supabase
      .from('contract_billing_items')
      .select(`
        *,
        customer:customers(id, company_name, organization_number, billing_email, billing_address, contact_address),
        article:articles(id, code, name)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }
    if (filters?.item_type && filters.item_type !== 'all') {
      query = query.eq('item_type', filters.item_type)
    }
    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id)
    }
    if (filters?.batch_id) {
      query = query.eq('batch_id', filters.batch_id)
    }
    if (filters?.requires_approval !== undefined) {
      query = query.eq('requires_approval', filters.requires_approval)
    }
    if (filters?.period_start) {
      query = query.gte('billing_period_start', filters.period_start)
    }
    if (filters?.period_end) {
      query = query.lte('billing_period_end', filters.period_end)
    }

    const { data, error } = await query

    if (error) throw new Error(`Kunde inte hämta faktureringsrader: ${error.message}`)
    return (data || []) as ContractBillingItemWithRelations[]
  }

  /**
   * Hämta items som kräver godkännande (rabatterade)
   */
  static async getItemsRequiringApproval(): Promise<ContractBillingItemWithRelations[]> {
    return this.getBillingItems({
      requires_approval: true,
      status: 'pending'
    })
  }

  /**
   * Godkänn rabatt för en item
   */
  static async approveDiscount(id: string): Promise<ContractBillingItem> {
    const { data, error } = await supabase
      .from('contract_billing_items')
      .update({
        requires_approval: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Kunde inte godkänna rabatt: ${error.message}`)
    return data
  }

  /**
   * Skapa ad-hoc billing item från ärende
   */
  static async createAdHocItem(input: {
    customer_id: string
    case_id: string
    case_type: 'private' | 'business' | 'contract'
    article_id?: string
    article_code?: string
    article_name: string
    quantity: number
    unit_price: number
    total_price: number
    vat_rate?: number
    discount_percent?: number
    original_price?: number
    billing_period_start: string
    billing_period_end: string
    batch_id?: string
    notes?: string
  }): Promise<ContractBillingItem> {
    const requiresApproval = (input.discount_percent ?? 0) > 0

    const { data, error } = await supabase
      .from('contract_billing_items')
      .insert({
        customer_id: input.customer_id,
        case_id: input.case_id,
        case_type: input.case_type,
        article_id: input.article_id || null,
        article_code: input.article_code || null,
        article_name: input.article_name,
        quantity: input.quantity,
        unit_price: input.unit_price,
        total_price: input.total_price,
        vat_rate: input.vat_rate || 25,
        item_type: 'ad_hoc',
        source: 'case_completion',
        requires_approval: requiresApproval,
        discount_percent: input.discount_percent || 0,
        original_price: input.original_price || null,
        billing_period_start: input.billing_period_start,
        billing_period_end: input.billing_period_end,
        batch_id: input.batch_id || null,
        notes: input.notes || null,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw new Error(`Kunde inte skapa ad-hoc post: ${error.message}`)
    return data
  }

  /**
   * Skapa ad-hoc billing items från ett avslutat ärende
   * Kopierar alla case_billing_items till contract_billing_items
   * och markerar case_billing_items som 'billed'
   */
  static async createAdHocItemsFromCase(
    caseId: string,
    customerId: string
  ): Promise<{ created: number; totalAmount: number }> {
    // 1. Hämta case_billing_items för ärendet
    const caseBillingItems = await CaseBillingService.getCaseBillingItems(caseId, 'contract')

    if (caseBillingItems.length === 0) {
      return { created: 0, totalAmount: 0 }
    }

    // 2. Dagens datum för faktureringsperiod
    const today = new Date().toISOString().split('T')[0]

    let totalAmount = 0

    // 3. Skapa contract_billing_items för varje case_billing_item
    for (const item of caseBillingItems) {
      const requiresApproval = (item.discount_percent || 0) > 0

      const { error } = await supabase.from('contract_billing_items').insert({
        customer_id: customerId,
        article_id: item.article_id,
        article_code: item.article_code,
        article_name: item.article_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        vat_rate: item.vat_rate,
        item_type: 'ad_hoc',
        case_id: caseId,
        case_type: 'contract',
        source: 'case_completion',
        requires_approval: requiresApproval,
        discount_percent: item.discount_percent || 0,
        original_price: item.unit_price, // Originalpris utan rabatt
        billing_period_start: today,
        billing_period_end: today,
        status: requiresApproval ? 'pending' : 'approved',
        notes: item.notes || `Från ärende ${caseId}`
      })

      if (error) {
        console.error('Kunde inte skapa ad-hoc item:', error)
        throw new Error(`Kunde inte skapa ad-hoc faktureringspost: ${error.message}`)
      }

      totalAmount += item.total_price
    }

    // 4. Markera case_billing_items som 'billed'
    await CaseBillingService.updateCaseItemsStatus(caseId, 'contract', 'billed')

    return {
      created: caseBillingItems.length,
      totalAmount
    }
  }

  /**
   * Hämta statistik för faktureringsrader
   */
  static async getBillingStats(): Promise<{
    pending: { count: number; amount: number }
    approved: { count: number; amount: number }
    invoiced: { count: number; amount: number }
    paid: { count: number; amount: number }
  }> {
    const { data, error } = await supabase
      .from('contract_billing_items')
      .select('status, total_price')

    if (error) throw new Error(`Kunde inte hämta statistik: ${error.message}`)

    const stats = {
      pending: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      invoiced: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 }
    }

    for (const item of data || []) {
      if (item.status in stats) {
        stats[item.status as keyof typeof stats].count++
        stats[item.status as keyof typeof stats].amount += item.total_price || 0
      }
    }

    return stats
  }

  /**
   * Uppdatera status på en faktureringsrad
   */
  static async updateItemStatus(
    id: string,
    status: ContractBillingItemStatus,
    additionalData?: {
      invoice_number?: string
      notes?: string
    }
  ): Promise<ContractBillingItem> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    // Lägg till tidsstämplar beroende på status
    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString()
    } else if (status === 'invoiced') {
      updateData.invoiced_at = new Date().toISOString()
      if (additionalData?.invoice_number) {
        updateData.invoice_number = additionalData.invoice_number
      }
    } else if (status === 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    if (additionalData?.notes) {
      updateData.notes = additionalData.notes
    }

    const { data, error } = await supabase
      .from('contract_billing_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Kunde inte uppdatera status: ${error.message}`)
    return data
  }

  /**
   * Uppdatera status på flera faktureringsrader
   */
  static async bulkUpdateStatus(
    ids: string[],
    status: ContractBillingItemStatus
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString()
    } else if (status === 'invoiced') {
      updateData.invoiced_at = new Date().toISOString()
    } else if (status === 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('contract_billing_items')
      .update(updateData)
      .in('id', ids)

    if (error) throw new Error(`Kunde inte uppdatera status: ${error.message}`)
  }

  /**
   * Ta bort en faktureringsrad
   */
  static async deleteItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('contract_billing_items')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Kunde inte ta bort rad: ${error.message}`)
  }

  // ============ BATCH-OPERATIONER ============

  /**
   * Skapa ny faktureringsomgång
   */
  static async createBatch(
    periodStart: string,
    periodEnd: string,
    notes?: string
  ): Promise<ContractBillingBatch> {
    const batchNumber = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`

    const { data, error } = await supabase
      .from('contract_billing_batches')
      .insert({
        batch_number: batchNumber,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        notes: notes || null
      })
      .select()
      .single()

    if (error) throw new Error(`Kunde inte skapa batch: ${error.message}`)
    return data
  }

  /**
   * Hämta alla batches
   */
  static async getAllBatches(): Promise<ContractBillingBatch[]> {
    const { data, error } = await supabase
      .from('contract_billing_batches')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Kunde inte hämta batches: ${error.message}`)
    return data || []
  }

  /**
   * Hämta en batch med dess items
   */
  static async getBatchWithItems(batchId: string): Promise<{
    batch: ContractBillingBatch
    items: ContractBillingItemWithRelations[]
  }> {
    const [batchResult, itemsResult] = await Promise.all([
      supabase.from('contract_billing_batches').select('*').eq('id', batchId).single(),
      this.getBillingItems({ batch_id: batchId })
    ])

    if (batchResult.error) throw new Error(`Kunde inte hämta batch: ${batchResult.error.message}`)

    return {
      batch: batchResult.data,
      items: itemsResult
    }
  }

  /**
   * Uppdatera batch-status
   */
  static async updateBatchStatus(
    batchId: string,
    status: ContractBillingBatchStatus
  ): Promise<ContractBillingBatch> {
    const updateData: any = { status }

    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString()
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('contract_billing_batches')
      .update(updateData)
      .eq('id', batchId)
      .select()
      .single()

    if (error) throw new Error(`Kunde inte uppdatera batch: ${error.message}`)
    return data
  }

  /**
   * Generera fakturering för alla kunder med viss frekvens
   */
  static async generateBatchBilling(
    frequency: BillingFrequency,
    periodStart: string,
    periodEnd: string,
    notes?: string
  ): Promise<{
    batch: ContractBillingBatch
    itemCount: number
    customerCount: number
    totalAmount: number
  }> {
    // Skapa batch
    const batch = await this.createBatch(periodStart, periodEnd, notes)

    // Hämta alla kunder med denna frekvens och prislista
    const customers = await this.getCustomersForBilling(frequency)

    let totalItems = 0
    let totalAmount = 0

    // Generera items för varje kund
    for (const customer of customers) {
      const items = await this.generateBillingItems(
        customer.id,
        periodStart,
        periodEnd,
        batch.id
      )
      totalItems += items.length
      totalAmount += items.reduce((sum, item) => sum + (item.total_price || 0), 0)
    }

    // Uppdatera batch med statistik
    const { error } = await supabase
      .from('contract_billing_batches')
      .update({
        status: 'generated',
        total_customers: customers.length,
        total_items: totalItems,
        total_amount: totalAmount
      })
      .eq('id', batch.id)

    if (error) {
      console.error('Kunde inte uppdatera batch-statistik:', error)
    }

    return {
      batch: { ...batch, status: 'generated', total_customers: customers.length, total_items: totalItems, total_amount: totalAmount },
      itemCount: totalItems,
      customerCount: customers.length,
      totalAmount
    }
  }

  /**
   * Ta bort en batch och alla dess items
   */
  static async deleteBatch(batchId: string): Promise<void> {
    // Ta bort items först (om CASCADE inte fungerar)
    await supabase
      .from('contract_billing_items')
      .delete()
      .eq('batch_id', batchId)

    // Ta bort batch
    const { error } = await supabase
      .from('contract_billing_batches')
      .delete()
      .eq('id', batchId)

    if (error) throw new Error(`Kunde inte ta bort batch: ${error.message}`)
  }

  // ============ PIPELINE-VY METODER ============

  /**
   * Gruppera billing items till fakturor per kund och period
   */
  static groupItemsIntoInvoices(
    items: ContractBillingItemWithRelations[]
  ): ContractInvoice[] {
    const groups = new Map<string, ContractBillingItemWithRelations[]>()

    for (const item of items) {
      const key = `${item.customer_id}::${item.billing_period_start}::${item.billing_period_end}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }

    const invoices: ContractInvoice[] = []

    for (const [, groupItems] of groups) {
      const first = groupItems[0]
      const subtotal = groupItems.reduce((sum, i) => sum + i.total_price, 0)
      const vatAmount = groupItems.reduce(
        (sum, i) => sum + i.total_price * (i.vat_rate / 100), 0
      )

      const batchIds = new Set(groupItems.map(i => i.batch_id).filter(Boolean))
      const sharedBatchId = batchIds.size === 1 ? [...batchIds][0]! : null

      invoices.push({
        customer_id: first.customer_id,
        period_start: first.billing_period_start,
        period_end: first.billing_period_end,
        customer: {
          id: first.customer?.id || first.customer_id,
          company_name: first.customer?.company_name || 'Okänd kund',
          organization_number: first.customer?.organization_number || null,
          billing_email: first.customer?.billing_email || null,
          billing_address: first.customer?.billing_address || null,
          contact_address: first.customer?.contact_address || null,
        },
        items: groupItems,
        subtotal,
        vat_amount: vatAmount,
        total_amount: subtotal + vatAmount,
        item_count: groupItems.length,
        derived_status: deriveInvoiceStatus(groupItems),
        has_items_requiring_approval: groupItems.some(
          i => i.requires_approval && i.status === 'pending'
        ),
        has_discount: groupItems.some(i => i.discount_percent > 0),
        batch_id: sharedBatchId,
      })
    }

    invoices.sort((a, b) =>
      a.customer.company_name.localeCompare(b.customer.company_name, 'sv')
    )

    return invoices
  }

  /**
   * Hämta pipeline-vy: items grupperade per period och kund
   */
  static async getBillingPipeline(
    filters?: ContractBillingPipelineFilters
  ): Promise<BillingPeriodSummary[]> {
    const items = await this.getBillingItems(filters)

    let filtered = items
    if (filters?.search) {
      const search = filters.search.toLowerCase()
      filtered = items.filter(item =>
        item.customer?.company_name?.toLowerCase().includes(search) ||
        item.article_name?.toLowerCase().includes(search) ||
        item.article_code?.toLowerCase().includes(search)
      )
    }

    const invoices = this.groupItemsIntoInvoices(filtered)

    const periodMap = new Map<string, ContractInvoice[]>()
    for (const invoice of invoices) {
      const key = `${invoice.period_start}::${invoice.period_end}`
      if (!periodMap.has(key)) periodMap.set(key, [])
      periodMap.get(key)!.push(invoice)
    }

    const periods: BillingPeriodSummary[] = []
    const allStatuses: ContractBillingItemStatus[] = ['pending', 'approved', 'invoiced', 'paid', 'cancelled']

    for (const [, periodInvoices] of periodMap) {
      const first = periodInvoices[0]
      const statusBreakdown = {} as Record<ContractBillingItemStatus, number>
      for (const status of allStatuses) {
        statusBreakdown[status] = periodInvoices.filter(
          inv => inv.derived_status === status
        ).length
      }

      periods.push({
        period_start: first.period_start,
        period_end: first.period_end,
        period_label: formatBillingPeriod(first.period_start, first.period_end),
        customer_count: periodInvoices.length,
        item_count: periodInvoices.reduce((sum, inv) => sum + inv.item_count, 0),
        total_amount: periodInvoices.reduce((sum, inv) => sum + inv.subtotal, 0),
        invoices: periodInvoices,
        status_breakdown: statusBreakdown,
      })
    }

    periods.sort((a, b) => b.period_start.localeCompare(a.period_start))
    return periods
  }

  /**
   * Hämta en kunds faktura för en specifik period
   */
  static async getCustomerInvoice(
    customerId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<ContractInvoice | null> {
    const items = await this.getBillingItems({
      customer_id: customerId,
      period_start: periodStart,
      period_end: periodEnd,
    })

    if (items.length === 0) return null

    const invoices = this.groupItemsIntoInvoices(items)
    return invoices[0] || null
  }

  /**
   * Uppdatera status för alla items i en kundfaktura
   */
  static async updateInvoiceStatus(
    customerId: string,
    periodStart: string,
    periodEnd: string,
    newStatus: ContractBillingItemStatus
  ): Promise<void> {
    const items = await this.getBillingItems({
      customer_id: customerId,
      period_start: periodStart,
      period_end: periodEnd,
    })

    const eligibleIds = items
      .filter(i => i.status !== 'cancelled' && i.status !== newStatus)
      .map(i => i.id)

    if (eligibleIds.length > 0) {
      await this.bulkUpdateStatus(eligibleIds, newStatus)
    }
  }

  /**
   * Exportera grupperade fakturor till Fortnox CSV
   */
  static exportInvoicesForFortnox(invoices: ContractInvoice[]): string {
    const rows: string[] = []

    rows.push([
      'Kundnamn',
      'Organisationsnummer',
      'Fakturerings-e-post',
      'Faktureringsadress',
      'Period',
      'Artikelkod',
      'Artikelnamn',
      'Antal',
      'Enhetspris',
      'Rabatt %',
      'Radbelopp',
      'Moms %',
      'Typ'
    ].join(';'))

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        rows.push([
          invoice.customer.company_name,
          invoice.customer.organization_number || '',
          invoice.customer.billing_email || '',
          invoice.customer.billing_address || invoice.customer.contact_address || '',
          formatBillingPeriod(invoice.period_start, invoice.period_end),
          item.article_code || '',
          item.article_name,
          String(item.quantity),
          String(item.unit_price),
          String(item.discount_percent || 0),
          String(item.total_price),
          String(item.vat_rate),
          item.item_type === 'contract' ? 'Löpande' : 'Tillägg'
        ].join(';'))
      }
    }

    return rows.join('\n')
  }
}
