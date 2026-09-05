// src/services/caseBillingService.ts
// Service för hantering av ärendebaserad fakturering (artiklar/tjänster tekniker väljer per ärende)

import { summarizeBillingLines, type MarginContext, type MarginSettings } from '../shared/marginEngine'
import { supabase } from '../lib/supabase'
import type { Article } from '../types/articles'
import type {
  CaseBillingItem,
  CaseBillingItemWithRelations,
  AddCaseArticleInput,
  AddCaseServiceInput,
  UpdateCaseArticleInput,
  ArticleWithEffectivePrice,
  ArticlesByCategory,
  CaseBillingSummary,
  CaseServiceSummary,
  AccumulatedCaseSummary,
  AccumulatedServiceGroup,
  AccumulatedArticleLine,
  BillableCaseType,
  PriceSource,
  CaseBillingItemStatus
} from '../types/caseBilling'
import {
  calculateDiscountedPrice,
  calculateTotalPrice,
  calculateVatAmount,
  calculateRotRutDeduction,
  calculateMarginPercent,
  itemRequiresApproval
} from '../types/caseBilling'
import { PriceListService } from './priceListService'
import { DEFAULT_ROT_PERCENT, DEFAULT_RUT_PERCENT } from '../utils/rotRutConstants'

export class CaseBillingService {
  /**
   * Hämta alla aktiva artiklar med effektivt pris.
   *
   * effective_price är ALLTID inköpspriset (articles.default_price) - det som
   * räknas som intern kostnad i marginalen. Har kunden artikeln i sin prislista
   * (custom_price eller mängdrabatt) läggs det som customer_price bredvid:
   * ett avtalat pris som låser tjänsten artikeln mappas mot och skrivs som
   * specifikation på fakturaraden. Tidigare skrev kundpriset ÖVER inköpspriset
   * här, vilket gjorde att marginalen räknades mot fel siffra.
   */
  static async getArticlesWithPrices(customerId?: string | null, articleGroupId?: string | null): Promise<ArticleWithEffectivePrice[]> {
    // Om articleGroupId anges: hämta artiklar från den gruppen + alltid Arbetstid och Övrigt
    let allowedArticleIds: Set<string> | null = null
    if (articleGroupId) {
      const { data: memberships } = await supabase
        .from('article_group_memberships')
        .select('article_id, group:article_groups!group_id(name)')
        .eq('group_id', articleGroupId)
      const groupArticleIds = (memberships || []).map((m: any) => m.article_id)

      const { data: alwaysGroups } = await supabase
        .from('article_groups')
        .select('id')
        .in('name', ['Arbetstid', 'Övrigt'])
      const alwaysGroupIds = (alwaysGroups || []).map((g: any) => g.id)

      let alwaysArticleIds: string[] = []
      if (alwaysGroupIds.length > 0) {
        const { data: alwaysMemberships } = await supabase
          .from('article_group_memberships')
          .select('article_id')
          .in('group_id', alwaysGroupIds)
        alwaysArticleIds = (alwaysMemberships || []).map((m: any) => m.article_id)
      }

      allowedArticleIds = new Set([...groupArticleIds, ...alwaysArticleIds])
      if (allowedArticleIds.size === 0) return []
    }

    const [articlesResult, customerArticlePrices] = await Promise.all([
      supabase
        .from('articles')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      customerId
        ? PriceListService.getCustomerArticlePrices(customerId)
        : Promise.resolve({} as Record<string, { custom_price: number; quantity_tiers: import('../types/articles').QuantityTier[] | null }>),
    ])

    const { data: articles, error } = articlesResult
    if (error) throw new Error(`Databasfel: ${error.message}`)
    if (!articles || articles.length === 0) return []

    const filteredArticles = allowedArticleIds
      ? articles.filter((a: Article) => allowedArticleIds!.has(a.id))
      : articles

    return filteredArticles.map((article: Article) => {
      const cp = customerArticlePrices[article.id]
      if (cp) {
        // Kunden har avtalspris på artikeln. Använd första tier eller custom_price.
        const hasTiers = !!(cp.quantity_tiers && cp.quantity_tiers.length > 0)
        const basePrice = hasTiers
          ? [...cp.quantity_tiers!].sort((a, b) => a.min_qty - b.min_qty)[0].unit_price
          : cp.custom_price
        return {
          article,
          effective_price: article.default_price,
          customer_price: basePrice,
          price_source: 'customer_list' as PriceSource,
          quantity_tiers: hasTiers ? cp.quantity_tiers : null,
        }
      }
      return {
        article,
        effective_price: article.default_price,
        price_source: 'standard' as PriceSource,
      }
    })
  }

