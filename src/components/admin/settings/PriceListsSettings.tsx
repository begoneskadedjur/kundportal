// src/components/admin/settings/PriceListsSettings.tsx
// Huvudkomponent för hantering av prislistor i admin

import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  Plus,
  ArrowLeft,
  Loader2,
  FileText,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PriceListService } from '../../../services/priceListService'
import { ArticleService } from '../../../services/articleService'
import { PriceList, Article } from '../../../types/articles'
import { PriceListEditModal } from './PriceListEditModal'
import { PriceListsTable } from './PriceListsTable'
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

  // Loading states för actions
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    setSettingDefaultId(id)
    try {
      await PriceListService.updatePriceList(id, { is_default: true })
      toast.success('Standardprislista uppdaterad')
      loadData()
    } catch (error) {
      console.error('Fel vid uppdatering:', error)
      toast.error('Kunde inte sätta som standard')
    } finally {
      setSettingDefaultId(null)
    }
  }

  // Hantera borttagning
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await PriceListService.deletePriceList(id)
      toast.success('Prislista borttagen')
      if (expandedListId === id) setExpandedListId(null)
      loadData()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort prislistan')
    } finally {
      setDeletingId(null)
    }
  }

  // Hantera sparande
  const handleSave = async () => {
    setEditingPriceList(null)
    setIsCreateModalOpen(false)
    loadData()
  }

  // Toggle expand
  const handleToggleExpand = (id: string) => {
    setExpandedListId(expandedListId === id ? null : id)
  }

  // Beräkna statistik
  const defaultList = priceLists.find(pl => pl.is_default)
  const activeCount = priceLists.filter(pl => pl.is_active).length

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Bakgrund */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-purple-500/5" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
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
        </div>

        {/* Navigation */}
        <div className="mb-6">
          <ArticlePriceListNav />
        </div>

        {/* KPI-kort */}
        <div className="grid grid-cols-3 gap-4 mb-6">
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

        {/* Åtgärder */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-400">
            Visar {priceLists.length} prislistor
          </div>
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

        {/* Tabell */}
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
          <PriceListsTable
            priceLists={priceLists}
            itemCounts={itemCounts}
            articles={articles}
            expandedListId={expandedListId}
            onToggleExpand={handleToggleExpand}
            onEdit={setEditingPriceList}
            onCopy={handleCopy}
            onSetDefault={handleSetDefault}
            onDelete={handleDelete}
            onUpdateItems={loadData}
            settingDefaultId={settingDefaultId}
            deletingId={deletingId}
          />
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
    </div>
  )
}
