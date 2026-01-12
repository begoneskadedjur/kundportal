// src/components/customer/CustomerEquipmentMap.tsx - Kundportalvy för utrustning
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  EquipmentPlacementWithRelations,
  EquipmentStats,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentTypePluralLabel,
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
  Crosshair,
  Box,
  Target,
  Info
} from 'lucide-react'

interface CustomerEquipmentMapProps {
  customerId: string
  customerName: string
}

type ViewMode = 'map' | 'list'

const EQUIPMENT_TYPE_ICONS = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

export function CustomerEquipmentMap({ customerId, customerName }: CustomerEquipmentMapProps) {
  const [equipment, setEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [stats, setStats] = useState<EquipmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [exporting, setExporting] = useState(false)

  // Hämta utrustning vid mount
  useEffect(() => {
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
        toast.error('Kunde inte hämta utrustningsdata')
      } finally {
        setLoading(false)
      }
    }

    if (customerId) {
      fetchEquipment()
    }
  }, [customerId])

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

  // Filtrera aktiv utrustning för visning
  const activeEquipment = equipment.filter(e => e.status === 'active')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  if (equipment.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">Ingen utrustning placerad</h3>
        <p className="text-slate-500">
          Er tekniker har ännu inte placerat någon utrustning hos er.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistik */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Totalt */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-sm text-slate-400 mb-1">Totalt antal</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-1">
              {stats.byStatus.active} aktiva
            </p>
          </div>

          {/* Per typ */}
          {(Object.entries(EQUIPMENT_TYPE_CONFIG) as [keyof typeof EQUIPMENT_TYPE_CONFIG, typeof EQUIPMENT_TYPE_CONFIG[keyof typeof EQUIPMENT_TYPE_CONFIG]][]).map(
            ([type, config]) => {
              const Icon = EQUIPMENT_TYPE_ICONS[type]
              const count = stats.byType[type]

              return (
                <div
                  key={type}
                  className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: config.color }}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm text-slate-400">{config.labelPlural}</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{count}</p>
                </div>
              )
            }
          )}
        </div>
      )}

      {/* Verktygsrad */}
      <div className="flex items-center justify-between gap-4">
        {/* Vyväljare */}
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'map'
                ? 'bg-emerald-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Karta
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-emerald-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
            Lista
          </button>
        </div>

        {/* Export-knapp */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          Exportera PDF
        </motion.button>
      </div>

      {/* Innehåll */}
      {viewMode === 'map' ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <EquipmentMap
            equipment={activeEquipment}
            height="400px"
            readOnly
            showControls={false}
          />
        </div>
      ) : (
        <EquipmentList
          equipment={equipment}
          readOnly
          showFilters={false}
        />
      )}

      {/* Info om utrustning */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <p className="font-medium mb-1">Om utrustningskartan</p>
          <p className="text-blue-200/80">
            Kartan visar placering av all skadedjursbekämpningsutrustning som placerats hos er av våra tekniker.
            Klicka på en markör för att se detaljer om utrustningen.
          </p>
        </div>
      </div>
    </div>
  )
}

export default CustomerEquipmentMap
