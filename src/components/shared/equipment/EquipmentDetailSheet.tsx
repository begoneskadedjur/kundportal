// src/components/shared/equipment/EquipmentDetailSheet.tsx
// Responsiv detalj-vy för utrustning - bottom-sheet på mobil, sidopanel på desktop
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  MapPin,
  Building,
  User,
  Hash,
  MessageSquare,
  ExternalLink,
  Edit,
  Trash2,
  Image as ImageIcon,
  Crosshair,
  Box,
  Target,
  ClipboardList,
  Camera
} from 'lucide-react'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel
} from '../../../types/database'
import { formatCoordinates, openInMapsApp } from '../../../utils/equipmentMapUtils'
import ImageLightbox from '../ImageLightbox'
import type { OutdoorInspectionWithRelations } from '../../../types/inspectionSession'
import { INSPECTION_STATUS_CONFIG } from '../../../types/indoor'
import type { InspectionStatus } from '../../../types/indoor'

// Hjälpfunktion för att hämta typkonfiguration med fallback för dynamiska typer
function getTypeConfig(equipment: EquipmentPlacementWithRelations) {
  // Försök hämta från legacy-config först
  const legacyConfig = EQUIPMENT_TYPE_CONFIG[equipment.equipment_type]
  if (legacyConfig) {
    return {
      color: legacyConfig.color,
      label: legacyConfig.label
    }
  }
  // Dynamisk typ - använd grå som standardfärg
  return {
    color: '#6b7280', // slate-500 som fallback
    label: equipment.equipment_type || 'Okänd typ'
  }
}

interface EquipmentDetailSheetProps {
  equipment: EquipmentPlacementWithRelations | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (equipment: EquipmentPlacementWithRelations) => void
  onDelete?: (equipment: EquipmentPlacementWithRelations) => void
  readOnly?: boolean
  /** When true, renders only the content without fixed positioning/backdrop (for use inside modals) */
  embedded?: boolean
  /** Inspection history for this station */
  inspections?: OutdoorInspectionWithRelations[]
}

// Ikon-komponent baserat på utrustningstyp
function EquipmentIcon({ type, className = "w-5 h-5" }: { type: string; className?: string }) {
  switch (type) {
    case 'mechanical_trap':
      return <Crosshair className={className} />
    case 'concrete_station':
      return <Box className={className} />
    case 'bait_station':
      return <Target className={className} />
    default:
      return <Box className={className} />
  }
}

export function EquipmentDetailSheet({
  equipment,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  readOnly = false,
  embedded = false,
  inspections = []
}: EquipmentDetailSheetProps) {
  const [showLightbox, setShowLightbox] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showAllInspections, setShowAllInspections] = useState(false)

  // Detektera skarmstorlek
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Lasa scroll nar sheet ar oppen
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // ESC for att stanga
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showLightbox) {
          setShowLightbox(false)
        } else {
          onClose()
        }
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
    }
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, showLightbox, onClose])

  if (!equipment) return null

  const typeConfig = getTypeConfig(equipment)
  const statusConfig = EQUIPMENT_STATUS_CONFIG[equipment.status] || {
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/30',
    color: 'slate-400'
  }
  const customerName = (equipment.customer as { company_name?: string } | undefined)?.company_name

  // Innehallet i sheeten
  const sheetContent = (
    <div className="flex flex-col h-full">
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
        <div className="w-10 h-1 bg-slate-600 rounded-full" />
      </div>

      {/* Header */}
      <div className="px-4 pb-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: typeConfig.color + '30' }}
            >
              <EquipmentIcon type={equipment.equipment_type} className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {equipment.serial_number ? `#${equipment.serial_number}` : getEquipmentTypeLabel(equipment.equipment_type)}
              </h3>
              <p className="text-sm text-slate-400">{getEquipmentTypeLabel(equipment.equipment_type)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} text-${statusConfig.color}`}>
            {getEquipmentStatusLabel(equipment.status)}
          </span>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Foto */}
        {equipment.photo_url && (
          <button
            onClick={() => setShowLightbox(true)}
            className="w-full rounded-xl overflow-hidden bg-slate-900 relative group cursor-zoom-in"
          >
            <img
              src={equipment.photo_url}
              alt="Utrustningsfoto"
              className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white/80 text-sm">
              <ImageIcon className="w-4 h-4" />
              <span>Tryck för att förstora</span>
            </div>
          </button>
        )}

        {/* Detaljer */}
        <div className="space-y-3">
          {/* Serienummer */}
          {equipment.serial_number && (
            <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
              <Hash className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Serienummer</p>
                <p className="text-sm text-white">{equipment.serial_number}</p>
              </div>
            </div>
          )}

          {/* Kund */}
          {customerName && (
            <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
              <Building className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Kund</p>
                <p className="text-sm text-white">{customerName}</p>
              </div>
            </div>
          )}

          {/* Position - klickbar */}
          <button
            onClick={() => openInMapsApp(equipment.latitude, equipment.longitude)}
            className="w-full flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-800/50 transition-colors group text-left"
          >
            <MapPin className="w-4 h-4 text-[#20c58f] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">Position</p>
              <p className="text-sm text-white font-mono">
                {formatCoordinates(equipment.latitude, equipment.longitude)}
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-[#20c58f] transition-colors mt-0.5 flex-shrink-0" />
          </button>

          {/* Kommentar */}
          {equipment.comment && (
            <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
              <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Kommentar</p>
                <p className="text-sm text-white whitespace-pre-wrap">{equipment.comment}</p>
              </div>
            </div>
          )}

          {/* Placerad av + datum */}
          <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
            <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Placerad av</p>
              <p className="text-sm text-white">
                {equipment.technician?.name || 'Okänd'} • {format(new Date(equipment.placed_at), "d MMMM yyyy 'kl' HH:mm", { locale: sv })}
              </p>
            </div>
          </div>
        </div>

        {/* Kontrollhistorik */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Kontrollhistorik
            </h4>
            {inspections.length > 3 && (
              <button
                onClick={() => setShowAllInspections(!showAllInspections)}
                className="text-xs text-[#20c58f] hover:text-[#20c58f]/80"
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
              {(showAllInspections ? inspections : inspections.slice(0, 3)).map((inspection) => {
                const inspStatusConfig = INSPECTION_STATUS_CONFIG[inspection.status as InspectionStatus] || {
                  label: inspection.status || 'Okänd',
                  bgColor: 'bg-slate-500/20',
                  icon: '?'
                }
                return (
                  <div key={inspection.id} className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <div className={`w-6 h-6 rounded-full ${inspStatusConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-xs">{inspStatusConfig.icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{inspStatusConfig.label}</p>
                          {inspection.findings && (
                            <p className="text-xs text-slate-400 mt-0.5">{inspection.findings}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {inspection.technician?.name || 'Okänd'} • {format(new Date(inspection.inspected_at), 'd MMM HH:mm', { locale: sv })}
                          </p>
                        </div>
                      </div>
                      {inspection.photo_path && (
                        <Camera className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {!readOnly && (onEdit || onDelete) && (
        <div className="px-4 py-4 border-t border-slate-700 flex-shrink-0">
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(equipment)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Redigera
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(equipment)}
                className="py-2.5 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // Embedded mode: render just the content without fixed positioning
  if (embedded) {
    return (
      <>
        <div className="bg-slate-800 rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {sheetContent}
        </div>
        {equipment.photo_url && (
          <ImageLightbox
            images={[{ url: equipment.photo_url, alt: 'Utrustningsfoto' }]}
            initialIndex={0}
            isOpen={showLightbox}
            onClose={() => setShowLightbox(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={onClose}
            />

            {/* Sheet - olika beteende for mobil/desktop */}
            {isMobile ? (
              // MOBIL: Bottom-sheet
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                  <div className="w-12 h-1 rounded-full bg-slate-700" />
                </div>
                {sheetContent}
              </motion.div>
            ) : (
              // DESKTOP: Sidopanel fran hoger
              <motion.div
                initial={{ x: '100%', opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0.5 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {sheetContent}
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Lightbox for foto */}
      {equipment.photo_url && (
        <ImageLightbox
          images={[{ url: equipment.photo_url, alt: 'Utrustningsfoto' }]}
          initialIndex={0}
          isOpen={showLightbox}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  )
}

export default EquipmentDetailSheet
