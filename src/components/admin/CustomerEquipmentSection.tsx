// src/components/admin/CustomerEquipmentSection.tsx - Admin-sektion för kundutrustning
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  EquipmentPlacementWithRelations,
  EquipmentStats,
  EQUIPMENT_TYPE_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel
} from '../../types/database'
import { EquipmentService } from '../../services/equipmentService'
import { EquipmentMap, EquipmentList } from '../shared/equipment'
import { generateEquipmentPdf } from '../../utils/equipmentPdfGenerator'
import {
  MapPin,
  List,
  Map as MapIcon,
  Loader2,
  FileDown,
  RefreshCw,
  Crosshair,
  Box,
  Target,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface CustomerEquipmentSectionProps {
  customerId: string
  customerName: string
}

type ViewMode = 'map' | 'list'

const EQUIPMENT_TYPE_ICONS = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

export function CustomerEquipmentSection({ customerId, customerName }: CustomerEquipmentSectionProps) {
  const [equipment, setEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [stats, setStats] = useState<EquipmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [exporting, setExporting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Hämta utrustning
  const fetchEquipment = async () => {
    try {
      setLoading(true)
      const [equipmentData, statsData] = await Promise.all([
        EquipmentService.getEquipmentByCustomer(customerId),
        EquipmentService.getEquipmentStats(customerId)
      ])
      setEquipment(equipmentData)
      setStats(statsData)
    } catch (error) {
      console.error('Fel vid hämtning av utrustning:', error)
      toast.error('Kunde inte hämta utrustning')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (customerId) {
      fetchEquipment()
    }
  }, [customerId])

  // Ta bort utrustning
  const handleDeleteEquipment = async (equipment: EquipmentPlacementWithRelations) => {
    setDeleteConfirm(equipment.id)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      const result = await EquipmentService.deleteEquipment(deleteConfirm)
      if (!result.success) {
        throw new Error(result.error)
      }
      toast.success('Utrustning borttagen')
      setDeleteConfirm(null)
      await fetchEquipment()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error('Kunde inte ta bort utrustning')
    }
  }

  // Exportera PDF
  const handleExportPdf = async () => {
    if (equipment.length === 0) {
      toast.error('Ingen utrustning att exportera')
      return
    }

    setExporting(true)
    try {
      await generateEquipmentPdf({
        customerName,
        equipment
      })
      toast.success('PDF exporterad!')
    } catch (error) {
      console.error('Fel vid PDF-export:', error)
      toast.error('Kunde inte exportera PDF')
    } finally {
      setExporting(false)
    }
  }

  // Visa ingenting om ingen utrustning och komprimerad
  if (!isExpanded && equipment.length === 0 && !loading) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-slate-500" />
            <span className="text-slate-400">Utrustningsplacering</span>
            <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full text-slate-400">
              0 enheter
            </span>
          </div>
          <ChevronDown className="w-5 h-5 text-slate-500" />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-emerald-400" />
          <span className="font-medium text-white">Utrustningsplacering</span>
          {stats && (
            <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
              {stats.total} enheter
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Expanderat innehåll */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-700/50"
          >
            <div className="p-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              ) : equipment.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400">Ingen utrustning placerad</p>
                </div>
              ) : (
                <>
                  {/* Statistik */}
                  {stats && (
                    <div className="grid grid-cols-4 gap-3">
                      {(Object.entries(EQUIPMENT_TYPE_CONFIG) as [keyof typeof EQUIPMENT_TYPE_CONFIG, typeof EQUIPMENT_TYPE_CONFIG[keyof typeof EQUIPMENT_TYPE_CONFIG]][]).map(
                        ([type, config]) => {
                          const Icon = EQUIPMENT_TYPE_ICONS[type]
                          const count = stats.byType[type]

                          return (
                            <div
                              key={type}
                              className="bg-slate-800/50 rounded-lg p-3 text-center"
                            >
                              <div
                                className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                                style={{ backgroundColor: config.color }}
                              >
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <p className="text-lg font-bold text-white">{count}</p>
                              <p className="text-xs text-slate-400">{config.labelPlural}</p>
                            </div>
                          )
                        }
                      )}
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center bg-green-500">
                          <span className="text-white text-sm font-bold">{stats.byStatus.active}</span>
                        </div>
                        <p className="text-lg font-bold text-white">{stats.byStatus.active}</p>
                        <p className="text-xs text-slate-400">Aktiva</p>
                      </div>
                    </div>
                  )}

                  {/* Verktygsrad */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex bg-slate-800 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                          viewMode === 'list'
                            ? 'bg-emerald-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <List className="w-4 h-4" />
                        Lista
                      </button>
                      <button
                        onClick={() => setViewMode('map')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                          viewMode === 'map'
                            ? 'bg-emerald-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <MapIcon className="w-4 h-4" />
                        Karta
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={fetchEquipment}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={handleExportPdf}
                        disabled={exporting}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 rounded-lg text-sm text-white hover:bg-slate-600 transition-colors disabled:opacity-50"
                      >
                        {exporting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileDown className="w-4 h-4" />
                        )}
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Innehåll */}
                  {viewMode === 'map' ? (
                    <div className="rounded-lg overflow-hidden border border-slate-700/50">
                      <EquipmentMap
                        equipment={equipment}
                        onDeleteEquipment={handleDeleteEquipment}
                        height="300px"
                        showControls={false}
                      />
                    </div>
                  ) : (
                    <EquipmentList
                      equipment={equipment}
                      onDeleteEquipment={handleDeleteEquipment}
                      showFilters={false}
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bekräftelse-dialog för borttagning */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Ta bort utrustning?
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Denna åtgärd kan inte ångras
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 bg-red-500 rounded-lg text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Ta bort
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CustomerEquipmentSection