  /**
   * Hämta artiklar grupperade per kategori
   */
  static async getArticlesByCategory(customerId?: string | null): Promise<ArticlesByCategory[]> {
    const articles = await this.getArticlesWithPrices(customerId)

    // Gruppera per kategori
    const grouped = articles.reduce((acc, item) => {
      const category = item.article.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(item)
      return acc
    }, {} as Record<string, ArticleWithEffectivePrice[]>)

    // Konvertera till array
    return Object.entries(grouped).map(([category, items]) => ({
      category: category as Article['category'],
      articles: items
    }))
  }

  /**
   * Hämta effektivt pris för en artikel.
   * Artiklar är interna kostnader — alltid default_price, oavsett kund.
   * customerId-parametern accepteras för bakåtkompatibilitet.
   */
  static async getEffectivePrice(
    articleId: string,
    _customerId?: string | null
  ): Promise<{ price: number; source: PriceSource }> {
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('default_price')
      .eq('id', articleId)
      .maybeSingle()

    if (articleError || !article) throw new Error('Artikel hittades inte')
    return { price: article.default_price, source: 'standard' }
  }

  /**
   * Hämta effektivt pris för en TJÄNST baserat på kund.
   *
   * Returnerar null om ingen kundspecifik prislista har fast pris för
   * tjänsten → anroparen ska då falla tillbaka på services.base_price /
   * prisguide (markup).
   */
  static async getEffectiveServicePrice(
    serviceId: string,
    customerId?: string | null
  ): Promise<{ price: number; source: 'contract_list' | 'customer_list' | 'default' } | null> {
    return PriceListService.getEffectiveServicePrice(serviceId, customerId)
  }

  /**
   * Hämta fasta tjänstepriser för en kund som map {service_id: price}.
   * Används av UI för att visa "Fast pris"-badge + låsa unit_price.
   */
  static async getCustomerServicePrices(customerId: string): Promise<Record<string, number>> {
    return PriceListService.getCustomerServicePrices(customerId)
  }

  /**
   * Som ovan men med avtalssteget: prislistan på kundradens täckande avtal
   * (contracts.price_list_id via ägarskap eller contract_sites) vinner per
   * tjänst, kundens prislista fyller ut. Används av ärendeflödet.
   */
  static async getServicePricesForCase(customerId: string, contractId?: string | null): Promise<Record<string, number>> {
    return PriceListService.getServicePricesForCase(customerId, contractId)
  }

