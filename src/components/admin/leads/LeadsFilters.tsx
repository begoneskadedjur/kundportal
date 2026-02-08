// src/components/admin/leads/LeadsFilters.tsx - Compact toolbar with search, filters, column selector, and actions

import React from 'react'
import { BarChart3, Plus, Search } from 'lucide-react'
import Button from '../../ui/Button'
import LeadFilterPanel, { LeadFilters } from './LeadFilterPanel'
import LeadColumnSelector from './LeadColumnSelector'

interface LeadsFiltersProps {
  filters: LeadFilters
  onFiltersChange: (filters: LeadFilters) => void
  onReset: () => void
  isOpen: boolean
  onToggle: () => void
  resultCount: number
  showOnlyActive: boolean
  onShowOnlyActiveToggle: () => void
  onNavigateToAnalytics: () => void
  onCreateLead: () => void
  visibleColumns: Set<string>
  onToggleColumn: (columnId: string) => void
  onResetColumns: () => void
}

const LeadsFilters: React.FC<LeadsFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
  isOpen,
  onToggle,
  resultCount,
  showOnlyActive,
  onShowOnlyActiveToggle,
  onNavigateToAnalytics,
  onCreateLead,
  visibleColumns,
  onToggleColumn,
  onResetColumns
}) => {
  return (
    <div className="space-y-3">
      {/* Toolbar row: Search + buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Sök företag, kontakt, email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
          />
        </div>

        {/* Column selector */}
        <LeadColumnSelector
          visibleColumns={visibleColumns}
          onToggle={onToggleColumn}
          onReset={onResetColumns}
        />

        {/* Analytics button */}
        <Button
          onClick={onNavigateToAnalytics}
          variant="outline"
          size="sm"
          className="border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 flex-shrink-0"
        >
          <BarChart3 className="w-4 h-4 mr-1.5" />
          Analys
        </Button>

        {/* Create lead button */}
        <Button
          onClick={onCreateLead}
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nytt Lead
        </Button>
      </div>

      {/* Quick filters + advanced toggle */}
      <LeadFilterPanel
        filters={filters}
        onFiltersChange={onFiltersChange}
        onReset={onReset}
        isOpen={isOpen}
        onToggle={onToggle}
        resultCount={resultCount}
        showOnlyActive={showOnlyActive}
        onShowOnlyActiveToggle={onShowOnlyActiveToggle}
      />
    </div>
  )
}

export default LeadsFilters
