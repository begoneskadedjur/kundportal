// src/components/shared/CaseServiceSelector.tsx
// Ny prissättningskalkylator: Tjänster (fakturarader) + Artiklar (intern kalkyl)
//
// Flöde:
//   Sektion A: Tjänsterader (faktura) – välj från tjänsteutbud, sätt pris manuellt
//   Sektion B: Artikel-kalkylator (intern) – inköpspriser för marginalberäkning
//   Marginalindikator baserad på tjänstpris vs inköpskostnad

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ShoppingCart,
  Package,
  Search,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Calculator
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { CaseBillingService } from '../../services/caseBillingService'
import { ServiceCatalogService } from '../../services/servicesCatalogService'
import { PriceListService } from '../../services/priceListService'
import { PricingSettingsService } from '../../services/pricingSettingsService'
import type { PricingSettings } from '../../types/pricingSettings'
import { DEFAULT_PRICING_SETTINGS } from '../../types/pricingSettings'
import type {
  CaseBillingItemWithRelations,
  ArticleWithEffectivePrice,
  BillableCaseType,
  CaseBillingSummary,
  RotRutType,
} from '../../types/caseBilling'
import {
  calculateDiscountedPrice,
  calculateTotalPrice,
  calculateMarginPercent,
  itemRequiresApproval
} from '../../types/caseBilling'
import { getEffectiveRotPercent, getEffectiveRutPercent } from '../../utils/rotRutConstants'
import type { ServiceWithGroup } from '../../types/services'
import { ARTICLE_CATEGORIES, calculatePricePerDosageUnit, getDosageDisplayUnit } from '../../types/articles'
import type { ArticleCategory } from '../../types/articles'
import { ARTICLE_CATEGORY_CONFIG } from '../../types/articles'
import PriceCalculatorPanel from './PriceCalculatorPanel'

interface CaseServiceSelectorProps {
  caseId?: string
  caseType: BillableCaseType
  customerId?: string | null
  technicianId?: string | null
  technicianName?: string | null
  /** Tjänst som ärendet gäller (från case.service_id) – om null kan man välja */
  primaryServiceId?: string | null
  /** Artikelgrupp att filtrera interna kostnader på (Arbetstid + Övrigt visas alltid) */
  articleGroupId?: string | null
  onChange?: (
    items: CaseBillingItemWithRelations[],
    summary: CaseBillingSummary,
    meta?: { priceAssignments: Record<string, string>; priceMarkups: Record<string, number> }
  ) => void
  readOnly?: boolean
  className?: string
  /** Draft-läge: items sparas i lokal state istället för DB (används när inget caseId finns) */
  draftMode?: boolean
  /** För draft-läge: återhämta state från föräldern så att wizard-navigering inte nollställer komponenten */
  initialDraftItems?: CaseBillingItemWithRelations[]
  initialPriceAssignments?: Record<string, string>
  initialPriceMarkups?: Record<string, number>
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)

// Beräkna CaseBillingSummary lokalt (för service-items)
function buildBillingSummary(items: CaseBillingItemWithRelations[]): CaseBillingSummary {
  const serviceItems = items.filter(i => i.item_type === 'service')
  const subtotal = serviceItems.reduce((s, i) => s + i.total_price, 0)
  const vatAmount = serviceItems.reduce((s, i) => s + i.total_price * (i.vat_rate / 100), 0)
  return {
    item_count: serviceItems.length,
    subtotal,
    total_discount: 0,
    vat_amount: vatAmount,
    total_amount: subtotal + vatAmount,
    requires_approval: serviceItems.some(i => i.requires_approval),
    rot_rut_deduction: 0,
    subcontractor_total: 0,
    custom_total_price: null,
  }
}

