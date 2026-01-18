// src/components/shared/indoor/IndoorStationDetailSheet.tsx
// Bottom-sheet med stationsdetaljer och åtgärder

import { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  X,
  Edit3,
  Move,
  Trash2,
  Camera,
  MapPin,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ClipboardList
} from 'lucide-react'
import {
  IndoorStationWithRelations,
  IndoorStationInspectionWithRelations,
  INDOOR_STATION_TYPE_CONFIG,
  INDOOR_STATION_STATUS_CONFIG,
  INSPECTION_STATUS_CONFIG,
  InspectionStatus
} from '../../../types/indoor'

interface IndoorStationDetailSheetProps {
  station: IndoorStationWithRelations
  inspections?: IndoorStationInspectionWithRelations[]
  onClose: () => void
  onEdit?: () => void
  onMove?: () => void
  onDelete?: () => void
  onRegisterInspection?: () => void
}

export function IndoorStationDetailSheet({
  station,
  inspections = [],
  onClose,
  onEdit,
  onMove,
  onDelete,
  onRegisterInspection
}: IndoorStationDetailSheetProps) {
  const [showAllInspections, setShowAllInspections] = useState(false)

  const typeConfig = INDOOR_STATION_TYPE_CONFIG[station.station_type]
  const statusConfig = INDOOR_STATION_STATUS_CONFIG[station.status]

  const displayedInspections = showAllInspections ? inspections : inspections.slice(0, 3)

  return (
    <div className="bg-slate-800 rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 bg-slate-600 rounded-full" />
      </div>

      {/* Header */}
      <div className="px-4 pb-4 border-b border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: typeConfig.color + '30' }}
            >
              <div
                className="w-5 h-5 rounded-full border-2 border-white/50"
                style={{ backgroundColor: typeConfig.color }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {station.station_number || typeConfig.label}
              </h3>
              <p className="text-sm text-slate-400">{typeConfig.label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
            {statusConfig.label}
          </span>
          {station.status !== 'active' && station.status_updated_at && (
            <span className="text-xs text-slate-500">
              sedan {format(new Date(station.status_updated_at), 'd MMM', { locale: sv })}
            </span>
          )}
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Photo */}
        {station.photo_url && (
          <div className="rounded-xl overflow-hidden bg-slate-900">
            <img
              src={station.photo_url}
              alt="Stationsfoto"
              className="w-full h-40 object-cover"
            />
          </div>
        )}

        {/* Details grid */}
        <div className="space-y-3">
          {/* Position */}
          <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
            <MapPin className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Position</p>
              <p className="text-sm text-white">
                {station.position_x_percent.toFixed(1)}%, {station.position_y_percent.toFixed(1)}%
              </p>
              {station.location_description && (
                <p className="text-sm text-slate-300 mt-1">{station.location_description}</p>
              )}
            </div>
          </div>

          {/* Placed by */}
          <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
            <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Placerad av</p>
              <p className="text-sm text-white">
                {station.technician?.name || 'Okänd'}
              </p>
            </div>
          </div>

          {/* Placed date */}
          <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Placerad</p>
              <p className="text-sm text-white">
                {format(new Date(station.placed_at), "d MMMM yyyy 'kl' HH:mm", { locale: sv })}
              </p>
            </div>
          </div>

          {/* Comment */}
          {station.comment && (
            <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Kommentar</p>
                <p className="text-sm text-white">{station.comment}</p>
              </div>
            </div>
          )}
        </div>

        {/* Inspections */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Kontrollhistorik
            </h4>
            {inspections.length > 3 && (
              <button
                onClick={() => setShowAllInspections(!showAllInspections)}
                className="text-xs text-teal-400 hover:text-teal-300"
              >
                {showAllInspections ? 'Visa färre' : `Visa alla (${inspections.length})`}
              </button>
            )}
          </div>

          {inspections.length === 0 ? (
            <div className="p-4 bg-slate-900/50 rounded-lg text-center">
              <p className="text-sm text-slate-400">Inga kontroller registrerade</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedInspections.map((inspection) => (
                <InspectionItem key={inspection.id} inspection={inspection} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-4 border-t border-slate-700 space-y-3">
        {/* Primary action */}
        {onRegisterInspection && station.status === 'active' && (
          <button
            onClick={onRegisterInspection}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Registrera kontroll
          </button>
        )}

        {/* Secondary actions */}
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Redigera
            </button>
          )}
          {onMove && (
            <button
              onClick={onMove}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Move className="w-4 h-4" />
              Flytta
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="py-2.5 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Inspektionsrad
function InspectionItem({ inspection }: { inspection: IndoorStationInspectionWithRelations }) {
  const statusConfig = INSPECTION_STATUS_CONFIG[inspection.status]

  return (
    <div className="p-3 bg-slate-900/50 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className={`w-6 h-6 rounded-full ${statusConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
            <span className="text-xs">{statusConfig.icon}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">{statusConfig.label}</p>
            {inspection.findings && (
              <p className="text-xs text-slate-400 mt-0.5">{inspection.findings}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {inspection.technician?.name || 'Okänd'} • {format(new Date(inspection.inspected_at), 'd MMM HH:mm', { locale: sv })}
            </p>
          </div>
        </div>
        {inspection.photo_url && (
          <Camera className="w-4 h-4 text-slate-500" />
        )}
      </div>
    </div>
  )
}

// Kompakt version för desktop sidebar
export function IndoorStationCard({
  station,
  isSelected,
  onClick
}: {
  station: IndoorStationWithRelations
  isSelected?: boolean
  onClick?: () => void
}) {
  const typeConfig = INDOOR_STATION_TYPE_CONFIG[station.station_type]
  const statusConfig = INDOOR_STATION_STATUS_CONFIG[station.status]

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 rounded-lg text-left transition-all
        ${isSelected
          ? 'bg-teal-600/20 border border-teal-500'
          : 'bg-slate-800 hover:bg-slate-700 border border-transparent'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: typeConfig.color + '30' }}
        >
          <div
            className="w-4 h-4 rounded-full border border-white/50"
            style={{ backgroundColor: typeConfig.color }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {station.station_number || typeConfig.label}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {station.location_description || `${station.position_x_percent.toFixed(0)}%, ${station.position_y_percent.toFixed(0)}%`}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bgColor} ${statusConfig.textColor}`}>
          {statusConfig.label}
        </span>
      </div>
    </button>
  )
}
