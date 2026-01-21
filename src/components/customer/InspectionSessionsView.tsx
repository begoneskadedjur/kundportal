// src/components/customer/InspectionSessionsView.tsx
// Genomförda kontroller - Inspektionshistorik för kundportalen

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  RefreshCw,
  Search,
  Filter,
  MapPin,
  Home,
  Camera,
  Clock,
  TrendingUp
} from 'lucide-react'
import {
  getCompletedSessionsForCustomer,
  getOutdoorInspectionsForSession,
  getIndoorInspectionsForSession
} from '../../services/inspectionSessionService'
import { useDebounce } from '../../hooks/useDebounce'
import type { InspectionSessionWithRelations, OutdoorInspectionWithRelations } from '../../types/inspectionSession'
import type { IndoorStationInspectionWithRelations, InspectionStatus } from '../../types/indoor'
import { INSPECTION_STATUS_CONFIG } from '../../types/indoor'
import { InspectionPhotoLightbox } from './InspectionPhotoLightbox'
import LoadingSpinner from '../shared/LoadingSpinner'

interface InspectionSessionsViewProps {
  customerId: string
  companyName: string
}

// Status-räkning
interface StatusCounts {
  ok: number
  activity: number
  needs_service: number
  replaced: number
  not_found: number
}

// Kombinerad inspektionsdata för visning
interface SessionWithInspections {
  session: InspectionSessionWithRelations
  outdoorInspections: OutdoorInspectionWithRelations[]
  indoorInspections: IndoorStationInspectionWithRelations[]
  statusCounts: StatusCounts
  isExpanded: boolean
  isLoading: boolean
}

