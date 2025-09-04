// src/components/admin/leads/LeadsFilters.tsx - Lead filters section component

import React from 'react'
import { BarChart3 } from 'lucide-react'
import Button from '../../ui/Button'
import LeadFilterPanel, { LeadFilters } from './LeadFilterPanel'

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
  onNavigateToAnalytics
}) => {
  return (
    <div className="space-y-6">
      {/* Filter Panel */}
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

      {/* Action Buttons */}
      <div className="flex justify-between items-center mb-6">
        <Button
          onClick={onNavigateToAnalytics}
          variant="outline"
          className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-500"
        >
          <BarChart3 className="w-5 h-5 mr-2" />
          Analysera Leads
        </Button>
      </div>
    </div>
  )
}

export default LeadsFilters