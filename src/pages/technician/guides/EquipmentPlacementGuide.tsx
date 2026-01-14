// src/pages/technician/guides/EquipmentPlacementGuide.tsx
// SUPER-PEDAGOGISK GUIDE: Hur du registrerar utrustningsplaceringar
// Version 2.0 - Optimerad för tekniker med begränsad datorvana
// Samma standard som FollowUpCaseGuide.tsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Navigation,
  Building,
  Crosshair,
  Camera,
  Eye,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  MousePointer2,
  ArrowDown,
  Sparkles,
  Target,
  Zap,
  ThumbsUp,
  ThumbsDown,
  X,
  Loader2,
  Image,
  MessageSquare,
  Save,
  MapPinned,
  Search,
  Filter,
  Smartphone,
  Home,
  Clock
} from 'lucide-react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'

// ============================================================================
// MOCK-KOMPONENTER - Visar hur riktiga UI-element ser ut
// ============================================================================

// Mock: Kund-chip filter som visar hur kundval ser ut
const MockCustomerChip = ({
  name,
  selected = false,
  onClick,
  animated = false
}: {
  name: string
  selected?: boolean
  onClick?: () => void
  animated?: boolean
}) => (
  <motion.button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-base font-medium transition-all whitespace-nowrap ${
      selected
        ? 'bg-emerald-500 text-white'
        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`}
    animate={animated ? {
      boxShadow: [
        '0 0 0 0 rgba(16, 185, 129, 0)',
        '0 0 0 10px rgba(16, 185, 129, 0.3)',
        '0 0 0 0 rgba(16, 185, 129, 0)'
      ]
    } : {}}
    transition={animated ? {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    } : {}}
  >
    {name}
  </motion.button>
)

// Mock: Plus-knappen för att lägga till ny utrustning
const MockAddButton = ({
  animated = false,
  onClick,
  size = 'normal'
}: {
  animated?: boolean
  onClick?: () => void
  size?: 'normal' | 'large'
}) => {
  const sizeClasses = size === 'large'
    ? 'w-20 h-20'
    : 'w-14 h-14'

  return (
    <motion.button
      onClick={onClick}
      className={`${sizeClasses} rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-all duration-200`}
      animate={animated ? {
        boxShadow: [
          '0 0 0 0 rgba(16, 185, 129, 0)',
          '0 0 0 15px rgba(16, 185, 129, 0.4)',
          '0 0 0 0 rgba(16, 185, 129, 0)'
        ],
        scale: [1, 1.05, 1]
      } : {}}
      transition={animated ? {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      } : {}}
      whileTap={{ scale: 0.95 }}
    >
      <Plus className={size === 'large' ? 'w-10 h-10' : 'w-7 h-7'} />
    </motion.button>
  )
}

// Mock: Utrustningstyp dropdown med färgkodning
const MockEquipmentTypeSelector = ({
  selected,
  onSelect,
  isOpen,
  onToggle
}: {
  selected: string
  onSelect: (type: string) => void
  isOpen: boolean
  onToggle: () => void
}) => {
  const equipmentTypes = [
    {
      name: 'Mekanisk fälla',
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      description: 'Kräver serienummer'
    },
    {
      name: 'Betongstation',
      color: 'bg-slate-500',
      textColor: 'text-slate-400',
      description: 'Robust utomhusstation'
    },
    {
      name: 'Plaststation',
      color: 'bg-slate-800',
      textColor: 'text-slate-300',
      description: 'Lätt och flexibel'
    },
  ]

  const selectedType = equipmentTypes.find(t => t.name === selected)

  return (
    <div className="relative w-full">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 bg-slate-800/70 border-2 border-slate-600 rounded-xl text-left flex items-center justify-between text-white text-lg transition-all duration-200 hover:border-emerald-500/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
      >
        <div className="flex items-center gap-3">
          {selectedType && (
            <div className={`w-4 h-4 rounded-full ${selectedType.color}`} />
          )}
          <span className={selected ? 'text-white' : 'text-slate-400'}>
            {selected || 'Välj utrustningstyp...'}
          </span>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl overflow-hidden"
          >
            {equipmentTypes.map((type) => (
              <button
                key={type.name}
                onClick={() => {
                  onSelect(type.name)
                  onToggle()
                }}
                className="w-full px-5 py-4 text-left flex items-center gap-4 hover:bg-emerald-500/20 text-white text-lg transition-colors duration-150 border-b border-slate-700 last:border-b-0"
              >
                <div className={`w-5 h-5 rounded-full ${type.color} flex-shrink-0`} />
                <div className="flex-1">
                  <div className="font-medium">{type.name}</div>
                  <div className="text-sm text-slate-400">{type.description}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Mock: GPS-knappen med animation
const MockGpsButton = ({
  onClick,
  loading = false,
  success = false,
  animated = false
}: {
  onClick?: () => void
  loading?: boolean
  success?: boolean
  animated?: boolean
}) => (
  <motion.button
    onClick={onClick}
    disabled={loading}
    className={`w-full py-4 px-6 rounded-xl text-lg font-semibold flex items-center justify-center gap-3 transition-all duration-200 ${
      success
        ? 'bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-300'
        : loading
          ? 'bg-slate-700 text-slate-400 cursor-wait'
          : 'bg-blue-500/20 border-2 border-blue-500/40 text-blue-300 hover:bg-blue-500/30'
    }`}
    animate={animated && !loading && !success ? {
      boxShadow: [
        '0 0 0 0 rgba(59, 130, 246, 0)',
        '0 0 0 10px rgba(59, 130, 246, 0.3)',
        '0 0 0 0 rgba(59, 130, 246, 0)'
      ]
    } : {}}
    transition={animated ? {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    } : {}}
    whileTap={loading ? {} : { scale: 0.98 }}
  >
    {loading ? (
      <>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-6 h-6" />
        </motion.div>
        Hämtar position...
      </>
    ) : success ? (
      <>
        <CheckCircle className="w-6 h-6" />
        Position hämtad!
      </>
    ) : (
      <>
        <Crosshair className="w-6 h-6" />
        Hämta GPS-position
      </>
    )}
  </motion.button>
)

// Mock: Kart-preview med markörer
const MockMapPreview = ({
  markers = [],
  newMarker = null,
  showAnimation = false
}: {
  markers?: Array<{ type: 'mekanisk' | 'betong' | 'plast', x: number, y: number }>
  newMarker?: { x: number, y: number } | null
  showAnimation?: boolean
}) => {
  const markerColors = {
    mekanisk: 'bg-emerald-500',
    betong: 'bg-slate-400',
    plast: 'bg-slate-700 border-2 border-slate-500'
  }

  return (
    <div className="relative w-full h-64 bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700">
      {/* Stiliserad kartbakgrund */}
      <div className="absolute inset-0">
        {/* Gator/linjer */}
        <div className="absolute top-1/4 left-0 right-0 h-1 bg-slate-700/50" />
        <div className="absolute top-1/2 left-0 right-0 h-2 bg-slate-700/70" />
        <div className="absolute top-3/4 left-0 right-0 h-1 bg-slate-700/50" />
        <div className="absolute left-1/4 top-0 bottom-0 w-1 bg-slate-700/50" />
        <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-slate-700/70" />
        <div className="absolute left-3/4 top-0 bottom-0 w-1 bg-slate-700/50" />

        {/* Kvarter */}
        <div className="absolute top-[10%] left-[10%] w-[30%] h-[30%] bg-slate-800/50 rounded" />
        <div className="absolute top-[10%] right-[10%] w-[25%] h-[35%] bg-slate-800/50 rounded" />
        <div className="absolute bottom-[15%] left-[15%] w-[25%] h-[25%] bg-slate-800/50 rounded" />
        <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-slate-800/50 rounded" />
      </div>

      {/* Zoom-kontroller (visuellt) */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-slate-400 text-lg">+</div>
        <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-slate-400 text-lg">−</div>
      </div>

      {/* Befintliga markörer */}
      {markers.map((marker, index) => (
        <div
          key={index}
          className={`absolute w-4 h-4 rounded-full ${markerColors[marker.type]} transform -translate-x-1/2 -translate-y-1/2 shadow-lg`}
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        />
      ))}

      {/* Ny markör med animation */}
      {newMarker && (
        <motion.div
          initial={showAnimation ? { y: -50, opacity: 0, scale: 1.5 } : {}}
          animate={showAnimation ? { y: 0, opacity: 1, scale: 1 } : {}}
          transition={{ type: 'spring', damping: 10, stiffness: 100 }}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${newMarker.x}%`, top: `${newMarker.y}%` }}
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(16, 185, 129, 0)',
                '0 0 0 20px rgba(16, 185, 129, 0.3)',
                '0 0 0 0 rgba(16, 185, 129, 0)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
          >
            <MapPin className="w-4 h-4 text-white" />
          </motion.div>
        </motion.div>
      )}

      {/* Leaflet-stil attribution */}
      <div className="absolute bottom-0 right-0 px-2 py-1 bg-slate-900/80 text-[10px] text-slate-500">
        OpenStreetMap
      </div>
    </div>
  )
}

