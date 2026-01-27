// src/components/admin/settings/PreparationsSettings.tsx
// Huvudkomponent för hantering av preparat i admin

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ArrowLeft,
  Loader2,
  Beaker,
  Search,
  RefreshCw,
  AlertTriangle,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Globe,
  X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PreparationService } from '../../../services/preparationService'
import { Preparation, PREPARATION_CATEGORY_CONFIG, PreparationCategory } from '../../../types/preparations'
import { PreparationEditModal } from './PreparationEditModal'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

export function PreparationsSettings() {
  const navigate = useNavigate()
  const [preparations, setPreparations] = useState<Preparation[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPreparation, setEditingPreparation] = useState<Preparation | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<PreparationCategory | 'all'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Ladda preparat vid mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await PreparationService.getAllPreparations()
      setPreparations(data)
    } catch (error) {
      console.error('Fel vid laddning av preparat:', error)
      toast.error('Kunde inte ladda preparat')
    } finally {
      setLoading(false)
    }
  }

  // Filtrera preparat
  const filteredPreparations = useMemo(() => {
    return preparations.filter(p => {
      const matchesSearch = searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.registration_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.active_substances?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [preparations, searchQuery, categoryFilter])

  // Hantera toggle av aktiv-status
  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await PreparationService.togglePreparationActive(id, isActive)
      toast.success(isActive ? 'Preparat aktiverat' : 'Preparat inaktiverat')
      loadData()
    } catch (error) {
      console.error('Fel vid toggle av status:', error)
      toast.error('Kunde inte ändra status')
    }
  }

  // Hantera borttagning
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await PreparationService.deletePreparation(id)
      toast.success('Preparat borttaget')
      loadData()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort preparatet')
    } finally {
      setDeletingId(null)
    }
  }

  // Hantera sparande
  const handleSave = async () => {
    setEditingPreparation(null)
    setIsCreateModalOpen(false)
    loadData()
  }

  // Beräkna statistik
  const activeCount = preparations.filter(p => p.is_active).length
  const inactiveCount = preparations.filter(p => !p.is_active).length
  const websiteCount = preparations.filter(p => p.show_on_website).length

  return (
    <div className="max-w-6xl mx-auto">
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
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Beaker className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Preparat</h1>
              <p className="text-slate-400 text-sm">
                Hantera bekämpningsmedel och produkter
              </p>
            </div>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-white">{preparations.length}</p>
            <p className="text-sm text-slate-400">Totalt</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            <p className="text-sm text-slate-400">Aktiva</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-slate-400">{inactiveCount}</p>
            <p className="text-sm text-slate-400">Inaktiva</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-blue-400">{websiteCount}</p>
            <p className="text-sm text-slate-400">På hemsidan</p>
          </div>
        </div>
      </div>

      {/* Sök och filter */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Sök preparat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as PreparationCategory | 'all')}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Alla kategorier</option>
            <option value="biocidprodukt">Biocidprodukt</option>
            <option value="giftfritt">Giftfritt</option>
            <option value="desinfektionsmedel">Desinfektionsmedel</option>
          </select>
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
            Nytt preparat
          </Button>
        </div>
      </div>

      {/* Tabell */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : preparations.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <Beaker className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-4">Inga preparat skapade</p>
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Skapa första preparatet
          </Button>
        </div>
      ) : filteredPreparations.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga preparat matchar din sökning</p>
        </div>
      ) : (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/50 border-b border-slate-700/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Produktnamn</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Kategori</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Regnr</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Skadedjur</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Dosering</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Webb</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredPreparations.map((preparation) => {
                    const categoryConfig = PREPARATION_CATEGORY_CONFIG[preparation.category]

                    return (
                      <motion.tr
                        key={preparation.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors ${
                          !preparation.is_active ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-white font-medium">{preparation.name}</p>
                            {preparation.active_substances && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                                {preparation.active_substances}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${categoryConfig.bgColor} ${categoryConfig.color}`}>
                            {categoryConfig.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-sm">
                          {preparation.registration_number || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {preparation.pest_types.slice(0, 3).map((pest, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-300"
                              >
                                {pest}
                              </span>
                            ))}
                            {preparation.pest_types.length > 3 && (
                              <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                                +{preparation.pest_types.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-sm">
                          {preparation.dosage || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(preparation.id, !preparation.is_active)}
                            className={`p-1 rounded transition-colors ${
                              preparation.is_active
                                ? 'text-emerald-400 hover:bg-emerald-500/20'
                                : 'text-slate-500 hover:bg-slate-700'
                            }`}
                            title={preparation.is_active ? 'Aktiv - Klicka för att inaktivera' : 'Inaktiv - Klicka för att aktivera'}
                          >
                            {preparation.is_active ? (
                              <ToggleRight className="w-6 h-6" />
                            ) : (
                              <ToggleLeft className="w-6 h-6" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {preparation.show_on_website ? (
                            <Globe className="w-4 h-4 text-blue-400 mx-auto" />
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingPreparation(preparation)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                              title="Redigera"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Är du säker på att du vill ta bort "${preparation.name}"?`)) {
                                  handleDelete(preparation.id)
                                }
                              }}
                              disabled={deletingId === preparation.id}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Ta bort"
                            >
                              {deletingId === preparation.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info om inaktiva */}
      {inactiveCount > 0 && (
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-medium">
                {inactiveCount} {inactiveCount === 1 ? 'preparat är inaktiverat' : 'preparat är inaktiverade'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Inaktiverade preparat visas inte som val i ärenden.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingPreparation && (
          <PreparationEditModal
            preparation={editingPreparation}
            isOpen={true}
            onClose={() => setEditingPreparation(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <PreparationEditModal
            preparation={null}
            isOpen={true}
            onClose={() => setIsCreateModalOpen(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
