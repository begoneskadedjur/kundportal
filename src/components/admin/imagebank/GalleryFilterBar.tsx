import { Search, Filter, X, Calendar } from 'lucide-react'
import Select from '../../ui/Select'
import { useState } from 'react'
import type { CaseImageTag } from '../../../types/database'
import { CASE_IMAGE_TAG_DISPLAY } from '../../../types/database'
import DatePicker, { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'

registerLocale('sv', sv)

export interface GalleryFilters {
  pestType: string
  technician: string
  status: string
  tag: CaseImageTag | 'all'
  dateFrom: Date | null
  dateTo: Date | null
}

interface FilterOptions {
  pestTypes: string[]
  technicians: string[]
  statuses: string[]
}

interface GalleryFilterBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filters: GalleryFilters
  onFilterChange: <K extends keyof GalleryFilters>(key: K, value: GalleryFilters[K]) => void
  filterOptions: FilterOptions
  activeFilterCount: number
  onClearAll: () => void
}

export default function GalleryFilterBar({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  filterOptions,
  activeFilterCount,
  onClearAll,
}: GalleryFilterBarProps) {
  const [showExtraFilters, setShowExtraFilters] = useState(false)

  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="space-y-3">
      {/* Main filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Sök ärende, adress, tekniker..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700
                       rounded-xl text-sm text-white placeholder-slate-500
                       focus:ring-2 focus:ring-[#20c58f]/40 focus:border-[#20c58f]/40
                       transition-all duration-200"
          />
        </div>

        {/* Pest type */}
        <Select
          value={filters.pestType}
          onChange={(v) => onFilterChange('pestType', v)}
          options={[
            { value: 'all', label: 'Alla skadedjur' },
            ...filterOptions.pestTypes.map(t => ({ value: t, label: t })),
          ]}
          className="min-w-[140px]"
        />

        {/* Technician */}
        <Select
          value={filters.technician}
          onChange={(v) => onFilterChange('technician', v)}
          options={[
            { value: 'all', label: 'Alla tekniker' },
            ...filterOptions.technicians.map(t => ({ value: t, label: t })),
          ]}
          className="min-w-[140px]"
        />

        {/* Extra filters toggle */}
        <button
          onClick={() => setShowExtraFilters(!showExtraFilters)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-900/50
                     border border-slate-700 rounded-xl text-sm text-slate-400
                     hover:text-white hover:border-slate-600 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Fler filter
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#20c58f] text-white text-xs
                             flex items-center justify-center font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Extra filters row */}
      {showExtraFilters && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status */}
          <Select
            value={filters.status}
            onChange={(v) => onFilterChange('status', v)}
            options={[
              { value: 'all', label: 'Alla status' },
              ...filterOptions.statuses.map(s => ({ value: s, label: s })),
            ]}
            className="min-w-[130px]"
          />

          {/* Tag */}
          <Select
            value={filters.tag}
            onChange={(v) => onFilterChange('tag', v as CaseImageTag | 'all')}
            options={[
              { value: 'all', label: 'Alla taggar' },
              ...(Object.keys(CASE_IMAGE_TAG_DISPLAY) as CaseImageTag[]).map(tag => ({
                value: tag,
                label: CASE_IMAGE_TAG_DISPLAY[tag].label,
              })),
            ]}
            className="min-w-[130px]"
          />

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <DatePicker
              selected={filters.dateFrom}
              onChange={(date) => onFilterChange('dateFrom', date)}
              placeholderText="Från"
              dateFormat="yyyy-MM-dd"
              locale="sv"
              isClearable
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-white w-[120px] focus:ring-2 focus:ring-[#20c58f]/40"
            />
            <span className="text-slate-500">–</span>
            <DatePicker
              selected={filters.dateTo}
              onChange={(date) => onFilterChange('dateTo', date)}
              placeholderText="Till"
              dateFormat="yyyy-MM-dd"
              locale="sv"
              isClearable
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-white w-[120px] focus:ring-2 focus:ring-[#20c58f]/40"
            />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Aktiva filter:</span>
          {searchQuery && (
            <FilterChip label={`Sök: ${searchQuery}`} onRemove={() => onSearchChange('')} />
          )}
          {filters.pestType !== 'all' && (
            <FilterChip label={filters.pestType} onRemove={() => onFilterChange('pestType', 'all')} />
          )}
          {filters.technician !== 'all' && (
            <FilterChip label={filters.technician} onRemove={() => onFilterChange('technician', 'all')} />
          )}
          {filters.status !== 'all' && (
            <FilterChip label={filters.status} onRemove={() => onFilterChange('status', 'all')} />
          )}
          {filters.tag !== 'all' && (
            <FilterChip
              label={`Tagg: ${CASE_IMAGE_TAG_DISPLAY[filters.tag]?.label || filters.tag}`}
              onRemove={() => onFilterChange('tag', 'all')}
            />
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <FilterChip
              label={`Datum: ${filters.dateFrom?.toLocaleDateString('sv-SE') || '...'} – ${filters.dateTo?.toLocaleDateString('sv-SE') || '...'}`}
              onRemove={() => { onFilterChange('dateFrom', null); onFilterChange('dateTo', null) }}
            />
          )}
          <button
            onClick={onClearAll}
            className="text-xs text-slate-400 hover:text-white transition-colors ml-1"
          >
            Rensa alla
          </button>
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1
                     bg-[#20c58f]/15 text-[#20c58f] border border-[#20c58f]/20
                     rounded-lg text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
