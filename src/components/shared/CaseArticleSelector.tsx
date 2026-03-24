// src/components/shared/CaseArticleSelector.tsx
// Komponent för tekniker att välja artiklar/tjänster för ett ärende
// Visar fullständig artikelinformation: enhet, beskrivning, paketinfo, ROT/RUT (bara arbetstid)

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Package,
  Search,
  Plus,
  Minus,
  Trash2,
  Percent,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Clock,
  ShieldCheck,
  Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import { CaseBillingService } from '../../services/caseBillingService'
import { InvoiceService } from '../../services/invoiceService'
import { DiscountNotificationService } from '../../services/discountNotificationService'
import type {
  CaseBillingItem,
  CaseBillingItemWithRelations,
  ArticleWithEffectivePrice,
  BillableCaseType,
  CaseBillingSummary,
  RotRutType
} from '../../types/caseBilling'
import { calculateRotRutDeduction, calculateDiscountedPrice, calculateTotalPrice, itemRequiresApproval, ROT_RUT_PERCENT } from '../../types/caseBilling'
import { ARTICLE_CATEGORIES } from '../../types/articles'
import type { ArticleCategory } from '../../types/articles'
import { ARTICLE_CATEGORY_CONFIG, ARTICLE_UNIT_CONFIG, DOSAGE_UNIT_CONFIG, calculatePricePerDosageUnit } from '../../types/articles'

interface CaseArticleSelectorProps {
  caseId?: string
  caseType: BillableCaseType
  customerId?: string | null
  technicianId?: string | null
  technicianName?: string | null
  onChange?: (items: CaseBillingItemWithRelations[], summary: CaseBillingSummary) => void
  readOnly?: boolean
  className?: string
  draftMode?: boolean
}

// Beräkna summering lokalt (för draft mode)
function computeLocalSummary(items: CaseBillingItemWithRelations[], customTotalPrice: number | null): CaseBillingSummary {
  const subtotal = items.reduce((sum, i) => sum + i.total_price, 0)
  const totalDiscount = items.reduce((sum, i) => sum + (i.unit_price * i.quantity - i.total_price), 0)
  const vatAmount = items.reduce((sum, i) => sum + i.total_price * (i.vat_rate / 100), 0)
  const rotRutDeduction = items.reduce((sum, i) => {
    if (i.rot_rut_type) return sum + calculateRotRutDeduction(i.total_price, i.rot_rut_type)
    return sum
  }, 0)
  return {
    item_count: items.length,
    subtotal,
    total_discount: totalDiscount,
    vat_amount: vatAmount,
    total_amount: subtotal + vatAmount,
    requires_approval: items.some(i => i.requires_approval),
    rot_rut_deduction: rotRutDeduction,
    custom_total_price: customTotalPrice
  }
}

const ALL_CATEGORIES = ARTICLE_CATEGORIES

// Förvalda priser inkl. moms för snabbval
const PRESET_PRICES_INCL = [3490, 4490, 5490]

const formatPrice = (price: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)

const formatDosagePrice = (price: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price)

