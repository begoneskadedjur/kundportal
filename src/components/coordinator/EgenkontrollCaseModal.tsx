// src/components/coordinator/EgenkontrollCaseModal.tsx
// Modal för "Egenkontroll Trafikkontoret" — avtalsansvarig granskar stationer
// mot ISY-ROAD-checklistan och kan lägga till egna avvikelser.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, Building, Calendar, Save, Check, MapPin,
  CheckSquare, Square, MessageSquare, History,
  Trash2, Users, User, Phone, Mail, ChevronDown,
  Footprints, Plus, Search, Image as ImageIcon, ClipboardCheck,
  ChevronRight, AlertTriangle, Eye
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
import { toSwedishISOString } from '../../utils/dateHelpers'
import CommunicationSlidePanel from '../communication/CommunicationSlidePanel'
import { CaseType } from '../../types/communication'
import RevisitContractModal from './RevisitContractModal'
import VisitHistoryPanel from './VisitHistoryPanel'
import DeleteCaseConfirmDialog from '../shared/DeleteCaseConfirmDialog'
import { RonderingService, RonderingStationLog, RonderingAnnotation } from '../../services/ronderingService'
import { EquipmentService } from '../../services/equipmentService'
import RonderingMapSection from './RonderingMapSection'
import { EgenkontrollService, EgenkontrollStationReview, EGENKONTROLL_ITEMS } from '../../services/egenkontrollService'
import { CaseImageService } from '../../services/caseImageService'
import type { CaseImageWithUrl } from '../../services/caseImageService'
import ImageLightbox from '../shared/ImageLightbox'

registerLocale('sv', sv)

interface EgenkontrollCaseModalProps {
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

const BAIT_LABEL: Record<'all' | 'partial' | 'none', string> = {
  all: 'Allt',
  partial: 'Delvis',
  none: 'Inget',
}

const BAIT_COLOR: Record<'all' | 'partial' | 'none', string> = {
  all: 'text-red-400',
  partial: 'text-amber-400',
  none: 'text-emerald-400',
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  action_required: 'Åtgärd krävs',
  missing: 'Saknas',
}

const STATUS_COLOR: Record<string, string> = {
  ok: 'text-emerald-400',
  action_required: 'text-amber-400',
  missing: 'text-red-400',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

export default function EgenkontrollCaseModal({
  isOpen,
  onClose,
  onSuccess,
  caseData,
}: EgenkontrollCaseModalProps) {
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
    work_report: '',
  })

  const [technicians, setTechnicians] = useState<any[]>([])

  // Alla stationer i regionen (för stationsval)
  const [allStations, setAllStations] = useState<Station[]>([])
  const [loadingStations, setLoadingStations] = useState(false)
  const [stationSearch, setStationSearch] = useState('')
  const [showStationPicker, setShowStationPicker] = useState(false)

  // Valda stationer (från egenkontroll_station_reviews)
  const [reviews, setReviews] = useState<EgenkontrollStationReview[]>([])

  // Expanderade stationer i granskningstabellen
  const [expandedStation, setExpandedStation] = useState<string | null>(null)

  // Senaste ronderingsloggar per station (read-only display)
  const [latestLogs, setLatestLogs] = useState<Map<string, RonderingStationLog>>(new Map())
  const [latestAnnotations, setLatestAnnotations] = useState<RonderingAnnotation[]>([])

