// src/pages/coordinator/CasePipeline.tsx — Offerthantering: koordinatorns pipeline
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Search, Phone, MessageSquare, Eye,
  CalendarCheck, X, Loader2, Send, FileCheck, Banknote,
  TrendingUp, AlertTriangle, Clock, ChevronUp, ChevronDown,
  PhoneCall, MailIcon, MessageCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { CasePipelineService } from '../../services/casePipelineService'
import { formatAddress } from '../../components/coordinator/schedule-v2/scheduleUtils'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import type { PipelineCaseRow, PipelineTab, CoordinatorCaseStatus, ContactMethod } from '../../types/casePipeline'
import { COORDINATOR_STATUS_CONFIG, PIPELINE_TABS } from '../../types/casePipeline'

// ─── Hjälpfunktioner ───

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days === 0) return 'idag'
  if (days === 1) return 'igår'
  if (days < 7) return `${days}d sedan`
  if (days < 30) return `${Math.floor(days / 7)}v sedan`
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function formatPrice(price: number | null): string {
  if (!price) return '—'
  return `${price.toLocaleString('sv-SE')} kr`
}

function formatKr(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mkr`
  if (value >= 1_000) return `${Math.round(value / 1_000)} tkr`
  return `${value} kr`
}

function getDaysAge(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function getAgeBorderColor(dateStr: string | null): string {
  const days = getDaysAge(dateStr)
  if (days < 14) return 'border-l-green-500'
  if (days < 30) return 'border-l-amber-400'
  if (days < 90) return 'border-l-orange-500'
  return 'border-l-red-500'
}

type SortOption = 'oldest' | 'newest' | 'price_desc' | 'contact_attempts'

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'oldest', label: 'Äldst först' },
  { key: 'newest', label: 'Nyast först' },
  { key: 'price_desc', label: 'Pris (högst)' },
  { key: 'contact_attempts', label: 'Flest kontaktförsök' },
]

// ─── Huvudkomponent ───

export default function CasePipeline() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [cases, setCases] = useState<PipelineCaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<PipelineTab>('alla')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('oldest')
  const [showInsights, setShowInsights] = useState(true)

  // Modal-state
  const [selectedCase, setSelectedCase] = useState<PipelineCaseRow | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [openCommunicationOnLoad, setOpenCommunicationOnLoad] = useState(false)

  // Kontaktförsök-popover
  const [contactPopoverCaseId, setContactPopoverCaseId] = useState<string | null>(null)

  // Inline note editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const fetchCases = useCallback(async () => {
    try {
      const data = await CasePipelineService.getPipelineCases()
      setCases(data)
    } catch (err) {
      console.error('Fel vid hämtning av pipeline-ärenden:', err)
      toast.error('Kunde inte ladda ärenden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCases() }, [fetchCases])

  // ─── Filtrering + sökning + sortering ───

  const filtered = useMemo(() => {
    const tab = PIPELINE_TABS.find(t => t.key === activeTab)!
    let result = cases.filter(c => tab.statuses.includes(c.status))

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.kontaktperson || '').toLowerCase().includes(q) ||
        (c.primary_assignee_name || '').toLowerCase().includes(q) ||
        (c.bestallare || '').toLowerCase().includes(q) ||
        (c.skadedjur || '').toLowerCase().includes(q)
      )
    }

    // Sortering: okvitterade bubblar alltid överst
    result.sort((a, b) => {
      const aNew = !a.action || a.action.coordinator_status === 'new' ? 0 : 1
      const bNew = !b.action || b.action.coordinator_status === 'new' ? 0 : 1
      if (aNew !== bNew) return aNew - bNew

      switch (sortBy) {
        case 'oldest': return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        case 'newest': return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'price_desc': return (b.pris || 0) - (a.pris || 0)
        case 'contact_attempts': return (b.action?.contact_attempts || 0) - (a.action?.contact_attempts || 0)
        default: return 0
      }
    })

    return result
  }, [cases, activeTab, searchQuery, sortBy])

  // ─── KPI + insikter ───

  const stats = useMemo(() => {
    const offertSkickad = cases.filter(c => c.status === 'Offert skickad').length
    const signerad = cases.filter(c => c.status === 'Offert signerad - boka in').length
    const ejKvitterat = cases.filter(c => !c.action || c.action.coordinator_status === 'new').length
    const totalValue = cases.reduce((s, c) => s + (c.pris || 0), 0)
    const totalOffertValue = cases.filter(c => c.status === 'Offert skickad').reduce((s, c) => s + (c.pris || 0), 0)
    const totalSigneradValue = cases.filter(c => c.status === 'Offert signerad - boka in').reduce((s, c) => s + (c.pris || 0), 0)
    const conversionRate = cases.length > 0 ? Math.round((signerad / cases.length) * 100) : 0
    const scheduledCount = cases.filter(c => c.start_date && c.due_date).length

    // Åldersfördelning
    const ageBuckets = { fresh: 0, week: 0, month: 0, quarter: 0, old: 0 }
    for (const c of cases) {
      const days = getDaysAge(c.updated_at)
      if (days < 7) ageBuckets.fresh++
      else if (days < 14) ageBuckets.week++
      else if (days < 30) ageBuckets.month++
      else if (days < 90) ageBuckets.quarter++
      else ageBuckets.old++
    }

    // Kräver åtgärd
    const utanKontakt30d = cases.filter(c =>
      (c.action?.contact_attempts || 0) === 0 && getDaysAge(c.updated_at) > 30
    ).length

    return {
      offertSkickad, signerad, ejKvitterat, totalValue,
      totalOffertValue, totalSigneradValue, conversionRate,
      scheduledCount, ageBuckets, utanKontakt30d,
    }
  }, [cases])

  // ─── Actions ───

  const handleAcknowledge = useCallback(async (c: PipelineCaseRow) => {
    if (!user?.id || !profile?.display_name) return
    try {
      const updated = await CasePipelineService.acknowledgeCase(c.case_id || c.id, c.case_type, user.id, profile.display_name)
      setCases(prev => prev.map(p => p.id === c.id ? { ...p, action: updated } : p))
      toast.success('Ärende kvitterat')
    } catch {
      toast.error('Kunde inte kvittera')
    }
  }, [user, profile])

  const handleLogContact = useCallback(async (c: PipelineCaseRow, method: ContactMethod, note?: string) => {
    if (!user?.id || !profile?.display_name) return
    try {
      const updated = await CasePipelineService.logContactAttempt(c.id, c.case_type, user.id, profile.display_name, method, note)
      setCases(prev => prev.map(p => p.id === c.id ? { ...p, action: updated } : p))
      setContactPopoverCaseId(null)
      toast.success('Kontaktförsök loggat')
    } catch {
      toast.error('Kunde inte logga kontaktförsök')
    }
  }, [user, profile])

  const handleSaveNote = useCallback(async (c: PipelineCaseRow) => {
    if (!user?.id || !profile?.display_name) return
    try {
      const updated = await CasePipelineService.updateNotes(c.id, c.case_type, noteText, user.id, profile.display_name)
      setCases(prev => prev.map(p => p.id === c.id ? { ...p, action: updated } : p))
      setEditingNoteId(null)
      setNoteText('')
      toast.success('Anteckning sparad')
    } catch {
      toast.error('Kunde inte spara')
    }
  }, [user, profile, noteText])

  const handleStatusChange = useCallback(async (c: PipelineCaseRow, status: CoordinatorCaseStatus) => {
    try {
      const updated = await CasePipelineService.updateStatus(c.id, c.case_type, status)
      setCases(prev => prev.map(p => p.id === c.id ? { ...p, action: updated } : p))
    } catch {
      toast.error('Kunde inte byta status')
    }
  }, [])

  const handleBookCase = useCallback((c: PipelineCaseRow) => {
    navigate(`/koordinator/schema-v2?openCase=${c.id}`)
  }, [navigate])

  const handleOpenHistory = useCallback((c: PipelineCaseRow) => {
    setOpenCommunicationOnLoad(true)
    setSelectedCase(c)
    setIsEditModalOpen(true)
  }, [])

  const handleEditSuccess = useCallback(() => {
    setIsEditModalOpen(false)
    setSelectedCase(null)
    fetchCases()
  }, [fetchCases])

  // ─── Render ───

  return (
    <>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-[#20c58f]" />
            <h1 className="text-xl font-bold text-white">Offerthantering</h1>
          </div>
          <button
            onClick={() => setShowInsights(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
          >
            {showInsights ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showInsights ? 'Dölj insikter' : 'Visa insikter'}
          </button>
        </div>

        {/* ═══ SEKTION 1: KPI-kort ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={Send}
            label="Offert skickad"
            value={stats.offertSkickad}
            subtext={formatKr(stats.totalOffertValue)}
            color="emerald"
            onClick={() => setActiveTab('offert_skickad')}
            active={activeTab === 'offert_skickad'}
          />
          <KpiCard
            icon={FileCheck}
            label="Signerad — att boka"
            value={stats.signerad}
            subtext={formatKr(stats.totalSigneradValue)}
            color="green"
            pulse={stats.signerad > 0}
            onClick={() => setActiveTab('signerad')}
            active={activeTab === 'signerad'}
          />
          <KpiCard
            icon={Banknote}
            label="Pipelinevärde"
            value={formatKr(stats.totalValue)}
            subtext="Totalt offertvärde"
            color="blue"
          />
          <KpiCard
            icon={TrendingUp}
            label="Konverteringsgrad"
            value={`${stats.conversionRate}%`}
            subtext={`${stats.signerad} av ${cases.length} signerade`}
            color={stats.conversionRate >= 25 ? 'green' : 'amber'}
          />
        </div>

        {/* ═══ SEKTION 2: Dashboard-insikter ═══ */}
        <AnimatePresence>
          {showInsights && !loading && cases.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Panel A: Konverteringstratt */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold text-white">Konverteringstratt</h3>
                  </div>
                  <div className="space-y-2">
                    <FunnelBar label="Offert skickad" value={stats.offertSkickad} max={stats.offertSkickad} color="bg-emerald-500" />
                    <FunnelBar label="Signerad" value={stats.signerad} max={stats.offertSkickad} color="bg-green-500" />
                    <FunnelBar label="Inbokad" value={stats.scheduledCount} max={stats.offertSkickad} color="bg-[#20c58f]" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {stats.conversionRate}% konvertering (offert &rarr; signerad)
                  </p>
                </div>

                {/* Panel B: Åldersfördelning */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-semibold text-white">Åldersfördelning</h3>
                  </div>
                  <AgingBar buckets={stats.ageBuckets} total={cases.length} />
                  {stats.ageBuckets.old > 0 && (
                    <p className="text-[10px] text-red-400 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {stats.ageBuckets.old} offerter har legat &ouml;ver 90 dagar
                    </p>
                  )}
                </div>

                {/* Panel C: Kräver åtgärd */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h3 className="text-xs font-semibold text-white">Kräver åtgärd</h3>
                  </div>
                  <div className="space-y-2">
                    {stats.signerad > 0 && (
                      <AlertCard
                        icon={CalendarCheck}
                        text={`${stats.signerad} signerade att boka in`}
                        subtext={formatKr(stats.totalSigneradValue)}
                        severity="red"
                        onClick={() => setActiveTab('signerad')}
                      />
                    )}
                    {stats.utanKontakt30d > 0 && (
                      <AlertCard
                        icon={Phone}
                        text={`${stats.utanKontakt30d} utan kontakt (>30d)`}
                        severity="amber"
                        onClick={() => { setActiveTab('alla'); setSortBy('oldest') }}
                      />
                    )}
                    {stats.ejKvitterat > 0 && (
                      <AlertCard
                        icon={Eye}
                        text={`${stats.ejKvitterat} ej kvitterade`}
                        severity="blue"
                        onClick={() => setActiveTab('alla')}
                      />
                    )}
                    {stats.signerad === 0 && stats.utanKontakt30d === 0 && stats.ejKvitterat === 0 && (
                      <p className="text-xs text-slate-500 py-2">Allt ser bra ut!</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flikar + sök + sort */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-800/50 rounded-lg p-0.5">
            {PIPELINE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#20c58f] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Sök ärende, kund, tekniker..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
            />
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ═══ SEKTION 3: Tabell ═══ */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Laddar ärenden...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="mx-auto w-10 h-10 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Inga ärenden matchar filtret</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-700/50">
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Ärende</th>
                  <th className="px-3 py-2.5 font-medium">Typ</th>
                  <th className="px-3 py-2.5 font-medium">Kund / Kontakt</th>
                  <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Adress</th>
                  <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Skadedjur</th>
                  <th className="px-3 py-2.5 font-medium">Tekniker</th>
                  <th className="px-3 py-2.5 font-medium">Pris</th>
                  <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Skickat</th>
                  <th className="px-3 py-2.5 font-medium">Koord. status</th>
                  <th className="px-3 py-2.5 font-medium">Försök</th>
                  <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Anteckning</th>
                  <th className="px-3 py-2.5 font-medium">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <PipelineRow
                    key={c.id}
                    caseRow={c}
                    onAcknowledge={handleAcknowledge}
                    onOpenContactPopover={setContactPopoverCaseId}
                    contactPopoverOpen={contactPopoverCaseId === c.id}
                    onLogContact={handleLogContact}
                    onStartEditNote={(id, currentNote) => { setEditingNoteId(id); setNoteText(currentNote || '') }}
                    editingNoteId={editingNoteId}
                    noteText={noteText}
                    onNoteTextChange={setNoteText}
                    onSaveNote={handleSaveNote}
                    onCancelNote={() => { setEditingNoteId(null); setNoteText('') }}
                    onStatusChange={handleStatusChange}
                    onBook={handleBookCase}
                    onOpenHistory={handleOpenHistory}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EditCaseModal */}
      {selectedCase && (
        <EditCaseModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setSelectedCase(null); setOpenCommunicationOnLoad(false) }}
          onSuccess={handleEditSuccess}
          caseData={selectedCase as any}
          technicians={[]}
          openCommunicationOnLoad={openCommunicationOnLoad}
        />
      )}
    </>
  )
}

// ─── KPI-kort ───

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-400' },
  green:   { bg: 'bg-green-500/10',   border: 'border-green-500/20',   text: 'text-green-400',   icon: 'text-green-400' },
  blue:    { bg: 'bg-blue-500/10',     border: 'border-blue-500/20',    text: 'text-blue-400',    icon: 'text-blue-400' },
  amber:   { bg: 'bg-amber-500/10',    border: 'border-amber-500/20',   text: 'text-amber-400',   icon: 'text-amber-400' },
}

function KpiCard({ icon: Icon, label, value, subtext, color, pulse, onClick, active }: {
  icon: React.ElementType
  label: string
  value: string | number
  subtext: string
  color: string
  pulse?: boolean
  onClick?: () => void
  active?: boolean
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.emerald
  return (
    <div
      onClick={onClick}
      className={`relative p-3 rounded-xl border transition-all ${c.bg} ${c.border} ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      } ${active ? 'ring-1 ring-[#20c58f]' : ''}`}
    >
      {pulse && (
        <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${c.icon}`} />
        <span className="text-[10px] text-slate-400 font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold ${c.text}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{subtext}</p>
    </div>
  )
}

