// src/components/technician/CustomerStationCard.tsx
// Kundkort som visar aggregerad stationsinfo med hälsostatus

import { Building2, MapPin, Home, ChevronRight, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { StationHealthBadge, HealthStatus } from '../shared/StationHealthBadge'

export interface CustomerStationSummary {
  customer_id: string
  customer_name: string
  customer_address: string | null
  outdoor_count: number
  indoor_count: number
  health_status: HealthStatus
  latest_inspection_date: string | null
  latest_inspector_name: string | null
}

interface CustomerStationCardProps {
  customer: CustomerStationSummary
  onClick: () => void
  isSelected?: boolean
}

export function CustomerStationCard({
  customer,
  onClick,
  isSelected = false
}: CustomerStationCardProps) {
  const totalStations = customer.outdoor_count + customer.indoor_count

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-xl transition-all duration-200
        bg-slate-800/50 backdrop-blur-sm border
        ${isSelected
          ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
          : 'border-slate-700/50 hover:border-slate-600/50'
        }
        hover:bg-slate-800/70 group
      `}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Vänster: Ikon + info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Kundikon */}
          <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>

          {/* Kundinfo */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white truncate group-hover:text-emerald-400 transition-colors">
              {customer.customer_name}
            </h3>

            {/* Stationsräkning */}
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                {customer.outdoor_count} ute
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <Home className="w-3.5 h-3.5" />
                {customer.indoor_count} inne
              </span>
            </div>

            {/* Senaste aktivitet */}
            {customer.latest_inspection_date && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                <Calendar className="w-3 h-3" />
                <span>
                  Senast: {format(new Date(customer.latest_inspection_date), 'd MMM', { locale: sv })}
                  {customer.latest_inspector_name && (
                    <span className="text-slate-600"> • {customer.latest_inspector_name}</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Höger: Hälsostatus + pil */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <StationHealthBadge status={customer.health_status} size="sm" />
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-400 transition-colors" />
        </div>
      </div>
    </button>
  )
}

// Kompakt version för mobil
export function CustomerStationCardCompact({
  customer,
  onClick,
  isSelected = false
}: CustomerStationCardProps) {
  const totalStations = customer.outdoor_count + customer.indoor_count

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200
        bg-slate-800/50 border
        ${isSelected
          ? 'border-emerald-500/50'
          : 'border-slate-700/50 hover:border-slate-600/50'
        }
        hover:bg-slate-800/70
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Building2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="font-medium text-white text-sm truncate">
            {customer.customer_name}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500">
            {customer.outdoor_count + customer.indoor_count}
          </span>
          <StationHealthBadge status={customer.health_status} size="sm" showLabel={false} />
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>
      </div>
    </button>
  )
}

// Skeleton loader
export function CustomerStationCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 bg-slate-700/50 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-slate-700/50 rounded" />
            <div className="h-4 w-24 bg-slate-700/30 rounded" />
            <div className="h-3 w-20 bg-slate-700/20 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 bg-slate-700/30 rounded-full" />
          <div className="w-4 h-4 bg-slate-700/30 rounded" />
        </div>
      </div>
    </div>
  )
}

export default CustomerStationCard
