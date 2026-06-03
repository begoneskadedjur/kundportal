// src/components/coordinator/RonderingCaseModal.tsx
// Modal för "Rondering Trafikkontoret" — egenkontrollprogram med stationsavbockning

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, Building, Building2, Calendar, Save, Check, Map, MapPin,
  CheckSquare, Square, AlertTriangle, MessageSquare, History,
  Trash2, FileText, Users, User, Phone, Mail, ChevronDown,
  Footprints, Clock, Plus
} from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import { DROPDOWN_STATUSES } from '../../types/database'
import WorkReportDropdown from '../shared/WorkReportDropdown'
import { useModernWorkReportGeneration } from '../../hooks/useModernWorkReportGeneration'
import { toSwedishISOString } from '../../utils/dateHelpers'
import CaseImageGallery, { CaseImageGalleryRef } from '../shared/CaseImageGallery'
import CommunicationSlidePanel from '../communication/CommunicationSlidePanel'
import { CaseType } from '../../types/communication'
import RevisitContractModal from './RevisitContractModal'
import VisitHistoryPanel from './VisitHistoryPanel'
import DeleteCaseConfirmDialog from '../shared/DeleteCaseConfirmDialog'
import { RonderingService, RonderingStationLog, RonderingStationStatus, RonderingAnnotation } from '../../services/ronderingService'
import { EquipmentService } from '../../services/equipmentService'
import RonderingMapSection from './RonderingMapSection'

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

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

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

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false)
  const [showVisitHistoryPanel, setShowVisitHistoryPanel] = useState(false)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [imageRefreshTrigger, setImageRefreshTrigger] = useState(0)
  const [hasPendingImageChanges, setHasPendingImageChanges] = useState(false)
  const imageGalleryRef = useRef<CaseImageGalleryRef>(null)

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

  const handleClose = useCallback(() => {
    if (hasPendingImageChanges && imageGalleryRef.current) {
      imageGalleryRef.current.commitPendingChanges()
    }
    onClose()
  }, [onClose, hasPendingImageChanges])

  // Ladda kunddata, tekniker och stationer
  useEffect(() => {
    if (!isOpen || !caseData) return

    const load = async () => {
      // Formdata
      setFormData({
        case_number: caseData.case_number || caseData.title || '',
        title: caseData.title || '',
        description: caseData.description || '',
        status: caseData.status || 'Öppen',
        contact_person: caseData.contact_person || '',
        contact_phone: caseData.contact_phone || '',
        contact_email: caseData.contact_email || '',
        scheduled_start: caseData.scheduled_start ? new Date(caseData.scheduled_start) : null,
        scheduled_end: caseData.scheduled_end ? new Date(caseData.scheduled_end) : null,
        primary_technician_id: caseData.primary_technician_id || '',
        primary_technician_name: caseData.primary_technician_name || '',
        secondary_technician_id: caseData.secondary_technician_id || '',
        secondary_technician_name: caseData.secondary_technician_name || '',
        tertiary_technician_id: caseData.tertiary_technician_id || '',
        tertiary_technician_name: caseData.tertiary_technician_name || '',
        work_report: caseData.work_report || '',
      })

      // Kunddata
      if (caseData.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
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

      // Befintliga avbockningar och annotationer (parallellt)
      const [logs, anns] = await Promise.all([
        RonderingService.getLogsForCase(caseData.id),
        RonderingService.getAnnotationsForCase(caseData.id),
      ])
      setStationLogs(logs)
      setAnnotations(anns)
    }

    load()
  }, [isOpen, caseData])

  // Spara ändringar
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          description: formData.description || null,
          status: formData.status,
          contact_person: formData.contact_person || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          scheduled_start: formData.scheduled_start ? toSwedishISOString(formData.scheduled_start) : null,
          scheduled_end: formData.scheduled_end ? toSwedishISOString(formData.scheduled_end) : null,
          primary_technician_id: formData.primary_technician_id || null,
          primary_technician_name: formData.primary_technician_name || null,
          secondary_technician_id: formData.secondary_technician_id || null,
          secondary_technician_name: formData.secondary_technician_name || null,
          tertiary_technician_id: formData.tertiary_technician_id || null,
          tertiary_technician_name: formData.tertiary_technician_name || null,
          work_report: formData.work_report || null,
        })
        .eq('id', caseData.id)

      if (error) throw error

      setShowSaveSuccess(true)
      setTimeout(() => setShowSaveSuccess(false), 2000)
      onSuccess?.(caseData)
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte spara')
    } finally {
      setLoading(false)
    }
  }

  // Bocka av / avbocka station
  const toggleStation = async (station: Station) => {
    if (pendingStations.has(station.id)) return
    setPendingStations(prev => new Set(prev).add(station.id))

    const existing = stationLogs.find(l => l.station_id === station.id)
    try {
      if (existing) {
        // Avbocka
        setStationLogs(prev => prev.filter(l => l.station_id !== station.id))
        try {
          await RonderingService.removeLog(caseData.id, station.id)
        } catch {
          setStationLogs(prev => [...prev, existing])
          toast.error('Kunde inte ta bort avbockning')
        }
      } else {
        // Bocka av — optimistisk uppdatering
        const optimistic: RonderingStationLog = {
          id: `tmp-${station.id}`,
          case_id: caseData.id,
          station_id: station.id,
          inspected_at: new Date().toISOString(),
          technician_id: profile?.technician_id || null,
          technician_name: profile?.full_name || null,
          status: 'ok',
          note: null,
          created_at: new Date().toISOString(),
        }
        setStationLogs(prev => [...prev, optimistic])
        try {
          const real = await RonderingService.logStation(
            caseData.id,
            station.id,
            profile?.technician_id || null,
            profile?.full_name || null,
            'ok'
          )
          setStationLogs(prev => prev.map(l => l.id === optimistic.id ? real : l))
        } catch {
          setStationLogs(prev => prev.filter(l => l.id !== optimistic.id))
          toast.error('Kunde inte logga inspektion')
        }
      }
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

  const modalTitle = (
    <div className="flex items-center gap-2">
      <span>Ärende: {formData.case_number || 'Laddar...'}</span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
        <Map className="w-3 h-3" />
        Rondering Trafikkontoret
      </span>
    </div>
  )

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
        footer={modalFooter}
        preventClose={true}
        allowBackdropClose={!loading}
        usePortal={true}
        headerActions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowActionDialog(true)}
              className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-500/20 rounded-lg transition-all"
              title="Boka återbesök"
            >
              <Footprints className="w-5 h-5" />
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
        }
      >
        <div className="p-4 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
          {/* Header-actionrad med rapport */}
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

          <div className="space-y-3">
            {/* Kundinformation */}
            {customerData && (
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
            )}

            {/* Ärendeinformation */}
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
                <div>
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

            {/* Tekniker */}
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

            {/* Stationslista */}
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

            {/* Avvikelsekarta */}
            {caseData?.id && caseData?.customer_id && (
              <RonderingMapSection
                stations={stations}
                stationLogs={stationLogs}
                annotations={annotations}
                caseId={caseData.id}
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
            )}

            {/* Arbetsrapport */}
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

            {/* Bilder */}
            {caseData?.id && (
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Bilder & dokumentation
                </h3>
                <CaseImageGallery
                  ref={imageGalleryRef}
                  caseId={caseData.id}
                  canDelete={true}
                  canEdit={true}
                  refreshTrigger={imageRefreshTrigger}
                  onPendingChanges={setHasPendingImageChanges}
                />
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Radera-dialog */}
      {showDeleteDialog && (
        <DeleteCaseConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          caseId={caseData?.id}
          caseNumber={formData.case_number}
          onDeleted={() => {
            setShowDeleteDialog(false)
            onSuccess?.()
            onClose()
          }}
        />
      )}

      {/* Kommunikationspanel */}
      {showCommunicationPanel && caseData?.id && (
        <CommunicationSlidePanel
          isOpen={showCommunicationPanel}
          onClose={() => setShowCommunicationPanel(false)}
          caseId={caseData.id}
          caseType={'contract' as CaseType}
          caseNumber={formData.case_number}
        />
      )}

      {/* Besökshistorik */}
      {showVisitHistoryPanel && caseData?.id && (
        <VisitHistoryPanel
          isOpen={showVisitHistoryPanel}
          onClose={() => setShowVisitHistoryPanel(false)}
          caseId={caseData.id}
          customerId={caseData.customer_id}
        />
      )}

      {/* Återbesök */}
      {showActionDialog && caseData?.id && (
        <RevisitContractModal
          isOpen={showActionDialog}
          onClose={() => setShowActionDialog(false)}
          parentCase={caseData}
          onSuccess={() => {
            setShowActionDialog(false)
            onSuccess?.()
          }}
        />
      )}
    </>
  )
}
