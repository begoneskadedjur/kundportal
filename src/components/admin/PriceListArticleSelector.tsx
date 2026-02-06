// src/components/admin/PriceListArticleSelector.tsx
// Prislistedriven artikelväljare för Oneflow-wizarden

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Plus, Minus, ExternalLink, Copy, FileText,
  ChevronDown, ChevronRight, ShieldCheck, Leaf, Loader2
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import { PriceListEditModal } from './settings/PriceListEditModal'
import { PriceListService } from '../../services/priceListService'
import { ArticleService } from '../../services/articleService'
import type { PriceList, PriceListItemWithArticle, Article, ArticleCategory, ARTICLE_CATEGORY_CONFIG } from '../../types/articles'
import type { SelectedArticleItem } from '../../types/products'
import type { CustomerType } from '../../types/products'
import { formatArticlePrice } from '../../utils/articlePricingCalculator'
import toast from 'react-hot-toast'

interface PriceListArticleSelectorProps {
  selectedPriceListId: string | null
  onPriceListChange: (id: string | null) => void
  selectedArticles: SelectedArticleItem[]
  onSelectionChange: (articles: SelectedArticleItem[]) => void
  customerType: CustomerType
  className?: string
}

const CATEGORY_CONFIG: Record<ArticleCategory, { label: string; icon: string; color: string; bgColor: string }> = {
  Inspektion: { label: 'Inspektion', icon: '🔍', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  Bekämpning: { label: 'Bekämpning', icon: '🐭', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  Tillbehör: { label: 'Tillbehör', icon: '🛡️', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  Övrigt: { label: 'Övrigt', icon: '📋', color: 'text-slate-400', bgColor: 'bg-slate-500/20' }
}

export default function PriceListArticleSelector({
  selectedPriceListId,
  onPriceListChange,
  selectedArticles,
  onSelectionChange,
  customerType,
  className = ''
}: PriceListArticleSelectorProps) {
  // State
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [priceListItems, setPriceListItems] = useState<PriceListItemWithArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory | 'all'>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Bekämpning', 'Inspektion', 'Tillbehör', 'Övrigt']))

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [copyName, setCopyName] = useState('')
  const [copySourceId, setCopySourceId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)

  // Ladda prislistor och artiklar vid mount
  useEffect(() => {
    loadInitialData()
  }, [])

  // Ladda prislistans artikelpriser vid val
  useEffect(() => {
    if (selectedPriceListId) {
      loadPriceListItems(selectedPriceListId)
    } else {
      setPriceListItems([])
    }
  }, [selectedPriceListId])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [pl, arts] = await Promise.all([
        PriceListService.getActivePriceLists(),
        ArticleService.getActiveArticles()
      ])
      setPriceLists(pl)
      setArticles(arts)
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }

  const loadPriceListItems = async (priceListId: string) => {
    setLoadingItems(true)
    try {
      const items = await PriceListService.getPriceListItems(priceListId)
      setPriceListItems(items)
    } catch (error) {
      console.error('Fel vid laddning av prislistans artiklar:', error)
    } finally {
      setLoadingItems(false)
    }
  }

  // Bygg priskarta: articleId → custom_price
  const priceMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of priceListItems) {
      map.set(item.article_id, item.custom_price)
    }
    return map
  }, [priceListItems])

  // Hämta effektivt pris för en artikel
  const getEffectivePrice = (article: Article): number => {
    if (selectedPriceListId && priceMap.has(article.id)) {
      return priceMap.get(article.id)!
    }
    return Number(article.default_price)
  }

  // Hämta prisets källa
  const getPriceSource = (article: Article): 'price_list' | 'default' => {
    if (selectedPriceListId && priceMap.has(article.id)) {
      return 'price_list'
    }
    return 'default'
  }

  // Filtrerade artiklar
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchesSearch =
        article.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (article.description && article.description.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [articles, searchTerm, selectedCategory])

  // Gruppera per kategori
  const groupedArticles = useMemo(() => {
    const groups: Record<ArticleCategory, Article[]> = {
      Inspektion: [],
      Bekämpning: [],
      Tillbehör: [],
      Övrigt: []
    }
    for (const article of filteredArticles) {
      if (groups[article.category]) {
        groups[article.category].push(article)
      }
    }
    return groups
  }, [filteredArticles])

  // Kvantitetshantering
  const getSelectedQuantity = (articleId: string): number => {
    return selectedArticles.find(sa => sa.article.id === articleId)?.quantity || 0
  }

  const handleQuantityChange = (article: Article, delta: number) => {
    const current = getSelectedQuantity(article.id)
    const newQty = Math.max(0, current + delta)

    if (newQty === 0) {
      onSelectionChange(selectedArticles.filter(sa => sa.article.id !== article.id))
    } else {
      const existing = selectedArticles.find(sa => sa.article.id === article.id)
      if (existing) {
        onSelectionChange(
          selectedArticles.map(sa =>
            sa.article.id === article.id ? { ...sa, quantity: newQty } : sa
          )
        )
      } else {
        const priceListItem = priceListItems.find(pli => pli.article_id === article.id) || null
        onSelectionChange([
          ...selectedArticles,
          {
            article,
            priceListItem: priceListItem ? {
              id: priceListItem.id,
              price_list_id: priceListItem.price_list_id,
              article_id: priceListItem.article_id,
              custom_price: priceListItem.custom_price,
              discount_percent: priceListItem.discount_percent,
              created_at: priceListItem.created_at,
              updated_at: priceListItem.updated_at
            } : null,
            effectivePrice: getEffectivePrice(article),
            quantity: newQty
          }
        ])
      }
    }
  }

  // Kopiera prislista
  const handleCopyPriceList = async () => {
    if (!copySourceId || !copyName.trim()) return
    setCopying(true)
    try {
      const newPL = await PriceListService.copyPriceList(copySourceId, copyName.trim())
      setPriceLists(prev => [...prev, newPL])
      onPriceListChange(newPL.id)
      setShowCopyDialog(false)
      setCopyName('')
      setCopySourceId(null)
      toast.success(`Prislista "${newPL.name}" skapad!`)
    } catch (error) {
      toast.error('Kunde inte kopiera prislista')
    } finally {
      setCopying(false)
    }
  }

  // Hantera ny prislista skapad
  const handlePriceListCreated = async () => {
    setShowCreateModal(false)
    await loadInitialData()
    toast.success('Prislista skapad!')
  }

  // Toggle kategori
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-500 mx-auto mb-4" />
        <p className="text-slate-400">Laddar artiklar och prislistor...</p>
      </div>
    )
  }

  const selectedPriceList = priceLists.find(pl => pl.id === selectedPriceListId)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Sektion A: Prislisteväljare */}
      <Card className="p-5 border-slate-700">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Prislista</h3>
          </div>

          <p className="text-sm text-slate-400">
            Välj en befintlig prislista eller skapa en ny för kunden. Priserna i prislistan styr vad som visas i avtalsförslaget och används vid fakturering.
          </p>

          {/* Dropdown */}
          {priceLists.length === 0 ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-400 text-sm">
                Inga prislistor finns ännu. Skapa en ny prislista nedan.
              </p>
            </div>
          ) : (
            <select
              value={selectedPriceListId || ''}
              onChange={(e) => {
                onPriceListChange(e.target.value || null)
                // Rensa valda artiklar vid byte av prislista
                onSelectionChange([])
              }}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">-- Välj prislista --</option>
              {priceLists.map(pl => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} {pl.is_default ? '(Standard)' : ''} {pl.description ? `- ${pl.description}` : ''}
                </option>
              ))}
            </select>
          )}

          {/* Åtgärdsknappar */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="text-purple-400 border-purple-500/50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Ny prislista
            </Button>

            {selectedPriceListId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCopySourceId(selectedPriceListId)
                  setCopyName(`${selectedPriceList?.name || 'Prislista'} - Kundkopia`)
                  setShowCopyDialog(true)
                }}
                className="text-blue-400 border-blue-500/50"
              >
                <Copy className="w-4 h-4 mr-1" />
                Kopiera & anpassa
              </Button>
            )}

            <a
              href="/admin/settings/price-lists"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Hantera prislistor
            </a>
          </div>

          {/* Vald prislista info */}
          {selectedPriceList && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-purple-400 font-medium text-sm">{selectedPriceList.name}</span>
                  {selectedPriceList.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedPriceList.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">
                    {priceListItems.length} artiklar med specialpris
                  </span>
                  {selectedArticles.length > 0 && (
                    <div className="text-xs text-green-400 font-medium mt-0.5">
                      {selectedArticles.length} av {articles.length} artiklar valda
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Sektion B: Artikelgrid (visas efter prislisteval) */}
      {selectedPriceListId && (
        <>
          {/* Sök och filter */}
          <div className="space-y-3">
            <Input
              placeholder="Sök artiklar (namn, kod, beskrivning)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                Alla ({articles.length})
              </Button>
              {(Object.keys(CATEGORY_CONFIG) as ArticleCategory[]).map(category => {
                const count = articles.filter(a => a.category === category).length
                if (count === 0) return null
                const config = CATEGORY_CONFIG[category]
                return (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    <span className="mr-1">{config.icon}</span>
                    {config.label} ({count})
                  </Button>
                )
              })}
            </div>
          </div>

          {loadingItems ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Laddar prisuppgifter...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(CATEGORY_CONFIG) as ArticleCategory[]).map(category => {
                const categoryArticles = groupedArticles[category]
                if (categoryArticles.length === 0) return null

                const config = CATEGORY_CONFIG[category]
                const isExpanded = expandedCategories.has(category)

                return (
                  <div key={category} className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                    {/* Kategori-header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-xl">{config.icon}</span>
                      <span className="text-white font-medium">{config.label}</span>
                      <span className="text-xs text-slate-500">
                        {categoryArticles.length} {categoryArticles.length === 1 ? 'artikel' : 'artiklar'}
                      </span>
                    </button>

                    {/* Artiklar */}
                    {isExpanded && (
                      <div className="border-t border-slate-700/50">
                        {categoryArticles.map(article => {
                          const qty = getSelectedQuantity(article.id)
                          const effectivePrice = getEffectivePrice(article)
                          const priceSource = getPriceSource(article)
                          const isSelected = qty > 0

                          return (
                            <div
                              key={article.id}
                              className={`flex items-center gap-3 px-4 py-3 border-b border-slate-700/30 last:border-b-0 transition-colors ${
                                isSelected ? 'bg-green-500/5' : 'hover:bg-slate-700/20'
                              }`}
                            >
                              {/* Artikelinfo */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-white text-sm font-medium truncate">
                                    {article.name}
                                  </span>
                                  <span className="text-xs text-slate-500 font-mono">{article.code}</span>
                                  {article.rot_eligible && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
                                      <ShieldCheck className="w-3 h-3" />
                                      ROT
                                    </span>
                                  )}
                                  {article.rut_eligible && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                                      <Leaf className="w-3 h-3" />
                                      RUT
                                    </span>
                                  )}
                                </div>
                                {article.description && (
                                  <p className="text-xs text-slate-500 truncate mt-0.5">{article.description}</p>
                                )}
                              </div>

                              {/* Enhet */}
                              <span className="text-xs text-slate-500 flex-shrink-0">
                                /{article.unit}
                              </span>

                              {/* Pris */}
                              <div className="text-right flex-shrink-0 w-24">
                                <div className="text-white text-sm font-medium">
                                  {formatArticlePrice(effectivePrice)}
                                </div>
                                {priceSource === 'price_list' ? (
                                  <span className="text-xs text-purple-400">Listpris</span>
                                ) : (
                                  <span className="text-xs text-slate-500">Standardpris</span>
                                )}
                                {customerType === 'company' && (
                                  <div className="text-xs text-slate-600">exkl. moms</div>
                                )}
                              </div>

                              {/* Kvantitetskontroll */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleQuantityChange(article, -1)}
                                  disabled={qty === 0}
                                  className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>

                                <span className={`w-8 text-center text-sm font-medium ${
                                  isSelected ? 'text-green-400' : 'text-slate-500'
                                }`}>
                                  {qty}
                                </span>

                                <button
                                  onClick={() => handleQuantityChange(article, 1)}
                                  className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Radsumma */}
                              <div className="text-right flex-shrink-0 w-20">
                                {isSelected ? (
                                  <span className="text-green-400 text-sm font-medium">
                                    {formatArticlePrice(effectivePrice * qty)}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-sm">-</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {filteredArticles.length === 0 && articles.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-400">Inga artiklar matchar din sökning</p>
                </div>
              )}

              {articles.length === 0 && (
                <Card className="p-6 text-center">
                  <p className="text-slate-400 mb-3">
                    Inga artiklar finns ännu. Skapa artiklar i inställningarna för att kunna lägga till dem i avtal.
                  </p>
                  <a
                    href="/admin/settings/articles"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Gå till artikelinställningar
                  </a>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Prislistemodal */}
      <PriceListEditModal
        priceList={null}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handlePriceListCreated}
      />

      {/* Kopiera-dialog */}
      {showCopyDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCopyDialog(false)}>
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-blue-400" />
              Kopiera prislista
            </h3>
            <p className="text-sm text-slate-400">
              Skapar en kopia av den valda prislistan som du kan anpassa för denna kund.
            </p>
            <Input
              label="Namn på ny prislista"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              placeholder="T.ex. Kundnamn - Prislista 2026"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(false)}>
                Avbryt
              </Button>
              <Button
                size="sm"
                onClick={handleCopyPriceList}
                disabled={copying || !copyName.trim()}
              >
                {copying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                Skapa kopia
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
