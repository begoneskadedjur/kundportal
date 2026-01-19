// src/components/admin/settings/StationTypesSettings.tsx
// Huvudkomponent för hantering av stationstyper i admin

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Settings,
  ArrowLeft,
  Loader2,
  Target,
  Box,
  Package,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { StationTypeService } from '../../../services/stationTypeService'
import { StationType } from '../../../types/stationTypes'
import { StationTypeCard } from './StationTypeCard'
import { StationTypeEditModal } from './StationTypeEditModal'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

export function StationTypesSettings() {
  const navigate = useNavigate()
  const [stationTypes, setStationTypes] = useState<StationType[]>([])
  const [stationCounts, setStationCounts] = useState<Record<string, { indoor: number; outdoor: number }>>({})
  const [loading, setLoading] = useState(true)
  const [editingType, setEditingType] = useState<StationType | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Ladda stationstyper vid mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [types, counts] = await Promise.all([
        StationTypeService.getAllStationTypes(),
        StationTypeService.getStationCountsByType()
      ])
      setStationTypes(types)
      setStationCounts(counts)
    } catch (error) {
      console.error('Fel vid laddning av stationstyper:', error)
      toast.error('Kunde inte ladda stationstyper')
    } finally {
      setLoading(false)
    }
  }

  // Hantera toggle av aktiv-status
  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await StationTypeService.toggleStationTypeActive(id, isActive)
      toast.success(isActive ? 'Stationstyp aktiverad' : 'Stationstyp inaktiverad')
      loadData()
    } catch (error) {
      console.error('Fel vid toggle av status:', error)
      toast.error('Kunde inte ändra status')
    }
  }

  // Hantera borttagning
  const handleDelete = async (id: string) => {
    try {
      await StationTypeService.deleteStationType(id)
      toast.success('Stationstyp borttagen')
      loadData()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ta bort stationstypen')
    }
  }

  // Hantera sparande
  const handleSave = async () => {
    setEditingType(null)
    setIsCreateModalOpen(false)
    loadData()
  }

  // Beräkna statistik
  const activeCount = stationTypes.filter(t => t.is_active).length
  const inactiveCount = stationTypes.filter(t => !t.is_active).length
  const totalStations = Object.values(stationCounts).reduce(
    (sum, c) => sum + c.indoor + c.outdoor,
    0
  )

  return (
    <div className="max-w-4xl mx-auto">
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
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Stationstyper</h1>
              <p className="text-slate-400 text-sm">
                Hantera vilka stationstyper tekniker kan placera ut
              </p>
            </div>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-white">{stationTypes.length}</p>
            <p className="text-sm text-slate-400">Stationstyper</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            <p className="text-sm text-slate-400">Aktiva</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-2xl font-bold text-white">{totalStations}</p>
            <p className="text-sm text-slate-400">Stationer totalt</p>
          </div>
        </div>
      </div>

      {/* Åtgärder */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Alla typer</h2>
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
            Ny typ
          </Button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : stationTypes.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <Box className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-4">Inga stationstyper skapade</p>
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Skapa första stationstypen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {stationTypes.map((type) => (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <StationTypeCard
                  stationType={type}
                  stationCount={stationCounts[type.code] || { indoor: 0, outdoor: 0 }}
                  onEdit={() => setEditingType(type)}
                  onToggleActive={(isActive) => handleToggleActive(type.id, isActive)}
                  onDelete={() => handleDelete(type.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info om inaktiva */}
      {inactiveCount > 0 && (
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-medium">
                {inactiveCount} {inactiveCount === 1 ? 'stationstyp är inaktiverad' : 'stationstyper är inaktiverade'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Inaktiverade stationstyper visas inte för tekniker vid placering av nya stationer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingType && (
          <StationTypeEditModal
            stationType={editingType}
            isOpen={true}
            onClose={() => setEditingType(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <StationTypeEditModal
            stationType={null}
            isOpen={true}
            onClose={() => setIsCreateModalOpen(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
