// src/components/shared/CaseArticleSelector.tsx
// Komponent för tekniker att välja artiklar/tjänster för ett ärende

import React, { useState, useEffect, useCallback } from 'react'
import {
  Package,
  Search,
  Plus,
  Minus,
  Trash2,
  Percent,
  Tag,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { CaseBillingService } from '../../services/caseBillingService'
import { DiscountNotificationService } from '../../services/discountNotificationService'
import type {
  CaseBillingItem,
  CaseBillingItemWithRelations,
  ArticleWithEffectivePrice,
  BillableCaseType,
  CaseBillingSummary
} from '../../types/caseBilling'
import type { ArticleCategory } from '../../types/articles'
import { ARTICLE_CATEGORY_CONFIG, ARTICLE_UNIT_CONFIG, formatArticlePrice } from '../../types/articles'
import { formatPriceSource } from '../../types/caseBilling'

interface CaseArticleSelectorProps {
  caseId: string
  caseType: BillableCaseType
  customerId?: string | null
  technicianId?: string | null
  technicianName?: string | null
  onChange?: (items: CaseBillingItemWithRelations[], summary: CaseBillingSummary) => void
  readOnly?: boolean
  className?: string
}

export default function CaseArticleSelector({
  caseId,
  caseType,
  customerId,
  technicianId,
  technicianName,
  onChange,
  readOnly = false,
  className = ''
}: CaseArticleSelectorProps) {
  // State
  const [articles, setArticles] = useState<ArticleWithEffectivePrice[]>([])
  const [selectedItems, setSelectedItems] = useState<CaseBillingItemWithRelations[]>([])
  const [summary, setSummary] = useState<CaseBillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<ArticleCategory>>(new Set())
  const [showArticleList, setShowArticleList] = useState(false)

  // Ladda artiklar och befintliga items
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [articlesData, itemsData, summaryData] = await Promise.all([
        CaseBillingService.getArticlesWithPrices(customerId),
        CaseBillingService.getCaseBillingItems(caseId, caseType),
        CaseBillingService.getCaseBillingSummary(caseId, caseType)
      ])

      setArticles(articlesData)
      setSelectedItems(itemsData)
      setSummary(summaryData)

      if (onChange) {
        onChange(itemsData, summaryData)
      }
    } catch (error) {
      console.error('Kunde inte ladda artikeldata:', error)
      toast.error('Kunde inte ladda artiklar')
    } finally {
      setLoading(false)
    }
  }, [caseId, caseType, customerId, onChange])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtrera artiklar baserat på sökning
  const filteredArticles = articles.filter(item => {
    const search = searchTerm.toLowerCase()
    return (
      item.article.name.toLowerCase().includes(search) ||
      item.article.code.toLowerCase().includes(search) ||
      item.article.category.toLowerCase().includes(search)
    )
  })

  // Gruppera artiklar per kategori
  const articlesByCategory = filteredArticles.reduce((acc, item) => {
    const category = item.article.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<ArticleCategory, ArticleWithEffectivePrice[]>)

  // Toggle kategori expansion
  const toggleCategory = (category: ArticleCategory) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Lägg till artikel
  const handleAddArticle = async (articleWithPrice: ArticleWithEffectivePrice) => {
    if (readOnly || saving) return

    setSaving(true)
    try {
      await CaseBillingService.addArticleToCase({
        case_id: caseId,
        case_type: caseType,
        customer_id: customerId,
        article_id: articleWithPrice.article.id,
        article_code: articleWithPrice.article.code,
        article_name: articleWithPrice.article.name,
        quantity: 1,
        unit_price: articleWithPrice.effective_price,
        vat_rate: articleWithPrice.article.vat_rate,
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

  // Uppdatera kvantitet
  const handleUpdateQuantity = async (item: CaseBillingItem, delta: number) => {
    if (readOnly || saving) return

    const newQuantity = item.quantity + delta
    if (newQuantity < 1) return

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

  // Uppdatera rabatt
  const handleUpdateDiscount = async (item: CaseBillingItem, discountPercent: number) => {
    if (readOnly || saving) return

    // Kolla om detta är en ny rabatt (tidigare ingen rabatt)
    const hadNoDiscount = item.discount_percent === 0
    const willHaveDiscount = discountPercent > 0

    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(item.id, { discount_percent: discountPercent })

      if (willHaveDiscount) {
        toast.success('Rabatt tillagd - kräver admin-godkännande')

        // Skicka notifikation till admins om detta är en ny rabatt
        if (hadNoDiscount) {
          DiscountNotificationService.notifyAdminsOfDiscountRequest({
            caseId,
            caseType,
            articleName: item.article_name,
            discountPercent,
            technicianId,
            technicianName
          }).catch(err => {
            console.warn('Kunde inte skicka rabatt-notifikation:', err)
          })
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

  // Ta bort artikel
  const handleRemoveArticle = async (itemId: string) => {
    if (readOnly || saving) return

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

  // Formatera pris
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  if (loading) {
    return (
      <div className={`bg-slate-800/50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
          <span className="ml-2 text-slate-400">Laddar artiklar...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-slate-800/50 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">
              Utförda tjänster & artiklar
            </h3>
            {selectedItems.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
                {selectedItems.length} st
              </span>
            )}
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowArticleList(!showArticleList)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Lägg till
            </button>
          )}
        </div>
      </div>

      {/* Artikelväljare (expanderbar) */}
      {showArticleList && !readOnly && (
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          {/* Sökfält */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök artikel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Artikellista grupperad per kategori */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(Object.keys(articlesByCategory) as ArticleCategory[]).map(category => {
              const categoryArticles = articlesByCategory[category]
              if (!categoryArticles || categoryArticles.length === 0) return null

              const isExpanded = expandedCategories.has(category)
              const config = ARTICLE_CATEGORY_CONFIG[category]

              return (
                <div key={category} className="border border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-sm text-slate-400">
                        ({categoryArticles.length} artiklar)
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-slate-700/50">
                      {categoryArticles.map(item => (
                        <div
                          key={item.article.id}
                          className="flex items-center justify-between p-3 hover:bg-slate-800/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium truncate">
                                {item.article.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {item.article.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-blue-400 font-medium">
                                {formatPrice(item.effective_price)}
                              </span>
                              <span className="text-xs text-slate-500">
                                / {ARTICLE_UNIT_CONFIG[item.article.unit].shortLabel}
                              </span>
                              {item.price_source === 'customer_list' && (
                                <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                                  Kundpris
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddArticle(item)}
                            disabled={saving}
                            className="ml-2 p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {Object.keys(articlesByCategory).length === 0 && (
              <div className="text-center py-4 text-slate-400">
                Inga artiklar hittades
              </div>
            )}
          </div>
        </div>
      )}

      {/* Valda artiklar */}
      <div className="p-4">
        {selectedItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga artiklar tillagda</p>
            {!readOnly && (
              <p className="text-sm mt-1">Klicka på "Lägg till" för att välja artiklar</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {selectedItems.map(item => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border ${
                  item.requires_approval
                    ? 'border-orange-500/50 bg-orange-500/10'
                    : 'border-slate-700 bg-slate-800/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{item.article_name}</span>
                      {item.article_code && (
                        <span className="text-xs text-slate-500">{item.article_code}</span>
                      )}
                      {item.requires_approval && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400">
                          <AlertCircle className="w-3 h-3" />
                          Kräver godkännande
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm">
                      {/* Kvantitet */}
                      <div className="flex items-center gap-1">
                        {!readOnly && (
                          <button
                            onClick={() => handleUpdateQuantity(item, -1)}
                            disabled={saving || item.quantity <= 1}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        )}
                        <span className="w-8 text-center text-white">{item.quantity}</span>
                        {!readOnly && (
                          <button
                            onClick={() => handleUpdateQuantity(item, 1)}
                            disabled={saving}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                        <span className="text-slate-500 ml-1">st</span>
                      </div>

                      {/* Pris */}
                      <div className="flex items-center gap-1 text-slate-400">
                        <Tag className="w-4 h-4" />
                        <span>{formatPrice(item.unit_price)}</span>
                        {item.price_source === 'customer_list' && (
                          <span className="text-xs text-green-400">(Kundpris)</span>
                        )}
                      </div>

                      {/* Rabatt */}
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          <Percent className="w-4 h-4 text-slate-400" />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount_percent}
                            onChange={(e) => {
                              const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                              handleUpdateDiscount(item, value)
                            }}
                            disabled={saving}
                            className="w-16 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      )}
                      {readOnly && item.discount_percent > 0 && (
                        <span className="text-orange-400">-{item.discount_percent}%</span>
                      )}
                    </div>
                  </div>

                  {/* Totalpris och ta bort */}
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-lg font-semibold text-blue-400">
                      {formatPrice(item.total_price)}
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => handleRemoveArticle(item.id)}
                        disabled={saving}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summering */}
      {summary && selectedItems.length > 0 && (
        <div className="p-4 border-t border-slate-700 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">
              <span>{summary.item_count} artikel{summary.item_count !== 1 ? 'ar' : ''}</span>
              {summary.total_discount > 0 && (
                <span className="ml-2 text-orange-400">
                  (Rabatt: {formatPrice(summary.total_discount)})
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">
                Exkl. moms: {formatPrice(summary.subtotal)}
              </div>
              <div className="text-lg font-bold text-white">
                Totalt: {formatPrice(summary.total_amount)}
                <span className="text-sm font-normal text-slate-400 ml-1">inkl. moms</span>
              </div>
            </div>
          </div>
          {summary.requires_approval && (
            <div className="mt-2 flex items-center gap-2 text-orange-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>En eller flera artiklar har rabatt och kräver admin-godkännande</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
