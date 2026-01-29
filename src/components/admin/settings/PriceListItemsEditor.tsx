// src/components/admin/settings/PriceListItemsEditor.tsx
// Inline-editor för artikelpriser i en prislista

import { useState, useEffect, useMemo } from 'react'
import {
  Loader2,
  Search,
  Save,
  X,
  Check,
  AlertTriangle
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

interface EditingPrice {
  articleId: string
  price: string
}

export function PriceListItemsEditor({
  priceListId,
  articles,
  onUpdate
}: PriceListItemsEditorProps) {
  const [items, setItems] = useState<PriceListItemWithArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingPrice, setEditingPrice] = useState<EditingPrice | null>(null)
  const [saving, setSaving] = useState(false)

  // Ladda artikelpriser
  useEffect(() => {
    loadItems()
  }, [priceListId])

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await PriceListService.getPriceListItems(priceListId)
      setItems(data)
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

  // Spara pris
  const handleSavePrice = async () => {
    if (!editingPrice) return

    const price = parseFloat(editingPrice.price)
    if (isNaN(price) || price < 0) {
      toast.error('Ogiltigt pris')
      return
    }

    setSaving(true)
    try {
      await PriceListService.upsertPriceListItem({
        price_list_id: priceListId,
        article_id: editingPrice.articleId,
        custom_price: price
      })
      toast.success('Pris sparat')
      setEditingPrice(null)
      loadItems()
      onUpdate()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error('Kunde inte spara priset')
    } finally {
      setSaving(false)
    }
  }

  // Ta bort pris (återgå till standard)
  const handleRemovePrice = async (articleId: string) => {
    setSaving(true)
    try {
      await PriceListService.removePriceListItem(priceListId, articleId)
      toast.success('Prisavvikelse borttagen')
      loadItems()
      onUpdate()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error('Kunde inte ta bort priset')
    } finally {
      setSaving(false)
    }
  }

  // Börja redigera
  const startEditing = (article: Article) => {
    const existingPrice = priceMap[article.id]
    setEditingPrice({
      articleId: article.id,
      price: existingPrice
        ? existingPrice.custom_price.toString()
        : article.default_price.toString()
    })
  }

  // Avbryt redigering
  const cancelEditing = () => {
    setEditingPrice(null)
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

      {/* Info */}
      <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-400">
            Klicka på en artikel för att sätta ett kundspecifikt pris. Artiklar utan anpassat pris använder standardpriset.
          </p>
        </div>
      </div>

      {/* Artikellista */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredArticles.length === 0 ? (
          <p className="text-center text-slate-500 py-4">
            {searchTerm ? 'Inga artiklar matchar sökningen' : 'Inga artiklar tillgängliga'}
          </p>
        ) : (
          filteredArticles.map(article => {
            const customItem = priceMap[article.id]
            const hasCustomPrice = !!customItem
            const isEditing = editingPrice?.articleId === article.id
            const categoryConfig = ARTICLE_CATEGORY_CONFIG[article.category]

            return (
              <div
                key={article.id}
                className={`p-3 rounded-lg border transition-all ${
                  isEditing
                    ? 'bg-purple-500/10 border-purple-500/50'
                    : hasCustomPrice
                      ? 'bg-slate-800/70 border-slate-600'
                      : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600 cursor-pointer'
                }`}
                onClick={() => !isEditing && startEditing(article)}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Artikel-info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono text-slate-300">
                        {article.code}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${categoryConfig.bgColor} ${categoryConfig.color}`}>
                        {article.category}
                      </span>
                    </div>
                    <p className="text-white text-sm font-medium truncate">{article.name}</p>
                  </div>

                  {/* Pris */}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <div className="relative">
                          <input
                            type="number"
                            value={editingPrice.price}
                            onChange={(e) => setEditingPrice({ ...editingPrice, price: e.target.value })}
                            min="0"
                            step="0.01"
                            className="w-28 px-3 py-1.5 pr-8 bg-slate-900 border border-purple-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSavePrice()
                              if (e.key === 'Escape') cancelEditing()
                            }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">kr</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSavePrice()
                          }}
                          disabled={saving}
                          className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            cancelEditing()
                          }}
                          className="p-1.5 text-slate-400 hover:bg-slate-700 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-right">
                          {hasCustomPrice ? (
                            <div>
                              <p className="text-white font-medium text-sm">
                                {formatArticlePrice(customItem.custom_price)}
                              </p>
                              <p className="text-slate-500 text-xs line-through">
                                {formatArticlePrice(article.default_price)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-slate-400 text-sm">
                              {formatArticlePrice(article.default_price)}
                            </p>
                          )}
                        </div>
                        {hasCustomPrice && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemovePrice(article.id)
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            title="Återställ till standard"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Sammanfattning */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-sm">
        <span className="text-slate-400">
          {items.length} av {articles.length} artiklar har anpassat pris
        </span>
      </div>
    </div>
  )
}
