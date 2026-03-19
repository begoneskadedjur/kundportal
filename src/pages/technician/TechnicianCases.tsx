import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  Search, AlertTriangle, CalendarPlus, CalendarCheck, FileText,
  RotateCcw, FileCheck, ChevronDown, ChevronRight, ClipboardList,
  Clock, CheckCircle, AlertCircle, XCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import CaseCard, { getDaysAge } from '../../components/technician/cases/CaseCard'
import CloseCaseModal from '../../components/technician/cases/CloseCaseModal'
import { isCompletedStatus } from '../../types/database'

// ─── Exported types (used by CaseCard & CloseCaseModal) ──

export interface TechnicianCase {
  id: string
  clickup_task_id: string
  case_number?: string
  title: string
  status: string
  priority?: string
  case_type: 'private' | 'business' | 'contract'
  created_date: string
  start_date?: string
  due_date?: string
  completed_date?: string
  commission_amount?: number
  case_price?: number
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  adress?: any
  foretag?: string
  org_nr?: string
  skadedjur?: string
  description?: string
  clickup_url?: string
  assignee_name?: string
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip'
  personnummer?: string
  material_cost?: number
  time_spent_minutes?: number
  work_started_at?: string
  close_reason?: string | null
  close_reason_notes?: string | null
}

export type WorkflowGroup =
  | 'needs_action'
  | 'needs_booking'
  | 'booked'
  | 'offer_sent'
  | 'revisit'
  | 'report'

// ─── Workflow config ────────────────────────────────────

const STATUS_TO_WORKFLOW: Record<string, WorkflowGroup> = {
  'Öppen': 'needs_booking',
  'Offert signerad - boka in': 'needs_booking',
  'Bokad': 'booked',
  'Bokat': 'booked',
  'Offert skickad': 'offer_sent',
  'Återbesök': 'revisit',
  'Återbesök 1': 'revisit',
  'Återbesök 2': 'revisit',
  'Återbesök 3': 'revisit',
  'Återbesök 4': 'revisit',
  'Återbesök 5': 'revisit',
  'Bomkörning': 'needs_action',
  'Ombokning': 'needs_action',
  'Reklamation': 'needs_action',
  'Privatperson - review': 'needs_action',
  'Generera saneringsrapport': 'report',
}

interface WorkflowGroupConfig {
  label: string
  icon: React.ElementType
  color: string
  bgClass: string
  sortOrder: number
}

const WORKFLOW_GROUP_CONFIG: Record<WorkflowGroup, WorkflowGroupConfig> = {
  needs_action:  { label: 'Kräver åtgärd',  icon: AlertTriangle, color: 'text-red-400',    bgClass: 'bg-red-500/20',    sortOrder: 0 },
  needs_booking: { label: 'Behöver bokas',   icon: CalendarPlus,  color: 'text-yellow-400', bgClass: 'bg-yellow-500/20', sortOrder: 1 },
  booked:        { label: 'Inbokade',        icon: CalendarCheck, color: 'text-blue-400',   bgClass: 'bg-blue-500/20',   sortOrder: 2 },
  offer_sent:    { label: 'Offert skickad',  icon: FileText,      color: 'text-amber-400',  bgClass: 'bg-amber-500/20',  sortOrder: 3 },
  revisit:       { label: 'Återbesök',       icon: RotateCcw,     color: 'text-cyan-400',   bgClass: 'bg-cyan-500/20',   sortOrder: 4 },
  report:        { label: 'Rapport',         icon: FileCheck,     color: 'text-purple-400', bgClass: 'bg-purple-500/20', sortOrder: 5 },
}

const STALE_THRESHOLD_DAYS = 30

// ─── Component ──────────────────────────────────────────

type TabKey = 'active' | 'stale' | 'completed'

