// src/components/admin/TicketFilters.tsx
// Filter-komponent för tickets

import { useState, useEffect } from 'react';
import { Search, X, Filter, Calendar } from 'lucide-react';
import type { TicketFilter, CommentStatus } from '../../services/communicationService';

interface TicketFiltersProps {
  filter: TicketFilter;
  onFilterChange: (filter: TicketFilter) => void;
  disabled?: boolean;
}

const STATUS_OPTIONS: { value: CommentStatus; label: string; color: string }[] = [
  { value: 'open', label: 'Öppen', color: 'bg-blue-500' },
  { value: 'resolved', label: 'Löst', color: 'bg-green-500' },
];

export function TicketFilters({ filter, onFilterChange, disabled }: TicketFiltersProps) {
  const [searchInput, setSearchInput] = useState(filter.searchQuery || '');
  const [showDateFilters, setShowDateFilters] = useState(false);

  // Debounce sökning
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filter.searchQuery) {
        onFilterChange({ ...filter, searchQuery: searchInput || undefined });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleStatus = (status: CommentStatus) => {
    const currentStatuses = filter.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];

    onFilterChange({
      ...filter,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };

  const clearFilters = () => {
    setSearchInput('');
    onFilterChange({});
  };

  const hasActiveFilters =
    (filter.status && filter.status.length > 0) ||
    filter.searchQuery ||
    filter.dateFrom ||
    filter.dateTo;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 space-y-4">
      {/* Sökfält */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Sök fakturanr, nyckelord, företag..."
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg
                   text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                   disabled:opacity-50"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status-filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400 mr-1">Status:</span>
        {STATUS_OPTIONS.map((option) => {
          const isActive = filter.status?.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => toggleStatus(option.value)}
              disabled={disabled}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${isActive
                  ? `${option.color} text-white shadow-lg`
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Datum-filter (expanderbar) */}
      <div>
        <button
          onClick={() => setShowDateFilters(!showDateFilters)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <Calendar className="w-4 h-4" />
          <span>Datumfilter</span>
          <span className={`transition-transform ${showDateFilters ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {showDateFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Från:</label>
              <input
                type="date"
                value={filter.dateFrom || ''}
                onChange={(e) => onFilterChange({ ...filter, dateFrom: e.target.value || undefined })}
                disabled={disabled}
                className="px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg
                         text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50
                         disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Till:</label>
              <input
                type="date"
                value={filter.dateTo || ''}
                onChange={(e) => onFilterChange({ ...filter, dateTo: e.target.value || undefined })}
                disabled={disabled}
                className="px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg
                         text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50
                         disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Rensa filter-knapp */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button
            onClick={clearFilters}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white
                     bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            Rensa filter
          </button>
        </div>
      )}
    </div>
  );
}