export function InspectionSessionsView({ customerId, companyName }: InspectionSessionsViewProps) {
  const [sessions, setSessions] = useState<SessionWithInspections[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300) // Debounce 300ms för prestanda
  const [showOnlyIssues, setShowOnlyIssues] = useState(false)
  const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; caption: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  // Ladda sessions vid mount
  useEffect(() => {
    loadSessions()
  }, [customerId])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const data = await getCompletedSessionsForCustomer(customerId, 20)

      // Initiera session-state utan inspektioner (lazy loading)
      const sessionData: SessionWithInspections[] = data.map(session => ({
        session,
        outdoorInspections: [],
        indoorInspections: [],
        statusCounts: { ok: 0, activity: 0, needs_service: 0, replaced: 0, not_found: 0 },
        isExpanded: false,
        isLoading: false
      }))

      setSessions(sessionData)

      // Ladda inspektioner för den senaste sessionen automatiskt
      if (sessionData.length > 0) {
        await loadInspectionsForSession(0, sessionData[0].session.id)
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInspectionsForSession = async (index: number, sessionId: string) => {
    setSessions(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], isLoading: true }
      return updated
    })

    try {
      const [outdoor, indoor] = await Promise.all([
        getOutdoorInspectionsForSession(sessionId),
        getIndoorInspectionsForSession(sessionId)
      ])

      // Räkna status
      const statusCounts: StatusCounts = {
        ok: 0,
        activity: 0,
        needs_service: 0,
        replaced: 0,
        not_found: 0
      }

      outdoor.forEach(i => {
        if (i.status in statusCounts) {
          statusCounts[i.status as keyof StatusCounts]++
        }
      })

      indoor.forEach(i => {
        if (i.status in statusCounts) {
          statusCounts[i.status as keyof StatusCounts]++
        }
      })

      setSessions(prev => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          outdoorInspections: outdoor,
          indoorInspections: indoor,
          statusCounts,
          isExpanded: true,
          isLoading: false
        }
        return updated
      })
    } catch (error) {
      console.error('Error loading inspections for session:', error)
      setSessions(prev => {
        const updated = [...prev]
        updated[index] = { ...updated[index], isLoading: false }
        return updated
      })
    }
  }

  const toggleSession = async (index: number) => {
    const session = sessions[index]

    if (session.isExpanded) {
      // Kollapsera
      setSessions(prev => {
        const updated = [...prev]
        updated[index] = { ...updated[index], isExpanded: false }
        return updated
      })
    } else {
      // Expandera - ladda inspektioner om de inte finns
      if (session.outdoorInspections.length === 0 && session.indoorInspections.length === 0) {
        await loadInspectionsForSession(index, session.session.id)
      } else {
        setSessions(prev => {
          const updated = [...prev]
          updated[index] = { ...updated[index], isExpanded: true }
          return updated
        })
      }
    }
  }

  // Filtrera inspektioner baserat på sökfråga och "endast avvikelser"-filter
  const filterInspections = (
    outdoor: OutdoorInspectionWithRelations[],
    indoor: IndoorStationInspectionWithRelations[]
  ) => {
    let filteredOutdoor = outdoor
    let filteredIndoor = indoor

    // Sök - använd debouncerad sökfråga för prestanda
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase()
      filteredOutdoor = filteredOutdoor.filter(i =>
        i.station?.serial_number?.toLowerCase().includes(query) ||
        i.findings?.toLowerCase().includes(query)
      )
      filteredIndoor = filteredIndoor.filter(i =>
        i.station?.station_number?.toLowerCase().includes(query) ||
        i.findings?.toLowerCase().includes(query)
      )
    }

    // Endast avvikelser
    if (showOnlyIssues) {
      filteredOutdoor = filteredOutdoor.filter(i => i.status !== 'ok')
      filteredIndoor = filteredIndoor.filter(i => i.status !== 'ok')
    }

    return { filteredOutdoor, filteredIndoor }
  }

  // Öppna lightbox
  const openLightbox = (photos: { url: string; caption: string }[], index: number) => {
    setLightboxPhotos(photos)
    setLightboxIndex(index)
    setIsLightboxOpen(true)
  }

  // Senaste session för sammanfattning
  const latestSession = sessions[0]

  // Formatera datum
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Ej angivet'
    return format(new Date(dateStr), "d MMMM yyyy", { locale: sv })
  }

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "d MMM yyyy 'kl' HH:mm", { locale: sv })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-slate-400 mt-4">Laddar inspektionshistorik...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClipboardCheck className="w-7 h-7 text-teal-400" />
            Genomförda kontroller
          </h1>
          <p className="text-slate-400 mt-1">
            Historik över alla servicebesök och inspektioner för {companyName}
          </p>
        </div>

        {/* Sammanfattning av senaste session */}
        {latestSession && (
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              <h2 className="text-lg font-semibold text-white">Senaste servicebesök</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-900/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 uppercase">Datum</span>
                </div>
                <p className="text-white font-medium">
                  {formatDate(latestSession.session.completed_at)}
                </p>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 uppercase">Tekniker</span>
                </div>
                <p className="text-white font-medium">
                  {latestSession.session.technician?.name || 'Okänd'}
                </p>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 uppercase">Inspekterade</span>
                </div>
                <p className="text-white font-medium">
                  {latestSession.session.inspected_outdoor_stations + latestSession.session.inspected_indoor_stations} st
                </p>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 uppercase">Tid</span>
                </div>
                <p className="text-white font-medium">
                  {latestSession.session.duration_minutes
                    ? `${Math.floor(latestSession.session.duration_minutes / 60)}h ${latestSession.session.duration_minutes % 60}min`
                    : 'Ej registrerat'}
                </p>
              </div>
            </div>

            {/* Status-badges */}
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="ok" count={latestSession.statusCounts.ok} />
              <StatusBadge status="activity" count={latestSession.statusCounts.activity} />
              <StatusBadge status="needs_service" count={latestSession.statusCounts.needs_service} />
              <StatusBadge status="replaced" count={latestSession.statusCounts.replaced} />
            </div>
          </div>
        )}

        {/* Filter och sök */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Sök station eller anteckning..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>

          <button
            onClick={() => setShowOnlyIssues(!showOnlyIssues)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all
              ${showOnlyIssues
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }
            `}
          >
            <Filter className="w-4 h-4" />
            Endast avvikelser
          </button>

          <button
            onClick={loadSessions}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Uppdatera
          </button>
        </div>

        {/* Sessionslista */}
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Inga kontroller registrerade</h3>
              <p className="text-slate-400">
                Servicebesök och inspektioner kommer att visas här när de utförs.
              </p>
            </div>
          ) : (
            sessions.map((sessionData, index) => (
              <SessionCard
                key={sessionData.session.id}
                sessionData={sessionData}
                index={index}
                onToggle={() => toggleSession(index)}
                filterInspections={filterInspections}
                searchQuery={debouncedSearchQuery}
                showOnlyIssues={showOnlyIssues}
                onPhotoClick={openLightbox}
              />
            ))
          )}
        </div>
      </div>

      {/* Photo Lightbox */}
      <InspectionPhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
      />
    </div>
  )
}

// Status-badge komponent
function StatusBadge({ status, count }: { status: InspectionStatus; count: number }) {
  if (count === 0) return null

  const config = INSPECTION_STATUS_CONFIG[status] || {
    label: status,
    bgColor: 'bg-slate-500/20',
    textColor: 'text-slate-400'
  }

  const getIcon = () => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-3.5 h-3.5" />
      case 'activity':
        return <AlertTriangle className="w-3.5 h-3.5" />
      case 'needs_service':
        return <Wrench className="w-3.5 h-3.5" />
      case 'replaced':
        return <RefreshCw className="w-3.5 h-3.5" />
      default:
        return null
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor}`}>
      {getIcon()}
      {config.label}: {count}
    </span>
  )
}

