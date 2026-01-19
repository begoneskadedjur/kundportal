// src/components/technician/CustomerStationsList.tsx
// Kundlista med stationsöversikt, sök och sortering

import { useState, useMemo } from 'react'
import { Search, SortAsc, Building2, MapPin, Home } from 'lucide-react'
import { CustomerStationCard, CustomerStationCardSkeleton, CustomerStationSummary } from './CustomerStationCard'
import { HealthStatus } from '../shared/StationHealthBadge'

export type SortOption = 'name' | 'health' | 'count' | 'recent'

interface CustomerStationsListProps {
  customers: CustomerStationSummary[]
  loading?: boolean
  selectedCustomerId?: string | null
  onCustomerClick: (customer: CustomerStationSummary) => void
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'A-Ö' },
  { value: 'health', label: 'Hälsa' },
  { value: 'count', label: 'Antal' },
  { value: 'recent', label: 'Senast' }
]

// Hälsostatus prioritet för sortering (sämst först)
const HEALTH_PRIORITY: Record<HealthStatus, number> = {
  poor: 0,
  fair: 1,
  good: 2,
  excellent: 3
}

export function CustomerStationsList({
  customers,
  loading = false,
  selectedCustomerId,
  onCustomerClick
}: CustomerStationsListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name')

  // Filtrera och sortera kunder
  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...customers]

    // Filtrera på sökfråga
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.customer_name.toLowerCase().includes(query) ||
        c.customer_address?.toLowerCase().includes(query)
      )
    }

    // Sortera
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.customer_name.localeCompare(b.customer_name, 'sv')
        case 'health':
          return HEALTH_PRIORITY[a.health_status] - HEALTH_PRIORITY[b.health_status]
        case 'count':
          return (b.outdoor_count + b.indoor_count) - (a.outdoor_count + a.indoor_count)
        case 'recent':
          if (!a.latest_inspection_date && !b.latest_inspection_date) return 0
          if (!a.latest_inspection_date) return 1
          if (!b.latest_inspection_date) return -1
          return new Date(b.latest_inspection_date).getTime() - new Date(a.latest_inspection_date).getTime()
        default:
          return 0
      }
    })

    return result
  }, [customers, searchQuery, sortBy])

  // Statistik
  const stats = useMemo(() => {
    const totalOutdoor = customers.reduce((sum, c) => sum + c.outdoor_count, 0)
    const totalIndoor = customers.reduce((sum, c) => sum + c.indoor_count, 0)
    return {
      customerCount: customers.length,
      totalOutdoor,
      totalIndoor,
      total: totalOutdoor + totalIndoor
    }
  }, [customers])

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Sök och sortering skeleton */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 h-10 bg-slate-800/50 rounded-xl animate-pulse" />
          <div className="w-32 h-10 bg-slate-800/50 rounded-xl animate-pulse" />
        </div>

        {/* Kundkort skeletons */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <CustomerStationCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sök och sortering */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Sökfält */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök kund..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              ×
            </button>
          )}
        </div>

        {/* Sorteringsval */}
        <div className="relative">
          <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="appearance-none pl-10 pr-8 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Resultaträknare */}
      {searchQuery && (
        <div className="text-sm text-slate-400">
          {filteredAndSortedCustomers.length} av {customers.length} kunder
        </div>
      )}

      {/* Kundlista */}
      {filteredAndSortedCustomers.length > 0 ? (
        <div className="space-y-3">
          {filteredAndSortedCustomers.map(customer => (
            <CustomerStationCard
              key={customer.customer_id}
              customer={customer}
              onClick={() => onCustomerClick(customer)}
              isSelected={customer.customer_id === selectedCustomerId}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-500" />
          </div>
          {searchQuery ? (
            <>
              <h3 className="text-lg font-medium text-white mb-2">Inga resultat</h3>
              <p className="text-slate-400 text-sm max-w-xs">
                Inga kunder matchade sökningen "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm"
              >
                Rensa sökning
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-white mb-2">Inga stationer än</h3>
              <p className="text-slate-400 text-sm max-w-xs">
                Du har inte placerat några stationer hos någon kund ännu. Klicka på "+" för att börja.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Kompakt statistikrad
export function CustomerStationsStats({
  stats,
  className = ''
}: {
  stats: { customerCount: number; totalOutdoor: number; totalIndoor: number; total: number }
  className?: string
}) {
  return (
    <div className={`flex items-center gap-4 text-sm ${className}`}>
      <div className="flex items-center gap-1.5 text-slate-400">
        <Building2 className="w-4 h-4" />
        <span className="text-white font-medium">{stats.customerCount}</span>
        <span>kunder</span>
      </div>
      <div className="w-px h-4 bg-slate-700" />
      <div className="flex items-center gap-1.5 text-slate-400">
        <MapPin className="w-4 h-4" />
        <span className="text-white font-medium">{stats.totalOutdoor}</span>
        <span>ute</span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-400">
        <Home className="w-4 h-4" />
        <span className="text-white font-medium">{stats.totalIndoor}</span>
        <span>inne</span>
      </div>
    </div>
  )
}

export default CustomerStationsList
