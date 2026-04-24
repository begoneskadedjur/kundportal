// src/components/admin/settings/PriceListArticleItemsSection.tsx
// Artikel-tabben i prislisteditorn: sök + välj artiklar, sätt fast kundpris eller
// mängdrabatt (quantity tiers) per artikel. Används för avropsavtal som har
// överenskomna priser på inköpta artiklar (t.ex. "1-2 st 5990 kr, 3-5 st 5390 kr").

import { useState, useEffect, useMemo } from 'react'
import {
  Loader2, Search, Plus, Trash2, X, Layers, ChevronDown, ChevronRight, Save
} from 'lucide-react'
import { PriceListService } from '../../../services/priceListService'
import { ArticleService } from '../../../services/articleService'
import type {
  PriceListItemWithArticle,
  QuantityTier,
  ArticleWithGroup,
} from '../../../types/articles'
import { getArticleGroups } from '../../../types/articles'
import toast from 'react-hot-toast'

interface Props {
  priceListId: string
  onUpdate: () => void
}

interface RowState {
  customPrice: string
  tiers: QuantityTier[] | null
  expanded: boolean
  dirty: boolean
  saving: boolean
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n)

const tierSummary = (tiers: QuantityTier[] | null): string => {
  if (!tiers || tiers.length === 0) return '—'
  return tiers
    .slice()
    .sort((a, b) => a.min_qty - b.min_qty)
    .map(t => `${formatPrice(t.unit_price)}`)
    .join(' / ')
}

const validateTiers = (tiers: QuantityTier[]): string | null => {
  if (tiers.length === 0) return null
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty)
  if (sorted[0].min_qty !== 1) return 'Första nivån måste starta på 1'
  const seen = new Set<number>()
  for (const t of sorted) {
    if (!Number.isInteger(t.min_qty) || t.min_qty < 1) return 'Min-antal måste vara ett heltal ≥ 1'
    if (seen.has(t.min_qty)) return 'Duplicerade min-antal är inte tillåtna'
    seen.add(t.min_qty)
    if (!Number.isFinite(t.unit_price) || t.unit_price < 0) return 'Priset måste vara ett positivt tal'
  }
  return null
}