export default function TechnicianCases() {
  const { profile, isTechnician } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cases, setCases] = useState<TechnicianCase[]>([])

  const [activeTab, setActiveTab] = useState<TabKey>('active')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<WorkflowGroup>>(new Set(['needs_action', 'needs_booking']))
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<TechnicianCase | null>(null)

  // Close modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [casesToClose, setCasesToClose] = useState<TechnicianCase[]>([])

  // Batch select (stale tab)
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set())

  // ─── Auth guard ───────────────────────────────────
  useEffect(() => {
    if (profile && !isTechnician) navigate('/login', { replace: true })
  }, [isTechnician, profile, navigate])

  // ─── Data fetch ───────────────────────────────────
  useEffect(() => {
    if (isTechnician && profile?.technician_id) {
      fetchCases(profile.technician_id)
    }
  }, [isTechnician, profile?.technician_id])

  const fetchCases = async (technicianId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [privateResult, businessResult, contractResult] = await Promise.allSettled([
        supabase.from('private_cases').select('*').or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`),
        supabase.from('business_cases').select('*').or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`),
        supabase.from('cases').select('*').or(`primary_technician_id.eq.${technicianId},secondary_technician_id.eq.${technicianId},tertiary_technician_id.eq.${technicianId}`)
      ])

      const allCases: TechnicianCase[] = [
        ...(privateResult.status === 'fulfilled' ? privateResult.value.data || [] : []).map((c: any) => ({
          ...c, case_type: 'private' as const,
          created_date: c.start_date || c.created_at,
          case_price: c.pris,
          clickup_url: c.clickup_task_id ? `https://app.clickup.com/t/${c.clickup_task_id}` : undefined,
        })),
        ...(businessResult.status === 'fulfilled' ? businessResult.value.data || [] : []).map((c: any) => ({
          ...c, case_type: 'business' as const,
          created_date: c.start_date || c.created_at,
          case_price: c.pris,
          clickup_url: c.clickup_task_id ? `https://app.clickup.com/t/${c.clickup_task_id}` : undefined,
        })),
        ...(contractResult.status === 'fulfilled' ? contractResult.value.data || [] : []).map((c: any) => ({
          ...c, case_type: 'contract' as const,
          created_date: c.created_date || c.created_at,
          clickup_url: c.clickup_task_id ? `https://app.clickup.com/t/${c.clickup_task_id}` : undefined,
        })),
      ]

      setCases(allCases)
    } catch (err: any) {
      setError(err.message || 'Ett oväntat fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  // ─── Search filter ────────────────────────────────

  const matchesSearch = useCallback((c: TechnicianCase) => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return [c.title, c.case_number, c.kontaktperson, c.foretag, c.skadedjur, c.status]
      .some(v => v?.toLowerCase().includes(q))
  }, [searchTerm])

  // ─── Derived data ─────────────────────────────────

  const activeCases = useMemo(() =>
    cases.filter(c => !isCompletedStatus(c.status as any) && matchesSearch(c)),
    [cases, matchesSearch]
  )

  const groupedActive = useMemo(() => {
    const groups: Record<WorkflowGroup, TechnicianCase[]> = {
      needs_action: [], needs_booking: [], booked: [],
      offer_sent: [], revisit: [], report: [],
    }
    for (const c of activeCases) {
      const group = STATUS_TO_WORKFLOW[c.status] || 'needs_action'
      groups[group].push(c)
    }
    // Sort each group oldest first
    for (const key of Object.keys(groups) as WorkflowGroup[]) {
      groups[key].sort((a, b) => getDaysAge(b.created_date) - getDaysAge(a.created_date))
    }
    return groups
  }, [activeCases])

  const staleCases = useMemo(() =>
    cases
      .filter(c => !isCompletedStatus(c.status as any) && getDaysAge(c.created_date) >= STALE_THRESHOLD_DAYS && matchesSearch(c))
      .sort((a, b) => getDaysAge(b.created_date) - getDaysAge(a.created_date)),
    [cases, matchesSearch]
  )

  const completedCases = useMemo(() => {
    const ninetyDaysAgo = Date.now() - 90 * 86_400_000
    return cases
      .filter(c => isCompletedStatus(c.status as any) && matchesSearch(c))
      .filter(c => {
        const d = c.completed_date || c.created_date
        return d ? new Date(d).getTime() >= ninetyDaysAgo : true
      })
      .sort((a, b) => {
        const da = a.completed_date || a.created_date
        const db = b.completed_date || b.created_date
        return new Date(db).getTime() - new Date(da).getTime()
      })
  }, [cases, matchesSearch])

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      active: activeCases.length,
      needsBooking: groupedActive.needs_booking.length,
      stale: cases.filter(c => !isCompletedStatus(c.status as any) && getDaysAge(c.created_date) >= STALE_THRESHOLD_DAYS).length,
      completedMonth: cases.filter(c =>
        isCompletedStatus(c.status as any) &&
        (c.completed_date ? new Date(c.completed_date) >= monthStart : false)
      ).length,
    }
  }, [activeCases, groupedActive, cases])

  // ─── Handlers ─────────────────────────────────────

  const toggleGroup = (g: WorkflowGroup) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleEdit = (c: TechnicianCase) => {
    setSelectedCase(c)
    setIsEditModalOpen(true)
  }

  const handleCloseCase = (c: TechnicianCase) => {
    setCasesToClose([c])
    setIsCloseModalOpen(true)
  }

  const handleBatchClose = () => {
    const selected = staleCases.filter(c => selectedForBatch.has(c.id))
    if (selected.length === 0) return
    setCasesToClose(selected)
    setIsCloseModalOpen(true)
  }

  const handleCloseSuccess = (closedIds: string[]) => {
    setCases(prev => prev.map(c =>
      closedIds.includes(c.id)
        ? { ...c, status: 'Stängt - slasklogg', completed_date: new Date().toISOString() }
        : c
    ))
    setSelectedForBatch(prev => {
      const next = new Set(prev)
      closedIds.forEach(id => next.delete(id))
      return next
    })
  }

  const handleUpdateSuccess = (updatedCase: Partial<TechnicianCase>) => {
    if (updatedCase && selectedCase) {
      setSelectedCase(prev => prev ? { ...prev, ...updatedCase } : prev)
    }
    setCases(prev => prev.map(c => c.id === selectedCase?.id ? { ...c, ...updatedCase } : c))
  }

  const toggleBatchSelect = (id: string, checked: boolean) => {
    setSelectedForBatch(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  // ─── Render ───────────────────────────────────────

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <LoadingSpinner />
      <p className="text-slate-400 mt-4">Laddar ärenden...</p>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center py-20">
      <div className="p-8 max-w-md text-center bg-slate-800/50 border border-slate-700/50 rounded-xl">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Fel vid laddning</h2>
        <p className="text-slate-400 mb-4">{error}</p>
        <button
          onClick={() => fetchCases(profile?.technician_id || '')}
          className="px-4 py-2 bg-[#20c58f] hover:bg-[#1ba876] text-white rounded-lg font-medium"
        >
          Försök igen
        </button>
      </div>
    </div>
  )

  const tabs: { key: TabKey; label: string; count: number; alertColor?: string }[] = [
    { key: 'active', label: 'Aktiva', count: kpis.active },
    { key: 'stale', label: 'Gamla ärenden', count: kpis.stale, alertColor: kpis.stale > 0 ? 'bg-orange-500' : undefined },
    { key: 'completed', label: 'Avslutade', count: kpis.completedMonth },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* KPI row */}
      <div className="flex overflow-x-auto gap-3 pb-2 mb-4 snap-x lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
        {[
          { label: 'Aktiva', value: kpis.active, icon: ClipboardList, color: 'text-blue-400' },
          { label: 'Behöver bokas', value: kpis.needsBooking, icon: CalendarPlus, color: 'text-yellow-400' },
          { label: 'Gamla >30d', value: kpis.stale, icon: Clock, color: kpis.stale > 0 ? 'text-orange-400' : 'text-slate-400' },
          { label: 'Avslutade (mån)', value: kpis.completedMonth, icon: CheckCircle, color: 'text-[#20c58f]' },
        ].map(kpi => (
          <div key={kpi.label} className="min-w-[140px] snap-start bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
            <kpi.icon className={`w-6 h-6 shrink-0 ${kpi.color}`} />
            <div>
              <p className="text-xs text-slate-400">{kpi.label}</p>
              <p className="text-xl font-bold text-white">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-800/30 p-1 rounded-xl mb-4 sticky top-14 lg:top-12 z-10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearchTerm(''); setSelectedForBatch(new Set()) }}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors flex items-center justify-center gap-2 ${
              activeTab === tab.key
                ? 'bg-[#20c58f] text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab.key ? 'bg-white/20' :
              tab.alertColor ? `${tab.alertColor} text-white` : 'bg-slate-700 text-slate-300'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Sök ärenden, kunder, skadedjur..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
        />
      </div>

      {/* ═══ Active tab ═══ */}
      {activeTab === 'active' && (
        <div className="space-y-3">
          {(Object.keys(WORKFLOW_GROUP_CONFIG) as WorkflowGroup[])
            .sort((a, b) => WORKFLOW_GROUP_CONFIG[a].sortOrder - WORKFLOW_GROUP_CONFIG[b].sortOrder)
            .filter(g => groupedActive[g].length > 0)
            .map(group => {
              const cfg = WORKFLOW_GROUP_CONFIG[group]
              const isOpen = expandedGroups.has(group)
              const groupCases = groupedActive[group]
              return (
                <div key={group}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl transition-colors min-h-[48px]"
                  >
                    <cfg.icon className={`w-5 h-5 shrink-0 ${cfg.color}`} />
                    <span className="font-medium text-white">{cfg.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bgClass} ${cfg.color}`}>
                      {groupCases.length}
                    </span>
                    <span className="flex-1" />
                    {isOpen
                      ? <ChevronDown className="w-5 h-5 text-slate-500" />
                      : <ChevronRight className="w-5 h-5 text-slate-500" />
                    }
                  </button>

                  {/* Group cases */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2 space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                          {groupCases.map(c => (
                            <CaseCard
                              key={c.id}
                              case_={c}
                              workflowGroup={group}
                              isExpanded={expandedCards.has(c.id)}
                              onToggle={() => toggleCard(c.id)}
                              onEdit={() => handleEdit(c)}
                              onClose={() => handleCloseCase(c)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

          {activeCases.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-[#20c58f] mx-auto mb-3" />
              <p className="text-white font-medium">Inga aktiva ärenden</p>
              <p className="text-slate-400 text-sm mt-1">
                {searchTerm ? 'Inga ärenden matchar din sökning' : 'Alla ärenden är avslutade'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Stale tab ═══ */}
      {activeTab === 'stale' && (
        <div>
          {staleCases.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">
                {selectedForBatch.size > 0 && `${selectedForBatch.size} markerade`}
              </p>
              <button
                onClick={handleBatchClose}
                disabled={selectedForBatch.size === 0}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                  selectedForBatch.size > 0
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-slate-800/30 text-slate-600 cursor-not-allowed'
                }`}
              >
                <XCircle className="w-4 h-4" />
                Stäng markerade ({selectedForBatch.size})
              </button>
            </div>
          )}

          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {staleCases.map(c => (
              <CaseCard
                key={c.id}
                case_={c}
                workflowGroup={STATUS_TO_WORKFLOW[c.status] || 'needs_action'}
                isExpanded={expandedCards.has(c.id)}
                onToggle={() => toggleCard(c.id)}
                onEdit={() => handleEdit(c)}
                onClose={() => handleCloseCase(c)}
                showCheckbox
                isChecked={selectedForBatch.has(c.id)}
                onCheckChange={checked => toggleBatchSelect(c.id, checked)}
              />
            ))}
          </div>

          {staleCases.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-[#20c58f] mx-auto mb-3" />
              <p className="text-white font-medium">Inga gamla ärenden</p>
              <p className="text-slate-400 text-sm mt-1">
                {searchTerm ? 'Inga gamla ärenden matchar din sökning' : 'Alla ärenden är uppdaterade'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Completed tab ═══ */}
      {activeTab === 'completed' && (
        <div>
          <p className="text-sm text-slate-400 mb-3">Senaste 90 dagarna</p>
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {completedCases.map(c => (
              <CaseCard
                key={c.id}
                case_={c}
                isExpanded={expandedCards.has(c.id)}
                onToggle={() => toggleCard(c.id)}
                onEdit={() => handleEdit(c)}
                showCloseReason
              />
            ))}
          </div>

          {completedCases.length === 0 && (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-white font-medium">Inga avslutade ärenden</p>
              <p className="text-slate-400 text-sm mt-1">
                {searchTerm ? 'Inga avslutade ärenden matchar din sökning' : 'Inga ärenden avslutade de senaste 90 dagarna'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <EditCaseModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedCase(null) }}
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase}
      />

      <CloseCaseModal
        isOpen={isCloseModalOpen}
        onClose={() => { setIsCloseModalOpen(false); setCasesToClose([]) }}
        cases={casesToClose}
        onSuccess={handleCloseSuccess}
      />
    </div>
  )
}
