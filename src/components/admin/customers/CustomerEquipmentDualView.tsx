// src/components/admin/customers/CustomerEquipmentDualView.tsx
// 50/50 dual-view for equipment: Map (left) + List (right) on desktop, stacked on mobile
import { useState, useEffect, useMemo } from 'react'
import { EquipmentMap, EquipmentList } from '../../shared/equipment'
import { EquipmentService } from '../../../services/equipmentService'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG
} from '../../../types/database'
import { Loader2, MapPin, Crosshair, Box, Target, AlertCircle } from 'lucide-react'

interface CustomerEquipmentDualViewProps {
  customerId: string
  customerName: string
}

// Icons for equipment types
const EQUIPMENT_TYPE_ICONS = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

export default function CustomerEquipmentDualView({
  customerId,
  customerName
}: CustomerEquipmentDualViewProps) {
  const [equipment, setEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch equipment on mount
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await EquipmentService.getEquipmentByCustomer(customerId)
        setEquipment(data)
      } catch (err) {
        console.error('Error fetching equipment:', err)
        setError('Kunde inte ladda utrustning. Försök igen.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEquipment()
  }, [customerId])

  // Calculate stats per type
  const stats = useMemo(() => {
    const byType = {
      mechanical_trap: 0,
      concrete_station: 0,
      bait_station: 0
    }
    const byStatus = {
      active: 0,
      removed: 0,
      missing: 0
    }

    equipment.forEach(item => {
      if (item.equipment_type in byType) {
        byType[item.equipment_type as keyof typeof byType]++
      }
      if (item.status in byStatus) {
        byStatus[item.status as keyof typeof byStatus]++
      }
    })

    return { total: equipment.length, byType, byStatus }
  }, [equipment])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-slate-400 text-sm">Laddar utrustning...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-16 bg-red-500/10 rounded-xl border border-red-500/30">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
          >
            Ladda om sidan
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (equipment.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <MapPin className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400 text-lg mb-2">Ingen utrustning placerad</p>
        <p className="text-slate-500 text-sm text-center max-w-md">
          Det finns ingen registrerad utrustning hos {customerName} ännu.
          Utrustning registreras av tekniker vid servicebesök.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Totalt</span>
          </div>
          <div className="text-xl font-semibold text-white">{stats.total}</div>
          <div className="text-xs text-slate-500">
            {stats.byStatus.active} aktiva
          </div>
        </div>

        {/* Per type */}
        {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([type, config]) => {
          const Icon = EQUIPMENT_TYPE_ICONS[type as keyof typeof EQUIPMENT_TYPE_ICONS]
          const count = stats.byType[type as keyof typeof stats.byType]

          return (
            <div
              key={type}
              className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: config.color }}
                >
                  <Icon className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs text-slate-400 truncate">{config.label}</span>
              </div>
              <div className="text-xl font-semibold text-white">{count}</div>
            </div>
          )
        })}
      </div>

      {/* Dual View Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Map (Left on Desktop, Top on Mobile) */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-3 border-b border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Kartvy
            </h4>
          </div>
          <div className="h-[300px] lg:h-[400px]">
            <EquipmentMap
              equipment={equipment}
              height="100%"
              readOnly={true}
              enableClustering={false}
              showControls={true}
            />
          </div>
        </div>

        {/* List (Right on Desktop, Bottom on Mobile) */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-3 border-b border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Utrustningslista
              <span className="ml-auto text-xs text-slate-500 font-normal">
                {equipment.length} enheter
              </span>
            </h4>
          </div>
          <div className="h-[300px] lg:h-[400px] overflow-y-auto p-3">
            <EquipmentList
              equipment={equipment}
              readOnly={true}
              showCustomer={false}
              showFilters={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
