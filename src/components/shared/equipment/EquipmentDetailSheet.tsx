// src/components/shared/equipment/EquipmentDetailSheet.tsx
// Responsiv detalj-vy för utrustning - bottom-sheet på mobil, sidopanel på desktop
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  MapPin,
  Building,
  Calendar,
  User,
  Hash,
  MessageSquare,
  ExternalLink,
  Edit,
  Trash2,
  Image as ImageIcon,
  ChevronRight,
  Crosshair,
  Box,
  Target
} from 'lucide-react'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel
} from '../../../types/database'
import { formatCoordinates, openInMapsApp } from '../../../utils/equipmentMapUtils'

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
  readOnly = false
}: EquipmentDetailSheetProps) {
  const [showLightbox, setShowLightbox] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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

  // Formatera datum
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Innehallet i sheeten
  const sheetContent = (
    <div className="flex flex-col h-full">
      {/* Header med foto eller gradient */}
      <div className="relative flex-shrink-0">
        {equipment.photo_url ? (
          <button
            onClick={() => setShowLightbox(true)}
            className="w-full aspect-video relative overflow-hidden group"
          >
            <img
              src={equipment.photo_url}
              alt="Utrustningsfoto"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* Overlay med ikon */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white/80 text-sm">
              <ImageIcon className="w-4 h-4" />
              <span>Tryck for att forstora</span>
            </div>
          </button>
        ) : (
          // Gradient header utan foto
          <div
            className="w-full h-24 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${typeConfig.color}40 0%, ${typeConfig.color}20 100%)`
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: typeConfig.color }}
            >
              <EquipmentIcon type={equipment.equipment_type} className="w-8 h-8 text-white" />
            </div>
          </div>
        )}

        {/* Stangknapp */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 backdrop-blur-sm text-white hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Stang"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Huvudinnehall */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">
          {/* Typ och status - prominent */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: typeConfig.color }}
              >
                <EquipmentIcon type={equipment.equipment_type} className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {getEquipmentTypeLabel(equipment.equipment_type)}
                </h2>
                {equipment.serial_number && (
                  <p className="text-sm text-slate-400 font-mono mt-0.5">
                    #{equipment.serial_number}
                  </p>
                )}
              </div>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.borderColor} border text-${statusConfig.color}`}
            >
              {getEquipmentStatusLabel(equipment.status)}
            </span>
          </div>

          {/* Separator */}
          <div className="border-t border-slate-700/50" />

          {/* Informationsgrupper */}
          <div className="space-y-4">
            {/* Kund */}
            {customerName && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Building className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Kund</p>
                  <p className="text-white font-medium mt-0.5 truncate">{customerName}</p>
                </div>
              </div>
            )}

            {/* Position - klickbar for att oppna i karta */}
            <button
              onClick={() => openInMapsApp(equipment.latitude, equipment.longitude)}
              className="w-full flex items-start gap-3 p-3 -m-3 rounded-xl hover:bg-slate-800/50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Position</p>
                <p className="text-white font-mono mt-0.5">
                  {formatCoordinates(equipment.latitude, equipment.longitude)}
                </p>
              </div>
              <div className="self-center">
                <ExternalLink className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </div>
            </button>

            {/* Placerad av */}
            {equipment.technician?.name && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Placerad av</p>
                  <p className="text-white mt-0.5">{equipment.technician.name}</p>
                </div>
              </div>
            )}

            {/* Datum */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Placeringsdatum</p>
                <p className="text-white mt-0.5">{formatDate(equipment.placed_at)}</p>
              </div>
            </div>

            {/* Kommentar */}
            {equipment.comment && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Kommentar</p>
                  <p className="text-slate-300 mt-0.5 whitespace-pre-wrap">{equipment.comment}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer med atgardsknappar */}
      {!readOnly && (onEdit || onDelete) && (
        <div className="flex-shrink-0 p-4 border-t border-slate-700/50 bg-slate-900/95">
          <div className="flex gap-3">
            {onEdit && (
              <button
                onClick={() => onEdit(equipment)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium hover:bg-amber-500/20 transition-colors min-h-[52px]"
              >
                <Edit className="w-5 h-5" />
                <span>Redigera</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(equipment)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/20 transition-colors min-h-[52px]"
              >
                <Trash2 className="w-5 h-5" />
                <span>Ta bort</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )

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
      <AnimatePresence>
        {showLightbox && equipment.photo_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
            >
              <img
                src={equipment.photo_url}
                alt="Utrustningsfoto"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <button
                onClick={() => setShowLightbox(false)}
                className="absolute top-4 right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors min-w-[52px] min-h-[52px] flex items-center justify-center"
                aria-label="Stang bild"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default EquipmentDetailSheet
