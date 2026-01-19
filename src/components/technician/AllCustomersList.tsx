// src/components/technician/AllCustomersList.tsx
// Kundlista som visar kunder med utplacerade stationer

import { useState, useMemo } from 'react'
import { Search, SortAsc, Building2 } from 'lucide-react'
import { ExpandableCustomerRow } from './ExpandableCustomerRow'
import { CustomerStationSummary } from '../../services/equipmentService'
import { HealthStatus } from '../shared/StationHealthBadge'

export type SortOption = 'name' | 'health' | 'count' | 'recent'

interface AllCustomersListProps {
  customers: CustomerStationSummary[]
  loading?: boolean
  onOpenCustomerDetails: (customer: CustomerStationSummary) => void
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'A-Ö' },
  { value: 'count', label: 'Antal' },
  { value: 'health', label: 'Hälsa' },
  { value: 'recent', label: 'Senast' }
]

// Hälsostatus prioritet för sortering (sämst först)
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
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null)

  // Filtrera och sortera kunder
  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...customers]

    // Filtrera på sökfråga
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.customer_name.toLowerCase().startsWith(query) ||
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
      totalCustomers: customers.length,
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
        {/* Sök och sortering skeleton */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 h-10 bg-slate-700/50 rounded-xl animate-pulse" />
            <div className="w-24 h-10 bg-slate-700/50 rounded-xl animate-pulse" />
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
      {/* Sök och sortering */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Sökfält */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök kund (börjar på...)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-lg"
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

        {/* Resultaträknare */}
        <div className="flex items-center justify-between mt-3 text-sm text-slate-400">
          <span>
            {searchQuery ? (
              <>
                {filteredAndSortedCustomers.length} av {customers.length} kunder
              </>
            ) : (
              <>
                {stats.totalCustomers} kunder med stationer
              </>
            )}
          </span>
          <span>
            Totalt {stats.totalStations} stationer
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
          {searchQuery ? (
            <>
              <h3 className="text-lg font-medium text-white mb-2">Inga resultat</h3>
              <p className="text-slate-400 text-sm max-w-xs">
                Inga kunder matchade din sökning
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
              <h3 className="text-lg font-medium text-white mb-2">Inga stationer ännu</h3>
              <p className="text-slate-400 text-sm max-w-xs">
                Du har inte placerat några stationer hos någon kund ännu.
                Klicka på + för att börja.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default AllCustomersList
