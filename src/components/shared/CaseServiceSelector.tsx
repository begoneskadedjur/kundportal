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
import { PricingSettingsService } from '../../services/pricingSettingsService'
import type { PricingSettings } from '../../types/pricingSettings'
import { DEFAULT_PRICING_SETTINGS } from '../../types/pricingSettings'
import type {
  CaseBillingItemWithRelations,
  ArticleWithEffectivePrice,
  BillableCaseType,
  CaseBillingSummary,
} from '../../types/caseBilling'
import {
  calculateDiscountedPrice,
  calculateTotalPrice,
  calculateMarginPercent,
  itemRequiresApproval
} from '../../types/caseBilling'
import type { ServiceWithGroup } from '../../types/services'
import { ARTICLE_CATEGORIES } from '../../types/articles'
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
  onChange?: (items: CaseBillingItemWithRelations[], summary: CaseBillingSummary) => void
  readOnly?: boolean
  className?: string
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
}: CaseServiceSelectorProps) {
  // All data
  const [allItems, setAllItems] = useState<CaseBillingItemWithRelations[]>([])
  const [articles, setArticles] = useState<ArticleWithEffectivePrice[]>([])
  const [addonServices, setAddonServices] = useState<ServiceWithGroup[]>([])
  const [resolvedServiceGroupId, setResolvedServiceGroupId] = useState<string | null>(null)
  const [ovrigtServiceGroupId, setOvrigtServiceGroupId] = useState<string | null>(null)
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    id: '', ...DEFAULT_PRICING_SETTINGS, updated_at: ''
  })
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
  const [priceAssignments, setPriceAssignments] = useState<Record<string, string>>({})
  const [priceMarkups, setPriceMarkups] = useState<Record<string, number>>({})


  // Inline price editing (service item id → input string)
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({})

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

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

      const [articlesData, itemsData, allServicesData, settingsData] = await Promise.all([
        CaseBillingService.getArticlesWithPrices(customerId, resolvedArticleGroupId),
        caseId ? CaseBillingService.getCaseBillingItems(caseId, caseType) : Promise.resolve([]),
        ServiceCatalogService.getAllActiveServices(),
        PricingSettingsService.get(),
      ])
      setPricingSettings(settingsData)
      setArticles(articlesData)
      setAddonServices(allServicesData)

      // Hämta primär tjänst
      let svc: ServiceWithGroup | null = null
      if (primaryServiceId) {
        svc = allServicesData.find(s => s.id === primaryServiceId) ?? null
      }

      // Auto-skapa fakturarad för primärtjänsten om den saknas
      let finalItems = itemsData
      if (caseId && svc && !itemsData.some(i => i.item_type === 'service' && i.service_id === primaryServiceId)) {
        await CaseBillingService.addServiceToCase({
          case_id: caseId,
          case_type: caseType,
          customer_id: customerId,
          service_id: svc.id,
          service_code: svc.code,
          service_name: svc.name,
          quantity: 1,
          unit_price: svc.base_price ?? 0,
          vat_rate: 25,
          added_by_technician_id: technicianId || undefined,
          added_by_technician_name: technicianName || undefined,
        })
        finalItems = await CaseBillingService.getCaseBillingItems(caseId, caseType)
      }

      setAllItems(finalItems)
      const summary = buildBillingSummary(finalItems)
      onChangeRef.current?.(finalItems, summary)
    } catch (err) {
      console.error(err)
      toast.error('Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }, [caseId, caseType, customerId, primaryServiceId, articleGroupId, technicianId, technicianName])

  useEffect(() => { loadData() }, [loadData])

  const serviceItems = allItems.filter(i => i.item_type === 'service')
  const articleItems = allItems.filter(i => i.item_type === 'article')

  // Marginalberäkning (globala inställningar)
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
    onChangeRef.current?.(items, summary)
  }

  // ──────────────────────────────────────────────────────────────
  // Lägg till TILLÄGGSTJÄNST
  // ──────────────────────────────────────────────────────────────
  const handleAddAddon = async (svc: ServiceWithGroup) => {
    if (!caseId || saving) return
    setSaving(true)
    try {
      const price = svc.base_price ?? 0
      await CaseBillingService.addServiceToCase({
        case_id: caseId,
        case_type: caseType,
        customer_id: customerId,
        service_id: svc.id,
        service_code: svc.code,
        service_name: svc.name,
        quantity: 1,
        unit_price: price,
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
    if (!caseId || saving) return
    setSaving(true)
    try {
      await CaseBillingService.addArticleToCase({
        case_id: caseId,
        case_type: caseType,
        customer_id: customerId,
        article_id: item.article.id,
        article_code: item.article.code,
        article_name: item.article.name,
        quantity: 1,
        unit_price: item.effective_price,
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
    if (!caseId || saving) return
    const item = allItems.find(i => i.id === id)
    if (!item) return
    const newQty = Math.max(1, item.quantity + delta)
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
    if (!caseId) return
    const raw = editingPrice[id]
    if (raw === undefined) return
    const newPrice = parseFloat(raw.replace(',', '.'))
    if (isNaN(newPrice) || newPrice < 0) {
      setEditingPrice(prev => { const n = { ...prev }; delete n[id]; return n })
      return
    }
    setSaving(true)
    try {
      const item = allItems.find(i => i.id === id)
      if (!item) return
      const discounted = calculateDiscountedPrice(newPrice, item.discount_percent)
      const total = calculateTotalPrice(discounted, item.quantity)
      // Uppdatera direkt i DB via raw update (caseBillingService uppdaterar quantity/discount, men vi behöver unit_price)
      // supabase imported at top
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
  // Ta bort item
  // ──────────────────────────────────────────────────────────────
  const handleRemove = async (id: string) => {
    if (!caseId || saving) return
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
    if (!caseId) return
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
                {marginPercent.toFixed(0)}% marginal
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
              const displayPrice = isEditing ? editingPrice[item.id] : String(item.unit_price)
              return (
                <div key={item.id} className="p-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  {/* Namn – alltid full bredd */}
                  <div className="text-sm font-medium text-white mb-1.5">
                    {item.service_code && (
                      <span className="text-xs text-slate-400 mr-1">{item.service_code}</span>
                    )}
                    {item.service_name || item.article_name}
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
                        {formatPrice(item.total_price)}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number"
                          value={displayPrice}
                          onChange={e => setEditingPrice(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onFocus={() => {
                            if (editingPrice[item.id] === undefined)
                              setEditingPrice(prev => ({ ...prev, [item.id]: String(item.unit_price) }))
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
            <span className="text-slate-400">Exkl. moms</span>
            <span className="font-semibold text-white">{formatPrice(serviceCost)}</span>
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
                {articleItems.map(item => (
                  <div key={item.id} className="px-3 py-2 bg-slate-800/40 border border-slate-700/30 rounded-lg">
                    {/* Namn – alltid full bredd */}
                    <div className="text-sm text-white mb-1.5">
                      {item.article_code && <span className="text-xs text-slate-500 mr-1">{item.article_code}</span>}
                      {item.article_name}
                    </div>
                    {/* Kontroller på rad 2 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.unit_price} kr/st</span>
                      {!readOnly && (
                        <div className="flex items-center gap-1 ml-auto">
                          <button type="button" onClick={() => handleQuantityChange(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm text-white w-5 text-center">{item.quantity}</span>
                          <button type="button" onClick={() => handleQuantityChange(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
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
                ))}
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
                            {catArticles.map(item => (
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
                                </div>
                                <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                                  {formatPrice(item.effective_price)}
                                </span>
                              </button>
                            ))}
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
        assignments={priceAssignments}
        markups={priceMarkups}
        onAssignmentsChange={setPriceAssignments}
        onMarkupsChange={setPriceMarkups}
        onApplyPrices={handleApplyPrices}
      />
    </div>
  )
}