// Mock: Utrustningskort som visar en sparad placering
const MockEquipmentCard = ({
  type,
  serialNumber,
  comment,
  hasPhoto = false,
  isNew = false
}: {
  type: string
  serialNumber?: string
  comment?: string
  hasPhoto?: boolean
  isNew?: boolean
}) => {
  const typeColors: Record<string, { bg: string, text: string, dot: string }> = {
    'Mekanisk fälla': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
    'Betongstation': { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
    'Plaststation': { bg: 'bg-slate-600/10', text: 'text-slate-300', dot: 'bg-slate-600' }
  }

  const colors = typeColors[type] || typeColors['Mekanisk fälla']

  return (
    <motion.div
      className={`p-4 rounded-xl border-2 ${
        isNew
          ? 'bg-emerald-500/10 border-emerald-500/50 ring-2 ring-emerald-500/30'
          : 'bg-slate-800/50 border-slate-700'
      }`}
      initial={isNew ? { scale: 0.9, opacity: 0 } : {}}
      animate={isNew ? { scale: 1, opacity: 1 } : {}}
      transition={{ duration: 0.3 }}
    >
      {isNew && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-3">
          <Sparkles className="w-4 h-4" />
          NY PLACERING!
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-4 h-4 rounded-full ${colors.dot} mt-1 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-white font-semibold">{type}</h4>
            {hasPhoto && <Camera className="w-4 h-4 text-slate-400" />}
          </div>
          {serialNumber && (
            <p className="text-sm text-slate-400 font-mono mt-1">SN: {serialNumber}</p>
          )}
          {comment && (
            <p className="text-sm text-slate-300 mt-1">{comment}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />
            <span>59.3293, 18.0686</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Mock: Foto-uppladdningsknapp
const MockPhotoUpload = ({
  hasPhoto = false,
  onClick,
  animated = false
}: {
  hasPhoto?: boolean
  onClick?: () => void
  animated?: boolean
}) => (
  <motion.button
    onClick={onClick}
    className={`w-full py-4 px-6 rounded-xl text-lg font-medium flex items-center justify-center gap-3 transition-all duration-200 border-2 border-dashed ${
      hasPhoto
        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
        : 'bg-slate-800/50 border-slate-600 text-slate-300 hover:border-slate-500'
    }`}
    animate={animated && !hasPhoto ? {
      borderColor: ['rgba(100, 116, 139, 0.5)', 'rgba(16, 185, 129, 0.5)', 'rgba(100, 116, 139, 0.5)']
    } : {}}
    transition={animated ? {
      duration: 2,
      repeat: Infinity
    } : {}}
  >
    {hasPhoto ? (
      <>
        <CheckCircle className="w-6 h-6" />
        Foto tillagt
      </>
    ) : (
      <>
        <Camera className="w-6 h-6" />
        Ta foto (valfritt)
      </>
    )}
  </motion.button>
)

// Animerad pil som pekar nedåt
const AnimatedArrow = ({ direction = 'down' }: { direction?: 'down' | 'right' }) => (
  <motion.div
    className="flex justify-center py-3"
    animate={{
      y: direction === 'down' ? [0, 8, 0] : 0,
      x: direction === 'right' ? [0, 8, 0] : 0
    }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
  >
    {direction === 'down' ? (
      <ArrowDown className="w-8 h-8 text-emerald-400" />
    ) : (
      <ChevronRight className="w-8 h-8 text-emerald-400" />
    )}
  </motion.div>
)

// Glödande highlight-ring
const GlowingHighlight = ({ children, color = 'emerald' }: { children: React.ReactNode, color?: 'emerald' | 'blue' }) => (
  <motion.div
    className="relative inline-block"
    animate={{
      boxShadow: color === 'emerald'
        ? [
            '0 0 0 0 rgba(16, 185, 129, 0)',
            '0 0 20px 8px rgba(16, 185, 129, 0.4)',
            '0 0 0 0 rgba(16, 185, 129, 0)'
          ]
        : [
            '0 0 0 0 rgba(59, 130, 246, 0)',
            '0 0 20px 8px rgba(59, 130, 246, 0.4)',
            '0 0 0 0 rgba(59, 130, 246, 0)'
          ]
    }}
    transition={{ duration: 2, repeat: Infinity }}
  >
    {children}
  </motion.div>
)

// ============================================================================
// GUIDE-STEG - Varje steg i guiden
// ============================================================================

interface GuideStep {
  id: number
  title: string
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  content: React.ReactNode
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    title: 'Vad är utrustningsplacering?',
    subtitle: 'En snabb introduktion',
    icon: HelpCircle,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-8">
        {/* Hero-sektion med stor ikon */}
        <div className="text-center py-6">
          <motion.div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/20 mb-6"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <MapPin className="w-12 h-12 text-emerald-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Registrera utrustning med GPS!
          </h3>
          <p className="text-xl text-slate-300 max-w-md mx-auto leading-relaxed">
            När du placerar fällor och stationer hos kunder, registrerar du dem med GPS-position så att alla kan hitta dem.
          </p>
        </div>

        {/* Scenario-kort */}
        <div className="bg-gradient-to-r from-slate-800/80 to-slate-800/40 rounded-2xl p-6 border border-slate-700">
          <h4 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-3">
            <Lightbulb className="w-6 h-6" />
            Typiskt scenario:
          </h4>
          <div className="space-y-4 text-lg text-slate-300">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">1</span>
              <p>Du placerar en <strong className="text-white">betongstation</strong> bakom kundens lager</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">2</span>
              <p>Du registrerar den i appen med <strong className="text-white">GPS-position och foto</strong></p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">3</span>
              <p>Nu kan <strong className="text-emerald-300">alla tekniker</strong> och <strong className="text-emerald-300">kunden själv</strong> hitta tillbaka!</p>
            </div>
          </div>
        </div>

        {/* Fördelar */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Alla hittar tillbaka</h5>
              <p className="text-slate-400">Nästa tekniker vet exakt var utrustningen är</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Kunden ser allt</h5>
              <p className="text-slate-400">I kundportalen kan de se sin utrustning och exportera PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Professionellt intryck</h5>
              <p className="text-slate-400">Dokumentation med kartor visar att vi har koll</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'Navigera till utrustningssidan',
    subtitle: 'Hur du hittar dit',
    icon: Navigation,
    iconColor: 'text-cyan-400',
    content: (
      <div className="space-y-8">
        {/* Instruktion */}
        <div className="bg-cyan-500/10 border-2 border-cyan-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-cyan-300 mb-3 flex items-center gap-3">
            <Target className="w-6 h-6" />
            Vad du ska göra:
          </h4>
          <p className="text-lg text-slate-300">
            Öppna utrustningssidan från din <strong className="text-white">Dashboard</strong> eller via direktlänken.
          </p>
        </div>

        {/* Simulerad dashboard */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">På din dashboard, leta efter:</p>

          <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 p-5 space-y-4">
            <h4 className="text-lg font-semibold text-white">Snabbåtgärder</h4>

            <div className="grid grid-cols-2 gap-3">
              {/* Andra knappar (dimmade) */}
              <div className="p-4 bg-slate-800/50 rounded-xl opacity-50">
                <div className="text-slate-500 text-center">Mina ärenden</div>
              </div>

              {/* UTRUSTNINGSKNAPPEN - HIGHLIGHTAD */}
              <motion.div
                className="p-4 bg-emerald-500/20 rounded-xl border-2 border-emerald-500/50 cursor-pointer"
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(16, 185, 129, 0)',
                    '0 0 15px 5px rgba(16, 185, 129, 0.3)',
                    '0 0 0 0 rgba(16, 185, 129, 0)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="flex flex-col items-center gap-2">
                  <MapPin className="w-8 h-8 text-emerald-400" />
                  <span className="text-emerald-300 font-medium text-lg">Utrustning</span>
                </div>
              </motion.div>

              <div className="p-4 bg-slate-800/50 rounded-xl opacity-50">
                <div className="text-slate-500 text-center">Provision</div>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-xl opacity-50">
                <div className="text-slate-500 text-center">Guider</div>
              </div>
            </div>

            {/* Pil som pekar */}
            <motion.div
              className="flex items-center gap-2 text-emerald-400 justify-center"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <span className="text-lg font-semibold">TRYCK HÄR!</span>
              <MousePointer2 className="w-6 h-6 animate-bounce" />
            </motion.div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-blue-300 mb-2">Tips!</h5>
              <p className="text-slate-300">
                Bokmärk <strong className="text-white font-mono">/technician/equipment</strong> i din mobils webbläsare för snabb åtkomst!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'Välj kund',
    subtitle: 'Använd chip-filter eller sök',
    icon: Building,
    iconColor: 'text-orange-400',
    content: (() => {
      const CustomerSelectDemo = () => {
        const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
        const customers = ['IKEA Kungens Kurva', 'Coop Forum', 'Willys Södermalm', 'Alla']

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-orange-300 mb-3 flex items-center gap-3">
                <Building className="w-6 h-6" />
                Vad du ska göra:
              </h4>
              <p className="text-lg text-slate-300">
                Innan du kan lägga till utrustning måste du <strong className="text-white">välja vilken kund</strong> det gäller.
              </p>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - klicka på en kund:</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5">
                <div className="flex flex-wrap gap-3 mb-4">
                  {customers.map((customer) => (
                    <MockCustomerChip
                      key={customer}
                      name={customer}
                      selected={selectedCustomer === customer}
                      onClick={() => setSelectedCustomer(customer)}
                      animated={selectedCustomer === null && customer === 'IKEA Kungens Kurva'}
                    />
                  ))}
                </div>

                {selectedCustomer && selectedCustomer !== 'Alla' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3"
                  >
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <span className="text-emerald-300 text-lg">
                      Bra! Du valde: <strong>{selectedCustomer}</strong>
                    </span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Alternativ - sökfält */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
                <Search className="w-5 h-5 text-slate-400" />
                Alternativ: Sök efter kund
              </h4>
              <p className="text-slate-300 mb-4">
                Om du har många kunder kan du söka istället för att scrolla.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-400">
                  Sök kund...
                </div>
                <button className="px-4 py-3 bg-slate-700 rounded-xl">
                  <Search className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        )
      }

      return <CustomerSelectDemo />
    })()
  },
  {
    id: 4,
    title: 'Starta ny placering',
    subtitle: 'Tryck på den GRÖNA plus-knappen',
    icon: Plus,
    iconColor: 'text-emerald-400',
    content: (
      <div className="space-y-8">
        {/* Stor varning om var knappen finns */}
        <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-emerald-300 mb-2">
                VIKTIGT: Titta NERE TILL HÖGER
              </h4>
              <p className="text-lg text-slate-300">
                Den gröna plus-knappen finns <strong className="text-white">i nedre högra hörnet</strong> av skärmen, precis som på många appar.
              </p>
            </div>
          </div>
        </div>

        {/* Simulerad vy med knappen */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Så här ser det ut:</p>

          <div className="relative bg-slate-900 rounded-2xl border-2 border-slate-700 overflow-hidden h-80">
            {/* Karta (bakgrund) */}
            <MockMapPreview
              markers={[
                { type: 'mekanisk', x: 30, y: 40 },
                { type: 'betong', x: 60, y: 30 },
                { type: 'plast', x: 45, y: 70 }
              ]}
            />

            {/* Kundfiltrer längst upp */}
            <div className="absolute top-0 left-0 right-0 bg-slate-900/90 p-3 flex gap-2 overflow-x-auto">
              <MockCustomerChip name="IKEA" selected />
              <MockCustomerChip name="Coop" />
              <MockCustomerChip name="Willys" />
            </div>

            {/* Plus-knappen - nere till höger */}
            <div className="absolute bottom-4 right-4">
              <GlowingHighlight>
                <MockAddButton animated size="large" />
              </GlowingHighlight>
            </div>

            {/* Pil som pekar på knappen */}
            <motion.div
              className="absolute bottom-28 right-6 flex flex-col items-center gap-1 text-emerald-400"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="text-lg font-bold bg-slate-900/80 px-3 py-1 rounded">KLICKA!</span>
              <ArrowDown className="w-8 h-8" />
            </motion.div>
          </div>
        </div>

        {/* Knappen visas stort */}
        <div className="text-center py-4">
          <p className="text-slate-400 mb-4 text-lg">Knappen ser ut så här:</p>
          <div className="flex justify-center">
            <MockAddButton size="large" animated />
          </div>
        </div>
      </div>
    )
  },
  {
    id: 5,
    title: 'Välj utrustningstyp',
    subtitle: 'INTERAKTIV DEMO - prova själv!',
    icon: Filter,
    iconColor: 'text-purple-400',
    content: (() => {
      const EquipmentTypeDemo = () => {
        const [selectedType, setSelectedType] = useState('')
        const [dropdownOpen, setDropdownOpen] = useState(false)

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-purple-300 mb-3 flex items-center gap-3">
                <Filter className="w-6 h-6" />
                Vad du ska göra:
              </h4>
              <ol className="text-lg text-slate-300 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">1</span>
                  <span>Klicka på dropdown-menyn</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span>Välj rätt <strong className="text-white">utrustningstyp</strong></span>
                </li>
              </ol>
            </div>

            {/* Färgkodning förklaring */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h5 className="font-semibold text-white mb-4">Färgkodning på kartan:</h5>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500" />
                  <span className="text-slate-300"><strong className="text-emerald-400">Grön</strong> = Mekanisk fälla</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-400" />
                  <span className="text-slate-300"><strong className="text-slate-400">Grå</strong> = Betongstation</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-700 border-2 border-slate-500" />
                  <span className="text-slate-300"><strong className="text-slate-300">Svart/mörk</strong> = Plaststation</span>
                </div>
              </div>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova själv (klicka!):</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-6">
                <label className="block text-slate-300 text-lg mb-3 font-medium">
                  Välj utrustningstyp:
                </label>
                <MockEquipmentTypeSelector
                  selected={selectedType}
                  onSelect={setSelectedType}
                  isOpen={dropdownOpen}
                  onToggle={() => setDropdownOpen(!dropdownOpen)}
                />

                {selectedType && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      <span className="text-green-300 text-lg">
                        Bra val! Du valde: <strong>{selectedType}</strong>
                      </span>
                    </div>
                    {selectedType === 'Mekanisk fälla' && (
                      <p className="text-amber-300 mt-2 ml-9 text-sm">
                        OBS: Du måste ange serienummer för mekaniska fällor!
                      </p>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )
      }

      return <EquipmentTypeDemo />
    })()
  },
  {
    id: 6,
    title: 'Hämta GPS-position',
    subtitle: 'INTERAKTIV DEMO med kart-animation',
    icon: Crosshair,
    iconColor: 'text-red-400',
    content: (() => {
      const GpsDemo = () => {
        const [loading, setLoading] = useState(false)
        const [success, setSuccess] = useState(false)
        const [showMarker, setShowMarker] = useState(false)

        const handleGetGps = () => {
          if (success) return
          setLoading(true)
          setShowMarker(false)

          setTimeout(() => {
            setLoading(false)
            setSuccess(true)
            setShowMarker(true)
          }, 2000)
        }

        const resetDemo = () => {
          setLoading(false)
          setSuccess(false)
          setShowMarker(false)
        }

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-red-300 mb-3 flex items-center gap-3">
                <Crosshair className="w-6 h-6" />
                VIKTIGT STEG!
              </h4>
              <p className="text-lg text-slate-300">
                GPS-positionen gör att andra kan <strong className="text-white">hitta tillbaka</strong> till utrustningen.
                Stå <strong className="text-white">så nära utrustningen som möjligt</strong> när du trycker!
              </p>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-4">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - tryck på knappen:</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
                <GlowingHighlight color="blue">
                  <MockGpsButton
                    onClick={handleGetGps}
                    loading={loading}
                    success={success}
                    animated={!loading && !success}
                  />
                </GlowingHighlight>

                {/* Karta som visar markören */}
                <div className="relative">
                  <MockMapPreview
                    markers={[
                      { type: 'mekanisk', x: 25, y: 35 },
                      { type: 'betong', x: 70, y: 45 }
                    ]}
                    newMarker={showMarker ? { x: 50, y: 55 } : null}
                    showAnimation={showMarker}
                  />

                  {loading && (
                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center rounded-xl">
                      <motion.div
                        className="flex flex-col items-center gap-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Crosshair className="w-12 h-12 text-blue-400" />
                        </motion.div>
                        <span className="text-blue-300 text-lg font-medium">Söker satellit...</span>
                      </motion.div>
                    </div>
                  )}
                </div>

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                      <span className="text-emerald-300 text-lg font-semibold">Position hämtad!</span>
                    </div>
                    <p className="text-slate-300 font-mono ml-9">
                      59.3293° N, 18.0686° E
                    </p>
                    <button
                      onClick={resetDemo}
                      className="mt-3 ml-9 text-sm text-slate-400 hover:text-white underline"
                    >
                      Prova igen
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Tips om GPS-problem */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-amber-300 mb-2">Om GPS inte fungerar:</h5>
                  <ul className="text-slate-300 space-y-1 text-sm">
                    <li>- Se till att du är <strong>utomhus</strong> eller nära fönster</li>
                    <li>- Ge webbläsaren <strong>tillåtelse</strong> att använda plats</li>
                    <li>- Vänta några sekunder och <strong>försök igen</strong></li>
                    <li>- Du kan också <strong>klicka på kartan</strong> för att markera manuellt</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <GpsDemo />
    })()
  },
  {
    id: 7,
    title: 'Foto och kommentar',
    subtitle: 'Gör det lätt att hitta tillbaka',
    icon: Camera,
    iconColor: 'text-pink-400',
    content: (() => {
      const PhotoDemo = () => {
        const [hasPhoto, setHasPhoto] = useState(false)
        const [comment, setComment] = useState('')

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-pink-500/10 border-2 border-pink-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-pink-300 mb-3 flex items-center gap-3">
                <Camera className="w-6 h-6" />
                Valfritt men REKOMMENDERAT:
              </h4>
              <p className="text-lg text-slate-300">
                Ett foto och en bra kommentar gör det <strong className="text-white">mycket lättare</strong> för nästa tekniker att hitta tillbaka!
              </p>
            </div>

            {/* Demo */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-6 space-y-5">
              {/* Foto-knapp */}
              <div>
                <label className="block text-slate-300 text-lg mb-3 font-medium">
                  Foto:
                </label>
                <MockPhotoUpload
                  hasPhoto={hasPhoto}
                  onClick={() => setHasPhoto(!hasPhoto)}
                  animated={!hasPhoto}
                />
              </div>

              {/* Kommentar */}
              <div>
                <label className="block text-slate-300 text-lg mb-3 font-medium">
                  Kommentar:
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ex: Bakom sopcontainern, vänster sida..."
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-600 rounded-xl text-white text-lg placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                  rows={3}
                />
              </div>

              {(hasPhoto || comment) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3"
                >
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                  <span className="text-emerald-300">Bra jobbat! Detta hjälper andra hitta tillbaka.</span>
                </motion.div>
              )}
            </div>

            {/* Bra foto-tips */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-blue-400" />
                Tips för bra foton:
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Visa utrustningen OCH omgivningen</span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Inkludera landmärken (dörrar, skyltar)</span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>Undvik för nära bilder</span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>Undvik suddiga bilder</span>
                </div>
              </div>
            </div>

            {/* Bra kommentarer */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h5 className="font-semibold text-white mb-4">Exempel på BRA kommentarer:</h5>
              <div className="space-y-2 font-mono text-sm bg-slate-900/50 p-4 rounded-lg">
                <p className="text-emerald-300">"Bakom sopcontainern, vänster sida"</p>
                <p className="text-emerald-300">"Vid lastbrygga 2, under trappan"</p>
                <p className="text-emerald-300">"Innanför grinden, 3 meter höger"</p>
                <p className="text-emerald-300">"I källaren, rum B12, vid fläkten"</p>
              </div>
            </div>
          </div>
        )
      }

      return <PhotoDemo />
    })()
  },
  {
    id: 8,
    title: 'Spara och granska',
    subtitle: 'Se resultatet på kartan',
    icon: Save,
    iconColor: 'text-green-400',
    content: (() => {
      const SaveDemo = () => {
        const [saved, setSaved] = useState(false)
        const [saving, setSaving] = useState(false)

        const handleSave = () => {
          if (saved) return
          setSaving(true)
          setTimeout(() => {
            setSaving(false)
            setSaved(true)
          }, 1500)
        }

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-green-300 mb-3 flex items-center gap-3">
                <Zap className="w-6 h-6" />
                Sista steget!
              </h4>
              <p className="text-lg text-slate-300">
                När du fyllt i allt, tryck på <strong className="text-emerald-300">"Spara placering"</strong> för att slutföra.
              </p>
            </div>

            {/* Simulerat formulär med spara-knapp */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-6 space-y-4">
              {/* Sammanfattning */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className="text-slate-400">Kund:</span>
                  <span className="text-white font-medium">IKEA Kungens Kurva</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className="text-slate-400">Utrustning:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-white font-medium">Mekanisk fälla</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className="text-slate-400">Serienummer:</span>
                  <span className="text-white font-mono">MF-2024-0847</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className="text-slate-400">GPS:</span>
                  <span className="text-emerald-400 font-mono text-sm">59.3293, 18.0686</span>
                </div>
              </div>

              {/* Spara-knapp */}
              <GlowingHighlight>
                <motion.button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className={`w-full py-4 px-6 rounded-xl text-lg font-semibold flex items-center justify-center gap-3 transition-all duration-200 ${
                    saved
                      ? 'bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-300'
                      : saving
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  }`}
                  whileTap={saving || saved ? {} : { scale: 0.98 }}
                >
                  {saving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 className="w-6 h-6" />
                      </motion.div>
                      Sparar...
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle className="w-6 h-6" />
                      Sparad!
                    </>
                  ) : (
                    <>
                      <Save className="w-6 h-6" />
                      Spara placering
                    </>
                  )}
                </motion.button>
              </GlowingHighlight>
            </div>

            {/* Resultat */}
            <AnimatePresence>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <div className="bg-emerald-500/20 border-2 border-emerald-500/40 rounded-2xl p-6 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                    >
                      <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    </motion.div>
                    <h4 className="text-2xl font-bold text-emerald-300 mb-2">Klart!</h4>
                    <p className="text-lg text-slate-300">
                      Utrustningen är nu registrerad och syns på kartan.
                    </p>
                  </div>

                  {/* Visa hur det ser ut */}
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Så här ser det ut nu:</p>
                    <MockEquipmentCard
                      type="Mekanisk fälla"
                      serialNumber="MF-2024-0847"
                      comment="Vid lastbrygga 2"
                      hasPhoto
                      isNew
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!saved && (
              <p className="text-center text-slate-400 text-lg">
                Prova att klicka på spara-knappen ovan!
              </p>
            )}
          </div>
        )
      }

      return <SaveDemo />
    })()
  },
  {
    id: 9,
    title: 'Vanliga frågor (FAQ)',
    subtitle: 'Svar på det du undrar',
    icon: HelpCircle,
    iconColor: 'text-pink-400',
    content: (
      <div className="space-y-6">
        {/* FAQ-kort */}
        {[
          {
            question: 'Måste jag alltid ange serienummer?',
            answer: 'Bara för mekaniska fällor! De kräver serienummer för spårbarhet. Betong- och plaststationer behöver det inte.',
            icon: Home
          },
          {
            question: 'Vad händer om GPS visar fel position?',
            answer: 'Du kan klicka direkt på kartan för att justera positionen. Försök att vara utomhus eller nära fönster för bättre GPS-signal.',
            icon: MapPin
          },
          {
            question: 'Kan jag redigera en placering efteråt?',
            answer: 'Ja! Klicka på placeringen i listan för att öppna den och gör dina ändringar. Du kan uppdatera foto, kommentar och position.',
            icon: Eye
          },
          {
            question: 'Måste jag ta foto?',
            answer: 'Nej, det är valfritt men starkt rekommenderat. Ett foto gör det MYCKET lättare att hitta tillbaka.',
            icon: Camera
          },
          {
            question: 'Ser kunden mina placeringar?',
            answer: 'Ja, om kunden är inloggad i kundportalen kan de se all sin utrustning med bilder och kommentarer.',
            icon: Building
          },
          {
            question: 'Vad om jag placerar hos fel kund?',
            answer: 'Kontakta kontoret för att flytta placeringen till rätt kund. Det går inte att ändra kund själv i efterhand.',
            icon: AlertTriangle
          }
        ].map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-pink-500/20 rounded-lg flex-shrink-0">
                  <faq.icon className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">{faq.question}</h4>
                  <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    )
  },
  {
    id: 10,
    title: 'Sammanfattning',
    subtitle: 'Allt du behöver komma ihåg',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    content: (
      <div className="space-y-8">
        {/* Stora steg */}
        <div className="space-y-4">
          <h4 className="text-xl font-semibold text-white text-center mb-6">
            6 enkla steg - det är allt!
          </h4>

          {[
            { step: 1, text: 'Öppna utrustningssidan', color: 'cyan' },
            { step: 2, text: 'Välj kund i chip-filtret', color: 'orange' },
            { step: 3, text: 'Tryck på GRÖNA plus-knappen', color: 'emerald' },
            { step: 4, text: 'Välj utrustningstyp', color: 'purple' },
            { step: 5, text: 'Hämta GPS-position', color: 'red' },
            { step: 6, text: 'Spara (och lägg till foto/kommentar)', color: 'green' },
          ].map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15 }}
              className="flex items-center gap-4 p-5 rounded-xl"
              style={{
                background: `rgba(${
                  item.color === 'cyan' ? '6, 182, 212' :
                  item.color === 'orange' ? '249, 115, 22' :
                  item.color === 'emerald' ? '16, 185, 129' :
                  item.color === 'purple' ? '168, 85, 247' :
                  item.color === 'red' ? '239, 68, 68' :
                  '34, 197, 94'
                }, 0.1)`,
                border: `2px solid rgba(${
                  item.color === 'cyan' ? '6, 182, 212' :
                  item.color === 'orange' ? '249, 115, 22' :
                  item.color === 'emerald' ? '16, 185, 129' :
                  item.color === 'purple' ? '168, 85, 247' :
                  item.color === 'red' ? '239, 68, 68' :
                  '34, 197, 94'
                }, 0.3)`
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
                style={{
                  background: item.color === 'cyan' ? '#06b6d4' :
                              item.color === 'orange' ? '#f97316' :
                              item.color === 'emerald' ? '#10b981' :
                              item.color === 'purple' ? '#a855f7' :
                              item.color === 'red' ? '#ef4444' :
                              '#22c55e'
                }}
              >
                {item.step}
              </div>
              <span className="text-lg text-white font-medium">{item.text}</span>
            </motion.div>
          ))}
        </div>

        {/* Knappen en sista gång */}
        <div className="text-center py-6">
          <p className="text-slate-400 mb-4">Kom ihåg att leta efter denna knapp:</p>
          <div className="flex justify-center">
            <MockAddButton size="large" animated />
          </div>
        </div>

        {/* Uppmuntran */}
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl p-6 border border-green-500/30 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block mb-4"
          >
            <ThumbsUp className="w-16 h-16 text-green-400" />
          </motion.div>
          <h4 className="text-2xl font-bold text-green-300 mb-2">Du klarar detta!</h4>
          <p className="text-lg text-slate-300">
            Nästa gång du placerar utrustning, testa att registrera den direkt i appen. Det tar bara 30 sekunder!
          </p>
        </div>
      </div>
    )
  }
]

// ============================================================================
// HUVUDKOMPONENT
// ============================================================================

export default function EquipmentPlacementGuide() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const handleStepComplete = (stepIndex: number) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]))
  }

  const goToStep = (stepIndex: number) => {
    if (stepIndex > currentStep) {
      handleStepComplete(currentStep)
    }
    setCurrentStep(stepIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToNextStep = () => {
    if (currentStep < guideSteps.length - 1) {
      handleStepComplete(currentStep)
      setCurrentStep(currentStep + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const currentStepData = guideSteps[currentStep]
  const progress = ((currentStep + 1) / guideSteps.length) * 100

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/technician/dashboard')}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white">Guide: Utrustningsplacering</h1>
              <p className="text-sm text-slate-400">Steg {currentStep + 1} av {guideSteps.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Progress bar - STOR och tydlig */}
          <div className="mt-4">
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Start</span>
              <span>{Math.round(progress)}% klart</span>
              <span>Mål</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar med steg-navigering (desktop) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-40">
              <Card className="p-4">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                  Innehåll
                </h3>
                <nav className="space-y-1">
                  {guideSteps.map((step, index) => {
                    const isActive = index === currentStep
                    const isCompleted = completedSteps.has(index)

                    return (
                      <button
                        key={step.id}
                        onClick={() => goToStep(index)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isCompleted
                              ? 'text-slate-300 hover:bg-slate-800'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-emerald-500 text-white'
                            : isCompleted
                              ? 'bg-emerald-500/30 text-emerald-400'
                              : 'bg-slate-700 text-slate-400'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-bold">{index + 1}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{step.title}</span>
                      </button>
                    )
                  })}
                </nav>
              </Card>
            </div>
          </div>

          {/* Huvudinnehåll */}
          <div className="lg:col-span-8">
            {/* Mobil steg-indikator - STOR */}
            <div className="lg:hidden mb-6 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-2">
                {guideSteps.map((step, index) => {
                  const isActive = index === currentStep
                  const isCompleted = completedSteps.has(index)

                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(index)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30'
                          : isCompleted
                            ? 'bg-emerald-500/30 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">{index + 1}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Steginnehåll */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-6 lg:p-8">
                  {/* Steghuvud - STOR */}
                  <div className="flex items-center gap-4 lg:gap-6 mb-8 pb-6 border-b border-slate-700">
                    <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-slate-800 flex items-center justify-center`}>
                      <currentStepData.icon className={`w-8 h-8 lg:w-10 lg:h-10 ${currentStepData.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm lg:text-base text-slate-400 mb-1">Steg {currentStep + 1} av {guideSteps.length}</p>
                      <h2 className="text-xl lg:text-2xl font-bold text-white">{currentStepData.title}</h2>
                      {currentStepData.subtitle && (
                        <p className="text-slate-400 mt-1">{currentStepData.subtitle}</p>
                      )}
                    </div>
                  </div>

                  {/* Steginnehåll */}
                  <div className="min-h-[400px]">
                    {currentStepData.content}
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigeringsknappar - STORA och tydliga */}
            <div className="flex items-center justify-between mt-8 gap-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2 py-4 px-6 text-lg"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Föregående</span>
                <span className="sm:hidden">Bakåt</span>
              </Button>

              {currentStep === guideSteps.length - 1 ? (
                <Button
                  onClick={() => navigate('/technician/equipment')}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-emerald-500 hover:bg-emerald-400 text-white"
                >
                  <MapPin className="w-5 h-5" />
                  Öppna Utrustning
                </Button>
              ) : (
                <Button
                  onClick={goToNextStep}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-emerald-500 hover:bg-emerald-400 text-white"
                >
                  <span>Nästa steg</span>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Snabbhjälp längst ner */}
            <div className="mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 text-slate-400">
                <HelpCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">
                  Behöver du mer hjälp? Kontakta kontoret på{' '}
                  <a href="tel:010-2051600" className="text-emerald-400 hover:text-emerald-300">
                    010-205 16 00
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