export default function CaseServiceSelector({
  caseId,
  caseType,
  customerId,
  technicianId,
  technicianName,
  primaryServiceId,
  articleGroupId,
  onChange,
  readOnly = false,
  className = '',
  draftMode = false,
  initialDraftItems,
  initialPriceAssignments,
  initialPriceMarkups,
}: CaseServiceSelectorProps) {
  // All data
  const [allItems, setAllItems] = useState<CaseBillingItemWithRelations[]>(
    () => (draftMode && initialDraftItems ? initialDraftItems : [])
  )
  const [articles, setArticles] = useState<ArticleWithEffectivePrice[]>([])
  const [addonServices, setAddonServices] = useState<ServiceWithGroup[]>([])
  const [resolvedServiceGroupId, setResolvedServiceGroupId] = useState<string | null>(null)
  const [ovrigtServiceGroupId, setOvrigtServiceGroupId] = useState<string | null>(null)
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    id: '', ...DEFAULT_PRICING_SETTINGS, updated_at: ''
  })
  // Map { service_id → fast kundpris } från kundens prislista (tomt om saknas)
  const [customerServicePrices, setCustomerServicePrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // UI state
  const [showArticleList, setShowArticleList] = useState(false)
  const [showAddonPicker, setShowAddonPicker] = useState(false)
  const [searchArticle, setSearchArticle] = useState('')
  const [searchAddon, setSearchAddon] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<ArticleCategory>>(new Set(ARTICLE_CATEGORIES))
  const [showCalculatorPanel, setShowCalculatorPanel] = useState(false)
  const [saving, setSaving] = useState(false)

  // Prisguide-state som överlever öppna/stäng-cykler
  const [priceAssignments, setPriceAssignments] = useState<Record<string, string>>(
    () => initialPriceAssignments ?? {}
  )
  const [priceMarkups, setPriceMarkups] = useState<Record<string, number>>(
    () => initialPriceMarkups ?? {}
  )


  // Inline price editing (service item id → input string)
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({})

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const priceAssignmentsRef = useRef(priceAssignments)
  const priceMarkupsRef = useRef(priceMarkups)
  const allItemsRef = useRef<CaseBillingItemWithRelations[]>([])
  useEffect(() => {
    priceAssignmentsRef.current = priceAssignments
    // Notifiera parent om bara mappning ändras (inte items)
    if (allItemsRef.current.length > 0) {
      const summary = buildBillingSummary(allItemsRef.current)
      onChangeRef.current?.(allItemsRef.current, summary, {
        priceAssignments,
        priceMarkups: priceMarkupsRef.current,
      })
    }
  }, [priceAssignments])
  useEffect(() => {
    priceMarkupsRef.current = priceMarkups
    if (allItemsRef.current.length > 0) {
      const summary = buildBillingSummary(allItemsRef.current)
      onChangeRef.current?.(allItemsRef.current, summary, {
        priceAssignments: priceAssignmentsRef.current,
        priceMarkups,
      })
    }
  }, [priceMarkups])
  useEffect(() => { allItemsRef.current = allItems }, [allItems])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Lös upp service_group_id + artikelgrupp-ID från tjänsten
      let resolvedArticleGroupId = articleGroupId ?? null
      let serviceGroupId: string | null = null
      if (primaryServiceId) {
        const { data: svcRow } = await supabase.from('services').select('group_id').eq('id', primaryServiceId).single()
        if (svcRow?.group_id) {
          serviceGroupId = svcRow.group_id
          if (!resolvedArticleGroupId) {
            const { data: sgRow } = await supabase.from('service_groups').select('name').eq('id', svcRow.group_id).single()
            if (sgRow?.name) {
              const { data: agRow } = await supabase.from('article_groups').select('id').eq('name', sgRow.name).maybeSingle()
              resolvedArticleGroupId = agRow?.id ?? null
            }
          }
        }
      }
      setResolvedServiceGroupId(serviceGroupId)

      // Hämta Övrigt-gruppens ID för att alltid inkludera den i tilläggstjänster
      const { data: ovrigtSgRow } = await supabase
        .from('service_groups').select('id').eq('name', 'Övrigt').maybeSingle()
      setOvrigtServiceGroupId(ovrigtSgRow?.id ?? null)

      const [articlesData, itemsData, allServicesData, settingsData, customerPricesData] = await Promise.all([
        CaseBillingService.getArticlesWithPrices(customerId, resolvedArticleGroupId),
        caseId ? CaseBillingService.getCaseBillingItems(caseId, caseType) : Promise.resolve([]),
        ServiceCatalogService.getAllActiveServices(),
        PricingSettingsService.get(),
        customerId ? PriceListService.getCustomerServicePrices(customerId) : Promise.resolve({}),
      ])
      setPricingSettings(settingsData)
      setArticles(articlesData)
      setAddonServices(allServicesData)
      setCustomerServicePrices(customerPricesData)

      // Hämta primär tjänst
      let svc: ServiceWithGroup | null = null
      if (primaryServiceId) {
        svc = allServicesData.find(s => s.id === primaryServiceId) ?? null
      }

      // Auto-skapa fakturarad för primärtjänsten om den saknas
      let finalItems = itemsData
      if (caseId && svc && !itemsData.some(i => i.item_type === 'service' && i.service_id === primaryServiceId)) {
        // Använd kundens fasta pris om det finns, annars base_price
        const customerPrice = customerPricesData[svc.id]
        const priceToUse = customerPrice !== undefined ? customerPrice : (svc.base_price ?? 0)
        await CaseBillingService.addServiceToCase({
          case_id: caseId,
          case_type: caseType,
          customer_id: customerId,
          service_id: svc.id,
          service_code: svc.code,
          service_name: svc.name,
          quantity: 1,
          unit_price: priceToUse,
          vat_rate: 25,
          added_by_technician_id: technicianId || undefined,
          added_by_technician_name: technicianName || undefined,
        })
        finalItems = await CaseBillingService.getCaseBillingItems(caseId, caseType)
      }

      // I draft-läge utan caseId: behåll befintlig state istället för att nollställa med tom itemsData
      if (draftMode && !caseId) {
        setLoading(false)
        return
      }

      setAllItems(finalItems)

      // Initialisera priceAssignments från DB (mapped_service_id på artikelrader)
      const initialAssignments: Record<string, string> = {}
      finalItems.forEach(item => {
        if (item.item_type === 'article' && item.mapped_service_id) {
          initialAssignments[item.id] = item.mapped_service_id
        }
      })
      setPriceAssignments(prev => {
        // Behåll lokala val som inte finns i DB (draft), men låt DB-värden ha företräde för rader som finns där
        const merged = { ...prev, ...initialAssignments }
        return merged
      })

      const summary = buildBillingSummary(finalItems)
      onChangeRef.current?.(finalItems, summary, { priceAssignments: initialAssignments, priceMarkups: {} })
    } catch (err) {
      console.error(err)
      toast.error('Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }, [caseId, caseType, customerId, primaryServiceId, articleGroupId, technicianId, technicianName, draftMode])

  useEffect(() => { loadData() }, [loadData])

  const serviceItems = allItems.filter(i => i.item_type === 'service')
  const articleItems = allItems.filter(i => i.item_type === 'article')

  // Privat = pris inkl. moms i UI. Företag/avtal = exkl. moms.
  const VAT_RATE = 0.25
  const isPrivate = caseType === 'private'
  const priceMultiplier = isPrivate ? 1 + VAT_RATE : 1
  const priceLabel = isPrivate ? 'Inkl. moms' : 'Exkl. moms'

  // Marginalberäkning (globala inställningar) – för privat räknas mot inkl. så att intäkt/kostnad/marginal matchar visade siffror
  const serviceCost = serviceItems.reduce((s, i) => s + i.total_price, 0)
  const purchaseCost = articleItems.reduce((s, i) => s + i.total_price, 0)
  const serviceRevenueDisplayed = serviceCost * priceMultiplier
  const marginPercent = serviceRevenueDisplayed > 0 ? calculateMarginPercent(serviceRevenueDisplayed, purchaseCost) : null
  const marginOk = marginPercent === null || marginPercent >= pricingSettings.min_margin_percent

  const getMarginColor = () => {
    if (marginPercent === null) return 'text-slate-400'
    if (marginPercent >= pricingSettings.target_margin_percent) return 'text-emerald-400'
    if (marginPercent >= pricingSettings.min_margin_percent) return 'text-yellow-400'
    return 'text-red-400'
  }

  const notifyChange = (items: CaseBillingItemWithRelations[]) => {
    const summary = buildBillingSummary(items)
    onChangeRef.current?.(items, summary, {
      priceAssignments: priceAssignmentsRef.current,
      priceMarkups: priceMarkupsRef.current,
    })
  }

  // ──────────────────────────────────────────────────────────────
  // Draft-helpers: uppdatera lokal state utan DB-anrop
  // ──────────────────────────────────────────────────────────────
  const updateDraftItem = (id: string, updates: Partial<CaseBillingItemWithRelations>) => {
    const updated = allItems.map(i => {
      if (i.id !== id) return i
      const merged = { ...i, ...updates }
      merged.discounted_price = calculateDiscountedPrice(merged.unit_price, merged.discount_percent)
      merged.total_price = calculateTotalPrice(merged.discounted_price, merged.quantity)
      return merged
    })
    setAllItems(updated)
    notifyChange(updated)
  }

  // ──────────────────────────────────────────────────────────────
  // Lägg till TILLÄGGSTJÄNST
  // ──────────────────────────────────────────────────────────────
  const handleAddAddon = async (svc: ServiceWithGroup) => {
    if (saving) return
    // Använd kundens fasta pris om det finns, annars base_price
    const customerPrice = customerServicePrices[svc.id]
    const priceToUse = customerPrice !== undefined ? customerPrice : (svc.base_price ?? 0)
    if (draftMode && !caseId) {
      const price = priceToUse
      const discounted = calculateDiscountedPrice(price, 0)
      const total = calculateTotalPrice(discounted, 1)
      const draftItem: CaseBillingItemWithRelations = {
        id: crypto.randomUUID(),
        case_id: '',
        case_type: caseType,
        customer_id: customerId ?? null,
        article_id: null,
        article_code: null,
        article_name: svc.name,
        service_id: svc.id,
        service_code: svc.code ?? null,
        service_name: svc.name,
        item_type: 'service',
        quantity: 1,
        unit_price: price,
        discount_percent: 0,
        discounted_price: discounted,
        total_price: total,
        vat_rate: 25,
        price_source: 'standard',
        added_by_technician_id: technicianId ?? null,
        added_by_technician_name: technicianName ?? null,
        status: 'pending',
        requires_approval: false,
        notes: null,
        rot_rut_type: null,
        fastighetsbeteckning: null,
        min_quantity: null,
        mapped_service_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        service: svc,
      }
      const updated = [...allItems, draftItem]
      setAllItems(updated)
      notifyChange(updated)
      setShowAddonPicker(false)
      toast.success(`${svc.name} tillagd`)
      return
    }
    if (!caseId) return
    setSaving(true)
    try {
      await CaseBillingService.addServiceToCase({
        case_id: caseId,
        case_type: caseType,
        customer_id: customerId,
        service_id: svc.id,
        service_code: svc.code,
        service_name: svc.name,
        quantity: 1,
        unit_price: priceToUse,
        vat_rate: 25,
        added_by_technician_id: technicianId || undefined,
        added_by_technician_name: technicianName || undefined,
      })
      await reloadItems()
      setShowAddonPicker(false)
      toast.success(`${svc.name} tillagd`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Lägg till ARTIKEL (intern kalkyl)
  // ──────────────────────────────────────────────────────────────
  const handleAddArticle = async (item: ArticleWithEffectivePrice) => {
    if (saving) return
    // Doseringsprodukter: räkna om enhetspris till pris per dosenhet (g/ml/m)
    const isDosage = item.article.is_dosage_product && item.article.total_content && item.article.dosage_unit
    const unitPrice = isDosage
      ? Math.round(calculatePricePerDosageUnit(item.effective_price, item.article.total_content!) * 100) / 100
      : item.effective_price
    // Default-kvantitet: för dosage startar vi på 1 visningsenhet (1 kg / 1 l / 1 m)
    // istället för 1 grundenhet (1 g / 1 ml), så användaren ser ett rimligt värde direkt.
    const defaultQty = isDosage && item.article.dosage_unit
      ? getDosageDisplayUnit(item.article.dosage_unit).factor
      : 1

    if (draftMode && !caseId) {
      const discounted = calculateDiscountedPrice(unitPrice, 0)
      const total = calculateTotalPrice(discounted, defaultQty)
      const draftItem: CaseBillingItemWithRelations = {
        id: crypto.randomUUID(),
        case_id: '',
        case_type: caseType,
        customer_id: customerId ?? null,
        article_id: item.article.id,
        article_code: item.article.code ?? null,
        article_name: item.article.name,
        service_id: null,
        service_code: null,
        service_name: null,
        item_type: 'article',
        quantity: defaultQty,
        unit_price: unitPrice,
        discount_percent: 0,
        discounted_price: discounted,
        total_price: total,
        vat_rate: item.article.vat_rate,
        price_source: item.price_source,
        added_by_technician_id: technicianId ?? null,
        added_by_technician_name: technicianName ?? null,
        status: 'pending',
        requires_approval: false,
        notes: null,
        rot_rut_type: null,
        fastighetsbeteckning: null,
        min_quantity: null,
        mapped_service_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        article: item.article,
      }
      const updated = [...allItems, draftItem]
      setAllItems(updated)
      notifyChange(updated)
      return
    }
    if (!caseId) return
    setSaving(true)
    try {
      await CaseBillingService.addArticleToCase({
        case_id: caseId,
        case_type: caseType,
        customer_id: customerId,
        article_id: item.article.id,
        article_code: item.article.code,
        article_name: item.article.name,
        quantity: defaultQty,
        unit_price: unitPrice,
        vat_rate: item.article.vat_rate,
        price_source: item.price_source,
        added_by_technician_id: technicianId || undefined,
        added_by_technician_name: technicianName || undefined,
      })
      await reloadItems()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Uppdatera antal
  // ──────────────────────────────────────────────────────────────
  const handleQuantityChange = async (id: string, delta: number) => {
    if (saving) return
    const item = allItems.find(i => i.id === id)
    if (!item) return
    const isDosage = item.article?.is_dosage_product && item.article?.dosage_unit
    const minQty = isDosage ? 0.1 : 1
    const newQty = Math.max(minQty, item.quantity + delta)
    if (draftMode && !caseId) {
      updateDraftItem(id, { quantity: newQty })
      return
    }
    if (!caseId) return
    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(id, { quantity: newQty })
      await reloadItems()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleQuantitySet = async (id: string, absoluteQty: number) => {
    if (saving) return
    const item = allItems.find(i => i.id === id)
    if (!item) return
    const isDosage = item.article?.is_dosage_product && item.article?.dosage_unit
    const minQty = isDosage ? 0.1 : 1
    const newQty = Math.max(minQty, absoluteQty)
    if (newQty === item.quantity) return
    if (draftMode && !caseId) {
      updateDraftItem(id, { quantity: newQty })
      return
    }
    if (!caseId) return
    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(id, { quantity: newQty })
      await reloadItems()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Uppdatera pris inline (för tjänsterader)
  // ──────────────────────────────────────────────────────────────
  const handleServicePriceBlur = async (id: string) => {
    if (!caseId && !draftMode) return
    const raw = editingPrice[id]
    if (raw === undefined) return
    const parsed = parseFloat(raw.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) {
      setEditingPrice(prev => { const n = { ...prev }; delete n[id]; return n })
      return
    }
    // Privat: input är inkl. moms → spara exkl.
    const newPrice = isPrivate ? parsed / (1 + VAT_RATE) : parsed
    const item = allItems.find(i => i.id === id)
    if (!item) return
    // Skydd: kundprislista-låsta tjänster får inte ändras här
    if (item.service_id && customerServicePrices[item.service_id] !== undefined) {
      setEditingPrice(prev => { const n = { ...prev }; delete n[id]; return n })
      return
    }
    const discounted = calculateDiscountedPrice(newPrice, item.discount_percent)
    const total = calculateTotalPrice(discounted, item.quantity)
    if (draftMode && !caseId) {
      setEditingPrice(prev => { const n = { ...prev }; delete n[id]; return n })
      updateDraftItem(id, { unit_price: newPrice, discounted_price: discounted, total_price: total })
      return
    }
    setSaving(true)
    try {
      // Uppdatera direkt i DB via raw update (caseBillingService uppdaterar quantity/discount, men vi behöver unit_price)
      await supabase
        .from('case_billing_items')
        .update({
          unit_price: newPrice,
          discounted_price: discounted,
          total_price: total,
          requires_approval: itemRequiresApproval(item.discount_percent),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      setEditingPrice(prev => { const n = { ...prev }; delete n[id]; return n })
      await reloadItems()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Uppdatera ROT/RUT-typ + fastighetsbeteckning för en tjänsterad
  // ──────────────────────────────────────────────────────────────
  const handleRotRutChange = async (id: string, rotRutType: RotRutType | null) => {
    if (saving) return
    if (draftMode && !caseId) {
      const updated = allItems.map(i => {
        if (i.id !== id) return i
        return { ...i, rot_rut_type: rotRutType, fastighetsbeteckning: rotRutType ? i.fastighetsbeteckning : null }
      })
      setAllItems(updated)
      notifyChange(updated)
      return
    }
    if (!caseId) return
    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(id, {
        rot_rut_type: rotRutType,
        fastighetsbeteckning: rotRutType ? (allItems.find(i => i.id === id)?.fastighetsbeteckning ?? null) : null,
      })
      await reloadItems()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleFastighetChange = async (id: string, value: string) => {
    if (saving) return
    if (draftMode && !caseId) {
      const updated = allItems.map(i => i.id === id ? { ...i, fastighetsbeteckning: value || null } : i)
      setAllItems(updated)
      notifyChange(updated)
      return
    }
    if (!caseId) return
    try {
      await CaseBillingService.updateCaseArticle(id, { fastighetsbeteckning: value || null })
      await reloadItems()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Ta bort item
  // ──────────────────────────────────────────────────────────────
  const handleRemove = async (id: string) => {
    if (saving) return
    if (draftMode && !caseId) {
      const updated = allItems.filter(i => i.id !== id)
      setAllItems(updated)
      notifyChange(updated)
      return
    }
    if (!caseId) return
    setSaving(true)
    try {
      await CaseBillingService.removeCaseArticle(id)
      const updated = allItems.filter(i => i.id !== id)
      setAllItems(updated)
      notifyChange(updated)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const reloadItems = async () => {
    if (!caseId) return
    const items = await CaseBillingService.getCaseBillingItems(caseId, caseType)
    setAllItems(items)
    notifyChange(items)
  }

  // ──────────────────────────────────────────────────────────────
  // Prisguide: applicera priser per fakturarad
  // ──────────────────────────────────────────────────────────────
  const handleApplyPrices = async (prices: Record<string, number>) => {
    if (!caseId && !draftMode) return
    // Filtrera bort fast-prissatta tjänster — deras pris styrs av kundens prislista
    const filteredPrices: Record<string, number> = {}
    Object.entries(prices).forEach(([itemId, price]) => {
      const it = allItems.find(i => i.id === itemId)
      if (it?.service_id && customerServicePrices[it.service_id] !== undefined) return
      filteredPrices[itemId] = price
    })
    prices = filteredPrices
    // Bygg mappning-payload: artikel-id → service-id (eller null om ej tilldelad)
    const articleIds = allItems.filter(i => i.item_type === 'article').map(i => i.id)
    const mappingPayload: Record<string, string | null> = {}
    articleIds.forEach(aid => {
      mappingPayload[aid] = priceAssignmentsRef.current[aid] ?? null
    })

    if (draftMode && !caseId) {
      let updated = [...allItems]
      Object.entries(prices).forEach(([itemId, price]) => {
        updated = updated.map(i => {
          if (i.id !== itemId) return i
          const discounted = calculateDiscountedPrice(price, i.discount_percent)
          const total = calculateTotalPrice(discounted, i.quantity)
          return { ...i, unit_price: price, discounted_price: discounted, total_price: total }
        })
      })
      // Applicera mappning även i draft
      updated = updated.map(i => {
        if (i.item_type !== 'article') return i
        return { ...i, mapped_service_id: mappingPayload[i.id] ?? null }
      })
      setAllItems(updated)
      notifyChange(updated)
      toast.success('Priser uppdaterade')
      return
    }
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(prices).map(async ([itemId, price]) => {
          const item = allItems.find(i => i.id === itemId)
          if (!item) return
          const discounted = calculateDiscountedPrice(price, item.discount_percent)
          const total = calculateTotalPrice(discounted, item.quantity)
          await supabase
            .from('case_billing_items')
            .update({
              unit_price: price,
              discounted_price: discounted,
              total_price: total,
              updated_at: new Date().toISOString()
            })
            .eq('id', itemId)
        })
      )
      // Persistera mappning för samtliga artikelrader i samma operation
      await CaseBillingService.updateArticleMappings(mappingPayload)
      await reloadItems()
      toast.success('Priser uppdaterade')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleCategory = (cat: ArticleCategory) => {
    const next = new Set(expandedCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setExpandedCategories(next)
  }

  const filteredArticles = articles.filter(item => {
    const s = searchArticle.toLowerCase()
    return !s
      || item.article.name.toLowerCase().includes(s)
      || item.article.code.toLowerCase().includes(s)
  })
  const articlesByCategory = filteredArticles.reduce((acc, item) => {
    const cat = item.article.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Partial<Record<ArticleCategory, ArticleWithEffectivePrice[]>>)

  // Tilläggstjänster = tjänster från samma servicegrupp + Övrigt-gruppen
  const addedServiceIds = new Set(serviceItems.map(i => i.service_id).filter(Boolean))
  const filteredAddons = addonServices.filter(s => {
    if (addedServiceIds.has(s.id)) return false // redan tillagd
    // Filtrera på servicegrupp: samma grupp som primärtjänsten ELLER Övrigt-gruppen
    if (resolvedServiceGroupId) {
      const inSameGroup = s.group_id === resolvedServiceGroupId
      const inOvrigt = ovrigtServiceGroupId ? s.group_id === ovrigtServiceGroupId : s.group?.name === 'Övrigt'
      if (!inSameGroup && !inOvrigt) return false
    }
    const search = searchAddon.toLowerCase()
    return !search
      || s.name.toLowerCase().includes(search)
      || s.code.toLowerCase().includes(search)
  })

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-[#20c58f]" />
        <span className="ml-2 text-sm text-slate-400">Laddar...</span>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ── A: TJÄNSTERADER (faktura) ── */}
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4 text-[#20c58f]" />
            <span className="text-sm font-semibold text-white">Tjänster & fakturarader</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Marginalindikator */}
            {marginPercent !== null && (
              <div className={`flex items-center gap-1 text-xs font-medium ${getMarginColor()}`}>
                {marginOk
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <AlertTriangle className="w-3.5 h-3.5" />}
                {marginPercent.toFixed(1)}% marginal
              </div>
            )}
            {/* Prisguide-knapp */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowCalculatorPanel(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                <Calculator className="w-3.5 h-3.5" />
                Prisguide
              </button>
            )}
          </div>
        </div>

        {/* Befintliga tjänsterader */}
        {serviceItems.length === 0 ? (
          <p className="text-xs text-slate-500 py-2 text-center">Inga tjänster tillagda än</p>
        ) : (
          <div className="space-y-2 mb-2">
            {serviceItems.map(item => {
              const isEditing = editingPrice[item.id] !== undefined
              const displayUnitPrice = isPrivate ? Math.round(item.unit_price * priceMultiplier) : item.unit_price
              const displayPrice = isEditing ? editingPrice[item.id] : String(displayUnitPrice)
              const svc = item.service ?? addonServices.find(s => s.id === item.service_id) ?? null
              const showRotRut =
                caseType === 'private'
                && !!svc
                && (svc.rot_eligible || svc.rut_eligible)
              const rotPct = getEffectiveRotPercent(svc)
              const rutPct = getEffectiveRutPercent(svc)
              const hasFixedPrice = !!item.service_id && customerServicePrices[item.service_id] !== undefined
              return (
                <div key={item.id} className="p-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  {/* Namn – alltid full bredd */}
                  <div className="text-sm font-medium text-white mb-1.5 flex items-center gap-2 flex-wrap">
                    <span>
                      {item.service_code && (
                        <span className="text-xs text-slate-400 mr-1">{item.service_code}</span>
                      )}
                      {item.service_name || item.article_name}
                    </span>
                    {hasFixedPrice && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#20c58f]/20 text-[#20c58f] rounded text-[10px] font-medium"
                        title="Fast pris från kundens prislista"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Fast pris
                      </span>
                    )}
                  </div>
                  {/* Kontroller på rad 2 */}
                  <div className="flex items-center gap-2">
                    {/* Antal */}
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => handleQuantityChange(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm text-white w-5 text-center">{item.quantity}</span>
                        <button type="button" onClick={() => handleQuantityChange(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {/* Pris */}
                    {readOnly ? (
                      <span className="text-sm font-semibold text-[#20c58f] whitespace-nowrap ml-auto">
                        {formatPrice(item.total_price * priceMultiplier)}
                      </span>
                    ) : hasFixedPrice ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <span
                          className="w-24 px-2 py-0.5 text-sm text-right bg-[#20c58f]/10 border border-[#20c58f]/30 rounded text-[#20c58f] font-medium cursor-not-allowed"
                          title="Fast pris från kundens prislista – kan inte ändras här"
                        >
                          {displayUnitPrice}
                        </span>
                        <span className="text-xs text-slate-400">kr/st</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number"
                          value={displayPrice}
                          onChange={e => setEditingPrice(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onFocus={() => {
                            if (editingPrice[item.id] === undefined)
                              setEditingPrice(prev => ({ ...prev, [item.id]: String(displayUnitPrice) }))
                          }}
                          onBlur={() => handleServicePriceBlur(item.id)}
                          className="w-24 px-2 py-0.5 text-sm text-right bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                        />
                        <span className="text-xs text-slate-400">kr/st</span>
                      </div>
                    )}
                    {!readOnly && (
                      <button type="button" onClick={() => handleRemove(item.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* ROT/RUT-val (endast privatärenden + eligible tjänster) */}
                  {showRotRut && !readOnly && (
                    <div className="mt-2 p-2 bg-slate-800/30 border border-slate-700/50 rounded-md space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`rotrut-${item.id}`}
                            checked={!item.rot_rut_type}
                            onChange={() => handleRotRutChange(item.id, null)}
                            className="w-3.5 h-3.5 text-[#20c58f] focus:ring-[#20c58f]"
                          />
                          <span className="text-xs text-slate-300">Inget avdrag</span>
                        </label>
                        {svc.rot_eligible && (
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`rotrut-${item.id}`}
                              checked={item.rot_rut_type === 'ROT'}
                              onChange={() => handleRotRutChange(item.id, 'ROT')}
                              className="w-3.5 h-3.5 text-[#20c58f] focus:ring-[#20c58f]"
                            />
                            <span className="text-xs text-slate-300">ROT ({rotPct}%)</span>
                          </label>
                        )}
                        {svc.rut_eligible && (
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`rotrut-${item.id}`}
                              checked={item.rot_rut_type === 'RUT'}
                              onChange={() => handleRotRutChange(item.id, 'RUT')}
                              className="w-3.5 h-3.5 text-[#20c58f] focus:ring-[#20c58f]"
                            />
                            <span className="text-xs text-slate-300">RUT ({rutPct}%)</span>
                          </label>
                        )}
                      </div>
                      {item.rot_rut_type && (
                        <input
                          type="text"
                          value={item.fastighetsbeteckning ?? ''}
                          onChange={e => handleFastighetChange(item.id, e.target.value)}
                          placeholder="Fastighetsbeteckning"
                          className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Lägg till tilläggstjänst */}
        {!readOnly && (
          <div className="mt-2">
            {showAddonPicker ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    autoFocus
                    value={searchAddon}
                    onChange={e => setSearchAddon(e.target.value)}
                    placeholder="Sök tilläggstjänst..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredAddons.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-2">Inga tilläggstjänster hittades</p>
                  ) : filteredAddons.map(svc => (
                    <button
                      type="button"
                      key={svc.id}
                      onClick={() => handleAddAddon(svc)}
                      disabled={saving}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-colors text-left"
                    >
                      <div>
                        <span className="text-xs text-slate-400 mr-1">{svc.code}</span>
                        <span className="text-sm text-white">{svc.name}</span>
                      </div>
                      {svc.base_price != null && (
                        <span className="text-xs text-[#20c58f] whitespace-nowrap ml-2">
                          {formatPrice(svc.base_price)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAddonPicker(false); setSearchAddon('') }}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Stäng
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddonPicker(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Lägg till tilläggstjänst
              </button>
            )}
          </div>
        )}

        {/* Summa tjänster */}
        {serviceItems.length > 0 && (
          <div className="border-t border-slate-700/50 mt-3 pt-2 flex justify-between text-sm">
            <span className="text-slate-400">{priceLabel}</span>
            <span className="font-semibold text-white">{formatPrice(serviceCost * priceMultiplier)}</span>
          </div>
        )}
      </div>

      {/* ── B: ARTIKEL-KALKYLATOR (intern) ── */}
      <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
        <button
          type="button"
          onClick={() => setShowArticleList(!showArticleList)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">Interna kostnader</span>
            {articleItems.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                {articleItems.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {purchaseCost > 0 && (
              <span className="text-xs text-slate-400">{formatPrice(purchaseCost)} ink.</span>
            )}
            {showArticleList
              ? <ChevronDown className="w-4 h-4 text-slate-400" />
              : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {showArticleList && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-500">
              Interna kostnader visas <strong>inte</strong> på fakturan – de används bara för att beräkna inköpskostnad och marginal.
            </p>

            {/* Befintliga artikelrader */}
            {articleItems.length > 0 && (
              <div className="space-y-1.5">
                {articleItems.map(item => {
                  const isDosage = !!(item.article?.is_dosage_product && item.article?.dosage_unit)
                  const dosageUnit = item.article?.dosage_unit
                  // Visningsenhet: g → kg, ml → l, m → m. Lagras alltid i grundenheten.
                  const display = isDosage && dosageUnit ? getDosageDisplayUnit(dosageUnit) : null
                  const unitLabel = display ? display.unit : (isDosage ? dosageUnit! : 'st')
                  const displayQty = display ? item.quantity / display.factor : item.quantity
                  return (
                  <div key={item.id} className="px-3 py-2 bg-slate-800/40 border border-slate-700/30 rounded-lg">
                    {/* Namn – alltid full bredd */}
                    <div className="text-sm text-white mb-1.5">
                      {item.article_code && <span className="text-xs text-slate-500 mr-1">{item.article_code}</span>}
                      {item.article_name}
                      {isDosage && item.article?.total_content && dosageUnit && (
                        <span className="text-[10px] text-slate-500 ml-1">
                          ({item.article.total_content}{dosageUnit} / fp)
                        </span>
                      )}
                    </div>
                    {/* Kontroller på rad 2 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.unit_price} kr/{isDosage ? dosageUnit : 'st'}</span>
                      {!readOnly && (
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            type="button"
                            onClick={() => {
                              if (display) {
                                const nextDisplay = Math.max(display.min, +(displayQty - display.step).toFixed(3))
                                handleQuantitySet(item.id, Math.round(nextDisplay * display.factor))
                              } else {
                                handleQuantityChange(item.id, -1)
                              }
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={display ? display.min : 1}
                            step={display ? display.step : 1}
                            value={display ? +displayQty.toFixed(3) : item.quantity}
                            onChange={(e) => {
                              if (display) {
                                const parsed = parseFloat(e.target.value)
                                const displayN = isNaN(parsed) ? display.min : Math.max(display.min, parsed)
                                handleQuantitySet(item.id, Math.round(displayN * display.factor))
                              } else {
                                const parsed = parseInt(e.target.value, 10)
                                const n = Math.max(1, isNaN(parsed) ? 1 : parsed)
                                handleQuantitySet(item.id, n)
                              }
                            }}
                            className="w-16 px-1 py-0.5 text-sm bg-slate-700 border border-slate-600 rounded text-center text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                          />
                          <span className="text-xs text-slate-500">{unitLabel}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (display) {
                                const nextDisplay = +(displayQty + display.step).toFixed(3)
                                handleQuantitySet(item.id, Math.round(nextDisplay * display.factor))
                              } else {
                                handleQuantityChange(item.id, 1)
                              }
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span className="text-sm text-slate-300 whitespace-nowrap">
                        {formatPrice(item.total_price)}
                      </span>
                      {!readOnly && (
                        <button type="button" onClick={() => handleRemove(item.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  )
                })}
                <div className="flex justify-between text-xs text-slate-400 px-1">
                  <span>Total inköpskostnad</span>
                  <span className="font-medium text-slate-300">{formatPrice(purchaseCost)}</span>
                </div>
              </div>
            )}

            {/* Artikelsökning + lägg till */}
            {!readOnly && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={searchArticle}
                    onChange={e => setSearchArticle(e.target.value)}
                    placeholder="Sök artikel..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {ARTICLE_CATEGORIES.filter(cat => articlesByCategory[cat]?.length).map(cat => {
                    const config = ARTICLE_CATEGORY_CONFIG[cat]
                    const catArticles = articlesByCategory[cat] || []
                    const expanded = expandedCategories.has(cat)
                    return (
                      <div key={cat}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-medium text-slate-400 hover:text-white"
                        >
                          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          {config?.label ?? cat} ({catArticles.length})
                        </button>
                        {expanded && (
                          <div className="space-y-0.5 ml-2">
                            {catArticles.map(item => {
                              const isDosage = !!(item.article.is_dosage_product && item.article.total_content && item.article.dosage_unit)
                              const display = isDosage && item.article.dosage_unit ? getDosageDisplayUnit(item.article.dosage_unit) : null
                              // Pris per visningsenhet (t.ex. kr/kg) – mer läsbart än kr/g
                              const displayPrice = isDosage && display
                                ? calculatePricePerDosageUnit(item.effective_price, item.article.total_content!) * display.factor
                                : null
                              return (
                                <button
                                  type="button"
                                  key={item.article.id}
                                  onClick={() => handleAddArticle(item)}
                                  disabled={saving}
                                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left hover:bg-slate-800/60 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs text-slate-500 mr-1">{item.article.code}</span>
                                    <span className="text-sm text-slate-200 truncate">{item.article.name}</span>
                                    {isDosage && (
                                      <span className="text-[10px] text-slate-500 ml-1">
                                        ({item.article.total_content}{item.article.dosage_unit} / fp)
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                                    {isDosage && display
                                      ? `${formatPrice(Math.round(displayPrice!))}/${display.unit}`
                                      : formatPrice(item.effective_price)}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prisguide-panel */}
      <PriceCalculatorPanel
        isOpen={showCalculatorPanel}
        onClose={() => setShowCalculatorPanel(false)}
        caseType={caseType}
        articleItems={articleItems.map(i => ({
          id: i.id,
          article_name: i.article_name,
          article_code: i.article_code,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
        }))}
        serviceItems={serviceItems.map(i => ({
          id: i.id,
          service_name: i.service_name,
          service_code: i.service_code,
          unit_price: i.unit_price,
          quantity: i.quantity,
          discount_percent: i.discount_percent,
        }))}
        fixedPricedItemIds={new Set(
          serviceItems
            .filter(i => !!i.service_id && customerServicePrices[i.service_id] !== undefined)
            .map(i => i.id)
        )}
        assignments={priceAssignments}
        markups={priceMarkups}
        onAssignmentsChange={setPriceAssignments}
        onMarkupsChange={setPriceMarkups}
        onApplyPrices={handleApplyPrices}
      />
    </div>
  )
}
