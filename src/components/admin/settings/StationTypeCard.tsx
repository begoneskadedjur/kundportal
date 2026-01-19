// src/components/admin/settings/StationTypeCard.tsx
// Kort för visning av en stationstyp i admin

import { useState } from 'react'
import {
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Target,
  Box,
  Package,
  Crosshair,
  Circle,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Home
} from 'lucide-react'
import {
  StationType,
  MEASUREMENT_UNIT_CONFIG,
  CALCULATED_STATUS_CONFIG,
  generateThresholdPreview
} from '../../../types/stationTypes'

// Ikon-mappning från Lucide
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  target: Target,
  box: Box,
  package: Package,
  crosshair: Crosshair,
  circle: Circle
}

interface StationTypeCardProps {
  stationType: StationType
  stationCount: { indoor: number; outdoor: number }
  onEdit: () => void
  onToggleActive: (isActive: boolean) => void
  onDelete: () => void
}

export function StationTypeCard({
  stationType,
  stationCount,
  onEdit,
  onToggleActive,
  onDelete
}: StationTypeCardProps) {
  const [showThresholds, setShowThresholds] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const Icon = ICON_MAP[stationType.icon] || Box
  const unitConfig = MEASUREMENT_UNIT_CONFIG[stationType.measurement_unit]
  const hasThresholds = stationType.threshold_warning !== null || stationType.threshold_critical !== null
  const thresholdPreview = hasThresholds ? generateThresholdPreview(stationType) : []
  const totalStations = stationCount.indoor + stationCount.outdoor

  return (
    <div
      className={`
        bg-slate-800/50 rounded-xl border transition-all
        ${stationType.is_active
          ? 'border-slate-700/50 hover:border-slate-600/50'
          : 'border-slate-700/30 opacity-60'
        }
      `}
    >
      {/* Huvudinnehåll */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Ikon med färg */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${stationType.color}20` }}
          >
            <Icon className="w-6 h-6" style={{ color: stationType.color }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{stationType.name}</h3>
              <span className="px-2 py-0.5 bg-slate-700/50 text-slate-400 text-xs font-mono rounded">
                {stationType.prefix}
              </span>
              {!stationType.is_active && (
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded">
                  Inaktiv
                </span>
              )}
            </div>

            {stationType.description && (
              <p className="text-sm text-slate-400 mt-1 truncate">{stationType.description}</p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
              <span>Enhet: {unitConfig.label}</span>
              {stationType.requires_serial_number && (
                <span className="text-cyan-400">Kräver serienummer</span>
              )}
              {hasThresholds && (
                <button
                  onClick={() => setShowThresholds(!showThresholds)}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Tröskelvärden
                  {showThresholds ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Stationsantal */}
            {totalStations > 0 && (
              <div className="flex items-center gap-3 mt-2 text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                  <MapPin className="w-3 h-3" />
                  <span>{stationCount.outdoor} utomhus</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Home className="w-3 h-3" />
                  <span>{stationCount.indoor} inomhus</span>
                </div>
              </div>
            )}
          </div>

          {/* Åtgärder */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onToggleActive(!stationType.is_active)}
              className={`p-2 rounded-lg transition-colors ${
                stationType.is_active
                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                  : 'text-slate-500 hover:bg-slate-700'
              }`}
              title={stationType.is_active ? 'Inaktivera' : 'Aktivera'}
            >
              {stationType.is_active ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={onEdit}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Redigera"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Ta bort"
              disabled={totalStations > 0}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanderad tröskelvy */}
      {showThresholds && hasThresholds && (
        <div className="px-4 pb-4 pt-0">
          <div className="bg-slate-900/50 rounded-lg p-3 mt-2">
            <p className="text-xs text-slate-500 mb-2">
              {stationType.threshold_direction === 'above'
                ? 'Värde ÖVER tröskel är dåligt (t.ex. förbrukning)'
                : 'Värde UNDER tröskel är dåligt (t.ex. vikt kvar)'
              }
            </p>
            <div className="space-y-1">
              {thresholdPreview.map((item, i) => {
                const config = CALCULATED_STATUS_CONFIG[item.status]
                const StatusIcon = item.status === 'ok'
                  ? CheckCircle2
                  : item.status === 'warning'
                    ? AlertTriangle
                    : AlertCircle

                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <StatusIcon className={`w-4 h-4 ${config.color}`} />
                    <span className={config.color}>{item.range}</span>
                    <span className="text-slate-500">→</span>
                    <span className={config.color}>{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bekräftelse för borttagning */}
      {showDeleteConfirm && (
        <div className="px-4 pb-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {totalStations > 0 ? (
              <p className="text-sm text-red-400">
                Kan inte ta bort. {totalStations} stationer använder denna typ. Inaktivera istället.
              </p>
            ) : (
              <>
                <p className="text-sm text-red-400 mb-3">
                  Är du säker på att du vill ta bort "{stationType.name}"?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={() => {
                      onDelete()
                      setShowDeleteConfirm(false)
                    }}
                    className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                  >
                    Ta bort
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
