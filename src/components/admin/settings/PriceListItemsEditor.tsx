// src/components/admin/settings/PriceListItemsEditor.tsx
// Kompakt tabell-editor för artikelpriser i en prislista

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Loader2,
  Search,
  Check,
  AlertCircle
} from 'lucide-react'
import { PriceListService } from '../../../services/priceListService'
import {
  Article,
  PriceListItemWithArticle,
  ARTICLE_CATEGORY_CONFIG,
  formatArticlePrice
} from '../../../types/articles'
import toast from 'react-hot-toast'

interface PriceListItemsEditorProps {
  priceListId: string
  articles: Article[]
  onUpdate: () => void
}

type PriceType = 'standard' | 'custom' | 'discount'

interface ArticlePriceState {
  priceType: PriceType
  customPrice: string
  discountPercent: string
  isSaving: boolean
  savedAt: number | null
}

// Debounce hook
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay]) as T
}

export function PriceListItemsEditor({
  priceListId,
  articles,
  onUpdate
}: PriceListItemsEditorProps) {
  const [items, setItems] = useState<PriceListItemWithArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [priceStates, setPriceStates] = useState<Record<string, ArticlePriceState>>({})

  // Ladda artikelpriser
  useEffect(() => {
    loadItems()
  }, [priceListId])

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await PriceListService.getPriceListItems(priceListId)
      setItems(data)

      // Initialisera priceStates från databas
      const initialStates: Record<string, ArticlePriceState> = {}
      data.forEach(item => {
        if (item.discount_percent && item.discount_percent > 0) {
          initialStates[item.article_id] = {
            priceType: 'discount',
            customPrice: item.custom_price?.toString() || '',
            discountPercent: item.discount_percent.toString(),
            isSaving: false,
            savedAt: null
          }
        } else if (item.custom_price !== null) {
          initialStates[item.article_id] = {
            priceType: 'custom',
            customPrice: item.custom_price.toString(),
            discountPercent: '',
            isSaving: false,
            savedAt: null
          }
        }
      })
      setPriceStates(initialStates)
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda artikelpriser')
    } finally {
      setLoading(false)
    }
  }

  // Bygg en map av artikelpriser för snabb lookup
  const priceMap = useMemo(() => {
    const map: Record<string, PriceListItemWithArticle> = {}
    items.forEach(item => {
      map[item.article_id] = item
    })
    return map
  }, [items])

  // Filtrera artiklar
  const filteredArticles = useMemo(() => {
    if (!searchTerm) return articles

    const search = searchTerm.toLowerCase()
    return articles.filter(article =>
      article.code.toLowerCase().includes(search) ||
      article.name.toLowerCase().includes(search) ||
      article.category.toLowerCase().includes(search)
    )
  }, [articles, searchTerm])

  // Spara pris till databas
  const savePrice = async (articleId: string, article: Article, state: ArticlePriceState) => {
    setPriceStates(prev => ({
      ...prev,
      [articleId]: { ...prev[articleId], isSaving: true }
    }))

    try {
      if (state.priceType === 'standard') {
        // Ta bort anpassning
        await PriceListService.removePriceListItem(priceListId, articleId)
      } else if (state.priceType === 'custom') {
        const price = parseFloat(state.customPrice)
        if (!isNaN(price) && price >= 0) {
          await PriceListService.upsertPriceListItem({
            price_list_id: priceListId,
            article_id: articleId,
            custom_price: price,
            discount_percent: 0
          })
        }
      } else if (state.priceType === 'discount') {
        const discount = parseFloat(state.discountPercent)
        if (!isNaN(discount) && discount >= 0 && discount <= 100) {
          const discountedPrice = article.default_price * (1 - discount / 100)
          await PriceListService.upsertPriceListItem({
            price_list_id: priceListId,
            article_id: articleId,
            custom_price: Math.round(discountedPrice * 100) / 100,
            discount_percent: discount
          })
        }
      }

      setPriceStates(prev => ({
        ...prev,
        [articleId]: { ...prev[articleId], isSaving: false, savedAt: Date.now() }
      }))

      // Rensa savedAt efter 2 sekunder
      setTimeout(() => {
        setPriceStates(prev => ({
          ...prev,
          [articleId]: prev[articleId] ? { ...prev[articleId], savedAt: null } : prev[articleId]
        }))
      }, 2000)

      loadItems()
      onUpdate()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error('Kunde inte spara priset')
      setPriceStates(prev => ({
        ...prev,
        [articleId]: { ...prev[articleId], isSaving: false }
      }))
    }
  }

  // Debounced save
  const debouncedSave = useDebounce(savePrice, 500)

  // Hantera pristyp-ändring
  const handlePriceTypeChange = (articleId: string, article: Article, newType: PriceType) => {
    const currentState = priceStates[articleId] || {
      priceType: 'standard',
      customPrice: article.default_price.toString(),
      discountPercent: '0',
      isSaving: false,
      savedAt: null
    }

    const newState: ArticlePriceState = {
      ...currentState,
      priceType: newType,
      customPrice: newType === 'custom' ? article.default_price.toString() : currentState.customPrice,
      discountPercent: newType === 'discount' ? '0' : currentState.discountPercent
    }

    setPriceStates(prev => ({
      ...prev,
      [articleId]: newState
    }))

    // Om standard, spara direkt (ta bort)
    if (newType === 'standard') {
      savePrice(articleId, article, newState)
    }
  }

  // Hantera prisändring
  const handlePriceChange = (articleId: string, article: Article, value: string) => {
    const currentState = priceStates[articleId]
    if (!currentState) return

    const newState: ArticlePriceState = {
      ...currentState,
      customPrice: value
    }

    setPriceStates(prev => ({
      ...prev,
      [articleId]: newState
    }))

    debouncedSave(articleId, article, newState)
  }

  // Hantera rabattändring
  const handleDiscountChange = (articleId: string, article: Article, value: string) => {
    const currentState = priceStates[articleId]
    if (!currentState) return

    const newState: ArticlePriceState = {
      ...currentState,
      discountPercent: value
    }

    setPriceStates(prev => ({
      ...prev,
      [articleId]: newState
    }))

    debouncedSave(articleId, article, newState)
  }

  // Räkna statistik
  const stats = useMemo(() => {
    let customCount = 0
    let discountCount = 0

    Object.values(priceStates).forEach(state => {
      if (state.priceType === 'custom') customCount++
      if (state.priceType === 'discount') discountCount++
    })

    return { customCount, discountCount }
  }, [priceStates])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Sökfält */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Sök artikel..."
          className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Tabell */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-900/80 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Kod
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Namn
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Pristyp
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Pris
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    {searchTerm ? 'Inga artiklar matchar sökningen' : 'Inga artiklar tillgängliga'}
                  </td>
                </tr>
              ) : (
                filteredArticles.map(article => {
                  const state = priceStates[article.id]
                  const priceType = state?.priceType || 'standard'
                  const categoryConfig = ARTICLE_CATEGORY_CONFIG[article.category]
                  const isSaving = state?.isSaving
                  const justSaved = state?.savedAt && Date.now() - state.savedAt < 2000

                  // Beräkna visuell markering
                  const rowClass = priceType === 'custom'
                    ? 'border-l-2 border-purple-500 bg-purple-500/5'
                    : priceType === 'discount'
                      ? 'border-l-2 border-emerald-500 bg-emerald-500/5'
                      : ''

                  // Beräkna rabatterat pris
                  const discountPercent = parseFloat(state?.discountPercent || '0')
                  const discountedPrice = article.default_price * (1 - discountPercent / 100)

                  return (
                    <tr
                      key={article.id}
                      className={`hover:bg-slate-800/30 transition-colors ${rowClass}`}
                    >
                      {/* Kod */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <code className="text-xs font-mono text-slate-400">
                          {article.code}
                        </code>
                      </td>

                      {/* Namn */}
                      <td className="px-3 py-2">
                        <span className="text-sm text-white truncate block max-w-[200px]" title={article.name}>
                          {article.name}
                        </span>
                      </td>

                      {/* Kategori */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${categoryConfig.bgColor} ${categoryConfig.color}`}>
                          {categoryConfig.label}
                        </span>
                      </td>

                      {/* Pristyp */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <select
                          value={priceType}
                          onChange={(e) => handlePriceTypeChange(article.id, article, e.target.value as PriceType)}
                          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="standard">Standard</option>
                          <option value="custom">Anpassat (kr)</option>
                          <option value="discount">Rabatt (%)</option>
                        </select>
                      </td>

                      {/* Pris */}
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {priceType === 'standard' && (
                            <span className="text-sm text-slate-400">
                              {formatArticlePrice(article.default_price)}
                            </span>
                          )}

                          {priceType === 'custom' && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={state?.customPrice || ''}
                                onChange={(e) => handlePriceChange(article.id, article, e.target.value)}
                                min="0"
                                step="1"
                                className="w-20 px-2 py-1 bg-slate-900 border border-purple-500/50 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              <span className="text-xs text-slate-500">kr</span>
                            </div>
                          )}

                          {priceType === 'discount' && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={state?.discountPercent || ''}
                                onChange={(e) => handleDiscountChange(article.id, article, e.target.value)}
                                min="0"
                                max="100"
                                step="1"
                                className="w-14 px-2 py-1 bg-slate-900 border border-emerald-500/50 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              <span className="text-xs text-slate-500">%</span>
                              <span className="text-xs text-emerald-400 ml-1">
                                = {formatArticlePrice(discountedPrice)}
                              </span>
                            </div>
                          )}

                          {/* Sparindikator */}
                          <div className="w-5">
                            {isSaving && (
                              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                            )}
                            {justSaved && !isSaving && (
                              <Check className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sammanfattning */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-sm">
        <span className="text-slate-400">
          {articles.length} artiklar
          {stats.customCount > 0 && (
            <span className="ml-2">
              • <span className="text-purple-400">{stats.customCount} anpassade</span>
            </span>
          )}
          {stats.discountCount > 0 && (
            <span className="ml-2">
              • <span className="text-emerald-400">{stats.discountCount} med rabatt</span>
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