  /**
   * Lägg till artikel till ärende
   */
  static async addArticleToCase(input: AddCaseArticleInput): Promise<CaseBillingItem> {
    const quantity = input.quantity ?? 1
    const discountPercent = input.discount_percent ?? 0
    const vatRate = input.vat_rate ?? 25

    // Beräkna priser
    const discountedPrice = calculateDiscountedPrice(input.unit_price, discountPercent)
    const totalPrice = calculateTotalPrice(discountedPrice, quantity)

    const { data, error } = await supabase
      .from('case_billing_items')
      .insert({
        case_id: input.case_id,
        case_type: input.case_type,
        customer_id: input.customer_id || null,
        article_id: input.article_id,
        article_code: input.article_code || null,
        article_name: input.article_name,
        quantity,
        unit_price: input.unit_price,
        discount_percent: discountPercent,
        discounted_price: discountedPrice,
        total_price: totalPrice,
        vat_rate: vatRate,
        price_source: input.price_source || 'standard',
        added_by_technician_id: input.added_by_technician_id || null,
        added_by_technician_name: input.added_by_technician_name || null,
        status: 'pending',
        requires_approval: itemRequiresApproval(discountPercent),
        notes: input.notes || null,
        customer_unit_price: input.customer_unit_price ?? null
      })
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Uppdatera case billing item
   */
  /**
   * Avtalstillägg: markera/avmarkera en tjänsterad som tillägg till avtalet.
   * Vid markering sätts radens pris till pro rata-beloppet (antal 1, ingen
   * rabatt) - det är vad som faktureras nu. Årsbeloppet appliceras på
   * premien först när ärendet avslutas (apply_contract_addition-RPC:n).
   */
  static async setContractAddition(
    id: string,
    annualAmount: number | null,
    proratedUnitPrice?: number
  ): Promise<void> {
    const update: Record<string, unknown> = { contract_addition_annual: annualAmount }
    if (annualAmount !== null && proratedUnitPrice !== undefined) {
      update.quantity = 1
      update.discount_percent = 0
      update.unit_price = proratedUnitPrice
      update.discounted_price = proratedUnitPrice
      update.total_price = proratedUnitPrice
      // Pro rata är inte en rabatt - raden betalar för återstående tid,
      // inte ett sänkt pris, och ska inte fastna i rabattgodkännandet
      update.requires_approval = false
      update.discount_motivation = null
    }
    const { data, error } = await supabase
      .from('case_billing_items')
      .update(update)
      .eq('id', id)
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Raden kunde inte uppdateras')
  }

  /**
   * Spara teknikerns motivering till en rabatt. Krävs vid ärendeavslut för
   * alla rader med discount_percent > 0 (avtalstilläggsrader undantagna).
   */
  static async setDiscountMotivation(id: string, motivation: string | null): Promise<void> {
    const { error } = await supabase
      .from('case_billing_items')
      .update({ discount_motivation: motivation?.trim() || null })
      .eq('id', id)
    if (error) throw error
  }

  /**
   * Rabattrader som saknar motivering för ett ärende - används som spärr
   * vid ärendeavslut. Avtalstilläggsrader räknas inte som rabatt.
   */
  /**
   * Artikelrader med kundpris (avtalat pris) som inte är mappade mot någon
   * tjänsterad. Spärr vid avslut och fakturering: annars försvinner det
   * avtalade materialet tyst som intern kostnad i stället för att faktureras.
   */
  static async getUnmappedCustomerPricedArticles(caseId: string): Promise<
    { id: string; name: string; quantity: number }[]
  > {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select('id, article_name, quantity')
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .eq('item_type', 'article')
      .not('customer_unit_price', 'is', null)
      .is('mapped_service_id', null)
    if (error) throw error
    return (data || []).map(r => ({ id: r.id, name: r.article_name, quantity: Number(r.quantity) }))
  }

  static async getUnmotivatedDiscountItems(caseId: string): Promise<
    { id: string; name: string; discount_percent: number }[]
  > {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select('id, article_name, service_name, discount_percent, discount_motivation, contract_addition_annual')
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .gt('discount_percent', 0)
    if (error) throw error
    return (data || [])
      .filter(r => r.contract_addition_annual == null && !r.discount_motivation?.trim())
      .map(r => ({
        id: r.id,
        name: r.service_name || r.article_name,
        discount_percent: Number(r.discount_percent),
      }))
  }

  static async updateCaseArticle(
    id: string,
    input: UpdateCaseArticleInput
  ): Promise<CaseBillingItem> {
    // Hämta befintlig post först
    const { data: existing, error: fetchError } = await supabase
      .from('case_billing_items')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      throw new Error('Post hittades inte')
    }

    const minQuantity = input.min_quantity !== undefined ? input.min_quantity : existing.min_quantity
    const rawQuantity = input.quantity ?? existing.quantity
    const quantity = minQuantity ? Math.max(rawQuantity, minQuantity) : rawQuantity
    const discountPercent = input.discount_percent ?? existing.discount_percent

    // Beräkna nya priser
    const discountedPrice = calculateDiscountedPrice(existing.unit_price, discountPercent)
    const totalPrice = calculateTotalPrice(discountedPrice, quantity)

    const { data, error } = await supabase
      .from('case_billing_items')
      .update({
        quantity,
        min_quantity: minQuantity,
        discount_percent: discountPercent,
        discounted_price: discountedPrice,
        total_price: totalPrice,
        requires_approval: itemRequiresApproval(discountPercent),
        notes: input.notes !== undefined ? input.notes : existing.notes,
        rot_rut_type: input.rot_rut_type !== undefined ? input.rot_rut_type : existing.rot_rut_type,
        fastighetsbeteckning: input.fastighetsbeteckning !== undefined ? input.fastighetsbeteckning : existing.fastighetsbeteckning,
        mapped_service_id: input.mapped_service_id !== undefined ? input.mapped_service_id : existing.mapped_service_id,
        customer_unit_price: input.customer_unit_price !== undefined ? input.customer_unit_price : existing.customer_unit_price,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Batch-uppdatera artikel→tjänst-mappningar (från Prisguiden).
   * assignments: { [articleItemId]: serviceItemId | null }
   */
  static async updateArticleMappings(
    assignments: Record<string, string | null>
  ): Promise<void> {
    const entries = Object.entries(assignments)
    if (entries.length === 0) return

    const updates = entries.map(([id, mapped_service_id]) =>
      supabase
        .from('case_billing_items')
        .update({ mapped_service_id, updated_at: new Date().toISOString() })
        .eq('id', id)
    )
    const results = await Promise.all(updates)
    const firstError = results.find(r => r.error)?.error
    if (firstError) throw new Error(`Databasfel: ${firstError.message}`)
  }

  /**
   * Ta bort case billing item
   */
  static async removeCaseArticle(id: string): Promise<void> {
    // Koppla loss från eventuella invoice_items först (FK-constraint)
    await supabase
      .from('invoice_items')
      .update({ case_billing_item_id: null })
      .eq('case_billing_item_id', id)

    const { error } = await supabase
      .from('case_billing_items')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Lägg till tjänst (fakturarad) till ärende
   */
  static async addServiceToCase(input: AddCaseServiceInput): Promise<CaseBillingItem> {
    const quantity = input.quantity ?? 1
    const discountPercent = input.discount_percent ?? 0
    const vatRate = input.vat_rate ?? 25

    const discountedPrice = calculateDiscountedPrice(input.unit_price, discountPercent)
    const totalPrice = calculateTotalPrice(discountedPrice, quantity)

    const { data, error } = await supabase
      .from('case_billing_items')
      .insert({
        case_id: input.case_id,
        case_type: input.case_type,
        customer_id: input.customer_id || null,
        item_type: 'service',
        service_id: input.service_id,
        service_code: input.service_code || null,
        service_name: input.service_name,
        // article-fält lämnas null för tjänstrader
        article_id: null,
        article_code: null,
        article_name: input.service_name, // används för bakåtkompatibilitet
        quantity,
        unit_price: input.unit_price,
        discount_percent: discountPercent,
        discounted_price: discountedPrice,
        total_price: totalPrice,
        vat_rate: vatRate,
        price_source: 'standard',
        added_by_technician_id: input.added_by_technician_id || null,
        added_by_technician_name: input.added_by_technician_name || null,
        status: 'pending',
        requires_approval: itemRequiresApproval(discountPercent),
        notes: input.notes || null,
        covered_by_contract: input.covered_by_contract ?? false
      })
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Hämta billing items för ett ärende.
   * Default: bara 'pending'-items (ej fakturerade). Skicka 'all' för att få allt.
   * Det förhindrar att redan fakturerade rader (status='billed') råkar inkluderas
   * vid nästa fakturering.
   */
  static async getCaseBillingItems(
    caseId: string,
    caseType: BillableCaseType,
    status: CaseBillingItemStatus | 'all' = 'pending'
  ): Promise<CaseBillingItemWithRelations[]> {
    let query = supabase
      .from('case_billing_items')
      .select(`
        *,
        article:articles(*),
        service:services(*)
      `)
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .order('created_at', { ascending: true })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (data || []) as CaseBillingItemWithRelations[]
  }

  /**
   * Hämta summering uppdelad per tjänster (fakturarader) och artiklar (kalkyl)
   */
  static async getCaseServiceSummary(
    caseId: string,
    caseType: BillableCaseType,
    minMarginPercent: number = 20,
    opts: {
      /** Avtal: löpande marginal är huvudtal. Ärende (default): år 1. */
      context?: MarginContext
      /** Avtal: årsintäkt från annual_value + tilläggsrader i stället för radsumman */
      revenueOverride?: number | null
      /** Avtal: planerade besök per år, för arbetstidsspärren */
      visitsPerYear?: number | null
      settings?: MarginSettings | null
    } = {}
  ): Promise<CaseServiceSummary> {
    const items = await this.getCaseBillingItems(caseId, caseType, 'all')
    return this.summarizeItems(items, minMarginPercent, opts)
  }

  /**
   * Avtalets marginal med rätt intäktsbas. Premieraden på avtalet är ofta
   * 0 kr eller avviker från avtalet (var sjätte aktivt avtal), så årsintäkten
   * hämtas från contracts.annual_value plus tilläggsraderna i § 6. Används av
   * § 5 på avtalskartan och kundkortets sidopanel, så de visar samma tal.
   */
  static async getContractMarginSummary(
    contractId: string,
    minMarginPercent: number = 20,
    settings?: MarginSettings | null
  ): Promise<CaseServiceSummary> {
    const [{ data: contract }, items] = await Promise.all([
      supabase.from('contracts').select('annual_value, visits_per_year').eq('id', contractId).maybeSingle(),
      this.getCaseBillingItems(contractId, 'contract', 'all'),
    ])
    const annual = Number((contract as { annual_value?: number | string | null } | null)?.annual_value ?? 0)
    const visits = Number((contract as { visits_per_year?: number | null } | null)?.visits_per_year ?? 0)
    let extra = 0
    for (const i of items) {
      if (i.item_type !== 'service' || i.status === 'cancelled') continue
      const model = (i as unknown as { billing_model?: string | null }).billing_model
      const t = Number(i.total_price || 0)
      if (model === 'per_year') extra += t
      else if (model === 'per_month') extra += t * 12
      else if (model === 'per_round') extra += t * visits
    }
    return this.summarizeItems(items, minMarginPercent, {
      context: 'contract',
      revenueOverride: annual > 0 ? annual + extra : null,
      visitsPerYear: visits,
      settings: settings ?? null,
    })
  }

  /** Summering av redan hämtade rader. Ren funktion, ingen databas. */
  static summarizeItems(
    items: CaseBillingItemWithRelations[],
    minMarginPercent: number = 20,
    opts: {
      context?: MarginContext
      revenueOverride?: number | null
      visitsPerYear?: number | null
      settings?: MarginSettings | null
    } = {}
  ): CaseServiceSummary {
    const serviceItems = items.filter(i => i.item_type === 'service')
    const articleItems = items.filter(i => i.item_type === 'article')

    const serviceSubtotal = serviceItems.reduce((sum, i) => sum + i.total_price, 0)
    const serviceVat = serviceItems.reduce((sum, i) => sum + calculateVatAmount(i.total_price, i.vat_rate), 0)
    const purchaseCost = articleItems.reduce((sum, i) => sum + i.total_price, 0)

    // All marginal går genom motorn. margin_percent förblir år 1 (mot hela
    // inköpet) tills alla vyer läser breakdown; margin_ok bedömer huvudtalet.
    const breakdown = summarizeBillingLines(items, {
      context: opts.context ?? 'case',
      revenueOverride: opts.revenueOverride ?? null,
      visitsPerYear: opts.visitsPerYear ?? null,
      settings: opts.settings ?? null,
    })
    const headline = breakdown.headline_percent

    return {
      services: {
        service_count: serviceItems.length,
        subtotal: serviceSubtotal,
        vat_amount: serviceVat,
        total_amount: serviceSubtotal + serviceVat,
      },
      articles: {
        article_count: articleItems.length,
        total_purchase_cost: purchaseCost,
      },
      margin_percent: breakdown.margin_percent_year1,
      margin_ok: headline === null || headline >= minMarginPercent,
      breakdown,
    }
  }

  /**
   * Ackumulerat utfall över flera ärendens faktureringsrader — § 5 på
   * avropsavtal i Avtalskartan. Samma beräkningsregler som per-ärende-
   * summeringen ovan: tjänsterader = intäkt, artikelrader = intern kostnad.
   *
   * Källan är enbart case_billing_items, så ärenden från gamla systemet
   * (prissatta via ClickUp-fältet, utan rader) bidrar med noll — avsiktligt.
   * Ingen filtrering på case_type: rader på avtalskunders ärenden är märkta
   * 'contract' av modellskäl (CHECK-constrainten saknar eget värde för dem).
   */
  static async getAccumulatedSummaryForCases(caseIds: string[]): Promise<AccumulatedCaseSummary> {
    const empty: AccumulatedCaseSummary = {
      case_count: 0, groups: [], unmapped_articles: [], revenue: 0, cost: 0, margin_percent: null,
      breakdown: summarizeBillingLines([], { context: 'contract' }),
    }
    const unique = Array.from(new Set(caseIds.filter(Boolean)))
    if (unique.length === 0) return empty

    type Row = {
      id: string
      case_id: string
      item_type: 'service' | 'article'
      service_name: string | null
      article_name: string | null
      quantity: number | null
      total_price: number | null
      mapped_service_id: string | null
      status: string | null
      article: { is_durable: boolean | null; category: string | null } | null
    }
    const rows: Row[] = []
    for (let i = 0; i < unique.length; i += 150) {
      const { data, error } = await supabase
        .from('case_billing_items')
        .select('id, case_id, item_type, service_name, article_name, quantity, total_price, mapped_service_id, status, article:articles(is_durable, category)')
        .in('case_id', unique.slice(i, i + 150))
        .neq('status', 'cancelled')
      if (error) throw new Error(`Databasfel: ${error.message}`)
      // Supabase typar många-till-en-relationen som array; den är ett objekt i praktiken
      rows.push(...((data ?? []) as unknown as Row[]))
    }
    if (rows.length === 0) return empty

    // Tjänsteradens id → gruppnamn, så artiklar (mapped_service_id) hamnar
    // under rätt tjänst även när samma tjänst förekommer i många ärenden
    const groupNameByServiceRow = new Map<string, string>()
    const groups = new Map<string, AccumulatedServiceGroup>()
    // Raderna per grupp behålls så motorn kan räkna gruppens uppdelning
    const rowsByGroup = new Map<string, Row[]>()
    const emptyBreakdown = () => summarizeBillingLines([], { context: 'contract' })
    for (const r of rows) {
      if (r.item_type !== 'service') continue
      const name = r.service_name || r.article_name || 'Tjänst utan namn'
      groupNameByServiceRow.set(r.id, name)
      const g = groups.get(name) ?? {
        service_name: name, occurrences: 0, revenue: 0, articles: [], cost: 0, margin_percent: null,
        breakdown: emptyBreakdown(),
      }
      g.occurrences += Number(r.quantity ?? 1)
      g.revenue += Number(r.total_price ?? 0)
      groups.set(name, g)
      rowsByGroup.set(name, [...(rowsByGroup.get(name) ?? []), r])
    }

    const addArticle = (list: AccumulatedArticleLine[], r: Row) => {
      const name = r.article_name || 'Artikel utan namn'
      const line = list.find((a) => a.article_name === name)
      const qty = Number(r.quantity ?? 1)
      const cost = Number(r.total_price ?? 0)
      if (line) {
        line.quantity += qty
        line.cost += cost
      } else {
        list.push({ article_name: name, quantity: qty, cost, is_durable: r.article?.is_durable === true })
      }
    }

    const unmapped: AccumulatedArticleLine[] = []
    for (const r of rows) {
      if (r.item_type !== 'article') continue
      const groupName = r.mapped_service_id ? groupNameByServiceRow.get(r.mapped_service_id) : undefined
      if (groupName) {
        const g = groups.get(groupName)!
        addArticle(g.articles, r)
        g.cost += Number(r.total_price ?? 0)
        rowsByGroup.set(groupName, [...(rowsByGroup.get(groupName) ?? []), r])
      } else {
        addArticle(unmapped, r)
      }
    }

    const sorted = Array.from(groups.values()).sort((a, b) => b.revenue - a.revenue)
    for (const g of sorted) {
      g.breakdown = summarizeBillingLines(rowsByGroup.get(g.service_name) ?? [], { context: 'contract' })
      g.margin_percent = g.breakdown.margin_percent_year1
    }
    const breakdown = summarizeBillingLines(rows, { context: 'contract' })

    return {
      case_count: new Set(rows.map((r) => r.case_id)).size,
      groups: sorted,
      unmapped_articles: unmapped,
      revenue: breakdown.revenue,
      cost: breakdown.cost_total,
      margin_percent: breakdown.margin_percent_year1,
      breakdown,
    }
  }

  /**
   * Hämta summering för ett ärendes billing items
   */
  static async getCaseBillingSummary(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<CaseBillingSummary> {
    const items = await this.getCaseBillingItems(caseId, caseType, 'all')

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
    const totalDiscount = items.reduce((sum, item) => {
      const fullPrice = item.unit_price * item.quantity
      return sum + (fullPrice - item.total_price)
    }, 0)
    const vatAmount = items.reduce((sum, item) => {
      return sum + calculateVatAmount(item.total_price, item.vat_rate)
    }, 0)
    const requiresApproval = items.some(item => item.requires_approval)
    const rotRutDeduction = items.reduce((sum, item) => {
      if (!item.rot_rut_type) return sum
      // För tjänsterader: använd servicens override om den finns
      if (item.item_type === 'service') {
        const svc = (item as any).service as { rot_rate_percent?: number | null; rut_rate_percent?: number | null } | undefined | null
        const override = item.rot_rut_type === 'ROT'
          ? svc?.rot_rate_percent
          : svc?.rut_rate_percent
        const fallback = item.rot_rut_type === 'ROT' ? DEFAULT_ROT_PERCENT : DEFAULT_RUT_PERCENT
        const rate = (override ?? fallback) / 100
        return sum + item.total_price * rate
      }
      // För artikelrader: behåll befintlig logik (lagstadgad 30/50)
      return sum + calculateRotRutDeduction(item.total_price, item.rot_rut_type)
    }, 0)
    const subcontractorTotal = items.reduce((sum, item) => {
      const article = (item as any).article
      if (article?.category === 'Underentreprenör') return sum + item.total_price
      return sum
    }, 0)

    // Hämta eventuellt anpassat pris
    const override = await this.getCustomPrice(caseId, caseType)

    return {
      item_count: items.length,
      subtotal,
      total_discount: totalDiscount,
      vat_amount: vatAmount,
      total_amount: subtotal + vatAmount,
      requires_approval: requiresApproval,
      rot_rut_deduction: rotRutDeduction,
      subcontractor_total: subcontractorTotal,
      custom_total_price: override
    }
  }

  /**
   * Uppdatera status för alla items i ett ärende
   */
  /**
   * Rader som står som 'billed' utan att ligga på någon levande faktura
   * släpps tillbaka till 'pending'.
   *
   * Bakgrund: createInvoiceFromCase markerar ALLA ärendets rader som billed,
   * och upsertInvoiceFromCase raderar ett oskickat utkast (cascade tar
   * fakturaraderna) utan att återställa dem. Nästa faktura byggdes då bara
   * av rader som tillkommit efteråt: INV-202608-0026 blev 0 kr medan ärendet
   * hade 976 kr i tjänster. Samma sak när en faktura makuleras.
   *
   * Bara privat och företag: avtalsärenden faktureras via
   * contract_billing_items utan länk till raden och ska inte röras här.
   */
  static async releaseOrphanedBilledItems(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<number> {
    if (caseType !== 'private' && caseType !== 'business') return 0

    const { data: billed, error: billedError } = await supabase
      .from('case_billing_items')
      .select('id')
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .eq('status', 'billed')
    if (billedError) throw new Error(`Databasfel: ${billedError.message}`)
    const ids = (billed ?? []).map((r) => r.id as string)
    if (ids.length === 0) return 0

    const { data: live, error: liveError } = await supabase
      .from('invoice_items')
      .select('case_billing_item_id, invoice:invoices!inner(status)')
      .in('case_billing_item_id', ids)
      .neq('invoice.status', 'cancelled')
    if (liveError) throw new Error(`Databasfel: ${liveError.message}`)
    const stillInvoiced = new Set((live ?? []).map((r) => r.case_billing_item_id as string))
    const orphaned = ids.filter((id) => !stillInvoiced.has(id))
    if (orphaned.length === 0) return 0

    const { error } = await supabase
      .from('case_billing_items')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .in('id', orphaned)
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return orphaned.length
  }

  static async updateCaseItemsStatus(
    caseId: string,
    caseType: BillableCaseType,
    status: CaseBillingItemStatus
  ): Promise<void> {
    const { error } = await supabase
      .from('case_billing_items')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('case_id', caseId)
      .eq('case_type', caseType)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Godkänn rabatt för en item
   */
  static async approveDiscount(id: string): Promise<CaseBillingItem> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .update({
        requires_approval: false,
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Hämta items som kräver godkännande
   */
  static async getItemsRequiringApproval(): Promise<CaseBillingItemWithRelations[]> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select(`
        *,
        article:articles(*)
      `)
      .eq('requires_approval', true)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (data || []) as CaseBillingItemWithRelations[]
  }

  /**
   * Validera att alla ROT/RUT-tjänsterader har fastighetsbeteckning.
   * ROT/RUT kräver fastighetsbeteckning (Skatteverket) — ett ärende får inte
   * sparas/faktureras med ROT/RUT om beteckningen saknas.
   *
   * Returnerar listan med tjänstenamn som saknar beteckning (tom = allt OK).
   */
  static async getRotRutItemsMissingFastighet(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select('service_name, article_name, rot_rut_type, fastighetsbeteckning')
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .eq('item_type', 'service')
      .not('rot_rut_type', 'is', null)

    if (error) throw new Error(`Databasfel: ${error.message}`)

    return (data || [])
      .filter(row => !row.fastighetsbeteckning || String(row.fastighetsbeteckning).trim() === '')
      .map(row => row.service_name || row.article_name || 'Tjänst')
  }

  /**
   * Kontrollera om ett ärende har billing items
   */
  static async caseHasBillingItems(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from('case_billing_items')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .eq('status', 'pending')

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (count || 0) > 0
  }

  /**
   * Kontrollera om ett ärende har minst en fakturerbar rad med belopp > 0.
   * Används för att gatea customer-nummertilldelning — ett ärende utan faktiskt
   * belopp (t.ex. inspektion, reklamation, 0-kr-tjänst) ska inte konsumera kundnummer.
   *
   * Följer samma filtrering som invoiceService.createInvoiceFromCase:
   * service-rader om de finns, annars artikel-rader (bakåtkompatibilitet).
   * Om kundspecifikt anpassat pris finns, returnera true om det är > 0.
   */
  static async caseHasBillableAmount(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<boolean> {
    const customPrice = await this.getCustomPrice(caseId, caseType)
    if (customPrice !== null) return customPrice > 0

    const items = await this.getCaseBillingItems(caseId, caseType)
    const services = items.filter(i => i.item_type === 'service')
    const rows = services.length > 0
      ? services
      : items.filter(i => i.item_type === 'article' || !i.item_type)
    return rows.some(r => (r.unit_price ?? 0) * (r.quantity ?? 0) > 0)
  }

  /**
   * Hämta anpassat pris för ärende (eller null)
   */
  static async getCustomPrice(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<number | null> {
    const { data, error } = await supabase
      .from('case_billing_overrides')
      .select('custom_total_price')
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .maybeSingle()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data?.custom_total_price ?? null
  }

  /**
   * Sätt anpassat pris för ärende (upsert)
   */
  static async setCustomPrice(
    caseId: string,
    caseType: BillableCaseType,
    price: number
  ): Promise<void> {
    const { error } = await supabase
      .from('case_billing_overrides')
      .upsert({
        case_id: caseId,
        case_type: caseType,
        custom_total_price: price,
        updated_at: new Date().toISOString()
      }, { onConflict: 'case_id,case_type' })

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Ta bort anpassat pris för ärende
   */
  static async clearCustomPrice(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<void> {
    const { error } = await supabase
      .from('case_billing_overrides')
      .delete()
      .eq('case_id', caseId)
      .eq('case_type', caseType)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }
}