// ─── Konverteringstratt bar ───

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 2
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-700/30 rounded-full h-4 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${color} flex items-center justify-end pr-1.5`}
        >
          {pct > 10 && <span className="text-[9px] text-white font-bold">{value}</span>}
        </motion.div>
      </div>
      {pct <= 10 && <span className="text-[10px] text-slate-500 w-6 text-right">{value}</span>}
    </div>
  )
}

// ─── Åldersfördelning ───

const AGE_SEGMENTS: { key: keyof ReturnType<typeof getAgeBuckets>; label: string; color: string }[] = [
  { key: 'fresh', label: '<7d', color: 'bg-green-500' },
  { key: 'week', label: '7-14d', color: 'bg-emerald-500' },
  { key: 'month', label: '14-30d', color: 'bg-amber-400' },
  { key: 'quarter', label: '30-90d', color: 'bg-orange-500' },
  { key: 'old', label: '>90d', color: 'bg-red-500' },
]

function getAgeBuckets() {
  return { fresh: 0, week: 0, month: 0, quarter: 0, old: 0 }
}

function AgingBar({ buckets, total }: { buckets: ReturnType<typeof getAgeBuckets>; total: number }) {
  if (total === 0) return <p className="text-xs text-slate-500">Inga ärenden</p>
  return (
    <div>
      <div className="flex rounded-full h-5 overflow-hidden bg-slate-700/30">
        {AGE_SEGMENTS.map(seg => {
          const count = buckets[seg.key]
          if (count === 0) return null
          const pct = (count / total) * 100
          return (
            <motion.div
              key={seg.key}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`${seg.color} flex items-center justify-center`}
              title={`${seg.label}: ${count} ärenden`}
            >
              {pct > 8 && <span className="text-[8px] text-white font-bold">{count}</span>}
            </motion.div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        {AGE_SEGMENTS.map(seg => (
          <div key={seg.key} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${seg.color}`} />
            <span className="text-[9px] text-slate-500">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Åtgärdskort ───

