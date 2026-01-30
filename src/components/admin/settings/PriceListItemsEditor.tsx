// src/components/admin/settings/PriceListItemsEditor.tsx
// Kompakt tabell-editor för artikelpriser i en prislista med bekräftelseflöde

import { useState, useEffect, useMemo } from 'react'
import {
  Loader2,
  Search,
  Check,
  X,
  RotateCcw
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
  // Dirty state för bekräftelseflöde
  isDirty: boolean
  originalPriceType: PriceType
  originalCustomPrice: string
  originalDiscountPercent: string
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
            savedAt: null,
            isDirty: false,
            originalPriceType: 'discount',
            originalCustomPrice: item.custom_price?.toString() || '',
            originalDiscountPercent: item.discount_percent.toString()
          }
        } else if (item.custom_price !== null) {
          initialStates[item.article_id] = {
            priceType: 'custom',
            customPrice: item.custom_price.toString(),
            discountPercent: '',
            isSaving: false,
            savedAt: null,
            isDirty: false,
            originalPriceType: 'custom',
            originalCustomPrice: item.custom_price.toString(),
            originalDiscountPercent: ''
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
  const confirmPrice = async (articleId: string, article: Article) => {
    const state = priceStates[articleId]
    if (!state) return

    setPriceStates(prev => ({
      ...prev,
      [articleId]: { ...prev[articleId], isSaving: true }
    }))

    try {
      if (state.priceType === 'standard') {
        // Ta bort anpassning
        await PriceListService.removePriceListItem(priceListId, articleId)
        // Ta bort från state
        setPriceStates(prev => {
          const newState = { ...prev }
          delete newState[articleId]
          return newState
        })
        toast.success('Återställt till standardpris')
      } else if (state.priceType === 'custom') {
        const price = parseFloat(state.customPrice)
        if (isNaN(price) || price < 0) {
          toast.error('Ogiltigt pris')
          setPriceStates(prev => ({
            ...prev,
            [articleId]: { ...prev[articleId], isSaving: false }
          }))
          return
        }
        await PriceListService.upsertPriceListItem({
          price_list_id: priceListId,
          article_id: articleId,
          custom_price: price,
          discount_percent: 0
        })
        // Uppdatera original values och rensa dirty
        setPriceStates(prev => ({
          ...prev,
          [articleId]: {
            ...prev[articleId],
            isSaving: false,
            savedAt: Date.now(),
            isDirty: false,
            originalPriceType: 'custom',
            originalCustomPrice: state.customPrice,
            originalDiscountPercent: ''
          }
        }))
        toast.success('Pris sparat')
      } else if (state.priceType === 'discount') {
        const discount = parseFloat(state.discountPercent)
        if (isNaN(discount) || discount < 0 || discount > 100) {
          toast.error('Ogiltig rabatt (0-100%)')
          setPriceStates(prev => ({
            ...prev,
            [articleId]: { ...prev[articleId], isSaving: false }
          }))
          return
        }
        const discountedPrice = article.default_price * (1 - discount / 100)
        await PriceListService.upsertPriceListItem({
          price_list_id: priceListId,
          article_id: articleId,
          custom_price: Math.round(discountedPrice * 100) / 100,
          discount_percent: discount
        })
        // Uppdatera original values och rensa dirty
        setPriceStates(prev => ({
          ...prev,
          [articleId]: {
            ...prev[articleId],
            isSaving: false,
            savedAt: Date.now(),
            isDirty: false,
            originalPriceType: 'discount',
            originalCustomPrice: Math.round(discountedPrice * 100) / 100 + '',
            originalDiscountPercent: state.discountPercent
          }
        }))
        toast.success('Rabatt sparad')
      }

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

  // Återställ till senast sparade värde
  const resetPrice = (articleId: string) => {
    const state = priceStates[articleId]
    if (!state) {
      // Om ingen state finns, ta bort eventuell temporär state
      setPriceStates(prev => {
        const newState = { ...prev }
        delete newState[articleId]
        return newState
      })
      return
    }

    // Om original var "standard" (ingen state), ta bort
    if (state.originalPriceType === 'standard') {
      setPriceStates(prev => {
        const newState = { ...prev }
        delete newState[articleId]
        return newState
      })
    } else {
      // Återställ till original values
      setPriceStates(prev => ({
        ...prev,
        [articleId]: {
          ...prev[articleId],
          priceType: state.originalPriceType,
          customPrice: state.originalCustomPrice,
          discountPercent: state.originalDiscountPercent,
          isDirty: false
        }
      }))
    }
  }

  // Hantera pristyp-ändring
  const handlePriceTypeChange = (articleId: string, article: Article, newType: PriceType) => {
    const currentState = priceStates[articleId]
    const originalPriceType = currentState?.originalPriceType || 'standard'
    const originalCustomPrice = currentState?.originalCustomPrice || article.default_price.toString()
    const originalDiscountPercent = currentState?.originalDiscountPercent || '0'

    // Bestäm nya värden
    let newCustomPrice = currentState?.customPrice || article.default_price.toString()
    let newDiscountPercent = currentState?.discountPercent || '0'

    if (newType === 'custom' && !currentState?.customPrice) {
      newCustomPrice = article.default_price.toString()
    }
    if (newType === 'discount' && !currentState?.discountPercent) {
      newDiscountPercent = '10' // Default 10% rabatt
    }

    // Kolla om det är en ändring
    const isDirty = newType !== originalPriceType ||
      (newType === 'custom' && newCustomPrice !== originalCustomPrice) ||
      (newType === 'discount' && newDiscountPercent !== originalDiscountPercent)

    const newState: ArticlePriceState = {
      priceType: newType,
      customPrice: newCustomPrice,
      discountPercent: newDiscountPercent,
      isSaving: false,
      savedAt: null,
      isDirty,
      originalPriceType,
      originalCustomPrice,
      originalDiscountPercent
    }

    setPriceStates(prev => ({
      ...prev,
      [articleId]: newState
    }))
  }

  // Hantera prisändring
  const handlePriceChange = (articleId: string, article: Article, value: string) => {
    const currentState = priceStates[articleId]
    if (!currentState) return

    const isDirty = value !== currentState.originalCustomPrice ||
                    currentState.priceType !== currentState.originalPriceType

    setPriceStates(prev => ({
      ...prev,
      [articleId]: {
        ...prev[articleId],
        customPrice: value,
        isDirty
      }
    }))
  }

  // Hantera rabattändring
  const handleDiscountChange = (articleId: string, article: Article, value: string) => {
    const currentState = priceStates[articleId]
    if (!currentState) return

    const isDirty = value !== currentState.originalDiscountPercent ||
                    currentState.priceType !== currentState.originalPriceType

    setPriceStates(prev => ({
      ...prev,
      [articleId]: {
        ...prev[articleId],
        discountPercent: value,
        isDirty
      }
    }))
  }

  // Räkna statistik
  const stats = useMemo(() => {
    let customCount = 0
    let discountCount = 0
    let dirtyCount = 0

    Object.values(priceStates).forEach(state => {
      if (state.priceType === 'custom' && !state.isDirty) customCount++
      if (state.priceType === 'discount' && !state.isDirty) discountCount++
      if (state.isDirty) dirtyCount++
    })

    return { customCount, discountCount, dirtyCount }
  }, [priceStates])

  // Bekräfta alla osparade
  const confirmAllDirty = async () => {
    const dirtyArticles = Object.entries(priceStates)
      .filter(([_, state]) => state.isDirty)
      .map(([articleId]) => articleId)

    for (const articleId of dirtyArticles) {
      const article = articles.find(a => a.id === articleId)
      if (article) {
        await confirmPrice(articleId, article)
      }
    }
  }

  // Ångra alla osparade
  const resetAllDirty = () => {
    const dirtyArticles = Object.entries(priceStates)
      .filter(([_, state]) => state.isDirty)
      .map(([articleId]) => articleId)

    dirtyArticles.forEach(articleId => {
      resetPrice(articleId)
    })
  }

  // Hjälpfunktion för rad-styling
  const getRowClass = (priceType: PriceType, isDirty: boolean) => {
    if (isDirty) {
      return 'border-l-2 border-amber-400 bg-amber-500/10'
    }
    switch (priceType) {
      case 'custom':
        return 'border-l-2 border-purple-500 bg-purple-500/5'
      case 'discount':
        return 'border-l-2 border-emerald-500 bg-emerald-500/5'
      default:
        return ''
    }
  }

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
                  Art nr
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
                  const isDirty = state?.isDirty || false
                  const categoryConfig = ARTICLE_CATEGORY_CONFIG[article.category]
                  const isSaving = state?.isSaving
                  const justSaved = state?.savedAt && Date.now() - state.savedAt < 2000

                  // Beräkna rabatterat pris
                  const discountPercent = parseFloat(state?.discountPercent || '0')
                  const discountedPrice = article.default_price * (1 - discountPercent / 100)

                  const rowClass = getRowClass(priceType, isDirty)

                  return (
                    <tr
                      key={article.id}
                      className={`hover:bg-slate-800/30 transition-colors ${rowClass}`}
                    >
                      {/* Art nr */}
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
                        <div className="flex items-center justify-end gap-1.5">
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
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && isDirty) {
                                    confirmPrice(article.id, article)
                                  } else if (e.key === 'Escape') {
                                    resetPrice(article.id)
                                  }
                                }}
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
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && isDirty) {
                                    confirmPrice(article.id, article)
                                  } else if (e.key === 'Escape') {
                                    resetPrice(article.id)
                                  }
                                }}
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

                          {/* Bekräftelseknappar - endast om dirty */}
                          {isDirty && (
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => confirmPrice(article.id, article)}
                                disabled={isSaving}
                                className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                                title="Bekräfta (Enter)"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => resetPrice(article.id)}
                                className="p-1.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 transition-colors"
                                title="Ångra (Escape)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Sparindikator - endast om sparat och inte dirty */}
                          {!isDirty && justSaved && !isSaving && (
                            <div className="w-5 ml-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}
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

        {/* Global bekräftelse om det finns dirty rows */}
        {stats.dirtyCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-amber-400">
              {stats.dirtyCount} osparad{stats.dirtyCount > 1 ? 'e' : ''} ändring{stats.dirtyCount > 1 ? 'ar' : ''}
            </span>
            <button
              onClick={confirmAllDirty}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Spara alla
            </button>
            <button
              onClick={resetAllDirty}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Ångra alla
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
