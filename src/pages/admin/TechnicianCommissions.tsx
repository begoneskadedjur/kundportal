// src/pages/admin/TechnicianCommissions.tsx - Ny provisionshantering
import React from 'react'
import { Wallet, RefreshCw, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProvisionDashboard } from '../../hooks/useProvisionDashboard'
import { ProvisionExportService } from '../../services/provisionExportService'
import toast from 'react-hot-toast'

// Komponenter
import ProvisionKpiCards from '../../components/admin/provisions/ProvisionKpiCards'
import ProvisionPostsTable from '../../components/admin/provisions/ProvisionPostsTable'
import ProvisionApprovalBar from '../../components/admin/provisions/ProvisionApprovalBar'
import ProvisionSettingsPanel from '../../components/admin/provisions/ProvisionSettingsPanel'
import type { CommissionStatus } from '../../types/provision'

const TechnicianCommissions: React.FC = () => {
  const { profile } = useAuth()
  const {
    selectedMonth,
    filters,
    kpis,
    summaries,
    settings,
    loading,
    selectedIds,
    actionLoading,
    monthOptions,
    availableTechnicians,
    canNavigatePrev,
    canNavigateNext,
    navigateMonth,
    goToMonth,
    setFilters,
    toggleSelect,
    toggleAll,
    clearSelection,
    approveSelected,
    markPaidOut,
    markReadyForPayout,
    refreshData,
  } = useProvisionDashboard()

  const totalPosts = summaries.reduce((sum, s) => sum + s.post_count, 0)

  const handleApprove = async () => {
    try {
      await approveSelected(profile?.email || 'admin')
      toast.success('Poster godkända')
    } catch {
      toast.error('Kunde inte godkänna poster')
    }
  }

  const handleMarkPaidOut = async () => {
    try {
      await markPaidOut()
      toast.success('Poster markerade som utbetalda')
    } catch {
      toast.error('Kunde inte markera poster')
    }
  }

  const handleExport = () => {
    if (summaries.length === 0) {
      toast.error('Inga poster att exportera')
      return
    }

    // Filtrera på valda om några är markerade
    const exportSummaries = selectedIds.size > 0
      ? summaries.map(s => ({
          ...s,
          posts: s.posts.filter(p => selectedIds.has(p.id)),
          total_commission: s.posts
            .filter(p => selectedIds.has(p.id))
            .reduce((sum, p) => sum + p.commission_amount, 0),
          post_count: s.posts.filter(p => selectedIds.has(p.id)).length
        })).filter(s => s.post_count > 0)
      : summaries

    ProvisionExportService.exportPayrollCSV(exportSummaries, selectedMonth.value)
    toast.success('Löneunderlag exporterat')
  }

  const handleDetailedExport = () => {
    const allPosts = summaries.flatMap(s => s.posts)
    if (allPosts.length === 0) {
      toast.error('Inga poster att exportera')
      return
    }
    ProvisionExportService.exportDetailedCSV(allPosts, selectedMonth.value)
    toast.success('Detaljerad export klar')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            Provisionshantering
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {selectedMonth.display} · {totalPosts} poster
          </p>
        </div>
        <div className="flex items-center gap-2">
          {settings && profile?.role === 'admin' && (
            <ProvisionSettingsPanel
              settings={settings}
              onSettingsUpdated={refreshData}
              userEmail={profile?.email || ''}
            />
          )}
          <button
            onClick={handleDetailedExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => refreshData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>
      </div>

      {/* Månadsnavigering + filter */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Månadsväljare */}
        <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700 rounded-lg">
          <button
            onClick={() => navigateMonth('prev')}
            disabled={!canNavigatePrev}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={selectedMonth.value}
            onChange={e => {
              const opt = monthOptions.find(m => m.value === e.target.value)
              if (opt) goToMonth(opt)
            }}
            className="bg-transparent text-sm text-white font-medium border-none focus:ring-0 cursor-pointer px-2"
          >
            {monthOptions.map(m => (
              <option key={m.value} value={m.value} className="bg-slate-800">
                {m.display}
              </option>
            ))}
          </select>
          <button
            onClick={() => navigateMonth('next')}
            disabled={!canNavigateNext}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Teknikerfilter */}
        {availableTechnicians.length > 0 && (
          <select
            value={filters.technician_id || 'all'}
            onChange={e => setFilters({ ...filters, technician_id: e.target.value as string })}
            className="px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:ring-[#20c58f] focus:border-[#20c58f]"
          >
            <option value="all">Alla tekniker</option>
            {availableTechnicians.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {/* Statusfilter */}
        <select
          value={filters.status || 'all'}
          onChange={e => setFilters({ ...filters, status: e.target.value as CommissionStatus | 'all' })}
          className="px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:ring-[#20c58f] focus:border-[#20c58f]"
        >
          <option value="all">Alla statusar</option>
          <option value="pending_invoice">Väntar på betalning</option>
          <option value="ready_for_payout">Redo för utbetalning</option>
          <option value="approved">Godkänd</option>
          <option value="paid_out">Utbetald</option>
        </select>
      </div>

      {/* KPI-kort */}
      <ProvisionKpiCards kpis={kpis} loading={loading} />

      {/* Åtgärdsfält */}
      <ProvisionApprovalBar
        selectedCount={selectedIds.size}
        onApprove={handleApprove}
        onMarkPaidOut={handleMarkPaidOut}
        onExport={handleExport}
        onClearSelection={clearSelection}
        loading={actionLoading}
      />

      {/* Tabell */}
      <ProvisionPostsTable
        summaries={summaries}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleAll}
        loading={loading}
      />
    </div>
  )
}

export default TechnicianCommissions
