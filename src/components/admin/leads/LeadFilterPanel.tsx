// src/components/admin/leads/LeadFilterPanel.tsx - Advanced filtering component for leads

import React, { useState, useEffect } from 'react'
import { 
  Filter, 
  X, 
  User, 
  Calendar, 
  DollarSign, 
  Building, 
  Phone, 
  Mail, 
  MapPin, 
  Target,
  RefreshCw
} from 'lucide-react'
import Button from '../../ui/Button'
import { LeadStatus, LeadPriority } from '../../../types/database'
import { useAuth } from '../../../contexts/AuthContext'

export interface LeadFilters {
  search: string
  status: LeadStatus | 'all'
  priority: LeadPriority | 'all'
  assignedTo: string | 'all' | 'me' | 'unassigned'
  createdBy: string | 'all' | 'me'
  companySize: 'small' | 'medium' | 'large' | 'enterprise' | 'all'
  contactMethod: 'mail' | 'phone' | 'visit' | 'all'
  source: string | 'all'
  estimatedValueMin: number | null
  estimatedValueMax: number | null
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom'
  customStartDate: string
  customEndDate: string
  followUpToday: boolean
  hasEstimatedValue: boolean | 'all'
}

interface LeadFilterPanelProps {
  filters: LeadFilters
  onFiltersChange: (filters: LeadFilters) => void
  onReset: () => void
  isOpen: boolean
  onToggle: () => void
  resultCount: number
  showOnlyActive: boolean
  onShowOnlyActiveToggle: () => void
}

