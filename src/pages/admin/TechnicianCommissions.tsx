// src/pages/admin/TechnicianCommissions.tsx — Provisioner 2.0 (/admin/provisioner)
//
// Arbetskön ersätter statusraden och de fem filterknapparna: fem celler på EN yta
// i pengarnas flödesordning. Listan grupperas på payout_month (DB-sanningen via
// den delade groupPostsByPayoutMonth) — inte på skapandedatum.
// Inga piller: statuspunkt + neutral text, tabular-nums, brandgrönt #20c58f.
import React, { useState, useMemo, useEffect } from 'react'
import {
  RefreshCw, Search, Settings, Eye, ChevronDown, ChevronRight, Wallet, Download
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { useProvisionDashboard } from '../../hooks/useProvisionDashboard'
import type { PayoutMonthTechnician, PayoutMonthView } from '../../hooks/useProvisionDashboard'
import { ProvisionExportService } from '../../services/provisionExportService'
import type { CommissionStatus, CommissionPost } from '../../types/provision'
import {
  daysSince,
  formatPayoutMonthLower,
  payoutSalaryLabel,
  shortMonthLabel,
  UNPAID_AGE_WARNING_DAYS
} from '../../utils/provisionPayout'
import { FlowBand, ProgressRing, Sparkline } from '../../components/shared/ProvisionCharts'
import ProvisionSettingsPanel from '../../components/admin/provisions/ProvisionSettingsPanel'
import InvoiceDetailModal from '../../components/admin/invoicing/InvoiceDetailModal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { InvoiceService } from '../../services/invoiceService'
import toast from 'react-hot-toast'
import Select from '../../components/ui/Select'

const formatCurrency = (n: number) =>
  n.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr'

/** Statuspunktens färg — samma språk i admin- och teknikervyn. */
const STATUS_DOT: Record<CommissionStatus, string> = {
  pending_invoice: '#64748b',   // slate-500
  ready_for_payout: '#60a5fa',  // blue-400
  approved: '#20c58f',          // brand
  paid_out: '#475569'           // slate-600 (dämpad)
}

/** Klartextstatus per post — ersätter statuspiller. */
function postStatusText(post: CommissionPost, now: Date): { text: string; who?: string; age: boolean } {
  switch (post.status) {
    case 'pending_invoice': {
      const age = daysSince(post.created_at, now)
      return {
        text: `Väntar – kundfakturan obetald (${age} dgr)`,
        age: age > UNPAID_AGE_WARNING_DAYS
      }
    }
    case 'ready_for_payout':
      return { text: 'Redo', age: false }
    case 'approved': {
      const when = post.approved_at ? post.approved_at.slice(0, 10) : null
      const by = post.approved_by || null
      const who = by && when ? `av ${by} · ${when}` : by ? `av ${by}` : when || undefined
      return { text: 'Godkänd', who, age: false }
    }
    case 'paid_out':
      return {
        text: post.payout_month
          ? `Utbetald med ${payoutSalaryLabel(post.payout_month)}`
          : 'Utbetald',
        age: false
      }
  }
}

/** "12 500 kr → 625 kr (5 %, ½ andel)" */
function shareLabel(share: number): string {
  if (share >= 100) return ''
  if (Math.abs(share - 50) < 0.01) return ', ½ andel'
  if (Math.abs(share - 33.33) < 0.5) return ', ⅓ andel'
  return `, ${share} % andel`
}

const TechnicianCommissions: React.FC = () => {
  const { profile } = useAuth()
  const {
    selectedMonth,
    filters,
    searchQuery,
    allPosts,
    payoutMonths,
    workQueue,
    flowSegments,
    summaries,
    settings,
    loading,
    selectedIds,
    actionLoading,
    monthOptions,
    goToMonth,
    setStatusFilter,
    setSearchQuery,
    toggleSelect,
    toggleAll,
    clearSelection,
    approveSelected,
    markPaidOut,
    markReadyForPayout,
    refreshData,
  } = useProvisionDashboard()

  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'payouts' | 'posts'>('payouts')
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedTechs, setExpandedTechs] = useState<Set<string>>(new Set())
  const [confirmManualReady, setConfirmManualReady] = useState(false)

  const now = useMemo(() => new Date(), [])
  const currentMonthKey = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    [now]
  )

  const exporter = useMemo(
    () => ({ userId: profile?.user_id ?? null, name: profile?.display_name || profile?.email || null }),
    [profile?.user_id, profile?.display_name, profile?.email]
  )

  // Fakturamodal — öppnas från en provisionspost via dess case_id
  const [invoiceModalId, setInvoiceModalId] = useState<string | null>(null)
  const [openingInvoiceCaseId, setOpeningInvoiceCaseId] = useState<string | null>(null)

  const openInvoiceForCase = async (caseId: string | null | undefined) => {
    if (!caseId) return
    setOpeningInvoiceCaseId(caseId)
    try {
      const id = await InvoiceService.getInvoiceIdByCase(caseId)
      if (!id) {
        toast.error('Ingen faktura hittades för ärendet')
        return
      }
      setInvoiceModalId(id)
    } catch {
      toast.error('Kunde inte öppna fakturan')
    } finally {
      setOpeningInvoiceCaseId(null)
    }
  }

  // Auto-expandera innevarande payout-månad (eller första gruppen)
  useEffect(() => {
    if (payoutMonths.length === 0) return
    setExpandedMonths(prev => {
      if (prev.size > 0) return prev
      const match = payoutMonths.find(m => m.month_key === currentMonthKey)
      return new Set([(match || payoutMonths[0]).month_key])
    })
  }, [payoutMonths, currentMonthKey])

  const totalCount = allPosts.length
  const totalSum = allPosts.reduce((s, p) => s + p.commission_amount, 0)
  const allSelected = allPosts.length > 0 && allPosts.every(p => selectedIds.has(p.id))

  const handleApprove = async () => {
    try {
      await approveSelected(profile?.display_name || profile?.email || 'admin')
      toast.success('Poster godkända')
    } catch { toast.error('Kunde inte godkänna') }
  }

  const handleMarkPaidOut = async () => {
    try {
      await markPaidOut(exporter)
      toast.success('Poster markerade som utbetalda')
    } catch { toast.error('Fel vid statusändring') }
  }

  const handleManualReady = async () => {
    try {
      await markReadyForPayout({ byName: profile?.display_name || profile?.email || undefined })
      toast.success('Poster markerade som redo')
    } catch {
      toast.error('Fel vid statusändring')
    } finally {
      setConfirmManualReady(false)
    }
  }

  const handleExport = () => {
    if (summaries.length === 0) return toast.error('Inga poster att exportera')
    ProvisionExportService.exportPayrollCSV(summaries, selectedMonth.value, exporter)
    toast.success('Löneunderlag exporterat')
  }

  const handleExportSelected = () => {
    const posts = allPosts.filter(p => selectedIds.has(p.id))
    if (posts.length === 0) return
    ProvisionExportService.exportDetailedCSV(posts, selectedMonth.value, exporter)
    toast.success('Löneunderlag exporterat')
  }

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }

  const toggleTech = (key: string) => {
    setExpandedTechs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const activeStatus = filters.status && filters.status !== 'all' ? filters.status : null
  const onQueueClick = (status: CommissionStatus) =>
    setStatusFilter(activeStatus === status ? null : status)

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* ═══ SIDHUVUD med flödesband ═══ */}
      <div className="flex items-start gap-6 mb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">Provisioner</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Teknikerprovisioner från betalda kundfakturor
          </p>
        </div>

        <FlowBand
          segments={flowSegments}
          width={300}
          height={11}
          showLabels
          title="Flödesband: var pengarna sitter"
          className="hidden lg:block flex-shrink-0 mt-1"
        />

        {settings && profile?.role === 'admin' && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-[#20c58f] hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Inställningar</span>
          </button>
        )}
      </div>

      {/* Inställningspanel */}
      {showSettings && settings && profile && (
        <div className="mb-4">
          <ProvisionSettingsPanel
            settings={settings}
            onSettingsUpdated={refreshData}
            onClose={() => setShowSettings(false)}
            userEmail={profile.email || ''}
          />
        </div>
      )}

      {/* Fakturamodal — öppnas från en provisionspost */}
      <InvoiceDetailModal
        isOpen={invoiceModalId !== null}
        invoiceId={invoiceModalId}
        onClose={() => setInvoiceModalId(null)}
        onStatusChange={refreshData}
      />

      {/* Bekräftelse: manuell "markera redo" kringgår betald-faktura-regeln */}
      <ConfirmModal
        isOpen={confirmManualReady}
        onClose={() => setConfirmManualReady(false)}
        onConfirm={handleManualReady}
        title="Markera redo utan betald kundfaktura?"
        message={`Provision betalas normalt först när kundfakturan är betald. Att markera ${selectedIds.size} post${selectedIds.size !== 1 ? 'er' : ''} som redo kringgår den regeln: inget betaldatum och ingen utbetalningsmånad sätts, och posterna ligger kvar preliminärt tills en riktig betalning registreras. Åtgärden loggas i postens anteckningar.`}
        confirmLabel="Markera redo ändå"
        variant="warning"
        loading={actionLoading}
      />

      {/* ═══ TABBAR ═══ */}
      <div className="flex items-center gap-6 border-b border-slate-700 mb-0">
        <button
          onClick={() => setActiveTab('payouts')}
          className={`py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'payouts'
              ? 'text-[#20c58f] border-[#20c58f]'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          Utbetalningar
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'posts'
              ? 'text-[#20c58f] border-[#20c58f]'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          Alla poster
        </button>
      </div>

      {/* ═══ ARBETSKÖ — fem celler på en yta ═══ */}
      <div className="flex flex-wrap bg-slate-800/40 border-b border-slate-700">
        <QueueCell
          label="Väntar kundbetalning"
          count={workQueue.pending.count}
          amount={workQueue.pending.total}
          hint={workQueue.pending.count > 0 ? `äldsta ${workQueue.pending.oldestDays} dgr` : 'inget väntar'}
          hintWarn={workQueue.pending.warn}
          active={activeStatus === 'pending_invoice'}
          onClick={() => onQueueClick('pending_invoice')}
        />
        <QueueCell
          label="Redo att godkänna"
          count={workQueue.ready.count}
          amount={workQueue.ready.total}
          countTone={workQueue.ready.count > 0 ? 'ok' : undefined}
          hint={activeStatus === 'ready_for_payout' ? 'aktivt filter' : 'här finns handling'}
          active={activeStatus === 'ready_for_payout'}
          onClick={() => onQueueClick('ready_for_payout')}
        />
        <QueueCell
          label="Godkänt – att utbetala"
          count={workQueue.approved.count}
          amount={workQueue.approved.total}
          countTone={workQueue.approved.count > 0 ? 'warn' : undefined}
          hint="driver löneunderlaget"
          active={activeStatus === 'approved'}
          onClick={() => onQueueClick('approved')}
        />
        <QueueCell
          label="Utbetalt i år"
          count={workQueue.paidThisYear.count}
          amount={workQueue.paidThisYear.total}
          hint="exportlogg per månad"
          calm
        />
        <QueueCell
          label="Intjänat i år"
          amount={workQueue.earnedThisYear.total}
          hint="avstämningstal · ej filter"
          calm
        />
      </div>

      {/* ═══ VERKTYGSRAD ═══ */}
      <div className="flex items-center gap-2.5 px-1 py-2.5 border-b border-slate-700/50">
        <div className="relative flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Sök tekniker, BE-nr, kund…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f] w-56"
          />
        </div>

        <Select
          value={selectedMonth.value}
          onChange={(v) => {
            const opt = monthOptions.find(m => m.value === v)
            if (opt) goToMonth(opt)
          }}
          options={monthOptions.map(m => ({ value: m.value, label: m.display }))}
          className="w-40"
        />

        <div className="flex-1" />

        <button
          onClick={() => refreshData()}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#20c58f] hover:bg-[#1cb07f] text-[#06281c] rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Löneunderlag · {shortMonthLabel(selectedMonth.value)}
        </button>
      </div>

      {/* ═══ BATCHRAD — flat, bara vid markering ═══ */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 px-3 py-2 text-xs bg-[#20c58f]/[0.14] border-b border-[#20c58f]/30">
          <span className="text-white font-semibold tabular-nums">
            {selectedIds.size} markerade
          </span>
          <span className="text-[#20c58f]/40">·</span>
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="text-[#20c58f] font-semibold hover:underline disabled:opacity-50"
          >
            Godkänn
          </button>
          <span className="text-[#20c58f]/40">·</span>
          <button
            onClick={handleExportSelected}
            disabled={actionLoading}
            className="text-[#20c58f] font-semibold hover:underline disabled:opacity-50"
          >
            Exportera löneunderlag
          </button>
          <span className="text-[#20c58f]/40">·</span>
          <button
            onClick={handleMarkPaidOut}
            disabled={actionLoading}
            className="text-[#20c58f] font-semibold hover:underline disabled:opacity-50"
          >
            Markera utbetald
          </button>
          <span className="text-[#20c58f]/40">·</span>
          <button
            onClick={() => setConfirmManualReady(true)}
            disabled={actionLoading}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            Markera redo manuellt
          </button>
          <div className="flex-1" />
          <button onClick={clearSelection} className="text-slate-400 hover:text-slate-200">
            Avmarkera
          </button>
        </div>
      )}

      {/* ═══ UTBETALNINGAR ═══ */}
      {activeTab === 'payouts' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : payoutMonths.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Wallet className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Inga provisionsposter för denna period.</p>
            </div>
          ) : (
            <div>
              {payoutMonths.map(month => (
                <MonthGroup
                  key={month.month_key}
                  month={month}
                  isCurrent={month.month_key === currentMonthKey}
                  expanded={expandedMonths.has(month.month_key)}
                  onToggle={() => toggleMonth(month.month_key)}
                  expandedTechs={expandedTechs}
                  onToggleTech={toggleTech}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onOpenInvoice={openInvoiceForCase}
                  openingInvoiceCaseId={openingInvoiceCaseId}
                  now={now}
                />
              ))}

              <div className="flex justify-between px-3 py-2 text-xs text-slate-400 border-t border-slate-700/50">
                <span>
                  {payoutMonths.length} utbetalningsmånad{payoutMonths.length !== 1 ? 'er' : ''} ·{' '}
                  {payoutMonths.reduce((s, m) => s + m.post_count, 0)} poster
                </span>
                <span className="text-white font-semibold tabular-nums">
                  Totalt: {formatCurrency(payoutMonths.reduce((s, m) => s + m.total_commission, 0))}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ ALLA POSTER ═══ */}
      {activeTab === 'posts' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : allPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Wallet className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Inga provisionsposter för denna period.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-700/50">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  Markera alla
                </span>
              </div>
              <div className="max-h-[calc(100vh-380px)] overflow-auto">
                {allPosts.map(post => (
                  <PostRow
                    key={post.id}
                    post={post}
                    selected={selectedIds.has(post.id)}
                    onToggle={() => toggleSelect(post.id)}
                    onOpenInvoice={() => openInvoiceForCase(post.case_id)}
                    opening={openingInvoiceCaseId === post.case_id}
                    showTechnician
                    now={now}
                  />
                ))}
              </div>
              <div className="flex justify-between px-3 py-2 text-xs text-slate-400 border-t border-slate-700/50">
                <span>
                  {totalCount} poster
                  {selectedIds.size > 0 && ` · ${selectedIds.size} markerade`}
                </span>
                <span className="text-white font-semibold tabular-nums">
                  Summa: {formatCurrency(totalSum)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Arbetskö-cell ───────────────────────────────────────────────

function QueueCell({
  label, count, amount, hint, hintWarn, countTone, active, calm, onClick
}: {
  label: string
  count?: number
  amount: number
  hint?: string
  hintWarn?: boolean
  countTone?: 'ok' | 'warn'
  active?: boolean
  calm?: boolean
  onClick?: () => void
}) {
  const toneClass = countTone === 'ok'
    ? 'text-[#20c58f]'
    : countTone === 'warn'
      ? 'text-amber-400'
      : active ? 'text-[#20c58f]' : 'text-white'

  const content = (
    <>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
      <div className={`tabular-nums ${calm ? 'text-sm font-semibold text-slate-300' : 'text-[15px] font-bold text-white'}`}>
        {count !== undefined ? (
          <>
            <span className={calm ? '' : `text-[17px] ${toneClass}`}>{count}</span>
            <span className="ml-1 text-xs font-medium text-slate-400">· {formatCurrency(amount)}</span>
          </>
        ) : (
          <span>{formatCurrency(amount)}</span>
        )}
      </div>
      {hint && (
        <div className={`text-[10px] mt-px ${hintWarn ? 'text-amber-400' : 'text-slate-500'}`}>{hint}</div>
      )}
    </>
  )

  const base = 'flex-1 min-w-[170px] text-left px-4 py-2.5 border-l border-slate-700/50 first:border-l-0 border-b-2'

  if (!onClick) {
    return <div className={`${base} border-b-transparent`}>{content}</div>
  }

  return (
    <button
      onClick={onClick}
      className={`${base} transition-colors hover:bg-slate-700/30 ${
        active ? 'border-b-[#20c58f]' : 'border-b-transparent'
      }`}
    >
      {content}
    </button>
  )
}

// ─── Månadsgrupp (payout_month) ──────────────────────────────────

function MonthGroup({
  month, isCurrent, expanded, onToggle, expandedTechs, onToggleTech,
  selectedIds, onToggleSelect, onOpenInvoice, openingInvoiceCaseId, now
}: {
  month: PayoutMonthView
  isCurrent: boolean
  expanded: boolean
  onToggle: () => void
  expandedTechs: Set<string>
  onToggleTech: (key: string) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onOpenInvoice: (caseId: string | null | undefined) => void
  openingInvoiceCaseId: string | null
  now: Date
}) {
  const edge = isCurrent ? 'border-l-2 border-l-[#20c58f]' : 'border-l-2 border-l-transparent'

  return (
    <div className="border-b border-slate-700/50">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-2.5 bg-slate-800/40 hover:bg-slate-700/30 transition-colors ${edge}`}
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}

        <ProgressRing
          value={month.paid_ratio}
          size={28}
          stroke={3}
          title={`${Math.round(month.paid_ratio * 100)} procent utbetalt`}
          className="flex-shrink-0"
        />

        <span className="text-[13.5px] font-bold text-white">
          {formatPayoutMonthLower(month.month_key)}
        </span>

        {month.preliminary && (
          <span className="text-[11px] text-slate-500">
            preliminärt – flyttas när fakturan betalas
          </span>
        )}

        <div className="flex-1" />

        <span className="text-xs text-slate-400 tabular-nums">
          {month.technician_count} tekniker · {month.post_count} poster ·{' '}
          <span className="text-white font-semibold">{formatCurrency(month.total_commission)}</span>
          {month.paid_out_date && (
            <span className="text-slate-500"> · utbetald {month.paid_out_date.slice(0, 10)}</span>
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`overflow-hidden border-t border-slate-700/50 ${edge}`}
          >
            {month.technicians.map(tech => (
              <TechRow
                key={`${month.month_key}::${tech.technician_id}`}
                techKey={`${month.month_key}::${tech.technician_id}`}
                tech={tech}
                expanded={expandedTechs.has(`${month.month_key}::${tech.technician_id}`)}
                onToggle={onToggleTech}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onOpenInvoice={onOpenInvoice}
                openingInvoiceCaseId={openingInvoiceCaseId}
                now={now}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Teknikerrad ─────────────────────────────────────────────────

function TechRow({
  techKey, tech, expanded, onToggle, selectedIds, onToggleSelect,
  onOpenInvoice, openingInvoiceCaseId, now
}: {
  techKey: string
  tech: PayoutMonthTechnician
  expanded: boolean
  onToggle: (key: string) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onOpenInvoice: (caseId: string | null | undefined) => void
  openingInvoiceCaseId: string | null
  now: Date
}) {
  const dots: Array<{ color: string; n: number }> = [
    { color: STATUS_DOT.pending_invoice, n: tech.statuses.pending },
    { color: STATUS_DOT.ready_for_payout, n: tech.statuses.ready },
    { color: STATUS_DOT.approved, n: tech.statuses.approved },
    { color: STATUS_DOT.paid_out, n: tech.statuses.paid },
  ].filter(d => d.n > 0)

  return (
    <div>
      <button
        onClick={() => onToggle(techKey)}
        className="w-full flex items-center gap-3.5 px-3 py-2.5 hover:bg-slate-700/30 transition-colors border-b border-slate-700/50"
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />}

        <span className="text-[13px] font-semibold text-white min-w-[150px] text-left">
          {tech.technician_name}
        </span>

        <span className="text-[11.5px] text-slate-500 min-w-[56px] text-left tabular-nums">
          {tech.post_count} poster
        </span>

        <Sparkline
          values={tech.spark}
          width={72}
          height={16}
          title="Provisionstrend 6 månader"
          className="flex-shrink-0 opacity-90"
        />

        <div className="flex-1" />

        <span className="inline-flex items-center gap-3 text-[11.5px] text-slate-400 tabular-nums">
          {dots.map(d => (
            <span key={d.color} className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
              {d.n}
            </span>
          ))}
        </span>

        <span className="text-[13px] font-semibold text-white tabular-nums min-w-[78px] text-right">
          {formatCurrency(tech.total_commission)}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {tech.posts.map(post => (
              <PostRow
                key={post.id}
                post={post}
                selected={selectedIds.has(post.id)}
                onToggle={() => onToggleSelect(post.id)}
                onOpenInvoice={() => onOpenInvoice(post.case_id)}
                opening={openingInvoiceCaseId === post.case_id}
                now={now}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Postrad ─────────────────────────────────────────────────────

function PostRow({ post, selected, onToggle, onOpenInvoice, opening, showTechnician, now }: {
  post: CommissionPost
  selected: boolean
  onToggle: () => void
  onOpenInvoice: () => void
  opening: boolean
  showTechnician?: boolean
  now: Date
}) {
  const status = postStatusText(post, now)

  return (
    <div
      onClick={onOpenInvoice}
      className={`flex items-center gap-2.5 pl-6 pr-3 py-2 text-[12.5px] border-b border-slate-700/50 cursor-pointer transition-colors ${
        selected ? 'bg-[#20c58f]/[0.05]' : 'bg-slate-950/25'
      } hover:bg-slate-700/20`}
      title="Öppna faktura"
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f] flex-shrink-0"
      />

      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: STATUS_DOT[post.status] }}
      />

      <span className="font-mono text-[11.5px] font-semibold text-white w-[104px] flex-shrink-0 truncate">
        {post.case_number || '—'}
      </span>

      <span className="text-slate-300 truncate min-w-0 flex-1">
        {post.case_title || '—'}
        {showTechnician && <span className="text-slate-500"> · {post.technician_name}</span>}
      </span>

      <span className="tabular-nums whitespace-nowrap flex-shrink-0 w-[230px] text-right">
        <span className="text-slate-500">{post.base_amount.toLocaleString('sv-SE')} kr</span>
        <span className="text-slate-500"> → </span>
        <span className="text-white font-semibold">{formatCurrency(post.commission_amount)}</span>
        <span className="text-slate-500 text-[11px]">
          {' '}({post.commission_percentage} %{shareLabel(post.share_percentage)}{post.is_rot_rut ? ' · ROT' : ''})
        </span>
      </span>

      <span
        className={`w-[250px] flex-shrink-0 truncate ${status.age ? 'text-amber-400' : 'text-slate-300'}`}
      >
        {status.text}
        {status.who && <span className="text-slate-500"> {status.who}</span>}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onOpenInvoice() }}
        disabled={opening}
        className="p-1 text-slate-500 hover:text-[#20c58f] rounded transition-colors flex-shrink-0 disabled:opacity-50"
        title="Öppna faktura"
      >
        {opening
          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export default TechnicianCommissions