  // Bilder per station
  const [stationImages, setStationImages] = useState<Map<string, CaseImageWithUrl[]>>(new Map())
  const [lightbox, setLightbox] = useState<{ images: { url: string; alt?: string }[]; index: number } | null>(null)
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // UI
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false)
  const [showVisitHistoryPanel, setShowVisitHistoryPanel] = useState(false)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [annotations, setAnnotations] = useState<RonderingAnnotation[]>([])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Ladda data
  useEffect(() => {
    if (!isOpen || !caseData) return

    const load = async () => {
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
        work_report: caseData.work_report || '',
      })

      if (caseData.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', caseData.customer_id)
          .single()
        setCustomerData(customer)
      }

      const { data: techs } = await supabase.from('technicians').select('*').eq('is_active', true).order('name')
      setTechnicians(techs || [])

      // Alla stationer i regionen
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
        setAllStations(active)
      } catch (e) {
        console.error('Kunde inte ladda stationer:', e)
      } finally {
        setLoadingStations(false)
      }

      // Granskningar för detta ärende
      const revs = await EgenkontrollService.getReviews(caseData.id)
      setReviews(revs)

      // Egna avvikelser för detta ärende
      const anns = await RonderingService.getAnnotationsForCase(caseData.id)
      setAnnotations(anns)

      // Senaste rondering för regionen — hämta senaste avslutat/bokad ärende
      const { data: latestCase } = await supabase
        .from('cases')
        .select('id')
        .eq('customer_id', caseData.customer_id)
        .eq('service_type', 'rondering_trafikkontoret')
        .order('scheduled_start', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestCase) {
        const [logs, latestAnns] = await Promise.all([
          RonderingService.getLogsForCase(latestCase.id),
          RonderingService.getAnnotationsForCase(latestCase.id),
        ])
        const logMap = new Map<string, RonderingStationLog>()
        for (const log of logs) logMap.set(log.station_id, log)
        setLatestLogs(logMap)
        setLatestAnnotations(latestAnns)
      }
    }

    load()
  }, [isOpen, caseData])

  // Ladda bilder för valda stationer
  useEffect(() => {
    if (!caseData?.id || reviews.length === 0) return
    const loadImages = async () => {
      const newMap = new Map<string, CaseImageWithUrl[]>()
      await Promise.all(
        reviews.map(async (rev) => {
          const all = await CaseImageService.getCaseImages(caseData.id, 'contract')
          const filtered = all.filter(img => img.description === `egenkontroll:${rev.station_id}`)
          newMap.set(rev.station_id, filtered)
        })
      )
      setStationImages(newMap)
    }
    loadImages()
  }, [caseData?.id, reviews])

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
          work_report: formData.work_report || null,
        })
        .eq('id', caseData.id)

      if (error) throw error

      setShowSaveSuccess(true)
      setTimeout(() => setShowSaveSuccess(false), 2000)
      onSuccess?.()
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte spara')
    } finally {
      setLoading(false)
    }
  }

  // Lägg till station i granskningen
  const addStation = async (station: Station) => {
    if (reviews.some(r => r.station_id === station.id)) return
    try {
      const rev = await EgenkontrollService.addStation(caseData.id, station.id)
      setReviews(prev => [...prev, rev])
      setExpandedStation(station.id)
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte lägga till station')
    }
  }

  // Ta bort station från granskningen
  const removeStation = async (stationId: string) => {
    try {
      await EgenkontrollService.removeStation(caseData.id, stationId)
      setReviews(prev => prev.filter(r => r.station_id !== stationId))
      if (expandedStation === stationId) setExpandedStation(null)
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte ta bort station')
    }
  }

  // Uppdatera checklistepunkt
  const toggleCheckItem = async (stationId: string, key: keyof EgenkontrollStationReview, currentVal: boolean) => {
    const patch = { [key]: !currentVal } as any
    setReviews(prev => prev.map(r => r.station_id === stationId ? { ...r, ...patch } : r))
    try {
      await EgenkontrollService.upsertReview(caseData.id, stationId, patch)
    } catch (e: any) {
      setReviews(prev => prev.map(r => r.station_id === stationId ? { ...r, [key]: currentVal } : r))
      toast.error('Kunde inte spara')
    }
  }

  // Uppdatera notering
  const updateNote = async (stationId: string, note: string) => {
    setReviews(prev => prev.map(r => r.station_id === stationId ? { ...r, note } : r))
    try {
      await EgenkontrollService.upsertReview(caseData.id, stationId, { note: note || null })
    } catch (e: any) {
      toast.error('Kunde inte spara notering')
    }
  }

  // Bilduppladdning per station
  const handleImageUpload = async (stationId: string, files: FileList) => {
    if (!files.length) return
    try {
      for (const file of Array.from(files)) {
        await CaseImageService.uploadCaseImage(
          caseData.id,
          'contract',
          file,
          ['general'],
          `egenkontroll:${stationId}`,
          profile?.id
        )
      }
      // Uppdatera bildlistan
      const all = await CaseImageService.getCaseImages(caseData.id, 'contract')
      const filtered = all.filter(img => img.description === `egenkontroll:${stationId}`)
      setStationImages(prev => new Map(prev).set(stationId, filtered))
      toast.success('Bild uppladdad')
    } catch (e: any) {
      toast.error('Kunde inte ladda upp bild')
    }
  }

  const reviewedCount = reviews.filter(r => {
    return EGENKONTROLL_ITEMS.some(item => r[item.key])
  }).length

  const selectedStationIds = new Set(reviews.map(r => r.station_id))

  const filteredAllStations = allStations.filter(s => {
    if (!stationSearch.trim()) return true
    const q = stationSearch.toLowerCase()
    return s.serial_number?.toLowerCase().includes(q) || s.comment?.toLowerCase().includes(q)
  })

  const modalTitle = (
    <div className="flex items-center gap-2">
      <span>Ärende: {formData.case_number || 'Laddar...'}</span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
        <ClipboardCheck className="w-3 h-3" />
        Egenkontroll
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
          <div className="space-y-3">

            {/* Kundinformation */}
            {customerData && (
              <div className="bg-gradient-to-r from-emerald-900/20 to-teal-900/20 rounded-xl p-4 border border-emerald-500/30">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-emerald-400" />
                  Kundinformation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-emerald-300 mb-1">Region</label>
                    <p className="text-white font-medium">{customerData.company_name}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    {formData.contact_person && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        {formData.contact_person}
                      </div>
                    )}
                    {formData.contact_phone && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        {formData.contact_phone}
                      </div>
                    )}
                    {formData.contact_email && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-emerald-400" />
                        {formData.contact_email}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ärendeinformation */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                Ärendeinformation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                  <Select
                    value={formData.status}
                    onChange={val => setFormData(prev => ({ ...prev, status: val }))}
                    options={DROPDOWN_STATUSES.map(s => ({ value: s, label: s }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Planerat datum</label>
                  <DatePicker
                    selected={formData.scheduled_start}
                    onChange={date => setFormData(prev => ({ ...prev, scheduled_start: date }))}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="yyyy-MM-dd HH:mm"
                    locale="sv"
                    placeholderText="Välj datum och tid"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  />
                </div>
              </div>
            </div>

            {/* Ansvarig */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                Ansvarig
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Primär ansvarig</label>
                  <select
                    value={formData.primary_technician_id}
                    onChange={e => {
                      const tech = technicians.find(t => t.id === e.target.value)
                      setFormData(prev => ({
                        ...prev,
                        primary_technician_id: e.target.value,
                        primary_technician_name: tech?.name || '',
                      }))
                    }}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  >
                    <option value="">Välj ansvarig...</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Sekundär ansvarig</label>
                  <select
                    value={formData.secondary_technician_id}
                    onChange={e => {
                      const tech = technicians.find(t => t.id === e.target.value)
                      setFormData(prev => ({
                        ...prev,
                        secondary_technician_id: e.target.value,
                        secondary_technician_name: tech?.name || '',
                      }))
                    }}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                  >
                    <option value="">Ingen</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Stationsval */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Stationer att granska
                  <span className="text-xs text-slate-400 font-normal">({reviews.length} valda)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowStationPicker(prev => !prev)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#20c58f]/10 border border-[#20c58f]/30 text-[#20c58f] rounded-lg hover:bg-[#20c58f]/20 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Lägg till stationer
                </button>
              </div>

              {/* Stationspicker */}
              {showStationPicker && (
                <div className="mb-3 p-3 bg-slate-800/50 border border-slate-600 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={stationSearch}
                        onChange={e => setStationSearch(e.target.value)}
                        placeholder="Sök station..."
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStationPicker(false)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {loadingStations ? (
                    <p className="text-xs text-slate-400 text-center py-2">Laddar stationer...</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredAllStations.map(station => {
                        const already = selectedStationIds.has(station.id)
                        return (
                          <button
                            key={station.id}
                            type="button"
                            disabled={already}
                            onClick={() => addStation(station)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              already
                                ? 'text-slate-500 cursor-not-allowed'
                                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                            }`}
                          >
                            <span className="font-medium">#{station.serial_number || '—'}</span>
                            <span className="text-slate-400 truncate ml-2">{station.comment || ''}</span>
                            {already && <Check className="w-3 h-3 text-[#20c58f] ml-2 flex-shrink-0" />}
                          </button>
                        )
                      })}
                      {filteredAllStations.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-2">Inga stationer hittades</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Lista med valda stationer */}
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-3">
                  Inga stationer valda. Lägg till stationer att granska ovan.
                </p>
              ) : (
                <div className="space-y-2">
                  {reviews.map(review => {
                    const station = allStations.find(s => s.id === review.station_id)
                    const isExpanded = expandedStation === review.station_id
                    const checkedCount = EgenkontrollService.countChecked(review)
                    const latestLog = latestLogs.get(review.station_id)
                    const stationAnns = latestAnnotations.filter(a => a.station_id === review.station_id)
                    const images = stationImages.get(review.station_id) || []

                    return (
                      <div key={review.station_id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                        {/* Stationsrad header */}
                        <div
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-700/30 transition-colors"
                          onClick={() => setExpandedStation(isExpanded ? null : review.station_id)}
                        >
                          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <span className="text-sm font-medium text-white">
                            #{station?.serial_number || '—'}
                          </span>
                          {station?.comment && (
                            <span className="text-xs text-slate-400 truncate flex-1">{station.comment}</span>
                          )}
                          {/* Checklista-progress */}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            checkedCount === EGENKONTROLL_ITEMS.length
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : checkedCount > 0
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-700/50 text-slate-400'
                          }`}>
                            {checkedCount}/{EGENKONTROLL_ITEMS.length}
                          </span>
                          {/* Senaste rondering-status */}
                          {latestLog && (
                            <span className={`text-xs ${STATUS_COLOR[latestLog.status] || 'text-slate-400'}`}>
                              {STATUS_LABEL[latestLog.status] || latestLog.status}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeStation(review.station_id) }}
                            className="ml-auto p-1 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                            title="Ta bort från granskning"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Expanderad granskningspanel */}
                        {isExpanded && (
                          <div className="border-t border-slate-700/50 px-3 py-3 space-y-3">

                            {/* Senaste rondering-data (read-only) */}
                            {latestLog && (
                              <div className="p-2.5 bg-slate-700/30 border border-slate-600/50 rounded-lg">
                                <p className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                                  <Eye className="w-3 h-3 text-slate-400" />
                                  Senaste rondering
                                </p>
                                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                                  <span>
                                    Status: <span className={STATUS_COLOR[latestLog.status] || 'text-white'}>{STATUS_LABEL[latestLog.status] || latestLog.status}</span>
                                  </span>
                                  {latestLog.bait_consumed && (
                                    <span>
                                      Bete: <span className={BAIT_COLOR[latestLog.bait_consumed] || 'text-white'}>{BAIT_LABEL[latestLog.bait_consumed]}</span>
                                    </span>
                                  )}
                                  <span>
                                    {formatDateTime(latestLog.inspected_at)}
                                  </span>
                                  {latestLog.technician_name && (
                                    <span>{latestLog.technician_name}</span>
                                  )}
                                </div>
                                {latestLog.note && (
                                  <p className="text-xs text-slate-300 mt-1 italic">"{latestLog.note}"</p>
                                )}
                              </div>
                            )}

                            {/* Avvikelser från senaste rondering (read-only) */}
                            {stationAnns.length > 0 && (
                              <div className="p-2.5 bg-amber-900/10 border border-amber-500/20 rounded-lg">
                                <p className="text-xs font-semibold text-amber-300 mb-1.5 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Avvikelser från rondering ({stationAnns.length})
                                </p>
                                {stationAnns.map(ann => (
                                  <p key={ann.id} className="text-xs text-slate-400">
                                    {ann.note || ann.category}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Checklista */}
                            <div>
                              <p className="text-xs font-semibold text-white mb-2 flex items-center gap-1">
                                <ClipboardCheck className="w-3 h-3 text-[#20c58f]" />
                                ISY-ROAD kontrollpunkter
                              </p>
                              <div className="space-y-1.5">
                                {EGENKONTROLL_ITEMS.map(item => {
                                  const checked = review[item.key] as boolean
                                  return (
                                    <label
                                      key={item.key}
                                      className="flex items-start gap-2 cursor-pointer group"
                                    >
                                      <div
                                        onClick={() => toggleCheckItem(review.station_id, item.key as keyof EgenkontrollStationReview, checked)}
                                        className="mt-0.5 flex-shrink-0"
                                      >
                                        {checked ? (
                                          <CheckSquare className="w-4 h-4 text-[#20c58f]" />
                                        ) : (
                                          <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                                        )}
                                      </div>
                                      <span className={`text-xs leading-relaxed ${checked ? 'text-slate-300' : 'text-slate-400'}`}>
                                        {item.label}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Notering */}
                            <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">Notering / avvikelse</label>
                              <textarea
                                value={review.note || ''}
                                onChange={e => updateNote(review.station_id, e.target.value)}
                                rows={2}
                                placeholder="Skriv en notering eller beskriv avvikelse..."
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] resize-none"
                              />
                            </div>

                            {/* Bilder */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-medium text-slate-400">Bilder</label>
                                <button
                                  type="button"
                                  onClick={() => fileInputRefs.current.get(review.station_id)?.click()}
                                  className="flex items-center gap-1 text-xs text-[#20c58f] hover:text-emerald-300 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  Ladda upp
                                </button>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  ref={el => {
                                    if (el) fileInputRefs.current.set(review.station_id, el)
                                  }}
                                  onChange={e => e.target.files && handleImageUpload(review.station_id, e.target.files)}
                                />
                              </div>
                              {images.length > 0 ? (
                                <div className="flex gap-2 flex-wrap">
                                  {images.map((img, idx) => (
                                    <button
                                      key={img.id}
                                      type="button"
                                      onClick={() => setLightbox({
                                        images: images.map(i => ({ url: i.url, alt: `Bild ${i.id}` })),
                                        index: idx,
                                      })}
                                      className="w-16 h-16 rounded-lg overflow-hidden border border-slate-600 hover:border-[#20c58f]/50 transition-colors flex-shrink-0"
                                    >
                                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">Inga bilder uppladdade</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sammanfattning */}
            {reviews.length > 0 && (
              <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-400">
                  <span className="text-white font-medium">{reviewedCount}</span> av <span className="text-white font-medium">{reviews.length}</span> stationer har minst en bockat checkpunkt
                  {' · '}
                  <span className="text-white font-medium">{reviews.filter(r => EgenkontrollService.countChecked(r) === EGENKONTROLL_ITEMS.length).length}</span> helt godkända
                </p>
              </div>
            )}

            {/* Karta med avvikelser */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                Karta och avvikelser
              </h3>
              {caseData && (
                <RonderingMapSection
                  caseId={caseData.id}
                  customerId={caseData.customer_id}
                  annotations={annotations}
                  onAnnotationsChange={setAnnotations}
                  technicianName={formData.primary_technician_name || profile?.full_name || null}
                />
              )}
            </div>

            {/* Notering om ärendet */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-slate-400" />
                Övergripande notering
              </h3>
              <textarea
                value={formData.work_report}
                onChange={e => setFormData(prev => ({ ...prev, work_report: e.target.value }))}
                rows={2}
                placeholder="Sammanfattning av egenkontrollbesöket..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] resize-none"
              />
            </div>

          </div>
        </div>
      </Modal>

      {/* Avvikelse-lightbox */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          isOpen={true}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Radera */}
      {showDeleteDialog && (
        <DeleteCaseConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={async () => {
            await supabase.from('cases').delete().eq('id', caseData.id)
            setShowDeleteDialog(false)
            onSuccess?.()
            onClose()
          }}
          caseNumber={formData.case_number}
        />
      )}

      {/* Kommunikationspanel */}
      <CommunicationSlidePanel
        isOpen={showCommunicationPanel}
        onClose={() => setShowCommunicationPanel(false)}
        caseId={caseData?.id}
        caseType={'contract' as CaseType}
        caseNumber={formData.case_number}
      />

      {/* Besökshistorik */}
      {showVisitHistoryPanel && caseData?.id && (
        <VisitHistoryPanel
          caseId={caseData.id}
          caseTitle={formData.case_number || caseData?.title || 'Egenkontroll'}
          onClose={() => setShowVisitHistoryPanel(false)}
        />
      )}

      {/* Återbesök */}
      {showActionDialog && caseData && (
        <RevisitContractModal
          isOpen={showActionDialog}
          onClose={() => setShowActionDialog(false)}
          originalCase={caseData}
          onSuccess={() => {
            setShowActionDialog(false)
            onSuccess?.()
          }}
        />
      )}
    </>
  )
}