const SEVERITY_COLORS: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  red:   { bg: 'bg-red-500/10',   border: 'border-red-500/20',   icon: 'text-red-400',   text: 'text-red-300' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400', text: 'text-amber-300' },
  blue:  { bg: 'bg-blue-500/10',  border: 'border-blue-500/20',  icon: 'text-blue-400',  text: 'text-blue-300' },
}

function AlertCard({ icon: Icon, text, subtext, severity, onClick }: {
  icon: React.ElementType
  text: string
  subtext?: string
  severity: string
  onClick?: () => void
}) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.blue
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all hover:scale-[1.01] ${c.bg} ${c.border}`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${c.icon}`} />
      <div className="text-left flex-1 min-w-0">
        <p className={`text-[11px] font-medium ${c.text}`}>{text}</p>
        {subtext && <p className="text-[9px] text-slate-500">{subtext}</p>}
      </div>
    </button>
  )
}

// ─── Ålder-badge ───

function AgeBadge({ dateStr }: { dateStr: string | null }) {
  const text = formatRelativeDate(dateStr)
  const days = getDaysAge(dateStr)
  const color = days < 14
    ? 'text-green-400'
    : days < 30
      ? 'text-amber-400'
      : days < 90
        ? 'text-orange-400'
        : 'text-red-400'
  return (
    <span className={`text-[10px] font-medium ${color}`}>
      {text}{days >= 90 ? ' !' : ''}
    </span>
  )
}