const LeadFilterPanel: React.FC<LeadFilterPanelProps> = ({
  filters,
  onFiltersChange,
  onReset,
  isOpen,
  onToggle,
  resultCount,
  showOnlyActive,
  onShowOnlyActiveToggle
}) => {
  const { user } = useAuth()
  const [localFilters, setLocalFilters] = useState<LeadFilters>(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const handleFilterChange = (key: keyof LeadFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.status !== 'all') count++
    if (filters.priority !== 'all') count++
    if (filters.assignedTo !== 'all') count++
    if (filters.createdBy !== 'all') count++
    if (filters.companySize !== 'all') count++
    if (filters.contactMethod !== 'all') count++
    if (filters.source !== 'all') count++
    if (filters.estimatedValueMin !== null) count++
    if (filters.estimatedValueMax !== null) count++
    if (filters.dateRange !== 'all') count++
    if (filters.followUpToday) count++
    if (filters.hasEstimatedValue !== 'all') count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  // Helper function for quick filter actions that may need to reset other filters
  const handleQuickFilter = (key: keyof LeadFilters, value: any, resetOtherFilters = false) => {
    if (resetOtherFilters) {
      // Reset conflicting filters when applying quick filter
      const resetFilters = { ...localFilters }
      if (key === 'assignedTo') {
        // Reset other assignment-related filters
        resetFilters.assignedTo = value
      } else if (key === 'status') {
        // Reset other status-related filters
        resetFilters.status = value
      } else if (key === 'followUpToday') {
        // Reset other follow-up related filters
        resetFilters.followUpToday = value
      }
      setLocalFilters(resetFilters)
      onFiltersChange(resetFilters)
    } else {
      handleFilterChange(key, value)
    }
  }

  // Quick filter buttons
  const quickFilters = [
    { 
      label: 'Mina leads', 
      action: () => handleQuickFilter('assignedTo', filters.assignedTo === 'me' ? 'all' : 'me', true), 
      active: filters.assignedTo === 'me' 
    },
    { 
      label: 'Heta leads', 
      action: () => handleQuickFilter('status', filters.status === 'orange_hot' ? 'all' : 'orange_hot', true), 
      active: filters.status === 'orange_hot' 
    },
    { 
      label: 'Uppföljning idag', 
      action: () => handleQuickFilter('followUpToday', !filters.followUpToday, true), 
      active: filters.followUpToday 
    },
    { 
      label: 'Ej tilldelade', 
      action: () => handleQuickFilter('assignedTo', filters.assignedTo === 'unassigned' ? 'all' : 'unassigned', true), 
      active: filters.assignedTo === 'unassigned' 
    },
    { 
      label: 'Aktiva leads', 
      action: onShowOnlyActiveToggle, 
      active: showOnlyActive 
    }
  ]

  if (!isOpen) {
    return (
      <div className="flex items-center gap-4 mb-6">
        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((filter) => (
            <Button
              key={filter.label}
              onClick={filter.action}
              variant={filter.active ? "default" : "outline"}
              size="sm"
              className={`text-xs transition-all duration-200 ${
                filter.active 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500' 
                  : 'border-slate-600 text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Filter Toggle Button */}
        <Button
          onClick={onToggle}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Avancerade filter
          {activeFilterCount > 0 && (
            <span className="bg-purple-500 text-white text-xs rounded-full px-2 py-1">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Filter className="w-5 h-5 text-purple-400" />
          Filter & Sök ({resultCount} resultat)
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={onReset}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Rensa alla
          </Button>
          <Button
            onClick={onToggle}
            variant="outline"
            size="sm"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Sökning */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Sök
          </label>
          <input
            type="text"
            value={localFilters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Företag, kontaktperson, email..."
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Status
          </label>
          <select
            value={localFilters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">Alla statusar</option>
            <option value="red_lost">🔴 Förlorad</option>
            <option value="blue_cold">🔵 Kall</option>
            <option value="yellow_warm">🟡 Varm</option>
            <option value="orange_hot">🟠 Het</option>
            <option value="green_deal">🟢 Affär</option>
          </select>
        </div>

        {/* Prioritet */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Prioritet
          </label>
          <select
            value={localFilters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">Alla prioriteter</option>
            <option value="urgent">🔥 Brådskande</option>
            <option value="high">⭐ Hög</option>
            <option value="medium">🕐 Medel</option>
            <option value="low">✅ Låg</option>
          </select>
        </div>

        {/* Tilldelad till */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            Tilldelad till
          </label>
          <select
            value={localFilters.assignedTo}
            onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">Alla användare</option>
            <option value="me">Mina leads</option>
            <option value="unassigned">Ej tilldelade</option>
          </select>
        </div>

        {/* Skapad av */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Skapad av
          </label>
          <select
            value={localFilters.createdBy}
            onChange={(e) => handleFilterChange('createdBy', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">Alla användare</option>
            <option value="me">Skapade av mig</option>
          </select>
        </div>

        {/* Företagsstorlek */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <Building className="w-4 h-4 inline mr-1" />
            Företagsstorlek
          </label>
          <select
            value={localFilters.companySize}
            onChange={(e) => handleFilterChange('companySize', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">Alla storlekar</option>
            <option value="small">Litet</option>
            <option value="medium">Medelstort</option>
            <option value="large">Stort</option>
            <option value="enterprise">Koncern</option>
          </select>
        </div>

        {/* Kontaktmetod */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Kontaktmetod
          </label>
          <select
            value={localFilters.contactMethod}
            onChange={(e) => handleFilterChange('contactMethod', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">Alla metoder</option>
            <option value="mail">📧 Email</option>
            <option value="phone">📞 Telefon</option>
            <option value="visit">🏢 Besök</option>
          </select>
        </div>

        {/* Källa */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Källa
          </label>
          <input
            type="text"
            value={localFilters.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
            placeholder="Webbplats, referral, etc."
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        {/* Uppskattat värde - min */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Värde från (SEK)
          </label>
          <input
            type="number"
            value={localFilters.estimatedValueMin || ''}
            onChange={(e) => handleFilterChange('estimatedValueMin', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="0"
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        {/* Uppskattat värde - max */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Värde till (SEK)
          </label>
          <input
            type="number"
            value={localFilters.estimatedValueMax || ''}
            onChange={(e) => handleFilterChange('estimatedValueMax', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="1000000"
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        {/* Datumintervall */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Skapad
          </label>
          <select
            value={localFilters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">Alla datum</option>
            <option value="today">Idag</option>
            <option value="week">Denna vecka</option>
            <option value="month">Denna månad</option>
            <option value="custom">Anpassat</option>
          </select>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-700/50">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={localFilters.followUpToday}
            onChange={(e) => handleFilterChange('followUpToday', e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500/50"
          />
          <Target className="w-4 h-4" />
          Uppföljning idag
        </label>
        
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={localFilters.hasEstimatedValue !== 'all' ? localFilters.hasEstimatedValue : false}
            onChange={(e) => handleFilterChange('hasEstimatedValue', e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500/50"
          />
          <DollarSign className="w-4 h-4" />
          Har uppskattat värde
        </label>
      </div>

      {/* Custom date range */}
      {localFilters.dateRange === 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/50">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Från datum
            </label>
            <input
              type="date"
              value={localFilters.customStartDate}
              onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Till datum
            </label>
            <input
              type="date"
              value={localFilters.customEndDate}
              onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadFilterPanel