// src/components/admin/customers/ContractContentEditor.tsx
// Inline-editor för avtalsinnehåll (tjänster + interna artiklar) för importerade kunder.
// Skapar samma datastruktur som wizard-/Oneflow-flödet: rad i `contracts` + rader i
// `case_billing_items` (case_type='contract'). Artiklar kopplas till tjänsterader via
// `mapped_service_id` — identiskt med Prisguiden/EditCaseModal.

import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronRight, Search, Package,
  FileSignature, Wrench, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { ServiceCatalogService } from '../../../services/servicesCatalogService'
import { CaseBillingService } from '../../../services/caseBillingService'
import { PriceListService } from '../../../services/priceListService'
import { ImportedCustomerContractService } from '../../../services/importedCustomerContractService'
import type { ServiceWithGroup } from '../../../types/services'
import type { ArticleWithEffectivePrice, CaseBillingItemWithRelations } from '../../../types/caseBilling'
import { ARTICLE_CATEGORY_CONFIG, type ArticleCategory } from '../../../types/articles'

interface ContractContentEditorProps {
  customerId: string
  /** Kallas när data har ändrats så parent kan ladda om t.ex. summering */
  onChange?: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)

export default function ContractContentEditor({ customerId, onChange }: ContractContentEditorProps) {
  const [contractId, setContractId] = useState<string | null>(null)
  const [services, setServices] = useState<CaseBillingItemWithRelations[]>([])
  const [articles, setArticles] = useState<CaseBillingItemWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Katalogdata
  const [availableServices, setAvailableServices] = useState<ServiceWithGroup[]>([])
  const [availableArticles, setAvailableArticles] = useState<ArticleWithEffectivePrice[]>([])
  const [customerServicePrices, setCustomerServicePrices] = useState<Record<string, number>>({})

  // UI-state
  const [showServicePicker, setShowServicePicker] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')
  const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set())
  const [articlePickerForService, setArticlePickerForService] = useState<string | null>(null)
  const [articleSearch, setArticleSearch] = useState('')
  const [articleCategoryFilter, setArticleCategoryFilter] = useState<ArticleCategory | 'all'>('all')

  // Ladda kontraktscontainer + items
  const reload = async () => {
    setLoading(true)
    try {
      // 1. Läs existerande (skapa INTE ännu - vi skapar vid första insert)
      const existing = await ImportedCustomerContractService.findContract(customerId)
      setContractId(existing)

      if (existing) {
        const { services: svc, articles: art } = await ImportedCustomerContractService.getItems(existing)
        setServices(svc)
        setArticles(art)
      } else {
        setServices([])
        setArticles([])
      }
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte läsa avtalsinnehåll')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (customerId) reload()
  }, [customerId])

  // Ladda kataloger en gång
  useEffect(() => {
    ServiceCatalogService.getAllActiveServices().then(setAvailableServices).catch(console.error)
    CaseBillingService.getArticlesWithPrices(customerId).then(setAvailableArticles).catch(console.error)
    PriceListService.getCustomerServicePrices(customerId).then(setCustomerServicePrices).catch(console.error)
  }, [customerId])

  // Säkerställ container innan insert
  const ensureContract = async (): Promise<string> => {
    if (contractId) return contractId
    const id = await ImportedCustomerContractService.getOrCreateContract(customerId)
    setContractId(id)
    return id
  }

  // --- Mutationer ---
  const addService = async (svc: ServiceWithGroup) => {
    if (saving) return
    setSaving(true)
    try {
      const cId = await ensureContract()
      const customerPrice = customerServicePrices[svc.id]
      const unitPrice = customerPrice ?? svc.base_price ?? 0

      await CaseBillingService.addServiceToCase({
        case_id: cId,
        case_type: 'contract',
        customer_id: customerId,
        service_id: svc.id,
        service_code: svc.code,
        service_name: svc.name,
        quantity: 1,
        unit_price: unitPrice,
        vat_rate: 25,
      })
      await reload()
      onChange?.()
      setServiceSearch('')
      toast.success(`${svc.name} tillagd`)
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte lägga till tjänst')
    } finally {
      setSaving(false)
    }
  }

  const addArticle = async (serviceItemId: string, art: ArticleWithEffectivePrice) => {
    if (saving) return
    setSaving(true)
    try {
      const cId = contractId
      if (!cId) throw new Error('Kontrakt saknas')

      const created = await CaseBillingService.addArticleToCase({
        case_id: cId,
        case_type: 'contract',
        customer_id: customerId,
        article_id: art.article.id,
        article_code: art.article.code,
        article_name: art.article.name,
        quantity: 1,
        unit_price: art.effective_price,
        vat_rate: art.article.vat_rate ?? 25,
        price_source: 'standard',
      })
      // Koppla artikeln till tjänsteraden via mapped_service_id
      await CaseBillingService.updateCaseArticle(created.id, { mapped_service_id: serviceItemId })
      await reload()
      onChange?.()
      setArticleSearch('')
      toast.success(`${art.article.name} kopplad`)
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte lägga till artikel')
    } finally {
      setSaving(false)
    }
  }

  const removeItem = async (id: string) => {
    if (saving) return
    setSaving(true)
    try {
      await CaseBillingService.removeCaseArticle(id)
      await reload()
      onChange?.()
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte ta bort rad')
    } finally {
      setSaving(false)
    }
  }

  const updateQuantity = async (id: string, newQty: number) => {
    if (saving || newQty < 1) return
    setSaving(true)
    try {
      await CaseBillingService.updateCaseArticle(id, { quantity: newQty })
      await reload()
      onChange?.()
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte uppdatera antal')
    } finally {
      setSaving(false)
    }
  }

  // --- Filtrerade listor ---
  const addedServiceIds = useMemo(() => new Set(services.map(s => s.service_id).filter(Boolean)), [services])
  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase()
    return availableServices
      .filter(s => !addedServiceIds.has(s.id))
      .filter(s => !term || s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term))
  }, [availableServices, addedServiceIds, serviceSearch])

  const filteredArticles = useMemo(() => {
    const term = articleSearch.trim().toLowerCase()
    return availableArticles.filter(a => {
      if (articleCategoryFilter !== 'all' && a.article.category !== articleCategoryFilter) return false
      if (!term) return true
      return (
        a.article.name.toLowerCase().includes(term) ||
        a.article.code.toLowerCase().includes(term)
      )
    })
  }, [availableArticles, articleSearch, articleCategoryFilter])

  const articlesForService = (svcItemId: string) =>
    articles.filter(a => a.mapped_service_id === svcItemId)

  const toggleExpanded = (id: string) => {
    setExpandedServiceIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
      </div>
    )
  }

  const totalValue = services.reduce((sum, s) => sum + (s.total_price || 0), 0)

  return (
    <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileSignature className="w-4 h-4 text-[#20c58f]" />
          <h4 className="text-sm font-semibold text-white">Ingår i avtalet</h4>
          {services.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-[#20c58f]/20 text-[#20c58f]">
              {services.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowServicePicker(v => !v); setServiceSearch('') }}
          disabled={saving}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#20c58f] hover:bg-[#1bb07e] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {showServicePicker ? <ChevronDown className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showServicePicker ? 'Stäng' : 'Lägg till tjänst'}
        </button>
      </div>

      {/* Tjänste-picker */}
      {showServicePicker && (
        <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Sök tjänst (namn, kod)..."
              value={serviceSearch}
              onChange={e => setServiceSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
            />
          </div>
          {filteredServices.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center">
              {availableServices.length === 0 ? 'Inga tjänster i katalogen' : 'Inga matchar sökningen'}
            </p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredServices.map(svc => {
                const customerPrice = customerServicePrices[svc.id]
                const displayPrice = customerPrice ?? svc.base_price ?? 0
                const hasCustomerPrice = customerPrice != null
                return (
                  <button
                    key={svc.id}
                    onClick={() => addService(svc)}
                    disabled={saving}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/40 hover:bg-slate-800/60 rounded-lg transition-colors disabled:opacity-50 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Wrench className="w-3.5 h-3.5 text-[#20c58f] shrink-0" />
                        <span className="text-sm text-white font-medium truncate">{svc.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{svc.code}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[#20c58f] text-sm font-medium">{fmt(displayPrice)}</span>
                        {hasCustomerPrice && (
                          <span className="text-[10px] px-1 py-0.5 bg-[#20c58f]/20 text-[#20c58f] rounded">Fast pris</span>
                        )}
                        {!hasCustomerPrice && svc.base_price == null && (
                          <span className="text-[10px] text-orange-400">Pris saknas</span>
                        )}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-[#20c58f] ml-2 shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Lista med tillagda tjänster */}
      {services.length === 0 ? (
        <div className="text-center py-4">
          <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-500">Inga tjänster registrerade</p>
          <p className="text-xs text-slate-600 mt-0.5">Klicka "Lägg till tjänst" för att registrera avtalsinnehåll</p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map(svc => {
            const isExp = expandedServiceIds.has(svc.id)
            const svcArticles = articlesForService(svc.id)
            const isArticlePickerOpen = articlePickerForService === svc.id
            return (
              <div key={svc.id} className="px-3 py-2 bg-slate-800/40 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleExpanded(svc.id)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  >
                    {isExp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <Wrench className="w-3.5 h-3.5 text-[#20c58f] shrink-0" />
                    <span className="text-sm font-medium text-white truncate">{svc.service_name}</span>
                    <span className="text-xs text-slate-500">× {svc.quantity}</span>
                    {svcArticles.length > 0 && (
                      <span className="text-[10px] px-1 py-0.5 bg-slate-700 text-slate-400 rounded">
                        {svcArticles.length} artikel{svcArticles.length === 1 ? '' : 'ar'}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-[#20c58f] font-medium">{fmt(svc.total_price || 0)}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => updateQuantity(svc.id, svc.quantity - 1)}
                        disabled={saving || svc.quantity <= 1}
                        className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 transition-colors"
                        title="Minska antal"
                      >
                        <span className="block w-3.5 h-3.5 leading-none text-center">−</span>
                      </button>
                      <span className="w-6 text-center text-xs text-white font-mono">{svc.quantity}</span>
                      <button
                        onClick={() => updateQuantity(svc.id, svc.quantity + 1)}
                        disabled={saving}
                        className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 transition-colors"
                        title="Öka antal"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(svc.id)}
                      disabled={saving}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded disabled:opacity-30"
                      title="Ta bort tjänst"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanderad: interna artiklar */}
                {isExp && (
                  <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">Interna artiklar (kalkyl)</span>
                      <button
                        onClick={() => {
                          setArticlePickerForService(isArticlePickerOpen ? null : svc.id)
                          setArticleSearch('')
                          setArticleCategoryFilter('all')
                        }}
                        disabled={saving}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors disabled:opacity-50"
                      >
                        {isArticlePickerOpen ? <ChevronDown className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {isArticlePickerOpen ? 'Stäng' : 'Lägg till artikel'}
                      </button>
                    </div>

                    {/* Artikel-picker */}
                    {isArticlePickerOpen && (
                      <div className="p-2 bg-slate-900/40 border border-slate-700/50 rounded-lg space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Sök artikel..."
                            value={articleSearch}
                            onChange={e => setArticleSearch(e.target.value)}
                            className="w-full pl-7 pr-3 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setArticleCategoryFilter('all')}
                            className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${articleCategoryFilter === 'all' ? 'bg-[#20c58f] text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}
                          >
                            Alla
                          </button>
                          {(Object.keys(ARTICLE_CATEGORY_CONFIG) as ArticleCategory[]).map(cat => (
                            <button
                              key={cat}
                              onClick={() => setArticleCategoryFilter(cat)}
                              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${articleCategoryFilter === cat ? 'bg-[#20c58f] text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}
                            >
                              {ARTICLE_CATEGORY_CONFIG[cat].label}
                            </button>
                          ))}
                        </div>
                        {filteredArticles.length === 0 ? (
                          <p className="text-[11px] text-slate-500 py-2 text-center">Inga artiklar matchar</p>
                        ) : (
                          <div className="space-y-0.5 max-h-48 overflow-y-auto">
                            {filteredArticles.map(a => {
                              const cfg = ARTICLE_CATEGORY_CONFIG[a.article.category]
                              return (
                                <button
                                  key={a.article.id}
                                  onClick={() => addArticle(svc.id, a)}
                                  disabled={saving}
                                  className="w-full flex items-center justify-between px-2 py-1 bg-slate-800/40 hover:bg-slate-800/60 rounded transition-colors disabled:opacity-50 text-left"
                                >
                                  <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-1 py-0.5 text-[9px] rounded ${cfg?.bgColor ?? ''} ${cfg?.color ?? ''}`}>
                                      {cfg?.label}
                                    </span>
                                    <span className="text-xs text-white truncate">{a.article.name}</span>
                                    <span className="text-[10px] text-slate-500">{fmt(a.effective_price)}</span>
                                  </div>
                                  <Plus className="w-3.5 h-3.5 text-[#20c58f] ml-2 shrink-0" />
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Lista med artiklar */}
                    {svcArticles.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic pl-1">Inga interna artiklar kopplade</p>
                    ) : (
                      <ul className="space-y-1">
                        {svcArticles.map(art => (
                          <li key={art.id} className="flex items-center justify-between px-2 py-1 bg-slate-900/40 rounded">
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-white truncate">{art.article_name}</span>
                              <span className="text-[10px] text-slate-500">
                                {fmt(art.unit_price)} intern kostnad
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => updateQuantity(art.id, art.quantity - 1)}
                                  disabled={saving || art.quantity <= 1}
                                  className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 transition-colors"
                                >
                                  <span className="block w-3 h-3 leading-none text-center text-xs">−</span>
                                </button>
                                <span className="w-5 text-center text-[11px] text-white font-mono">{art.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(art.id, art.quantity + 1)}
                                  disabled={saving}
                                  className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <button
                                onClick={() => removeItem(art.id)}
                                disabled={saving}
                                className="p-0.5 text-slate-600 hover:text-red-400 transition-colors rounded disabled:opacity-30"
                                title="Ta bort artikel"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Summering */}
          <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center text-xs">
            <span className="text-slate-400">Totalt avtalsinnehåll (exkl. moms)</span>
            <span className="text-white font-semibold text-sm">{fmt(totalValue)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
