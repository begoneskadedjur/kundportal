// src/pages/admin/TechnicianCommissions.tsx - Provisionshantering (matchar faktureringsidans layout)
import React, { useState } from 'react'
import {
  Wallet, RefreshCw, Search, Download, Settings,
  CheckCircle, Eye, ChevronDown, ChevronUp
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProvisionDashboard } from '../../hooks/useProvisionDashboard'
import { ProvisionExportService } from '../../services/provisionExportService'
import { COMMISSION_STATUS_CONFIG, type CommissionStatus, type CommissionPost } from '../../types/provision'
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

      {/* ═══ FILTERBAR ═══ */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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

        {/* Divider */}
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Refresh */}
        <button
          onClick={() => refreshData()}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Löneunderlag
        </button>
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

      {/* ═══ TABELL ═══ */}
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
    </div>
  )
}

// ─── Tabell-rad ────────────────────────────────────────────────
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
