// src/pages/coordinator/CasePipeline.tsx — Offerthantering: koordinatorns pipeline (Oneflow-baserad)
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Search, Phone, Eye, EyeOff,
  CalendarCheck, X, Loader2, Send, FileCheck, Banknote,
  TrendingUp, AlertTriangle, Clock, ChevronUp, ChevronDown, ChevronRight,
  PhoneCall, MailIcon, MessageCircle, UserCheck, ExternalLink, CalendarPlus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { CasePipelineService } from '../../services/casePipelineService'
import PipelineColumnSelector, { usePipelineColumnVisibility } from '../../components/coordinator/PipelineColumnSelector'
import { useOfferStats } from '../../hooks/useOfferStats'
import type { PipelineOfferRow, PipelineTab, CoordinatorCaseStatus, ContactMethod } from '../../types/casePipeline'
import { OFFER_STATUS_CONFIG, PIPELINE_TABS } from '../../types/casePipeline'
import OfferRowDetail from '../../components/coordinator/follow-up/OfferRowDetail'
import CoordinatorStatusDropdown from '../../components/coordinator/follow-up/CoordinatorStatusDropdown'
import ExtendSigningPeriodDialog from '../../components/coordinator/follow-up/ExtendSigningPeriodDialog'

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
  const [offers, setOffers] = useState<PipelineOfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<PipelineTab>('alla')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showInsights, setShowInsights] = useState(true)
  const [showDismissed, setShowDismissed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [extendTarget, setExtendTarget] = useState<PipelineOfferRow | null>(null)

  // Kontaktförsök-popover
  const [contactPopoverOfferId, setContactPopoverOfferId] = useState<string | null>(null)

  // Inline note editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const basePath =
    profile?.role === 'säljare' ? '/saljare' :
    profile?.role === 'koordinator' ? '/koordinator' :
    profile?.role === 'technician' ? '/technician' :
    '/admin'
  const senderEmail = profile?.technicians?.email || undefined

  // Kolumnväljare
  const { visibleColumns, toggleColumn, resetToDefaults, isVisible } = usePipelineColumnVisibility()

  // Oneflow-statistik (cachad i Supabase)
  const { stats: offerStats } = useOfferStats()

  const fetchOffers = useCallback(async () => {
    try {
      const data = await CasePipelineService.getPipelineOffers()
      setOffers(data)
    } catch (err) {
      console.error('Fel vid hämtning av pipeline-offerter:', err)
      toast.error('Kunde inte ladda offerter')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  // ─── Filtrering + sökning + sortering ───

  const filtered = useMemo(() => {
    const tab = PIPELINE_TABS.find(t => t.key === activeTab)!
    let result = offers.filter(o => tab.statuses.includes(o.status))

    // Dölja avfärdade om inte showDismissed
    if (!showDismissed) {
      result = result.filter(o => !o.action?.dismissed_at)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o =>
        (o.company_name || '').toLowerCase().includes(q) ||
        (o.contact_person || '').toLowerCase().includes(q) ||
        (o.contact_email || '').toLowerCase().includes(q) ||
        (o.contact_address || '').toLowerCase().includes(q) ||
        (o.begone_employee_name || '').toLowerCase().includes(q)
      )
    }

    // Sortering: okvitterade bubblar alltid överst
    result.sort((a, b) => {
      const aNew = !a.action || a.action.coordinator_status === 'new' ? 0 : 1
      const bNew = !b.action || b.action.coordinator_status === 'new' ? 0 : 1
      if (aNew !== bNew) return aNew - bNew

      switch (sortBy) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'price_desc': return (b.total_value || 0) - (a.total_value || 0)
        case 'contact_attempts': return (b.action?.contact_attempts || 0) - (a.action?.contact_attempts || 0)
        default: return 0
      }
    })

    return result
  }, [offers, activeTab, searchQuery, sortBy, showDismissed])

  // ─── Antal dolda ───
  const dismissedCount = useMemo(() =>
    offers.filter(o => !!o.action?.dismissed_at).length
  , [offers])

  // ─── KPI (lokala beräkningar från offers) ───

  const localStats = useMemo(() => {
    const pendingOffers = offers.filter(o => o.status === 'pending')
    const signedOffers = offers.filter(o => o.status === 'signed')
    const overdueOffers = offers.filter(o => o.status === 'overdue')
    const declinedOffers = offers.filter(o => o.status === 'declined')
    const ejKvitterat = offers.filter(o => !o.action || o.action.coordinator_status === 'new').length
    const totalPipelineValue = offers.reduce((s, o) => s + (o.total_value || 0), 0)
    const pendingValue = pendingOffers.reduce((s, o) => s + (o.total_value || 0), 0)
    const signedValue = signedOffers.reduce((s, o) => s + (o.total_value || 0), 0)

    // Åldersfördelning
    const ageBuckets = { fresh: 0, week: 0, month: 0, quarter: 0, old: 0 }
    for (const o of offers) {
      const days = getDaysAge(o.created_at)
      if (days < 7) ageBuckets.fresh++
      else if (days < 14) ageBuckets.week++
      else if (days < 30) ageBuckets.month++
      else if (days < 90) ageBuckets.quarter++
      else ageBuckets.old++
    }

    // Kräver åtgärd
    const utanKontakt30d = offers.filter(o =>
      (o.action?.contact_attempts || 0) === 0 && getDaysAge(o.created_at) > 30
    ).length

    return {
      pending: pendingOffers.length,
      signed: signedOffers.length,
      overdue: overdueOffers.length,
      declined: declinedOffers.length,
      ejKvitterat,
      totalPipelineValue,
      pendingValue,
      signedValue,
      ageBuckets,
      utanKontakt30d,
    }
  }, [offers])

  // ─── Actions ───

  const handleAcknowledge = useCallback(async (o: PipelineOfferRow) => {
    if (!user?.id) return
    try {
      const updated = await CasePipelineService.acknowledgeOffer(o.id, user.id)
      setOffers(prev => prev.map(p => p.id === o.id ? { ...p, action: updated } : p))
      toast.success('Offert kvitterad')
    } catch {
      toast.error('Kunde inte kvittera')
    }
  }, [user])

  const handleLogContact = useCallback(async (o: PipelineOfferRow, method: ContactMethod, note?: string) => {
    if (!user?.id) return
    try {
      const updated = await CasePipelineService.logOfferContactAttempt(o.id, user.id, method, note)
      setOffers(prev => prev.map(p => p.id === o.id ? { ...p, action: updated } : p))
      setContactPopoverOfferId(null)
      toast.success('Kontaktförsök loggat')
    } catch {
      toast.error('Kunde inte logga kontaktförsök')
    }
  }, [user])

  const handleSaveNote = useCallback(async (o: PipelineOfferRow) => {
    try {
      const updated = await CasePipelineService.updateOfferNotes(o.id, noteText)
      setOffers(prev => prev.map(p => p.id === o.id ? { ...p, action: updated } : p))
      setEditingNoteId(null)
      setNoteText('')
      toast.success('Anteckning sparad')
    } catch {
      toast.error('Kunde inte spara')
    }
  }, [noteText])

  const handleStatusChange = useCallback(async (o: PipelineOfferRow, status: CoordinatorCaseStatus) => {
    try {
      const updated = await CasePipelineService.updateOfferStatus(o.id, status)
      setOffers(prev => prev.map(p => p.id === o.id ? { ...p, action: updated } : p))
    } catch {
      toast.error('Kunde inte byta status')
    }
  }, [])

  const handleDismiss = useCallback(async (o: PipelineOfferRow) => {
    if (!user?.id) return
    try {
      await CasePipelineService.dismissOffer(o.id, user.id)
      setOffers(prev => prev.map(p => p.id === o.id
        ? { ...p, action: { ...(p.action || {} as any), dismissed_at: new Date().toISOString(), dismissed_by: user.id } }
        : p
      ))
      toast.success('Offert dold')
    } catch {
      toast.error('Kunde inte dölja')
    }
  }, [user])

  const handleUndismiss = useCallback(async (o: PipelineOfferRow) => {
    try {
      await CasePipelineService.undismissOffer(o.id)
      setOffers(prev => prev.map(p => p.id === o.id
        ? { ...p, action: p.action ? { ...p.action, dismissed_at: null, dismissed_by: null } : null }
        : p
      ))
      toast.success('Offert synlig igen')
    } catch {
      toast.error('Kunde inte återställa')
    }
  }, [])

  const handleBookOffer = useCallback((o: PipelineOfferRow) => {
    if (o.source_id) {
      navigate(`/koordinator/schema?scheduleCase=${o.source_id}`)
    } else {
      toast.error('Offerten saknar koppling till ett ärende.')
    }
  }, [navigate])

  // Konverteringsgrad: använd Oneflow-statistik om tillgänglig, annars lokala siffror
  const conversionRate = offerStats?.sign_rate ?? (
    (localStats.signed + localStats.pending) > 0
      ? Math.round((localStats.signed / (localStats.signed + localStats.pending)) * 100)
      : 0
  )
  const conversionSubtext = offerStats
    ? `${offerStats.signed} av ${offerStats.total_sent} (Oneflow)`
    : `${localStats.signed} av ${offers.length} totalt`

  // ─── Render ───

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-[#20c58f]" />
          <h1 className="text-xl font-bold text-white">Offerthantering</h1>
          <span className="text-xs text-slate-500 font-medium">Oneflow</span>
        </div>
        <div className="flex items-center gap-2">
          <PipelineColumnSelector
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
            onReset={resetToDefaults}
          />
          <button
            onClick={() => setShowInsights(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
          >
            {showInsights ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showInsights ? 'Dölj insikter' : 'Visa insikter'}
          </button>
        </div>
      </div>

      {/* ═══ SEKTION 1: KPI-kort ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Send}
          label="Pågående"
          value={localStats.pending}
          subtext={formatKr(localStats.pendingValue)}
          color="blue"
          onClick={() => setActiveTab('pending')}
          active={activeTab === 'pending'}
        />
        <KpiCard
          icon={FileCheck}
          label="Signerat — att boka"
          value={localStats.signed}
          subtext={formatKr(localStats.signedValue)}
          color="green"
          pulse={localStats.signed > 0}
          onClick={() => setActiveTab('signed')}
          active={activeTab === 'signed'}
        />
        <KpiCard
          icon={Banknote}
          label="Pipelinevärde"
          value={formatKr(localStats.totalPipelineValue)}
          subtext="Totalt offertvärde"
          color="emerald"
        />
        <KpiCard
          icon={TrendingUp}
          label="Konverteringsgrad"
          value={`${conversionRate}%`}
          subtext={conversionSubtext}
          color={conversionRate >= 25 ? 'green' : 'amber'}
        />
      </div>

      {/* ═══ SEKTION 2: Dashboard-insikter ═══ */}
      <AnimatePresence>
        {showInsights && !loading && offers.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Panel A: Konverteringstratt (4 statusar som matchar Oneflow-donuten) */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-white">Konverteringstratt</h3>
                </div>
                {offerStats ? (
                  <div className="space-y-2">
                    <FunnelBar label="Pågående" value={offerStats.pending} max={offerStats.total_sent} color="bg-blue-500" />
                    <FunnelBar label="Signerat" value={offerStats.signed} max={offerStats.total_sent} color="bg-green-500" />
                    <FunnelBar label="Förfallet" value={offerStats.overdue} max={offerStats.total_sent} color="bg-amber-500" />
                    <FunnelBar label="Avfärdat" value={offerStats.declined} max={offerStats.total_sent} color="bg-red-500/70" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FunnelBar label="Pågående" value={localStats.pending} max={offers.length || 1} color="bg-blue-500" />
                    <FunnelBar label="Signerat" value={localStats.signed} max={offers.length || 1} color="bg-green-500" />
                    <FunnelBar label="Förfallet" value={localStats.overdue} max={offers.length || 1} color="bg-amber-500" />
                    <FunnelBar label="Avfärdat" value={localStats.declined} max={offers.length || 1} color="bg-red-500/70" />
                  </div>
                )}
                <p className="text-[10px] text-slate-500 mt-2">
                  {conversionRate}% konvertering{offerStats ? ' (Oneflow)' : ''}
                </p>
              </div>

              {/* Panel B: Åldersfördelning */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-white">Åldersfördelning</h3>
                </div>
                <AgingBar buckets={localStats.ageBuckets} total={offers.length} />
                {localStats.ageBuckets.old > 0 && (
                  <p className="text-[10px] text-red-400 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {localStats.ageBuckets.old} offerter har legat &ouml;ver 90 dagar
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
                  {localStats.signed > 0 && (
                    <AlertCard
                      icon={CalendarCheck}
                      text={`${localStats.signed} signerade att boka in`}
                      subtext={formatKr(localStats.signedValue)}
                      severity="red"
                      onClick={() => setActiveTab('signed')}
                    />
                  )}
                  {localStats.utanKontakt30d > 0 && (
                    <AlertCard
                      icon={Phone}
                      text={`${localStats.utanKontakt30d} utan kontakt (>30d)`}
                      severity="amber"
                      onClick={() => { setActiveTab('alla'); setSortBy('oldest') }}
                    />
                  )}
                  {localStats.ejKvitterat > 0 && (
                    <AlertCard
                      icon={Eye}
                      text={`${localStats.ejKvitterat} ej kvitterade`}
                      severity="blue"
                      onClick={() => setActiveTab('alla')}
                    />
                  )}
                  {localStats.signed === 0 && localStats.utanKontakt30d === 0 && localStats.ejKvitterat === 0 && (
                    <p className="text-xs text-slate-500 py-2">Allt ser bra ut!</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flikar + sök + sort + dismissed toggle */}
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
            placeholder="Sök kund, kontakt, e-post..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          />
        </div>

        <SortDropdown value={sortBy} onChange={setSortBy} />

        {/* Visa dolda toggle */}
        {dismissedCount > 0 && (
          <button
            onClick={() => setShowDismissed(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showDismissed
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            Dolda ({dismissedCount})
          </button>
        )}
      </div>

      {/* ═══ SEKTION 3: Tabell ═══ */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          <span className="ml-2 text-sm text-slate-400">Laddar offerter...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="mx-auto w-10 h-10 text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">Inga offerter matchar filtret</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-700/50">
                {isVisible('expand') && <th className="px-2 py-2.5 font-medium w-8" />}
                {isVisible('offerStatus') && <th className="px-3 py-2.5 font-medium">Offertstatus</th>}
                {isVisible('kund') && <th className="px-3 py-2.5 font-medium">Kund / Kontakt</th>}
                {isVisible('adress') && <th className="px-3 py-2.5 font-medium">Adress</th>}
                {isVisible('pris') && <th className="px-3 py-2.5 font-medium">Pris</th>}
                {isVisible('ansvarig') && <th className="px-3 py-2.5 font-medium">Ansvarig</th>}
                {isVisible('skickat') && <th className="px-3 py-2.5 font-medium">Skickat</th>}
                {isVisible('koordStatus') && <th className="px-3 py-2.5 font-medium">Koord. status</th>}
                {isVisible('forsok') && <th className="px-3 py-2.5 font-medium">Försök</th>}
                {isVisible('anteckning') && <th className="px-3 py-2.5 font-medium">Anteckning</th>}
                {isVisible('atgarder') && <th className="px-3 py-2.5 font-medium">Åtgärder</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <PipelineRow
                  key={o.id}
                  offer={o}
                  isExpanded={expandedId === o.id}
                  onToggleExpand={() => setExpandedId(expandedId === o.id ? null : o.id)}
                  basePath={basePath}
                  senderEmail={senderEmail}
                  onGoToCustomer={(cid) => navigate(`${basePath}/befintliga-kunder?customerId=${cid}`)}
                  onOpenExtend={(offer) => setExtendTarget(offer)}
                  onAcknowledge={handleAcknowledge}
                  onOpenContactPopover={setContactPopoverOfferId}
                  contactPopoverOpen={contactPopoverOfferId === o.id}
                  onLogContact={handleLogContact}
                  onStartEditNote={(id, currentNote) => { setEditingNoteId(id); setNoteText(currentNote || '') }}
                  editingNoteId={editingNoteId}
                  noteText={noteText}
                  onNoteTextChange={setNoteText}
                  onSaveNote={handleSaveNote}
                  onCancelNote={() => { setEditingNoteId(null); setNoteText('') }}
                  onStatusChange={handleStatusChange}
                  onBook={handleBookOffer}
                  onDismiss={handleDismiss}
                  onUndismiss={handleUndismiss}
                  isVisible={isVisible}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Förläng-dialog */}
      <ExtendSigningPeriodDialog
        isOpen={!!extendTarget}
        onClose={() => setExtendTarget(null)}
        onExtended={() => {
          setExtendTarget(null)
          fetchOffers()
        }}
        offer={extendTarget}
      />
    </div>
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
  if (total === 0) return <p className="text-xs text-slate-500">Inga offerter</p>
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
              title={`${seg.label}: ${count} offerter`}
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

// ─── Custom sort-dropdown (mörkt tema) ───

function SortDropdown({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = SORT_OPTIONS.find(o => o.key === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
      >
        {current?.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => { onChange(opt.key); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-[11px] font-medium hover:bg-slate-700/50 transition-colors ${
                opt.key === value ? 'text-[#20c58f]' : 'text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tabellrad ───

interface PipelineRowProps {
  offer: PipelineOfferRow
  isExpanded: boolean
  onToggleExpand: () => void
  basePath: string
  senderEmail?: string
  onGoToCustomer: (customerId: string) => void
  onOpenExtend: (offer: PipelineOfferRow) => void
  onAcknowledge: (o: PipelineOfferRow) => void
  onOpenContactPopover: (id: string | null) => void
  contactPopoverOpen: boolean
  onLogContact: (o: PipelineOfferRow, method: ContactMethod, note?: string) => void
  onStartEditNote: (id: string, currentNote: string | null) => void
  editingNoteId: string | null
  noteText: string
  onNoteTextChange: (text: string) => void
  onSaveNote: (o: PipelineOfferRow) => void
  onCancelNote: () => void
  onStatusChange: (o: PipelineOfferRow, status: CoordinatorCaseStatus) => void
  onBook: (o: PipelineOfferRow) => void
  onDismiss: (o: PipelineOfferRow) => void
  onUndismiss: (o: PipelineOfferRow) => void
  isVisible: (columnId: string) => boolean
}

function PipelineRow({
  offer: o, isExpanded, onToggleExpand, basePath, senderEmail,
  onGoToCustomer, onOpenExtend,
  onAcknowledge, onOpenContactPopover, contactPopoverOpen,
  onLogContact, onStartEditNote, editingNoteId, noteText, onNoteTextChange,
  onSaveNote, onCancelNote, onStatusChange, onBook, onDismiss, onUndismiss, isVisible,
}: PipelineRowProps) {
  const isNew = !o.action || o.action.coordinator_status === 'new'
  const status = o.action?.coordinator_status || 'new'
  const isSigned = o.status === 'signed'
  const isDismissed = !!o.action?.dismissed_at
  const canExtend = o.status === 'pending' || o.status === 'overdue'
  const offerStatusCfg = OFFER_STATUS_CONFIG[o.status] || OFFER_STATUS_CONFIG.pending

  // Räkna synliga kolumner för colSpan vid expanded rad
  const visibleColCount = [
    'expand','offerStatus','kund','adress','pris','ansvarig','skickat','koordStatus','forsok','anteckning','atgarder',
  ].filter(isVisible).length

  const rowBg = isDismissed
    ? 'opacity-50'
    : isSigned
      ? 'bg-green-500/[0.03]'
      : isNew
        ? 'bg-amber-500/[0.03]'
        : ''

  return (
    <>
    <tr className={`border-b border-slate-800/40 border-l-2 ${getAgeBorderColor(o.created_at)} hover:bg-slate-800/30 transition-colors ${rowBg}`}>
      {/* Expand-chevron */}
      {isVisible('expand') && (
        <td className="px-2 py-2.5">
          <button
            onClick={onToggleExpand}
            className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            title={isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
          >
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
      )}

      {/* Offertstatus (Oneflow) */}
      {isVisible('offerStatus') && (
        <td className="px-3 py-2.5">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${offerStatusCfg.bgColor} ${offerStatusCfg.color}`}>
            {offerStatusCfg.label}
          </span>
        </td>
      )}

      {/* Kund / Kontakt + mailto */}
      {isVisible('kund') && (
        <td className="px-3 py-2.5">
          <div className="max-w-[180px]">
            <p className="text-white truncate text-[11px] font-medium">{o.company_name || o.contact_person || '—'}</p>
            {o.contact_person && o.company_name && (
              <p className="text-slate-500 truncate text-[10px]">{o.contact_person}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {o.contact_phone && (
                <span className="text-slate-500 truncate text-[10px]">{o.contact_phone}</span>
              )}
              {o.contact_email && (
                <a
                  href={`mailto:${o.contact_email}`}
                  className="text-blue-400 hover:text-blue-300 transition-colors shrink-0"
                  title={o.contact_email}
                  onClick={e => e.stopPropagation()}
                >
                  <MailIcon className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </td>
      )}

      {/* Adress */}
      {isVisible('adress') && (
        <td className="px-3 py-2.5">
          <span className="text-slate-400 truncate block max-w-[140px]" title={o.contact_address || ''}>
            {o.contact_address || '—'}
          </span>
        </td>
      )}

      {/* Pris */}
      {isVisible('pris') && (
        <td className="px-3 py-2.5">
          <span className="text-white font-medium">{formatPrice(o.total_value)}</span>
        </td>
      )}

      {/* Ansvarig (BeGone-medarbetare) */}
      {isVisible('ansvarig') && (
        <td className="px-3 py-2.5">
          <span className="text-slate-300 font-medium">{o.begone_employee_name || '—'}</span>
        </td>
      )}

      {/* Skickat — med ålderbadge */}
      {isVisible('skickat') && (
        <td className="px-3 py-2.5">
          <AgeBadge dateStr={o.created_at} />
        </td>
      )}

      {/* Koord.status — delad dropdown */}
      {isVisible('koordStatus') && (
        <td className="px-3 py-2.5">
          <CoordinatorStatusDropdown value={status} onChange={(s) => onStatusChange(o, s)} />
        </td>
      )}

      {/* Försök */}
      {isVisible('forsok') && (
        <td className="px-3 py-2.5">
          <span className={`text-[11px] font-medium ${(o.action?.contact_attempts || 0) > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
            {o.action?.contact_attempts || 0}
          </span>
        </td>
      )}

      {/* Anteckning (inline edit) */}
      {isVisible('anteckning') && (
        <td className="px-3 py-2.5">
          {editingNoteId === o.id ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={noteText}
                onChange={e => onNoteTextChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onSaveNote(o)
                  if (e.key === 'Escape') onCancelNote()
                }}
                autoFocus
                className="w-full px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-600 rounded text-white focus:ring-1 focus:ring-[#20c58f] focus:outline-none"
                placeholder="Skriv anteckning..."
              />
              <button onClick={() => onSaveNote(o)} className="text-[#20c58f] hover:text-white text-[10px] shrink-0">Spara</button>
              <button onClick={() => onCancelNote()} className="text-slate-500 hover:text-white transition-colors shrink-0 p-0.5" title="Stäng">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onStartEditNote(o.id, o.action?.coordinator_notes || null)}
              className="text-slate-500 hover:text-white text-[10px] text-left truncate max-w-[120px] block transition-colors"
              title={o.action?.coordinator_notes || 'Klicka för att lägga till'}
            >
              {o.action?.coordinator_notes || '+ Anteckning'}
            </button>
          )}
        </td>
      )}

      {/* Åtgärder */}
      {isVisible('atgarder') && (
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 relative">
            {/* Gå till kund (om kopplad) */}
            {o.customer_id && (
              <button
                onClick={() => onGoToCustomer(o.customer_id!)}
                className="p-1 rounded text-[#20c58f] hover:bg-[#20c58f]/15 transition-colors"
                title="Gå till kund"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Öppna i Oneflow */}
            {o.oneflow_contract_id && (
              <a
                href={`https://app.oneflow.com/contracts/${o.oneflow_contract_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                title="Öppna i Oneflow"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Förläng signeringsperiod */}
            {canExtend && !isDismissed && (
              <button
                onClick={() => onOpenExtend(o)}
                className="p-1 rounded text-amber-400 hover:bg-amber-500/20 transition-colors"
                title="Förläng signeringsperiod"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Kvittera */}
            {isNew && !isDismissed && (
              <button
                onClick={() => onAcknowledge(o)}
                className="p-1 rounded text-blue-400 hover:bg-blue-500/20 transition-colors"
                title="Kvittera"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Logga kontakt */}
            {!isDismissed && (
              <div className="relative">
                <button
                  onClick={() => onOpenContactPopover(contactPopoverOpen ? null : o.id)}
                  className="p-1 rounded text-purple-400 hover:bg-purple-500/20 transition-colors"
                  title="Logga kontaktförsök"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
                {contactPopoverOpen && (
                  <ContactPopover
                    onSelect={(method, note) => onLogContact(o, method, note)}
                    onClose={() => onOpenContactPopover(null)}
                  />
                )}
              </div>
            )}

            {/* Boka in (bara signerade) */}
            {isSigned && !isDismissed && (
              <button
                onClick={() => onBook(o)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#20c58f]/15 text-[#20c58f] hover:bg-[#20c58f]/25 transition-colors"
              >
                <CalendarCheck className="w-3 h-3" /> Boka
              </button>
            )}

            {/* Dölja / Återställ */}
            {isDismissed ? (
              <button
                onClick={() => onUndismiss(o)}
                className="p-1 rounded text-amber-400 hover:bg-amber-500/20 transition-colors"
                title="Visa igen"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onDismiss(o)}
                className="p-1 rounded text-slate-500 hover:bg-slate-700/50 hover:text-slate-300 transition-colors"
                title="Dölj offert"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
    {isExpanded && (
      <tr className="border-b border-slate-800/40 bg-slate-900/30">
        <td colSpan={visibleColCount} className="p-0">
          <AnimatePresence initial={false}>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <OfferRowDetail
                offer={{
                  id: o.id,
                  oneflow_contract_id: o.oneflow_contract_id,
                  company_name: o.company_name,
                  contact_person: o.contact_person,
                  contact_email: o.contact_email,
                  contact_phone: o.contact_phone,
                  created_at: o.created_at,
                }}
                senderEmail={senderEmail}
              />
            </motion.div>
          </AnimatePresence>
        </td>
      </tr>
    )}
    </>
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
