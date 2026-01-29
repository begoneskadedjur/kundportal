// src/components/admin/settings/ArticleEditModal.tsx
// Modal för att skapa/redigera artikel

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Save,
  Package,
  Loader2,
  FileText,
  Check
} from 'lucide-react'
import { ArticleService } from '../../../services/articleService'
import { PriceListService } from '../../../services/priceListService'
import { ArticleGroupService } from '../../../services/articleGroupService'
import {
  Article,
  ArticleGroup,
  CreateArticleInput,
  ArticleUnit,
  ArticleCategory,
  PriceList,
  ARTICLE_UNITS,
  ARTICLE_CATEGORIES,
  ARTICLE_UNIT_CONFIG,
  ARTICLE_CATEGORY_CONFIG,
  generateArticleCode,
  formatArticlePrice,
  calculatePriceWithVat
} from '../../../types/articles'
import toast from 'react-hot-toast'

interface ArticleEditModalProps {
  article: Article | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function ArticleEditModal({
  article,
  isOpen,
  onClose,
  onSave
}: ArticleEditModalProps) {
  const isEditing = article !== null

  // Form state
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState<ArticleUnit>('st')
  const [defaultPrice, setDefaultPrice] = useState('')
  const [vatRate, setVatRate] = useState('25')
  const [category, setCategory] = useState<ArticleCategory>('Övrigt')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)

  // Gruppstate
  const [groups, setGroups] = useState<ArticleGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)

  // Prislista-state
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [selectedPriceListIds, setSelectedPriceListIds] = useState<string[]>([])
  const [loadingPriceLists, setLoadingPriceLists] = useState(false)

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Ladda grupper och prislistor
  useEffect(() => {
    const loadData = async () => {
      setLoadingGroups(true)
      setLoadingPriceLists(true)
      try {
        const [groupsData, listsData] = await Promise.all([
          ArticleGroupService.getActiveGroups(),
          PriceListService.getActivePriceLists()
        ])
        setGroups(groupsData)
        setPriceLists(listsData)
        // Förväl standardprislistan för nya artiklar
        if (!article) {
          const defaultList = listsData.find(l => l.is_default)
          if (defaultList) {
            setSelectedPriceListIds([defaultList.id])
          }
        }
      } catch (error) {
        console.error('Kunde inte ladda data:', error)
      } finally {
        setLoadingGroups(false)
        setLoadingPriceLists(false)
      }
    }
    if (isOpen) {
      loadData()
    }
  }, [isOpen, article])

  // Fyll i formulär vid redigering
  useEffect(() => {
    if (article) {
      setCode(article.code)
      setName(article.name)
      setDescription(article.description || '')
      setUnit(article.unit)
      setDefaultPrice(article.default_price.toString())
      setVatRate(article.vat_rate.toString())
      setCategory(article.category)
      setGroupId(article.group_id)
      setIsActive(article.is_active)
      setSelectedPriceListIds([]) // Vid redigering behåller vi inte prislista-val
    } else {
      // Återställ för ny
      setCode('')
      setName('')
      setDescription('')
      setUnit('st')
      setDefaultPrice('')
      setVatRate('25')
      setCategory('Övrigt')
      setGroupId(null)
      setIsActive(true)
      // selectedPriceListIds hanteras i loadPriceLists
    }
    setErrors({})
  }, [article, isOpen])

  // Auto-generera kod från namn och kategori
  useEffect(() => {
    if (!isEditing && name && category) {
      const generatedCode = generateArticleCode(name, category)
      setCode(generatedCode)
    }
  }, [name, category, isEditing])

  // Validera formulär
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!code.trim()) {
      newErrors.code = 'Artikelkod krävs'
    }
    if (!name.trim()) {
      newErrors.name = 'Namn krävs'
    }
    if (!defaultPrice || parseFloat(defaultPrice) < 0) {
      newErrors.defaultPrice = 'Giltigt pris krävs'
    }
    if (!vatRate || parseFloat(vatRate) < 0 || parseFloat(vatRate) > 100) {
      newErrors.vatRate = 'Giltig momssats krävs (0-100)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Toggle prislista-val
  const handleTogglePriceList = (priceListId: string) => {
    setSelectedPriceListIds(prev =>
      prev.includes(priceListId)
        ? prev.filter(id => id !== priceListId)
        : [...prev, priceListId]
    )
  }

  // Spara
  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      const input: CreateArticleInput = {
        code: code.toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        unit,
        default_price: parseFloat(defaultPrice),
        vat_rate: parseFloat(vatRate),
        category,
        group_id: groupId,
        is_active: isActive
      }

      let savedArticle: Article

      if (isEditing && article) {
        savedArticle = await ArticleService.updateArticle(article.id, input)
        toast.success('Artikel uppdaterad')
      } else {
        savedArticle = await ArticleService.createArticle(input)

        // Lägg till artikeln i valda prislistor
        if (selectedPriceListIds.length > 0) {
          for (const priceListId of selectedPriceListIds) {
            await PriceListService.upsertPriceListItem({
              price_list_id: priceListId,
              article_id: savedArticle.id,
              custom_price: parseFloat(defaultPrice),
              discount_percent: 0
            })
          }
          toast.success(`Artikel skapad och tillagd i ${selectedPriceListIds.length} prislista(or)`)
        } else {
          toast.success('Artikel skapad')
        }
      }

      onSave()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  // Beräkna pris med moms för förhandsgranskning
  const pricePreview = defaultPrice
    ? {
        exVat: parseFloat(defaultPrice),
        incVat: calculatePriceWithVat(parseFloat(defaultPrice), parseFloat(vatRate) || 25)
      }
    : null

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              {isEditing ? 'Redigera artikel' : 'Ny artikel'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Kategori */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Kategori <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ARTICLE_CATEGORIES.map((cat) => {
                const config = ARTICLE_CATEGORY_CONFIG[cat]
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      category === cat
                        ? `${config.bgColor} ${config.color} border-2 ${config.borderColor}`
                        : 'bg-slate-700 text-slate-300 border-2 border-transparent hover:bg-slate-600'
                    }`}
                  >
                    {config.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grupp */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Artikelgrupp
            </label>
            {loadingGroups ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Laddar grupper...
              </div>
            ) : groups.length === 0 ? (
              <p className="text-slate-500 text-sm">Inga grupper skapade än. Hantera grupper via kugghjulsikonen på artikelsidan.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setGroupId(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    groupId === null
                      ? 'bg-slate-600 text-white border-2 border-slate-500'
                      : 'bg-slate-700 text-slate-400 border-2 border-transparent hover:bg-slate-600'
                  }`}
                >
                  Ingen
                </button>
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setGroupId(group.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${
                      groupId === group.id
                        ? ''
                        : 'bg-slate-700 text-slate-300 border-transparent hover:bg-slate-600'
                    }`}
                    style={groupId === group.id ? {
                      backgroundColor: `${group.color}20`,
                      borderColor: `${group.color}50`,
                      color: group.color
                    } : undefined}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Namn */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Namn <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Inspektion skadedjur"
              className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
              }`}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Kod */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Artikelkod <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="T.ex. INS-SKA"
              disabled={isEditing}
              className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 font-mono ${
                isEditing ? 'opacity-50 cursor-not-allowed' : ''
              } ${errors.code ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'}`}
            />
            {errors.code && <p className="text-red-400 text-xs mt-1">{errors.code}</p>}
            {!isEditing && (
              <p className="text-slate-500 text-xs mt-1">Genereras automatiskt men kan anpassas</p>
            )}
          </div>

          {/* Beskrivning */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Beskrivning
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Valfri beskrivning av artikeln"
              rows={2}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Pris och Moms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Pris (exkl. moms) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className={`w-full px-4 py-2 pr-12 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                    errors.defaultPrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">kr</span>
              </div>
              {errors.defaultPrice && <p className="text-red-400 text-xs mt-1">{errors.defaultPrice}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Momssats <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white focus:outline-none focus:ring-2 ${
                    errors.vatRate ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  }`}
                >
                  <option value="25">25%</option>
                  <option value="12">12%</option>
                  <option value="6">6%</option>
                  <option value="0">0%</option>
                </select>
              </div>
              {errors.vatRate && <p className="text-red-400 text-xs mt-1">{errors.vatRate}</p>}
            </div>
          </div>

          {/* Prisförhandsgranskning */}
          {pricePreview && (
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-sm text-slate-400 mb-1">Prisförhandsgranskning</p>
              <div className="flex items-center gap-4">
                <span className="text-white">
                  {formatArticlePrice(pricePreview.exVat)} <span className="text-slate-500">exkl. moms</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-white font-medium">
                  {formatArticlePrice(pricePreview.incVat)} <span className="text-slate-500">inkl. moms</span>
                </span>
              </div>
            </div>
          )}

          {/* Enhet */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Enhet <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ARTICLE_UNITS.map((u) => {
                const config = ARTICLE_UNIT_CONFIG[u]
                return (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      unit === u
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {config.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Aktiv */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-white">Aktiv</span>
            <span className="text-slate-500 text-sm">(kan väljas vid fakturering)</span>
          </label>

          {/* Prislistor - endast för nya artiklar */}
          {!isEditing && (
            <div className="border-t border-slate-700 pt-5">
              <label className="block text-sm font-medium text-white mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Lägg till i prislistor
                </div>
              </label>
              {loadingPriceLists ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Laddar prislistor...
                </div>
              ) : priceLists.length === 0 ? (
                <p className="text-slate-500 text-sm">Inga prislistor finns. Skapa en prislista först.</p>
              ) : (
                <div className="space-y-2">
                  {priceLists.map(pl => {
                    const isSelected = selectedPriceListIds.includes(pl.id)
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => handleTogglePriceList(pl.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-500/50 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-purple-500 border-purple-500'
                              : 'border-slate-600'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="font-medium">{pl.name}</span>
                          {pl.is_default && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                              Standard
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                  <p className="text-slate-500 text-xs mt-2">
                    Artikeln läggs till med standardpriset i valda prislistor
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Spara ändringar' : 'Skapa artikel'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
