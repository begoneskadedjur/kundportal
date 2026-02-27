// src/components/technician/MultisiteOrgRow.tsx
// Expanderbar org-rad för multisite-kunder med enheter och checkboxar

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Building2,
  MapPin,
  Home,
  ChevronRight,
  CalendarClock,
  CheckSquare,
  Square,
  Loader2,
  ClipboardList
} from 'lucide-react'
import { StationHealthBadge, HealthStatus } from '../shared/StationHealthBadge'
import { CustomerStationSummary } from '../../services/equipmentService'

interface MultisiteOrgRowProps {
  orgName: string
  sites: CustomerStationSummary[]
  isExpanded: boolean
  onToggleExpand: () => void
  onOpenSiteDetails: (site: CustomerStationSummary) => void
  onScheduleSelected: (sites: CustomerStationSummary[]) => void
  onOpenSchedulePanel?: (customerId: string, customerName: string, sites?: { customerId: string; siteName: string }[]) => void
}

// Hälsostatus prioritet (sämst = lägst nummer)
const HEALTH_PRIORITY: Record<HealthStatus, number> = {
  poor: 0,
  fair: 1,
  good: 2,
  excellent: 3
}

export function MultisiteOrgRow({
  orgName,
  sites,
  isExpanded,
  onToggleExpand,
  onOpenSiteDetails,
  onScheduleSelected,
  onOpenSchedulePanel
}: MultisiteOrgRowProps) {
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set())

  // Aggregerade värden
  const totalOutdoor = sites.reduce((sum, s) => sum + s.outdoor_count, 0)
  const totalIndoor = sites.reduce((sum, s) => sum + s.indoor_count, 0)
  const totalStations = totalOutdoor + totalIndoor
  const worstHealth = sites.reduce<HealthStatus>((worst, s) => {
    return HEALTH_PRIORITY[s.health_status] < HEALTH_PRIORITY[worst] ? s.health_status : worst
  }, 'excellent')

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds(prev => {
      const next = new Set(prev)
      if (next.has(siteId)) {
        next.delete(siteId)
      } else {
        next.add(siteId)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedSiteIds.size === sites.length) {
      setSelectedSiteIds(new Set())
    } else {
      setSelectedSiteIds(new Set(sites.map(s => s.customer_id)))
    }
  }

  const handleScheduleSelected = () => {
    const selected = sites.filter(s => selectedSiteIds.has(s.customer_id))
    if (selected.length > 0) {
      onScheduleSelected(selected)
    }
  }

  const handleScheduleAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onScheduleSelected(sites)
  }

  return (
    <div className="border-b border-slate-700/30 last:border-b-0">
      {/* Org-huvudrad */}
      <div
        className={`
          p-4 transition-all duration-200 cursor-pointer
          hover:bg-slate-800/30
          ${isExpanded ? 'bg-slate-800/20' : ''}
        `}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          {/* Expand/collapse */}
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </motion.div>

          {/* Org-ikon (lila för att skilja från vanliga kunder) */}
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-500/10">
            <Building2 className="w-5 h-5 text-purple-400" />
          </div>

          {/* Org-info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white truncate">{orgName}</h3>
              <span className="text-xs px-1.5 py-0.5 bg-purple-500/15 text-purple-400 rounded border border-purple-500/20">
                {sites.length} enheter
              </span>
            </div>
          </div>

          {/* Statistik + schema-ikon */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {totalStations > 0 && (
              <div className="flex items-center gap-3 text-sm">
                {totalOutdoor > 0 && (
                  <span className="flex items-center gap-1 text-blue-400">
                    <MapPin className="w-3.5 h-3.5" />
                    {totalOutdoor}
                  </span>
                )}
                {totalIndoor > 0 && (
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Home className="w-3.5 h-3.5" />
                    {totalIndoor}
                  </span>
                )}
              </div>
            )}

            {totalStations > 0 && (
              <StationHealthBadge status={worstHealth} size="sm" />
            )}

            {/* Schema-info panel */}
            {onOpenSchedulePanel && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const siteTargets = sites.map(s => ({
                    customerId: s.customer_id,
                    siteName: s.site_name || s.customer_name.split(' - ').pop() || s.customer_name
                  }))
                  onOpenSchedulePanel(sites[0].customer_id, orgName, siteTargets)
                }}
                className="p-1.5 text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 rounded-lg transition-colors"
                title="Visa schema och kontroller"
              >
                <ClipboardList className="w-4 h-4" />
              </button>
            )}

            {/* Kalender-ikon för att schemalägga alla */}
            <button
              onClick={handleScheduleAll}
              className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
              title="Schemalägg alla enheter"
            >
              <CalendarClock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanderat: enheter med checkboxar */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 ml-7 border-l-2 border-purple-500/30">
              {/* Välj alla / Schemalägg markerade */}
              <div className="flex items-center justify-between py-2 mb-2 border-b border-slate-700/30">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {selectedSiteIds.size === sites.length ? (
                    <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  {selectedSiteIds.size === sites.length ? 'Avmarkera alla' : 'Markera alla'}
                </button>

                {selectedSiteIds.size > 0 && (
                  <button
                    onClick={handleScheduleSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 rounded-lg transition-colors border border-purple-500/20"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Schemalägg {selectedSiteIds.size} {selectedSiteIds.size === 1 ? 'enhet' : 'enheter'}
                  </button>
                )}
              </div>

              {/* Enhetslista */}
              <div className="space-y-1">
                {sites.map(site => {
                  const isChecked = selectedSiteIds.has(site.customer_id)
                  const siteName = site.site_name || site.customer_name.split(' - ').pop() || site.customer_name
                  const siteStations = site.outdoor_count + site.indoor_count

                  return (
                    <div
                      key={site.customer_id}
                      className={`
                        flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer
                        ${isChecked ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-slate-800/30 border border-transparent hover:bg-slate-800/50'}
                      `}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSite(site.customer_id)
                        }}
                        className="flex-shrink-0"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </button>

                      {/* Enhet-ikon */}
                      <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-slate-700/50">
                        <MapPin className="w-4 h-4 text-slate-400" />
                      </div>

                      {/* Enhet-info */}
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => onOpenSiteDetails(site)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {siteName}
                          </span>
                          {site.site_type === 'huvudkontor' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded">
                              HK
                            </span>
                          )}
                        </div>
                        {site.customer_address && (
                          <p className="text-xs text-slate-500 truncate">{site.customer_address}</p>
                        )}
                      </div>

                      {/* Stationsantal + hälsa */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {siteStations > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            {site.outdoor_count > 0 && (
                              <span className="flex items-center gap-0.5 text-blue-400">
                                <MapPin className="w-3 h-3" />
                                {site.outdoor_count}
                              </span>
                            )}
                            {site.indoor_count > 0 && (
                              <span className="flex items-center gap-0.5 text-cyan-400">
                                <Home className="w-3 h-3" />
                                {site.indoor_count}
                              </span>
                            )}
                          </div>
                        )}
                        {siteStations > 0 && (
                          <StationHealthBadge status={site.health_status} size="sm" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MultisiteOrgRow