// Sessionskort komponent
function SessionCard({
  sessionData,
  index,
  onToggle,
  filterInspections,
  searchQuery,
  showOnlyIssues,
  onPhotoClick
}: {
  sessionData: SessionWithInspections
  index: number
  onToggle: () => void
  filterInspections: (outdoor: OutdoorInspectionWithRelations[], indoor: IndoorStationInspectionWithRelations[]) => {
    filteredOutdoor: OutdoorInspectionWithRelations[]
    filteredIndoor: IndoorStationInspectionWithRelations[]
  }
  searchQuery: string
  showOnlyIssues: boolean
  onPhotoClick: (photos: { url: string; caption: string }[], index: number) => void
}) {
  const { session, outdoorInspections, indoorInspections, statusCounts, isExpanded, isLoading } = sessionData

  const { filteredOutdoor, filteredIndoor } = filterInspections(outdoorInspections, indoorInspections)
  const totalFiltered = filteredOutdoor.length + filteredIndoor.length
  const totalInspections = session.inspected_outdoor_stations + session.inspected_indoor_stations

  // Samla alla foton för lightbox
  const allPhotos: { url: string; caption: string }[] = [
    ...filteredOutdoor.filter(i => i.photo_url).map(i => ({
      url: i.photo_url!,
      caption: `${i.station?.serial_number || 'Station'} - ${format(new Date(i.inspected_at), "d MMM yyyy", { locale: sv })}`
    })),
    ...filteredIndoor.filter(i => i.photo_url).map(i => ({
      url: i.photo_url!,
      caption: `${i.station?.station_number || 'Station'} - ${format(new Date(i.inspected_at), "d MMM yyyy", { locale: sv })}`
    }))
  ]

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Session header - klickbar */}
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-teal-400" />
          </div>
          <div className="text-left">
            <h3 className="text-white font-medium">
              {format(new Date(session.completed_at || session.started_at), "d MMMM yyyy", { locale: sv })}
            </h3>
            <p className="text-sm text-slate-400">
              {session.technician?.name || 'Okänd tekniker'} • {totalInspections} stationer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Mini status-indikatorer */}
          <div className="hidden sm:flex items-center gap-2">
            {statusCounts.ok > 0 && (
              <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
                {statusCounts.ok} OK
              </span>
            )}
            {statusCounts.activity > 0 && (
              <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full">
                {statusCounts.activity} Aktivitet
              </span>
            )}
            {statusCounts.needs_service > 0 && (
              <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                {statusCounts.needs_service} Åtgärd
              </span>
            )}
          </div>

          {isLoading ? (
            <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
          ) : isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanderat innehåll */}
      <AnimatePresence>
        {isExpanded && !isLoading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-slate-700/50">
              {/* Visa antal filtrerade om det skiljer sig */}
              {(searchQuery || showOnlyIssues) && totalFiltered !== (outdoorInspections.length + indoorInspections.length) && (
                <p className="text-sm text-slate-500 py-3">
                  Visar {totalFiltered} av {outdoorInspections.length + indoorInspections.length} inspektioner
                </p>
              )}

              {totalFiltered === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <p>Inga inspektioner matchar filtret</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {/* Utomhusinspektioner */}
                  {filteredOutdoor.map((inspection, idx) => (
                    <InspectionRow
                      key={inspection.id}
                      type="outdoor"
                      stationNumber={inspection.station?.serial_number}
                      stationTypeName={inspection.station?.station_type_data?.name || 'Station'}
                      status={inspection.status as InspectionStatus}
                      findings={inspection.findings}
                      measurementValue={inspection.measurement_value}
                      measurementUnit={inspection.measurement_unit}
                      measurementLabel={inspection.station?.station_type_data?.measurement_label}
                      photoUrl={inspection.photo_url}
                      inspectedAt={inspection.inspected_at}
                      onPhotoClick={() => {
                        const photoIndex = allPhotos.findIndex(p => p.url === inspection.photo_url)
                        if (photoIndex >= 0) onPhotoClick(allPhotos, photoIndex)
                      }}
                    />
                  ))}

                  {/* Inomhusinspektioner */}
                  {filteredIndoor.map((inspection, idx) => (
                    <InspectionRow
                      key={inspection.id}
                      type="indoor"
                      stationNumber={inspection.station?.station_number}
                      stationTypeName={inspection.station?.station_type_data?.name || 'Station'}
                      floorPlanName={inspection.station?.floor_plan?.name}
                      buildingName={inspection.station?.floor_plan?.building_name}
                      status={inspection.status}
                      findings={inspection.findings}
                      measurementValue={inspection.measurement_value}
                      measurementUnit={inspection.measurement_unit}
                      measurementLabel={inspection.station?.station_type_data?.measurement_label}
                      photoUrl={inspection.photo_url}
                      inspectedAt={inspection.inspected_at}
                      onPhotoClick={() => {
                        const photoIndex = allPhotos.findIndex(p => p.url === inspection.photo_url)
                        if (photoIndex >= 0) onPhotoClick(allPhotos, photoIndex)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Inspektionsrad komponent
function InspectionRow({
  type,
  stationNumber,
  stationTypeName,
  floorPlanName,
  buildingName,
  status,
  findings,
  measurementValue,
  measurementUnit,
  measurementLabel,
  photoUrl,
  inspectedAt,
  onPhotoClick
}: {
  type: 'outdoor' | 'indoor'
  stationNumber?: string | null
  stationTypeName: string
  floorPlanName?: string | null
  buildingName?: string | null
  status: InspectionStatus
  findings?: string | null
  measurementValue?: number | null
  measurementUnit?: string | null
  measurementLabel?: string | null
  photoUrl?: string | null
  inspectedAt: string
  onPhotoClick: () => void
}) {
  const statusConfig = INSPECTION_STATUS_CONFIG[status] || {
    label: status,
    bgColor: 'bg-slate-500/20',
    textColor: 'text-slate-400'
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'activity':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case 'needs_service':
        return <Wrench className="w-4 h-4 text-orange-400" />
      case 'replaced':
        return <RefreshCw className="w-4 h-4 text-blue-400" />
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-400" />
    }
  }

  const locationText = type === 'outdoor'
    ? 'Utomhus'
    : buildingName
      ? `${buildingName} - ${floorPlanName}`
      : floorPlanName || 'Inomhus'

  return (
    <div className="py-4 flex items-start gap-4">
      {/* Status-ikon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusConfig.bgColor}`}>
        {getStatusIcon()}
      </div>

      {/* Innehåll */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-white">{stationTypeName}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.textColor}`}>
            {statusConfig.label}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
          {type === 'outdoor' ? (
            <MapPin className="w-3.5 h-3.5" />
          ) : (
            <Home className="w-3.5 h-3.5" />
          )}
          <span>
            {stationNumber && `${stationNumber} • `}
            {locationText}
          </span>
        </div>

        {/* Mätvärde */}
        {measurementValue !== null && measurementValue !== undefined && (
          <p className="text-sm text-slate-400">
            {measurementLabel || 'Mätvärde'}: {measurementValue} {measurementUnit || 'st'}
          </p>
        )}

        {/* Anteckningar */}
        {findings && (
          <p className="text-sm text-slate-300 mt-1">{findings}</p>
        )}

        {/* Tid */}
        <p className="text-xs text-slate-500 mt-1">
          {format(new Date(inspectedAt), "HH:mm", { locale: sv })}
        </p>
      </div>

      {/* Foto */}
      {photoUrl && (
        <button
          onClick={onPhotoClick}
          className="w-14 h-14 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0 hover:ring-2 hover:ring-teal-500/50 transition-all"
        >
          <img
            src={photoUrl}
            alt="Inspektionsfoto"
            className="w-full h-full object-cover"
          />
        </button>
      )}
    </div>
  )
}

export default InspectionSessionsView
