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
  formatBillingPeriod,
  PipelineCustomer,
  MonthlyCustomerEntry,
  MonthlyCustomerStatus,
  MonthlyPipelineSummary,
  AdhocInvoiceGrouping,
  AdhocSalesEntry,
  AdhocSalesMonth,
} from '../types/contractBilling'
import { CaseBillingService } from './caseBillingService'
import { CustomerContractArticleService } from './customerContractArticleService'

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
    batchId?: string,
    billingFrequency?: BillingFrequency
  ): Promise<ContractBillingItem[]> {
    // Hämta kund inkl. prisjustering
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('price_list_id, price_adjustment_percent')
      .eq('id', customerId)
      .single()

    if (customerError) throw new Error(`Kunde inte hämta kund: ${customerError.message}`)

    const adjustmentPercent = customer?.price_adjustment_percent ?? 0
    const hasAdjustment = adjustmentPercent !== 0

    // Artiklar lagras med årsbelopp — skala till rätt period
    const FREQ_DIVISOR: Record<BillingFrequency, number> = {
      monthly: 12, quarterly: 4, semi_annual: 2, annual: 1, on_demand: 1
    }
    const divisor = FREQ_DIVISOR[billingFrequency ?? 'annual']

    let billingItems: CreateBillingItemInput[] = []

    // Prioritera kundspecifika avtalsartiklar om de finns (per-kund avtalsupplägg)
    const contractArticles = await CustomerContractArticleService.getArticles(customerId)

    if (contractArticles.length > 0) {
      billingItems = contractArticles.map(ca => {
        const unitPrice = ca.fixed_price != null ? ca.fixed_price : ca.list_price
        const annualTotal = unitPrice * ca.quantity
        const scaledTotal = Math.round(annualTotal / divisor)
        const adjustedTotal = hasAdjustment
          ? Math.round(scaledTotal * (1 + adjustmentPercent / 100))
          : scaledTotal

        return {
          customer_id: customerId,
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          article_id: ca.article_id,
          article_code: (ca.article as any)?.code || null,
          article_name: ca.article?.name || 'Okänd artikel',
          quantity: ca.quantity,
          unit_price: unitPrice,
          total_price: adjustedTotal,
          vat_rate: (ca.article as any)?.vat_rate || 25,
          batch_id: batchId || null,
          original_price: hasAdjustment ? scaledTotal : null,
        }
      })
    } else {
      // Fallback: artikel-rader från kundens prislista (historisk bakåtkompatibilitet)
      if (!customer?.price_list_id) return []

      const { data: rawItems, error: itemsError } = await supabase
        .from('price_list_items')
        .select(`
          id,
          custom_price,
          article:articles(
            id, code, name, default_price, vat_rate, unit, category, is_active
          )
        `)
        .eq('price_list_id', customer.price_list_id)
        .not('article_id', 'is', null)

      if (itemsError) throw new Error(`Kunde inte hämta artikelpriser: ${itemsError.message}`)

      const priceListItems = (rawItems || []).filter((item: any) => item.article?.is_active)
      if (priceListItems.length === 0) return []

      billingItems = priceListItems.map((item: any) => {
        const annualPrice: number = item.custom_price
        const scaledBase = Math.round(annualPrice / divisor)
        const adjustedPrice = hasAdjustment
          ? Math.round(scaledBase * (1 + adjustmentPercent / 100))
          : scaledBase

        return {
          customer_id: customerId,
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          article_id: item.article?.id || null,
          article_code: item.article?.code || null,
          article_name: item.article?.name || 'Okänd artikel',
          quantity: 1,
          unit_price: adjustedPrice,
          total_price: adjustedPrice,
          vat_rate: item.article?.vat_rate || 25,
          batch_id: batchId || null,
          original_price: hasAdjustment ? scaledBase : null,
        }
      })
    }

    if (billingItems.length === 0) return []

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
        customer:customers(id, company_name, organization_number, billing_email, billing_address, contact_address, billing_reference, cost_center, billing_recipient, customer_number),
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

    // Normalisera single-date perioder till månadsgränser
    let pStart = input.billing_period_start
    let pEnd = input.billing_period_end
    if (pStart === pEnd) {
      const d = new Date(pStart + 'T00:00:00')
      pStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
      pEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
    }

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
        billing_period_start: pStart,
        billing_period_end: pEnd,
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
   * Skapa ad-hoc billing items från ett avslutat ärende.
   * Kopierar alla case_billing_items till contract_billing_items som
   * item_type='ad_hoc' och markerar case_billing_items som 'billed'.
   *
   * invoice_date sätts från ärendets completedAt — det är detta datum
   * som styr vilken månadsbucket posten hamnar i på /admin/fakturering.
   * billing_period_start/end sätts till månaden runt completedAt för
   * bakåtkompatibilitet men används inte av merförsäljnings-pipelinen.
   */
  static async createAdHocItemsFromCase(
    caseId: string,
    customerId: string,
    completedAt: Date | string = new Date()
  ): Promise<{ created: number; totalAmount: number }> {
    // 1. Hämta case_billing_items för ärendet
    const caseBillingItems = await CaseBillingService.getCaseBillingItems(caseId, 'contract')

    if (caseBillingItems.length === 0) {
      return { created: 0, totalAmount: 0 }
    }

    // 2. Normalisera completedAt till YYYY-MM-DD i svensk tid (inte UTC).
    //    new Date(..).toISOString() drar -2h i sommartid → datum backar en dag.
    const completedDate = typeof completedAt === 'string'
      ? new Date(completedAt)
      : completedAt
    const y = completedDate.getFullYear()
    const m = completedDate.getMonth() // 0-indexed
    const d = completedDate.getDate()
    const fmt = (n: number) => String(n).padStart(2, '0')
    const invoiceDate = `${y}-${fmt(m + 1)}-${fmt(d)}`
    const periodStart = `${y}-${fmt(m + 1)}-01`
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate()
    const periodEnd = `${y}-${fmt(m + 1)}-${fmt(lastDayOfMonth)}`

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
        original_price: item.unit_price,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        invoice_date: invoiceDate,
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

    // 5. Generera adhoc-invoice enligt kundens grouping
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('adhoc_invoice_grouping')
        .eq('id', customerId)
        .single()
      const grouping = (customer?.adhoc_invoice_grouping ?? 'per_case') as 'per_case' | 'monthly_batch'
      const { ContractInvoiceGenerator } = await import('./contractInvoiceGenerator')
      await ContractInvoiceGenerator.generateAdhocInvoiceForCase({
        customerId,
        caseId,
        completedAt: completedDate,
        grouping,
      })
    } catch (err) {
      console.error('Kunde inte skapa adhoc-invoice:', err)
    }

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
    } else if (status === 'booked') {
      updateData.booked_at = new Date().toISOString()
    } else if (status === 'sent') {
      updateData.sent_at = new Date().toISOString()
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
    } else if (status === 'booked') {
      updateData.booked_at = new Date().toISOString()
    } else if (status === 'sent') {
      updateData.sent_at = new Date().toISOString()
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
        batch.id,
        frequency
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
      // Gruppera per kund + månad (YYYY-MM) istället för exakta datum
      // så att ad-hoc och löpande poster hamnar på samma faktura
      const monthKey = item.billing_period_start.slice(0, 7)
      const key = `${item.customer_id}::${monthKey}`
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

      // Beräkna månadsgränser från gruppens datum
      const dates = groupItems.map(i => i.billing_period_start)
      const firstDate = new Date(Math.min(...dates.map(d => new Date(d).getTime())))
      const monthStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
        .toISOString().split('T')[0]
      const monthEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0)
        .toISOString().split('T')[0]

      invoices.push({
        customer_id: first.customer_id,
        period_start: monthStart,
        period_end: monthEnd,
        customer: {
          id: first.customer?.id || first.customer_id,
          company_name: first.customer?.company_name || 'Okänd kund',
          organization_number: first.customer?.organization_number || null,
          billing_email: first.customer?.billing_email || null,
          billing_address: first.customer?.billing_address || null,
          contact_address: first.customer?.contact_address || null,
          customer_number: first.customer?.customer_number ?? null,
          billing_reference: first.customer?.billing_reference ?? null,
          cost_center: first.customer?.cost_center ?? null,
          billing_recipient: first.customer?.billing_recipient ?? null,
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
        fortnox_document_number: groupItems.find(i => i.fortnox_document_number)?.fortnox_document_number ?? null,
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
    const allStatuses: ContractBillingItemStatus[] = ['pending', 'approved', 'draft', 'booked', 'sent', 'invoiced', 'paid', 'cancelled']

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

  // ============ MONTHLY PIPELINE METHODS ============

  /**
   * Hämta alla avtalskunder oavsett prislista-status.
   * Till skillnad från getCustomersForBilling() inkluderas kunder utan prislista.
   */
  static async getAllContractCustomers(): Promise<PipelineCustomer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        company_name,
        organization_number,
        billing_email,
        billing_frequency,
        price_list_id,
        contract_status,
        effective_end_date,
        monthly_value,
        billing_anchor_month,
        billing_active,
        price_list:price_lists(id, name)
      `)
      .eq('is_active', true)
      .eq('billing_active', true)
      .not('billing_frequency', 'is', null)
      .order('company_name', { ascending: true })

    if (error) throw new Error(`Kunde inte hämta avtalskunder: ${error.message}`)

    return (data || []).map((c: any) => ({
      id: c.id,
      company_name: c.company_name,
      organization_number: c.organization_number,
      billing_email: c.billing_email,
      billing_frequency: c.billing_frequency,
      price_list_id: c.price_list_id,
      price_list_name: c.price_list?.name || null,
      contract_status: c.contract_status,
      effective_end_date: c.effective_end_date,
      monthly_value: c.monthly_value,
      billing_anchor_month: c.billing_anchor_month,
      billing_active: c.billing_active,
    }))
  }

  /**
   * Bygg pipeline-data för ett månadsintervall.
   * Returnerar alla avtalskunder × alla månader med status och belopp.
   * Använder bara 2 Supabase-queries oavsett antal kunder/månader.
   */
  static async getMonthlyPipelineData(
    startMonth: string,
    endMonth: string
  ): Promise<MonthlyPipelineSummary[]> {
    // 1. Hämta alla avtalskunder
    const customers = await this.getAllContractCustomers()

    // 2. Beräkna datumintervall för items-query
    const periodStart = `${startMonth}-01`
    const [endY, endM] = endMonth.split('-').map(Number)
    const lastDay = new Date(endY, endM, 0).getDate()
    const periodEnd = `${endMonth}-${String(lastDay).padStart(2, '0')}`

    // 3. Hämta alla billing items inom intervallet — men BARA årspremie (item_type='contract').
    //    Ad-hoc (merförsäljning från avslutade ärenden) visas i egen vy via
    //    getAdhocSalesPipelineData och ska inte blandas in här.
    const items = await this.getBillingItems({
      period_start: periodStart,
      period_end: periodEnd,
      item_type: 'contract',
    })

    // 4. Bygg items-map: customer_id::month_key → items[]
    const itemsMap = new Map<string, ContractBillingItemWithRelations[]>()
    for (const item of items) {
      const monthKey = item.billing_period_start.slice(0, 7)
      const key = `${item.customer_id}::${monthKey}`
      if (!itemsMap.has(key)) itemsMap.set(key, [])
      itemsMap.get(key)!.push(item)
    }

    // 5. Generera månader
    const months: MonthlyPipelineSummary[] = []
    const [startY, startM] = startMonth.split('-').map(Number)
    let year = startY
    let month = startM

    while (`${year}-${String(month).padStart(2, '0')}` <= endMonth) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      const monthStart = `${monthKey}-01`
      const monthLastDay = new Date(year, month, 0).getDate()
      const monthEnd = `${monthKey}-${String(monthLastDay).padStart(2, '0')}`
      const monthLabel = new Date(year, month - 1, 1)
        .toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })

      const statusBreakdown: Record<MonthlyCustomerStatus, number> = {
        not_billable: 0,
        awaiting_generation: 0,
        pending: 0,
        approved: 0,
        draft: 0,
        booked: 0,
        sent: 0,
        overdue: 0,
        invoiced: 0,
        paid: 0,
        mixed: 0,
      }

      const customerEntries: MonthlyCustomerEntry[] = []
      let totalAmount = 0
      let projectedAmount = 0
      let billableCount = 0
      let generatedCount = 0
      let missingSetupCount = 0

      for (const customer of customers) {
        // Filtrera bort terminated kunder vars effective_end_date < månadens start
        if (
          customer.contract_status === 'terminated' &&
          customer.effective_end_date &&
          customer.effective_end_date < monthStart
        ) {
          continue
        }

        // Filtrera per ankarmånad om den är satt
        // Kunder utan ankarmånad visas fortfarande i alla månader (bakåtkompatibilitet)
        if (customer.billing_anchor_month != null && customer.billing_frequency && customer.billing_frequency !== 'on_demand') {
          const freqMonths = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 }[customer.billing_frequency] ?? 1
          const anchorMonth = customer.billing_anchor_month // 1–12
          // Kontrollera om denna månads nummer (1–12) är en fakturamånad för kunden
          const currentMonthNum = month // redan 1-indexed i loopen
          // Beräkna om (currentMonth - anchorMonth) är jämnt delbart med frekvens
          const diff = ((currentMonthNum - anchorMonth) % freqMonths + freqMonths) % freqMonths
          if (diff !== 0) continue  // Inte en fakturamånad för denna kund
        }

        const key = `${customer.id}::${monthKey}`
        const customerItems = itemsMap.get(key) || []

        let status: MonthlyCustomerStatus
        let recurringAmount = 0
        let adhocAmount = 0
        let entryAmount = 0

        if (customerItems.length > 0) {
          // Har items - bestäm status från items
          const nonCancelled = customerItems.filter(i => i.status !== 'cancelled')
          if (nonCancelled.length === 0) {
            status = 'not_billable'
          } else {
            const statuses = new Set(nonCancelled.map(i => i.status))
            if (statuses.size === 1) {
              status = [...statuses][0] as MonthlyCustomerStatus
            } else {
              status = 'mixed'
            }
          }

          recurringAmount = customerItems
            .filter(i => i.item_type === 'contract' && i.status !== 'cancelled')
            .reduce((sum, i) => sum + i.total_price, 0)
          adhocAmount = customerItems
            .filter(i => i.item_type === 'ad_hoc' && i.status !== 'cancelled')
            .reduce((sum, i) => sum + i.total_price, 0)
          entryAmount = recurringAmount + adhocAmount
          generatedCount++
        } else if (customer.price_list_id) {
          // Har prislista men inga items
          status = 'awaiting_generation'
          entryAmount = customer.monthly_value || 0
          projectedAmount += entryAmount
        } else {
          // Saknar prislista
          status = 'not_billable'
          entryAmount = customer.monthly_value || 0
          projectedAmount += entryAmount
          missingSetupCount++
        }

        if (customer.price_list_id) {
          billableCount++
        }

        statusBreakdown[status]++
        totalAmount += entryAmount

        customerEntries.push({
          customer,
          status,
          items: customerItems,
          recurring_amount: recurringAmount,
          adhoc_amount: adhocAmount,
          total_amount: entryAmount,
          item_count: customerItems.length,
          has_items_requiring_approval: customerItems.some(
            i => i.requires_approval && i.status === 'pending'
          ),
        })
      }

      // Sortera: kunder som behöver åtgärd först
      const statusPriority: Record<MonthlyCustomerStatus, number> = {
        overdue: 0,
        mixed: 1,
        pending: 2,
        awaiting_generation: 3,
        approved: 4,
        draft: 5,
        booked: 6,
        sent: 7,
        invoiced: 8,
        paid: 9,
        not_billable: 10,
      }
      customerEntries.sort((a, b) => {
        const pa = statusPriority[a.status] ?? 9
        const pb = statusPriority[b.status] ?? 9
        if (pa !== pb) return pa - pb
        return a.customer.company_name.localeCompare(b.customer.company_name, 'sv')
      })

      months.push({
        month_key: monthKey,
        month_label: monthLabel,
        period_start: monthStart,
        period_end: monthEnd,
        customers: customerEntries,
        total_customers: customerEntries.length,
        billable_customers: billableCount,
        generated_customers: generatedCount,
        missing_setup_customers: missingSetupCount,
        total_amount: totalAmount,
        projected_amount: projectedAmount,
        status_breakdown: statusBreakdown,
      })

      // Nästa månad
      month++
      if (month > 12) {
        month = 1
        year++
      }
    }

    return months
  }

  /**
   * Pipeline-data för merförsäljning (ad-hoc ärenden på avtalskunder).
   * Separat från årspremie-pipelinen — bucketeras på invoice_date, inte
   * billing_period_start, och ignorerar billing_anchor_month/frequency.
   *
   * Grupperingen styrs per kund av customers.adhoc_invoice_grouping:
   * - per_case: en entry per ärende
   * - monthly_batch: en entry per (kund, månad)
   */
  static async getAdhocSalesPipelineData(
    startMonth: string,
    endMonth: string
  ): Promise<AdhocSalesMonth[]> {
    // 1. Hämta alla ad-hoc items inom intervallet via invoice_date
    const [startY, startM] = startMonth.split('-').map(Number)
    const [endY, endM] = endMonth.split('-').map(Number)
    const periodStart = `${startMonth}-01`
    const endLastDay = new Date(endY, endM, 0).getDate()
    const periodEnd = `${endMonth}-${String(endLastDay).padStart(2, '0')}`

    const { data: items, error } = await supabase
      .from('contract_billing_items')
      .select(`
        *,
        customer:customers(id, company_name, organization_number, billing_email, adhoc_invoice_grouping)
      `)
      .eq('item_type', 'ad_hoc')
      .gte('invoice_date', periodStart)
      .lte('invoice_date', periodEnd)
      .order('invoice_date', { ascending: false })

    if (error) throw new Error(`Kunde inte hämta merförsäljningsdata: ${error.message}`)

    const rawItems = (items || []) as Array<ContractBillingItemWithRelations & {
      customer: {
        id: string
        company_name: string
        organization_number: string | null
        billing_email: string | null
        adhoc_invoice_grouping: AdhocInvoiceGrouping
      }
    }>

    // 2. Hämta ärende-metadata för alla unika case_id
    const caseIds = Array.from(new Set(rawItems.map(i => i.case_id).filter(Boolean))) as string[]
    const caseInfo = new Map<string, { id: string; case_number: string | null; title: string | null; completed_date: string | null }>()
    if (caseIds.length > 0) {
      const { data: casesData } = await supabase
        .from('cases')
        .select('id, case_number, title, completed_date')
        .in('id', caseIds)
      for (const c of casesData || []) {
        caseInfo.set(c.id, {
          id: c.id,
          case_number: c.case_number,
          title: c.title,
          completed_date: c.completed_date,
        })
      }
    }

    // 3. Gruppera items per (kund, bucket-nyckel)
    //    bucket-nyckel = case_id (per_case) eller month_key (monthly_batch)
    type BucketGroup = {
      customer_id: string
      customer: AdhocSalesEntry['customer']
      grouping: AdhocInvoiceGrouping
      monthKey: string
      case_id: string | null
      items: ContractBillingItemWithRelations[]
    }
    const groups = new Map<string, BucketGroup>()

    for (const item of rawItems) {
      if (!item.invoice_date) continue
      const monthKey = item.invoice_date.slice(0, 7)
      const grouping = item.customer.adhoc_invoice_grouping ?? 'per_case'
      const bucketId = grouping === 'per_case'
        ? (item.case_id || `no-case-${item.id}`)
        : `${item.customer_id}::${monthKey}`
      const mapKey = `${monthKey}::${item.customer_id}::${bucketId}`

      if (!groups.has(mapKey)) {
        groups.set(mapKey, {
          customer_id: item.customer_id,
          customer: {
            id: item.customer.id,
            company_name: item.customer.company_name,
            organization_number: item.customer.organization_number,
            billing_email: item.customer.billing_email,
          },
          grouping,
          monthKey,
          case_id: grouping === 'per_case' ? item.case_id : null,
          items: [],
        })
      }
      groups.get(mapKey)!.items.push(item)
    }

    // 4. Bygg entries per bucket
    const entriesByMonth = new Map<string, AdhocSalesEntry[]>()
    for (const group of groups.values()) {
      const total = group.items.reduce((sum, i) => sum + Number(i.total_price), 0)
      const earliestInvoiceDate = group.items
        .map(i => i.invoice_date)
        .filter(Boolean)
        .sort()[0] as string
      const entry: AdhocSalesEntry = {
        key: group.grouping === 'per_case' && group.case_id
          ? group.case_id
          : `${group.customer_id}::${group.monthKey}`,
        customer_id: group.customer_id,
        customer: group.customer,
        grouping: group.grouping,
        case: group.case_id ? caseInfo.get(group.case_id) : undefined,
        items: group.items,
        total_amount: total,
        item_count: group.items.length,
        derived_status: deriveInvoiceStatus(group.items),
        has_items_requiring_approval: group.items.some(i => i.requires_approval && i.status === 'pending'),
        invoice_date: earliestInvoiceDate,
      }
      if (!entriesByMonth.has(group.monthKey)) entriesByMonth.set(group.monthKey, [])
      entriesByMonth.get(group.monthKey)!.push(entry)
    }

    // 5. Generera månader inom intervallet, även tomma
    const months: AdhocSalesMonth[] = []
    let year = startY
    let month = startM
    while (`${year}-${String(month).padStart(2, '0')}` <= endMonth) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      const monthLabel = new Date(year, month - 1, 1)
        .toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
      const entries = entriesByMonth.get(monthKey) || []

      const statusBreakdown: Record<ContractBillingItemStatus, number> = {
        pending: 0, approved: 0, draft: 0, booked: 0, sent: 0,
        overdue: 0, invoiced: 0, paid: 0, cancelled: 0,
      }
      let totalAmount = 0
      for (const entry of entries) {
        statusBreakdown[entry.derived_status]++
        totalAmount += entry.total_amount
      }

      entries.sort((a, b) => {
        if (a.invoice_date !== b.invoice_date) return b.invoice_date.localeCompare(a.invoice_date)
        return a.customer.company_name.localeCompare(b.customer.company_name, 'sv')
      })

      months.push({
        month_key: monthKey,
        month_label: monthLabel,
        entries,
        total_amount: totalAmount,
        entry_count: entries.length,
        status_breakdown: statusBreakdown,
      })

      month++
      if (month > 12) { month = 1; year++ }
    }

    return months
  }

  /**
   * Importera historiska fakturor från Fortnox som contract_billing_items
   * OCH som motsvarande invoices + invoice_items.
   *
   * `contract_billing_items` används av period-/aggregeringslogik (contractBilledAccum).
   * `invoices` är auktoritativ källa för UI:t ("Totalt fakturerat", CustomerRevenueModal).
   * Båda tabeller hålls synkade så att importerade kunder syns likadant som fortlöpande.
   */
  static async importHistoricalItems(
    customerId: string,
    invoices: Array<{
      DocumentNumber: string
      Total: number
      Balance: number
      InvoiceDate: string
      FinalPayDate: string | null
      Sent: boolean
      importType: 'contract' | 'ad_hoc'
    }>
  ): Promise<void> {
    if (invoices.length === 0) return

    const normalized = invoices.map(inv => {
      const paid = !!inv.FinalPayDate || inv.Balance === 0
      const [year, month] = inv.InvoiceDate.split('-').map(Number)
      const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0]
      const periodEnd = new Date(year, month, 0).toISOString().split('T')[0]
      return { inv, paid, periodStart, periodEnd }
    })

    // 1) contract_billing_items (legacy period-källa)
    const cbiItems = normalized.map(({ inv, paid, periodStart, periodEnd }) => ({
      customer_id: customerId,
      item_type: inv.importType,
      source: 'manual' as const,
      article_name: inv.importType === 'contract' ? 'Historisk avtalsfaktura' : 'Historisk engångsfaktura',
      quantity: 1,
      unit_price: inv.Total,
      total_price: inv.Total,
      status: paid ? 'paid' : (inv.Sent ? 'invoiced' : 'pending'),
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      invoice_number: inv.DocumentNumber,
      invoiced_at: inv.InvoiceDate,
      paid_at: inv.FinalPayDate ?? null,
    }))

    const { error: cbiErr } = await supabase.from('contract_billing_items').insert(cbiItems)
    if (cbiErr) throw new Error(`Kunde inte importera historiska fakturor: ${cbiErr.message}`)

    // 2) invoices + invoice_items (auktoritativ källa för UI)
    try {
      // Hämta kunddata en gång för att fylla invoice-fälten
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('company_name, organization_number, contact_email, contact_phone, contact_address, billing_email, billing_address')
        .eq('id', customerId)
        .single()
      if (custErr || !customer) throw new Error('Kunden kunde inte hämtas för fakturakonvertering')

      // Skippa rader som redan har en motsvarande invoices-rad (idempotent)
      const docNumbers = normalized.map(n => n.inv.DocumentNumber)
      const { data: existing } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('customer_id', customerId)
        .in('invoice_number', docNumbers.map(n => `F-${n}`))
      const existingSet = new Set((existing || []).map((e: any) => e.invoice_number))

      const toInsert = normalized.filter(n => !existingSet.has(`F-${n.inv.DocumentNumber}`))
      if (toInsert.length === 0) return

      const invoiceRows = toInsert.map(({ inv, paid, periodStart, periodEnd }) => {
        const isoInvDate = new Date(inv.InvoiceDate).toISOString()
        const status = paid ? 'paid' : (inv.Sent ? 'sent' : 'draft')
        return {
          invoice_number: `F-${inv.DocumentNumber}`,
          invoice_type: inv.importType === 'contract' ? 'contract' : 'adhoc',
          customer_id: customerId,
          case_id: null,
          case_type: null,
          customer_name: customer.company_name,
          customer_email: customer.billing_email ?? customer.contact_email,
          customer_phone: customer.contact_phone,
          customer_address: customer.billing_address ?? customer.contact_address,
          organization_number: customer.organization_number,
          subtotal: inv.Total,
          vat_amount: 0,
          total_amount: inv.Total,
          status,
          requires_approval: false,
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          due_date: inv.FinalPayDate ?? inv.InvoiceDate,
          booked_at: isoInvDate,
          sent_at: inv.Sent ? isoInvDate : null,
          paid_at: inv.FinalPayDate ? new Date(inv.FinalPayDate).toISOString() : null,
          is_historical: true,
          notes: `Importerad historisk faktura från Fortnox (${inv.DocumentNumber})`,
          created_at: isoInvDate,
        }
      })

      const { data: insertedInvoices, error: invErr } = await supabase
        .from('invoices')
        .insert(invoiceRows)
        .select('id, invoice_number, subtotal')
      if (invErr) throw new Error(invErr.message)
      if (!insertedInvoices) return

      const invoiceItemRows = insertedInvoices.map((row: any) => ({
        invoice_id: row.id,
        article_code: 'HIST',
        article_name: row.invoice_number.startsWith('F-')
          ? 'Historisk avtalsfaktura (import)'
          : 'Historisk engångsfaktura (import)',
        quantity: 1,
        unit_price: row.subtotal,
        total_price: row.subtotal,
        vat_rate: 0,
        discount_percent: 0,
      }))

      const { error: itemErr } = await supabase.from('invoice_items').insert(invoiceItemRows)
      if (itemErr) throw new Error(itemErr.message)
    } catch (err: any) {
      // Logga men kasta inte — contract_billing_items har redan skrivits och är datakällan
      // för aggregat (contractBilledAccum). Backfill-script kan återskapa invoices senare.
      console.error('[importHistoricalItems] invoices-sync misslyckades:', err?.message || err)
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
