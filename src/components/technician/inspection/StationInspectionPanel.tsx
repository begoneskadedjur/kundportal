// src/components/technician/inspection/StationInspectionPanel.tsx
// Stationskontrollen (delsystem A) som inbäddningsbar komponent: karta,
// planritningar, foto, mätvärden, historik, sammanställning och klarmarkering.
//
// Två lägen:
// - embedded = false (standard): exakt samma DOM, klasser och beteende som
//   routen /technician/inspection/:caseId alltid haft. StationInspectionModule
//   är ett tunt skal som skickar in caseId och navigate(-1).
// - embedded = true: inuti en modal eller ett steg. Värdens scrollyta bär innehållet,
//   överläggen renderas via portal till document.body ovanför portalens Modal
//   (usePortal ger z-index 9999), window.confirm ersätts av en egen dialog och
//   beforeComplete körs innan klarmarkering.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  Check,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Camera,
  Trash2,
  Navigation,
  AlertTriangle,
  SkipForward,
  Unlock,
  Beaker
} from 'lucide-react'
import Button from '../../../components/ui/Button'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

// Komponenter för karta och planritning
import { EquipmentMap } from '../../../components/shared/equipment/EquipmentMap'
import { FloorPlanViewer } from '../../../components/shared/indoor/FloorPlanViewer'

// Service-funktioner
import {
  getInspectionSessionByCaseId,
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer,
  getFloorPlansForCustomer,
  startInspectionSession,
  completeInspectionSession,
  createOutdoorInspection,
  createIndoorInspection,
  upsertOutdoorInspection,
  upsertIndoorInspection,
  updateInspectionSession,
  uploadInspectionPhoto,
  getInspectionPhotoUrl,
  getLastInspectionSummary,
  getStationsWithRecentActivity,
  getOutdoorInspectionsForSession,
  getIndoorInspectionsForSession,
  reopenInspectionSession,
  updateCaseStatusToCompleted,
  updateSessionNotes,
  uploadSessionPhoto,
  deleteSessionPhoto,
  getSessionPhotos,
  updateSessionPhotoCaption
} from '../../../services/inspectionSessionService'
import { PreparationService } from '../../../services/preparationService'
import type { Preparation } from '../../../types/preparations'
import { AddonStationBillingService } from '../../../services/addonStationBillingService'
import { useAddonLabourStep } from '../../../hooks/useAddonLabourStep'
import AddonLabourStep from '../../../components/technician/AddonLabourStep'
import { EquipmentService } from '../../../services/equipmentService'
import { IndoorStationService } from '../../../services/indoorStationService'

// Typer
import type {
  InspectionSessionWithRelations,
  SessionProgress,
  InspectionSessionPhoto
} from '../../../types/inspectionSession'
import type { InspectionStatus } from '../../../types/indoor'
import { INSPECTION_STATUS_CONFIG, calculateInspectionStatus } from '../../../types/indoor'
import type { EquipmentPlacementWithRelations } from '../../../types/database'
import type { IndoorStationWithRelations } from '../../../types/indoor'
import { useAddonRemovalGuard, useAddonPaidLock } from '../../../hooks/useAddonRemovalGuard'
import AddonRemovalNotice from '../../../components/shared/equipment/AddonRemovalNotice'
import { Icon } from '../../../components/icons/Icon'
import { resolveStationIcon } from '../../../components/shared/stationIcons'
import KlarmarkeraKnapp, { AvslutatForlopp } from './KlarmarkeraKnapp'
import StationTypeTile from '../../../components/shared/stations/StationTypeTile'
import StationToolbar from '../../../components/shared/stations/StationToolbar'
import ChangeStationTypeSheet from '../../../components/shared/stations/ChangeStationTypeSheet'
import type { ChangeStationTypeResult } from '../../../services/stationTypeService'
import type { StationType } from '../../../types/stationTypes'
import type { StationTypeArticle } from '../../../types/addonStations'

// Statuspunktens färg per aktivitetsnivå (ersätter teckenikonerna ✓ ↑ ! !!)
const STATUS_DOT_CLASS: Record<string, string> = {
  none: 'bg-[#20c58f]',
  ok: 'bg-[#20c58f]',
  low: 'bg-yellow-400',
  medium: 'bg-orange-400',
  activity: 'bg-amber-400',
  high: 'bg-red-500',
  needs_service: 'bg-orange-400',
  replaced: 'bg-blue-400',
}

