// src/components/customer/StationInspectionList.tsx
// Lista över inspekterade stationer för kundportalen

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  AlertTriangle,
  Wrench,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Home,
  Image as ImageIcon,
  MessageSquare,
  Ruler,
  Filter,
  Search,
  Expand
} from 'lucide-react'
import type { OutdoorInspectionWithRelations } from '../../types/inspectionSession'
import type { IndoorStationInspectionWithRelations, InspectionStatus } from '../../types/indoor'
import { INSPECTION_STATUS_CONFIG } from '../../types/indoor'
import { InspectionPhotoLightbox } from './InspectionPhotoLightbox'

type InspectionItem = {
  id: string
  stationId: string
  stationNumber: string | null
  stationTypeName: string // Riktigt namn från station_types (t.ex. "Betongstation")
  stationTypeCode: string // Kod för fallback (t.ex. "betongstation")
  location: 'outdoor' | 'indoor'
  floorPlanId?: string
  floorPlanName?: string
  buildingName?: string
  status: InspectionStatus
  findings: string | null
  photoUrl: string | null
  measurementValue: number | null
  measurementUnit: string | null
  measurementLabel: string | null // Etikett från station_types (t.ex. "Förbrukning (g)")
  inspectedAt: string
}

interface StationInspectionListProps {
  outdoorInspections: OutdoorInspectionWithRelations[]
  indoorInspections: IndoorStationInspectionWithRelations[]
  onStationClick?: (stationId: string, location: 'outdoor' | 'indoor') => void
}

// Hjälpfunktion för att få statusikon
function StatusIcon({ status, className = "w-5 h-5" }: { status: InspectionStatus; className?: string }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className={`${className} text-emerald-400`} />
    case 'activity':
      return <AlertTriangle className={`${className} text-amber-400`} />
    case 'needs_service':
      return <Wrench className={`${className} text-orange-400`} />
    case 'replaced':
      return <RefreshCw className={`${className} text-blue-400`} />
    default:
      return <CheckCircle2 className={`${className} text-slate-400`} />
  }
}

