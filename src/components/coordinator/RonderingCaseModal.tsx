// src/components/coordinator/RonderingCaseModal.tsx
// Modal för "Rondering Trafikkontoret" — egenkontrollprogram med stationsavbockning

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, Building, Building2, Calendar, Save, Check, Map, MapPin,
  CheckSquare, Square, AlertTriangle, MessageSquare, History,
  Trash2, FileText, Users, User, Phone, Mail, ChevronDown,
  Footprints, Clock, Plus, ExternalLink, Copy
} from 'lucide-react'
import { Icon as SvgIcon } from '../icons/Icon'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import { sluttidForeStart, SLUTTID_FORE_START_FEL } from '../../utils/besokstid'
import { DROPDOWN_STATUSES } from '../../types/database'
import WorkReportDropdown from '../shared/WorkReportDropdown'
import { useModernWorkReportGeneration } from '../../hooks/useModernWorkReportGeneration'
import { toLocalISOStringWithOffset, fromDatabaseDate } from '../../utils/dateHelpers'
import CaseImageGallery, { CaseImageGalleryRef } from '../shared/CaseImageGallery'
import CommunicationSlidePanel from '../communication/CommunicationSlidePanel'
import { CaseType } from '../../types/communication'
import VisitHistoryPanel from './VisitHistoryPanel'
import DeleteCaseConfirmDialog from '../shared/DeleteCaseConfirmDialog'
import { RonderingService, RonderingStationLog, RonderingStationStatus, RonderingAnnotation } from '../../services/ronderingService'
import { EquipmentService } from '../../services/equipmentService'
import RonderingMapSection from './RonderingMapSection'
// Kopiera/duplicera ärende
import DuplicateCaseDialog from '../shared/DuplicateCaseDialog'
import { CaseNumberService } from '../../services/caseNumberService'
// Fakturering + provision (samma flöde som EditContractCaseModal)
import CaseServiceSelector from '../shared/CaseServiceSelector'
import CaseSpecialReportsSection from '../shared/specialReports/CaseSpecialReportsSection'
import { useOsparatArende } from '../shared/specialReports/specialReportUtils'
import CommissionSection from '../shared/CommissionSection'
import { ProvisionService } from '../../services/provisionService'
import { CaseBillingService } from '../../services/caseBillingService'
import { ContractBillingService } from '../../services/contractBillingService'
import type { TechnicianShare } from '../../types/provision'
import type { CaseBillingSummary, CaseBillingItemWithRelations } from '../../types/caseBilling'
import { selectInvoiceableCaseRows, sumInvoiceableRows } from '../../shared/caseInvoiceRows'
// Nya arbetsvyn (stegflödet). Allt nedan används bara när useNyArbetsvy().aktiv är true.
import { useNyArbetsvy } from '../../hooks/useNyArbetsvy'
import { StegRad, StegKnappar } from '../technician/ny/steg/StegFlode'
import { ArendeVerktygArk, type ArendeVerktygGrupp } from '../technician/ny/steg/ArendeVerktygArk'
import { KlartSteg } from '../technician/ny/steg/KlartSteg'
import { useStegForArende, grannSteg, formateraKr, type StegId } from '../technician/ny/steg/stegKonfig'
import { HjalpText } from '../technician/ny/hjalp/HjalpText'
import { kontrolleraAvslut, type AvslutsHinder } from '../../services/arendeAvslutService'

registerLocale('sv', sv)

interface RonderingCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  caseData: any
}

interface Station {
  id: string
  serial_number: string | null
  comment: string | null
  latitude: number
  longitude: number
  status: string
}

const STATUS_LABEL: Record<RonderingStationStatus, string> = {
  ok: 'OK',
  action_required: 'Åtgärd krävs',
  missing: 'Saknas',
}

const STATUS_COLOR: Record<RonderingStationStatus, string> = {
  ok: 'text-emerald-400',
  action_required: 'text-amber-400',
  missing: 'text-red-400',
}

const STATUS_BG: Record<RonderingStationStatus, string> = {
  ok: 'bg-emerald-500/20 border-emerald-500/30',
  action_required: 'bg-amber-500/20 border-amber-500/30',
  missing: 'bg-red-500/20 border-red-500/30',
}

