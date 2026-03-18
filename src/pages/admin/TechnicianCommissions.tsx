// src/pages/admin/TechnicianCommissions.tsx - Provisionshantering med tabbad vy
import React, { useState, useMemo } from 'react'
import {
  Wallet, RefreshCw, Search, Download, Settings,
  CheckCircle, Eye, ChevronDown, ChevronRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { useProvisionDashboard } from '../../hooks/useProvisionDashboard'
import { ProvisionExportService } from '../../services/provisionExportService'
import { COMMISSION_STATUS_CONFIG, type CommissionStatus, type CommissionPost } from '../../types/provision'
import type { MonthlyProvisionSummary, TechnicianPayoutEntry } from '../../types/provision'
import ProvisionSettingsPanel from '../../components/admin/provisions/ProvisionSettingsPanel'
import toast from 'react-hot-toast'

const formatCurrency = (n: number) =>
  n.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr'

const formatCompact = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(0) + 'k' : n.toFixed(0)

const caseTypeBadge: Record<string, { label: string; cls: string }> = {
  private: { label: 'Privat', cls: 'bg-blue-500/20 text-blue-400' },
  business: { label: 'Företag', cls: 'bg-purple-500/20 text-purple-400' },
  contract: { label: 'Avtal', cls: 'bg-teal-500/20 text-teal-400' },
}

const statusFilterConfig: Array<{ key: CommissionStatus | 'all'; label: string; color: string }> = [
  { key: 'all', label: 'Alla', color: 'slate' },
  { key: 'pending_invoice', label: 'Väntar', color: 'yellow' },
  { key: 'ready_for_payout', label: 'Redo', color: 'emerald' },
  { key: 'approved', label: 'Godkänd', color: 'blue' },
  { key: 'paid_out', label: 'Utbetald', color: 'slate' },
]

const TechnicianCommissions: React.FC = () => {
  const { profile } = useAuth()
  const {
    selectedMonth,
    filters,
    searchQuery,
    kpis,
    allPosts,
    monthlyPayouts,
    summaries,
    settings,
    loading,
    selectedIds,
    actionLoading,
    monthOptions,
    canNavigatePrev,
    canNavigateNext,
    navigateMonth,
    goToMonth,
    setFilters,
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

  // Auto-expand current month on first render
  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  // Auto-expand current month if nothing is expanded
  useMemo(() => {
    if (monthlyPayouts.length > 0 && expandedMonths.size === 0) {
      const match = monthlyPayouts.find(m => m.month_key === currentMonthKey)
      if (match) {
        setExpandedMonths(new Set([match.month_key]))
      } else if (monthlyPayouts[0]) {
        setExpandedMonths(new Set([monthlyPayouts[0].month_key]))
      }
    }
  }, [monthlyPayouts])

  // Counts per status
  const statusCounts = allPosts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const totalCount = allPosts.length
  const totalSum = allPosts.reduce((s, p) => s + p.commission_amount, 0)
  const allSelected = allPosts.length > 0 && allPosts.every(p => selectedIds.has(p.id))

  const handleApprove = async () => {
    try {
      await approveSelected(profile?.email || 'admin')
      toast.success('Poster godkända')
    } catch { toast.error('Kunde inte godkänna') }
  }

  const handleMarkPaidOut = async () => {
    try {
      await markPaidOut()
      toast.success('Poster markerade som utbetalda')
    } catch { toast.error('Fel vid statusändring') }
  }

  const handleMarkReady = async () => {
    try {
      await markReadyForPayout()
      toast.success('Poster markerade som redo')
    } catch { toast.error('Fel vid statusändring') }
  }

  const handleExport = () => {
    if (summaries.length === 0) return toast.error('Inga poster att exportera')
    ProvisionExportService.exportPayrollCSV(summaries, selectedMonth.value)
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

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl sm:text-2xl font-bold text-white">Provisioner</h1>
        </div>
        {settings && profile?.role === 'admin' && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors min-h-[44px]"
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

      {/* ═══ STATISTIKRAD ═══ */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-slate-400">
            <span className="text-slate-300 font-medium">{formatCompact(kpis.pending_invoice_total)}</span> väntar
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-400">
            <span className="text-slate-300 font-medium">{formatCompact(kpis.ready_for_payout_total)}</span> redo
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-slate-400">
            <span className="text-slate-300 font-medium">{formatCompact(kpis.approved_total)}</span> godkänd
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-500" />
          <span className="text-slate-400">
            <span className="text-slate-300 font-medium">{formatCompact(kpis.paid_out_total)}</span> utbetald
          </span>
        </div>
      </div>

      {/* ═══ TABBAR ═══ */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('payouts')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'payouts'
              ? 'text-[#20c58f] border-[#20c58f]'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          Utbetalningar
          {monthlyPayouts.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-slate-700">
              {monthlyPayouts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'posts'
              ? 'text-[#20c58f] border-[#20c58f]'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          Alla poster
          {totalCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-slate-700">
              {totalCount}
            </span>
          )}
        </button>

        <div className="flex-1" />

        {/* Filterbar (gemensam) */}
        <div className="flex items-center gap-2 pb-2">
          {/* Sökfält */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44"
            />
          </div>

          {/* Månadsväljare */}
          <select
            value={selectedMonth.value}
            onChange={e => {
              const opt = monthOptions.find(m => m.value === e.target.value)
              if (opt) goToMonth(opt)
            }}
            className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
          >
            {monthOptions.map(m => (
              <option key={m.value} value={m.value}>{m.display}</option>
            ))}
          </select>

          <div className="w-px h-6 bg-slate-700" />

          {/* Statusflikar */}
          {statusFilterConfig.map(sf => {
            const active = (filters.status || 'all') === sf.key
            const count = sf.key === 'all' ? totalCount : (statusCounts[sf.key] || 0)
            const colorMap: Record<string, string> = {
              slate: active ? 'bg-slate-600 text-white border-slate-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500',
              yellow: active ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-yellow-500/50',
              emerald: active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-emerald-500/50',
              blue: active ? 'bg-blue-500/20 text-blue-400 border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-blue-500/50',
            }
            return (
              <button
                key={sf.key}
                onClick={() => setFilters({ ...filters, status: sf.key === 'all' ? undefined : sf.key as CommissionStatus })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${colorMap[sf.color]}`}
              >
                <span>{sf.label}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${active ? 'bg-white/20' : 'bg-slate-700'}`}>
                  {count}
                </span>
              </button>
            )
          })}

          <div className="w-px h-6 bg-slate-700" />

          <button
            onClick={() => refreshData()}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Löneunderlag
          </button>
        </div>
      </div>

      {/* ═══ APPROVAL BAR ═══ */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 mb-3 bg-slate-800 border border-slate-600 rounded-lg">
          <span className="text-sm text-slate-300">
            {selectedIds.size} markerad{selectedIds.size !== 1 ? 'e' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleMarkReady} disabled={actionLoading}
              className="px-2.5 py-1 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded text-emerald-300 transition-colors disabled:opacity-50">
              Markera redo
            </button>
            <button onClick={handleApprove} disabled={actionLoading}
              className="px-2.5 py-1 text-xs font-medium bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded text-blue-300 transition-colors disabled:opacity-50">
              Godkänn
            </button>
            <button onClick={handleMarkPaidOut} disabled={actionLoading}
              className="px-2.5 py-1 text-xs font-medium bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/40 rounded text-slate-300 transition-colors disabled:opacity-50">
              Utbetald
            </button>
            <button onClick={clearSelection}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors">
              Avmarkera
            </button>
          </div>
        </div>
      )}

      {/* ═══ UTBETALNINGAR-TABB ═══ */}
      {activeTab === 'payouts' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : monthlyPayouts.length === 0 ? (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col items-center justify-center py-12 text-slate-500">
              <Wallet className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Inga provisionsposter för denna period.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {monthlyPayouts.map(month => {
                const isExpanded = expandedMonths.has(month.month_key)
                const isCurrent = month.month_key === currentMonthKey

                return (
                  <div
                    key={month.month_key}
                    className={`bg-slate-800/50 rounded-lg border overflow-hidden ${
                      isCurrent ? 'border-emerald-500/40' : 'border-slate-700'
                    }`}
                  >
                    {/* Månads-header */}
                    <button
                      onClick={() => toggleMonth(month.month_key)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}

                      <span className="text-white font-medium text-sm">
                        {month.month_label}
                      </span>

                      {isCurrent && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                          Nu
                        </span>
                      )}

                      {/* Status badges */}
                      <div className="flex items-center gap-1.5">
                        {month.statuses.pending > 0 && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/10 text-yellow-400">
                            {month.statuses.pending} väntar
                          </span>
                        )}
                        {month.statuses.ready > 0 && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-400">
                            {month.statuses.ready} redo
                          </span>
                        )}
                        {month.statuses.approved > 0 && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/10 text-blue-400">
                            {month.statuses.approved} godkänd
                          </span>
                        )}
                        {month.statuses.paid > 0 && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-slate-500/10 text-slate-400">
                            {month.statuses.paid} utbetald
                          </span>
                        )}
                      </div>

                      <div className="flex-1" />

                      <span className="text-xs text-slate-400">
                        {month.total_technicians} tekniker · {month.total_posts} poster
                      </span>

                      <span className="text-white font-medium text-sm">
                        {formatCurrency(month.total_commission)}
                      </span>
                    </button>

                    {/* Expanderbar body */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-slate-700/50">
                            {month.technicians.map(tech => {
                              const techKey = `${month.month_key}::${tech.technician_id}`
                              const isTechExpanded = expandedTechs.has(techKey)

                              return (
                                <div key={techKey}>
                                  {/* Tekniker-header */}
                                  <button
                                    onClick={() => toggleTech(techKey)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/20 transition-colors border-b border-slate-700/30"
                                  >
                                    <div className="w-4" /> {/* Indent */}
                                    {isTechExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    )}

                                    <span className="text-white text-sm font-medium">
                                      {tech.technician_name}
                                    </span>

                                    <span className="text-xs text-slate-500">
                                      {tech.post_count} poster
                                    </span>

                                    {/* Mini-status */}
                                    <div className="flex items-center gap-1">
                                      {tech.statuses.pending > 0 && (
                                        <span className="px-1 py-0.5 text-[10px] rounded bg-yellow-500/10 text-yellow-400">
                                          ⏳ {tech.statuses.pending}
                                        </span>
                                      )}
                                      {tech.statuses.ready > 0 && (
                                        <span className="px-1 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400">
                                          ✓ {tech.statuses.ready}
                                        </span>
                                      )}
                                      {tech.statuses.approved > 0 && (
                                        <span className="px-1 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-400">
                                          ✓ {tech.statuses.approved}
                                        </span>
                                      )}
                                      {tech.statuses.paid > 0 && (
                                        <span className="px-1 py-0.5 text-[10px] rounded bg-slate-500/10 text-slate-400">
                                          ✓ {tech.statuses.paid}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex-1" />

                                    <span className="text-emerald-400 font-medium text-sm">
                                      {formatCurrency(tech.total_commission)}
                                    </span>
                                  </button>

                                  {/* Teknikers poster */}
                                  <AnimatePresence>
                                    {isTechExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="overflow-hidden bg-slate-900/30"
                                      >
                                        {tech.posts.map(post => (
                                          <PayoutPostRow
                                            key={post.id}
                                            post={post}
                                            selected={selectedIds.has(post.id)}
                                            onToggle={() => toggleSelect(post.id)}
                                          />
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}

              {/* Footer */}
              <div className="px-4 py-2 text-sm text-slate-400 flex justify-between">
                <span>
                  {monthlyPayouts.length} månad{monthlyPayouts.length !== 1 ? 'er' : ''} · {monthlyPayouts.reduce((s, m) => s + m.total_posts, 0)} poster totalt
                </span>
                <span className="text-white font-medium">
                  Totalt: {formatCurrency(monthlyPayouts.reduce((s, m) => s + m.total_commission, 0))}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ ALLA POSTER-TABB ═══ */}
      {activeTab === 'posts' && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
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
              <div className="max-h-[calc(100vh-320px)] overflow-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/80 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                        />
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-left">Nr</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-left">Tekniker</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-left">Ärende</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-left">Typ</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-left">Datum</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-right">Belopp</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-right">Provision</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-center">Status</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase text-right">Åtgärder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {allPosts.map(post => (
                      <PostRow
                        key={post.id}
                        post={post}
                        selected={selectedIds.has(post.id)}
                        onToggle={() => toggleSelect(post.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-3 py-2 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center text-sm">
                <span className="text-slate-400">
                  {totalCount} poster
                  {selectedIds.size > 0 && ` · ${selectedIds.size} markerade`}
                </span>
                <span className="text-white font-medium">
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

// ─── Kompakt postrad i utbetalnings-accordion ─────────────────────
function PayoutPostRow({ post, selected, onToggle }: {
  post: CommissionPost
  selected: boolean
  onToggle: () => void
}) {
  const typeBadge = caseTypeBadge[post.case_type] || caseTypeBadge.private
  const statusCfg = COMMISSION_STATUS_CONFIG[post.status]

  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/20 transition-colors border-b border-slate-800/50 ml-12">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f] flex-shrink-0"
      />

      <span className="font-mono text-xs text-slate-400 w-24 flex-shrink-0">
        {post.case_number || '—'}
      </span>

      <span className="text-sm text-white truncate max-w-[200px]">
        {post.case_title || '—'}
      </span>

      <span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 ${typeBadge.cls}`}>
        {typeBadge.label}
      </span>

      {post.is_rot_rut && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-[#20c58f]/20 text-[#20c58f] font-medium flex-shrink-0">
          ROT
        </span>
      )}

      <div className="flex-1" />

      <span className="text-xs text-slate-400 flex-shrink-0">
        {post.base_amount.toLocaleString('sv-SE')} kr
      </span>

      <span className="text-xs text-slate-500 flex-shrink-0">→</span>

      <span className="text-sm font-medium text-emerald-400 flex-shrink-0">
        {formatCurrency(post.commission_amount)}
      </span>

      {post.share_percentage < 100 && (
        <span className="text-xs text-slate-500 flex-shrink-0">
          ({post.share_percentage}%)
        </span>
      )}

      <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${statusCfg.bgClass} ${statusCfg.textClass}`}>
        {statusCfg.label}
      </span>
    </div>
  )
}

// ─── Tabell-rad (Alla poster-tabb) ────────────────────────────────
function PostRow({ post, selected, onToggle }: {
  post: CommissionPost
  selected: boolean
  onToggle: () => void
}) {
  const typeBadge = caseTypeBadge[post.case_type] || caseTypeBadge.private
  const statusCfg = COMMISSION_STATUS_CONFIG[post.status]

  return (
    <tr className="hover:bg-slate-700/30">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
        />
      </td>
      <td className="px-3 py-2 font-mono text-white text-xs">
        {post.case_number || '—'}
      </td>
      <td className="px-3 py-2">
        <div className="text-white text-sm">{post.technician_name}</div>
        {post.share_percentage < 100 && (
          <div className="text-xs text-slate-500">{post.share_percentage}% andel</div>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="text-white text-sm max-w-[200px] truncate">{post.case_title || '—'}</div>
      </td>
      <td className="px-3 py-2">
        <span className={`px-1.5 py-0.5 text-xs rounded ${typeBadge.cls}`}>
          {typeBadge.label}
        </span>
        {post.is_rot_rut && (
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-[#20c58f]/20 text-[#20c58f] font-medium">
            ROT
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-slate-400 text-xs">
        {new Date(post.created_at).toLocaleDateString('sv-SE')}
      </td>
      <td className="px-3 py-2 text-right text-sm text-slate-300">
        {post.base_amount.toLocaleString('sv-SE')} kr
      </td>
      <td className="px-3 py-2 text-right font-medium text-emerald-400 text-sm">
        {formatCurrency(post.commission_amount)}
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`px-2 py-0.5 text-xs rounded-full ${statusCfg.bgClass} ${statusCfg.textClass}`}>
          {statusCfg.label}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-0.5">
          <button className="p-1 text-slate-400 hover:bg-slate-700 rounded transition-colors" title="Visa detaljer">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default TechnicianCommissions