export default function CaseArticleSelector({
  caseId,
  caseType,
  customerId,
  technicianId,
  technicianName,
  onChange,
  readOnly = false,
  className = '',
  draftMode = false
}: CaseArticleSelectorProps) {
  const [articles, setArticles] = useState<ArticleWithEffectivePrice[]>([])
  const [selectedItems, setSelectedItems] = useState<CaseBillingItemWithRelations[]>([])
  const [summary, setSummary] = useState<CaseBillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ArticleCategory | 'all'>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<ArticleCategory>>(new Set(ALL_CATEGORIES))
  const [showArticleList, setShowArticleList] = useState(false)
  const [customPriceEnabled, setCustomPriceEnabled] = useState(false)
  const [customPriceInput, setCustomPriceInput] = useState('')
  const [hasUnsentInvoice, setHasUnsentInvoice] = useState(false)
  const discountTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const dosageTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const fastighetsTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const customPriceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stabil ref för onChange så att den inte triggar re-fetches
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Helper: uppdatera draft items + summary + anropa onChange
  const updateDraftState = useCallback((newItems: CaseBillingItemWithRelations[]) => {
    setSelectedItems(newItems)
    const newSummary = computeLocalSummary(newItems, null)
    setSummary(newSummary)
    onChangeRef.current?.(newItems, newSummary)
  }, [])

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      if (draftMode) {
        // Draft mode: ladda bara artiklar, inga befintliga billing items
        const articlesData = await CaseBillingService.getArticlesWithPrices(customerId)
        setArticles(articlesData)
        // Behåll befintliga selectedItems (reset sker inte vid omladdning i draft)
        const currentSummary = computeLocalSummary(selectedItems, null)
        setSummary(currentSummary)
      } else {
        const [articlesData, itemsData, summaryData] = await Promise.all([
          CaseBillingService.getArticlesWithPrices(customerId),
          CaseBillingService.getCaseBillingItems(caseId!, caseType),
          CaseBillingService.getCaseBillingSummary(caseId!, caseType)
        ])
        setArticles(articlesData)
        setSelectedItems(itemsData)
        setSummary(summaryData)
        if (summaryData.custom_total_price !== null) {
          setCustomPriceEnabled(true)
          setCustomPriceInput(String(Math.round(summaryData.custom_total_price * 1.25)))
        }
        onChangeRef.current?.(itemsData, summaryData)

        // Kolla om det finns en icke-skickad faktura
        try {
          const hasInvoice = await InvoiceService.hasUnsentInvoiceForCase(caseId!, caseType as 'private' | 'business')
          setHasUnsentInvoice(hasInvoice)
        } catch { /* ignorera */ }
      }
    } catch (error) {
      console.error('Kunde inte ladda artikeldata:', error)
      toast.error('Kunde inte ladda artiklar')
    } finally {
      setLoading(false)
    }
  }, [caseId, caseType, customerId, draftMode])

  useEffect(() => {
    loadData(true)
  }, [loadData])

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(discountTimers.current).forEach(clearTimeout)
      Object.values(dosageTimers.current).forEach(clearTimeout)
      Object.values(fastighetsTimers.current).forEach(clearTimeout)
      if (customPriceTimer.current) clearTimeout(customPriceTimer.current)
    }
  }, [])

  // Filtrera artiklar
  const filteredArticles = articles.filter(item => {
    const search = searchTerm.toLowerCase()
    const matchesSearch = !search ||
      item.article.name.toLowerCase().includes(search) ||
      item.article.code.toLowerCase().includes(search) ||
      (item.article.description?.toLowerCase().includes(search) ?? false)
    const matchesCategory = categoryFilter === 'all' || item.article.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Gruppera per kategori
  const articlesByCategory = filteredArticles.reduce((acc, item) => {
    const cat = item.article.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Partial<Record<ArticleCategory, ArticleWithEffectivePrice[]>>)

  const toggleCategory = (category: ArticleCategory) => {
    const next = new Set(expandedCategories)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    setExpandedCategories(next)
  }

  const handleAddArticle = async (articleWithPrice: ArticleWithEffectivePrice) => {
    if (readOnly || saving) return
    const { article } = articleWithPrice
    const isDosage = article.is_dosage_product && article.total_content && article.dosage_unit
    const unitPrice = isDosage
      ? Math.round(calculatePricePerDosageUnit(articleWithPrice.effective_price, article.total_content!) * 100) / 100
      : articleWithPrice.effective_price

    if (draftMode) {
      // Draft mode: skapa lokalt item
      const discountedPrice = calculateDiscountedPrice(unitPrice, 0)
      const totalPrice = calculateTotalPrice(discountedPrice, 1)
      const draftItem: CaseBillingItemWithRelations = {
        id: crypto.randomUUID(),
        case_id: '',
        case_type: caseType,
        customer_id: customerId || null,
        article_id: article.id,
        article_code: article.code,
        article_name: article.name,
        quantity: 1,
        unit_price: unitPrice,
        discount_percent: 0,
        discounted_price: discountedPrice,
        total_price: totalPrice,
        vat_rate: article.vat_rate,
        price_source: articleWithPrice.price_source,
        added_by_technician_id: technicianId || null,
        added_by_technician_name: technicianName || null,
        status: 'pending',
        requires_approval: false,
        notes: null,
        rot_rut_type: null,
        fastighetsbeteckning: null,
        min_quantity: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        article: article
      }
      const newItems = [...selectedItems, draftItem]
      updateDraftState(newItems)
      toast.success(`${article.name} tillagd`)
      return
    }

    setSaving(true)
    try {
      await CaseBillingService.addArticleToCase({
        case_id: caseId!,
        case_type: caseType,
        customer_id: customerId,
        article_id: article.id,
        article_code: article.code,
        article_name: article.name,
        quantity: 1,
        unit_price: unitPrice,
        vat_rate: article.vat_rate,
        price_source: articleWithPrice.price_source,
        added_by_technician_id: technicianId || undefined,
        added_by_technician_name: technicianName || undefined
      })
      toast.success(`${articleWithPrice.article.name} tillagd`)
      await loadData()
    } catch (error) {
      console.error('Kunde inte lägga till artikel:', error)
      toast.error('Kunde inte lägga till artikel')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateQuantity = async (item: CaseBillingItem, delta: number) => {
    if (readOnly || saving) return
    const newQuantity = item.quantity + delta
    const minQty = item.min_quantity || 0.1
    if (newQuantity < minQty) return

    if (draftMode) {
      const newItems = selectedItems.map(i => {
        if (i.id !== item.id) return i
        const dp = calculateDiscountedPrice(i.unit_price, i.discount_percent)
        const tp = calculateTotalPrice(dp, newQuantity)
        return { ...i, quantity: newQuantity, discounted_price: dp, total_price: tp }
      })
      updateDraftState(newItems)
      return
    }

    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(item.id, { quantity: newQuantity })
      await loadData()
    } catch (error) {
      console.error('Kunde inte uppdatera kvantitet:', error)
      toast.error('Kunde inte uppdatera kvantitet')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateDiscount = async (item: CaseBillingItem, discountPercent: number) => {
    if (readOnly || saving) return

    if (draftMode) {
      const newItems = selectedItems.map(i => {
        if (i.id !== item.id) return i
        const dp = calculateDiscountedPrice(i.unit_price, discountPercent)
        const tp = calculateTotalPrice(dp, i.quantity)
        return { ...i, discount_percent: discountPercent, discounted_price: dp, total_price: tp, requires_approval: itemRequiresApproval(discountPercent) }
      })
      updateDraftState(newItems)
      if (discountPercent > 0) toast.success('Rabatt tillagd')
      return
    }

    const hadNoDiscount = item.discount_percent === 0
    const willHaveDiscount = discountPercent > 0
    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(item.id, { discount_percent: discountPercent })
      if (willHaveDiscount) {
        toast.success('Rabatt tillagd - kräver admin-godkännande')
        if (hadNoDiscount) {
          DiscountNotificationService.notifyAdminsOfDiscountRequest({
            caseId: caseId!,
            caseType,
            articleName: item.article_name,
            discountPercent,
            technicianId,
            technicianName
          }).catch(err => console.warn('Kunde inte skicka rabatt-notifikation:', err))
        }
      }
      await loadData()
    } catch (error) {
      console.error('Kunde inte uppdatera rabatt:', error)
      toast.error('Kunde inte uppdatera rabatt')
    } finally {
      setSaving(false)
    }
  }

  // Debounced discount update
  const handleDiscountChange = (item: CaseBillingItem, rawValue: string) => {
    const value = Math.min(100, Math.max(0, parseInt(rawValue) || 0))
    if (discountTimers.current[item.id]) clearTimeout(discountTimers.current[item.id])
    discountTimers.current[item.id] = setTimeout(() => {
      handleUpdateDiscount(item, value)
    }, 600)
  }

  // Debounced dosage amount update
  const handleDosageChange = (item: CaseBillingItem, rawValue: string) => {
    const value = Math.max(0.1, parseFloat(rawValue) || 1)
    if (dosageTimers.current[item.id]) clearTimeout(dosageTimers.current[item.id])
    dosageTimers.current[item.id] = setTimeout(() => {
      handleUpdateQuantity(item, value - item.quantity)
    }, 600)
  }

  // Debounced quantity update (for non-dosage articles)
  const handleQuantityChange = (item: CaseBillingItem, rawValue: string) => {
    const value = Math.max(1, parseInt(rawValue) || 1)
    if (dosageTimers.current[item.id]) clearTimeout(dosageTimers.current[item.id])
    dosageTimers.current[item.id] = setTimeout(() => {
      handleUpdateQuantity(item, value - item.quantity)
    }, 600)
  }

  // ROT/RUT type update
  const handleRotRutChange = async (item: CaseBillingItem, rotRutType: RotRutType | null) => {
    if (readOnly || saving) return

    if (draftMode) {
      const newItems = selectedItems.map(i => {
        if (i.id !== item.id) return i
        return { ...i, rot_rut_type: rotRutType, fastighetsbeteckning: rotRutType ? i.fastighetsbeteckning : null }
      })
      if (rotRutType && customPriceEnabled) {
        setCustomPriceEnabled(false)
        setCustomPriceInput('')
        toast('Anpassat pris avaktiverat — ej tillgängligt med ROT/RUT', { icon: 'ℹ️' })
      }
      updateDraftState(newItems)
      return
    }

    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(item.id, {
        rot_rut_type: rotRutType,
        fastighetsbeteckning: rotRutType ? item.fastighetsbeteckning : null
      })
      if (rotRutType && customPriceEnabled) {
        await CaseBillingService.clearCustomPrice(caseId!, caseType)
        setCustomPriceEnabled(false)
        setCustomPriceInput('')
        toast('Anpassat pris avaktiverat — ej tillgängligt med ROT/RUT', { icon: 'ℹ️' })
      }
      await loadData()
    } catch (error) {
      console.error('Kunde inte uppdatera ROT/RUT:', error)
      toast.error('Kunde inte uppdatera ROT/RUT')
    } finally {
      setSaving(false)
    }
  }

  // Kortare ärende (min. 3 tim) toggle
  const handleMinQuantityToggle = async (item: CaseBillingItem, enabled: boolean) => {
    if (readOnly || saving) return

    if (draftMode) {
      const newItems = selectedItems.map(i => {
        if (i.id !== item.id) return i
        const newQty = enabled ? Math.max(3, i.quantity) : i.quantity
        const dp = calculateDiscountedPrice(i.unit_price, i.discount_percent)
        const tp = calculateTotalPrice(dp, newQty)
        return { ...i, min_quantity: enabled ? 3 : null, quantity: newQty, discounted_price: dp, total_price: tp }
      })
      updateDraftState(newItems)
      return
    }

    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(item.id, {
        min_quantity: enabled ? 3 : null,
        quantity: enabled ? Math.max(3, item.quantity) : item.quantity
      })
      await loadData()
    } catch (error) {
      console.error('Kunde inte uppdatera minimidebitering:', error)
      toast.error('Kunde inte uppdatera minimidebitering')
    } finally {
      setSaving(false)
    }
  }

  // Anpassat pris toggle
  const handleCustomPriceToggle = async (enabled: boolean) => {
    if (readOnly || saving) return
    setCustomPriceEnabled(enabled)
    if (!enabled) {
      if (draftMode) {
        setCustomPriceInput('')
        const newSummary = computeLocalSummary(selectedItems, null)
        setSummary(newSummary)
        onChangeRef.current?.(selectedItems, newSummary)
        return
      }
      setSaving(true)
      try {
        await CaseBillingService.clearCustomPrice(caseId!, caseType)
        setCustomPriceInput('')
        await loadData()
      } catch (error) {
        console.error('Kunde inte ta bort anpassat pris:', error)
      } finally {
        setSaving(false)
      }
    } else if (summary) {
      setCustomPriceInput(String(Math.round(summary.subtotal * 1.25)))
    }
  }

  // Debounced anpassat pris update (input är inkl. moms, sparas exkl.)
  const handleCustomPriceChange = (value: string) => {
    setCustomPriceInput(value)
    if (customPriceTimer.current) clearTimeout(customPriceTimer.current)
    customPriceTimer.current = setTimeout(async () => {
      const priceIncl = parseFloat(value)
      if (!priceIncl || priceIncl <= 0) return
      const price = priceIncl / 1.25
      if (readOnly || saving) return

      if (draftMode) {
        const newSummary = computeLocalSummary(selectedItems, price)
        setSummary(newSummary)
        onChangeRef.current?.(selectedItems, newSummary)
        return
      }

      setSaving(true)
      try {
        await CaseBillingService.setCustomPrice(caseId!, caseType, price)
        await loadData()
      } catch (error) {
        console.error('Kunde inte spara anpassat pris:', error)
      } finally {
        setSaving(false)
      }
    }, 600)
  }

  // Debounced fastighetsbeteckning update
  const handleFastighetsChange = (item: CaseBillingItem, value: string) => {
    if (fastighetsTimers.current[item.id]) clearTimeout(fastighetsTimers.current[item.id])
    fastighetsTimers.current[item.id] = setTimeout(async () => {
      if (readOnly || saving) return

      if (draftMode) {
        const newItems = selectedItems.map(i =>
          i.id === item.id ? { ...i, fastighetsbeteckning: value || null } : i
        )
        updateDraftState(newItems)
        return
      }

      setSaving(true)
      try {
        await CaseBillingService.updateCaseArticle(item.id, { fastighetsbeteckning: value || null })
        setSelectedItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, fastighetsbeteckning: value || null } : i
        ))
      } catch (error) {
        console.error('Kunde inte uppdatera fastighetsbeteckning:', error)
      } finally {
        setSaving(false)
      }
    }, 600)
  }

  const handleRemoveArticle = async (itemId: string) => {
    if (readOnly || saving) return

    if (draftMode) {
      const newItems = selectedItems.filter(i => i.id !== itemId)
      updateDraftState(newItems)
      toast.success('Artikel borttagen')
      return
    }

    setSaving(true)
    try {
      await CaseBillingService.removeCaseArticle(itemId)
      toast.success('Artikel borttagen')
      await loadData()
    } catch (error) {
      console.error('Kunde inte ta bort artikel:', error)
      toast.error('Kunde inte ta bort artikel')
    } finally {
      setSaving(false)
    }
  }

  // Hitta artikeldata för en vald item (för att visa enhet etc.)
  const getArticleForItem = (item: CaseBillingItemWithRelations) => {
    if (item.article) return item.article
    return articles.find(a => a.article.id === item.article_id)?.article ?? null
  }

  if (loading) {
    return (
      <div className={`p-3 bg-slate-800/30 border border-slate-700 rounded-xl ${className}`}>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          <span className="ml-2 text-sm text-slate-400">Laddar artiklar...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-3 bg-slate-800/30 border border-slate-700 rounded-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Package className="w-4 h-4 text-[#20c58f]" />
          <h3 className="text-sm font-semibold text-white">Produkter & tjänster</h3>
          {selectedItems.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-[#20c58f]/20 text-[#20c58f]">
              {selectedItems.length}
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowArticleList(!showArticleList)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#20c58f] hover:bg-[#1bb07e] text-white rounded-lg transition-colors"
          >
            {showArticleList ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {showArticleList ? 'Stäng' : 'Lägg till'}
          </button>
        )}
      </div>

      {/* Info-banner: faktura kopplad till ärendet */}
      {hasUnsentInvoice && !readOnly && !draftMode && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <p className="text-xs text-blue-400">
            Det finns en faktura kopplad till detta ärende. Ändringar här uppdaterar inte fakturan automatiskt.
          </p>
        </div>
      )}

      {/* Artikelväljare (expanderbar) */}
      {showArticleList && !readOnly && (
        <div className="mb-3 p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
          {/* Sökfält */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Sök artikel (namn, kod, beskrivning)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
            />
          </div>

          {/* Kategorifilter */}
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-[#20c58f] text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white'
              }`}
            >
              Alla
            </button>
            {ALL_CATEGORIES.map(cat => {
              const config = ARTICLE_CATEGORY_CONFIG[cat]
              const count = articles.filter(a => a.article.category === cat).length
              if (count === 0) return null
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                    categoryFilter === cat
                      ? 'bg-[#20c58f] text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {config.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Artikellista */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {(Object.keys(articlesByCategory) as ArticleCategory[]).map(category => {
              const items = articlesByCategory[category]
              if (!items || items.length === 0) return null
              const isExpanded = expandedCategories.has(category)
              const config = ARTICLE_CATEGORY_CONFIG[category]

              return (
                <div key={category} className="border border-slate-700/50 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      }
                      <span className={`px-1.5 py-0.5 text-xs rounded ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {items.length} {items.length === 1 ? 'artikel' : 'artiklar'}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-slate-700/30">
                      {items.map(item => {
                        const unit = ARTICLE_UNIT_CONFIG[item.article.unit]
                        const hasPack = item.article.pack_size && item.article.pack_price
                        const showRotRut = item.article.category === 'Arbetstid' &&
                          (item.article.rot_eligible || item.article.rut_eligible)
                        const selectedCount = selectedItems.filter(si => si.article_id === item.article.id).length
                        const isAdded = selectedCount > 0

                        return (
                          <div
                            key={item.article.id}
                            className={`flex items-start justify-between px-3 py-2 transition-colors ${
                              isAdded
                                ? 'bg-[#20c58f]/5 border-l-2 border-[#20c58f]/40'
                                : 'hover:bg-slate-800/20'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm text-white font-medium truncate">
                                  {item.article.name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {item.article.code}
                                </span>
                                {showRotRut && (
                                  <span className="flex items-center gap-0.5 px-1 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400">
                                    <ShieldCheck className="w-3 h-3" />
                                    {item.article.rot_eligible ? 'ROT' : 'RUT'}
                                  </span>
                                )}
                              </div>

                              {item.article.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                  {item.article.description}
                                </p>
                              )}

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {item.article.is_dosage_product && item.article.total_content && item.article.dosage_unit ? (
                                  <>
                                    <span className="text-[#20c58f] text-sm font-medium">
                                      {formatDosagePrice(calculatePricePerDosageUnit(item.effective_price, item.article.total_content))}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      / {DOSAGE_UNIT_CONFIG[item.article.dosage_unit].shortLabel}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      ({formatPrice(item.effective_price)} / {item.article.total_content}{item.article.dosage_unit})
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[#20c58f] text-sm font-medium">
                                      {formatPrice(item.effective_price)}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      / {unit.shortLabel}
                                    </span>
                                  </>
                                )}
                                {hasPack && (
                                  <span className="text-[10px] text-slate-500">
                                    Fp: {item.article.pack_size} st — {formatPrice(item.article.pack_price!)} /fp
                                  </span>
                                )}
                                {item.price_source === 'customer_list' && (
                                  <span className="px-1 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400">
                                    Kundpris
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              {isAdded && (
                                <span className="text-[10px] text-[#20c58f] font-medium">{selectedCount}×</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleAddArticle(item)}
                                disabled={saving}
                                className="p-1.5 text-[#20c58f] hover:bg-[#20c58f]/20 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {Object.keys(articlesByCategory).length === 0 && (
              <div className="text-center py-4 text-sm text-slate-500">
                Inga artiklar matchar sökningen
              </div>
            )}
          </div>
        </div>
      )}

      {/* Valda artiklar */}
      {selectedItems.length === 0 ? (
        <div className="text-center py-4">
          <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-500">Inga artiklar tillagda</p>
          {!readOnly && (
            <p className="text-xs text-slate-600 mt-0.5">Klicka "Lägg till" för att välja produkter & tjänster</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {selectedItems.map(item => {
            const article = getArticleForItem(item)
            const unitLabel = article ? ARTICLE_UNIT_CONFIG[article.unit].shortLabel : 'st'
            const isTimeUnit = article?.unit === 'timme'
            const isDosage = article?.is_dosage_product && article?.total_content && article?.dosage_unit
            const dosageUnitLabel = isDosage ? DOSAGE_UNIT_CONFIG[article.dosage_unit!].shortLabel : null

            return (
              <div
                key={item.id}
                className={`px-3 py-2 rounded-xl border ${
                  item.requires_approval
                    ? 'border-orange-500/50 bg-orange-500/5'
                    : 'border-slate-700/50 bg-slate-800/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Artikelnamn + badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isTimeUnit && <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                      <span className="text-sm text-white font-medium">{item.article_name}</span>
                      {item.article_code && (
                        <span className="text-[10px] text-slate-500 font-mono">{item.article_code}</span>
                      )}
                      {item.price_source === 'customer_list' && (
                        <span className="px-1 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400">
                          Kundpris
                        </span>
                      )}
                      {item.requires_approval && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 text-[10px] rounded bg-orange-500/20 text-orange-400">
                          <AlertCircle className="w-3 h-3" />
                          Kräver godkännande
                        </span>
                      )}
                    </div>

                    {/* Kontroller: kvantitet, pris, rabatt */}
                    <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap">
                      {/* Kvantitet */}
                      <div className="flex items-center gap-0.5">
                        {isDosage && !readOnly ? (
                          <>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              defaultValue={item.quantity}
                              key={`dosage-${item.id}-${item.quantity}`}
                              onChange={(e) => handleDosageChange(item, e.target.value)}
                              disabled={saving}
                              className="w-14 px-1.5 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item, -1)}
                              disabled={saving || item.quantity <= 1}
                              className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item, 1)}
                              disabled={saving}
                              className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs text-slate-500 ml-0.5">{dosageUnitLabel}</span>
                          </>
                        ) : (
                          <>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item, -1)}
                                disabled={saving || item.quantity <= 1}
                                className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {readOnly ? (
                              <span className="w-10 text-center text-white text-sm">{item.quantity}</span>
                            ) : (
                              <input
                                type="number"
                                min="1"
                                step="1"
                                defaultValue={item.quantity}
                                key={`qty-${item.id}-${item.quantity}`}
                                onChange={(e) => handleQuantityChange(item, e.target.value)}
                                disabled={saving}
                                className="w-10 px-1 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                              />
                            )}
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item, 1)}
                                disabled={saving}
                                className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="text-xs text-slate-500 ml-0.5">{unitLabel}</span>
                          </>
                        )}
                      </div>

                      <span className="text-slate-600">×</span>

                      {/* Enhetspris */}
                      <span className="text-sm text-slate-400">
                        {isDosage ? (
                          <>{formatDosagePrice(item.unit_price)}<span className="text-[10px] text-slate-500">/{dosageUnitLabel}</span></>
                        ) : (
                          formatPrice(item.unit_price)
                        )}
                      </span>

                      {/* Rabatt */}
                      {!readOnly && (
                        <div className="flex items-center gap-0.5">
                          <Percent className="w-3.5 h-3.5 text-slate-500" />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={item.discount_percent}
                            onChange={(e) => handleDiscountChange(item, e.target.value)}
                            disabled={saving}
                            className="w-12 px-1.5 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      )}
                      {readOnly && item.discount_percent > 0 && (
                        <span className="text-xs text-orange-400">-{item.discount_percent}%</span>
                      )}
                    </div>

                    {/* Kortare ärende — alla kundtyper, bara arbetstid */}
                    {article && article.category === 'Arbetstid' && (
                      <div className="mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!item.min_quantity}
                            onChange={(e) => handleMinQuantityToggle(item, e.target.checked)}
                            disabled={readOnly || saving}
                            className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                          />
                          <span className="text-xs text-slate-300">Kortare ärende (min. 3 tim)</span>
                          {item.min_quantity && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#20c58f]/20 text-[#20c58f] font-medium">
                              Min. {item.min_quantity} tim
                            </span>
                          )}
                        </label>
                      </div>
                    )}

                    {/* ROT/RUT — bara för privatärenden med arbetstid/avdragsgiltiga artiklar */}
                    {caseType === 'private' && article && (article.category === 'Arbetstid' || article.rot_eligible || article.rut_eligible) && (
                      <div className="mt-2 p-2 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`rot-rut-${item.id}`}
                              checked={!item.rot_rut_type}
                              onChange={() => handleRotRutChange(item, null)}
                              disabled={readOnly || saving}
                              className="text-[#20c58f] focus:ring-[#20c58f]"
                            />
                            <span className="text-xs text-slate-400">Inget avdrag</span>
                          </label>
                          {(article.rot_eligible !== false) && (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`rot-rut-${item.id}`}
                                checked={item.rot_rut_type === 'ROT'}
                                onChange={() => handleRotRutChange(item, 'ROT')}
                                disabled={readOnly || saving}
                                className="text-[#20c58f] focus:ring-[#20c58f]"
                              />
                              <span className="text-xs text-white">ROT ({ROT_RUT_PERCENT.ROT}%)</span>
                            </label>
                          )}
                          {(article.rut_eligible !== false) && (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`rot-rut-${item.id}`}
                                checked={item.rot_rut_type === 'RUT'}
                                onChange={() => handleRotRutChange(item, 'RUT')}
                                disabled={readOnly || saving}
                                className="text-[#20c58f] focus:ring-[#20c58f]"
                              />
                              <span className="text-xs text-white">RUT ({ROT_RUT_PERCENT.RUT}%)</span>
                            </label>
                          )}
                          {item.rot_rut_type && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#20c58f]/20 text-[#20c58f] font-medium">
                              Avdrag: -{formatPrice(calculateRotRutDeduction(item.total_price, item.rot_rut_type))}
                            </span>
                          )}
                        </div>
                        {item.rot_rut_type && (
                          <div className="mt-2">
                            <input
                              type="text"
                              placeholder="Fastighetsbeteckning (t.ex. Lennartsnässundet 3:12)"
                              defaultValue={item.fastighetsbeteckning || ''}
                              key={`fastighet-${item.id}-${item.rot_rut_type}`}
                              onChange={(e) => handleFastighetsChange(item, e.target.value)}
                              disabled={readOnly || saving}
                              className="w-full px-2.5 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Totalpris + ta bort */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-[#20c58f]">
                      {formatPrice(item.total_price)}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveArticle(item.id)}
                        disabled={saving}
                        className="p-1 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Summering */}
      {summary && selectedItems.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-700/50">
          <div className="flex items-end justify-between">
            <div className="text-xs text-slate-500">
              {summary.item_count} {summary.item_count === 1 ? 'artikel' : 'artiklar'}
              {summary.total_discount > 0 && (
                <span className="ml-1.5 text-orange-400">
                  Rabatt: -{formatPrice(summary.total_discount)}
                </span>
              )}
              {summary.rot_rut_deduction > 0 && (
                <span className="ml-1.5 text-[#20c58f]">
                  ROT/RUT: -{formatPrice(summary.rot_rut_deduction)}
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">
                Exkl. moms: {formatPrice(summary.subtotal)}
              </div>
              <div className={`text-sm font-bold ${customPriceEnabled ? 'text-slate-500' : 'text-white'}`}>
                {formatPrice(summary.total_amount)}
                <span className="text-xs font-normal text-slate-500 ml-1">
                  inkl. moms{customPriceEnabled ? ' (föreslaget minimipris)' : ''}
                </span>
              </div>
              {!customPriceEnabled && summary.rot_rut_deduction > 0 && (
                <div className="text-xs text-[#20c58f] font-medium">
                  Att betala: {formatPrice(summary.total_amount - summary.rot_rut_deduction)}
                </div>
              )}
            </div>
          </div>

          {/* Anpassat pris — ej tillgängligt med ROT/RUT */}
          {!readOnly && (() => {
            const hasRotRut = selectedItems.some(i => i.rot_rut_type === 'ROT' || i.rot_rut_type === 'RUT')
            return (
            <div className="mt-2 pt-2 border-t border-slate-700/30">
              <label className={`flex items-center gap-2 ${hasRotRut ? 'opacity-50' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={customPriceEnabled}
                  onChange={(e) => handleCustomPriceToggle(e.target.checked)}
                  disabled={saving || hasRotRut}
                  className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                />
                <span className="text-xs text-slate-300">Anpassat pris</span>
                {hasRotRut && <span className="text-[10px] text-amber-400">Ej tillgängligt med ROT/RUT</span>}
              </label>
              {customPriceEnabled && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-1.5">
                    {PRESET_PRICES_INCL.map((priceIncl) => {
                      const isActive = Math.abs((parseFloat(customPriceInput) || 0) - priceIncl) < 1
                      const isDisabled = priceIncl < ((summary?.subtotal || 0) * 1.25)
                      return (
                        <button
                          key={priceIncl}
                          type="button"
                          disabled={isDisabled || saving}
                          onClick={() => {
                            const inclStr = String(priceIncl)
                            setCustomPriceInput(inclStr)
                            handleCustomPriceChange(inclStr)
                          }}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                            isActive
                              ? 'bg-[#20c58f]/20 border-[#20c58f] text-[#20c58f]'
                              : isDisabled
                                ? 'bg-slate-700/50 border-slate-600/50 text-slate-500 opacity-50 cursor-not-allowed'
                                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {new Intl.NumberFormat('sv-SE').format(priceIncl)} kr
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={Math.round(summary.subtotal * 1.25)}
                    step="1"
                    value={customPriceInput}
                    onChange={(e) => handleCustomPriceChange(e.target.value)}
                    disabled={saving}
                    className="w-28 px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white text-right focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  />
                  <span className="text-xs text-slate-400">kr inkl. moms</span>
                  <div className="flex-1 text-right">
                    {(() => {
                      const cpInkl = parseFloat(customPriceInput) || 0
                      const cpExkl = cpInkl / 1.25
                      const momsAmount = cpInkl - cpExkl
                      const minInkl = summary.subtotal * 1.25
                      const isBelowMin = cpInkl < minInkl
                      return (
                        <>
                          {isBelowMin ? (
                            <div className="text-xs text-orange-400">
                              Priset måste överstiga {formatPrice(minInkl)}
                            </div>
                          ) : (
                            <>
                              <div className="text-xs text-slate-400">
                                {formatPrice(cpExkl)} + {formatPrice(momsAmount)} moms
                              </div>
                              {summary.rot_rut_deduction > 0 && (
                                <div className="text-xs text-[#20c58f] font-medium">
                                  Att betala: {formatPrice(cpInkl - summary.rot_rut_deduction)}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
                </div>
              )}
            </div>
            )
          })()}
          {readOnly && customPriceEnabled && summary.custom_total_price && (
            <div className="mt-2 pt-2 border-t border-slate-700/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Anpassat pris</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-[#20c58f]">
                    {formatPrice(summary.custom_total_price * 1.25)}
                    <span className="text-xs font-normal text-slate-500 ml-1">inkl. moms</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {summary.requires_approval && (
            <div className="mt-1.5 flex items-center gap-1.5 text-orange-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Rabatt kräver admin-godkännande innan fakturering</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