function StatusDot({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_CLASS[status] ?? 'bg-slate-500'} ${className}`}
      aria-hidden="true"
    />
  )
}

// Kort enhet för mätvärden (gram → g, procent → %)
function unitShort(unit: string | null | undefined): string {
  if (!unit) return ''
  if (unit === 'gram') return 'g'
  if (unit === 'procent') return '%'
  return unit
}

// Statusens etikett i gemener för löptext ("ingen aktivitet")
function statusText(status: string): string {
  const label = INSPECTION_STATUS_CONFIG[status as InspectionStatus]?.label || status
  // Förkortningar som OK behåller versalerna
  if (/^[A-ZÅÄÖ]{2}/.test(label)) return label
  return label.charAt(0).toLowerCase() + label.slice(1)
}

// Senaste kontrollen per station från förra avslutade rundan (listans andra rad)
interface PreviousInspection {
  inspected_at: string
  status: string
  measurement_value: number | null
  measurement_unit: string | null
}

// Hjälpfunktion för att bestämma färg baserat på mätvärde och tröskelvärden
// direction: 'above' = värden över tröskel är dåliga (standard för förbrukning)
// direction: 'below' = värden under tröskel är dåliga
function getMeasurementColor(
  value: number | null | undefined,
  warningThreshold: number | null | undefined,
  criticalThreshold: number | null | undefined,
  direction: string | null | undefined = 'above'
): 'green' | 'amber' | 'red' | 'default' {
  if (value === null || value === undefined) return 'default'

  const isAbove = direction !== 'below'

  if (criticalThreshold !== null && criticalThreshold !== undefined) {
    if (isAbove ? value >= criticalThreshold : value <= criticalThreshold) {
      return 'red'
    }
  }

  if (warningThreshold !== null && warningThreshold !== undefined) {
    if (isAbove ? value >= warningThreshold : value <= warningThreshold) {
      return 'amber'
    }
  }

  return 'green'
}

// Lokal typ för station (både indoor och outdoor)
interface StationData {
  id: string
  serial_number?: string | null
  station_number?: string | null
  equipment_type?: string | null
  station_type?: string | null
  is_addon?: boolean
  addon_billing_model?: 'per_year' | 'per_month' | 'per_round' | null
  addon_contract_mode?: string | null
  // Preparat satt vid utplacering — förvälj i kontrollformuläret
  preparation_id?: string | null
  // Produkten och dess ikon (personalvy: produktens ikon går före typens)
  article_id?: string | null
  article?: { icon: string | null } | null
  station_type_id?: string | null
  status: string
  latitude?: number
  longitude?: number
  position_x_percent?: number
  position_y_percent?: number
  floor_plan_id?: string | null
  placed_at?: string
  station_type_data?: {
    id: string
    name: string
    color: string
    code?: string
    icon?: string | null
    prefix?: string | null
    measurement_unit?: string | null
    measurement_label?: string | null
    threshold_warning?: number | null
    threshold_critical?: number | null
    threshold_direction?: string | null
  } | null
  floor_plan?: {
    id: string
    name: string
    building_name?: string | null
    image_path?: string | null
  } | null
}

// Historik-typ
interface InspectionHistoryItem {
  id: string
  inspected_at: string
  status: InspectionStatus
  findings: string | null
  photo_path: string | null
  measurement_value: number | null
  measurement_unit: string | null
  technician?: {
    id: string
    name: string
  } | null
}

export interface StationInspectionPanelProps {
  caseId: string
  /** true = inuti en modal/steg (höjd från containern, överlägg via portal) */
  embedded?: boolean
  /** Tillbaka-knappen och felvyns Tillbaka. Utelämnad: knapparna visas inte. */
  onExit?: () => void
  /** Anropas efter lyckad klarmarkering. Utelämnad: panelen visar rundan som avslutad. */
  onCompleted?: () => void
  /**
   * Värdens avslutskontroll. Returnerar blockerande fel (svensk text), tom
   * lista = ok. Körs när klarmarkeringsdialogen öppnas och igen vid bekräftelse.
   */
  beforeComplete?: () => Promise<string[]>
  /** Embedded: dölj tillbakaknapp och rubrik (värden visar egen rubrik) */
  hideHeader?: boolean
}

// Över portalens Modal (usePortal = z-index 9999)
const EMBEDDED_OVERLAY_Z = 'z-[10050]'
const EMBEDDED_LIGHTBOX_Z = 'z-[10060]'
// Kartans och planritningens höjd i inbäddat läge (modalen är lägre än sidan)
const EMBEDDED_STAGE_HEIGHT = 'clamp(260px, 45dvh, 420px)'

export default function StationInspectionPanel({
  caseId,
  embedded = false,
  onExit,
  onCompleted,
  beforeComplete,
  hideHeader = false
}: StationInspectionPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Överläggens z-index och placering: oförändrat i fristående läge,
  // ovanför värdmodalen och via portal i inbäddat läge
  const overlayZ = embedded ? EMBEDDED_OVERLAY_Z : 'z-50'
  const lightboxZ = embedded ? EMBEDDED_LIGHTBOX_Z : 'z-[60]'
  const renderOverlay = (node: ReactNode) => {
    if (!embedded || typeof document === 'undefined') return node
    // Klick och tangenter i portalen bubblar annars genom React-trädet till värdens element
    // Värdmodalen ligger i #modal-root (fast container med högsta z-index direkt
    // under body). Portas överläggen till body hamnar de alltid under den, därför
    // samma mål som modalen, där z-index jämförs mot modalens 9999.
    return createPortal(
      // #modal-root har pointer-events: none (Portal.tsx), barnen måste slå på det igen,
      // annars går klick och dubbelklick rakt igenom till ärendet bakom
      <div style={{ pointerEvents: 'auto' }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>{node}</div>,
      document.getElementById('modal-root') ?? document.body
    )
  }

  // Inbyggd bekräftelsedialog (bara inbäddat läge; fristående behåller window.confirm)
  const [confirmState, setConfirmState] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null)
  const askConfirm = useCallback((message: string): Promise<boolean> => {
    if (!embedded) return Promise.resolve(window.confirm(message))
    return new Promise<boolean>(resolve => setConfirmState({ message, resolve }))
  }, [embedded])
  const closeConfirm = (ok: boolean) => {
    confirmState?.resolve(ok)
    setConfirmState(null)
  }

  // Värdens avslutskontroll (beforeComplete)
  const [completeBlockers, setCompleteBlockers] = useState<string[]>([])
  const [checkingBlockers, setCheckingBlockers] = useState(false)
  // Ref så att en inline-funktion från värden inte startar om kontrollen vid varje rendering
  const beforeCompleteRef = useRef(beforeComplete)
  beforeCompleteRef.current = beforeComplete
  const hasBeforeComplete = !!beforeComplete
  const runBeforeComplete = useCallback(async (): Promise<string[]> => {
    const check = beforeCompleteRef.current
    if (!check) return []
    setCheckingBlockers(true)
    try {
      const errors = (await check()).filter(Boolean)
      setCompleteBlockers(errors)
      return errors
    } catch (err) {
      console.error('Avslutskontrollen misslyckades:', err)
      const errors = ['Avslutskontrollen kunde inte köras. Försök igen.']
      setCompleteBlockers(errors)
      return errors
    } finally {
      setCheckingBlockers(false)
    }
  }, [])

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [outdoorStations, setOutdoorStations] = useState<StationData[]>([])
  const [indoorStations, setIndoorStations] = useState<StationData[]>([])
  const [floorPlans, setFloorPlans] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'outdoor' | 'indoor'>('outdoor')
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string | null>(null)

  // Inspektionsmodal state
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus>('none')
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [measurementValue, setMeasurementValue] = useState<string>('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedPreparationId, setSelectedPreparationId] = useState<string | null>(null)
  const [inspectedStationIds, setInspectedStationIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Kontrollera + hämta upp (endast tilläggsstationer): sparar kontrollen och
  // markerar stationen Borttagen i ETT moment — rätt ordning kan inte bli fel
  const [pickUpAfterSave, setPickUpAfterSave] = useState(false)
  const selectedStationId = selectedStation?.id
  // Stationsmodalens läge: kontrollen eller byt typ (ersätter innehållet)
  const [modalView, setModalView] = useState<'kontroll' | 'byttyp'>('kontroll')

  // Stäng stationsarket utan att spara. I inbäddat läge (nya arbetsvyn) utan
  // stängningsanimation: arket ligger i #modal-root ovanpå ärendet, och en
  // exit-animation som inte blir klar lämnar arket synligt fast det är stängt.
  const stangStationsark = useCallback(() => {
    setSelectedStation(null)
    setModalView('kontroll')
  }, [])

  // Inbäddat: Esc stänger stationsarket (värdmodalen stängs inte av Esc)
  useEffect(() => {
    if (!embedded || !selectedStation) return
    const vidTangent = (e: KeyboardEvent) => { if (e.key === 'Escape') stangStationsark() }
    document.addEventListener('keydown', vidTangent)
    return () => document.removeEventListener('keydown', vidTangent)
  }, [embedded, selectedStation, stangStationsark])
  // Anteckningsfältet fälls ut från ikonrutan
  const [showNotesField, setShowNotesField] = useState(false)
  useEffect(() => {
    setPickUpAfterSave(false)
    setModalView('kontroll')
  }, [selectedStationId])
  // Tilläggsstation per år/månad som redan är betald framåt: förtydligande
  // under kryssrutan och två klick på Spara när den ska hämtas upp
  const pickupGuard = useAddonRemovalGuard(
    selectedStation
      ? { ...selectedStation, indoor: !outdoorStations.some(s => s.id === selectedStation.id) }
      : null,
    pickUpAfterSave
  )
  // Förskottsbetald tilläggsstation: typen får inte bytas (Byt typ avstängd)
  const typePaidLock = useAddonPaidLock(
    selectedStation
      ? { ...selectedStation, indoor: !outdoorStations.some(s => s.id === selectedStation.id) }
      : null
  )
  // Senaste kontrollen per station från förra avslutade rundan
  const [previousInspections, setPreviousInspections] = useState<Record<string, PreviousInspection>>({})
  // Upphämtade tilläggsstationer i denna runda (för auto-arbetsrapporten)
  const [pickedUpCount, setPickedUpCount] = useState(0)
  // Senast använda preparat i rundan — fallback-förval för nästa station
  const lastUsedPreparationRef = useRef<string | null>(null)
  // Räknas upp vid typbyte, så ett sent preparatförslag för gamla typen hoppas över
  const typeChangeCountRef = useRef(0)

  // Preparatdata
  const [preparations, setPreparations] = useState<Preparation[]>([])

  // Sammanställningspanel state - spara inspektionsresultat per station
  // OBS: Använder Record istället för Map för att undvika Vite/Terser minifieringsproblem
  const [showSummary, setShowSummary] = useState(false)
  const [inspectionResults, setInspectionResults] = useState<Record<string, {
    status: InspectionStatus
    findings: string | null
    measurementValue: number | null
    measurementUnit: string | null
    preparationId: string | null
    preparationName: string | null
    hasPhoto: boolean
    photoPreview: string | null
    timestamp: string
  }>>({})

  // Wizard-läge state
  const [wizardMode, setWizardMode] = useState<'off' | 'outdoor' | 'indoor'>('off')
  const [currentWizardStationId, setCurrentWizardStationId] = useState<string | null>(null)
  const [wizardStationQueue, setWizardStationQueue] = useState<string[]>([])

  // Historik state
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [stationHistory, setStationHistory] = useState<InspectionHistoryItem[]>([])
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  // Snabb-OK bekräftelsedialog
  const [quickOkStation, setQuickOkStation] = useState<StationData | null>(null)

  // Foto lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

  // Sessionskommentarer och -bilder
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionPhotos, setSessionPhotos] = useState<InspectionSessionPhoto[]>([])
  const [sessionPhotoUploading, setSessionPhotoUploading] = useState(false)
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null)
  const [editingCaptionValue, setEditingCaptionValue] = useState('')
  const sessionPhotoInputRef = useRef<HTMLInputElement>(null)
  // Kommentarfältet är en rad som växer med texten
  const sessionNotesRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = sessionNotesRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden'
  }, [sessionNotes, loading])

  // Bekräftelsedialog för att avsluta inspektion
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  // Arbetstid för att hantera tilläggen: frågas när tilläggsstationer per
  // år/per månad satts ut i rundan. Pro rata för de nya stationerna synkas
  // till kontrollärendet FÖRE underlaget laddas (ärendet måste vara öppet).
  const labourCaseId = session?.case_id ?? null
  const labourCustomerId = session?.customer_id ?? null
  const labourTechId = session?.technician_id ?? null
  const labourTechName = session?.technician?.name ?? null
  const prepareAddonLabour = useCallback(async () => {
    if (!labourCaseId || !labourCustomerId) return
    await AddonStationBillingService.syncAddonProrataLine(labourCustomerId, labourTechId, labourTechName, labourCaseId)
  }, [labourCaseId, labourCustomerId, labourTechId, labourTechName])
  const addonLabourStep = useAddonLabourStep({
    caseId: labourCaseId,
    enabled: showCompleteConfirm && !!labourCaseId,
    prepare: prepareAddonLabour,
  })

  // Avslutskontrollen körs när dialogen öppnas, så felen syns direkt
  useEffect(() => {
    if (!showCompleteConfirm) {
      setCompleteBlockers(prev => (prev.length > 0 ? [] : prev))
      return
    }
    if (hasBeforeComplete) void runBeforeComplete()
  }, [showCompleteConfirm, hasBeforeComplete, runBeforeComplete])

  // Auto-dismiss för återupptagande-banner
  const [showResumeNotice, setShowResumeNotice] = useState(true)

  // Bekräftelsedialog för att låsa upp avslutad inspektion
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)

  // Senaste inspektion och aktivitetsstationer (för ankomstkort)
  const [lastInspection, setLastInspection] = useState<{
    completed_at: string | null
    technician_name: string | null
    total_inspected: number
    stations_with_activity: number
  } | null>(null)
  const [activityStationIds, setActivityStationIds] = useState<Set<string>>(new Set())

  // Auto-start: Om inspektion sparas före manuell start, starta sessionen automatiskt
  const [shouldAutoStartOnSave, setShouldAutoStartOnSave] = useState(false)

  // Expanderad planritning för förhandsvisning på ankomstsidan
  const [expandedFloorPlan, setExpandedFloorPlan] = useState<any | null>(null)

  // Flytta station-läge
  // Kartan eller planritningen, rullas fram när flyttläget startar
  const relocateAreaRef = useRef<HTMLDivElement>(null)
  const [relocatingStation, setRelocatingStation] = useState<StationData | null>(null)

  // Auto-dismiss återupptagande-banner efter 10 sekunder
  useEffect(() => {
    if (showResumeNotice) {
      const timer = setTimeout(() => setShowResumeNotice(false), 10000)
      return () => clearTimeout(timer)
    }
  }, [showResumeNotice])

  // Ladda data
  useEffect(() => {
    async function loadData() {
      if (!caseId) {
        setError('Inget ärende-ID')
        setLoading(false)
        return
      }

      try {
        let sessionData = await getInspectionSessionByCaseId(caseId)

        if (!sessionData) {
          setError('Ingen inspektionssession hittades för detta ärende')
          setLoading(false)
          return
        }

        setSession(sessionData)

        const [outdoor, indoor, plans, preps] = await Promise.all([
          getOutdoorStationsForCustomer(sessionData.customer_id),
          getIndoorStationsForCustomer(sessionData.customer_id),
          getFloorPlansForCustomer(sessionData.customer_id),
          PreparationService.getActivePreparations().catch(() => [] as Preparation[])
        ])

        setOutdoorStations(outdoor)
        setIndoorStations(indoor)
        setFloorPlans(plans)
        setPreparations(preps)

        // Synka total-counts om stationer lagts till/tagits bort sedan sessionen skapades
        const actualOutdoor = outdoor.length
        const actualIndoor = indoor.length
        if (
          sessionData.total_outdoor_stations !== actualOutdoor ||
          sessionData.total_indoor_stations !== actualIndoor
        ) {
          await updateInspectionSession(sessionData.id, {
            total_outdoor_stations: actualOutdoor,
            total_indoor_stations: actualIndoor
          })
          sessionData = {
            ...sessionData,
            total_outdoor_stations: actualOutdoor,
            total_indoor_stations: actualIndoor
          }
          setSession(sessionData)
        }

        // Välj första fliken med stationer
        if (outdoor.length === 0 && indoor.length > 0) {
          setActiveTab('indoor')
        }

        // Välj första planritningen som default
        if (plans.length > 0) {
          setSelectedFloorPlanId(plans[0].id)
        }

        // Hämta senaste inspektion och aktivitetsstationer (för ankomstkort)
        const [lastInsp, activityIds] = await Promise.all([
          getLastInspectionSummary(sessionData.customer_id, sessionData.id),
          getStationsWithRecentActivity(sessionData.customer_id)
        ])
        setLastInspection(lastInsp)
        setActivityStationIds(activityIds)

        // Listans "Senast ..."-rad: förra avslutade rundans kontroller.
        // Laddas i bakgrunden och får aldrig stoppa sidan.
        const currentSessionId = sessionData.id
        const customerIdForPrev = sessionData.customer_id
        void (async () => {
          try {
            const { data: prevSession } = await supabase
              .from('station_inspection_sessions')
              .select('id')
              .eq('customer_id', customerIdForPrev)
              .eq('status', 'completed')
              .neq('id', currentSessionId)
              .order('completed_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (!prevSession?.id) return
            const [prevOutdoor, prevIndoor] = await Promise.all([
              getOutdoorInspectionsForSession(prevSession.id),
              getIndoorInspectionsForSession(prevSession.id)
            ])
            const map: Record<string, PreviousInspection> = {}
            ;[...prevOutdoor, ...prevIndoor].forEach(insp => {
              map[insp.station_id] = {
                inspected_at: insp.inspected_at,
                status: insp.status,
                measurement_value: insp.measurement_value ?? null,
                measurement_unit: insp.measurement_unit ?? null
              }
            })
            setPreviousInspections(map)
          } catch (prevErr) {
            console.error('Kunde inte hämta förra rundans kontroller:', prevErr)
          }
        })()

        // ======================================================
        // Ladda befintliga inspektioner för pågående och avslutade sessioner
        // (behövs för korrekta flikräknare + formulärdata vid redigering)
        // ======================================================
        if (sessionData.status === 'in_progress' || sessionData.status === 'completed') {
          const [existingOutdoor, existingIndoor] = await Promise.all([
            getOutdoorInspectionsForSession(sessionData.id),
            getIndoorInspectionsForSession(sessionData.id)
          ])

          // Populera inspectedStationIds och inspectionResults
          const alreadyInspectedIds = new Set<string>()
          const existingResults: Record<string, {
            status: InspectionStatus
            findings: string | null
            measurementValue: number | null
            measurementUnit: string | null
            preparationId: string | null
            preparationName: string | null
            hasPhoto: boolean
            timestamp: string
          }> = {}

          // Utomhusinspektioner
          existingOutdoor.forEach(insp => {
            alreadyInspectedIds.add(insp.station_id)
            const prep = preps.find(p => p.id === (insp as any).preparation_id)
            existingResults[insp.station_id] = {
              status: insp.status as InspectionStatus,
              findings: insp.findings,
              measurementValue: insp.measurement_value,
              measurementUnit: insp.measurement_unit,
              preparationId: (insp as any).preparation_id || null,
              preparationName: prep?.name || null,
              hasPhoto: !!insp.photo_path,
              timestamp: insp.inspected_at
            }
          })

          // Inomhusinspektioner
          existingIndoor.forEach(insp => {
            alreadyInspectedIds.add(insp.station_id)
            const prep = preps.find(p => p.id === (insp as any).preparation_id)
            existingResults[insp.station_id] = {
              status: insp.status as InspectionStatus,
              findings: insp.findings,
              measurementValue: insp.measurement_value,
              measurementUnit: insp.measurement_unit,
              preparationId: (insp as any).preparation_id || null,
              preparationName: prep?.name || null,
              hasPhoto: !!insp.photo_path,
              timestamp: insp.inspected_at
            }
          })

          const inspectedCount = Object.keys(existingResults).length
          if (inspectedCount > 0) {
            setInspectedStationIds(alreadyInspectedIds)
            setInspectionResults(existingResults)
            console.log(`Laddade ${inspectedCount} befintliga inspektioner för återupptagande`)
          }
        }

        // Ladda sessionsanteckningar och -bilder
        if (sessionData.notes) {
          setSessionNotes(sessionData.notes)
        }
        const photos = await getSessionPhotos(sessionData.id)
        setSessionPhotos(photos)

      } catch (err) {
        console.error('Error loading data:', err)
        setError('Kunde inte ladda inspektionsdata')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [caseId])

  // Beräkna progress
  const progress: SessionProgress | null = session ? {
    totalStations: session.total_outdoor_stations + session.total_indoor_stations,
    inspectedStations: session.inspected_outdoor_stations + session.inspected_indoor_stations,
    percentComplete: Math.round(
      ((session.inspected_outdoor_stations + session.inspected_indoor_stations) /
      Math.max(session.total_outdoor_stations + session.total_indoor_stations, 1)) * 100
    ),
    outdoorProgress: {
      total: session.total_outdoor_stations,
      inspected: session.inspected_outdoor_stations
    },
    indoorProgress: {
      total: session.total_indoor_stations,
      inspected: session.inspected_indoor_stations
    }
  } : null

  // Hämta nuvarande planritnings-bild URL
  const currentFloorPlan = useMemo(() => {
    if (!selectedFloorPlanId) return null
    return floorPlans.find(fp => fp.id === selectedFloorPlanId)
  }, [selectedFloorPlanId, floorPlans])

  const [floorPlanImageUrl, setFloorPlanImageUrl] = useState<string>('')

  // Hämta signerad URL för planritning
  useEffect(() => {
    async function fetchSignedUrl() {
      if (!currentFloorPlan?.image_path) {
        setFloorPlanImageUrl('')
        return
      }

      const { data, error } = await supabase.storage
        .from('floor-plans')
        .createSignedUrl(currentFloorPlan.image_path, 3600) // 1 timme

      if (error) {
        console.error('Fel vid hämtning av signerad URL:', error)
        setFloorPlanImageUrl('')
        return
      }

      setFloorPlanImageUrl(data.signedUrl)
    }

    fetchSignedUrl()
  }, [currentFloorPlan])

  // Filtrera inomhusstationer för vald planritning
  const filteredIndoorStations = useMemo(() => {
    if (!selectedFloorPlanId) return []
    return indoorStations.filter(s => s.floor_plan_id === selectedFloorPlanId)
  }, [indoorStations, selectedFloorPlanId])

  // Skapa nummermappning för outdoor stationer (baserat på placed_at, äldsta = 1)
  const outdoorNumberMap = useMemo((): Record<string, number> => {
    const sorted = [...outdoorStations].sort((a, b) => {
      const dateA = new Date(a.placed_at || 0).getTime()
      const dateB = new Date(b.placed_at || 0).getTime()
      return dateA - dateB
    })
    const map: Record<string, number> = {}
    sorted.forEach((station, index) => {
      map[station.id] = index + 1
    })
    return map
  }, [outdoorStations])

  // Skapa nummermappning för indoor stationer per planritning (baserat på placed_at)
  const indoorNumberMap = useMemo((): Record<string, number> => {
    const sorted = [...filteredIndoorStations].sort((a, b) => {
      const dateA = new Date(a.placed_at || 0).getTime()
      const dateB = new Date(b.placed_at || 0).getTime()
      return dateA - dateB
    })
    const map: Record<string, number> = {}
    sorted.forEach((station, index) => {
      map[station.id] = index + 1
    })
    return map
  }, [filteredIndoorStations])

  // Konvertera outdoor stations till EquipmentPlacementWithRelations format för kartan
  const outdoorEquipment: EquipmentPlacementWithRelations[] = useMemo(() => {
    return outdoorStations
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        id: s.id,
        customer_id: session?.customer_id || '',
        serial_number: s.serial_number || s.station_number || '',
        equipment_type: s.equipment_type || s.station_type || 'unknown',
        status: s.status as any,
        latitude: s.latitude!,
        longitude: s.longitude!,
        placed_at: s.placed_at || new Date().toISOString(),
        notes: null,
        station_type_id: s.station_type_data?.id || null,
        // Tillägg (plusbricka) och produktens ikon i kartans cirklar
        is_addon: s.is_addon === true,
        article: s.article ?? null,
        station_type_data: s.station_type_data ? {
          id: s.station_type_data.id,
          code: s.station_type_data.code || '',
          name: s.station_type_data.name,
          color: s.station_type_data.color,
          icon: s.station_type_data.icon || 'target',
          prefix: s.station_type_data.prefix || '',
          description: null,
          is_active: true,
          measurement_unit: s.station_type_data.measurement_unit as any,
          measurement_label: s.station_type_data.measurement_label || null,
          threshold_warning: s.station_type_data.threshold_warning ? String(s.station_type_data.threshold_warning) : null,
          threshold_critical: s.station_type_data.threshold_critical ? String(s.station_type_data.threshold_critical) : null,
          threshold_direction: s.station_type_data.threshold_direction as any,
          sort_order: 0,
          created_at: '',
          updated_at: ''
        } : null
      })) as EquipmentPlacementWithRelations[]
  }, [outdoorStations, session])

  // Konvertera indoor stations till IndoorStationWithRelations format för FloorPlanViewer
  const indoorStationsForViewer: IndoorStationWithRelations[] = useMemo(() => {
    return filteredIndoorStations.map(s => ({
      id: s.id,
      floor_plan_id: s.floor_plan_id || '',
      station_type: (s.station_type || 'bait_station') as any,
      station_number: s.station_number || s.serial_number || null,
      position_x_percent: s.position_x_percent || 50,
      position_y_percent: s.position_y_percent || 50,
      status: s.status as any,
      notes: null,
      placed_at: s.placed_at || new Date().toISOString(),
      placed_by: null,
      station_type_id: s.station_type_data?.id || null,
      calculated_status: null,
      is_addon: s.is_addon === true,
      article: s.article ?? null,
      station_type_data: s.station_type_data ? {
        id: s.station_type_data.id,
        code: s.station_type_data.code || '',
        name: s.station_type_data.name,
        color: s.station_type_data.color,
        icon: s.station_type_data.icon || 'target',
        prefix: s.station_type_data.prefix || '',
        description: null,
        is_active: true,
        measurement_unit: s.station_type_data.measurement_unit as any,
        measurement_label: s.station_type_data.measurement_label || null,
        threshold_warning: s.station_type_data.threshold_warning ? String(s.station_type_data.threshold_warning) : null,
        threshold_critical: s.station_type_data.threshold_critical ? String(s.station_type_data.threshold_critical) : null,
        threshold_direction: s.station_type_data.threshold_direction as any,
        sort_order: 0,
        created_at: '',
        updated_at: ''
      } : null,
      floor_plan: s.floor_plan ? {
        id: s.floor_plan.id,
        customer_id: session?.customer_id || '',
        name: s.floor_plan.name,
        building_name: s.floor_plan.building_name || null,
        floor_number: null,
        image_path: s.floor_plan.image_path || null,
        image_width: null,
        image_height: null,
        sort_order: 0,
        created_at: ''
      } : undefined
    })) as IndoorStationWithRelations[]
  }, [filteredIndoorStations, session])

  // Starta inspektion
  const handleStartInspection = async () => {
    if (!session) return

    try {
      setIsSubmitting(true)
      const updated = await startInspectionSession(session.id)
      if (updated) {
        setSession({ ...session, status: 'in_progress', started_at: new Date().toISOString() })
        toast.success('Inspektion startad!')
      }
    } catch (err) {
      toast.error('Kunde inte starta inspektionen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Välj station (från karta, planritning eller lista)
  // Tillåter klick även under 'scheduled' - auto-start vid första sparning
  const handleSelectStation = useCallback(async (station: StationData) => {
    // Blockera redigering om sessionen är avslutad (kräver upplåsning först)
    if (session?.status === 'completed') return

    // Om session inte är startad, markera för auto-start vid första sparning
    if (session?.status === 'scheduled') {
      setShouldAutoStartOnSave(true)
    }

    setSelectedStation(station)
    const typeChangesAtOpen = typeChangeCountRef.current

    // Ladda befintlig data om stationen redan inspekterats i denna session
    const existing = inspectionResults[station.id]
    if (existing) {
      setSelectedStatus(existing.status)
      setInspectionNotes(existing.findings || '')
      setMeasurementValue(existing.measurementValue !== null ? String(existing.measurementValue) : '')
      setSelectedPreparationId(existing.preparationId)
      setPhotoPreview(existing.photoPreview || null)
    } else {
      setSelectedStatus('ok')
      setInspectionNotes('')
      setMeasurementValue('')
      setSelectedPreparationId(null)
      setPhotoPreview(null)
    }
    setPhotoFile(null)
    // Historiken laddas alltid (kompakt "Senast"-rad), panelen fälls ut via verktygsraden
    setShowHistory(false)
    setExpandedHistoryId(null)
    setShowNotesField(!!existing?.findings)
    setStationHistory([])
    setHistoryLoading(true)

    // Ladda historik automatiskt
    try {
      const isOutdoor = outdoorStations.some(s => s.id === station.id)
      const tableName = isOutdoor ? 'outdoor_station_inspections' : 'indoor_station_inspections'

      // Om stationen är inspekterad i denna session men saknar photoPreview (t.ex. efter sidomladdning),
      // hämta foto-URL från DB för nuvarande session
      if (existing?.hasPhoto && !existing?.photoPreview) {
        const { data: currentSessionData } = await supabase
          .from(tableName)
          .select('photo_path, measurement_value, measurement_unit, findings, status, preparation_id')
          .eq('station_id', station.id)
          .eq('session_id', session.id)
          .single()

        if (currentSessionData?.photo_path) {
          const url = await getInspectionPhotoUrl(currentSessionData.photo_path)
          if (url) setPhotoPreview(url)
        }
      }

      const { data, error } = await supabase
        .from(tableName)
        .select(`
          id,
          inspected_at,
          status,
          findings,
          photo_path,
          measurement_value,
          measurement_unit,
          preparation_id,
          technician:technicians(id, name)
        `)
        .eq('station_id', station.id)
        .neq('session_id', session.id)
        .order('inspected_at', { ascending: false })
        .limit(5)

      if (error) throw error

      // Förvälj preparat när stationen inte redan kontrollerats i denna runda:
      // 1) stationens senaste kontroll, 2) preparatet satt vid utplaceringen,
      // 3) samma som föregående station i rundan. Endast preparat som är
      // giltiga för stationstypen förväljs — teknikern kan alltid ändra.
      if (!existing) {
        const stationTypeId = station.station_type_data?.id
        const validPrep = (prepId: string | null | undefined): string | null => {
          if (!prepId) return null
          const prep = preparations.find(p => p.id === prepId)
          if (!prep) return null
          if (stationTypeId && !(prep.station_type_ids?.includes(stationTypeId))) return null
          return prepId
        }
        const suggested =
          validPrep((data as { preparation_id?: string | null }[] | null)?.[0]?.preparation_id) ??
          validPrep(station.preparation_id) ??
          validPrep(lastUsedPreparationRef.current)
        if (suggested && typeChangeCountRef.current === typeChangesAtOpen) setSelectedPreparationId(suggested)
      }

      // Hämta foto-URLs
      const historyWithPhotos = await Promise.all(
        (data || []).map(async (item: any) => {
          let photoUrl = null
          if (item.photo_path) {
            photoUrl = await getInspectionPhotoUrl(item.photo_path)
          }
          return { ...item, photo_url: photoUrl }
        })
      )

      setStationHistory(historyWithPhotos)
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [session?.status, outdoorStations, inspectionResults, preparations])

  // Hantera klick på outdoor station (från kartan)
  const handleOutdoorStationClick = useCallback((equipment: EquipmentPlacementWithRelations) => {
    const station = outdoorStations.find(s => s.id === equipment.id)
    if (station) {
      handleSelectStation(station)
    }
  }, [outdoorStations, handleSelectStation])

  // Hantera klick på indoor station (från planritning)
  const handleIndoorStationClick = useCallback((indoorStation: IndoorStationWithRelations) => {
    const station = indoorStations.find(s => s.id === indoorStation.id)
    if (station) {
      handleSelectStation(station)
    }
  }, [indoorStations, handleSelectStation])

  // ============================================
  // WIZARD-LÄGE FUNKTIONER
  // ============================================

  // Starta outdoor wizard
  const startOutdoorWizard = useCallback(() => {
    if (session?.status === 'completed') {
      toast.error('Inspektionen är avslutad')
      return
    }

    // Bygg kö av ej-inspekterade stationer, sorterade efter nummer
    const uninspected = outdoorStations
      .filter(s => !inspectedStationIds.has(s.id))
      .sort((a, b) => {
        const numA = outdoorNumberMap[a.id] || 999
        const numB = outdoorNumberMap[b.id] || 999
        return numA - numB
      })

    if (uninspected.length === 0) {
      toast.success('Alla utomhusstationer är redan kontrollerade!')
      return
    }

    const queue = uninspected.map(s => s.id)
    setWizardStationQueue(queue)
    setCurrentWizardStationId(queue[0])
    setWizardMode('outdoor')

    // Stationen pulserar nu - teknikern klickar själv på den
    toast.success('Kontrollrunda startad! Klicka på den pulserande stationen.')
  }, [session?.status, outdoorStations, inspectedStationIds, outdoorNumberMap])

  // Starta indoor wizard för vald planritning
  const startIndoorWizard = useCallback(() => {
    if (session?.status === 'completed') {
      toast.error('Inspektionen är avslutad')
      return
    }

    if (!selectedFloorPlanId) {
      toast.error('Välj en planritning först')
      return
    }

    // Bygg kö av ej-inspekterade stationer på denna planritning
    const uninspected = filteredIndoorStations
      .filter(s => !inspectedStationIds.has(s.id))
      .sort((a, b) => {
        const numA = indoorNumberMap[a.id] || 999
        const numB = indoorNumberMap[b.id] || 999
        return numA - numB
      })

    if (uninspected.length === 0) {
      toast.success('Alla inomhusstationer på denna planritning är redan kontrollerade!')
      return
    }

    const queue = uninspected.map(s => s.id)
    setWizardStationQueue(queue)
    setCurrentWizardStationId(queue[0])
    setWizardMode('indoor')

    // Stationen pulserar nu - teknikern klickar själv på den
    toast.success('Kontrollrunda startad! Klicka på den pulserande stationen.')
  }, [session?.status, selectedFloorPlanId, filteredIndoorStations, inspectedStationIds, indoorNumberMap])

  // Gå till nästa station i wizard
  const wizardNextStation = useCallback(() => {
    if (wizardMode === 'off' || wizardStationQueue.length === 0) return

    // Hitta index för nuvarande station och gå till nästa
    const currentIndex = wizardStationQueue.indexOf(currentWizardStationId || '')
    const nextIndex = currentIndex + 1

    if (nextIndex >= wizardStationQueue.length) {
      // Wizard klar!
      setWizardMode('off')
      setCurrentWizardStationId(null)
      setWizardStationQueue([])
      toast.success('🎉 Alla stationer kontrollerade!')
      return
    }

    const nextStationId = wizardStationQueue[nextIndex]
    setCurrentWizardStationId(nextStationId)
    // Stationen pulserar nu - teknikern klickar själv på den
  }, [wizardMode, wizardStationQueue, currentWizardStationId])

  // Gå till föregående station i wizard
  const wizardPrevStation = useCallback(() => {
    if (wizardMode === 'off' || wizardStationQueue.length === 0) return

    const currentIndex = wizardStationQueue.indexOf(currentWizardStationId || '')
    const prevIndex = currentIndex - 1

    if (prevIndex < 0) {
      toast('Du är på första stationen')
      return
    }

    const prevStationId = wizardStationQueue[prevIndex]
    setCurrentWizardStationId(prevStationId)
    // Stationen pulserar nu - teknikern klickar själv på den
  }, [wizardMode, wizardStationQueue, currentWizardStationId])

  // Hoppa över station i wizard
  const wizardSkipStation = useCallback(() => {
    if (wizardMode === 'off') return

    // Flytta aktuell station till slutet av kön
    const currentId = currentWizardStationId
    if (!currentId) return

    setWizardStationQueue(prev => {
      const withoutCurrent = prev.filter(id => id !== currentId)
      return [...withoutCurrent, currentId]
    })

    // Gå till nästa (som nu är först i kön)
    const newQueue = wizardStationQueue.filter(id => id !== currentId)
    if (newQueue.length > 0) {
      const nextId = newQueue[0]
      setCurrentWizardStationId(nextId)
      // Stationen pulserar nu - teknikern klickar själv på den
    }

    toast('Station hoppades över')
  }, [wizardMode, currentWizardStationId, wizardStationQueue])

  // Avsluta wizard
  const stopWizard = useCallback(() => {
    setWizardMode('off')
    setCurrentWizardStationId(null)
    setWizardStationQueue([])
    setSelectedStation(null)
    toast('Kontrollrunda avslutad')
  }, [])

  // Flytta utomhusstation till ny GPS-position
  const handleRelocateOutdoor = useCallback(async (lat: number, lng: number) => {
    if (!relocatingStation) return

    try {
      const { error } = await supabase
        .from('equipment_placements')
        .update({ latitude: lat, longitude: lng })
        .eq('id', relocatingStation.id)

      if (error) throw error

      setOutdoorStations(prev => prev.map(s =>
        s.id === relocatingStation.id ? { ...s, latitude: lat, longitude: lng } : s
      ))
      toast.success('Station flyttad')
      setRelocatingStation(null)
    } catch (err) {
      console.error('Error relocating station:', err)
      toast.error('Kunde inte flytta stationen')
    }
  }, [relocatingStation])

  // Flytta inomhusstation till ny position på planritning
  const handleRelocateIndoor = useCallback(async (x: number, y: number) => {
    if (!relocatingStation) return

    try {
      const { error } = await supabase
        .from('indoor_stations')
        .update({ position_x_percent: x, position_y_percent: y })
        .eq('id', relocatingStation.id)

      if (error) throw error

      setIndoorStations(prev => prev.map(s =>
        s.id === relocatingStation.id ? { ...s, position_x_percent: x, position_y_percent: y } : s
      ))
      toast.success('Station flyttad')
      setRelocatingStation(null)
    } catch (err) {
      console.error('Error relocating station:', err)
      toast.error('Kunde inte flytta stationen')
    }
  }, [relocatingStation])

  // Efter typbyte: uppdatera stationen lokalt (typ, mätfält, kartfärg och
  // nummer inomhus), nollställ mätvärde och preparat och gå tillbaka till kontrollen
  const handleStationTypeChanged = useCallback((
    result: ChangeStationTypeResult,
    newType: StationType,
    choice: { article: StationTypeArticle | null; serialNumber: string | null }
  ) => {
    const patch = (s: StationData): StationData => {
      if (s.id !== result.station_id) return s
      const isOutdoorStation = outdoorStations.some(o => o.id === s.id)
      return {
        ...s,
        station_type_id: newType.id,
        station_type_data: newType,
        ...(isOutdoorStation ? { equipment_type: newType.code } : { station_type: newType.code }),
        ...(result.new_station_number ? { station_number: result.new_station_number } : {}),
        ...(choice.serialNumber ? { serial_number: choice.serialNumber } : {}),
        // Utan produktval behåller servern bara en produkt som hör till nya
        // typen; typens ikon visas tills sidan laddas om
        ...(choice.article
          ? { article_id: choice.article.articleId, article: { icon: choice.article.icon ?? null } }
          : { article: null })
      }
    }
    setOutdoorStations(prev => prev.map(patch))
    setIndoorStations(prev => prev.map(patch))
    setSelectedStation(prev => (prev ? patch(prev) : prev))
    // Servern nollar mätvärde och preparat på rundans kontroll; gör samma här
    setInspectionResults(prev => {
      const current = prev[result.station_id]
      if (!current) return prev
      return {
        ...prev,
        [result.station_id]: { ...current, measurementValue: null, measurementUnit: null, preparationId: null, preparationName: null }
      }
    })
    // Ett preparatförslag som laddas efter bytet gäller gamla typen
    typeChangeCountRef.current += 1
    setMeasurementValue('')
    setSelectedPreparationId(null)
    setModalView('kontroll')
    toast.success(`Typen ändrad till ${newType.name}`)
  }, [outdoorStations])

  // Auto-progress till nästa efter lyckad inspektion (om wizard är aktiv)
  useEffect(() => {
    // Om en station just inspekterades och wizard är aktiv, gå till nästa
    if (wizardMode !== 'off' && currentWizardStationId && inspectedStationIds.has(currentWizardStationId)) {
      // Kort delay för att visa feedback innan vi går vidare
      const timer = setTimeout(() => {
        wizardNextStation()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [wizardMode, currentWizardStationId, inspectedStationIds, wizardNextStation])

  // ============================================

  // Hantera fototagning/uppladdning
  const handlePhotoCapture = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validera filtyp
      if (!file.type.startsWith('image/')) {
        toast.error('Endast bildfiler tillåtna')
        return
      }
      // Validera storlek (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Bilden får max vara 10MB')
        return
      }
      setPhotoFile(file)
      // Skapa förhandsvisning
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Ladda stationshistorik
  const handleLoadHistory = async () => {
    if (!selectedStation) return

    setHistoryLoading(true)
    setShowHistory(true)

    try {
      const isOutdoor = outdoorStations.some(s => s.id === selectedStation.id)
      const tableName = isOutdoor ? 'outdoor_station_inspections' : 'indoor_station_inspections'

      const { data, error } = await supabase
        .from(tableName)
        .select(`
          id,
          inspected_at,
          status,
          findings,
          photo_path,
          measurement_value,
          measurement_unit,
          technician:technicians(id, name)
        `)
        .eq('station_id', selectedStation.id)
        .order('inspected_at', { ascending: false })
        .limit(20)

      if (error) throw error

      // Hämta foto-URLs för de med photo_path
      const historyWithPhotos = await Promise.all(
        (data || []).map(async (item: any) => {
          let photoUrl = null
          if (item.photo_path) {
            photoUrl = await getInspectionPhotoUrl(item.photo_path)
          }
          return {
            ...item,
            photo_url: photoUrl
          }
        })
      )

      setStationHistory(historyWithPhotos)
    } catch (err) {
      console.error('Error loading history:', err)
      toast.error('Kunde inte ladda historik')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Spara stationsinspektion
  const handleSaveInspection = async () => {
    if (!session || !selectedStation) return
    if (session.status === 'completed') return
    if (!pickupGuard.confirm()) return

    try {
      setIsSubmitting(true)

      // Auto-starta session om det är första inspektionen (innan manuell start)
      let currentSession = session
      if (shouldAutoStartOnSave && session.status === 'scheduled') {
        const updated = await startInspectionSession(session.id)
        if (updated) {
          currentSession = { ...session, status: 'in_progress', started_at: new Date().toISOString() }
          setSession(currentSession)
          setShouldAutoStartOnSave(false)
          toast.success('Inspektion startad!')
        } else {
          toast.error('Kunde inte starta inspektionen')
          setIsSubmitting(false)
          return
        }
      }

      let photoPath: string | null = null

      // Ladda upp foto om det finns
      if (photoFile) {
        const isOutdoor = outdoorStations.some(s => s.id === selectedStation.id)
        photoPath = await uploadInspectionPhoto(
          photoFile,
          selectedStation.id,
          isOutdoor ? 'outdoor' : 'indoor'
        )
        if (!photoPath) {
          toast.error('Kunde inte ladda upp foto')
          setIsSubmitting(false)
          return
        }
      }

      const isOutdoor = outdoorStations.some(s => s.id === selectedStation.id)
      const measurementUnit = selectedStation.station_type_data?.measurement_unit || null

      // Auto-beräkna status från mätvärde + tröskelvärden
      const numMeasurement = measurementValue !== '' ? parseFloat(measurementValue) : null
      const stType = selectedStation.station_type_data
      const selectedPrep = preparations.find(p => p.id === selectedPreparationId) ?? null
      const prepThresholds = (stType as any)?.threshold_source === 'preparation' && selectedPrep
        ? { threshold_warning: (selectedPrep as any).threshold_warning ?? null, threshold_critical: (selectedPrep as any).threshold_critical ?? null, threshold_direction: (selectedPrep as any).threshold_direction ?? null }
        : null
      const autoStatus = calculateInspectionStatus(
        numMeasurement,
        stType?.threshold_warning,
        stType?.threshold_critical,
        stType?.threshold_direction,
        prepThresholds
      )

      const inspectionData = {
        station_id: selectedStation.id,
        session_id: currentSession.id,
        status: autoStatus,
        findings: inspectionNotes || undefined,
        photo_path: photoPath || undefined,
        measurement_value: numMeasurement !== null ? numMeasurement : 0,
        measurement_unit: measurementUnit || undefined,
        preparation_id: selectedPreparationId || undefined
      }

      if (isOutdoor) {
        const { isNew } = await upsertOutdoorInspection(inspectionData, currentSession.technician_id || undefined)

        // Uppdatera session count ENBART vid ny inspektion
        if (isNew) {
          await updateInspectionSession(currentSession.id, {
            inspected_outdoor_stations: currentSession.inspected_outdoor_stations + 1
          })
          setSession({
            ...currentSession,
            inspected_outdoor_stations: currentSession.inspected_outdoor_stations + 1
          })
        }
      } else {
        const { isNew } = await upsertIndoorInspection(inspectionData, currentSession.technician_id || undefined)

        if (isNew) {
          await updateInspectionSession(currentSession.id, {
            inspected_indoor_stations: currentSession.inspected_indoor_stations + 1
          })
          setSession({
            ...currentSession,
            inspected_indoor_stations: currentSession.inspected_indoor_stations + 1
          })
        }
      }

      // Markera som inspekterad
      setInspectedStationIds(prev => new Set(prev).add(selectedStation.id))
      // Kom ihåg preparatet till nästa stations förval
      if (selectedPreparationId) lastUsedPreparationRef.current = selectedPreparationId

      // Spara resultat till sammanställning
      setInspectionResults(prev => ({
        ...prev,
        [selectedStation.id]: {
          status: autoStatus,
          findings: inspectionNotes || null,
          measurementValue: measurementValue !== '' ? parseFloat(measurementValue) : null,
          measurementUnit: measurementUnit || null,
          preparationId: selectedPreparationId,
          preparationName: selectedPrep?.name || null,
          hasPhoto: !!photoPath,
          photoPreview: photoPreview || null,
          timestamp: new Date().toISOString()
        }
      }))

      // Kontrollera + hämta upp: markera tilläggsstationen Borttagen EFTER att
      // kontrollen sparats (ordningen garanterar att sista kontrollen finns i
      // rapporten och faktureras en sista gång)
      if (pickUpAfterSave && selectedStation.is_addon === true) {
        try {
          if (isOutdoor) {
            const res = await EquipmentService.updateEquipmentStatus(
              selectedStation.id,
              'removed',
              currentSession.technician_id || ''
            )
            if (!res.success) throw new Error(res.error)
            setOutdoorStations(prev => prev.map(s =>
              s.id === selectedStation.id ? { ...s, status: 'removed' } : s
            ))
          } else {
            // OBS: indoor_stations.status_updated_by har FK mot profiles(id),
            // INTE technicians — skicka aldrig technician_id här (FK-fel)
            await IndoorStationService.updateStationStatus(
              selectedStation.id,
              'removed',
              undefined
            )
            setIndoorStations(prev => prev.map(s =>
              s.id === selectedStation.id ? { ...s, status: 'removed' } : s
            ))
          }
          setPickedUpCount(prev => prev + 1)
          toast.success('Station kontrollerad och upphämtad. Den slutar faktureras efter denna runda')
        } catch (pickupErr) {
          console.error('Kunde inte markera stationen som upphämtad:', pickupErr)
          toast.error('Kontrollen sparades men stationen kunde inte markeras som upphämtad. Gör det via utrustningsvyn')
        }
      } else {
        toast.success('Inspektion sparad!')
      }

      setSelectedStation(null)
      setSelectedStatus('ok')
      setInspectionNotes('')
      setMeasurementValue('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setSelectedPreparationId(null)
      setPickUpAfterSave(false)

    } catch (err) {
      console.error('Error saving inspection:', err)
      toast.error('Kunde inte spara inspektionen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Snabb-OK: Visa bekräftelsedialog
  const handleQuickOk = (station: StationData, e: React.MouseEvent) => {
    e.stopPropagation() // Förhindra att modalen öppnas
    if (!session || session.status === 'completed') return
    setQuickOkStation(station) // Visa bekräftelsedialog
  }

  // Bekräfta snabb-OK: Faktiskt spara
  const confirmQuickOk = async () => {
    if (!quickOkStation || !session) return

    try {
      // Auto-starta session om det behövs
      let currentSession = session
      if (session.status === 'scheduled') {
        const updated = await startInspectionSession(session.id)
        if (updated) {
          currentSession = { ...session, status: 'in_progress', started_at: new Date().toISOString() }
          setSession(currentSession)
          toast.success('Inspektion startad!')
        } else {
          toast.error('Kunde inte starta inspektionen')
          setQuickOkStation(null)
          return
        }
      }

      const isOutdoor = outdoorStations.some(s => s.id === quickOkStation.id)

      const inspectionData = {
        station_id: quickOkStation.id,
        session_id: currentSession.id,
        status: 'ok' as InspectionStatus,
      }

      if (isOutdoor) {
        const { isNew } = await upsertOutdoorInspection(inspectionData, currentSession.technician_id || undefined)
        if (isNew) {
          await updateInspectionSession(currentSession.id, {
            inspected_outdoor_stations: currentSession.inspected_outdoor_stations + 1
          })
          setSession({
            ...currentSession,
            inspected_outdoor_stations: currentSession.inspected_outdoor_stations + 1
          })
        }
      } else {
        const { isNew } = await upsertIndoorInspection(inspectionData, currentSession.technician_id || undefined)
        if (isNew) {
          await updateInspectionSession(currentSession.id, {
            inspected_indoor_stations: currentSession.inspected_indoor_stations + 1
          })
          setSession({
            ...currentSession,
            inspected_indoor_stations: currentSession.inspected_indoor_stations + 1
          })
        }
      }

      setInspectedStationIds(prev => new Set(prev).add(quickOkStation.id))
      setInspectionResults(prev => ({
        ...prev,
        [quickOkStation.id]: {
          status: 'ok',
          findings: null,
          measurementValue: null,
          measurementUnit: null,
          preparationId: null,
          preparationName: null,
          hasPhoto: false,
          timestamp: new Date().toISOString()
        }
      }))

      toast.success('Station markerad som OK')
      setQuickOkStation(null) // Stäng dialog
    } catch (err) {
      console.error('Error quick-OK inspection:', err)
      toast.error('Kunde inte spara')
      setQuickOkStation(null)
    }
  }

  // Avsluta inspektion.
  // Ordning (viktig): session → ärendestatus + completed_date → fakturering.
  // Faktureringen körs i egen try/catch och får ALDRIG blockera avslutet —
  // fältmiljö med dåligt nät är normalfallet, inte undantaget.
  const handleCompleteInspection = async () => {
    if (!session) return

    // Avslutsvakt: aktiva tilläggsstationer som inte kontrollerats i rundan
    // Bara per kontroll-stationer påverkar rundans fakturering
    const uninspectedAddons = [...outdoorStations, ...indoorStations].filter(
      s => s.is_addon === true && (s.addon_billing_model ?? 'per_round') === 'per_round' && s.status === 'active' && !inspectedStationIds.has(s.id)
    )
    if (uninspectedAddons.length > 0) {
      const proceed = await askConfirm(
        `${uninspectedAddons.length} tilläggsstation${uninspectedAddons.length === 1 ? '' : 'er'} är inte kontrollerad${uninspectedAddons.length === 1 ? '' : 'e'}. De faktureras inte i denna runda. Kontrollera eller hämta upp dem innan avslut, eller fortsätt ändå.`
      )
      if (!proceed) return
    }

    try {
      setIsSubmitting(true)

      // Kommentaren från tekniker sparas innan rundan stängs, så att den
      // alltid kommer med i kontrollrapporten (blur hinner inte alltid före)
      await updateSessionNotes(session.id, sessionNotes.trim())

      // Systematisk arbetsrapport (fakturans "Utfört arbete") — kort och
      // beskrivande, skrivs bara om ärendets fält är tomt
      const inspectedCount = progress?.inspectedStations ?? inspectedStationIds.size
      const totalCount = progress?.totalStations ?? inspectedCount
      let autoReport = `Kontrollerat ${inspectedCount}/${totalCount} stationer.`
      try {
        const placedDuring = session.started_at
          ? await AddonStationBillingService.countStationsPlacedSince(session.customer_id, session.started_at, true)
          : 0
        if (placedDuring > 0) {
          autoReport += `\n${placedDuring} tilläggsstation${placedDuring === 1 ? '' : 'er'} utplacerad${placedDuring === 1 ? '' : 'e'} utöver avtal enligt överenskommelse med kund.`
        }
      } catch { /* rapporttext får aldrig blockera avslutet */ }
      if (pickedUpCount > 0) {
        autoReport += `\n${pickedUpCount} tilläggsstation${pickedUpCount === 1 ? '' : 'er'} upphämtad${pickedUpCount === 1 ? '' : 'e'} enligt överenskommelse med kund.`
      }

      // Arbetsrapporten (2026-10-26): den automatiska raden och Kommentar från
      // tekniker. Fältet döljs för teknikern; texten syns i kundportalen, i
      // organisationsvyerna och i ärendets rapport, och blir fakturans Utfört arbete.
      const kommentar = sessionNotes.trim()
      const arbetsrapport = kommentar ? `${autoReport}\nKommentar från tekniker: ${kommentar}` : autoReport

      const updated = await completeInspectionSession(session.id)
      if (updated) {
        // Uppdatera även ärendets status till "Avslutat" om case_id finns
        if (session.case_id) {
          const caseUpdated = await updateCaseStatusToCompleted(session.case_id, arbetsrapport, { laggTill: true })
          if (!caseUpdated) {
            toast.error('Inspektionen avslutades men ärendets status kunde inte sättas till Avslutat. Kontrollera ärendet')
          }

          // Fakturering: förifyll tilläggsstationsrad + kör ad-hoc-kedjan.
          // Fel här blockerar aldrig avslutet — raderna ligger kvar och
          // kontoret fakturerar från Merförsäljning.
          try {
            const prefill = await AddonStationBillingService.prefillAddonStationLine({
              caseId: session.case_id,
              customerId: session.customer_id,
              sessionId: session.id,
              technicianId: session.technician_id,
              technicianName: session.technician?.name || null
            })

            if (prefill.outcome === 'already_billed' && prefill.billedQuantityMismatch) {
              toast(`Tilläggsstationer redan fakturerade för denna runda (${prefill.billedQuantityMismatch.billed} st). Antalet har ändrats till ${prefill.billedQuantityMismatch.current}. Meddela kontoret.`, { duration: 10000, icon: '⚠️' })
            }
            if (prefill.priceMissing && (prefill.outcome === 'created' || prefill.outcome === 'updated')) {
              toast(`Pris saknas i prislistan för tilläggsstationer. Raden skapades med 0 kr och ingen faktura genereras. Meddela kontoret.`, { duration: 10000, icon: '⚠️' })
            }

            // Arbetstid för att hantera tilläggen: sparas som förslag före
            // faktureringen så att arbetstiden för resten av avtalets år
            // kommer med på kontrollärendets faktura
            if (addonLabourStep.visible) {
              const labour = await addonLabourStep.save()
              if (!labour.saved && labour.message) {
                toast.error(labour.message, { duration: 10000 })
              }
            }

            const billing = await AddonStationBillingService.completeContractCaseBilling({
              caseId: session.case_id,
              customerId: session.customer_id,
              technicianId: session.technician_id,
              technicianName: session.technician?.name || null,
              workPerformed: arbetsrapport
            })
            if (billing.invoiceError) {
              toast.error(`Fakturan kunde inte skapas: ${billing.invoiceError}. Raderna ligger kvar. Kontoret fakturerar från Merförsäljning.`, { duration: 10000 })
            } else if (billing.itemsCreated > 0) {
              toast.success(`${billing.itemsCreated} rad(er) skickade till fakturering (${billing.totalAmount} kr)`)
            }
          } catch (billingErr) {
            console.error('Fakturering vid kontrollrundeavslut misslyckades:', billingErr)
            toast.error('Faktureringen misslyckades. Raderna ligger kvar, kontoret fakturerar från Merförsäljning.', { duration: 10000 })
          }
        }
        toast.success('Inspektion avslutad!')
        if (onCompleted) {
          onCompleted()
        } else {
          // Ingen värd tar över: visa rundan som avslutad på plats
          setSession(prev => (prev ? { ...prev, ...updated } : prev))
          setWizardMode('off')
          setCurrentWizardStationId(null)
          setWizardStationQueue([])
        }
      }
    } catch (err) {
      toast.error('Kunde inte avsluta inspektionen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Spara sessionsanteckningar (auto-save vid blur)
  const handleSessionNotesBlur = async () => {
    if (!session) return
    try {
      await updateSessionNotes(session.id, sessionNotes)
    } catch {
      toast.error('Kunde inte spara anteckning')
    }
  }

  // Ladda upp sessionsbilder
  const handleSessionPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session || !e.target.files) return
    const files = Array.from(e.target.files)

    if (sessionPhotos.length + files.length > 10) {
      toast.error('Max 10 bilder per inspektion')
      e.target.value = ''
      return
    }

    setSessionPhotoUploading(true)
    try {
      for (const file of files) {
        const photo = await uploadSessionPhoto(session.id, file)
        if (photo) {
          setSessionPhotos(prev => [...prev, photo])
        }
      }
      toast.success(files.length === 1 ? 'Bild uppladdad' : `${files.length} bilder uppladdade`)
    } catch {
      toast.error('Kunde inte ladda upp bild')
    } finally {
      setSessionPhotoUploading(false)
      e.target.value = ''
    }
  }

  // Radera sessionsbild
  const handleDeleteSessionPhoto = async (photo: InspectionSessionPhoto) => {
    try {
      await deleteSessionPhoto(photo.id, photo.photo_path)
      setSessionPhotos(prev => prev.filter(p => p.id !== photo.id))
    } catch {
      toast.error('Kunde inte radera bilden')
    }
  }

  // Spara bildtext
  const handleSaveCaption = async (photoId: string) => {
    try {
      await updateSessionPhotoCaption(photoId, editingCaptionValue)
      setSessionPhotos(prev => prev.map(p =>
        p.id === photoId ? { ...p, caption: editingCaptionValue || null } : p
      ))
      setEditingCaptionId(null)
    } catch {
      toast.error('Kunde inte spara bildtext')
    }
  }

  // Lås upp avslutad inspektion för korrigering
  const handleReopenInspection = async () => {
    if (!session) return

    try {
      setIsSubmitting(true)
      const updated = await reopenInspectionSession(session.id)
      if (updated) {
        setSession({ ...session, ...updated })
        toast.success('Inspektionen är nu öppen för korrigering')
      }
    } catch (err) {
      toast.error('Kunde inte öppna inspektionen')
    } finally {
      setIsSubmitting(false)
      setShowReopenConfirm(false)
    }
  }


  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner text="Laddar inspektion..." />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-4 py-20">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-red-400 text-center">{error}</p>
        {onExit && (
          <Button onClick={onExit}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka
          </Button>
        )}
      </div>
    )
  }

  // Get current stations for list view
  const currentStations = activeTab === 'outdoor' ? outdoorStations : indoorStations

  // Hjälpfunktioner för navigation och kontakt
  const handleNavigate = () => {
    const address = session?.customer?.contact_address
    if (!address) {
      toast.error('Ingen adress tillgänglig')
      return
    }
    // Öppna Google Maps med adressen
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank')
  }

  const handleCopyAddress = async () => {
    const address = session?.customer?.contact_address
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      toast.success('Adress kopierad!')
    } catch {
      toast.error('Kunde inte kopiera adress')
    }
  }

  const handleCall = () => {
    const phone = session?.customer?.contact_phone
    if (!phone) {
      toast.error('Inget telefonnummer tillgängligt')
      return
    }
    window.location.href = `tel:${phone}`
  }

  // Formatera datum
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // En rad i stationslistan: typruta (med tilläggsbricka), nummer och typ,
  // senaste kontrollen och OK som bockknapp. Hela raden öppnar stationen.
  const renderStationRow = (station: StationData, stationNumber: number | string) => {
    const isInspected = inspectedStationIds.has(station.id)
    const typeName = station.station_type_data?.name || station.equipment_type || station.station_type || 'Station'
    const hadActivity = activityStationIds.has(station.id)
    const current = inspectionResults[station.id]
    const previous = previousInspections[station.id]
    const canQuickOk = !isInspected && session?.status !== 'completed'

    let detail: React.ReactNode = null
    if (isInspected) {
      const v = current?.measurementValue
      const unit = unitShort(current?.measurementUnit)
      detail = (
        <span className="text-[#20c58f]">
          Kontrollerad nu{v !== null && v !== undefined ? ` · ${v}${unit ? ` ${unit}` : ''}` : ''}
        </span>
      )
    } else if (previous) {
      detail = (
        <span className={hadActivity ? 'text-amber-400' : 'text-slate-500'}>
          Senast {new Date(previous.inspected_at).toLocaleDateString('sv-SE')} · {statusText(previous.status)}
        </span>
      )
    } else if (hadActivity) {
      detail = <span className="text-amber-400">Aktivitet senast</span>
    }

    return (
      <div
        key={station.id}
        role="button"
        tabIndex={0}
        onClick={() => handleSelectStation(station)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSelectStation(station)
          }
        }}
        className={`w-full flex items-center gap-3 rounded-xl border bg-slate-900 py-2 pr-2 pl-2.5 text-left cursor-pointer transition-colors hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
          isInspected ? 'border-[#20c58f]/35' : hadActivity ? 'border-amber-500/40' : 'border-slate-800'
        }`}
      >
        <StationTypeTile
          size={40}
          color={station.station_type_data?.color}
          icon={resolveStationIcon(station.article?.icon, station.station_type_data?.icon)}
          addon={station.is_addon === true}
          title={typeName}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {stationNumber} <span className="font-normal text-slate-400">{typeName}</span>
          </p>
          {detail && <p className="text-[11px] truncate">{detail}</p>}
        </div>
        {isInspected ? (
          <span
            role="img"
            aria-label="Kontrollerad"
            className="w-11 h-11 flex-shrink-0 rounded-xl bg-[#20c58f] text-[#04140d] flex items-center justify-center"
          >
            <Icon name="station.ok" size={20} />
          </span>
        ) : canQuickOk ? (
          <button
            type="button"
            onClick={(e) => handleQuickOk(station, e)}
            aria-label={`Station ${stationNumber} OK`}
            className="w-11 h-11 flex-shrink-0 rounded-xl border border-[#20c58f]/40 bg-[#20c58f]/10 text-[#20c58f] hover:bg-[#20c58f]/20 flex items-center justify-center transition-colors"
          >
            <Icon name="station.ok" size={20} />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      /* Inbäddad: ingen egen scrollyta. Värdens scrollyta bär hela kontrollen så att
         botten alltid nås; sidhuvudet fastnar mot värdens överkant. */
      className={embedded ? 'pb-4' : 'min-h-[calc(100vh-3.5rem)]'}
    >
      {/* Sidhuvud: bara rubrik och förlopp är sticky. Kommentar, sammanställning
          och områdesväxeln scrollar med sidan, annars täcker sidhuvudet större
          delen av en telefonskärm */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Rubrikrad: tillbaka och rubrik, eller Lås upp. Inbäddad utan rubrik och utan
              Lås upp behövs ingen rad alls; klarmarkeringen ligger i förloppsknappen nedanför */}
          {(!(embedded && hideHeader) || session?.status === 'completed') && (
          <div className="flex items-center gap-2 mb-2">
            {(!embedded || (!hideHeader && onExit)) && (
              <button
                type="button"
                onClick={() => onExit?.()}
                aria-label="Tillbaka"
                className="w-11 h-11 -ml-2 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {embedded && hideHeader ? (
              // Värden visar rubriken; här bara rubrikradens knappar
              <div className="flex-1 min-w-0" />
            ) : (
              <div className="flex-1 min-w-0">
                <h1 className="text-[17px] font-bold text-white leading-tight">Stationskontroll</h1>
                <p className="text-xs text-slate-400 truncate">{session?.customer?.company_name}</p>
              </div>
            )}

            {/* Lås upp-knapp för avslutade inspektioner */}
            {session?.status === 'completed' && (
              <Button
                onClick={() => setShowReopenConfirm(true)}
                loading={isSubmitting}
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 bg-transparent"
              >
                <Unlock className="w-4 h-4 mr-2" />
                Lås upp
              </Button>
            )}
          </div>
          )}

          {/* Förlopp som klarmarkeringsknapp (ute och inne tillsammans) */}
          {session && progress && session.status !== 'completed' && (
            <KlarmarkeraKnapp
              progress={progress}
              sessionStatus={session.status}
              isSubmitting={isSubmitting}
              onKlarmarkera={() => setShowCompleteConfirm(true)}
              onVisaOmrade={setActiveTab}
            />
          )}
          {session && progress && session.status === 'completed' && <AvslutatForlopp progress={progress} />}
        </div>
      </div>

      {/* Det som scrollar med sidan */}
      {session && (
        <div className="max-w-4xl mx-auto px-4 pt-3 space-y-3">
          {/* Avslutad */}
          {session.status === 'completed' && (
            <div className="flex items-center gap-2 text-sm">
              <StatusDot status="none" />
              <span className="text-[#20c58f] font-medium">Inspektion avslutad</span>
              {session.completed_at && (
                <span className="text-slate-500">
                  {new Date(session.completed_at).toLocaleDateString('sv-SE')} kl {new Date(session.completed_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {/* Återupptagande-info - visas om det redan finns inspekterade stationer vid sidladdning, försvinner efter 10s */}
          {showResumeNotice && inspectedStationIds.size > 0 && session.status === 'in_progress' && progress && progress.inspectedStations > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-amber-200 text-sm">
                Du fortsätter en påbörjad inspektion. {inspectedStationIds.size} stationer är redan kontrollerade.
              </span>
            </motion.div>
          )}

          {/* Kommentar från tekniker: enradsfält som växer, kamera och sammanställning bredvid.
              Krävs innan kontrollen klarmarkeras och står i kontrollrapporten. */}
          <div className="flex gap-2 items-start">
            <label className="flex-1 min-w-0 flex items-start gap-2 min-h-[44px] px-3 py-[11px] bg-slate-900 border border-slate-800 rounded-xl text-slate-500 focus-within:border-[#20c58f] focus-within:ring-1 focus-within:ring-[#20c58f]">
              <Icon name="allman.anteckning" size={16} className="mt-0.5 flex-shrink-0" />
              <textarea
                ref={sessionNotesRef}
                rows={1}
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                onBlur={handleSessionNotesBlur}
                disabled={session.status === 'completed'}
                placeholder={session.status === 'completed' ? 'Ingen kommentar från tekniker' : 'Kommentar från tekniker'}
                aria-label="Kommentar från tekniker"
                className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm leading-5 text-slate-200 placeholder-slate-500 resize-none overflow-hidden focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
              />
            </label>
            {session.status !== 'completed' && (
              <button
                type="button"
                onClick={() => sessionPhotoInputRef.current?.click()}
                disabled={sessionPhotoUploading || sessionPhotos.length >= 10}
                aria-label={`Lägg till bild, ${sessionPhotos.length} av 10`}
                title={`Bilder ${sessionPhotos.length} av 10`}
                className="w-11 h-11 flex-shrink-0 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sessionPhotoUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon name="allman.foto" size={20} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSummary(!showSummary)}
              disabled={inspectedStationIds.size === 0}
              aria-label={`Sammanställning, ${inspectedStationIds.size} kontrollerade`}
              aria-pressed={showSummary}
              title="Sammanställning"
              className={`w-11 h-11 flex-shrink-0 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                showSummary
                  ? 'bg-[#20c58f]/10 border-[#20c58f]/60 text-[#20c58f]'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <Icon name="station.summa" size={20} />
            </button>
            <input
              ref={sessionPhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleSessionPhotoUpload}
            />
          </div>

          {/* Bildminiatyrer */}
          {sessionPhotos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sessionPhotos.map(photo => (
                <div key={photo.id} className="relative flex-shrink-0 w-24 group">
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Sessionsbild'}
                    className="w-24 h-24 object-cover rounded-lg border border-slate-700 cursor-pointer"
                    onClick={() => setLightboxPhoto(photo.url || null)}
                  />
                  {session.status !== 'completed' && (
                    <button
                      onClick={() => handleDeleteSessionPhoto(photo)}
                      aria-label="Ta bort bilden"
                      className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-500 text-[#fff] rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {/* Bildtext */}
                  {editingCaptionId === photo.id ? (
                    <div className="mt-1 flex gap-1">
                      <input
                        autoFocus
                        value={editingCaptionValue}
                        onChange={e => setEditingCaptionValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveCaption(photo.id)
                          if (e.key === 'Escape') setEditingCaptionId(null)
                        }}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#20c58f] w-0"
                      />
                      <button onClick={() => handleSaveCaption(photo.id)} className="text-[#20c58f]" aria-label="Spara bildtext"><Check className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <p
                      onClick={() => {
                        if (session.status !== 'completed') {
                          setEditingCaptionId(photo.id)
                          setEditingCaptionValue(photo.caption || '')
                        }
                      }}
                      className={`text-xs text-slate-400 mt-1 text-center truncate ${session.status !== 'completed' ? 'cursor-pointer hover:text-slate-300' : ''}`}
                      title={photo.caption || undefined}
                    >
                      {photo.caption || (session.status !== 'completed' ? <span className="italic text-slate-600">Lägg till text</span> : '')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sammanställningspanel - kollapsbar */}
          <AnimatePresence>
            {showSummary && inspectedStationIds.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-800/50 rounded-xl p-4 max-h-64 overflow-y-auto">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Inspekterade stationer
                  </h3>

                  {/* Utomhus-sektion */}
                  {(() => {
                    const inspectedOutdoor = outdoorStations.filter(s => inspectedStationIds.has(s.id))
                    if (inspectedOutdoor.length === 0) return null
                    return (
                      <div className="mb-3">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Utomhus ({inspectedOutdoor.length})
                        </p>
                        <div className="space-y-1.5">
                          {inspectedOutdoor.map(station => {
                            const result = inspectionResults[station.id]
                            const stationNumber = outdoorNumberMap[station.id] || '?'
                            return (
                              <div key={station.id} className="flex items-center gap-2 text-sm bg-slate-900/50 rounded-lg px-3 py-2">
                                <span className="w-5 h-5 rounded-full flex items-center justify-center bg-[#20c58f] text-[#04140d] flex-shrink-0">
                                  <Icon name="station.ok" size={16} />
                                </span>
                                <span className="text-white">Station {stationNumber}</span>
                                {result && (
                                  <>
                                    <StatusDot status={result.status} />
                                    {result.measurementValue !== null && (
                                      <span className="text-slate-400 text-xs">
                                        {result.measurementValue} {result.measurementUnit === 'gram' ? 'g' : result.measurementUnit}
                                      </span>
                                    )}
                                    {result.preparationName && (
                                      <span className="text-emerald-400/70 text-xs flex items-center gap-0.5">
                                        <Beaker className="w-3 h-3" />{result.preparationName}
                                      </span>
                                    )}
                                    {result.hasPhoto && <Camera className="w-3.5 h-3.5 text-slate-500" />}
                                    {result.findings && (
                                      <span className="text-slate-400 text-xs truncate max-w-24" title={result.findings}>
                                        "{result.findings}"
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Inomhus-sektion */}
                  {(() => {
                    const inspectedIndoor = indoorStations.filter(s => inspectedStationIds.has(s.id))
                    if (inspectedIndoor.length === 0) return null
                    return (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          Inomhus ({inspectedIndoor.length})
                        </p>
                        <div className="space-y-1.5">
                          {inspectedIndoor.map(station => {
                            const result = inspectionResults[station.id]
                            const stationNumber = indoorNumberMap[station.id] || '?'
                            const floorPlan = floorPlans.find(fp => fp.id === station.floor_plan_id)
                            return (
                              <div key={station.id} className="flex items-center gap-2 text-sm bg-slate-900/50 rounded-lg px-3 py-2">
                                <span className="w-5 h-5 rounded-full flex items-center justify-center bg-[#20c58f] text-[#04140d] flex-shrink-0">
                                  <Icon name="station.ok" size={16} />
                                </span>
                                <span className="text-white">Station {stationNumber}</span>
                                {floorPlan && (
                                  <span className="text-slate-500 text-xs">({floorPlan.name})</span>
                                )}
                                {result && (
                                  <>
                                    <StatusDot status={result.status} />
                                    {result.measurementValue !== null && (
                                      <span className="text-slate-400 text-xs">
                                        {result.measurementValue} {result.measurementUnit === 'gram' ? 'g' : result.measurementUnit}
                                      </span>
                                    )}
                                    {result.preparationName && (
                                      <span className="text-emerald-400/70 text-xs flex items-center gap-0.5">
                                        <Beaker className="w-3 h-3" />{result.preparationName}
                                      </span>
                                    )}
                                    {result.hasPhoto && <Camera className="w-3.5 h-3.5 text-slate-500" />}
                                    {result.findings && (
                                      <span className="text-slate-400 text-xs truncate max-w-24" title={result.findings}>
                                        "{result.findings}"
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Statistik-sammanfattning */}
                  <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-400">
                        {Object.values(inspectionResults).filter(r => r.status === 'ok').length}
                      </p>
                      <p className="text-xs text-slate-500">OK</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-400">
                        {Object.values(inspectionResults).filter(r => r.status === 'activity').length}
                      </p>
                      <p className="text-xs text-slate-500">Aktivitet</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-400">
                        {Object.values(inspectionResults).filter(r => r.status !== 'ok' && r.status !== 'activity').length}
                      </p>
                      <p className="text-xs text-slate-500">Övrigt</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ute/Inne och Starta runda */}
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Område" className="flex-1 grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
              {(['outdoor', 'indoor'] as const).map(tab => {
                const isSelectedTab = activeTab === tab
                const list = tab === 'outdoor' ? outdoorStations : indoorStations
                const done = list.filter(s => inspectedStationIds.has(s.id)).length
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isSelectedTab}
                    onClick={() => setActiveTab(tab)}
                    className={`h-9 rounded-[9px] text-[13px] flex items-center justify-center gap-1.5 transition-colors ${
                      isSelectedTab
                        ? 'bg-[#20c58f] text-[#04140d] font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon name={tab === 'outdoor' ? 'station.ute' : 'station.inne'} size={16} />
                    {tab === 'outdoor' ? 'Ute' : 'Inne'}
                    <span className="tabular-nums">{done}/{list.length}</span>
                  </button>
                )
              })}
            </div>
            {session.status !== 'completed' && (
              activeTab === 'outdoor'
                ? wizardMode !== 'outdoor' && outdoorStations.some(s => !inspectedStationIds.has(s.id))
                : wizardMode !== 'indoor' && !!selectedFloorPlanId && filteredIndoorStations.some(s => !inspectedStationIds.has(s.id))
            ) && (
              <button
                type="button"
                onClick={activeTab === 'outdoor' ? startOutdoorWizard : startIndoorWizard}
                className="h-[46px] px-3.5 flex-shrink-0 rounded-xl bg-[#20c58f] hover:bg-[#1bb07f] text-[#04140d] text-[13px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Icon name="station.runda" size={20} />
                Starta runda
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main content - visas alltid (sessionen startas automatiskt vid första sparning) */}
      {session && (
      <div className="max-w-4xl mx-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'outdoor' ? (
            <motion.div
              key="outdoor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Guidat läge - visar vilken station som är näst */}
              {wizardMode === 'outdoor' && (
                <div className="flex items-center justify-between bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-white font-medium">
                      <Navigation className="w-4 h-4 text-[#20c58f]" />
                      <span>Station {wizardStationQueue.indexOf(currentWizardStationId || '') + 1} av {wizardStationQueue.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={wizardPrevStation}
                        disabled={wizardStationQueue.indexOf(currentWizardStationId || '') === 0}
                        className="p-2.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg bg-slate-800/50 transition-colors"
                        aria-label="Föregående station"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={wizardSkipStation}
                        className="p-2.5 text-slate-300 hover:text-white rounded-lg bg-slate-800/50 transition-colors"
                        aria-label="Hoppa över station"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>
                      <button
                        onClick={wizardNextStation}
                        className="p-2.5 text-slate-300 hover:text-white rounded-lg bg-slate-800/50 transition-colors"
                        aria-label="Nästa station"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={stopWizard}
                    className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    Avsluta kontrollrunda
                  </button>
                </div>
              )}

              {/* Redigeringstext när alla utomhusstationer är klara */}
              {wizardMode !== 'outdoor' && outdoorStations.length > 0 && outdoorStations.every(s => inspectedStationIds.has(s.id)) && (
                <p className="flex items-center justify-end gap-2 text-sm text-[#20c58f]">
                  <StatusDot status="none" />
                  Alla stationer kontrollerade. Tryck på en station för att ändra.
                </p>
              )}

              {outdoorStations.length === 0 ? (
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8 text-center">
                  <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Inga utomhusstationer</p>
                </div>
              ) : (
                <>
                  {/* Karta */}
                  <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden" ref={relocateAreaRef}>
                    <EquipmentMap
                      showProductIcons
                      equipment={outdoorEquipment}
                      height={embedded ? EMBEDDED_STAGE_HEIGHT : 'min(55vh, 450px)'}
                      refitWhenVisible={embedded}
                      readOnly
                      showControls={true}
                      showNumbers={true}
                      enableClustering={false}
                      onEquipmentClick={handleOutdoorStationClick}
                      inspectedStationIds={inspectedStationIds}
                      highlightedStationId={wizardMode === 'outdoor' ? currentWizardStationId : null}
                      relocatingStationId={relocatingStation && outdoorStations.some(s => s.id === relocatingStation?.id) ? relocatingStation.id : null}
                      relocatingStationName={relocatingStation ? `station ${outdoorNumberMap[relocatingStation.id] ?? ''}`.trim() : null}
                      onRelocateClick={handleRelocateOutdoor}
                      onCancelRelocate={() => setRelocatingStation(null)}
                    />
                  </div>

                  {/* Lista under kartan */}
                  <div className="space-y-2 mt-4">
                    <p className="text-sm text-slate-400 px-1">{outdoorStations.length} utomhusstationer</p>
                    {[...outdoorStations].sort((a, b) => (outdoorNumberMap[a.id] ?? 0) - (outdoorNumberMap[b.id] ?? 0)).map(station => renderStationRow(station, outdoorNumberMap[station.id] || '?'))}
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="indoor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Kontrollrunda-bar för inomhus */}
              {wizardMode === 'indoor' && (
                <div className="flex items-center justify-between bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-white font-medium">
                      <Navigation className="w-4 h-4 text-[#20c58f]" />
                      <span>Station {wizardStationQueue.indexOf(currentWizardStationId || '') + 1} av {wizardStationQueue.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={wizardPrevStation}
                        disabled={wizardStationQueue.indexOf(currentWizardStationId || '') === 0}
                        className="p-2.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg bg-slate-800/50 transition-colors"
                        aria-label="Föregående station"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={wizardSkipStation}
                        className="p-2.5 text-slate-300 hover:text-white rounded-lg bg-slate-800/50 transition-colors"
                        aria-label="Hoppa över station"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>
                      <button
                        onClick={wizardNextStation}
                        className="p-2.5 text-slate-300 hover:text-white rounded-lg bg-slate-800/50 transition-colors"
                        aria-label="Nästa station"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={stopWizard}
                    className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    Avsluta kontrollrunda
                  </button>
                </div>
              )}

              {/* Planritningsväljare med progress - liggande miniatyrer */}
              {floorPlans.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Planritningar</span>
                    {wizardMode !== 'indoor' && selectedFloorPlanId && filteredIndoorStations.length > 0 && filteredIndoorStations.every(s => inspectedStationIds.has(s.id)) && (
                      <p className="flex items-center gap-2 text-sm text-[#20c58f]">
                        <StatusDot status="none" />
                        Alla klara. Tryck på en station för att ändra.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {floorPlans.map((fp) => {
                      // Räkna stationer och inspekterade per planritning
                      const stationsOnPlan = indoorStations.filter(s => s.floor_plan_id === fp.id)
                      const inspectedOnPlan = stationsOnPlan.filter(s => inspectedStationIds.has(s.id)).length
                      const totalOnPlan = stationsOnPlan.length
                      const allDone = totalOnPlan > 0 && inspectedOnPlan === totalOnPlan
                      const isSelected = selectedFloorPlanId === fp.id

                      return (
                        <button
                          key={fp.id}
                          onClick={() => setSelectedFloorPlanId(fp.id)}
                          className={`flex-shrink-0 w-56 rounded-xl overflow-hidden transition-all border-2 ${
                            isSelected
                              ? 'border-[#20c58f] bg-[#20c58f]/10'
                              : allDone
                                ? 'border-green-500/30 bg-slate-800'
                                : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                          }`}
                        >
                          <div className="p-3 flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-[#20c58f]/20' : 'bg-slate-700'
                            }`}>
                              <Building2 className={`w-5 h-5 ${isSelected ? 'text-[#20c58f]' : 'text-slate-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className={`text-sm font-medium truncate ${
                                isSelected ? 'text-[#20c58f]' : 'text-slate-200'
                              }`}>
                                {fp.building_name || fp.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs font-medium ${
                                  allDone ? 'text-green-400' : 'text-slate-400'
                                }`}>
                                  {inspectedOnPlan}/{totalOnPlan} stationer
                                </span>
                                {allDone && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                              </div>
                            </div>
                          </div>
                          {/* Mini progressbar */}
                          <div className="h-1 bg-slate-700">
                            <div
                              className="h-full bg-[#20c58f] transition-all duration-300"
                              style={{ width: `${totalOnPlan > 0 ? (inspectedOnPlan / totalOnPlan) * 100 : 0}%` }}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {indoorStations.length === 0 ? (
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8 text-center">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Inga inomhusstationer</p>
                </div>
              ) : !selectedFloorPlanId || !floorPlanImageUrl ? (
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8 text-center">
                  <p className="text-slate-400">Välj en planritning ovan</p>
                </div>
              ) : (
                // Floor plan viewer - ökad höjd för bättre mobil UX
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden" ref={relocateAreaRef}>
                  <FloorPlanViewer
                    showProductIcons
                    imageUrl={floorPlanImageUrl}
                    stations={indoorStationsForViewer}
                    selectedStationId={null}
                    placementMode="view"
                    onStationClick={handleIndoorStationClick}
                    onImageClick={handleRelocateIndoor}
                    onCancelPlacement={() => setRelocatingStation(null)}
                    height={embedded ? EMBEDDED_STAGE_HEIGHT : 'min(55vh, 450px)'}
                    recalcOnResize={embedded}
                    showNumbers={true}
                    inspectedStationIds={inspectedStationIds}
                    highlightedStationId={wizardMode === 'indoor' ? currentWizardStationId : null}
                    relocatingStationId={relocatingStation && indoorStations.some(s => s.id === relocatingStation?.id) ? relocatingStation.id : null}
                    relocatingStationName={relocatingStation ? `station ${indoorNumberMap[relocatingStation.id] ?? ''}`.trim() : null}
                  />
                </div>
              )}

              {/* Indoor stations list */}
              {filteredIndoorStations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">
                    {filteredIndoorStations.length} stationer på denna planritning
                  </p>
                  {[...filteredIndoorStations].sort((a, b) => (indoorNumberMap[a.id] ?? 0) - (indoorNumberMap[b.id] ?? 0)).map(station => renderStationRow(station, indoorNumberMap[station.id] || '?'))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Snabb-OK bekräftelsedialog */}
      {renderOverlay(<AnimatePresence>
        {quickOkStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${overlayZ} bg-black/50 flex items-center justify-center p-4`}
            onClick={() => setQuickOkStation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-xl p-5 max-w-xs w-full shadow-xl border border-slate-700"
            >
              <p className="text-white text-center mb-4">
                Markera <span className="font-bold text-green-400">Station {outdoorNumberMap[quickOkStation.id] || indoorNumberMap[quickOkStation.id] || '?'}</span> som OK?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setQuickOkStation(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmQuickOk}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-[#fff] rounded-lg font-medium transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>)}

      {/* Foto lightbox */}
      {renderOverlay(<AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${lightboxZ} bg-black/90 flex items-center justify-center`}
            onClick={() => setLightboxPhoto(null)}
          >
            <img
              src={lightboxPhoto}
              alt="Foto"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>)}

      {/* Bekräftelsedialog för att avsluta inspektion */}
      {renderOverlay(<AnimatePresence>
        {showCompleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${overlayZ} bg-black/50 flex items-center justify-center p-4`}
            onClick={() => setShowCompleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`bg-slate-800 rounded-xl p-5 ${addonLabourStep.visible ? 'max-w-lg' : 'max-w-sm'} w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-700`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Klarmarkera ärende?</h3>
              </div>

              {progress && progress.inspectedStations < progress.totalStations ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4 text-sm text-amber-400">
                  Du har inte inspekterat alla stationer ännu.
                </div>
              ) : (
                <p className="text-slate-300 mb-2">
                  Alla stationer är inspekterade.
                </p>
              )}

              {progress && (
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Utomhus:</span>
                    <span className={progress.outdoorProgress.inspected === progress.outdoorProgress.total ? 'text-green-400' : 'text-amber-400'}>
                      {progress.outdoorProgress.inspected}/{progress.outdoorProgress.total}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Inomhus:</span>
                    <span className={progress.indoorProgress.inspected === progress.indoorProgress.total ? 'text-green-400' : 'text-amber-400'}>
                      {progress.indoorProgress.inspected}/{progress.indoorProgress.total}
                    </span>
                  </div>
                  {sessionPhotos.length > 0 && (
                    <div className="flex justify-between text-slate-400 mt-1">
                      <span>Bilder:</span>
                      <span className="text-[#20c58f] flex items-center gap-1">
                        <Camera className="w-3 h-3" /> {sessionPhotos.length} st
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Kommentar från tekniker krävs: fältet finns här så att teknikern inte behöver leta */}
              <div className="mb-4">
                <label htmlFor="klar-kommentar" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Kommentar från tekniker <span className="text-red-400" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="klar-kommentar"
                  rows={3}
                  value={sessionNotes}
                  onChange={e => setSessionNotes(e.target.value)}
                  onBlur={handleSessionNotesBlur}
                  placeholder="Hur såg det ut? Aktivitet, åtgärder och vad kunden behöver göra."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 resize-y focus:outline-none focus:border-[#20c58f] focus:ring-1 focus:ring-[#20c58f]"
                />
                {!sessionNotes.trim() && (
                  <p className="mt-1 text-sm text-amber-300">Skriv en kommentar innan kontrollen klarmarkeras. Den står i kontrollrapporten.</p>
                )}
              </div>

              {/* Värdens avslutskontroll (beforeComplete): det som saknas innan ärendet kan klarmarkeras */}
              {hasBeforeComplete && (checkingBlockers || completeBlockers.length > 0) && (
                <div className="mb-4 space-y-2" role="status" aria-live="polite">
                  {checkingBlockers ? (
                    <p className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Kontrollerar ärendet...
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-200">Det här saknas innan ärendet kan klarmarkeras:</p>
                      <ul className="space-y-1.5">
                        {completeBlockers.map((text, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-amber-300">
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" aria-hidden />
                            <span>{text}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => void runBeforeComplete()}
                        className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
                      >
                        Kontrollera igen
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Arbetstid för att hantera tilläggen (nya per år/per månad i rundan) */}
              <AddonLabourStep step={addonLabourStep} className="mb-4" />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={async () => {
                    // Fel i arbetstidsvalet stoppar här så teknikern kan rätta
                    if (addonLabourStep.visible) {
                      const labourError = addonLabourStep.validate()
                      if (labourError) {
                        toast.error(labourError)
                        return
                      }
                    }
                    if (!sessionNotes.trim()) {
                      toast.error('Skriv en kommentar från tekniker innan kontrollen klarmarkeras')
                      return
                    }
                    // Värdens avslutskontroll körs om precis före klarmarkeringen
                    if (hasBeforeComplete) {
                      const blockers = await runBeforeComplete()
                      if (blockers.length > 0) return
                    }
                    setShowCompleteConfirm(false)
                    handleCompleteInspection()
                  }}
                  disabled={!progress || progress.inspectedStations < progress.totalStations || !sessionNotes.trim() || addonLabourStep.loading || checkingBlockers || completeBlockers.length > 0}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-[#fff] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ja, klarmarkera
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>)}

      {/* Bekräftelsedialog för att låsa upp inspektion */}
      {renderOverlay(<AnimatePresence>
        {showReopenConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${overlayZ} bg-black/50 flex items-center justify-center p-4`}
            onClick={() => setShowReopenConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-full">
                  <Unlock className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Lås upp inspektion?</h3>
              </div>

              <p className="text-slate-300 mb-4">
                Du kan sedan korrigera eller lägga till inspektioner på stationer.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReopenConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleReopenInspection}
                  className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-[#fff] rounded-lg font-medium transition-colors"
                >
                  Ja, lås upp
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>)}

      {/* Stationsmodalen: kontrollen, eller byt typ som ersätter innehållet */}
      {renderOverlay(<AnimatePresence>
        {selectedStation && (() => {
          const isOutdoorSel = outdoorStations.some(s => s.id === selectedStation.id)
          const selNumber = outdoorNumberMap[selectedStation.id] || indoorNumberMap[selectedStation.id] || '?'
          const selTypeName = selectedStation.station_type_data?.name || selectedStation.equipment_type || selectedStation.station_type || 'Station'
          const selIcon = resolveStationIcon(selectedStation.article?.icon, selectedStation.station_type_data?.icon)
          const canEdit = session?.status !== 'completed'
          const canPickUp = selectedStation.is_addon === true && selectedStation.status === 'active' && canEdit
          const lastHistory = stationHistory[0]

          return (
            <motion.div
              key="station-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={embedded ? undefined : { opacity: 0 }}
              className={`fixed inset-0 ${overlayZ} bg-black/70 flex items-end sm:items-center justify-center p-4 overflow-y-auto`}
              onClick={stangStationsark}
            >
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={embedded ? undefined : { y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
              >
                {modalView === 'byttyp' ? (
                  <ChangeStationTypeSheet
                    station={{
                      id: selectedStation.id,
                      kind: isOutdoorSel ? 'outdoor' : 'indoor',
                      typeId: selectedStation.station_type_data?.id ?? selectedStation.station_type_id ?? null,
                      typeName: selTypeName,
                      typeColor: selectedStation.station_type_data?.color ?? null,
                      typeIcon: selectedStation.station_type_data?.icon ?? null,
                      is_addon: selectedStation.is_addon,
                      addon_billing_model: selectedStation.addon_billing_model,
                      addon_contract_mode: selectedStation.addon_contract_mode,
                      article_id: selectedStation.article_id,
                      serial_number: selectedStation.serial_number,
                      label: `Station ${selNumber}`
                    }}
                    sessionId={session?.id ?? null}
                    onChanged={handleStationTypeChanged}
                    onCancel={() => setModalView('kontroll')}
                  />
                ) : (
                  <>
                    {/* Rubrik: typruta, nummer och typ */}
                    <div className="flex items-center gap-3 border-b border-slate-800 py-3.5 pl-4 pr-3">
                      <StationTypeTile
                        size={44}
                        color={selectedStation.station_type_data?.color}
                        icon={selIcon}
                        addon={selectedStation.is_addon === true}
                      />
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-white truncate">Station {selNumber}</h2>
                        <p className="text-[13px] text-slate-400 truncate">
                          {selTypeName}
                          {selectedStation.is_addon === true && <span className="text-violet-400"> · tillägg</span>}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={stangStationsark}
                        aria-label="Stäng"
                        className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Verktygsraden */}
                    <div className="px-4 py-3 border-b border-slate-800 space-y-2">
                      <StationToolbar
                        move={{
                          visible: canEdit,
                          onClick: () => {
                            setRelocatingStation(selectedStation)
                            setSelectedStation(null)
                            // Rulla fram kartan eller planritningen där flyttläget visas
                            setTimeout(() => relocateAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
                          }
                        }}
                        changeType={{
                          visible: canEdit,
                          onClick: () => setModalView('byttyp'),
                          disabled: typePaidLock.locked,
                          disabledReason: typePaidLock.paidThrough ? `Betald till och med ${typePaidLock.paidThrough}` : undefined
                        }}
                        history={{
                          onClick: () => setShowHistory(v => !v),
                          active: showHistory
                        }}
                        pickUp={{
                          visible: canPickUp,
                          onClick: () => setPickUpAfterSave(v => !v),
                          active: pickUpAfterSave
                        }}
                      />
                      {typePaidLock.locked && (
                        <p className="flex items-start gap-2 text-xs text-slate-400">
                          <span className="mt-1 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" aria-hidden />
                          <span>Typen kan inte bytas, kunden har betalat för stationen till och med {typePaidLock.paidThrough}.</span>
                        </p>
                      )}
                    </div>

                    {/* Scrollbart innehåll */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-5">

                      {/* Historik: panelen när den är utfälld, annars en kompakt rad */}
                      {showHistory ? (
                        historyLoading ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Laddar historik...
                          </div>
                        ) : stationHistory.length > 0 ? (
                          <div className="space-y-1.5">
                            {stationHistory.slice(0, 5).map((item) => {
                              const isExpanded = expandedHistoryId === item.id
                              const hasDetails = item.findings || item.photo_url || item.technician

                              return (
                                <div key={item.id} className="bg-slate-800/60 rounded-xl overflow-hidden">
                                  {/* Klickbar rubrikrad */}
                                  <button
                                    type="button"
                                    onClick={() => hasDetails && setExpandedHistoryId(isExpanded ? null : item.id)}
                                    aria-expanded={hasDetails ? isExpanded : undefined}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 text-xs text-left ${
                                      hasDetails ? 'hover:bg-slate-800 cursor-pointer' : 'cursor-default'
                                    }`}
                                  >
                                    <StatusDot status={item.status} />
                                    <span className="flex-1 min-w-0 truncate text-slate-200">
                                      {INSPECTION_STATUS_CONFIG[item.status]?.label || item.status}
                                      {item.measurement_value !== null && (() => {
                                        const histColor = getMeasurementColor(
                                          item.measurement_value,
                                          selectedStation?.station_type_data?.threshold_warning,
                                          selectedStation?.station_type_data?.threshold_critical,
                                          selectedStation?.station_type_data?.threshold_direction
                                        )
                                        const histColorClass = {
                                          green: 'text-green-400',
                                          amber: 'text-amber-400',
                                          red: 'text-red-400',
                                          default: 'text-slate-300'
                                        }[histColor]
                                        const u = unitShort(item.measurement_unit)
                                        return (
                                          <span className={`${histColorClass} font-mono`}>
                                            {', '}{item.measurement_value}{u ? (u === '%' ? '%' : ` ${u}`) : ''}
                                          </span>
                                        )
                                      })()}
                                      {item.technician && <span className="text-slate-500"> · {item.technician.name}</span>}
                                    </span>
                                    <span className="text-slate-500 tabular-nums">
                                      {new Date(item.inspected_at).toLocaleDateString('sv-SE')}
                                    </span>
                                    {hasDetails && (
                                      <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    )}
                                  </button>

                                  {/* Expanderad sektion */}
                                  {isExpanded && (
                                    <div className="px-2.5 pb-2.5 space-y-2 border-t border-slate-700/50">
                                      {item.findings && (
                                        <p className="text-xs text-slate-400 italic mt-2">
                                          "{item.findings}"
                                        </p>
                                      )}
                                      {item.photo_url && (
                                        <img
                                          src={item.photo_url}
                                          alt="Tidigare foto"
                                          className="w-24 h-24 object-cover rounded-lg mt-2 cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setLightboxPhoto(item.photo_url)
                                          }}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Ingen tidigare kontroll</p>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowHistory(true)}
                          className="w-full flex items-center gap-2 text-left text-xs text-slate-400 hover:text-slate-300 transition-colors"
                        >
                          {historyLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Laddar historik...
                            </>
                          ) : lastHistory ? (
                            <>
                              <StatusDot status={lastHistory.status} />
                              <span className="truncate">
                                Senast {new Date(lastHistory.inspected_at).toLocaleDateString('sv-SE')} · {statusText(lastHistory.status)}
                                {lastHistory.measurement_value !== null ? `, ${lastHistory.measurement_value}${unitShort(lastHistory.measurement_unit) ? ` ${unitShort(lastHistory.measurement_unit)}` : ''}` : ''}
                                {lastHistory.technician?.name ? ` · ${lastHistory.technician.name}` : ''}
                              </span>
                            </>
                          ) : (
                            <span>Ingen tidigare kontroll</span>
                          )}
                        </button>
                      )}

                      {/* Mätvärde med stora − och + runt ett numeriskt fält */}
                      {selectedStation.station_type_data?.measurement_label && (() => {
                        const stType = selectedStation.station_type_data
                        const selectedPrep = selectedPreparationId
                          ? preparations.find(p => p.id === selectedPreparationId) ?? null
                          : null
                        const usePreparationThresholds =
                          (stType as any)?.threshold_source === 'preparation' && selectedPrep
                        const activeThresholds = {
                          warning: usePreparationThresholds
                            ? (selectedPrep!.threshold_warning ?? stType?.threshold_warning ?? null)
                            : stType?.threshold_warning ?? null,
                          critical: usePreparationThresholds
                            ? (selectedPrep!.threshold_critical ?? stType?.threshold_critical ?? null)
                            : stType?.threshold_critical ?? null,
                          direction: usePreparationThresholds
                            ? (selectedPrep!.threshold_direction ?? stType?.threshold_direction ?? 'above')
                            : stType?.threshold_direction ?? 'above',
                          label: usePreparationThresholds
                            ? (selectedPrep!.measurement_label ?? stType?.measurement_label ?? null)
                            : stType?.measurement_label ?? null,
                        }

                        const numValue = measurementValue ? parseFloat(measurementValue) : null
                        const color = getMeasurementColor(
                          numValue,
                          activeThresholds.warning,
                          activeThresholds.critical,
                          activeThresholds.direction
                        )
                        const boxColorClass = {
                          green: 'border-green-500',
                          amber: 'border-amber-500',
                          red: 'border-red-500',
                          default: 'border-slate-700'
                        }[color]
                        const valueColorClass = {
                          green: 'text-green-400',
                          amber: 'text-amber-400',
                          red: 'text-red-400',
                          default: 'text-white'
                        }[color]
                        const unit = unitShort(stType.measurement_unit)
                        // Steg 5 för gram, annars 1 (st och övriga enheter)
                        const step = stType.measurement_unit === 'gram' ? 5 : 1
                        const bump = (dir: 1 | -1) => {
                          const cur = parseFloat(measurementValue)
                          const base = Number.isNaN(cur) ? 0 : cur
                          // Avrunda bara bort flyttalsbrus, behåll inmatade decimaler
                          const next = Math.max(0, Math.round((base + dir * step) * 1000) / 1000)
                          setMeasurementValue(String(next))
                        }
                        const inputId = `matt-${selectedStation.id}`

                        return (
                          <div className="space-y-2">
                            <label htmlFor={inputId} className="block text-[13px] font-medium text-slate-300">
                              {activeThresholds.label ?? stType.measurement_label}{unit && !String(activeThresholds.label ?? stType.measurement_label ?? '').includes(`(${unit})`) ? ` (${unit})` : ''}
                            </label>
                            <div className="flex items-stretch gap-2">
                              <button
                                type="button"
                                onClick={() => bump(-1)}
                                aria-label={`Minska med ${step}`}
                                className="w-16 h-[60px] flex-shrink-0 rounded-2xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center transition-colors"
                              >
                                <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                              </button>
                              <div className={`flex-1 min-w-0 h-[60px] rounded-2xl border bg-slate-950 flex items-center justify-center gap-1.5 px-2 focus-within:ring-1 focus-within:ring-[#20c58f] ${boxColorClass}`}>
                                <input
                                  id={inputId}
                                  type="number"
                                  inputMode="decimal"
                                  value={measurementValue}
                                  onChange={(e) => setMeasurementValue(e.target.value)}
                                  placeholder="0"
                                  step="any"
                                  min="0"
                                  className={`w-full min-w-0 bg-transparent border-0 p-0 text-center text-[28px] font-bold tabular-nums placeholder-slate-600 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${valueColorClass}`}
                                />
                                {unit && <span className="text-sm text-slate-400 flex-shrink-0">{unit}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => bump(1)}
                                aria-label={`Öka med ${step}`}
                                className="w-16 h-[60px] flex-shrink-0 rounded-2xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center transition-colors"
                              >
                                <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                              </button>
                            </div>
                            {/* Tröskelvärden */}
                            {(activeThresholds.warning != null || activeThresholds.critical != null) && (
                              <div className="flex items-center gap-4 text-xs">
                                {activeThresholds.warning != null && (
                                  <span className="text-amber-400">
                                    Varning: {activeThresholds.warning}
                                  </span>
                                )}
                                {activeThresholds.critical != null && (
                                  <span className="text-red-400">
                                    Kritisk: {activeThresholds.critical}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Preparatval: filtrerat efter stationstyp */}
                      {(() => {
                        const stationTypeId = selectedStation.station_type_data?.id
                        const filteredPreparations = preparations.filter(p =>
                          stationTypeId && p.station_type_ids?.length > 0 && p.station_type_ids.includes(stationTypeId)
                        )
                        if (filteredPreparations.length === 0) return null
                        return (
                          <div className="space-y-2">
                            <label htmlFor={`prep-${selectedStation.id}`} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-300">
                              <Beaker className="w-4 h-4" />
                              Preparat (valfritt)
                            </label>
                            <select
                              id={`prep-${selectedStation.id}`}
                              value={selectedPreparationId || ''}
                              onChange={(e) => setSelectedPreparationId(e.target.value || null)}
                              className="w-full h-12 bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                            >
                              <option value="">Inget preparat</option>
                              {(['biocidprodukt', 'giftfritt', 'desinfektionsmedel'] as const).map(cat => {
                                const catPreps = filteredPreparations.filter(p => p.category === cat)
                                if (catPreps.length === 0) return null
                                const catLabel = cat === 'biocidprodukt' ? 'Biocidprodukt' : cat === 'giftfritt' ? 'Giftfritt' : 'Desinfektionsmedel'
                                return (
                                  <optgroup key={cat} label={catLabel}>
                                    {catPreps.map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}{p.registration_number ? ` (${p.registration_number})` : ''}
                                      </option>
                                    ))}
                                  </optgroup>
                                )
                              })}
                            </select>
                            {selectedPreparationId && (() => {
                              const prep = preparations.find(p => p.id === selectedPreparationId)
                              if (!prep) return null
                              return (
                                <div className="text-xs text-slate-400 space-y-0.5">
                                  {prep.active_substances && <p>Verksamt ämne: {prep.active_substances}</p>}
                                  {prep.dosage && <p>Dosering: {prep.dosage}</p>}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })()}

                      {/* Foto och anteckning som två ikonrutor */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handlePhotoCapture}
                            aria-label={photoPreview ? 'Byt foto' : 'Ta foto'}
                            className={`h-14 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-[13px] transition-colors ${
                              photoPreview
                                ? 'border-[#20c58f] text-[#20c58f]'
                                : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white'
                            }`}
                          >
                            <Icon name="allman.foto" size={20} />
                            Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowNotesField(v => !v)}
                            aria-label="Anteckning"
                            aria-pressed={showNotesField}
                            className={`h-14 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-[13px] transition-colors ${
                              showNotesField || inspectionNotes
                                ? 'border-[#20c58f] text-[#20c58f]'
                                : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white'
                            }`}
                          >
                            <Icon name="allman.anteckning" size={20} />
                            Anteckning
                          </button>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />

                        {photoPreview && (
                          <div className="relative">
                            <img
                              src={photoPreview}
                              alt="Förhandsvisning"
                              className="w-full h-48 object-cover rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              aria-label="Ta bort fotot"
                              className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center bg-red-500 rounded-full text-[#fff] hover:bg-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {showNotesField && (
                          <textarea
                            value={inspectionNotes}
                            onChange={(e) => setInspectionNotes(e.target.value)}
                            placeholder="Beskriv eventuella fynd"
                            aria-label="Anteckning"
                            rows={3}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                          />
                        )}
                      </div>

                      {/* Hämta upp (tilläggsstation): kort förklaring och betald-framåt-varningen */}
                      {pickUpAfterSave && canPickUp && (
                        <div className="space-y-3">
                          <p className="flex gap-2.5 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-xs leading-relaxed text-violet-200">
                            <Icon name="station.hamtaupp" size={16} className="flex-shrink-0 mt-px" />
                            <span>
                              {(selectedStation.addon_billing_model ?? 'per_round') === 'per_round'
                                ? 'Stationen tas bort när du sparar. Den faktureras en sista gång i den här rundan.'
                                : 'Stationen tas bort när du sparar. Den slutar räknas vid nästa debitering.'}
                            </span>
                          </p>
                          <AddonRemovalNotice guard={pickupGuard} />
                        </div>
                      )}

                    </div>{/* Slut på scrollbart innehåll */}

                    {/* Fot: bara Spara. Med Hämta upp heter knappen Spara och hämta upp;
                        är stationen betald framåt krävs ett andra tryck (Ta bort ändå) */}
                    {canEdit && (
                      <div className="border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-4 flex flex-col gap-2.5">
                        {pickupGuard.armed && (
                          <p className="text-sm text-amber-400 text-center">
                            Tryck en gång till för att spara och ta bort stationen
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveInspection}
                          disabled={isSubmitting}
                          className={`w-full h-[52px] rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                            pickupGuard.armed
                              ? 'bg-amber-500 hover:bg-amber-400 text-[#1c1003]'
                              : pickUpAfterSave
                                ? 'bg-violet-400 hover:bg-violet-300 text-[#04140d]'
                                : 'bg-[#20c58f] hover:bg-[#1bb07f] text-[#04140d]'
                          }`}
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Icon name="station.ok" size={20} />
                          )}
                          {pickupGuard.armed ? 'Ta bort ändå' : pickUpAfterSave ? 'Spara och hämta upp' : 'Spara'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>)}

      {/* Inbyggd bekräftelse (bara inbäddat läge, ersätter window.confirm) */}
      {embedded && renderOverlay(<AnimatePresence>
        {confirmState && (
          <motion.div
            key="panel-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${lightboxZ} bg-black/50 flex items-center justify-center p-4`}
            onClick={() => closeConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role="alertdialog"
              aria-modal="true"
              className="bg-slate-800 rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Fortsätta?</h3>
              </div>
              <p className="text-slate-300 text-sm mb-4">{confirmState.message}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => closeConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => closeConfirm(true)}
                  className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-[#fff] rounded-lg font-medium transition-colors"
                >
                  Fortsätt ändå
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>)}
    </motion.div>
  )
}
