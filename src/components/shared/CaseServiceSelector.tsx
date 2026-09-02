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
  Calculator,
  Repeat
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
import { getEffectiveRotPercent, getEffectiveRutPercent, calculateRotRutSummary } from '../../utils/rotRutConstants'
import ContractAdditionModal from './ContractAdditionModal'
import type { ServiceWithGroup } from '../../types/services'
import { ARTICLE_CATEGORIES, calculatePricePerDosageUnit, getDosageDisplayUnit, resolveTieredPrice, formatTierSummary } from '../../types/articles'
import type { ArticleCategory, QuantityTier } from '../../types/articles'
import { ARTICLE_CATEGORY_CONFIG } from '../../types/articles'

/**
 * Kundspecifikt artikelpris — `custom_price` används när `quantity_tiers` är null,
 * annars slår tier-priset för matchande min_qty.
 */
type CustomerArticlePrice = { custom_price: number; quantity_tiers: QuantityTier[] | null }
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
  /** Markera tomma fastighetsbeteckning-fält rött (när spara/fakturering blockerats av ROT/RUT-validering) */
  highlightMissingFastighet?: boolean
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
  highlightMissingFastighet = false,
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
  // Map { article_id → { custom_price, quantity_tiers } } — avropsavtal med fasta artikelpriser/mängdrabatt
  const [customerArticlePrices, setCustomerArticlePrices] = useState<Record<string, CustomerArticlePrice>>({})
  const [loading, setLoading] = useState(true)

  // UI state
  const [showArticleList, setShowArticleList] = useState(false)
  const [showAddonPicker, setShowAddonPicker] = useState(false)
  const [searchArticle, setSearchArticle] = useState('')
  const [searchAddon, setSearchAddon] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<ArticleCategory>>(new Set(ARTICLE_CATEGORIES))
  const [showCalculatorPanel, setShowCalculatorPanel] = useState(false)
  const [saving, setSaving] = useState(false)
  // Avtalstillägg-modal (tjänsterad som höjer kundens årspremie)
  const [additionModalItemId, setAdditionModalItemId] = useState<string | null>(null)

  // Prisguide-state som överlever öppna/stäng-cykler
  const [priceAssignments, setPriceAssignments] = useState<Record<string, string>>(
    () => initialPriceAssignments ?? {}
  )
  const [priceMarkups, setPriceMarkups] = useState<Record<string, number>>(
    () => initialPriceMarkups ?? {}
  )
  const [priceRotRutSelections, setPriceRotRutSelections] = useState<Record<string, 'ROT' | 'RUT' | null>>({})


  // "Dela upp för ROT/RUT": vilken tjänsterad formuläret är öppet för + inmatning
  const [splitItemId, setSplitItemId] = useState<string | null>(null)
  const [splitAmount, setSplitAmount] = useState('')
  const [splitType, setSplitType] = useState<'ROT' | 'RUT' | null>(null)

  // Inline price editing (service item id → input string)
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({})
  // Inline fastighetsbeteckning editing (service item id → input string)
  const [editingFastighet, setEditingFastighet] = useState<Record<string, string>>({})
  // Inline rabattmotivering (service item id → input string)
  const [editingMotivation, setEditingMotivation] = useState<Record<string, string>>({})

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const priceAssignmentsRef = useRef(priceAssignments)
  const priceMarkupsRef = useRef(priceMarkups)
  const allItemsRef = useRef<CaseBillingItemWithRelations[]>([])
  // Serialiserar loadData-körningar så parallella anrop inte auto-skapar dubletter
  const inFlightLoadRef = useRef<Promise<void> | null>(null)
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
    // Om en körning redan pågår: vänta på den innan en ny startas, så att
    // efterkommande körningar läser uppdaterad case_billing_items-data.
    if (inFlightLoadRef.current) {
      try { await inFlightLoadRef.current } catch { /* hanterat av tidigare körning */ }
    }

    const run = (async () => {
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

        // Ärendets avtal styr prislistan när kunden har flera avtal på samma
        // enhet. Bara avtalskundernas ärenden (tabellen cases) bär contract_id.
        let caseContractId: string | null = null
        if (caseId && caseType === 'contract') {
          const { data: caseRow } = await supabase
            .from('cases')
            .select('contract_id')
            .eq('id', caseId)
            .maybeSingle()
          caseContractId = (caseRow as { contract_id?: string | null } | null)?.contract_id ?? null
        }

        const [articlesData, itemsData, allServicesData, settingsData, customerPricesData, customerArticlePricesData] = await Promise.all([
          CaseBillingService.getArticlesWithPrices(customerId, resolvedArticleGroupId),
          caseId ? CaseBillingService.getCaseBillingItems(caseId, caseType) : Promise.resolve([]),
          ServiceCatalogService.getAllActiveServices(),
          PricingSettingsService.get(),
          // Avtalssteget: avtalets prislista → kundens prislista (avtalet vinner per tjänst)
          customerId ? PriceListService.getServicePricesForCase(customerId, caseContractId) : Promise.resolve({}),
          customerId ? PriceListService.getCustomerArticlePrices(customerId) : Promise.resolve({}),
        ])
        setPricingSettings(settingsData)
        setArticles(articlesData)
        setAddonServices(allServicesData)
        setCustomerServicePrices(customerPricesData)
        setCustomerArticlePrices(customerArticlePricesData)

        // Hämta primär tjänst
        let svc: ServiceWithGroup | null = null
        if (primaryServiceId) {
          svc = allServicesData.find(s => s.id === primaryServiceId) ?? null
        }

        // Auto-skapa fakturarad för primärtjänsten om den saknas.
        // Dubbel-läsning precis innan INSERT skyddar mot parallella komponentinstanser
        // som kan ha hunnit skapa raden medan vi väntade på andra fetches.
        // OBS: existenskollen MÅSTE läsa 'all' — en redan fakturerad rad
        // (status 'billed', t.ex. efter kontrollrunde-/etableringsavslut) syns
        // inte i pending-läsningen och skulle annars auto-skapas igen →
        // dubbelfaktura vid nästa avslut.
        let finalItems = itemsData
        if (caseId && svc && !itemsData.some(i => i.item_type === 'service' && i.service_id === primaryServiceId)) {
          const allStatusItems = await CaseBillingService.getCaseBillingItems(caseId, caseType, 'all')
          const stillMissing = !allStatusItems.some(
            i => i.item_type === 'service' && i.service_id === primaryServiceId
          )
          const freshItems = allStatusItems.filter(i => i.status === 'pending')
          if (stillMissing) {
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
          } else {
            finalItems = freshItems
          }
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

        // Initialisera ROT/RUT-selections från befintliga tjänsterader
        const initialRotRut: Record<string, 'ROT' | 'RUT' | null> = {}
        finalItems.forEach(item => {
          if (item.item_type === 'service' && item.rot_rut_type) {
            initialRotRut[item.id] = item.rot_rut_type
          }
        })
        setPriceRotRutSelections(prev => ({ ...prev, ...initialRotRut }))

        const summary = buildBillingSummary(finalItems)
        onChangeRef.current?.(finalItems, summary, { priceAssignments: initialAssignments, priceMarkups: {} })
      } catch (err) {
        console.error(err)
        toast.error('Kunde inte ladda data')
      } finally {
        setLoading(false)
      }
    })()

    inFlightLoadRef.current = run
    try {
      await run
    } finally {
      if (inFlightLoadRef.current === run) {
        inFlightLoadRef.current = null
      }
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

  // Arbetstidstjänsten i katalogen (t.ex. "135 Skadedjurstekniker timpris").
  // ROT/RUT-avdrag får bara ligga på sådana tjänster — avdraget beräknas på
  // arbetskostnaden, inte på paketpris där material/preparat ingår.
  const laborService = addonServices.find(s => s.rot_eligible || s.rut_eligible) ?? null

  // Marginalberäkning — räknas ALLTID på exkl.-basen (momsen är aldrig bolagets intäkt).
  // serviceCost = summa av item.total_price som redan är exkl. i DB, så samma formel funkar för privat + företag.
  const serviceCost = serviceItems.reduce((s, i) => s + i.total_price, 0)
  const purchaseCost = articleItems.reduce((s, i) => s + i.total_price, 0)
  const marginPercent = serviceCost > 0 ? calculateMarginPercent(serviceCost, purchaseCost) : null
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
  /**
   * Om artikeln har mängdrabatt i kundens prislista: räkna fram korrekt unit_price
   * för ny kvantitet och skicka med i update-anropet.
   */
  const tierPriceForQty = (articleId: string | null | undefined, qty: number): number | null => {
    if (!articleId) return null
    const cp = customerArticlePrices[articleId]
    if (!cp || !cp.quantity_tiers || cp.quantity_tiers.length === 0) return null
    return resolveTieredPrice(qty, cp.quantity_tiers)
  }

  const handleQuantityChange = async (id: string, delta: number) => {
    if (saving) return
    const item = allItems.find(i => i.id === id)
    if (!item) return
    const isDosage = item.article?.is_dosage_product && item.article?.dosage_unit
    const minQty = isDosage ? 0.1 : 1
    const newQty = Math.max(minQty, item.quantity + delta)
    const tierPrice = tierPriceForQty(item.article_id, newQty)
    if (draftMode && !caseId) {
      const patch: Partial<CaseBillingItemWithRelations> = { quantity: newQty }
      if (tierPrice != null) patch.unit_price = tierPrice
      updateDraftItem(id, patch)
      return
    }
    if (!caseId) return
    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(id, { quantity: newQty })
      if (tierPrice != null && tierPrice !== item.unit_price) {
        await supabase
          .from('case_billing_items')
          .update({ unit_price: tierPrice, updated_at: new Date().toISOString() })
          .eq('id', id)
      }
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
    const tierPrice = tierPriceForQty(item.article_id, newQty)
    if (draftMode && !caseId) {
      const patch: Partial<CaseBillingItemWithRelations> = { quantity: newQty }
      if (tierPrice != null) patch.unit_price = tierPrice
      updateDraftItem(id, patch)
      return
    }
    if (!caseId) return
    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(id, { quantity: newQty })
      if (tierPrice != null && tierPrice !== item.unit_price) {
        await supabase
          .from('case_billing_items')
          .update({ unit_price: tierPrice, updated_at: new Date().toISOString() })
          .eq('id', id)
      }
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

  // ──────────────────────────────────────────────────────────────
  // "Dela upp för ROT/RUT": flytta arbetskostnaden från en paketprisad
  // tjänsterad till en egen arbetstidsrad som bär avdraget.
  // Totalen mot kund är oförändrad — bara fördelningen ändras.
  // ──────────────────────────────────────────────────────────────
  const openSplitForm = (item: CaseBillingItemWithRelations) => {
    // Föreslå arbetskostnad: timmar från mappade Arbetstid-artiklar × timpris (om känt)
    const mappedArticles = articleItems.filter(a =>
      priceAssignments[a.id] === item.id || a.mapped_service_id === item.id
    )
    const hours = mappedArticles
      .filter(a => a.article?.category === 'Arbetstid')
      .reduce((s, a) => s + a.quantity, 0)
    let suggested = ''
    if (laborService && hours > 0) {
      const hourPrice = customerServicePrices[laborService.id] ?? laborService.base_price
      if (hourPrice != null && hourPrice > 0) {
        const suggestedTotal = Math.min(hours * hourPrice, item.total_price) * priceMultiplier
        suggested = String(Math.round(suggestedTotal))
      }
    }
    setSplitAmount(suggested)
    // Förvälj avdragstyp bara när arbetstjänsten är berättigad för exakt en typ
    setSplitType(
      laborService?.rot_eligible && !laborService?.rut_eligible ? 'ROT'
        : laborService?.rut_eligible && !laborService?.rot_eligible ? 'RUT'
        : null
    )
    setSplitItemId(item.id)
  }

  const closeSplitForm = () => {
    setSplitItemId(null)
    setSplitAmount('')
    setSplitType(null)
  }

  const handleConfirmSplit = async (item: CaseBillingItemWithRelations) => {
    if (saving || !laborService) return
    const raw = parseFloat(splitAmount.replace(',', '.'))
    if (isNaN(raw) || raw <= 0) {
      toast.error('Ange arbetskostnaden i kronor')
      return
    }
    if (!splitType) {
      toast.error('Välj ROT eller RUT')
      return
    }
    // Privat: input är inkl. moms → räkna om till exkl. (lagringsformatet)
    const laborExkl = raw / priceMultiplier
    if (laborExkl > item.total_price + 0.01) {
      toast.error('Arbetskostnaden kan inte överstiga radens pris')
      return
    }

    // Timmar från mappade Arbetstid-artiklar styr antalet på arbetsraden
    const mappedArticles = articleItems.filter(a =>
      priceAssignments[a.id] === item.id || a.mapped_service_id === item.id
    )
    const laborHours = mappedArticles
      .filter(a => a.article?.category === 'Arbetstid')
      .reduce((s, a) => s + a.quantity, 0)
    const hours = laborHours > 0 ? laborHours : 1

    const laborUnit = Math.round((laborExkl / hours) * 100) / 100
    const laborDiscounted = calculateDiscountedPrice(laborUnit, 0)
    const laborTotal = calculateTotalPrice(laborDiscounted, hours)

    // Huvudraden sänks med arbetsdelen (kompenserat för ev. rabatt så totalen stämmer)
    const remainingTotal = Math.max(0, item.total_price - laborTotal)
    const discFactor = 1 - (item.discount_percent || 0) / 100
    const newMainUnit = discFactor > 0
      ? Math.round((remainingTotal / item.quantity / discFactor) * 100) / 100
      : 0

    if (draftMode && !caseId) {
      const laborRow: CaseBillingItemWithRelations = {
        id: crypto.randomUUID(),
        case_id: '',
        case_type: caseType,
        customer_id: customerId ?? null,
        article_id: null,
        article_code: null,
        article_name: laborService.name,
        service_id: laborService.id,
        service_code: laborService.code ?? null,
        service_name: laborService.name,
        item_type: 'service',
        quantity: hours,
        unit_price: laborUnit,
        discount_percent: 0,
        discounted_price: laborDiscounted,
        total_price: laborTotal,
        vat_rate: 25,
        price_source: 'standard',
        added_by_technician_id: technicianId ?? null,
        added_by_technician_name: technicianName ?? null,
        status: 'pending',
        requires_approval: false,
        notes: null,
        rot_rut_type: splitType,
        fastighetsbeteckning: item.fastighetsbeteckning ?? null,
        min_quantity: null,
        mapped_service_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        service: laborService,
      }
      const updated = allItems.map(i => {
        if (i.id !== item.id) return i
        const merged = { ...i, unit_price: newMainUnit, rot_rut_type: null, fastighetsbeteckning: null }
        merged.discounted_price = calculateDiscountedPrice(merged.unit_price, merged.discount_percent)
        merged.total_price = calculateTotalPrice(merged.discounted_price, merged.quantity)
        return merged
      })
      updated.push(laborRow)
      setAllItems(updated)
      notifyChange(updated)
      closeSplitForm()
      toast.success(`Arbetskostnaden flyttad till ${laborService.name} (${splitType})`)
      return
    }

    if (!caseId) return
    setSaving(true)
    try {
      const mainDiscounted = calculateDiscountedPrice(newMainUnit, item.discount_percent)
      const mainTotal = calculateTotalPrice(mainDiscounted, item.quantity)
      await supabase
        .from('case_billing_items')
        .update({
          unit_price: newMainUnit,
          discounted_price: mainDiscounted,
          total_price: mainTotal,
          rot_rut_type: null,
          fastighetsbeteckning: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
      const created = await CaseBillingService.addServiceToCase({
        case_id: caseId,
        case_type: caseType,
        customer_id: customerId,
        service_id: laborService.id,
        service_code: laborService.code,
        service_name: laborService.name,
        quantity: hours,
        unit_price: laborUnit,
        vat_rate: 25,
        added_by_technician_id: technicianId || undefined,
        added_by_technician_name: technicianName || undefined,
      })
      await CaseBillingService.updateCaseArticle(created.id, {
        rot_rut_type: splitType,
        fastighetsbeteckning: item.fastighetsbeteckning ?? null,
      })
      await reloadItems()
      closeSplitForm()
      toast.success(`Arbetskostnaden flyttad till ${laborService.name} (${splitType})`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleFastighetBlur = async (id: string) => {
    const draft = editingFastighet[id]
    if (draft === undefined) return
    const value = draft.trim()
    const item = allItems.find(i => i.id === id)
    setEditingFastighet(prev => { const n = { ...prev }; delete n[id]; return n })
    if (!item) return
    const newValue = value || null
    if ((item.fastighetsbeteckning ?? null) === newValue) return
    if (draftMode && !caseId) {
      const updated = allItems.map(i => i.id === id ? { ...i, fastighetsbeteckning: newValue } : i)
      setAllItems(updated)
      notifyChange(updated)
      return
    }
    if (!caseId) return
    try {
      await CaseBillingService.updateCaseArticle(id, { fastighetsbeteckning: newValue })
      await reloadItems()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Rabattmotivering (krävs vid ärendeavslut för rabatterade rader)
  // ──────────────────────────────────────────────────────────────
  const handleMotivationBlur = async (id: string) => {
    const draft = editingMotivation[id]
    if (draft === undefined) return
    setEditingMotivation(prev => { const n = { ...prev }; delete n[id]; return n })
    const item = allItems.find(i => i.id === id)
    if (!item) return
    const newValue = draft.trim() || null
    if ((item.discount_motivation ?? null) === newValue) return
    if (draftMode && !caseId) {
      // Draft-läge: håll motiveringen i state - den persisteras när raden skapas
      const updated = allItems.map(i => i.id === id ? { ...i, discount_motivation: newValue } : i)
      setAllItems(updated)
      notifyChange(updated)
      return
    }
    if (!caseId) return
    try {
      await CaseBillingService.setDiscountMotivation(id, newValue)
      const updated = allItems.map(i => i.id === id ? { ...i, discount_motivation: newValue } : i)
      setAllItems(updated)
      notifyChange(updated)
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
  // Avtalstillägg: markera/avmarkera tjänsterad som avtalshöjning
  // ──────────────────────────────────────────────────────────────
  const handleConfirmAddition = async (annualAmount: number, proratedAmount: number) => {
    if (!additionModalItemId) return
    try {
      await CaseBillingService.setContractAddition(additionModalItemId, annualAmount, proratedAmount)
      await reloadItems()
      setAdditionModalItemId(null)
      toast.success('Avtalstillägg markerat - premien höjs när ärendet avslutas')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara avtalstillägget')
    }
  }

  const handleRemoveAddition = async () => {
    if (!additionModalItemId) return
    try {
      await CaseBillingService.setContractAddition(additionModalItemId, null)
      await reloadItems()
      setAdditionModalItemId(null)
      toast.success('Avtalstillägget borttaget - kontrollera radens pris')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ta bort avtalstillägget')
    }
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

    // ROT/RUT-val per tjänsterad: applicera på alla tjänsterader, inte bara de som fick ny prissättning.
    // Anledning: användaren kan ändra avdrag utan att flytta sliders, och vi vill att valet sparas ändå.
    const serviceItemIds = allItems.filter(i => i.item_type === 'service').map(i => i.id)

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
      // Applicera ROT/RUT-val per tjänsterad i draft
      updated = updated.map(i => {
        if (i.item_type !== 'service') return i
        const newType = priceRotRutSelections[i.id] ?? null
        if (i.rot_rut_type === newType) return i
        return {
          ...i,
          rot_rut_type: newType,
          fastighetsbeteckning: newType ? i.fastighetsbeteckning : null,
        }
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
      // Persistera ROT/RUT-val per tjänsterad
      await Promise.all(
        serviceItemIds.map(async (sid) => {
          const item = allItems.find(i => i.id === sid)
          if (!item) return
          const newType = priceRotRutSelections[sid] ?? null
          if (item.rot_rut_type === newType) return
          await supabase
            .from('case_billing_items')
            .update({
              rot_rut_type: newType,
              fastighetsbeteckning: newType ? item.fastighetsbeteckning : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sid)
        })
      )
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
  // Kundens avtalsartiklar (customer_list + ev. tiers) — visas överst i pickern
  const contractArticles = filteredArticles.filter(item => item.price_source === 'customer_list')
  const contractArticleIds = new Set(contractArticles.map(a => a.article.id))
  const nonContractArticles = filteredArticles.filter(item => !contractArticleIds.has(item.article.id))

  const articlesByCategory = nonContractArticles.reduce((acc, item) => {
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
              // ROT/RUT-val visas BARA på tjänster som själva är avdragsberättigade
              // (arbetstidstjänster i katalogen). Avdrag på paketpriser där material
              // ingår blir fel mot Skatteverket — arbetskostnaden delas istället ut
              // till en egen arbetstidsrad via "Dela upp för ROT/RUT" nedan.
              const showRot = !!svc?.rot_eligible
              const showRut = !!svc?.rut_eligible
              // Legacy: avdrag satt på icke-berättigad tjänst — visa så det kan tas bort
              const misplacedDeduction = !!item.rot_rut_type && !showRot && !showRut
              const showRotRut = caseType === 'private' && (showRot || showRut || misplacedDeduction)
              // "Dela upp för ROT/RUT" — bara privatärenden, ej på arbetstidsraden själv,
              // ej på prislistelåsta rader (deras pris får inte ändras här)
              const canSplit = caseType === 'private'
                && !readOnly
                && !showRot && !showRut
                && !!laborService
                && item.service_id !== laborService.id
                && item.total_price > 0
                && !(item.service_id && customerServicePrices[item.service_id] !== undefined)
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
                    {/* Avtalstillägg: endast avtalskundärenden med sparade rader */}
                    {caseType === 'contract' && customerId && caseId && !draftMode && (
                      item.contract_addition_annual != null ? (
                        <button
                          type="button"
                          onClick={() => setAdditionModalItemId(item.id)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-medium hover:bg-emerald-500/30 transition-colors"
                          title="Raden är markerad som avtalstillägg - klicka för detaljer"
                        >
                          <Repeat className="w-3 h-3" />
                          Avtalstillägg +{Number(item.contract_addition_annual).toLocaleString('sv-SE')} kr/år
                        </button>
                      ) : !readOnly ? (
                        <button
                          type="button"
                          onClick={() => setAdditionModalItemId(item.id)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-700/60 text-slate-400 border border-slate-600 rounded text-[10px] font-medium hover:text-white hover:border-slate-500 transition-colors"
                          title="Lägg till som fast del av kundens avtal (höjer årspremien)"
                        >
                          <Repeat className="w-3 h-3" />
                          Lägg till i avtalet
                        </button>
                      ) : null
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
                          type="text"
                          inputMode="decimal"
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

                  {/* ROT/RUT-val (endast privatärenden + arbetstidstjänster) */}
                  {showRotRut && !readOnly && (
                    <div className="mt-2 p-2 bg-slate-800/30 border border-slate-700/50 rounded-md space-y-1.5">
                      {misplacedDeduction && (
                        <div className="flex items-start gap-1.5 text-xs text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>
                            Avdraget ligger på en tjänst som inte är en arbetstidstjänst.
                            Ta bort det och använd "Dela upp för ROT/RUT" så att avdraget
                            beräknas på arbetskostnaden.
                          </span>
                        </div>
                      )}
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
                        {(showRot || item.rot_rut_type === 'ROT') && (
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
                        {(showRut || item.rot_rut_type === 'RUT') && (
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
                      {item.rot_rut_type && (() => {
                        const fastighetValue = editingFastighet[item.id] ?? item.fastighetsbeteckning ?? ''
                        const isMissing = highlightMissingFastighet && String(fastighetValue).trim() === ''
                        return (
                          <div>
                            <input
                              type="text"
                              value={fastighetValue}
                              onChange={e => setEditingFastighet(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onBlur={() => handleFastighetBlur(item.id)}
                              placeholder="Fastighetsbeteckning *"
                              className={`w-full px-2 py-1 text-xs bg-slate-800 border rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                                isMissing
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-slate-600 focus:ring-[#20c58f]'
                              }`}
                            />
                            {isMissing && (
                              <p className="text-[10px] text-red-400 mt-0.5">
                                Fastighetsbeteckning krävs för ROT/RUT
                              </p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Dela upp för ROT/RUT: flytta arbetskostnaden till en egen arbetstidsrad */}
                  {canSplit && (
                    splitItemId === item.id ? (
                      <div className="mt-2 p-2 bg-slate-800/30 border border-slate-700/50 rounded-md space-y-1.5">
                        <p className="text-xs text-slate-400">
                          ROT/RUT gäller bara arbetskostnaden. Ange hur stor del av priset som är
                          arbete – den flyttas till en egen rad "{laborService!.name}" som bär
                          avdraget. Totalen mot kund ändras inte.
                          {(() => {
                            const h = articleItems
                              .filter(a => (priceAssignments[a.id] === item.id || a.mapped_service_id === item.id) && a.article?.category === 'Arbetstid')
                              .reduce((s, a) => s + a.quantity, 0)
                            return h > 0 ? ` Ärendet har ${h} h arbetstid i interna kostnader.` : ''
                          })()}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoFocus
                              value={splitAmount}
                              onChange={e => setSplitAmount(e.target.value)}
                              placeholder="Arbetskostnad"
                              className="w-28 px-2 py-0.5 text-sm text-right bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                            />
                            <span className="text-xs text-slate-400">kr {isPrivate ? 'inkl. moms' : 'exkl. moms'}</span>
                          </div>
                          {laborService!.rot_eligible && (
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`split-type-${item.id}`}
                                checked={splitType === 'ROT'}
                                onChange={() => setSplitType('ROT')}
                                className="w-3.5 h-3.5 text-[#20c58f] focus:ring-[#20c58f]"
                              />
                              <span className="text-xs text-slate-300">ROT ({getEffectiveRotPercent(laborService)}%)</span>
                            </label>
                          )}
                          {laborService!.rut_eligible && (
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`split-type-${item.id}`}
                                checked={splitType === 'RUT'}
                                onChange={() => setSplitType('RUT')}
                                className="w-3.5 h-3.5 text-[#20c58f] focus:ring-[#20c58f]"
                              />
                              <span className="text-xs text-slate-300">RUT ({getEffectiveRutPercent(laborService)}%)</span>
                            </label>
                          )}
                          <div className="flex items-center gap-2 ml-auto">
                            <button
                              type="button"
                              onClick={() => handleConfirmSplit(item)}
                              disabled={saving}
                              className="px-2.5 py-1 text-xs font-medium bg-[#20c58f] hover:bg-[#1bab7c] text-[#fff] rounded-md transition-colors disabled:opacity-50"
                            >
                              Dela upp
                            </button>
                            <button
                              type="button"
                              onClick={closeSplitForm}
                              className="text-xs text-slate-400 hover:text-white transition-colors"
                            >
                              Avbryt
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSplitForm(item)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        Dela upp för ROT/RUT
                      </button>
                    )
                  )}

                  {/* Rabattmotivering - krävs vid avslut (avtalstilläggsrader undantagna) */}
                  {item.discount_percent > 0 && item.contract_addition_annual == null && (() => {
                    const motivationValue = editingMotivation[item.id] ?? item.discount_motivation ?? ''
                    const isEmpty = String(motivationValue).trim() === ''
                    return (
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Motivering till rabatt (krävs vid avslut)
                        </label>
                        <textarea
                          rows={2}
                          value={motivationValue}
                          onChange={e => setEditingMotivation(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => handleMotivationBlur(item.id)}
                          disabled={readOnly}
                          placeholder="Varför lämnas rabatten? Visas för rabattansvarig."
                          className="w-full px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] resize-none disabled:opacity-60"
                        />
                        {isEmpty && !readOnly && (
                          <p className="flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            Motivering krävs innan ärendet kan avslutas
                          </p>
                        )}
                      </div>
                    )
                  })()}
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
        {serviceItems.length > 0 && (() => {
          const rotRut = isPrivate ? calculateRotRutSummary(serviceItems) : null
          const totalInkl = serviceCost * priceMultiplier
          const showDeduction = isPrivate && rotRut && rotRut.totalDeduction > 0
          const customerAmount = showDeduction ? totalInkl - rotRut!.totalDeduction : totalInkl
          return (
            <div className="border-t border-slate-700/50 mt-3 pt-2 space-y-1">
              {rotRut?.hasConflict && (
                <div className="flex items-start gap-1.5 text-xs text-amber-400 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Ett ärende kan inte ha både ROT och RUT, dela upp detta i separata ärenden.</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{priceLabel}</span>
                <span className="font-semibold text-white">{formatPrice(totalInkl)}</span>
              </div>
              {showDeduction && (
                <>
                  <div className="flex justify-between text-sm text-[#20c58f]">
                    <span>{rotRut!.rotRutType}-avdrag</span>
                    <span>-{formatPrice(rotRut!.totalDeduction)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-slate-700/30">
                    <span className="text-slate-300 font-medium">Att betala (kund)</span>
                    <span className="font-bold text-[#20c58f]">{formatPrice(customerAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Skatteverket ansöker om</span>
                    <span>{formatPrice(rotRut!.totalDeduction)}</span>
                  </div>
                </>
              )}
            </div>
          )
        })()}
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
                  const customerPrice = item.article_id ? customerArticlePrices[item.article_id] : undefined
                  const hasContract = !!customerPrice
                  const hasTiers = !!(customerPrice?.quantity_tiers && customerPrice.quantity_tiers.length > 0)
                  const tierSummary = hasTiers ? formatTierSummary(customerPrice!.quantity_tiers!) : ''
                  return (
                  <div key={item.id} className={`px-3 py-2 rounded-lg border ${hasContract ? 'bg-[#20c58f]/5 border-[#20c58f]/30' : 'bg-slate-800/40 border-slate-700/30'}`}>
                    {/* Namn – alltid full bredd */}
                    <div className="text-sm text-white mb-1.5 flex items-center gap-1.5 flex-wrap">
                      {item.article_code && <span className="text-xs text-slate-500">{item.article_code}</span>}
                      <span>{item.article_name}</span>
                      {isDosage && item.article?.total_content && dosageUnit && (
                        <span className="text-[10px] text-slate-500">
                          ({item.article.total_content}{dosageUnit} / fp)
                        </span>
                      )}
                      {hasContract && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[#20c58f]/20 text-[#20c58f] border border-[#20c58f]/30">
                          Avtalspris
                        </span>
                      )}
                      {hasTiers && (
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-slate-700/60 text-slate-300 border border-slate-600 cursor-help"
                          title={tierSummary}
                        >
                          Mängdrabatt
                        </span>
                      )}
                    </div>
                    {hasTiers && (
                      <div className="text-[10px] text-slate-500 mb-1 truncate" title={tierSummary}>
                        {tierSummary}
                      </div>
                    )}
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
                  {/* Kundens avtalsartiklar överst */}
                  {contractArticles.length > 0 && (
                    <div className="border-b border-slate-700/50 pb-2 mb-1">
                      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-[#20c58f] uppercase tracking-wide">
                        <Package className="w-3 h-3" />
                        Kundens avtalsartiklar ({contractArticles.length})
                      </div>
                      <div className="space-y-0.5 ml-2">
                        {contractArticles.map(item => {
                          const hasTiers = !!(item.quantity_tiers && item.quantity_tiers.length > 0)
                          const tierSummary = hasTiers ? formatTierSummary(item.quantity_tiers!) : ''
                          return (
                            <button
                              type="button"
                              key={item.article.id}
                              onClick={() => handleAddArticle(item)}
                              disabled={saving}
                              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left hover:bg-[#20c58f]/10 border border-[#20c58f]/20 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs text-slate-500">{item.article.code}</span>
                                  <span className="text-sm text-slate-100 truncate">{item.article.name}</span>
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[#20c58f]/20 text-[#20c58f] border border-[#20c58f]/30">
                                    Avtalspris
                                  </span>
                                  {hasTiers && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-slate-700/60 text-slate-300 border border-slate-600 cursor-help"
                                      title={tierSummary}
                                    >
                                      <span>Mängdrabatt</span>
                                    </span>
                                  )}
                                </div>
                                {hasTiers && (
                                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{tierSummary}</div>
                                )}
                              </div>
                              <span className="text-xs text-[#20c58f] font-semibold whitespace-nowrap ml-2">
                                {hasTiers ? `fr. ${formatPrice(item.effective_price)}` : formatPrice(item.effective_price)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

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
          article_id: i.article_id,
          article_name: i.article_name,
          article_code: i.article_code,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
          default_price: i.article?.default_price ?? null,
          rot_eligible: !!i.article?.rot_eligible,
          rut_eligible: !!i.article?.rut_eligible,
        }))}
        customerArticlePrices={customerArticlePrices}
        serviceItems={serviceItems.map(i => {
          const svc = i.service ?? addonServices.find(s => s.id === i.service_id) ?? null
          return {
            id: i.id,
            service_name: i.service_name,
            service_code: i.service_code,
            unit_price: i.unit_price,
            quantity: i.quantity,
            discount_percent: i.discount_percent,
            rot_eligible: !!svc?.rot_eligible,
            rut_eligible: !!svc?.rut_eligible,
            rot_rate_percent: svc?.rot_rate_percent ?? null,
            rut_rate_percent: svc?.rut_rate_percent ?? null,
          }
        })}
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
        rotRutSelections={priceRotRutSelections}
        onRotRutSelectionsChange={setPriceRotRutSelections}
      />

      {/* Avtalstillägg-modal */}
      {additionModalItemId && customerId && (() => {
        const item = serviceItems.find(i => i.id === additionModalItemId)
        if (!item) return null
        return (
          <ContractAdditionModal
            itemId={item.id}
            serviceName={item.service_name || item.article_name || 'Tjänst'}
            customerId={customerId}
            existingAnnual={item.contract_addition_annual != null ? Number(item.contract_addition_annual) : null}
            defaultAnnual={Math.round(item.total_price || item.unit_price || 0)}
            onConfirm={async (annual, quote) => handleConfirmAddition(annual, quote.proratedAmount)}
            onRemove={handleRemoveAddition}
            onClose={() => setAdditionModalItemId(null)}
          />
        )
      })()}
    </div>
  )
}
