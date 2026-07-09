// src/pages/coordinator/RonderingSchedulePage.tsx
// Central schemaläggningssida för rondering och egenkontroll
// Delas mellan koordinator (/koordinator/rondering-schema) och admin (/admin/rondering-schema)

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarRange, Plus, Pause, Play, Trash2, Edit3,
  Loader2, Search, ChevronDown, ChevronUp, X,
  Calendar, Clock, User, ExternalLink, Building2
} from 'lucide-react'
import { format, differenceInMonths } from 'date-fns'
import { sv } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import {
  getAllRecurringSchedules,
  getFutureSessionsForSchedule,
  pauseRecurringSchedule,
  resumeRecurringSchedule,
  cancelRecurringSchedule
} from '../../services/recurringScheduleService'
import { RecurringScheduleWizard } from '../../components/technician/RecurringScheduleWizard'
import { EditScheduleModal } from '../../components/technician/EditScheduleModal'
import EditContractCaseModal from '../../components/coordinator/EditContractCaseModal'
import RonderingCaseModal from '../../components/coordinator/RonderingCaseModal'
import { FREQUENCY_CONFIG, DAY_PATTERN_CONFIG } from '../../types/recurringSchedule'
import type { RecurringScheduleWithRelations, RecurringFrequency, BatchScheduleUnit } from '../../types/recurringSchedule'

// ============================================================
// TYPES
// ============================================================

type ServiceTypeFilter = 'all' | 'inspection' | 'rondering_trafikkontoret' | 'egenkontroll_trafikkontoret'

interface Customer {
  id: string
  company_name: string
  contact_address: string | null
  contract_start_date: string | null
  contract_end_date: string | null
}

interface MultisiteCustomer {
  id: string
  company_name: string
  site_name: string | null
  site_type: string | null
  parent_customer_id: string | null
  organization_id: string | null
  is_multisite: boolean
  is_regional: boolean
  region: string | null
  contact_address: string | null
  contract_end_date: string | null
}

interface UnitRow {
  customerId: string
  siteName: string
  region: string | null
  contractEndDate: string | null
  address: string | null
  schedules: RecurringScheduleWithRelations[]
}

interface OrgGroup {
  organizationId: string
  parentName: string
  parentId: string
  isRegional: boolean
  units: UnitRow[]
}

interface Technician {
  id: string
  name: string
}

interface FutureSession {
  id: string
  scheduled_at: string
  scheduled_end: string | null
  status: string
  case_id: string | null
}

// ============================================================
// HELPERS
// ============================================================

function serviceTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'rondering_trafikkontoret': return 'Rondering Trafikkontoret'
    case 'egenkontroll_trafikkontoret': return 'Egenkontroll'
    case 'inspection': return 'Stationskontroll'
    default: return 'Stationskontroll'
  }
}

function serviceTypeBadge(type: string | null | undefined): string {
  switch (type) {
    case 'rondering_trafikkontoret': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    case 'egenkontroll_trafikkontoret': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
    default: return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
  }
}

function visitsPerPeriodLabel(frequency: RecurringFrequency): string {
  return FREQUENCY_CONFIG[frequency]?.description || frequency
}

