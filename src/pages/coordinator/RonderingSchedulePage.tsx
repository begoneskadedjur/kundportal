// src/pages/coordinator/RonderingSchedulePage.tsx
// Central schemaläggningssida för rondering och egenkontroll
// Delas mellan koordinator (/koordinator/rondering-schema) och admin (/admin/rondering-schema)

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarRange, Plus, Pause, Play, Trash2, Edit3,
  Loader2, Search, ChevronDown, ChevronUp, X, AlertTriangle,
  Calendar, Clock, User, Building2, Filter
} from 'lucide-react'
import { format } from 'date-fns'
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
import { FREQUENCY_CONFIG, DAY_PATTERN_CONFIG } from '../../types/recurringSchedule'
import type { RecurringScheduleWithRelations } from '../../types/recurringSchedule'

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

interface Technician {
  id: string
  name: string
}

// ============================================================
// NEW SCHEDULE SELECTOR MODAL
// ============================================================

interface NewScheduleSelectorProps {
  onClose: () => void
  onConfirm: (customerId: string, customerName: string, technicianId: string, serviceType: string, contractEndDate: string | null) => void
}

const SERVICE_TYPE_OPTIONS = [
  { value: 'inspection', label: 'Stationskontroll (inspektion)' },
  { value: 'rondering_trafikkontoret', label: 'Rondering Trafikkontoret' },
  { value: 'egenkontroll_trafikkontoret', label: 'Egenkontroll' },
]

function NewScheduleSelector({ onClose, onConfirm }: NewScheduleSelectorProps) {
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
      setCustomers((custResult.data || []) as Customer[])
      setTechnicians((techResult.data || []) as Technician[])
      setLoadingData(false)
    }
    loadData()
  }, [])

  const filteredCustomers = customers.filter(c =>
    c.company_name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const canConfirm = selectedCustomer && selectedTechnicianId && selectedServiceType

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
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
              {/* Kund */}
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

              {/* Ärendetyp */}
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

              {/* Tekniker */}
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

        {/* Footer */}
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
// SERVICE TYPE LABEL
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

// ============================================================
// SCHEDULE CARD
// ============================================================

interface FutureSession {
  id: string
  scheduled_at: string
  scheduled_end: string | null
  status: string
}

interface ScheduleCardProps {
  schedule: RecurringScheduleWithRelations
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onEdit: () => void
  actionLoading: string | null
}

function ScheduleCard({ schedule, onPause, onResume, onCancel, onEdit, actionLoading }: ScheduleCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [sessions, setSessions] = useState<FutureSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  const loadSessions = async () => {
    if (sessions.length > 0) return
    setLoadingSessions(true)
    const data = await getFutureSessionsForSchedule(schedule.id)
    setSessions(data as FutureSession[])
    setLoadingSessions(false)
  }

  const handleToggle = () => {
    if (!expanded) loadSessions()
    setExpanded(v => !v)
  }

  const freqLabel = FREQUENCY_CONFIG[schedule.frequency]?.label || schedule.frequency
  const dayLabel = DAY_PATTERN_CONFIG[schedule.day_pattern]?.label || schedule.day_pattern
  const isActive = schedule.status === 'active'
  const isPaused = schedule.status === 'paused'
  const loading = actionLoading === schedule.id

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
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
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="w-3 h-3" />
                {freqLabel}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                {schedule.preferred_time}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <User className="w-3 h-3" />
                {schedule.technician?.name || '—'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{dayLabel}</p>
          </div>

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
              onClick={onCancel}
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
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {sessions.slice(0, 12).map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs py-1 px-2 bg-slate-800/50 rounded-lg">
                    <span className="text-slate-300">
                      {format(new Date(s.scheduled_at), 'd MMM yyyy', { locale: sv })}
                    </span>
                    <span className="text-slate-400">
                      {format(new Date(s.scheduled_at), 'HH:mm')}
                      {s.scheduled_end ? ` – ${format(new Date(s.scheduled_end), 'HH:mm')}` : ''}
                    </span>
                  </div>
                ))}
                {sessions.length > 12 && (
                  <p className="text-xs text-slate-500 text-center py-1">
                    + {sessions.length - 12} fler tillfällen
                  </p>
                )}
              </div>
            </div>
          )}
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
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>('all')

  // Modals
  const [showSelector, setShowSelector] = useState(false)
  const [wizardConfig, setWizardConfig] = useState<{
    customerId: string
    customerName: string
    technicianId: string
    serviceType: string
    contractEndDate: string | null
  } | null>(null)
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null)

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    const data = await getAllRecurringSchedules()
    setSchedules(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const filteredSchedules = schedules.filter(s => {
    const name = s.customer?.company_name?.toLowerCase() || ''
    const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase())
    const matchType = serviceTypeFilter === 'all'
    return matchSearch && matchType
  })

  const handlePause = async (id: string) => {
    setActionLoading(id)
    const ok = await pauseRecurringSchedule(id)
    if (ok) {
      toast.success('Schema pausat')
      loadSchedules()
    } else {
      toast.error('Kunde inte pausa schemat')
    }
    setActionLoading(null)
  }

  const handleResume = async (id: string) => {
    setActionLoading(id)
    const ok = await resumeRecurringSchedule(id)
    if (ok) {
      toast.success('Schema återupptat')
      loadSchedules()
    } else {
      toast.error('Kunde inte återuppta schemat')
    }
    setActionLoading(null)
  }

  const handleCancel = async (id: string, customerName: string) => {
    if (!confirm(`Avboka schemat för ${customerName}? Alla framtida tillfällen tas bort.`)) return
    setActionLoading(id)
    const ok = await cancelRecurringSchedule(id)
    if (ok) {
      toast.success('Schema avbokat')
      loadSchedules()
    } else {
      toast.error('Kunde inte avboka schemat')
    }
    setActionLoading(null)
  }

  const handleSelectorConfirm = (
    customerId: string,
    customerName: string,
    technicianId: string,
    serviceType: string,
    contractEndDate: string | null
  ) => {
    setShowSelector(false)
    setWizardConfig({ customerId, customerName, technicianId, serviceType, contractEndDate })
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

      {/* Schedule list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#20c58f]" />
        </div>
      ) : filteredSchedules.length === 0 ? (
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
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{filteredSchedules.length} schema{filteredSchedules.length !== 1 ? 'n' : ''}</p>
          {filteredSchedules.map(s => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              onPause={() => handlePause(s.id)}
              onResume={() => handleResume(s.id)}
              onCancel={() => handleCancel(s.id, s.customer?.company_name || 'kunden')}
              onEdit={() => setEditScheduleId(s.id)}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* New schedule selector */}
      {showSelector && (
        <NewScheduleSelector
          onClose={() => setShowSelector(false)}
          onConfirm={handleSelectorConfirm}
        />
      )}

      {/* Recurring schedule wizard */}
      {wizardConfig && (
        <RecurringScheduleWizard
          isOpen={true}
          onClose={() => setWizardConfig(null)}
          onComplete={() => {
            setWizardConfig(null)
            loadSchedules()
          }}
          customerId={wizardConfig.customerId}
          customerName={wizardConfig.customerName}
          technicianId={wizardConfig.technicianId}
          contractEndDate={wizardConfig.contractEndDate}
          serviceType={wizardConfig.serviceType}
        />
      )}

      {/* Edit schedule modal */}
      {editScheduleId && (
        <EditScheduleModal
          isOpen={true}
          onClose={() => setEditScheduleId(null)}
          onUpdated={() => {
            setEditScheduleId(null)
            loadSchedules()
          }}
          scheduleId={editScheduleId}
        />
      )}
    </div>
  )
}
