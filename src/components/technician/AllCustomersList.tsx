// src/components/technician/AllCustomersList.tsx
// Kundlista som visar kunder med utplacerade stationer
// Multisite-kunder grupperas under en org-rad med enheter

import { useState, useMemo } from 'react'
import { Search, SortAsc, Building2 } from 'lucide-react'
import Select from '../ui/Select'
import { ExpandableCustomerRow } from './ExpandableCustomerRow'
import { MultisiteOrgRow } from './MultisiteOrgRow'
import { CustomerStationSummary } from '../../services/equipmentService'
import { HealthStatus } from '../shared/StationHealthBadge'

export type SortOption = 'name' | 'health' | 'count' | 'recent'

interface AllCustomersListProps {
  customers: CustomerStationSummary[]
  loading?: boolean
  onOpenCustomerDetails: (customer: CustomerStationSummary) => void
  onSchedule?: (customers: CustomerStationSummary[]) => void
  onOpenSchedulePanel?: (customerId: string, customerName: string, sites?: { customerId: string; siteName: string }[]) => void
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

// Hämta org-namn genom att strippa " - sitename" från company_name
function getOrgName(sites: CustomerStationSummary[]): string {
  // Sök efter HK först
  const hk = sites.find(s => s.site_type === 'huvudkontor')
  if (hk) {
    // HK:s company_name brukar vara org-namnet (utan " - site")
    return hk.customer_name
  }
  // Fallback: ta första kundens namn och strippa allt efter " - "
  const first = sites[0]
  const dashIdx = first.customer_name.indexOf(' - ')
  return dashIdx > 0 ? first.customer_name.substring(0, dashIdx) : first.customer_name
}

// En "rad" i listan — antingen en vanlig kund eller en multisite-org
type ListItem =
  | { type: 'customer'; customer: CustomerStationSummary; sortKey: string; sortCount: number; sortHealth: number; sortRecent: number }
  | { type: 'org'; orgId: string; orgName: string; sites: CustomerStationSummary[]; sortKey: string; sortCount: number; sortHealth: number; sortRecent: number }

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
  onOpenCustomerDetails,
  onSchedule,
  onOpenSchedulePanel
}: AllCustomersListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Bygg grupperad och sorterad lista
  const listItems = useMemo(() => {
    // Steg 1: Gruppera multisite-kunder efter organization_id
    const orgMap = new Map<string, CustomerStationSummary[]>()
    const singleCustomers: CustomerStationSummary[] = []

    for (const c of customers) {
      if (c.is_multisite && c.organization_id) {
        const existing = orgMap.get(c.organization_id) || []
        existing.push(c)
        orgMap.set(c.organization_id, existing)
      } else {
        singleCustomers.push(c)
      }
    }

    // Steg 2: Bygg ListItems
    const items: ListItem[] = []

    // Multisite-orgs
    for (const [orgId, sites] of orgMap) {
      const orgName = getOrgName(sites)
      const totalCount = sites.reduce((sum, s) => sum + s.outdoor_count + s.indoor_count, 0)
      const worstHealth = sites.reduce<HealthStatus>((worst, s) =>
        HEALTH_PRIORITY[s.health_status] < HEALTH_PRIORITY[worst] ? s.health_status : worst
      , 'excellent')
      const latestDate = sites.reduce((latest, s) => {
        if (!s.latest_inspection_date) return latest
        const d = new Date(s.latest_inspection_date).getTime()
        return d > latest ? d : latest
      }, 0)

      items.push({
        type: 'org',
        orgId,
        orgName,
        sites,
        sortKey: orgName,
        sortCount: totalCount,
        sortHealth: HEALTH_PRIORITY[worstHealth],
        sortRecent: latestDate
      })
    }

    // Vanliga kunder
    for (const c of singleCustomers) {
      items.push({
        type: 'customer',
        customer: c,
        sortKey: c.customer_name,
        sortCount: c.outdoor_count + c.indoor_count,
        sortHealth: HEALTH_PRIORITY[c.health_status],
        sortRecent: c.latest_inspection_date ? new Date(c.latest_inspection_date).getTime() : 0
      })
    }

    // Steg 3: Filtrera på sökfråga
    let filtered = items
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = items.filter(item => {
        if (item.type === 'customer') {
          return item.customer.customer_name.toLowerCase().startsWith(query) ||
            item.customer.customer_address?.toLowerCase().includes(query)
        } else {
          // Sök i org-namn eller någon enhets namn/adress
          return item.orgName.toLowerCase().startsWith(query) ||
            item.sites.some(s =>
              s.customer_name.toLowerCase().includes(query) ||
              s.site_name?.toLowerCase().includes(query) ||
              s.customer_address?.toLowerCase().includes(query)
            )
        }
      })
    }

    // Steg 4: Sortera
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.sortKey.localeCompare(b.sortKey, 'sv')
        case 'health':
          return a.sortHealth - b.sortHealth
        case 'count':
          return b.sortCount - a.sortCount
        case 'recent':
          if (!a.sortRecent && !b.sortRecent) return 0
          if (!a.sortRecent) return 1
          if (!b.sortRecent) return -1
          return b.sortRecent - a.sortRecent
        default:
          return 0
      }
    })

    return filtered
  }, [customers, searchQuery, sortBy])

  // Statistik
  const stats = useMemo(() => {
    const totalOutdoor = customers.reduce((sum, c) => sum + c.outdoor_count, 0)
    const totalIndoor = customers.reduce((sum, c) => sum + c.indoor_count, 0)
    // Räkna unika kunder/orgs
    const orgIds = new Set(customers.filter(c => c.is_multisite && c.organization_id).map(c => c.organization_id))
    const singleCount = customers.filter(c => !c.is_multisite || !c.organization_id).length
    return {
      totalCustomers: orgIds.size + singleCount,
      totalOutdoor,
      totalIndoor,
      totalStations: totalOutdoor + totalIndoor
    }
  }, [customers])

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleSchedule = (targets: CustomerStationSummary[]) => {
    onSchedule?.(targets)
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 h-10 bg-slate-700/50 rounded-xl animate-pulse" />
            <div className="w-24 h-10 bg-slate-700/50 rounded-xl animate-pulse" />
          </div>
        </div>
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

          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as SortOption)}
            options={SORT_OPTIONS}
            className="w-48"
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-sm text-slate-400">
          <span>
            {searchQuery ? (
              <>{listItems.length} av {stats.totalCustomers} kunder</>
            ) : (
              <>{stats.totalCustomers} kunder med stationer</>
            )}
          </span>
          <span>
            Totalt {stats.totalStations} stationer
          </span>
        </div>
      </div>

      {/* Kundlista */}
      {listItems.length > 0 ? (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
          {listItems.map(item => {
            if (item.type === 'org') {
              return (
                <MultisiteOrgRow
                  key={`org-${item.orgId}`}
                  orgName={item.orgName}
                  sites={item.sites}
                  isExpanded={expandedId === `org-${item.orgId}`}
                  onToggleExpand={() => toggleExpanded(`org-${item.orgId}`)}
                  onOpenSiteDetails={onOpenCustomerDetails}
                  onScheduleSelected={handleSchedule}
                  onOpenSchedulePanel={onOpenSchedulePanel}
                />
              )
            } else {
              return (
                <ExpandableCustomerRow
                  key={item.customer.customer_id}
                  customer={item.customer}
                  isExpanded={expandedId === item.customer.customer_id}
                  onToggleExpand={() => toggleExpanded(item.customer.customer_id)}
                  onOpenFullDetails={onOpenCustomerDetails}
                  onSchedule={onSchedule ? () => handleSchedule([item.customer]) : undefined}
                  onOpenSchedulePanel={onOpenSchedulePanel ? (cId, cName) => onOpenSchedulePanel(cId, cName) : undefined}
                />
              )
            }
          })}
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