// Statusbadge-komponent
function StatusBadge({ status }: { status: InspectionStatus }) {
  const config = INSPECTION_STATUS_CONFIG[status] || {
    label: 'Okänd',
    bgColor: 'bg-slate-500/20',
    color: 'slate-400'
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} text-${config.color}`}>
      {config.label}
    </span>
  )
}

export function StationInspectionList({
  outdoorInspections,
  indoorInspections,
  onStationClick
}: StationInspectionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<InspectionStatus | 'all'>('all')
  const [filterLocation, setFilterLocation] = useState<'all' | 'outdoor' | 'indoor'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Lightbox state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0)

  // Kombinera och transformera alla inspektioner
  const allInspections = useMemo(() => {
    const items: InspectionItem[] = []

    // Lägg till utomhusinspektioner
    outdoorInspections.forEach(inspection => {
      const station = inspection.station
      const stationTypeData = station?.station_type_data

      items.push({
        id: inspection.id,
        stationId: inspection.station_id,
        stationNumber: station?.serial_number || null,
        stationTypeName: stationTypeData?.name || 'Utomhusstation',
        stationTypeCode: station?.equipment_type || 'outdoor',
        location: 'outdoor',
        status: inspection.status,
        findings: inspection.findings,
        photoUrl: inspection.photo_url || null,
        measurementValue: inspection.measurement_value,
        measurementUnit: inspection.measurement_unit,
        measurementLabel: stationTypeData?.measurement_label || null,
        inspectedAt: inspection.inspected_at
      })
    })

    // Lägg till inomhusinspektioner
    indoorInspections.forEach(inspection => {
      const station = inspection.station
      const stationTypeData = station?.station_type_data
      const floorPlan = station?.floor_plan

      items.push({
        id: inspection.id,
        stationId: inspection.station_id,
        stationNumber: station?.station_number || null,
        stationTypeName: stationTypeData?.name || 'Inomhusstation',
        stationTypeCode: station?.station_type || 'indoor',
        location: 'indoor',
        floorPlanId: floorPlan?.id,
        floorPlanName: floorPlan?.name,
        buildingName: floorPlan?.building_name || undefined,
        status: inspection.status,
        findings: inspection.findings,
        photoUrl: inspection.photo_url || null,
        measurementValue: inspection.measurement_value,
        measurementUnit: inspection.measurement_unit,
        measurementLabel: stationTypeData?.measurement_label || null,
        inspectedAt: inspection.inspected_at
      })
    })

    // Sortera efter inspektionstid (senast först)
    return items.sort((a, b) =>
      new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime()
    )
  }, [outdoorInspections, indoorInspections])

  // Filtrera inspektioner
  const filteredInspections = useMemo(() => {
    return allInspections.filter(item => {
      // Statusfilter
      if (filterStatus !== 'all' && item.status !== filterStatus) return false
      // Platsfilter
      if (filterLocation !== 'all' && item.location !== filterLocation) return false
      // Sökfilter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesNumber = item.stationNumber?.toLowerCase().includes(query)
        const matchesType = item.stationTypeName.toLowerCase().includes(query)
        const matchesFloorPlan = item.floorPlanName?.toLowerCase().includes(query)
        const matchesBuilding = item.buildingName?.toLowerCase().includes(query)
        if (!matchesNumber && !matchesType && !matchesFloorPlan && !matchesBuilding) return false
      }
      return true
    })
  }, [allInspections, filterStatus, filterLocation, searchQuery])

  // Statistik
  const stats = useMemo(() => ({
    total: allInspections.length,
    ok: allInspections.filter(i => i.status === 'ok').length,
    activity: allInspections.filter(i => i.status === 'activity').length,
    needsService: allInspections.filter(i => i.status === 'needs_service').length,
    replaced: allInspections.filter(i => i.status === 'replaced').length,
    outdoor: allInspections.filter(i => i.location === 'outdoor').length,
    indoor: allInspections.filter(i => i.location === 'indoor').length
  }), [allInspections])

  // Foton för lightbox (endast inspektioner med foton)
  const photosForLightbox = useMemo(() => {
    return filteredInspections
      .filter(item => item.photoUrl)
      .map(item => ({
        url: item.photoUrl!,
        stationNumber: item.stationNumber || item.stationTypeName,
        stationType: item.location,
        status: item.status,
        inspectedAt: item.inspectedAt,
        findings: item.findings || undefined
      }))
  }, [filteredInspections])

  // Öppna lightbox för en specifik bild
  const openLightbox = (itemId: string) => {
    const photoItems = filteredInspections.filter(item => item.photoUrl)
    const index = photoItems.findIndex(item => item.id === itemId)
    if (index !== -1) {
      setLightboxInitialIndex(index)
      setIsLightboxOpen(true)
    }
  }

  // Formatera datum
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Bygg stationsnamn för visning: Typnamn (t.ex. "Betesstation", "Mekanisk fälla")
  // Stationsnummer visas i undertexten
  const getStationDisplayName = (item: InspectionItem): string => {
    // Primärt visa typnamnet från station_types (t.ex. "Betesstation")
    return item.stationTypeName
  }

  // Bygg platsinfo med stationsnummer
  const getLocationInfo = (item: InspectionItem): string => {
    const parts: string[] = []

    // Lägg till stationsnummer först om det finns
    if (item.stationNumber) {
      parts.push(item.stationNumber)
    }

    // Lägg till plats
    if (item.location === 'outdoor') {
      parts.push('Utomhus')
    } else if (item.floorPlanName) {
      const floorPlanText = item.buildingName
        ? `${item.buildingName} - ${item.floorPlanName}`
        : item.floorPlanName
      parts.push(floorPlanText)
    } else {
      parts.push('Inomhus')
    }

    return parts.join(' · ')
  }

  if (allInspections.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8 text-center">
        <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Search className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Inga inspektioner</h3>
        <p className="text-slate-400">Det finns inga inspektionsresultat att visa ännu.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter och sök */}
      <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Sökfält */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400 hidden md:block" />

            {/* Statusfilter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as InspectionStatus | 'all')}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="all">Alla statusar ({stats.total})</option>
              <option value="ok">OK ({stats.ok})</option>
              <option value="activity">Aktivitet ({stats.activity})</option>
              <option value="needs_service">Service ({stats.needsService})</option>
              <option value="replaced">Utbytt ({stats.replaced})</option>
            </select>

            {/* Platsfilter */}
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value as 'all' | 'outdoor' | 'indoor')}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="all">Alla platser</option>
              <option value="outdoor">Utomhus ({stats.outdoor})</option>
              <option value="indoor">Inomhus ({stats.indoor})</option>
            </select>
          </div>
        </div>

        {/* Resultaträknare */}
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-sm text-slate-400">
            Visar {filteredInspections.length} av {allInspections.length} inspektioner
          </p>
        </div>
      </div>

      {/* Inspektionslista */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredInspections.map((item, index) => {
            const isExpanded = expandedId === item.id
            const statusConfig = INSPECTION_STATUS_CONFIG[item.status]

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.02 }}
                className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-colors"
              >
                {/* Huvudrad */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  {/* Statusikon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${statusConfig?.bgColor || 'bg-slate-500/20'}`}>
                    <StatusIcon status={item.status} />
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white">
                        {getStationDisplayName(item)}
                      </h4>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        {item.location === 'outdoor' ? (
                          <MapPin className="w-3.5 h-3.5" />
                        ) : (
                          <Home className="w-3.5 h-3.5" />
                        )}
                        {getLocationInfo(item)}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span>{formatTime(item.inspectedAt)}</span>
                    </div>
                  </div>

                  {/* Indikatorer */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.photoUrl && (
                      <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                    )}
                    {item.findings && (
                      <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                    )}
                    {item.measurementValue !== null && (
                      <div className="w-7 h-7 bg-teal-500/20 rounded-lg flex items-center justify-center">
                        <Ruler className="w-3.5 h-3.5 text-teal-400" />
                      </div>
                    )}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isExpanded ? 'bg-emerald-500/20' : 'bg-slate-700/50'
                    }`}>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
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
                        {/* Mätning */}
                        {item.measurementValue !== null && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Ruler className="w-4 h-4 text-teal-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wide">
                                {item.measurementLabel || 'Mätvärde'}
                              </p>
                              <p className="text-white font-medium">
                                {item.measurementValue} {item.measurementUnit || 'st'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Anteckningar */}
                        {item.findings && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="w-4 h-4 text-purple-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wide">Teknikerns notering</p>
                              <p className="text-slate-300 text-sm whitespace-pre-wrap mt-1">{item.findings}</p>
                            </div>
                          </div>
                        )}

                        {/* Foto */}
                        {item.photoUrl && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Foto</p>
                            <div className="relative group cursor-pointer" onClick={() => openLightbox(item.id)}>
                              <img
                                src={item.photoUrl}
                                alt="Inspektionsfoto"
                                className="max-w-full max-h-64 rounded-xl border border-slate-700/50 object-contain transition-all group-hover:brightness-90"
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2">
                                  <Expand className="w-4 h-4 text-white" />
                                  <span className="text-white text-sm font-medium">Visa fullskärm</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Visa på karta-knapp */}
                        {onStationClick && (
                          <button
                            onClick={() => onStationClick(item.stationId, item.location)}
                            className="w-full py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
                          >
                            {item.location === 'outdoor' ? (
                              <MapPin className="w-4 h-4" />
                            ) : (
                              <Home className="w-4 h-4" />
                            )}
                            Visa på {item.location === 'outdoor' ? 'karta' : 'planritning'}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Tom resultat efter filtrering */}
      {filteredInspections.length === 0 && allInspections.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-8 text-center">
          <Search className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Inga inspektioner matchar dina filter</p>
          <button
            onClick={() => {
              setFilterStatus('all')
              setFilterLocation('all')
              setSearchQuery('')
            }}
            className="mt-3 text-emerald-400 text-sm hover:underline"
          >
            Rensa filter
          </button>
        </div>
      )}

      {/* Photo Lightbox */}
      <InspectionPhotoLightbox
        photos={photosForLightbox}
        initialIndex={lightboxInitialIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
      />
    </div>
  )
}