function periodRemainingLabel(contractEndDate: string | null): string {
  if (!contractEndDate) return 'Avtalsslut ej satt'
  const end = new Date(contractEndDate)
  const now = new Date()
  if (end <= now) return 'Avtal utgånget'
  const months = differenceInMonths(end, now)
  if (months < 1) return 'Slutar snart'
  if (months < 12) return `${months} mån kvar`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years} år ${rem} mån kvar` : `${years} år kvar`
}

// ============================================================
// NEW SCHEDULE SELECTOR MODAL
// ============================================================

interface NewScheduleSelectorProps {
  onClose: () => void
  onConfirm: (customerId: string, customerName: string, technicianId: string, serviceType: string, contractEndDate: string | null) => void
  prefilledCustomerId?: string | null
}

const SERVICE_TYPE_OPTIONS = [
  { value: 'inspection', label: 'Stationskontroll (inspektion)' },
  { value: 'rondering_trafikkontoret', label: 'Rondering Trafikkontoret' },
  { value: 'egenkontroll_trafikkontoret', label: 'Egenkontroll' },
]

function NewScheduleSelector({ onClose, onConfirm, prefilledCustomerId }: NewScheduleSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [selectedServiceType, setSelectedServiceType] = useState('inspection')
  const [showCustomerList, setShowCustomerList] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true)
      const [custResult, techResult] = await Promise.all([
        supabase
          .from('customers')
          .select('id, company_name, contact_address, contract_start_date, contract_end_date')
          .order('company_name'),
        supabase
          .from('technicians')
          .select('id, name')
          .order('name')
      ])
      const customerList = (custResult.data || []) as Customer[]
      setCustomers(customerList)
      setTechnicians((techResult.data || []) as Technician[])
      if (prefilledCustomerId) {
        const found = customerList.find(c => c.id === prefilledCustomerId)
        if (found) setSelectedCustomer(found)
      }
      setLoadingData(false)
    }
    loadData()
  }, [prefilledCustomerId])

  const filteredCustomers = customers.filter(c =>
    c.company_name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const canConfirm = selectedCustomer && selectedTechnicianId && selectedServiceType

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-[#20c58f]" />
            <h2 className="text-base font-semibold text-white">Nytt återkommande schema</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loadingData ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#20c58f]" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Kund</label>
                <div className="relative">
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-white">{selectedCustomer.company_name}</p>
                        {selectedCustomer.contact_address && (
                          <p className="text-xs text-slate-400">{selectedCustomer.contact_address}</p>
                        )}
                      </div>
                      <button
                        onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Sök kund..."
                          value={customerSearch}
                          onChange={e => { setCustomerSearch(e.target.value); setShowCustomerList(true) }}
                          onFocus={() => setShowCustomerList(true)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                        />
                      </div>
                      {showCustomerList && filteredCustomers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {filteredCustomers.slice(0, 20).map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedCustomer(c)
                                setShowCustomerList(false)
                                setCustomerSearch('')
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors"
                            >
                              <p className="text-sm text-white">{c.company_name}</p>
                              {c.contact_address && (
                                <p className="text-xs text-slate-400">{c.contact_address}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Ärendetyp</label>
                <select
                  value={selectedServiceType}
                  onChange={e => setSelectedServiceType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                >
                  {SERVICE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Ansvarig tekniker</label>
                <select
                  value={selectedTechnicianId}
                  onChange={e => setSelectedTechnicianId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                >
                  <option value="">Välj tekniker...</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={() => {
              if (!selectedCustomer || !selectedTechnicianId) return
              onConfirm(
                selectedCustomer.id,
                selectedCustomer.company_name,
                selectedTechnicianId,
                selectedServiceType,
                selectedCustomer.contract_end_date
              )
            }}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#20c58f] hover:bg-[#1aaa7a] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Fortsätt till schemaläggning
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CANCEL CONFIRM MODAL
// ============================================================

interface CancelConfirmModalProps {
  customerName: string
  sessionCount: number
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}

function CancelConfirmModal({ customerName, sessionCount, onClose, onConfirm, loading }: CancelConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h2 className="text-base font-semibold text-white">Avboka schema</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-300">
            Du håller på att avboka schemat för <span className="font-semibold text-white">{customerName}</span>.
          </p>
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
            <p className="text-xs text-red-400 font-medium">Detta kommer att:</p>
            <ul className="text-xs text-red-300 space-y-0.5 list-disc list-inside">
              <li>Ta bort schemat permanent</li>
              {sessionCount > 0 && (
                <li>Sätta {sessionCount} framtida bokade ärende{sessionCount !== 1 ? 'n' : ''} som borttagna</li>
              )}
            </ul>
          </div>
          <p className="text-xs text-slate-500">Åtgärden kan inte ångras. Redan genomförda ärenden påverkas inte.</p>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
          >
            Avbryt
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Avboka och ta bort ärenden
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SCHEDULE CARD
// ============================================================

interface ScheduleCardProps {
  schedule: RecurringScheduleWithRelations
  onPause: () => void
  onResume: () => void
  onCancel: (sessionCount: number) => void
  onEdit: () => void
  actionLoading: string | null
}

function ScheduleCard({ schedule, onPause, onResume, onCancel, onEdit, actionLoading }: ScheduleCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [sessions, setSessions] = useState<FutureSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  // Modal state for opening individual cases
  const [openCaseData, setOpenCaseData] = useState<{ data: any; type: 'rondering' | 'contract' } | null>(null)
  const [loadingCaseId, setLoadingCaseId] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    if (sessionsLoaded) return
    setLoadingSessions(true)
    const data = await getFutureSessionsForSchedule(schedule.id)
    setSessions(data as FutureSession[])
    setLoadingSessions(false)
    setSessionsLoaded(true)
  }, [schedule.id, sessionsLoaded])

  // Load session count lazily on mount (for the summary chip)
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleToggle = () => {
    setExpanded(v => !v)
  }

  const handleOpenCase = async (session: FutureSession) => {
    if (!session.case_id) {
      toast.error('Ärende saknas för detta tillfälle')
      return
    }
    setLoadingCaseId(session.id)
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', session.case_id)
      .single()
    setLoadingCaseId(null)
    if (error || !data) {
      toast.error('Kunde inte ladda ärendet')
      return
    }
    const type = data.service_type === 'rondering_trafikkontoret' ? 'rondering' : 'contract'
    setOpenCaseData({ data, type })
  }

  const freqLabel = FREQUENCY_CONFIG[schedule.frequency]?.label || schedule.frequency
  const dayLabel = DAY_PATTERN_CONFIG[schedule.day_pattern]?.label || schedule.day_pattern
  const visitsLabel = visitsPerPeriodLabel(schedule.frequency)
  const remainingLabel = periodRemainingLabel(schedule.contract_end_date)
  const isActive = schedule.status === 'active'
  const isPaused = schedule.status === 'paused'
  const loading = actionLoading === schedule.id

  // Period display: start → end
  const startStr = schedule.schedule_start_date
    ? format(new Date(schedule.schedule_start_date), 'MMM yyyy', { locale: sv })
    : null
  const endStr = schedule.contract_end_date
    ? format(new Date(schedule.contract_end_date), 'MMM yyyy', { locale: sv })
    : null

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">
                {schedule.customer?.company_name || '—'}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${serviceTypeBadge(undefined)}`}>
                {serviceTypeLabel(undefined)}
              </span>
              {isPaused && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-medium">
                  Pausad
                </span>
              )}
            </div>

            {/* Row 1: frekvens, tid, tekniker */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-slate-300 font-medium">
                <Calendar className="w-3 h-3 text-slate-400" />
                {freqLabel}
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400">{visitsLabel}</span>
              <span className="text-xs text-slate-500">·</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                {schedule.preferred_time} ({schedule.estimated_duration_minutes} min)
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <User className="w-3 h-3" />
                {schedule.technician?.name || '—'}
              </span>
            </div>

            {/* Row 2: period + sessions count */}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-slate-500">{dayLabel}</span>
              {(startStr || endStr) && (
                <>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-500">
                    {startStr && endStr ? `${startStr} – ${endStr}` : startStr || endStr}
                    {' '}
                    <span className="text-slate-600">({remainingLabel})</span>
                  </span>
                </>
              )}
              {sessionsLoaded && sessions.length > 0 && (
                <>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-[#20c58f] font-medium">{sessions.length} tillfällen kvar</span>
                </>
              )}
              {loadingSessions && !sessionsLoaded && (
                <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onEdit}
              disabled={loading}
              title="Redigera schema"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            {isActive && (
              <button
                onClick={onPause}
                disabled={loading}
                title="Pausa schema"
                className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-slate-700 transition-colors disabled:opacity-40"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            )}
            {isPaused && (
              <button
                onClick={onResume}
                disabled={loading}
                title="Återuppta schema"
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors disabled:opacity-40"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => onCancel(sessions.length)}
              disabled={loading}
              title="Avboka schema"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleToggle}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded: session list */}
      {expanded && (
        <div className="border-t border-slate-700/50 px-3 py-2">
          {loadingSessions ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#20c58f]" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">Inga kommande tillfällen planerade.</p>
          ) : (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1.5">Kommande tillfällen ({sessions.length} st)</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleOpenCase(s)}
                    disabled={!s.case_id || loadingCaseId === s.id}
                    className="w-full flex items-center justify-between text-xs py-1.5 px-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/60 transition-colors group disabled:opacity-50 disabled:cursor-default"
                  >
                    <span className="text-slate-300 group-hover:text-white transition-colors">
                      {format(new Date(s.scheduled_at), 'd MMM yyyy', { locale: sv })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">
                        {format(new Date(s.scheduled_at), 'HH:mm')}
                        {s.scheduled_end ? ` – ${format(new Date(s.scheduled_end), 'HH:mm')}` : ''}
                      </span>
                      {loadingCaseId === s.id ? (
                        <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                      ) : s.case_id ? (
                        <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-[#20c58f] transition-colors" />
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Case modals */}
      {openCaseData?.type === 'contract' && (
        <EditContractCaseModal
          isOpen={true}
          onClose={() => setOpenCaseData(null)}
          onSuccess={() => setOpenCaseData(null)}
          caseData={openCaseData.data}
        />
      )}
      {openCaseData?.type === 'rondering' && (
        <RonderingCaseModal
          isOpen={true}
          onClose={() => setOpenCaseData(null)}
          onSuccess={() => setOpenCaseData(null)}
          caseData={openCaseData.data}
        />
      )}
    </div>
  )
}

// ============================================================
// ORG BATCH SELECTOR MODAL
// ============================================================

interface OrgBatchSelectorProps {
  group: OrgGroup
  onClose: () => void
  onConfirm: (technicianId: string, serviceType: string) => void
}

function OrgBatchSelector({ group, onClose, onConfirm }: OrgBatchSelectorProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [selectedServiceType, setSelectedServiceType] = useState('rondering_trafikkontoret')

  const unitsWithoutSchedule = group.units.filter(u => u.schedules.length === 0)
  const targetCount = unitsWithoutSchedule.length > 0 ? unitsWithoutSchedule.length : group.units.length

  useEffect(() => {
    supabase.from('technicians').select('id, name').order('name').then(({ data }) => {
      setTechnicians((data || []) as Technician[])
      setLoadingData(false)
    })
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#20c58f]" />
            <div>
              <h2 className="text-base font-semibold text-white">Schemalägg hela organisationen</h2>
              <p className="text-xs text-slate-400">{group.parentName} · {targetCount} {group.isRegional ? 'regioner' : 'enheter'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loadingData ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#20c58f]" /></div>
          ) : (
            <>
              {unitsWithoutSchedule.length > 0 && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-400">
                    {unitsWithoutSchedule.length} av {group.units.length} {group.isRegional ? 'regioner' : 'enheter'} saknar schema — dessa schemaläggs nu.
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Ärendetyp</label>
                <select
                  value={selectedServiceType}
                  onChange={e => setSelectedServiceType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                >
                  {SERVICE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Ansvarig tekniker</label>
                <select
                  value={selectedTechnicianId}
                  onChange={e => setSelectedTechnicianId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                >
                  <option value="">Välj tekniker...</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            Avbryt
          </button>
          <button
            onClick={() => onConfirm(selectedTechnicianId, selectedServiceType)}
            disabled={!selectedTechnicianId}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#20c58f] hover:bg-[#1aaa7a] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Fortsätt till schemaläggning
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ORG GROUP CARD
// ============================================================

interface OrgGroupCardProps {
  group: OrgGroup
  actionLoading: string | null
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string, name: string, sessionCount: number) => void
  onEdit: (id: string) => void
  onAddUnit: (unit: UnitRow) => void
  onScheduleAll: () => void
}

function OrgGroupCard({
  group, actionLoading, onPause, onResume, onCancel, onEdit, onAddUnit, onScheduleAll
}: OrgGroupCardProps) {
  const [expanded, setExpanded] = useState(true)

  const totalSchedules = group.units.reduce((sum, u) => sum + u.schedules.length, 0)
  const unitsWithout = group.units.filter(u => u.schedules.length === 0).length
  const unitLabel = group.isRegional ? 'regioner' : 'enheter'

  return (
    <div className="bg-slate-800/20 border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Org header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/40">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
        >
          <Building2 className="w-4 h-4 text-[#20c58f] shrink-0" />
          <span className="text-sm font-semibold text-white truncate">{group.parentName}</span>
          <span className="text-xs text-slate-500 shrink-0">
            {group.units.length} {unitLabel} · {totalSchedules} schema{totalSchedules !== 1 ? 'n' : ''}
          </span>
          {unitsWithout > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              {unitsWithout} utan schema
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />}
        </button>
        {unitsWithout > 0 && (
          <button
            onClick={onScheduleAll}
            className="ml-3 flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[#20c58f] hover:bg-[#1aaa7a] rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-3 h-3" />
            Schemalägg alla
          </button>
        )}
      </div>

      {/* Units list */}
      {expanded && (
        <div className="divide-y divide-slate-700/30">
          {group.units.map(unit => (
            <div key={unit.customerId} className="px-4 py-3">
              {unit.schedules.length === 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{unit.siteName}</p>
                    {unit.region && <p className="text-xs text-slate-500">{unit.region}</p>}
                    <p className="text-xs text-slate-600 mt-0.5">Inget schema</p>
                  </div>
                  <button
                    onClick={() => onAddUnit(unit)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#20c58f] border border-[#20c58f]/40 hover:bg-[#20c58f]/10 rounded-lg transition-colors shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    Lägg till
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">{unit.siteName}</p>
                  {unit.schedules.map(s => (
                    <ScheduleCard
                      key={s.id}
                      schedule={s}
                      onPause={() => onPause(s.id)}
                      onResume={() => onResume(s.id)}
                      onCancel={(sessionCount) => onCancel(s.id, unit.siteName, sessionCount)}
                      onEdit={() => onEdit(s.id)}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================

export function RonderingSchedulePage() {
  const [schedules, setSchedules] = useState<RecurringScheduleWithRelations[]>([])
  const [orgGroups, setOrgGroups] = useState<OrgGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>('all')

  const [showSelector, setShowSelector] = useState(false)
  const [selectorPrefilledCustomerId, setSelectorPrefilledCustomerId] = useState<string | null>(null)
  const [orgBatchTarget, setOrgBatchTarget] = useState<OrgGroup | null>(null)
  const [wizardConfig, setWizardConfig] = useState<{
    customerId: string
    customerName: string
    technicianId: string
    serviceType: string
    contractEndDate: string | null
    batchUnits?: BatchScheduleUnit[]
  } | null>(null)
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; customerName: string; sessionCount: number } | null>(null)

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    const [schedulesData, multisiteResult] = await Promise.all([
      getAllRecurringSchedules(),
      supabase
        .from('customers')
        .select('id, company_name, site_name, site_type, parent_customer_id, organization_id, is_multisite, is_regional, region, contact_address, contract_end_date')
        .eq('is_multisite', true)
    ])
    setSchedules(schedulesData)

    const multisiteCustomers = (multisiteResult.data || []) as MultisiteCustomer[]

    // Build org groups: find all parents (site_type = 'huvudkontor' or no parent_customer_id but is_multisite)
    const parentsMap = new Map<string, MultisiteCustomer>()
    const unitsMap = new Map<string, MultisiteCustomer[]>()

    for (const c of multisiteCustomers) {
      if (c.site_type === 'huvudkontor' || !c.parent_customer_id) {
        parentsMap.set(c.id, c)
      }
    }
    for (const c of multisiteCustomers) {
      if (c.parent_customer_id && parentsMap.has(c.parent_customer_id)) {
        const arr = unitsMap.get(c.parent_customer_id) || []
        arr.push(c)
        unitsMap.set(c.parent_customer_id, arr)
      }
    }

    const groups: OrgGroup[] = []
    for (const [parentId, parent] of parentsMap.entries()) {
      const units = unitsMap.get(parentId) || []
      if (units.length === 0) continue

      const unitRows: UnitRow[] = units.map(u => ({
        customerId: u.id,
        siteName: u.site_name || u.company_name,
        region: u.region,
        // Enheter saknar egna avtalsdatum (går ej att sätta i "Redigera enhet"-modalen),
        // så de ärver avtalsslutdatum från huvudkontoret.
        contractEndDate: u.contract_end_date ?? parent.contract_end_date,
        address: u.contact_address,
        schedules: schedulesData.filter(s => s.customer_id === u.id),
      }))

      groups.push({
        organizationId: parent.organization_id || parentId,
        parentName: parent.company_name,
        parentId,
        isRegional: units.some(u => u.is_regional),
        units: unitRows,
      })
    }

    setOrgGroups(groups)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  // IDs of customers that belong to an org group (to exclude from standalone list)
  const multisiteCustomerIds = new Set(orgGroups.flatMap(g => g.units.map(u => u.customerId)))

  const filteredSchedules = schedules.filter(s => {
    if (multisiteCustomerIds.has(s.customer_id)) return false
    const name = s.customer?.company_name?.toLowerCase() || ''
    const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase())
    const matchType = serviceTypeFilter === 'all'
    return matchSearch && matchType
  })

  const handlePause = async (id: string) => {
    setActionLoading(id)
    const ok = await pauseRecurringSchedule(id)
    if (ok) { toast.success('Schema pausat'); loadSchedules() }
    else toast.error('Kunde inte pausa schemat')
    setActionLoading(null)
  }

  const handleResume = async (id: string) => {
    setActionLoading(id)
    const ok = await resumeRecurringSchedule(id)
    if (ok) { toast.success('Schema återupptat'); loadSchedules() }
    else toast.error('Kunde inte återuppta schemat')
    setActionLoading(null)
  }

  const handleCancel = (id: string, customerName: string, sessionCount: number) => {
    setCancelTarget({ id, customerName, sessionCount })
  }

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return
    setActionLoading(cancelTarget.id)
    const ok = await cancelRecurringSchedule(cancelTarget.id)
    setCancelTarget(null)
    if (ok) { toast.success('Schema avbokat och ärenden borttagna'); loadSchedules() }
    else toast.error('Kunde inte avboka schemat')
    setActionLoading(null)
  }

  const handleSelectorConfirm = (
    customerId: string,
    customerName: string,
    technicianId: string,
    serviceType: string,
    contractEndDate: string | null,
    batchUnits?: BatchScheduleUnit[]
  ) => {
    setShowSelector(false)
    setSelectorPrefilledCustomerId(null)
    setWizardConfig({ customerId, customerName, technicianId, serviceType, contractEndDate, batchUnits })
  }

  const handleOpenSelectorForUnit = (unit: UnitRow) => {
    setSelectorPrefilledCustomerId(unit.customerId)
    setShowSelector(true)
  }

  const handleOrgBatchConfirm = (technicianId: string, serviceType: string) => {
    if (!orgBatchTarget) return
    const group = orgBatchTarget
    setOrgBatchTarget(null)
    const unitsWithoutSchedule = group.units.filter(u => u.schedules.length === 0)
    const targetUnits = unitsWithoutSchedule.length > 0 ? unitsWithoutSchedule : group.units
    const batchUnits: BatchScheduleUnit[] = targetUnits.map(u => ({
      customerId: u.customerId,
      customerName: u.siteName,
      address: u.address,
      durationMinutes: 60,
    }))
    setWizardConfig({
      customerId: targetUnits[0].customerId,
      customerName: targetUnits[0].siteName,
      technicianId,
      serviceType,
      contractEndDate: targetUnits[0].contractEndDate,
      batchUnits,
    })
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#20c58f]/10 rounded-xl">
            <CalendarRange className="w-5 h-5 text-[#20c58f]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Rondering & Schemaläggning</h1>
            <p className="text-xs text-slate-400">Återkommande kontroller och egenkontroller</p>
          </div>
        </div>
        <button
          onClick={() => setShowSelector(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#20c58f] hover:bg-[#1aaa7a] text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nytt schema
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Sök kund..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
          {([
            { value: 'all', label: 'Alla' },
            { value: 'rondering_trafikkontoret', label: 'Rondering' },
            { value: 'egenkontroll_trafikkontoret', label: 'Egenkontroll' },
            { value: 'inspection', label: 'Inspektion' },
          ] as { value: ServiceTypeFilter; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setServiceTypeFilter(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                serviceTypeFilter === opt.value
                  ? 'bg-[#20c58f] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#20c58f]" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Org groups */}
          {orgGroups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Organisationer</p>
              {orgGroups.map(group => (
                <OrgGroupCard
                  key={group.organizationId}
                  group={group}
                  actionLoading={actionLoading}
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                  onEdit={id => setEditScheduleId(id)}
                  onAddUnit={handleOpenSelectorForUnit}
                  onScheduleAll={() => setOrgBatchTarget(group)}
                />
              ))}
            </div>
          )}

          {/* Standalone schedules */}
          {filteredSchedules.length > 0 && (
            <div className="space-y-2">
              {orgGroups.length > 0 && (
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Övriga kunder</p>
              )}
              {filteredSchedules.map(s => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  onPause={() => handlePause(s.id)}
                  onResume={() => handleResume(s.id)}
                  onCancel={(sessionCount) => handleCancel(s.id, s.customer?.company_name || 'kunden', sessionCount)}
                  onEdit={() => setEditScheduleId(s.id)}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}

          {orgGroups.length === 0 && filteredSchedules.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <CalendarRange className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-400">
                {searchQuery || serviceTypeFilter !== 'all'
                  ? 'Inga scheman matchar sökningen'
                  : 'Inga aktiva scheman ännu'}
              </p>
              {!searchQuery && serviceTypeFilter === 'all' && (
                <button
                  onClick={() => setShowSelector(true)}
                  className="mt-3 text-xs text-[#20c58f] hover:underline"
                >
                  Skapa det första schemat
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showSelector && (
        <NewScheduleSelector
          onClose={() => { setShowSelector(false); setSelectorPrefilledCustomerId(null) }}
          onConfirm={handleSelectorConfirm}
          prefilledCustomerId={selectorPrefilledCustomerId}
        />
      )}

      {orgBatchTarget && (
        <OrgBatchSelector
          group={orgBatchTarget}
          onClose={() => setOrgBatchTarget(null)}
          onConfirm={handleOrgBatchConfirm}
        />
      )}

      {cancelTarget && (
        <CancelConfirmModal
          customerName={cancelTarget.customerName}
          sessionCount={cancelTarget.sessionCount}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
          loading={actionLoading === cancelTarget.id}
        />
      )}

      {wizardConfig && (
        <RecurringScheduleWizard
          isOpen={true}
          onClose={() => setWizardConfig(null)}
          onComplete={() => { setWizardConfig(null); loadSchedules() }}
          customerId={wizardConfig.customerId}
          customerName={wizardConfig.customerName}
          technicianId={wizardConfig.technicianId}
          contractEndDate={wizardConfig.contractEndDate}
          serviceType={wizardConfig.serviceType}
          batchUnits={wizardConfig.batchUnits && wizardConfig.batchUnits.length > 1 ? wizardConfig.batchUnits : undefined}
        />
      )}

      {editScheduleId && (
        <EditScheduleModal
          isOpen={true}
          onClose={() => setEditScheduleId(null)}
          onUpdated={() => { setEditScheduleId(null); loadSchedules() }}
          scheduleId={editScheduleId}
        />
      )}
    </div>
  )
}