export function PriceListArticleItemsSection({ priceListId, onUpdate }: Props) {
  const [items, setItems] = useState<PriceListItemWithArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [states, setStates] = useState<Record<string, RowState>>({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allArticles, setAllArticles] = useState<ArticleWithGroup[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [loadingArticles, setLoadingArticles] = useState(false)

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceListId])

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await PriceListService.getPriceListItems(priceListId)
      setItems(data)
      const init: Record<string, RowState> = {}
      data.forEach(it => {
        if (it.article_id) {
          init[it.article_id] = {
            customPrice: String(it.custom_price ?? 0),
            tiers: (it.quantity_tiers ?? null) as QuantityTier[] | null,
            expanded: false,
            dirty: false,
            saving: false,
          }
        }
      })
      setStates(init)
    } catch (err) {
      console.error('Kunde inte ladda artikelpriser', err)
      toast.error('Kunde inte ladda artikelpriser')
    } finally {
      setLoading(false)
    }
  }

  const openPicker = async () => {
    setPickerOpen(true)
    if (allArticles.length === 0) {
      setLoadingArticles(true)
      try {
        const data = await ArticleService.getAllArticlesWithGroups()
        setAllArticles(data.filter(a => a.is_active))
      } catch (err) {
        console.error(err)
        toast.error('Kunde inte ladda artiklar')
      } finally {
        setLoadingArticles(false)
      }
    }
  }

  const addedArticleIds = useMemo(() => new Set(items.map(i => i.article_id!).filter(Boolean)), [items])

  const filteredPickerArticles = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    return allArticles
      .filter(a => !addedArticleIds.has(a.id))
      .filter(a => {
        if (!q) return true
        return (
          a.name.toLowerCase().includes(q) ||
          (a.code || '').toLowerCase().includes(q) ||
          (a.description || '').toLowerCase().includes(q)
        )
      })
      .slice(0, 50)
  }, [allArticles, addedArticleIds, pickerSearch])

  const handleAddArticle = async (article: ArticleWithGroup) => {
    try {
      await PriceListService.upsertPriceListItem({
        price_list_id: priceListId,
        article_id: article.id,
        custom_price: Number(article.default_price) || 0,
        quantity_tiers: null,
      })
      toast.success(`${article.name} tillagd`)
      setPickerOpen(false)
      setPickerSearch('')
      await loadItems()
      onUpdate()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Kunde inte lägga till artikel')
    }
  }

  const handleRemove = async (articleId: string, name: string) => {
    if (!confirm(`Ta bort ${name} från prislistan?`)) return
    try {
      await PriceListService.removePriceListItem(priceListId, articleId)
      toast.success('Artikel borttagen')
      await loadItems()
      onUpdate()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Kunde inte ta bort')
    }
  }

  const updateRow = (articleId: string, patch: Partial<RowState>) => {
    setStates(prev => ({
      ...prev,
      [articleId]: { ...prev[articleId], ...patch, dirty: true },
    }))
  }

  const toggleExpanded = (articleId: string) => {
    setStates(prev => ({
      ...prev,
      [articleId]: { ...prev[articleId], expanded: !prev[articleId]?.expanded },
    }))
  }

  const addTier = (articleId: string) => {
    const cur = states[articleId]
    if (!cur) return
    const existing = cur.tiers ?? []
    const nextMin = existing.length === 0
      ? 1
      : Math.max(...existing.map(t => t.min_qty)) + 1
    const nextPrice = existing.length > 0
      ? existing[existing.length - 1].unit_price
      : Number(cur.customPrice) || 0
    updateRow(articleId, {
      tiers: [...existing, { min_qty: nextMin, unit_price: nextPrice }],
      expanded: true,
    })
  }

  const removeTier = (articleId: string, idx: number) => {
    const cur = states[articleId]
    if (!cur || !cur.tiers) return
    const next = cur.tiers.filter((_, i) => i !== idx)
    updateRow(articleId, { tiers: next.length === 0 ? null : next })
  }

  const updateTier = (articleId: string, idx: number, patch: Partial<QuantityTier>) => {
    const cur = states[articleId]
    if (!cur || !cur.tiers) return
    const next = cur.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t))
    updateRow(articleId, { tiers: next })
  }

  const saveRow = async (item: PriceListItemWithArticle) => {
    const articleId = item.article_id!
    const state = states[articleId]
    if (!state) return

    const customPriceNum = Number(state.customPrice)
    if (!Number.isFinite(customPriceNum) || customPriceNum < 0) {
      toast.error('Ogiltigt fast pris')
      return
    }
    if (state.tiers && state.tiers.length > 0) {
      const err = validateTiers(state.tiers)
      if (err) {
        toast.error(err)
        return
      }
    }

    setStates(prev => ({ ...prev, [articleId]: { ...prev[articleId], saving: true } }))
    try {
      const tiers = state.tiers && state.tiers.length > 0
        ? [...state.tiers].sort((a, b) => a.min_qty - b.min_qty)
        : null
      await PriceListService.upsertPriceListItem({
        price_list_id: priceListId,
        article_id: articleId,
        custom_price: customPriceNum,
        quantity_tiers: tiers,
      })
      toast.success('Sparad')
      await loadItems()
      onUpdate()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Kunde inte spara')
      setStates(prev => ({ ...prev, [articleId]: { ...prev[articleId], saving: false } }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header med lägg-till-knapp */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">
          {items.length === 0
            ? 'Inga artiklar i prislistan än'
            : `${items.length} artiklar med fast pris eller mängdrabatt`}
        </div>
        <button
          onClick={openPicker}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#20c58f]/10 text-[#20c58f] hover:bg-[#20c58f]/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Lägg till artikel
        </button>
      </div>

      {/* Artikel-tabell */}
      {items.length > 0 && (
        <div className="overflow-hidden border border-slate-700 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 w-20">Kod</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Artikel</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Grupp</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Grundpris</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Kundpris</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Mängdrabatter</th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const state = states[item.article_id!]
                if (!state) return null
                const article = item.article
                const groups = getArticleGroups(article as any)
                const hasTiers = !!(state.tiers && state.tiers.length > 0)
                return (
                  <>
                    <tr
                      key={item.article_id}
                      className="border-b border-slate-700/50 hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-2 text-xs font-mono text-slate-400">{article.code || '—'}</td>
                      <td className="px-3 py-2 text-white">{article.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {groups.map(g => (
                            <span key={g.id} className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-700/60 text-slate-300 border border-slate-600">
                              {g.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500 font-mono">
                        {formatPrice(Number(article.default_price) || 0)} kr
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={state.customPrice}
                          onChange={e => updateRow(item.article_id!, { customPrice: e.target.value })}
                          className={`w-24 px-2 py-1 text-sm text-right rounded border bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f] ${
                            hasTiers ? 'border-slate-700 text-slate-500' : 'border-slate-600'
                          }`}
                          disabled={hasTiers}
                          title={hasTiers ? 'Mängdrabatter aktiva — kundpriset styrs av tier-priserna' : 'Fast pris oavsett antal'}
                        />
                        <span className="text-xs text-slate-500 ml-1">kr</span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleExpanded(item.article_id!)}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500"
                        >
                          {state.expanded
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />}
                          <Layers className="w-3 h-3" />
                          <span>{hasTiers ? `${state.tiers!.length} nivåer: ${tierSummary(state.tiers)}` : 'Inga mängdrabatter'}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {state.dirty && (
                            <button
                              onClick={() => saveRow(item)}
                              disabled={state.saving}
                              className="p-1.5 rounded text-[#20c58f] hover:bg-[#20c58f]/10 disabled:opacity-50"
                              title="Spara"
                            >
                              {state.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(item.article_id!, article.name)}
                            className="p-1.5 rounded text-red-400 hover:bg-red-500/10"
                            title="Ta bort från prislistan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {state.expanded && (
                      <tr className="bg-slate-900/40">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-slate-400">
                                Mängdrabatter: lägsta antal → pris/styck. Första nivån måste starta på 1.
                              </div>
                              <button
                                onClick={() => addTier(item.article_id!)}
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500"
                              >
                                <Plus className="w-3 h-3" />
                                Lägg till nivå
                              </button>
                            </div>
                            {!hasTiers ? (
                              <div className="text-xs text-slate-500 italic py-2">
                                Inga mängdrabatter satta — fast pris används oavsett antal. Klicka "Lägg till nivå" för att börja.
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {state.tiers!
                                  .map((t, idx) => ({ t, idx }))
                                  .sort((a, b) => a.t.min_qty - b.t.min_qty)
                                  .map(({ t, idx }) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                      <span className="text-xs text-slate-500 w-12">Från</span>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={t.min_qty}
                                        onChange={e => updateTier(item.article_id!, idx, { min_qty: Number(e.target.value) })}
                                        className="w-20 px-2 py-1 text-sm rounded border bg-slate-800 border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                                      />
                                      <span className="text-xs text-slate-500">st →</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={t.unit_price}
                                        onChange={e => updateTier(item.article_id!, idx, { unit_price: Number(e.target.value) })}
                                        className="w-28 px-2 py-1 text-sm text-right rounded border bg-slate-800 border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                                      />
                                      <span className="text-xs text-slate-500">kr/st</span>
                                      <button
                                        onClick={() => removeTier(item.article_id!, idx)}
                                        className="p-1 text-red-400 hover:bg-red-500/10 rounded ml-auto"
                                        title="Ta bort nivå"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                              </div>
                            )}
                            {state.dirty && (
                              <div className="pt-2 border-t border-slate-700/50 flex justify-end">
                                <button
                                  onClick={() => saveRow(item)}
                                  disabled={state.saving}
                                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-[#20c58f] text-white hover:bg-[#20c58f]/90 disabled:opacity-50"
                                >
                                  {state.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                  Spara ändringar
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Picker-modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Välj artikel</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sök och klicka för att lägga till i prislistan</p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Sök på kod, namn eller beskrivning..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loadingArticles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : filteredPickerArticles.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  {allArticles.length === 0
                    ? 'Inga artiklar hittades'
                    : pickerSearch
                    ? 'Ingen artikel matchar sökningen'
                    : 'Alla artiklar är redan tillagda'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredPickerArticles.map(a => {
                    const groups = getArticleGroups(a)
                    return (
                      <button
                        key={a.id}
                        onClick={() => handleAddArticle(a)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {a.code && (
                              <span className="text-xs font-mono text-slate-500">{a.code}</span>
                            )}
                            <span className="text-sm text-white truncate">{a.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {groups.map(g => (
                              <span key={g.id} className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-700/60 text-slate-300">
                                {g.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 font-mono shrink-0 ml-3">
                          {formatPrice(Number(a.default_price) || 0)} kr
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setPickerOpen(false)}
                className="px-3 py-1.5 text-xs font-medium rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
