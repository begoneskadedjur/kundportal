// src/components/admin/leads/LeadFilterPanel.tsx - Advanced filtering component for leads

import React, { useState, useEffect, useRef } from 'react'
import {
  Filter,
  X,
  User,
  Calendar,
  Building,
  Target,
  RefreshCw,
  ChevronDown,
  TrendingUp
} from 'lucide-react'
import Button from '../../ui/Button'
import { LeadStatus, LeadPriority, LEAD_STATUS_DISPLAY } from '../../../types/database'
import { useAuth } from '../../../contexts/AuthContext'

export interface LeadFilters {
  search: string
  status: LeadStatus[]
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

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'red_lost', label: 'Förlorad' },
  { value: 'blue_cold', label: 'Kall' },
  { value: 'yellow_warm', label: 'Varm' },
  { value: 'orange_hot', label: 'Het' },
  { value: 'green_deal', label: 'Affär' },
]

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
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    if (filters.status.length > 0) count++
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
      action: () => handleQuickFilter('status', filters.status.includes('orange_hot') ? [] : ['orange_hot'], true),
      active: filters.status.includes('orange_hot')
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
                  ? 'bg-[#20c58f] hover:bg-[#1ba876] text-white border-[#20c58f]'
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
            <span className="bg-[#20c58f] text-white text-xs rounded-full px-2 py-1">
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
          <Filter className="w-5 h-5 text-[#20c58f]" />
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
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          />
        </div>

        {/* Status – multi-select */}
        <div ref={statusDropdownRef} className="relative">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Status
          </label>
          <button
            type="button"
            onClick={() => setStatusDropdownOpen(prev => !prev)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 flex items-center justify-between"
          >
            <span className="truncate text-sm">
              {localFilters.status.length === 0
                ? 'Alla statusar'
                : localFilters.status.map(s => LEAD_STATUS_DISPLAY[s].label).join(', ')}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-2 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {statusDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600/50 rounded-lg shadow-xl overflow-hidden">
              {STATUS_OPTIONS.map(opt => {
                const selected = localFilters.status.includes(opt.value)
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-700/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        const next = selected
                          ? localFilters.status.filter(s => s !== opt.value)
                          : [...localFilters.status, opt.value]
                        handleFilterChange('status', next)
                      }}
                      className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]/50"
                    />
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${LEAD_STATUS_DISPLAY[opt.value].dotClass}`} />
                    <span className="text-sm text-white">{opt.label}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Prioritet */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Prioritet
          </label>
          <select
            value={localFilters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          >
            <option value="all">Alla prioriteter</option>
            <option value="urgent">Brådskande</option>
            <option value="high">Hög</option>
            <option value="medium">Medel</option>
            <option value="low">Låg</option>
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
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
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
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
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
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
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
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          >
            <option value="all">Alla metoder</option>
            <option value="mail">Email</option>
            <option value="phone">Telefon</option>
            <option value="visit">Besök</option>
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
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          />
        </div>

        {/* Uppskattat värde - min */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Värde från (SEK)
          </label>
          <input
            type="number"
            value={localFilters.estimatedValueMin || ''}
            onChange={(e) => handleFilterChange('estimatedValueMin', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="0"
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
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
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
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
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
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
            className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]/50"
          />
          <Target className="w-4 h-4" />
          Uppföljning idag
        </label>
        
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={localFilters.hasEstimatedValue !== 'all' ? localFilters.hasEstimatedValue : false}
            onChange={(e) => handleFilterChange('hasEstimatedValue', e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]/50"
          />
          <TrendingUp className="w-4 h-4" />
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
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
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
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadFilterPanel