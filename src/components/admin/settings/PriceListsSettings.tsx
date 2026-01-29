// src/components/admin/settings/PriceListsSettings.tsx
// Huvudkomponent för hantering av prislistor i admin

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ArrowLeft,
  Loader2,
  FileText,
  AlertTriangle,
  RefreshCw,
  Star,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Edit2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PriceListService } from '../../../services/priceListService'
import { ArticleService } from '../../../services/articleService'
import { PriceList, Article } from '../../../types/articles'
import { PriceListEditModal } from './PriceListEditModal'
import { PriceListItemsEditor } from './PriceListItemsEditor'
import { ArticlePriceListNav } from './ArticlePriceListNav'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

export function PriceListsSettings() {
  const navigate = useNavigate()
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [expandedListId, setExpandedListId] = useState<string | null>(null)
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})

  // Ladda data vid mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [priceListsData, articlesData] = await Promise.all([
        PriceListService.getAllPriceLists(),
        ArticleService.getActiveArticles()
      ])
      setPriceLists(priceListsData)
      setArticles(articlesData)

      // Ladda antal artiklar per prislista
      const counts: Record<string, number> = {}
      for (const pl of priceListsData) {
        counts[pl.id] = await PriceListService.getItemCount(pl.id)
      }
      setItemCounts(counts)
    } catch (error) {
      console.error('Fel vid laddning av prislistor:', error)
      toast.error('Kunde inte ladda prislistor')
    } finally {
      setLoading(false)
    }
  }

  // Hantera kopiera prislista
  const handleCopy = async (priceList: PriceList) => {
    try {
      await PriceListService.copyPriceList(priceList.id, `${priceList.name} (kopia)`)
      toast.success('Prislista kopierad')
      loadData()
    } catch (error) {
      console.error('Fel vid kopiering:', error)
      toast.error('Kunde inte kopiera prislistan')
    }
  }

  // Hantera sätt som standard
  const handleSetDefault = async (id: string) => {
    try {
      await PriceListService.updatePriceList(id, { is_default: true })
      toast.success('Standardprislista uppdaterad')
      loadData()
    } catch (error) {
      console.error('Fel vid uppdatering:', error)
      toast.error('Kunde inte sätta som standard')
    }
  }

  // Hantera borttagning
  const handleDelete = async (id: string) => {
    try {
      await PriceListService.deletePriceList(id)
      toast.success('Prislista borttagen')
      if (expandedListId === id) setExpandedListId(null)
      loadData()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort prislistan')
    }
  }

  // Hantera sparande
  const handleSave = async () => {
    setEditingPriceList(null)
    setIsCreateModalOpen(false)
    loadData()
  }

  // Beräkna statistik
  const defaultList = priceLists.find(pl => pl.is_default)
  const activeCount = priceLists.filter(pl => pl.is_active).length

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Prislistor</h1>
              <p className="text-slate-400 text-sm">
                Hantera prislistor med kundspecifika priser
              </p>
            </div>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-white">{priceLists.length}</p>
            <p className="text-sm text-slate-400">Prislistor</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            <p className="text-sm text-slate-400">Aktiva</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-white">{articles.length}</p>
            <p className="text-sm text-slate-400">Artiklar</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ArticlePriceListNav />

      {/* Åtgärder */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Alla prislistor</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Ny prislista
          </Button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : priceLists.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-4">Inga prislistor skapade</p>
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Skapa första prislistan
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {priceLists.map((priceList) => (
              <motion.div
                key={priceList.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all ${
                  priceList.is_active
                    ? priceList.is_default
                      ? 'border-purple-500/50'
                      : 'border-slate-700/50'
                    : 'border-slate-700/30 opacity-60'
                }`}
              >
                {/* Prislista-header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium text-lg">{priceList.name}</h3>
                        {priceList.is_default && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
                            <Star className="w-3 h-3" />
                            Standard
                          </span>
                        )}
                        {!priceList.is_active && (
                          <span className="px-2 py-0.5 bg-slate-600 rounded text-xs text-slate-400">
                            Inaktiv
                          </span>
                        )}
                      </div>

                      {priceList.description && (
                        <p className="text-slate-400 text-sm mb-2">{priceList.description}</p>
                      )}

                      <p className="text-slate-500 text-sm">
                        {itemCounts[priceList.id] || 0} artikelpriser definierade
                      </p>
                    </div>

                    {/* Åtgärder */}
                    <div className="flex items-center gap-1">
                      {!priceList.is_default && (
                        <button
                          onClick={() => handleSetDefault(priceList.id)}
                          className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors"
                          title="Sätt som standard"
                        >
                          <Star className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(priceList)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Kopiera"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setEditingPriceList(priceList)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Redigera"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      {!priceList.is_default && (
                        <button
                          onClick={() => handleDelete(priceList.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Ta bort"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedListId(expandedListId === priceList.id ? null : priceList.id)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        {expandedListId === priceList.id ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanderad: Artikelpriser */}
                <AnimatePresence>
                  {expandedListId === priceList.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-700/50 overflow-hidden"
                    >
                      <PriceListItemsEditor
                        priceListId={priceList.id}
                        articles={articles}
                        onUpdate={() => loadData()}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info om standard */}
      {!defaultList && priceLists.length > 0 && (
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-medium">Ingen standardprislista vald</p>
              <p className="text-sm text-slate-400 mt-1">
                Välj en prislista som standard genom att klicka på stjärnikonen.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingPriceList && (
          <PriceListEditModal
            priceList={editingPriceList}
            isOpen={true}
            onClose={() => setEditingPriceList(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <PriceListEditModal
            priceList={null}
            isOpen={true}
            onClose={() => setIsCreateModalOpen(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
