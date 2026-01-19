// src/components/technician/AllCustomersList.tsx
// Kundlista som visar ALLA avtalskunder med expanderbara rader

import { useState, useMemo } from 'react'
import { Search, SortAsc, Building2, Filter } from 'lucide-react'
import { ExpandableCustomerRow, CustomerStationSummary } from './ExpandableCustomerRow'
import { HealthStatus } from '../shared/StationHealthBadge'

export type SortOption = 'name' | 'health' | 'count' | 'recent'
export type FilterOption = 'all' | 'with_stations' | 'without_stations'

interface AllCustomersListProps {
  customers: CustomerStationSummary[]
  loading?: boolean
  onOpenCustomerDetails: (customer: CustomerStationSummary) => void
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'A-O' },
  { value: 'count', label: 'Antal' },
  { value: 'health', label: 'Halsa' },
  { value: 'recent', label: 'Senast' }
]

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'Alla kunder' },
  { value: 'with_stations', label: 'Med stationer' },
  { value: 'without_stations', label: 'Utan stationer' }
]

// Halsostatus prioritet for sortering (samst forst)
const HEALTH_PRIORITY: Record<HealthStatus, number> = {
  poor: 0,
  fair: 1,
  good: 2,
  excellent: 3
}

// Skeleton loader
function CustomerRowSkeleton() {
  return (
    <div className="p-4 border-b border-slate-700/30 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 bg-slate-700/50 rounded" />
        <div className="w-10 h-10 bg-slate-700/50 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-48 bg-slate-700/50 rounded" />
          <div className="h-4 w-32 bg-slate-700/30 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-5 w-12 bg-slate-700/30 rounded" />
          <div className="h-6 w-16 bg-slate-700/30 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function AllCustomersList({
  customers,
  loading = false,
  onOpenCustomerDetails
}: AllCustomersListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null)

  // Filtrera och sortera kunder
  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...customers]

    // Filtrera pa sokfraga
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.customer_name.toLowerCase().startsWith(query) ||
        c.customer_address?.toLowerCase().includes(query)
      )
    }

    // Filtrera pa stationsstatus
    if (filterBy === 'with_stations') {
      result = result.filter(c => c.outdoor_count + c.indoor_count > 0)
    } else if (filterBy === 'without_stations') {
      result = result.filter(c => c.outdoor_count + c.indoor_count === 0)
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
  }, [customers, searchQuery, sortBy, filterBy])

  // Statistik
  const stats = useMemo(() => {
    const withStations = customers.filter(c => c.outdoor_count + c.indoor_count > 0)
    const totalOutdoor = customers.reduce((sum, c) => sum + c.outdoor_count, 0)
    const totalIndoor = customers.reduce((sum, c) => sum + c.indoor_count, 0)
    return {
      totalCustomers: customers.length,
      customersWithStations: withStations.length,
      customersWithoutStations: customers.length - withStations.length,
      totalOutdoor,
      totalIndoor,
      totalStations: totalOutdoor + totalIndoor
    }
  }, [customers])

  const toggleExpanded = (customerId: string) => {
    setExpandedCustomerId(expandedCustomerId === customerId ? null : customerId)
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Sok och sortering skeleton */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 h-10 bg-slate-700/50 rounded-xl animate-pulse" />
            <div className="flex gap-2">
              <div className="w-28 h-10 bg-slate-700/50 rounded-xl animate-pulse" />
              <div className="w-24 h-10 bg-slate-700/50 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>

        {/* Kundrad skeletons */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <CustomerRowSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Sok och sortering */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Sokfalt */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sok kund (borjar pa...)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-lg"
              >
                x
              </button>
            )}
          </div>

          {/* Filter och sortering */}
          <div className="flex gap-2">
            {/* Filterval */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="appearance-none pl-10 pr-8 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              >
                {FILTER_OPTIONS.map(option => (
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

            {/* Sorteringsval */}
            <div className="relative">
              <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none pl-10 pr-8 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
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
        </div>

        {/* Resultatraknare */}
        <div className="flex items-center justify-between mt-3 text-sm text-slate-400">
          <span>
            {searchQuery || filterBy !== 'all' ? (
              <>
                {filteredAndSortedCustomers.length} av {customers.length} kunder
              </>
            ) : (
              <>
                {stats.totalCustomers} kunder totalt
              </>
            )}
          </span>
          <span>
            {stats.customersWithStations} med stationer ({stats.totalStations} st)
          </span>
        </div>
      </div>

      {/* Kundlista */}
      {filteredAndSortedCustomers.length > 0 ? (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
          {filteredAndSortedCustomers.map(customer => (
            <ExpandableCustomerRow
              key={customer.customer_id}
              customer={customer}
              isExpanded={expandedCustomerId === customer.customer_id}
              onToggleExpand={() => toggleExpanded(customer.customer_id)}
              onOpenFullDetails={onOpenCustomerDetails}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-500" />
          </div>
          {searchQuery || filterBy !== 'all' ? (
            <>
              <h3 className="text-lg font-medium text-white mb-2">Inga resultat</h3>
              <p className="text-slate-400 text-sm max-w-xs">
                Inga kunder matchade din sokning eller filtrering
              </p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterBy('all')
                }}
                className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm"
              >
                Rensa filter
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-white mb-2">Inga kunder</h3>
              <p className="text-slate-400 text-sm max-w-xs">
                Det finns inga aktiva kunder i systemet.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default AllCustomersList
