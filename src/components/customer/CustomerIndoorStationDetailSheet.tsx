// src/components/customer/CustomerIndoorStationDetailSheet.tsx
// Kundvänlig read-only vy av stationsdetaljer med inspektionshistorik

import { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  MapPin,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Crosshair,
  Box,
  Target
} from 'lucide-react'
import type {
  IndoorStationWithRelations,
  IndoorStationInspectionWithRelations,
  IndoorStationType,
  InspectionStatus
} from '../../types/indoor'
import {
  INDOOR_STATION_TYPE_CONFIG,
  INDOOR_STATION_STATUS_CONFIG,
  INSPECTION_STATUS_CONFIG
} from '../../types/indoor'

interface CustomerIndoorStationDetailSheetProps {
  station: IndoorStationWithRelations
  inspections?: IndoorStationInspectionWithRelations[]
  isOpen: boolean
  onClose: () => void
}

// Ikon-mappning för stationstyper
const TYPE_ICONS: Record<IndoorStationType, React.ElementType> = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

export function CustomerIndoorStationDetailSheet({
  station,
  inspections = [],
  isOpen,
  onClose
}: CustomerIndoorStationDetailSheetProps) {
  const [showAllInspections, setShowAllInspections] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

  // Prioritera station_type_data (dynamisk från databas), fallback till legacy config
  const dynamicTypeData = station.station_type_data
  const legacyConfig = INDOOR_STATION_TYPE_CONFIG[station.station_type]

  // Bygg typeConfig från antingen dynamisk data eller legacy, med säker fallback
  const typeConfig = {
    label: dynamicTypeData?.name || legacyConfig?.label || station.station_type || 'Station',
    color: dynamicTypeData?.color || legacyConfig?.color || '#6b7280'
  }

  const statusConfig = INDOOR_STATION_STATUS_CONFIG[station.status] || {
    label: station.status || 'Okänd',
    bgColor: 'bg-slate-500/20',
    textColor: 'text-slate-400'
  }

  // Välj ikon baserat på stationstyp, med fallback till Box
  const TypeIcon = TYPE_ICONS[station.station_type as keyof typeof TYPE_ICONS] || Box

  // Visa max 3 inspektioner initialt, eller alla om expanderad
  const displayedInspections = showAllInspections ? inspections : inspections.slice(0, 3)

  // Senaste inspektion
  const latestInspection = inspections.length > 0 ? inspections[0] : null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 md:inset-auto md:right-4 md:bottom-4 md:left-auto md:w-[420px]"
          >
            <div className="bg-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 bg-slate-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-5 pb-4 pt-2 md:pt-4 border-b border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Station type icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: typeConfig.color + '30' }}
                    >
                      <TypeIcon className="w-6 h-6" style={{ color: typeConfig.color }} />
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
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                    {statusConfig.label}
                  </span>
                </div>
              </div>

              {/* Content - scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {/* Photo */}
                {station.photo_url && (
                  <div className="rounded-xl overflow-hidden bg-slate-900">
                    <img
                      src={station.photo_url}
                      alt="Stationsfoto"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                {/* Senaste kontroll - framträdande sektion */}
                {latestInspection && (
                  <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardList className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-medium text-emerald-400">Senaste kontroll</h4>
                    </div>
                    <InspectionCard inspection={latestInspection} isLatest onPhotoClick={setLightboxPhoto} />
                  </div>
                )}

                {/* Detaljer */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Detaljer
                  </h4>

                  {/* Plats */}
                  <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                    <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Plats</p>
                      <p className="text-sm text-white">
                        {station.location_description || 'Se markering på planritningen'}
                      </p>
                    </div>
                  </div>

                  {/* Placerad av */}
                  <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                    <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Placerad av</p>
                      <p className="text-sm text-white">
                        {station.technician?.name || 'BeGone tekniker'}
                      </p>
                    </div>
                  </div>

                  {/* Placeringsdatum */}
                  <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Placerad</p>
                      <p className="text-sm text-white">
                        {format(new Date(station.placed_at), "d MMMM yyyy", { locale: sv })}
                      </p>
                    </div>
                  </div>

                  {/* Kommentar */}
                  {station.comment && (
                    <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                      <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Kommentar</p>
                        <p className="text-sm text-white">{station.comment}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Kontrollhistorik */}
                {inspections.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Kontrollhistorik ({inspections.length})
                      </h4>
                      {inspections.length > 3 && (
                        <button
                          onClick={() => setShowAllInspections(!showAllInspections)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                        >
                          {showAllInspections ? (
                            <>Visa färre <ChevronUp className="w-3 h-3" /></>
                          ) : (
                            <>Visa alla <ChevronDown className="w-3 h-3" /></>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {displayedInspections.map((inspection, index) => (
                        <InspectionCard
                          key={inspection.id}
                          inspection={inspection}
                          isLatest={index === 0 && !showAllInspections}
                          onPhotoClick={setLightboxPhoto}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Inga kontroller */}
                {inspections.length === 0 && (
                  <div className="p-6 bg-slate-900/50 rounded-xl text-center">
                    <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Inga kontroller registrerade ännu</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Kontroller kommer visas här när de utförs
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Lightbox för inspektionsfoton */}
          {lightboxPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxPhoto(null)}
              className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
            >
              <img
                src={lightboxPhoto}
                alt="Inspektionsfoto"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <button
                onClick={() => setLightboxPhoto(null)}
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}

// Inspektionskort-komponent
function InspectionCard({
  inspection,
  isLatest = false,
  onPhotoClick
}: {
  inspection: IndoorStationInspectionWithRelations
  isLatest?: boolean
  onPhotoClick?: (url: string) => void
}) {
  const statusConfig = INSPECTION_STATUS_CONFIG[inspection.status] || {
    label: inspection.status || 'Okänd',
    bgColor: 'bg-slate-500/20'
  }

  // Ikon baserat på status
  const getStatusIcon = () => {
    switch (inspection.status) {
      case 'ok':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'activity':
      case 'needs_service':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case 'replaced':
        return <CheckCircle2 className="w-4 h-4 text-blue-400" />
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-400" />
    }
  }

  return (
    <div className={`p-3 rounded-lg ${isLatest ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-900/50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusConfig.bgColor}`}>
            {getStatusIcon()}
          </div>
          <div>
            <p className={`text-sm font-medium ${isLatest ? 'text-emerald-400' : 'text-white'}`}>
              {statusConfig.label}
            </p>
            {inspection.findings && (
              <p className="text-xs text-slate-400 mt-0.5">{inspection.findings}</p>
            )}
            {inspection.measurement_value !== null && inspection.measurement_value !== undefined && (
              <p className="text-xs text-slate-400 mt-0.5">
                {inspection.station?.station_type_data?.measurement_label || 'Mätvärde'}: {inspection.measurement_value} {inspection.measurement_unit || 'st'}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {inspection.technician?.name || 'BeGone tekniker'} • {format(new Date(inspection.inspected_at), "d MMM yyyy 'kl' HH:mm", { locale: sv })}
            </p>
          </div>
        </div>
        {inspection.photo_url && (
          <button
            onClick={() => onPhotoClick?.(inspection.photo_url!)}
            className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 hover:ring-2 hover:ring-emerald-500/50 transition-all"
          >
            <img
              src={inspection.photo_url}
              alt="Inspektionsfoto"
              className="w-full h-full object-cover"
            />
          </button>
        )}
      </div>
    </div>
  )
}

export default CustomerIndoorStationDetailSheet