const BAIT_LABEL: Record<'all' | 'partial' | 'none', string> = {
  all: 'Allt',
  partial: 'Delvis',
  none: 'Inget',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

/** Fält som användaren redigerar och som räknas som osparade ändringar (3.56.0) */
const OSPARAT_FALT = [
  'description', 'status', 'contact_person', 'contact_phone', 'contact_email',
  'scheduled_start', 'scheduled_end', 'primary_technician_id', 'secondary_technician_id',
  'tertiary_technician_id', 'work_report',
] as const

// ─── AddSubVisitModal ────────────────────────────────────────────────────────

interface AddSubVisitModalProps {
  parentCase: any
  technicians: any[]
  onClose: () => void
  onCreated: (newCase: any) => void
}

function AddSubVisitModal({ parentCase, technicians, onClose, onCreated }: AddSubVisitModalProps) {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [technicianId, setTechnicianId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [conflicts, setConflicts] = useState<{ title: string; scheduled_start: string; scheduled_end: string }[]>([])
  const [loadingConflicts, setLoadingConflicts] = useState(false)

  const selectedTech = technicians.find(t => t.id === technicianId)
  const workSchedule = selectedTech?.work_schedule as Record<string, { start: string; end: string; active: boolean }> | null | undefined

  const JS_TO_DAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const DAY_LABELS: Record<string, string> = {
    monday: 'Mån', tuesday: 'Tis', wednesday: 'Ons',
    thursday: 'Tor', friday: 'Fre', saturday: 'Lör', sunday: 'Sön',
  }
  const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  const dayKey = startDate ? JS_TO_DAY[startDate.getDay()] : null
  const daySchedule = dayKey ? workSchedule?.[dayKey] : null
  const isWorkingDay = daySchedule?.active ?? false

  const toTimeDate = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(); d.setHours(h, m, 0, 0); return d
  }
  const minTime = isWorkingDay ? toTimeDate(daySchedule!.start) : toTimeDate('00:00')
  const maxTime = isWorkingDay ? toTimeDate(daySchedule!.end) : toTimeDate('23:59')

  useEffect(() => {
    if (!technicianId || !startDate) { setConflicts([]); return }
    const dayStart = new Date(startDate); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(startDate); dayEnd.setHours(23, 59, 59, 999)
    setLoadingConflicts(true)
    supabase
      .from('cases')
      .select('title, scheduled_start, scheduled_end')
      .eq('primary_technician_id', technicianId)
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString())
      .not('status', 'in', '("Avslutat","Borttaget")')
      .then(({ data }) => {
        setConflicts((data || []).filter(c => c.scheduled_start && c.scheduled_end))
        setLoadingConflicts(false)
      })
  }, [technicianId, startDate?.toDateString()])

  const { profile: creatorProfile } = useAuth()

  const handleSave = async () => {
    if (!startDate) {
      toast.error('Välj ett startdatum')
      return
    }
    if (sluttidForeStart(startDate, endDate)) {
      toast.error(SLUTTID_FORE_START_FEL)
      return
    }

    setSaving(true)
    try {
      const caseNumber = `RON-DEL-${Date.now().toString(36).toUpperCase()}`

      const { data, error } = await supabase
        .from('cases')
        .insert({
          customer_id: parentCase.customer_id,
          service_type: parentCase.service_type || 'rondering_trafikkontoret',
          parent_case_id: parentCase.id,
          status: 'Bokad',
          scheduled_start: toLocalISOStringWithOffset(startDate),
          scheduled_end: endDate ? toLocalISOStringWithOffset(endDate) : null,
          primary_technician_id: selectedTech?.id || null,
          primary_technician_name: selectedTech?.name || null,
          title: `${parentCase.title || 'Rondering'} – Delbesök`,
          case_number: caseNumber,
          description: note || null,
          // RLS: skaparen behöver läsrätt på raden när delbesöket
          // tilldelas en kollega (.select() kräver SELECT-policy på nya raden)
          created_by_technician_id: creatorProfile?.technician_id || null,
          created_by_technician_name: creatorProfile?.display_name || null,
        })
        .select()
        .single()

      if (error) throw error
      toast.success('Delbesök skapat')
      onCreated(data)
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte skapa delbesök')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10001, pointerEvents: 'auto' }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Footprints className="w-4 h-4 text-[#20c58f]" />
            Lägg till delbesök
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Startdatum och tid *</label>
              <DatePicker
                selected={startDate}
                onChange={setStartDate}
                showTimeSelect
                dateFormat="yyyy-MM-dd HH:mm"
                locale="sv"
                placeholderText="Välj datum och tid"
                minTime={selectedTech ? minTime : undefined}
                maxTime={selectedTech ? maxTime : undefined}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-[#20c58f]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Sluttid</label>
              <DatePicker
                selected={endDate}
                onChange={setEndDate}
                showTimeSelect
                dateFormat="yyyy-MM-dd HH:mm"
                locale="sv"
                placeholderText="Valfritt"
                minDate={startDate || undefined}
                minTime={selectedTech ? minTime : undefined}
                maxTime={selectedTech ? maxTime : undefined}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-[#20c58f]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Tekniker</label>
            <select
              value={technicianId}
              onChange={e => setTechnicianId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-[#20c58f]"
            >
              <option value="">— Välj tekniker —</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTech && (
              <div className="mt-1.5 grid grid-cols-7 gap-1">
                {DAY_ORDER.map(day => {
                  const d = workSchedule?.[day]
                  const active = d?.active ?? false
                  return (
                    <div key={day} className={`flex flex-col items-center px-1 py-1.5 rounded-lg text-center ${
                      active ? 'bg-[#20c58f]/10 border border-[#20c58f]/30' : 'bg-slate-800/30 border border-slate-700/30'
                    }`}>
                      <span className={`text-[10px] font-medium ${active ? 'text-[#20c58f]' : 'text-slate-500'}`}>
                        {DAY_LABELS[day]}
                      </span>
                      {active ? (
                        <span className="text-[9px] text-slate-300 leading-tight mt-0.5">
                          {d!.start}<br />{d!.end}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-600 mt-0.5">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {startDate && selectedTech && !isWorkingDay && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-xs text-amber-300">
                {DAY_LABELS[dayKey!]} är inte en arbetsdag för {selectedTech.name}
              </span>
            </div>
          )}
          {!loadingConflicts && conflicts.length > 0 && (
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300 font-medium">
                  {selectedTech?.name} har {conflicts.length} bokning{conflicts.length > 1 ? 'ar' : ''} denna dag
                </span>
              </div>
              {conflicts.map((c, i) => (
                <div key={i} className="ml-5 text-xs text-amber-400/80">
                  {c.title} — {new Date(c.scheduled_start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}–{new Date(c.scheduled_end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Anteckning</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Valfri anteckning om delbesöket..."
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-[#20c58f]"
            />
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Avbryt
          </button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || !startDate}
          >
            {saving ? 'Sparar...' : 'Skapa delbesök'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RonderingCaseModal({
  isOpen,
  onClose,
  onSuccess,
  caseData,
}: RonderingCaseModalProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [customerData, setCustomerData] = useState<any>(null)
  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    description: '',
    status: 'Öppen',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    scheduled_start: null as Date | null,
    scheduled_end: null as Date | null,
    primary_technician_id: '',
    primary_technician_name: '',
    secondary_technician_id: '',
    secondary_technician_name: '',
    tertiary_technician_id: '',
    tertiary_technician_name: '',
    work_report: '',
  })

  const [technicians, setTechnicians] = useState<any[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [stationLogs, setStationLogs] = useState<RonderingStationLog[]>([])
  const [annotations, setAnnotations] = useState<RonderingAnnotation[]>([])
  const [loadingStations, setLoadingStations] = useState(false)
  const [stationSearch, setStationSearch] = useState('')
  const stationListRef = useRef<HTMLDivElement>(null)

  // Förhindra dubbelklick — håller reda på vilka stationer som håller på att processas
  const [pendingStations, setPendingStations] = useState<Set<string>>(new Set())

  // Status-meny per station
  const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ stationId: string; logId: string; currentNote: string } | null>(null)

  // Beteåtgång-dialog — visas när tekniker bockar i en station
  const [baitDialog, setBaitDialog] = useState<{ station: Station } | null>(null)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false)
  const [showVisitHistoryPanel, setShowVisitHistoryPanel] = useState(false)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [showAddSubVisit, setShowAddSubVisit] = useState(false)
  const [subVisits, setSubVisits] = useState<any[]>([])
  const [nestedSubVisit, setNestedSubVisit] = useState<any | null>(null)

  // Kopiera (följeärende) + duplicera
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  // Nollställ alla overlay/dialog-states när modalen stängs. Modalen förblir
  // monterad i föräldern (styrs via isOpen-prop) så kvarglömda flaggor skulle
  // annars auto-öppna overlays när nästa ärende öppnas.
  useEffect(() => {
    if (!isOpen) {
      setOpenStatusMenu(null)
      setNoteModal(null)
      setBaitDialog(null)
      setShowDeleteDialog(false)
      setShowCommunicationPanel(false)
      setShowVisitHistoryPanel(false)
      setShowActionDialog(false)
      setShowAddSubVisit(false)
      setNestedSubVisit(null)
      setShowFollowUpDialog(false)
      setShowDuplicateDialog(false)
    }
  }, [isOpen])

  // Provision (samma mönster som EditContractCaseModal)
  const [commissionEligible, setCommissionEligible] = useState(false)
  const [billingSummary, setBillingSummary] = useState<CaseBillingSummary | null>(null)
  // Det som faktureras utöver avtalet när ärendet stängs: samma urval som
  // createAdHocItemsFromCase (tjänsterader med belopp som inte täcks av avtalet).
  // Används bara av texterna i nya arbetsvyn.
  const [utoverAvtaletKr, setUtoverAvtaletKr] = useState(0)
  const handleBillingSummaryChange = useCallback(
    (items: CaseBillingItemWithRelations[], summary: CaseBillingSummary) => {
      setBillingSummary(summary)
      setUtoverAvtaletKr(sumInvoiceableRows(selectInvoiceableCaseRows(items || [], 'contract_adhoc')))
    }, []
  )
  const [commissionShares, setCommissionShares] = useState<TechnicianShare[]>([])
  const [commissionDeductions, setCommissionDeductions] = useState(0)
  const [commissionNotes, setCommissionNotes] = useState('')
  const [existingCommissionPosts, setExistingCommissionPosts] = useState(0)
  const [commissionPostsLocked, setCommissionPostsLocked] = useState(false)

  // Ursprunglig status — skyddar mot dubbel billing/provision vid upprepade sparningar
  // (modalen förblir öppen efter spara, caseData-proppen refreshas inte)
  const originalStatusRef = useRef<string>(caseData?.status || 'Öppen')

  // Auto-sätt avdrag från underleverantörsartiklar
  useEffect(() => {
    if (billingSummary && existingCommissionPosts === 0) {
      setCommissionDeductions(billingSummary.subcontractor_total)
    }
  }, [billingSummary?.subcontractor_total, existingCommissionPosts])

  // Om detta är ett delbesök skrivs stationsloggar mot parent_case_id
  const logCaseId = caseData?.parent_case_id ?? caseData?.id
  const [parentCaseNumber, setParentCaseNumber] = useState<string | null>(null)
  const [imageRefreshTrigger, setImageRefreshTrigger] = useState(0)
  const [hasPendingImageChanges, setHasPendingImageChanges] = useState(false)
  const imageGalleryRef = useRef<CaseImageGalleryRef>(null)
  // 3.56.0: osparade ändringar innan en specialrapport öppnas (fälten användaren redigerar)
  const { markeraSparat, harOsparat } = useOsparatArende(formData, OSPARAT_FALT)
  const sparatOkRef = useRef(false)

  const reportData = {
    ...(caseData || {}),
    case_type: 'contract' as const,
    rapport: formData.work_report,
    kontaktperson: formData.contact_person,
    telefon_kontaktperson: formData.contact_phone,
    e_post_kontaktperson: formData.contact_email,
    primary_assignee_name: formData.primary_technician_name,
    scheduled_start: formData.scheduled_start?.toISOString() ?? null,
  }

  const {
    downloadReport, sendToTechnician, sendToContact,
    isGenerating, canGenerateReport,
    totalReports, hasRecentReport, currentReport, getTimeSinceReport
  } = useModernWorkReportGeneration(reportData)

  // ═══════════════════════════════════════════════════════════════════════════
  // NYA ARBETSVYN: stegflödet. Gäller bara när useNyArbetsvy().aktiv är true
  // (profiles.ny_arbetsvy och teknikervyn). Annars används inget av detta och
  // modalen ser ut och beter sig som tidigare. Stegen visar samma sektioner
  // (samma JSX, samma handlers, samma handleSubmit); inget sparas på något annat sätt.
  // ═══════════════════════════════════════════════════════════════════════════
  const { aktiv: nyArbetsvy } = useNyArbetsvy()
  // 'steg' = stegflödet, 'flikar' = den vanliga långa vyn (Alla uppgifter)
  const [visning, setVisning] = useState<'steg' | 'flikar'>('steg')
  const stegLage = nyArbetsvy && visning === 'steg'
  const [aktivtSteg, setAktivtSteg] = useState<StegId>('framme')
  const [hinderSteg, setHinderSteg] = useState<StegId[]>([])
  const [visaVerktyg, setVisaVerktyg] = useState(false)
  const [stegUpptaget, setStegUpptaget] = useState(false)
  // Avvikelsekartan monteras först när den syns (Google Maps i en dold ruta får fel zoom), sedan hålls den monterad
  const [kartaVisad, setKartaVisad] = useState(false)
  const innehallRef = useRef<HTMLDivElement>(null)
  // Nya arbetsvyn: sparningar mellan stegen meddelas föräldern först när modalen stängs,
  // annars stänger föräldern modalen (OppnaArende) eller läser in ärendet på nytt mitt i flödet
  const sparatIPassetRef = useRef(false)
  const stegLista = useStegForArende('rondering')

  const handleClose = useCallback(() => {
    if (hasPendingImageChanges && imageGalleryRef.current) {
      imageGalleryRef.current.commitChanges().catch(err => console.error('Kunde inte spara bilder vid stängning:', err))
    }
    // Bara nya arbetsvyn sätter flaggan (se handleSubmit)
    if (sparatIPassetRef.current) {
      sparatIPassetRef.current = false
      // Samma anrop som handleSubmit gör i gamla läget (ärendet skickas med, föräldrarna läser det)
      ;(onSuccess as ((arende?: unknown) => void) | undefined)?.(caseData)
    }
    onClose()
  }, [onClose, hasPendingImageChanges, onSuccess, caseData])

  // Ladda kunddata, tekniker och stationer
  useEffect(() => {
    if (!isOpen || !caseData) return

    const load = async () => {
      // Formdata
      const init = {
        case_number: caseData.case_number || caseData.title || '',
        title: caseData.title || '',
        description: caseData.description || '',
        status: caseData.status || 'Öppen',
        contact_person: caseData.contact_person || '',
        contact_phone: caseData.contact_phone || '',
        contact_email: caseData.contact_email || '',
        scheduled_start: fromDatabaseDate(caseData.scheduled_start),
        scheduled_end: fromDatabaseDate(caseData.scheduled_end),
        primary_technician_id: caseData.primary_technician_id || '',
        primary_technician_name: caseData.primary_technician_name || '',
        secondary_technician_id: caseData.secondary_technician_id || '',
        secondary_technician_name: caseData.secondary_technician_name || '',
        tertiary_technician_id: caseData.tertiary_technician_id || '',
        tertiary_technician_name: caseData.tertiary_technician_name || '',
        work_report: caseData.work_report || '',
      }
      setFormData(init)
      markeraSparat(init)

      // Provision-init (samma mönster som EditContractCaseModal)
      originalStatusRef.current = caseData.status || 'Öppen'
      setCommissionEligible(caseData.is_commission_eligible || false)
      setCommissionShares([])
      setCommissionDeductions(0)
      setCommissionNotes('')
      ProvisionService.getPostsByCase(caseData.id)
        .then(posts => {
          setExistingCommissionPosts(posts.length)
          setCommissionPostsLocked(posts.some(p => p.status !== 'pending_invoice'))
        })
        .catch(() => {
          setExistingCommissionPosts(0)
          setCommissionPostsLocked(false)
        })

      // Kunddata
      if (caseData.customer_id) {
        // Hämta även huvudkontoret (parent) så enheter kan ärva org.nr när eget saknas
        const { data: customer } = await supabase
          .from('customers')
          .select('*, parent:parent_customer_id(company_name, organization_number)')
          .eq('id', caseData.customer_id)
          .single()
        setCustomerData(customer)
      }

      // Tekniker
      const { data: techs } = await supabase.from('technicians').select('*').eq('is_active', true).order('name')
      setTechnicians(techs || [])

      // Stationer för regionen
      setLoadingStations(true)
      try {
        const placements = await EquipmentService.getEquipmentByCustomer(caseData.customer_id)
        const active = placements
          .filter(p => p.status === 'active')
          .map(p => ({
            id: p.id,
            serial_number: p.serial_number,
            comment: p.comment,
            latitude: p.latitude,
            longitude: p.longitude,
            status: p.status,
          }))
          .sort((a, b) => {
            const na = parseInt(a.serial_number || '0', 10)
            const nb = parseInt(b.serial_number || '0', 10)
            return na - nb
          })
        setStations(active)
      } catch (e) {
        console.error('Kunde inte ladda stationer:', e)
      } finally {
        setLoadingStations(false)
      }

      // Loggar och annotationer hämtas från logCaseId (parent om delbesök, annars eget id)
      const effectiveLogCaseId = caseData.parent_case_id ?? caseData.id
      const [logs, anns] = await Promise.all([
        RonderingService.getLogsForCase(effectiveLogCaseId),
        RonderingService.getAnnotationsForCase(effectiveLogCaseId),
      ])
      setStationLogs(logs)
      setAnnotations(anns)

      // Hämta förälderns case_number om detta är ett delbesök
      if (caseData.parent_case_id) {
        const { data: parent } = await supabase
          .from('cases')
          .select('case_number')
          .eq('id', caseData.parent_case_id)
          .single()
        setParentCaseNumber(parent?.case_number ?? null)
      }

      // Ladda delbesök (bara för originalärenden). Filtrera på RON-DEL-nummer
      // så följeärenden/dubbletter (som också har parent_case_id) inte listas här.
      if (!caseData.parent_case_id) {
        const { data: subs } = await supabase
          .from('cases')
          .select('id, title, scheduled_start, scheduled_end, status, primary_technician_name')
          .eq('parent_case_id', caseData.id)
          .like('case_number', 'RON-DEL-%')
          .order('scheduled_start')
        setSubVisits(subs || [])
      }
    }

    load()
  }, [isOpen, caseData])

  // Spara ändringar
  const handleSubmit = async () => {
    sparatOkRef.current = false
    if (sluttidForeStart(formData.scheduled_start, formData.scheduled_end)) {
      toast.error(SLUTTID_FORE_START_FEL)
      return
    }
    // SPÄRR: rabattrader utan motivering blockerar avslut. Körs FÖRE alla
    // skrivningar (statusändring, ad-hoc-fakturering, provision).
    // Avtalstilläggsrader räknas inte som rabatt (exkluderas i servicen).
    if (formData.status === 'Avslutat' && originalStatusRef.current !== 'Avslutat') {
      try {
        const unmotivated = await CaseBillingService.getUnmotivatedDiscountItems(caseData.id)
        if (unmotivated.length > 0) {
          const names = unmotivated.map(i => `${i.name} (-${i.discount_percent}%)`).join(', ')
          toast.error(
            `Motivera rabatten på ${names} under Tjänster & fakturarader innan ärendet avslutas`,
            { duration: 8000 }
          )
          return
        }
        // Avtalat material (artiklar med kundpris) måste vara mappat mot en tjänst,
        // annars faktureras det aldrig utan försvinner som intern kostnad.
        const unmappedPriced = await CaseBillingService.getUnmappedCustomerPricedArticles(caseData.id)
        if (unmappedPriced.length > 0) {
          toast.error(
            `${unmappedPriced.map(u => `${u.quantity} st ${u.name}`).join(', ')} har kundpris men ingen tjänst att faktureras på. Mappa dem mot en tjänst i prisguiden först.`,
            { duration: 8000 }
          )
          return
        }
      } catch (guardError: any) {
        toast.error(`Kunde inte kontrollera rabattmotiveringar: ${guardError.message}`)
        return
      }
    }

    setLoading(true)
    try {
      const { data: updatedRows, error } = await supabase
        .from('cases')
        .update({
          description: formData.description || null,
          status: formData.status,
          contact_person: formData.contact_person || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          scheduled_start: formData.scheduled_start ? formData.scheduled_start.toISOString() : null,
          scheduled_end: formData.scheduled_end ? formData.scheduled_end.toISOString() : null,
          primary_technician_id: formData.primary_technician_id || null,
          primary_technician_name: formData.primary_technician_name || null,
          secondary_technician_id: formData.secondary_technician_id || null,
          secondary_technician_name: formData.secondary_technician_name || null,
          tertiary_technician_id: formData.tertiary_technician_id || null,
          tertiary_technician_name: formData.tertiary_technician_name || null,
          work_report: formData.work_report || null,
          is_commission_eligible: commissionEligible,
        })
        .eq('id', caseData.id)
        .select('id')

      if (error) throw error
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('Inga rader uppdaterades — behörighet kan saknas. Fakturering och provision avbröts.')
      }

      const justCompleted = formData.status === 'Avslutat' && originalStatusRef.current !== 'Avslutat'

      // AD-HOC BILLING: kopiera artiklar till avtalsfakturering vid ärendeavslut
      // (samma flöde som EditContractCaseModal)
      let billingItemsCreated = 0
      if (justCompleted && caseData.customer_id) {
        try {
          const hasBillingItems = await CaseBillingService.caseHasBillingItems(caseData.id, 'contract')
          if (hasBillingItems) {
            const result = await ContractBillingService.createAdHocItemsFromCase(
              caseData.id,
              caseData.customer_id,
              new Date()
            )
            billingItemsCreated = result.created
            if (result.invoiceError) {
              toast.error(`Ärendet sparades men fakturan kunde inte skapas: ${result.invoiceError}. Raderna ligger kvar ofakturerade - kontakta admin.`, { duration: 10000 })
            }
          }
        } catch (billingError: any) {
          console.warn('[RonderingCaseModal] Kunde inte skapa ad-hoc billing:', billingError)
          toast.error(`Ad-hoc fakturering misslyckades: ${billingError.message}`)
        }
      }

      // PROVISION: skapa provisionsposter vid avslut om provisionsgrundande
      let commissionCreated = false
      if (justCompleted && commissionEligible && commissionShares.length > 0 && existingCommissionPosts === 0) {
        try {
          const casePrice = billingSummary?.subtotal || 0
          await ProvisionService.createPostsForCase(
            {
              case_id: caseData.id,
              case_type: 'contract',
              case_title: formData.title || caseData.title,
              case_number: formData.case_number || caseData.case_number,
              base_amount: casePrice,
            },
            commissionShares,
            commissionDeductions,
            commissionNotes || undefined
          )
          commissionCreated = true
          setExistingCommissionPosts(commissionShares.length)
        } catch (commErr: any) {
          console.warn('[RonderingCaseModal] Provision kunde inte skapas:', commErr)
          toast.error(`Provision: ${commErr.message}`)
        }
      }

      // Uppdatera ursprungsstatus så upprepade sparningar inte dubblerar billing/provision
      originalStatusRef.current = formData.status

      if (billingItemsCreated > 0 && commissionCreated) {
        toast.success(`Ärende avslutat! ${billingItemsCreated} artikel(er) till fakturering + provision skapad.`)
      } else if (billingItemsCreated > 0) {
        toast.success(`Ärende avslutat! ${billingItemsCreated} artikel(er) skickade till fakturering.`)
      } else if (commissionCreated) {
        toast.success('Ärende avslutat och provision skapad!')
      }

      setShowSaveSuccess(true)
      setTimeout(() => setShowSaveSuccess(false), 2000)
      sparatOkRef.current = true
      markeraSparat(formData)
      // Nya arbetsvyn: modalen stannar öppen mellan stegen, föräldern får veta det när modalen stängs
      if (nyArbetsvy) sparatIPassetRef.current = true
      else onSuccess?.(caseData)
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte spara')
    } finally {
      setLoading(false)
    }
  }

  // Skapa följeärende (kopiera till nytt ärende hos samma kund).
  // OBS: ingen parent_case_id — i ronderingskontext betyder parent_case_id
  // "delbesök" (delade stationsloggar), vilket ett följeärende inte är.
  const handleCreateFollowUpCase = async () => {
    setFollowUpLoading(true)
    try {
      const newCaseNumber = await CaseNumberService.generateCaseNumber()
      const { error } = await supabase
        .from('cases')
        .insert({
          case_number: newCaseNumber,
          title: `Följeärende: ${customerData?.company_name || formData.contact_person || 'Kund'}`,
          description: `Följeärende skapat från ${formData.case_number}.\n\nUrsprungligt ärende: ${formData.title || caseData?.title || 'Ej angivet'}`,
          status: 'Bokad',
          customer_id: caseData?.customer_id || null,
          contact_person: formData.contact_person || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          primary_technician_id: formData.primary_technician_id || null,
          primary_technician_name: formData.primary_technician_name || null,
          secondary_technician_id: formData.secondary_technician_id || null,
          secondary_technician_name: formData.secondary_technician_name || null,
          tertiary_technician_id: formData.tertiary_technician_id || null,
          tertiary_technician_name: formData.tertiary_technician_name || null,
          created_by_technician_id: profile?.technician_id || null,
          created_by_technician_name: profile?.display_name || null,
          created_date: new Date().toISOString(),
        })

      if (error) throw error

      toast.success(`Följeärende ${newCaseNumber} skapat!`)
      setShowFollowUpDialog(false)
      onSuccess?.()
    } catch (err: any) {
      console.error('Kunde inte skapa följeärende:', err)
      toast.error(err.message || 'Kunde inte skapa följeärende')
    } finally {
      setFollowUpLoading(false)
    }
  }

  // Bocka av / avbocka station
  const toggleStation = async (station: Station) => {
    if (pendingStations.has(station.id)) return

    const existing = stationLogs.find(l => l.station_id === station.id)
    if (existing) {
      // Avbocka — ta bort direkt utan dialog
      setPendingStations(prev => new Set(prev).add(station.id))
      setStationLogs(prev => prev.filter(l => l.station_id !== station.id))
      try {
        await RonderingService.removeLog(logCaseId, station.id)
      } catch {
        setStationLogs(prev => [...prev, existing])
        toast.error('Kunde inte ta bort avbockning')
      } finally {
        setPendingStations(prev => { const next = new Set(prev); next.delete(station.id); return next })
      }
    } else {
      // Bocka av — öppna beteåtgång-dialog
      setBaitDialog({ station })
    }
  }

  // Bekräfta avbockning med beteåtgång
  const confirmBait = async (baitConsumed: 'all' | 'partial' | 'none') => {
    if (!baitDialog) return
    const { station } = baitDialog
    setBaitDialog(null)
    setPendingStations(prev => new Set(prev).add(station.id))

    const optimistic: RonderingStationLog = {
      id: `tmp-${station.id}`,
      case_id: logCaseId,
      station_id: station.id,
      inspected_at: new Date().toISOString(),
      technician_id: profile?.technician_id || null,
      technician_name: profile?.full_name || null,
      status: 'ok',
      bait_consumed: baitConsumed,
      note: null,
      created_at: new Date().toISOString(),
    }
    setStationLogs(prev => [...prev, optimistic])
    try {
      const real = await RonderingService.logStation(
        logCaseId,
        station.id,
        profile?.technician_id || null,
        profile?.full_name || null,
        'ok',
        baitConsumed
      )
      setStationLogs(prev => prev.map(l => l.id === optimistic.id ? real : l))
    } catch {
      setStationLogs(prev => prev.filter(l => l.id !== optimistic.id))
      toast.error('Kunde inte logga inspektion')
    } finally {
      setPendingStations(prev => { const next = new Set(prev); next.delete(station.id); return next })
    }
  }

  // Ändra status på en avbockad station
  const changeStationStatus = async (log: RonderingStationLog, newStatus: RonderingStationStatus) => {
    setStationLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: newStatus } : l))
    setOpenStatusMenu(null)
    try {
      await RonderingService.updateLogStatus(log.id, newStatus, log.note || undefined)
    } catch {
      setStationLogs(prev => prev.map(l => l.id === log.id ? log : l))
      toast.error('Kunde inte uppdatera status')
    }
  }

  const inspectedCount = stationLogs.length
  const actionRequiredCount = stationLogs.filter(l => l.status === 'action_required').length
  const missingCount = stationLogs.filter(l => l.status === 'missing').length

  const filteredStations = stations.filter(s => {
    if (!stationSearch.trim()) return true
    const q = stationSearch.toLowerCase()
    return (
      s.serial_number?.toLowerCase().includes(q) ||
      s.comment?.toLowerCase().includes(q)
    )
  })

  const isSubVisit = !!caseData?.parent_case_id
  const modalTitle = (
    <div className="flex items-center gap-2">
      {isSubVisit
        ? <span>{parentCaseNumber ?? '...'} – Delbesök</span>
        : <span>Ärende: {formData.case_number || 'Laddar...'}</span>
      }
      <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
        <Map className="w-3 h-3" />
        Rondering Trafikkontoret
      </span>
    </div>
  )

  // Sparar ärendet och väntande bildändringar. Används av specialrapporterna och
  // nya arbetsvyns steg. true = allt sparat.
  const sparaArendeOchBilder = async (): Promise<boolean> => {
    await handleSubmit()
    if (!sparatOkRef.current) return false
    if (imageGalleryRef.current?.hasPendingChanges()) {
      const bilder = await imageGalleryRef.current.commitChanges()
      if (!bilder.success) {
        toast.error('Ärendet sparades men några bildändringar kunde inte sparas')
        return false
      }
    }
    return true
  }

  // ═══ Nya arbetsvyn: delarna som bara renderas när nyArbetsvy är true ═══

  // Startsteg: avslutat ärende öppnas i Klart, annars Framme
  useEffect(() => {
    if (!isOpen || !nyArbetsvy || !caseData?.id) return
    setVisning('steg')
    setVisaVerktyg(false)
    setHinderSteg([])
    setKartaVisad(false)
    sparatIPassetRef.current = false
    setAktivtSteg(caseData.status === 'Avslutat' ? 'klart' : 'framme')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nyArbetsvy, caseData?.id])

  // Hela ärendet i steget Klart: status Avslutat och sedan den vanliga
  // handleSubmit (som själv kör rabatt- och kundprisspärrarna, ad-hoc-faktureringen
  // och provisionen). handleSubmit läser formData, därför körs den i en effekt
  // efter att statusen har slagit igenom i formuläret.
  const [stangBegard, setStangBegard] = useState(false)
  const stangSvarRef = useRef<((ok: boolean) => void) | null>(null)
  const statusForeStangRef = useRef('')
  const stangHelaArendet = () => new Promise<boolean>(resolve => {
    stangSvarRef.current = resolve
    statusForeStangRef.current = formData.status
    setFormData(prev => ({ ...prev, status: 'Avslutat' }))
    setStangBegard(true)
  })
  useEffect(() => {
    if (!stangBegard || formData.status !== 'Avslutat') return
    setStangBegard(false)
    ;(async () => {
      await handleSubmit()
      const ok = sparatOkRef.current
      // Stoppades sparandet (spärrarna): formuläret får tillbaka statusen det hade
      if (!ok && originalStatusRef.current !== 'Avslutat') {
        setFormData(prev => ({ ...prev, status: statusForeStangRef.current }))
      }
      stangSvarRef.current?.(ok)
      stangSvarRef.current = null
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stangBegard, formData.status])

  // Sektionernas synlighet. Gamla läget: noden returneras orörd (ingen wrapper).
  // Nya läget: samma nod i en wrapper som visas i sina steg och alltid i Alla uppgifter.
  const iSteg = (steg: StegId[], node: ReactNode) => {
    if (!nyArbetsvy) return node
    const klass = stegLage ? (steg.includes(aktivtSteg) ? 'empty:hidden' : 'hidden') : 'empty:hidden'
    return <div className={klass}>{node}</div>
  }
  // Stegens egna block (rubrik, hjälptext, knappar): bara i stegflödet
  const stegBlock = (steg: StegId) => (stegLage && aktivtSteg === steg ? 'flex flex-col gap-3' : 'hidden')
  const kartaMonterad = !nyArbetsvy || kartaVisad

  const rullaUpp = () => {
    setTimeout(() => innehallRef.current?.parentElement?.scrollTo({ top: 0 }), 0)
  }
  const gaTillSteg = (steg: StegId) => {
    setVisning('steg')
    setAktivtSteg(steg)
    if (steg === 'arbete') setKartaVisad(true)
    rullaUpp()
  }
  const visaAllaUppgifter = () => {
    setVisning('flikar')
    setKartaVisad(true)
    rullaUpp()
  }

  const { foregaende: foregaendeSteg, nasta: nastaSteg } = grannSteg(stegLista, aktivtSteg)

  // Vidare: sparar med den vanliga handleSubmit (och bilderna) om något är ändrat och går till nästa steg
  const gaVidare = async () => {
    if (!nastaSteg || stegUpptaget) return
    setStegUpptaget(true)
    try {
      if (harOsparat() || hasPendingImageChanges) {
        const ok = await sparaArendeOchBilder()
        if (!ok) return
      }
      gaTillSteg(nastaSteg.id)
    } finally {
      setStegUpptaget(false)
    }
  }

  // Hinder från avslutskontrollen. Tiden ändras i Framme (där datumet står i den här modalen).
  const gaTillHinder = (steg: StegId, hinder?: AvslutsHinder) => {
    if (hinder?.id === 'sluttid-fore-start') {
      gaTillSteg('framme')
      return
    }
    if (!stegLista.some(s => s.id === steg)) {
      visaAllaUppgifter()
      return
    }
    gaTillSteg(steg)
  }

  const kontrollAvslut = () => kontrolleraAvslut({
    caseId: caseData.id,
    kalla: 'cases',
    serviceType: 'rondering_trafikkontoret',
  })

  const provisionText = (() => {
    if (!commissionEligible) return 'Ärendet är inte markerat som provisionsgrundande, ingen provision registreras.'
    if (existingCommissionPosts > 0) return 'Provisionen är redan registrerad och ändras inte.'
    if (commissionShares.length === 0) return 'Provision är vald men ingen tekniker har en andel. Fördela den under Utöver avtalet, annars registreras ingen provision.'
    return `Provisionen registreras på ${commissionShares.map(s => `${s.technician_name} ${s.share_percentage} %`).join(', ')}.`
  })()

  const vadHanderVidStang = [
    'Ärendet får status Avslutat och dagens datum som avslutsdatum.',
    'Stationerna du har bockat av är redan sparade och följer med som de är.',
    // Ronderingen är ett återkommande besök enligt avtalet och faktureras inte;
    // bara rader med belopp som inte täcks av avtalet faktureras
    utoverAvtaletKr > 0
      ? `Ronderingen ingår i kundens avtal och faktureras inte. ${formateraKr(utoverAvtaletKr)} exkl. moms under Utöver avtalet faktureras utöver avtalet.`
      : 'Ronderingen ingår i kundens avtal och faktureras inte. Inget är tillagt utöver avtalet, så ingen faktura skapas.',
    provisionText,
    'Rapporten skickas inte av sig själv. Skicka den i steget Rapport.',
  ]

  const ronderingAvslutad = originalStatusRef.current === 'Avslutat'
  const kontaktTelefon = formData.contact_phone || customerData?.contact_phone || ''
  const kontaktNamn = formData.contact_person || customerData?.contact_person || ''
  const kundAdress: string = customerData?.contact_address || ''

  const ikonKnapp = 'w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
  const stegKnappKlass = 'min-h-[48px] px-4 rounded-xl border border-slate-600 bg-slate-800/60 text-white text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

  const nyttHuvud = (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => (stegLage ? visaAllaUppgifter() : gaTillSteg(aktivtSteg))}
        aria-label={stegLage ? 'Alla uppgifter i ärendet, den vanliga vyn' : 'Tillbaka till stegen'}
        title={stegLage ? 'Alla uppgifter' : 'Tillbaka till stegen'}
        className={ikonKnapp}
      >
        <SvgIcon name={stegLage ? 'falt.uppgifter' : 'guide.steg'} size={24} />
      </button>
      <button
        type="button"
        onClick={() => setVisaVerktyg(true)}
        aria-label="Ärendets verktyg"
        aria-haspopup="dialog"
        aria-expanded={visaVerktyg}
        title="Ärendets verktyg"
        className={ikonKnapp}
      >
        <SvgIcon name="falt.verktyg" size={24} />
      </button>
      {stegLage && (
        <button type="button" onClick={handleClose} aria-label="Stäng ärendet" title="Stäng" className={ikonKnapp}>
          <SvgIcon name="allman.stang" size={24} />
        </button>
      )}
    </div>
  )

  const stegFooter = (
    <StegKnappar
      steg={stegLista}
      aktivt={aktivtSteg}
      onTillbaka={foregaendeSteg ? () => gaTillSteg(foregaendeSteg.id) : undefined}
      onNasta={nastaSteg ? gaVidare : undefined}
      upptagen={stegUpptaget || loading}
    />
  )

  // Ärendets verktyg: samma val och handlers som ikonerna i huvudet och dialogen Vad vill du göra?
  const verktygGrupper: ArendeVerktygGrupp[] = !nyArbetsvy ? [] : [
    {
      id: 'rapporter',
      rubrik: 'Rapporter',
      val: [
        {
          id: 'ladda-ned',
          ikon: 'rapport.ladda',
          text: 'Ladda ned rapporten',
          beskrivning: 'Arbetsrapporten som PDF. Finns en rapport redan frågar appen om en ny version.',
          disabled: !canGenerateReport || isGenerating,
          onClick: () => { void downloadReport() },
        },
        {
          id: 'skicka-tekniker',
          ikon: 'rapport.skicka',
          text: 'Skicka till ansvarig tekniker',
          beskrivning: formData.primary_technician_name ? `Skicka till ${formData.primary_technician_name}` : 'Skicka till ansvarig tekniker',
          disabled: !canGenerateReport || isGenerating,
          onClick: () => { void sendToTechnician() },
        },
        {
          id: 'skicka-kontakt',
          ikon: 'kontakt.mejl',
          text: 'Skicka till kontaktperson',
          beskrivning: formData.contact_person ? `Skicka till ${formData.contact_person}` : 'Skicka till kontaktperson',
          villkorText: formData.contact_email ? undefined : 'Kontaktpersonen saknar e-post',
          disabled: !canGenerateReport || isGenerating,
          onClick: () => { void sendToContact() },
        },
        ...(caseData?.id ? [{
          id: 'specialrapport',
          ikon: 'falt.specialrapport' as const,
          text: 'Specialrapporter',
          beskrivning: 'Skapa, öppna och ladda ned specialrapporter. De finns i steget Rapport.',
          onClick: () => gaTillSteg('rapport'),
        }] : []),
      ],
      not: hasRecentReport && currentReport && getTimeSinceReport
        ? `Rapport framtagen ${getTimeSinceReport(currentReport)}, version ${currentReport.version} av ${totalReports}${currentReport.sent_to_customer ? ', skickad till kund' : ''}${currentReport.sent_to_technician ? ', skickad till tekniker' : ''}.`
        : undefined,
    },
    {
      id: 'besok',
      rubrik: 'Besök',
      val: [
        {
          id: 'delbesok',
          ikon: 'arende.rondering',
          text: 'Lägg till delbesök',
          beskrivning: 'Boka in en tekniker på ett eget datum. Stationerna loggas mot det här ärendet.',
          onClick: () => setShowAddSubVisit(true),
        },
        {
          id: 'besokshistorik',
          ikon: 'allman.historik',
          text: 'Besökshistorik',
          beskrivning: 'Se alla genomförda besök och loggade åtgärder.',
          onClick: () => setShowVisitHistoryPanel(true),
        },
      ],
    },
    {
      id: 'nytt-arende',
      rubrik: 'Nytt ärende från det här',
      val: [
        {
          id: 'kopiera',
          ikon: 'allman.plus',
          text: 'Kopiera ärende',
          beskrivning: 'Nytt ärende hos samma kund. Kontakt och tekniker följer med.',
          onClick: () => setShowFollowUpDialog(true),
        },
        {
          id: 'duplicera',
          ikon: 'rapport.kopia',
          text: 'Duplicera ärende',
          beskrivning: 'Skapa en kopia och välj vad som följer med.',
          onClick: () => setShowDuplicateDialog(true),
        },
      ],
    },
    {
      id: 'kontakt',
      rubrik: 'Kontakt',
      val: [
        {
          id: 'kommunikation',
          ikon: 'kontakt.mote',
          text: 'Kommunikation',
          beskrivning: 'Intern chatt om ärendet med kontoret och andra tekniker.',
          onClick: () => setShowCommunicationPanel(true),
        },
      ],
    },
    {
      id: 'arendet',
      rubrik: 'Ärendet',
      val: [
        {
          id: 'alla-uppgifter',
          ikon: 'falt.uppgifter',
          text: 'Alla uppgifter',
          beskrivning: 'Den vanliga vyn med alla delar av ärendet. Allt som sparas där syns i stegen.',
          onClick: visaAllaUppgifter,
        },
        {
          id: 'status',
          ikon: 'arende.status',
          text: 'Ändra status',
          beskrivning: `Nu ${formData.status}. Statusen väljer du under Ärendeinformation i Alla uppgifter. Spara efter bytet.`,
          onClick: visaAllaUppgifter,
        },
      ],
    },
    {
      id: 'ta-bort',
      rubrik: 'Ta bort',
      // Samma villkor som Radera i sidfoten: dold för tekniker
      val: profile?.role !== 'technician' ? [{
        id: 'radera',
        ikon: 'allman.radera',
        text: 'Radera ärende',
        beskrivning: 'Frågar en gång till innan ärendet tas bort.',
        fara: true,
        onClick: () => setShowDeleteDialog(true),
      }] : [],
    },
  ]

  const modalFooter = (
    <div className="flex items-center justify-between w-full">
      {profile?.role !== 'technician' && (
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <Trash2 className="w-3 h-3" />
          Radera
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button onClick={handleClose} variant="secondary" size="sm">Stäng</Button>
        <Button
          onClick={handleSubmit}
          size="sm"
          loading={loading}
          disabled={showSaveSuccess}
          className={`${showSaveSuccess ? 'bg-green-500 hover:bg-green-500' : ''} transition-colors duration-300`}
        >
          {showSaveSuccess ? <><Check className="w-4 h-4 mr-1" />Sparat!</> : <><Save className="w-4 h-4 mr-1" />Spara</>}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={modalTitle}
        size="xl"
        footer={stegLage ? stegFooter : modalFooter}
        preventClose={true}
        allowBackdropClose={!loading}
        usePortal={true}
        mobilHelskarm={nyArbetsvy}
        headerActions={nyArbetsvy ? nyttHuvud : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowActionDialog(true)}
              className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-500/20 rounded-lg transition-all"
              title="Boka återbesök"
            >
              <SvgIcon name="arende.aterbesok" size={20} />
            </button>
            <button
              type="button"
              onClick={() => setShowVisitHistoryPanel(true)}
              className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-500/20 rounded-lg transition-all"
              title="Besökshistorik"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowCommunicationPanel(true)}
              className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-all"
              title="Intern kommunikation"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        )}
      >
        {/* Nya arbetsvyn: stegraden överst */}
        {stegLage && (
          <StegRad steg={stegLista} aktivt={aktivtSteg} onValj={gaTillSteg} hinder={hinderSteg} />
        )}
        <div
          ref={nyArbetsvy ? innehallRef : undefined}
          className={stegLage ? 'p-4' : 'p-4 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800'}
        >
          {/* Header-actionrad med rapport. Nya arbetsvyn: bara i Alla uppgifter, stegen har egna knappar i Rapport */}
          {iSteg([], (
          <div className="mb-4 -mt-4 -mx-4 px-4 py-3 bg-slate-800/30 border-b border-slate-700 flex items-center justify-end gap-2">
            <WorkReportDropdown
              onDownload={downloadReport}
              onSendToTechnician={sendToTechnician}
              onSendToContact={sendToContact}
              disabled={!canGenerateReport || isGenerating}
              technicianName={formData.primary_technician_name}
              contactName={formData.contact_person}
              totalReports={totalReports}
              hasRecentReport={hasRecentReport}
              currentReport={currentReport}
              getTimeSinceReport={getTimeSinceReport}
            />
          </div>
          ))}

          <div className="space-y-3">
            {/* ═══ Nya arbetsvyn: stegens rubriker och hjälptexter (bara stegflödet) ═══ */}
            {nyArbetsvy && (
              <>
                <div className={stegBlock('framme')}>
                  <HjalpText id="steg-framme-rondering" rubrik="Är du framme i regionen?">
                    Kontrollera kontakten och den planerade tiden. Gå sedan vidare till stationerna.
                  </HjalpText>
                  {(kundAdress || kontaktTelefon) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {kundAdress && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(kundAdress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={stegKnappKlass}
                        >
                          <SvgIcon name="falt.navigera" size={20} />
                          <span className="truncate">Öppna i kartor</span>
                        </a>
                      )}
                      {kontaktTelefon && (
                        <a href={`tel:${kontaktTelefon.replace(/\s/g, '')}`} className={stegKnappKlass}>
                          <SvgIcon name="kontakt.telefon" size={20} />
                          <span className="truncate">Ring {kontaktNamn || kontaktTelefon}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className={stegBlock('arbete')}>
                  <HjalpText id="steg-arbete-rondering" rubrik="Bocka av stationerna">
                    Bocka av varje station du har kontrollerat och välj hur mycket bete som gått åt. Ändra status till Åtgärd krävs eller Saknas vid behov. Allt sparas direkt. Avvikelser lägger du på kartan.
                  </HjalpText>
                </div>

                <div className={stegBlock('foton')}>
                  <HjalpText id="steg-foton-rondering" rubrik="Foton">
                    Fotografera det som behöver dokumenteras. Bilderna sparas när du går vidare eller stänger ärendet.
                  </HjalpText>
                </div>

                <div className={stegBlock('rapport')}>
                  <HjalpText id="steg-rapport-rondering" rubrik="Rapport">
                    Skriv vad du gjorde och vad du såg. Rapporten skickas inte av sig själv, ladda ned den eller skicka den med knapparna längst ner i steget.
                  </HjalpText>
                </div>

                <div className={stegBlock('pris')}>
                  <HjalpText id="steg-pris-rondering-avtal" rubrik="Utöver avtalet">
                    Ronderingen ingår i kundens avtal och faktureras inte. Lägg bara till det kunden har beställt utöver avtalet, till exempel extra material eller arbete.
                  </HjalpText>
                </div>
              </>
            )}

            {/* Kundinformation */}
            {iSteg(['framme'], customerData && (
              <div className="bg-gradient-to-r from-sky-900/20 to-blue-900/20 rounded-xl p-4 border border-sky-500/30">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-sky-400" />
                  Kundinformation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-sky-300 mb-1">Region</label>
                    <p className="text-white font-medium">{customerData.company_name}</p>
                    {customerData.parent?.company_name && (
                      <p className="text-xs text-sky-300 mt-0.5">Del av: {customerData.parent.company_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-sky-300 mb-1">Organisationsnummer</label>
                    <p className="text-white">{customerData.organization_number || customerData.parent?.organization_number || 'Ej angivet'}</p>
                  </div>
                </div>
                {/* Kontakt */}
                {(formData.contact_person || customerData.contact_person) && (
                  <div className="mt-3 pt-3 border-t border-sky-500/20 grid grid-cols-1 md:grid-cols-3 gap-2">
                    {(formData.contact_person || customerData.contact_person) && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <User className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                        {formData.contact_person || customerData.contact_person}
                      </div>
                    )}
                    {(formData.contact_phone || customerData.contact_phone) && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                        {formData.contact_phone || customerData.contact_phone}
                      </div>
                    )}
                    {(formData.contact_email || customerData.contact_email) && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                        {formData.contact_email || customerData.contact_email}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Ärendeinformation */}
            {iSteg(['framme'], (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Ärendeinformation
              </h3>

              {/* Beskrivning */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                  placeholder="Beskrivning av ronderingen..."
                />
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-3">
                {/* Nya arbetsvyn: statusen byts i Alla uppgifter (Ärendets verktyg, Ändra status), stängs i steget Klart */}
                <div className={stegLage ? 'hidden' : undefined}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                  <Select
                    value={formData.status}
                    onChange={val => setFormData(prev => ({ ...prev, status: val }))}
                    options={DROPDOWN_STATUSES.map(s => ({ value: s, label: s }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Schemalagd start</label>
                  <DatePicker
                    selected={formData.scheduled_start}
                    onChange={date => setFormData(prev => ({ ...prev, scheduled_start: date }))}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="d MMM yyyy, HH:mm"
                    locale="sv"
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                    placeholderText="Välj datum och tid..."
                  />
                </div>
              </div>
            </div>
            ))}

            {/* Tekniker */}
            {iSteg(['framme'], (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 mr-0.5">Tekniker</span>
                {([
                  { key: 'primary_technician_id' as const, nameKey: 'primary_technician_name' as const, label: 'Primär' },
                  { key: 'secondary_technician_id' as const, nameKey: 'secondary_technician_name' as const, label: 'Sekundär' },
                  { key: 'tertiary_technician_id' as const, nameKey: 'tertiary_technician_name' as const, label: 'Tertiär' },
                ]).map((slot) => {
                  const techId = formData[slot.key] || ''
                  const tech = technicians.find(t => t.id === techId)
                  const initials = tech ? tech.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : ''
                  return (
                    <div key={slot.key} className="relative">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                          tech
                            ? 'bg-[#20c58f]/20 border-2 border-[#20c58f]'
                            : 'border-2 border-dashed border-slate-600 hover:border-slate-500'
                        }`}
                        title={tech ? `${tech.name} (${slot.label})` : `${slot.label} tekniker`}
                      >
                        {tech ? (
                          <span className="text-xs font-bold text-[#20c58f]">{initials}</span>
                        ) : (
                          <Plus className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                      <select
                        value={techId}
                        onChange={(e) => {
                          const selectedTech = technicians.find(t => t.id === e.target.value)
                          setFormData(prev => ({
                            ...prev,
                            [slot.key]: e.target.value,
                            [slot.nameKey]: selectedTech?.name || '',
                          }))
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title={slot.label}
                      >
                        <option value="">Ingen</option>
                        {technicians.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
            ))}

            {/* Delbesök — visas bara på originalärenden (ej på delbesök) */}
            {iSteg(['arbete'], !caseData?.parent_case_id && (
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Footprints className="w-4 h-4 text-[#20c58f]" />
                    Planerade besök
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddSubVisit(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[#20c58f] hover:bg-[#20c58f]/10 rounded-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Lägg till besök
                  </button>
                </div>
                {subVisits.length === 0 ? (
                  <p className="text-xs text-slate-500 py-1">Inga delbesök — hela ronderingen görs i detta ärende.</p>
                ) : (
                  <div className="space-y-1.5">
                    {subVisits.map(sv => (
                      <div key={sv.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-300 font-medium">
                              {sv.scheduled_start
                                ? new Date(sv.scheduled_start).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : '—'}
                              {sv.scheduled_end
                                ? ` – ${new Date(sv.scheduled_end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
                                : ''}
                            </span>
                            <span className="text-xs text-slate-500">{sv.primary_technician_name || '—'}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNestedSubVisit(sv)}
                          className="p-1.5 text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 rounded-lg transition-colors"
                          title="Öppna delbesök"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Stationslista */}
            {iSteg(['arbete'], (
            <div ref={stationListRef} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  Stationer
                </h3>
                {/* Progress */}
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 font-medium">{inspectedCount - actionRequiredCount - missingCount} OK</span>
                  {actionRequiredCount > 0 && <span className="text-amber-400">{actionRequiredCount} åtgärd</span>}
                  {missingCount > 0 && <span className="text-red-400">{missingCount} saknas</span>}
                  <span className="text-slate-400">{inspectedCount}/{stations.length}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-700 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: stations.length > 0 ? `${(inspectedCount / stations.length) * 100}%` : '0%' }}
                />
              </div>

              {/* Sök */}
              <input
                type="text"
                value={stationSearch}
                onChange={e => setStationSearch(e.target.value)}
                placeholder="Sök station..."
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white mb-2 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              />

              {loadingStations ? (
                <div className="py-6 text-center text-slate-500 text-sm">Laddar stationer...</div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                  {filteredStations.length === 0 ? (
                    <div className="py-4 text-center text-slate-500 text-sm">Inga stationer hittades</div>
                  ) : (
                    filteredStations.map(station => {
                      const log = stationLogs.find(l => l.station_id === station.id)
                      const isChecked = !!log
                      const st = (log?.status ?? 'ok') as RonderingStationStatus

                      return (
                        <div
                          key={station.id}
                          data-station-id={station.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isChecked ? 'bg-slate-800/60' : 'hover:bg-slate-800/40'}`}
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleStation(station)}
                            disabled={pendingStations.has(station.id)}
                            className={`flex-shrink-0 transition-opacity ${pendingStations.has(station.id) ? 'opacity-40 cursor-wait' : ''}`}
                          >
                            {isChecked
                              ? <CheckSquare className={`w-5 h-5 ${STATUS_COLOR[st]}`} />
                              : <Square className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                            }
                          </button>

                          {/* Station-info */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-mono text-slate-200">{station.serial_number || '—'}</span>
                            {station.comment && (
                              <span className="text-xs text-slate-500 ml-2 truncate">{station.comment}</span>
                            )}
                          </div>

                          {/* Log-info när avbockad */}
                          {log && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Tidstämpel + tekniker */}
                              <span className="text-xs text-slate-500 hidden sm:block">
                                {formatDateTime(log.inspected_at)}
                                {log.technician_name && ` · ${log.technician_name.split(' ')[0]}`}
                              </span>

                              {/* Beteåtgång */}
                              {log.bait_consumed && (
                                <span className="text-xs text-slate-400 font-medium">
                                  {BAIT_LABEL[log.bait_consumed]}
                                </span>
                              )}

                              {/* Status-badge + dropdown */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenStatusMenu(openStatusMenu === log.id ? null : log.id)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${STATUS_BG[st]}`}
                                >
                                  <span className={STATUS_COLOR[st]}>{STATUS_LABEL[st]}</span>
                                  <ChevronDown className="w-3 h-3 text-slate-400" />
                                </button>
                                {openStatusMenu === log.id && (
                                  <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                                    {(['ok', 'action_required', 'missing'] as RonderingStationStatus[]).map(s => (
                                      <button
                                        key={s}
                                        type="button"
                                        onClick={() => changeStationStatus(log, s)}
                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors ${STATUS_COLOR[s]}`}
                                      >
                                        {STATUS_LABEL[s]}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            ))}

            {/* Beteåtgång-dialog — visas när tekniker bockar i en ny station */}
            {iSteg(['arbete'], baitDialog && (
              <div className="p-3 bg-slate-800 border border-[#20c58f]/40 rounded-xl">
                <p className="text-sm font-semibold text-white mb-1">
                  Bete uppätet till — station {baitDialog.station.serial_number}
                </p>
                <p className="text-xs text-slate-400 mb-3">Välj hur mycket bete som förbrukats</p>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'partial', 'none'] as const).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => confirmBait(val)}
                      className="flex-1 min-w-[70px] px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 hover:bg-slate-600 hover:border-[#20c58f]/50 text-sm font-medium text-white transition-colors"
                    >
                      {BAIT_LABEL[val]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setBaitDialog(null)}
                  className="mt-2 w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
                >
                  Avbryt
                </button>
              </div>
            ))}

            {/* Avvikelsekarta. Nya arbetsvyn: monteras första gången kartan syns */}
            {iSteg(['arbete'], kartaMonterad && caseData?.id && caseData?.customer_id && (
              <RonderingMapSection
                stations={stations}
                stationLogs={stationLogs}
                annotations={annotations}
                caseId={logCaseId ?? caseData.id}
                customerId={caseData.customer_id}
                technicianName={formData.primary_technician_name || profile?.full_name || null}
                onAnnotationAdded={ann => setAnnotations(prev => [...prev, ann])}
                onAnnotationDeleted={id => setAnnotations(prev => prev.filter(a => a.id !== id))}
                onStationClick={stationId => {
                  // Scrolla stationslistan till rätt rad
                  const el = stationListRef.current?.querySelector(`[data-station-id="${stationId}"]`)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                }}
              />
            ))}

            {/* Arbetsrapport */}
            {iSteg(['rapport'], (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Arbetsrapport
              </h3>
              <textarea
                value={formData.work_report}
                onChange={e => setFormData(prev => ({ ...prev, work_report: e.target.value }))}
                rows={3}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                placeholder="Beskriv utfört arbete, avvikelser och observationer..."
              />
            </div>
            ))}

            {/* Specialrapporter (3.56.0). Delbesök visar huvudärendets rapporter */}
            {iSteg(['rapport'], caseData?.id && (
              <CaseSpecialReportsSection
                caseId={caseData.parent_case_id ?? caseData.id}
                caseType="contract"
                caseNumber={caseData.parent_case_id ? null : formData.case_number}
                osparat={{
                  finns: () => harOsparat() || hasPendingImageChanges,
                  spara: sparaArendeOchBilder,
                }}
              />
            ))}

            {/* Utförda tjänster/artiklar för fakturering */}
            {iSteg(['pris'], caseData?.id && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden p-1">
                <CaseServiceSelector
                  caseId={caseData.id}
                  caseType="contract"
                  customerId={caseData.customer_id || undefined}
                  technicianId={formData.primary_technician_id || undefined}
                  technicianName={formData.primary_technician_name || undefined}
                  primaryServiceId={caseData.service_id || null}
                  onChange={handleBillingSummaryChange}
                />
              </div>
            ))}

            {/* Provision */}
            {iSteg(['pris'], caseData?.id && (
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <CommissionSection
                  isEligible={commissionEligible}
                  onEligibleChange={setCommissionEligible}
                  assignedTechnicians={
                    [
                      formData.primary_technician_id && formData.primary_technician_name
                        ? { id: formData.primary_technician_id, name: formData.primary_technician_name }
                        : null,
                      formData.secondary_technician_id && formData.secondary_technician_name
                        ? { id: formData.secondary_technician_id, name: formData.secondary_technician_name }
                        : null,
                      formData.tertiary_technician_id && formData.tertiary_technician_name
                        ? { id: formData.tertiary_technician_id, name: formData.tertiary_technician_name }
                        : null,
                    ].filter(Boolean) as { id: string; name: string }[]
                  }
                  technicianShares={commissionShares}
                  onSharesChange={setCommissionShares}
                  deductions={commissionDeductions}
                  onDeductionsChange={setCommissionDeductions}
                  notes={commissionNotes}
                  onNotesChange={setCommissionNotes}
                  baseAmount={billingSummary?.subtotal || 0}
                  existingPostCount={existingCommissionPosts}
                  postsLocked={commissionPostsLocked}
                  subcontractorDeduction={billingSummary?.subcontractor_total || 0}
                />
              </div>
            ))}

            {/* Bilder */}
            {iSteg(['foton'], caseData?.id && (
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Bilder & dokumentation
                </h3>
                <CaseImageGallery
                  ref={imageGalleryRef}
                  caseId={logCaseId ?? caseData.id}
                  canDelete={true}
                  canEdit={true}
                  refreshTrigger={imageRefreshTrigger}
                  onPendingChanges={setHasPendingImageChanges}
                />
              </div>
            ))}

            {/* ═══ Nya arbetsvyn: stegens egna delar längst ner i steget ═══ */}
            {nyArbetsvy && (
              <>
                {/* Rapport: samma handlers som rapportmenyn (WorkReportDropdown) */}
                <div className={stegBlock('rapport')}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button type="button" onClick={() => { void downloadReport() }} disabled={!canGenerateReport || isGenerating} className={stegKnappKlass}>
                      <SvgIcon name="rapport.ladda" size={20} />
                      Ladda ned
                    </button>
                    <button type="button" onClick={() => { void sendToContact() }} disabled={!canGenerateReport || isGenerating} className={stegKnappKlass}>
                      <SvgIcon name="kontakt.mejl" size={20} />
                      <span className="truncate">Skicka till {formData.contact_person || 'kontaktperson'}</span>
                    </button>
                    <button type="button" onClick={() => { void sendToTechnician() }} disabled={!canGenerateReport || isGenerating} className={stegKnappKlass}>
                      <SvgIcon name="rapport.skicka" size={20} />
                      <span className="truncate">Skicka till {formData.primary_technician_name || 'ansvarig tekniker'}</span>
                    </button>
                  </div>
                  {!formData.contact_email && (
                    <p className="text-sm text-amber-300">Ärendet saknar kontaktpersonens e-post, så rapporten kan inte skickas till kontaktpersonen. Be kontoret lägga in den.</p>
                  )}
                  {hasRecentReport && currentReport && (
                    <p className="text-sm text-slate-400">
                      Rapport framtagen {getTimeSinceReport(currentReport)}, version {currentReport.version} av {totalReports}
                      {currentReport.sent_to_customer ? ', skickad till kund' : ''}
                      {currentReport.sent_to_technician ? ', skickad till tekniker' : ''}.
                    </p>
                  )}
                </div>

                {/* Klart. Rondering har inget återbesök och ingen delfakturering: Bara besöket ersätts av Lägg till delbesök */}
                {caseData?.id && (
                  <div className={stegBlock('klart')}>
                    <KlartSteg
                      aktiv={stegLage && aktivtSteg === 'klart'}
                      steg={stegLista}
                      kontroll={kontrollAvslut}
                      onGaTillSteg={gaTillHinder}
                      gaTillText={h => (h.id === 'sluttid-fore-start' ? 'Ändra tiden i steget Framme' : undefined)}
                      onStangHelaArendet={stangHelaArendet}
                      baraBesoket={!isSubVisit ? {
                        rubrik: 'Lägg till delbesök',
                        text: 'Hinner du inte alla stationer? Ärendet står kvar öppet tills hela ronderingen är gjord.',
                        knappText: 'Lägg till delbesök',
                        ikon: 'allman.plus',
                        vadHander: [
                          'Delbesöket får ett eget datum och en egen tekniker.',
                          'Stationerna loggas mot det här ärendet.',
                          'Rondering har inget återbesök och ingen delfakturering.',
                        ],
                        onClick: () => setShowAddSubVisit(true),
                      } : undefined}
                      onSparaUtanAttStanga={sparaArendeOchBilder}
                      harOsparat={() => harOsparat() || hasPendingImageChanges}
                      status={formData.status}
                      arAvslutat={ronderingAvslutad}
                      avslutsdatum={caseData?.completed_date ?? null}
                      vadHander={vadHanderVidStang}
                      helaArendetText={`Ronderingen avslutas och får avslutsdatum. Den ingår i kundens avtal och faktureras inte.${utoverAvtaletKr > 0 ? ` ${formateraKr(utoverAvtaletKr)} faktureras utöver avtalet.` : ''}`}
                      onHinderChange={setHinderSteg}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Nya arbetsvyn: Ärendets verktyg */}
      {nyArbetsvy && (
        <ArendeVerktygArk
          oppen={visaVerktyg}
          onStang={() => setVisaVerktyg(false)}
          underrubrik={[isSubVisit ? `${parentCaseNumber ?? ''} Delbesök`.trim() : formData.case_number, customerData?.company_name].filter(Boolean).join(', ')}
          grupper={verktygGrupper}
        />
      )}

      {/* Radera-dialog — renderas via portal så den hamnar ovanpå den portal-baserade
          föräldramodalen (annars göms dialogen bakom och bara en svart backdrop syns).
          caseType="contract" eftersom ronderingsärenden ligger i tabellen `cases`. */}
      {showDeleteDialog && createPortal(
        <DeleteCaseConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          caseId={caseData?.id || ''}
          caseType="contract"
          caseTitle={formData.case_number || caseData?.title || 'Rondering'}
          onDeleted={() => {
            setShowDeleteDialog(false)
            onSuccess?.()
            onClose()
          }}
        />,
        document.getElementById('modal-root') ?? document.body
      )}

      {/* Kommunikationspanel */}
      {showCommunicationPanel && caseData?.id && (
        <CommunicationSlidePanel
          isOpen={showCommunicationPanel}
          onClose={() => setShowCommunicationPanel(false)}
          caseId={caseData.id}
          caseType={'contract' as CaseType}
          caseTitle={formData.case_number || caseData?.title || 'Rondering'}
        />
      )}

      {/* Besökshistorik */}
      {showVisitHistoryPanel && caseData?.id && (
        <VisitHistoryPanel
          caseId={caseData.id}
          caseTitle={formData.case_number || caseData?.title || 'Rondering'}
          onClose={() => setShowVisitHistoryPanel(false)}
        />
      )}

      {/* Rondering action dialog */}
      {showActionDialog && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 10001, pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowActionDialog(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2 className="text-base font-semibold text-white">Vad vill du göra?</h2>
              <button onClick={() => setShowActionDialog(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <button
                onClick={() => { setShowActionDialog(false); setShowAddSubVisit(true) }}
                className="w-full flex items-start gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-[#20c58f]/40 rounded-xl text-left transition-colors"
              >
                <Footprints className="w-5 h-5 text-[#20c58f] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Lägg till delbesök</p>
                  <p className="text-xs text-slate-400 mt-0.5">Boka in en tekniker på ett eget datum — loggar stationer mot detta ärende</p>
                </div>
              </button>
              <button
                onClick={() => { setShowActionDialog(false); setShowFollowUpDialog(true) }}
                className="w-full flex items-start gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-amber-500/40 rounded-xl text-left transition-colors"
              >
                <Plus className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Kopiera ärende</p>
                  <p className="text-xs text-slate-400 mt-0.5">Nytt ärende hos samma kund — kontakt och tekniker följer med</p>
                </div>
              </button>
              <button
                onClick={() => { setShowActionDialog(false); setShowDuplicateDialog(true) }}
                className="w-full flex items-start gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-[#20c58f]/40 rounded-xl text-left transition-colors"
              >
                <Copy className="w-5 h-5 text-[#20c58f] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Duplicera ärende</p>
                  <p className="text-xs text-slate-400 mt-0.5">Skapa en kopia och välj vad som följer med</p>
                </div>
              </button>
              <button
                onClick={() => { setShowActionDialog(false); setShowVisitHistoryPanel(true) }}
                className="w-full flex items-start gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl text-left transition-colors"
              >
                <History className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Besökshistorik</p>
                  <p className="text-xs text-slate-400 mt-0.5">Se alla genomförda besök och loggade åtgärder</p>
                </div>
              </button>
            </div>
            <div className="px-4 py-2.5 border-t border-slate-700/50">
              <button onClick={() => setShowActionDialog(false)} className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') ?? document.body
      )}

      {/* Lägg till delbesök */}
      {showAddSubVisit && caseData?.id && createPortal(
        <AddSubVisitModal
          parentCase={caseData}
          technicians={technicians}
          onClose={() => setShowAddSubVisit(false)}
          onCreated={(newCase) => {
            setShowAddSubVisit(false)
            setSubVisits(prev => [...prev, newCase].sort((a, b) =>
              (a.scheduled_start || '').localeCompare(b.scheduled_start || '')
            ))
          }}
        />,
        document.getElementById('modal-root') ?? document.body
      )}

      {/* Kopiera ärende (följeärende) */}
      {showFollowUpDialog && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 10001, pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !followUpLoading && setShowFollowUpDialog(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Kopiera ärende
              </h2>
              <button onClick={() => setShowFollowUpDialog(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-400">
                Ett nytt ärende skapas hos samma kund. Kontaktuppgifter och tekniker kopieras automatiskt.
              </p>
              <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Ursprungsärende</p>
                <p className="text-sm text-white font-medium">{formData.case_number} — {formData.title || caseData?.title || 'Rondering'}</p>
              </div>
            </div>
            <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-end gap-2">
              <button
                onClick={() => setShowFollowUpDialog(false)}
                disabled={followUpLoading}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Avbryt
              </button>
              <Button variant="primary" size="sm" onClick={handleCreateFollowUpCase} disabled={followUpLoading}>
                {followUpLoading ? 'Skapar...' : 'Skapa ärende'}
              </Button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') ?? document.body
      )}

      {/* Duplicera-ärende-dialog (portalar sig själv till #modal-root) */}
      {caseData?.id && (
        <DuplicateCaseDialog
          isOpen={showDuplicateDialog}
          onClose={() => setShowDuplicateDialog(false)}
          caseData={{
            id: caseData.id,
            case_type: 'contract',
            title: formData.title ?? null,
            case_number: formData.case_number ?? null,
            startAt: formData.scheduled_start ? formData.scheduled_start.toISOString() : null,
            endAt: formData.scheduled_end ? formData.scheduled_end.toISOString() : null,
          }}
          createdByTechnicianId={profile?.technician_id ?? null}
          createdByTechnicianName={profile?.display_name ?? null}
          onDuplicated={async (result) => {
            setShowDuplicateDialog(false)
            // Nollställ parent_case_id på kopian — i ronderingskontext betyder
            // parent_case_id "delbesök" (kopian skulle annars dela stationsloggar
            // med originalet och listas som delbesök).
            if (result?.id) {
              const { data: clearedRows, error: clearError } = await supabase
                .from('cases')
                .update({ parent_case_id: null })
                .eq('id', result.id)
                .select('id')
              if (clearError || !clearedRows || clearedRows.length === 0) {
                console.error('Kunde inte nollställa parent_case_id på kopian:', clearError)
                toast.error('Kopian skapades men kunde inte kopplas loss från originalet — den kan visas som delbesök')
              }
            }
            onSuccess?.()
          }}
        />
      )}

      {/* Nested delbesök-modal */}
      {nestedSubVisit && (
        <RonderingCaseModal
          isOpen={true}
          onClose={() => setNestedSubVisit(null)}
          onSuccess={() => setNestedSubVisit(null)}
          caseData={nestedSubVisit}
        />
      )}
    </>
  )
}