// ─── Tabellrad ───

interface PipelineRowProps {
  caseRow: PipelineCaseRow
  onAcknowledge: (c: PipelineCaseRow) => void
  onOpenContactPopover: (id: string | null) => void
  contactPopoverOpen: boolean
  onLogContact: (c: PipelineCaseRow, method: ContactMethod, note?: string) => void
  onStartEditNote: (id: string, currentNote: string | null) => void
  editingNoteId: string | null
  noteText: string
  onNoteTextChange: (text: string) => void
  onSaveNote: (c: PipelineCaseRow) => void
  onCancelNote: () => void
  onStatusChange: (c: PipelineCaseRow, status: CoordinatorCaseStatus) => void
  onBook: (c: PipelineCaseRow) => void
  onOpenHistory: (c: PipelineCaseRow) => void
}

function PipelineRow({
  caseRow: c, onAcknowledge, onOpenContactPopover, contactPopoverOpen,
  onLogContact, onStartEditNote, editingNoteId, noteText, onNoteTextChange,
  onSaveNote, onCancelNote, onStatusChange, onBook, onOpenHistory,
}: PipelineRowProps) {
  const addr = formatAddress(c.adress)
  const isNew = !c.action || c.action.coordinator_status === 'new'
  const status = c.action?.coordinator_status || 'new'
  const cfg = COORDINATOR_STATUS_CONFIG[status]
  const isSignerad = c.status === 'Offert signerad - boka in'

  const rowBg = isSignerad
    ? 'bg-green-500/[0.03]'
    : isNew
      ? 'bg-amber-500/[0.03]'
      : ''

  return (
    <tr className={`border-b border-slate-800/40 border-l-2 ${getAgeBorderColor(c.updated_at)} hover:bg-slate-800/30 transition-colors ${rowBg}`}>
      {/* ClickUp-status */}
      <td className="px-3 py-2.5">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
          isSignerad ? 'bg-green-500/15 text-green-400' : 'bg-emerald-500/15 text-emerald-400'
        }`}>
          {isSignerad ? 'Signerad' : 'Offert'}
        </span>
      </td>

      {/* Ärende */}
      <td className="px-3 py-2.5">
        <span className="text-white font-medium truncate max-w-[180px] block" title={c.title}>
          {c.title || 'Utan titel'}
        </span>
      </td>

      {/* Typ */}
      <td className="px-3 py-2.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          c.case_type === 'private' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
        }`}>
          {c.case_type === 'private' ? 'Privat' : 'Företag'}
        </span>
      </td>

      {/* Kund/Kontakt */}
      <td className="px-3 py-2.5">
        <div className="max-w-[160px]">
          <p className="text-white truncate text-[11px]">{c.kontaktperson || c.bestallare || '—'}</p>
          {c.telefon_kontaktperson && (
            <p className="text-slate-500 truncate text-[10px]">{c.telefon_kontaktperson}</p>
          )}
        </div>
      </td>

      {/* Adress */}
      <td className="px-3 py-2.5 hidden xl:table-cell">
        <span className="text-slate-400 truncate block max-w-[140px]" title={addr}>{addr || '—'}</span>
      </td>

      {/* Skadedjur */}
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <span className="text-slate-400">{c.skadedjur || '—'}</span>
      </td>

      {/* Tekniker */}
      <td className="px-3 py-2.5">
        <span className="text-slate-300 font-medium">{c.primary_assignee_name || '—'}</span>
      </td>

      {/* Pris */}
      <td className="px-3 py-2.5">
        <span className="text-white font-medium">{formatPrice(c.pris)}</span>
      </td>

      {/* Skickat — med ålderbadge */}
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <AgeBadge dateStr={c.updated_at} />
      </td>

      {/* Koord.status */}
      <td className="px-3 py-2.5">
        <select
          value={status}
          onChange={e => onStatusChange(c, e.target.value as CoordinatorCaseStatus)}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border-0 cursor-pointer focus:ring-1 focus:ring-[#20c58f] ${cfg.bgColor} ${cfg.color}`}
        >
          {Object.entries(COORDINATOR_STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </td>

      {/* Försök */}
      <td className="px-3 py-2.5">
        <span className={`text-[11px] font-medium ${(c.action?.contact_attempts || 0) > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
          {c.action?.contact_attempts || 0}
        </span>
      </td>

      {/* Anteckning (inline edit) */}
      <td className="px-3 py-2.5 hidden xl:table-cell">
        {editingNoteId === c.id ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={noteText}
              onChange={e => onNoteTextChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onSaveNote(c)
                if (e.key === 'Escape') onCancelNote()
              }}
              autoFocus
              className="w-full px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-600 rounded text-white focus:ring-1 focus:ring-[#20c58f] focus:outline-none"
              placeholder="Skriv anteckning..."
            />
            <button onClick={() => onSaveNote(c)} className="text-[#20c58f] hover:text-white text-[10px] shrink-0">Spara</button>
            <button onClick={() => onCancelNote()} className="text-slate-500 hover:text-white transition-colors shrink-0 p-0.5" title="Stäng">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onStartEditNote(c.id, c.action?.coordinator_notes || null)}
            className="text-slate-500 hover:text-white text-[10px] text-left truncate max-w-[120px] block transition-colors"
            title={c.action?.coordinator_notes || 'Klicka för att lägga till'}
          >
            {c.action?.coordinator_notes || '+ Anteckning'}
          </button>
        )}
      </td>

      {/* Åtgärder */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 relative">
          {/* Kvittera */}
          {isNew && (
            <button
              onClick={() => onAcknowledge(c)}
              className="p-1 rounded text-blue-400 hover:bg-blue-500/20 transition-colors"
              title="Kvittera"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Logga kontakt */}
          <div className="relative">
            <button
              onClick={() => onOpenContactPopover(contactPopoverOpen ? null : c.id)}
              className="p-1 rounded text-purple-400 hover:bg-purple-500/20 transition-colors"
              title="Logga kontaktförsök"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
            {contactPopoverOpen && (
              <ContactPopover
                onSelect={(method, note) => onLogContact(c, method, note)}
                onClose={() => onOpenContactPopover(null)}
              />
            )}
          </div>

          {/* Historik */}
          <button
            onClick={() => onOpenHistory(c)}
            className="p-1 rounded text-purple-400 hover:bg-purple-500/20 transition-colors"
            title="Visa historik"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>

          {/* Boka in (bara signerade) — prominent knapp */}
          {isSignerad && (
            <button
              onClick={() => onBook(c)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#20c58f]/15 text-[#20c58f] hover:bg-[#20c58f]/25 transition-colors"
            >
              <CalendarCheck className="w-3 h-3" /> Boka
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Kontaktförsök-popover ───

function ContactPopover({ onSelect, onClose }: {
  onSelect: (method: ContactMethod, note?: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2.5">
      <p className="text-[10px] text-slate-400 mb-2 font-medium">Logga kontaktförsök</p>
      <div className="flex gap-1.5 mb-2">
        <button
          onClick={() => onSelect('phone', note || undefined)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <PhoneCall className="w-3 h-3" /> Telefon
        </button>
        <button
          onClick={() => onSelect('email', note || undefined)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <MailIcon className="w-3 h-3" /> E-post
        </button>
        <button
          onClick={() => onSelect('sms', note || undefined)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <MessageCircle className="w-3 h-3" /> SMS
        </button>
      </div>
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && note) onSelect('phone', note) }}
        placeholder="Valfri anteckning..."
        className="w-full px-2 py-1 text-[10px] bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
      />
    </div>
  )
}
