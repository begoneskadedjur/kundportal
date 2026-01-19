// src/components/shared/StationHealthBadge.tsx
// Återanvändbar hälsobadge för att visa aggregerad stationsstatus

import { CheckCircle2, AlertTriangle, AlertCircle, Activity } from 'lucide-react'

export type HealthStatus = 'excellent' | 'good' | 'fair' | 'poor'

interface StationHealthBadgeProps {
  status: HealthStatus
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const HEALTH_STATUS_CONFIG: Record<HealthStatus, {
  label: string
  description: string
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  icon: typeof CheckCircle2
}> = {
  excellent: {
    label: 'Utmärkt',
    description: 'Alla stationer OK',
    color: '#10b981', // emerald-500
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    icon: CheckCircle2
  },
  good: {
    label: 'Bra',
    description: 'Mindre än 10% har problem',
    color: '#34d399', // emerald-400
    bgColor: 'bg-emerald-400/10',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-400/30',
    icon: CheckCircle2
  },
  fair: {
    label: 'Medel',
    description: '10-30% har problem',
    color: '#f59e0b', // amber-500
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    icon: AlertTriangle
  },
  poor: {
    label: 'Kritisk',
    description: 'Mer än 30% har problem',
    color: '#ef4444', // red-500
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: AlertCircle
  }
}

// Beräkna hälsostatus från stationsstatus
export function calculateHealthStatus(
  stations: Array<{ status: string }>
): HealthStatus {
  if (stations.length === 0) return 'excellent'

  const problematic = stations.filter(s =>
    s.status === 'damaged' ||
    s.status === 'missing' ||
    s.status === 'needs_service'
  ).length

  const ratio = problematic / stations.length

  if (ratio === 0) return 'excellent'
  if (ratio < 0.1) return 'good'
  if (ratio < 0.3) return 'fair'
  return 'poor'
}

// Beräkna hälsostatus med procentandel
export function calculateHealthStatusWithPercentage(
  stations: Array<{ status: string }>
): { status: HealthStatus; percentage: number; problematicCount: number } {
  if (stations.length === 0) {
    return { status: 'excellent', percentage: 100, problematicCount: 0 }
  }

  const problematic = stations.filter(s =>
    s.status === 'damaged' ||
    s.status === 'missing' ||
    s.status === 'needs_service'
  ).length

  const healthyPercentage = Math.round(((stations.length - problematic) / stations.length) * 100)
  const ratio = problematic / stations.length

  let status: HealthStatus
  if (ratio === 0) status = 'excellent'
  else if (ratio < 0.1) status = 'good'
  else if (ratio < 0.3) status = 'fair'
  else status = 'poor'

  return { status, percentage: healthyPercentage, problematicCount: problematic }
}

export function StationHealthBadge({
  status,
  showLabel = true,
  size = 'md',
  className = ''
}: StationHealthBadgeProps) {
  const config = HEALTH_STATUS_CONFIG[status]
  const Icon = config.icon

  const sizeClasses = {
    sm: {
      badge: 'px-2 py-0.5 text-xs gap-1',
      icon: 'w-3 h-3'
    },
    md: {
      badge: 'px-2.5 py-1 text-sm gap-1.5',
      icon: 'w-4 h-4'
    },
    lg: {
      badge: 'px-3 py-1.5 text-base gap-2',
      icon: 'w-5 h-5'
    }
  }

  const sizes = sizeClasses[size]

  return (
    <div
      className={`
        inline-flex items-center rounded-full font-medium
        ${config.bgColor} ${config.textColor} border ${config.borderColor}
        ${sizes.badge}
        ${className}
      `}
    >
      <Icon className={sizes.icon} />
      {showLabel && <span>{config.label}</span>}
    </div>
  )
}

// Kompakt version för listor
export function StationHealthDot({
  status,
  size = 'md',
  className = ''
}: {
  status: HealthStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const config = HEALTH_STATUS_CONFIG[status]

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  }

  return (
    <div
      className={`rounded-full ${dotSizes[size]} ${className}`}
      style={{ backgroundColor: config.color }}
      title={config.label}
    />
  )
}

// Detaljerad version med procent och antal
export function StationHealthDetail({
  status,
  percentage,
  problematicCount,
  totalCount,
  className = ''
}: {
  status: HealthStatus
  percentage: number
  problematicCount: number
  totalCount: number
  className?: string
}) {
  const config = HEALTH_STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bgColor}`}
      >
        <Icon className={`w-5 h-5 ${config.textColor}`} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${config.textColor}`}>
            {config.label}
          </span>
          <span className="text-slate-400 text-sm">({percentage}%)</span>
        </div>
        <p className="text-xs text-slate-500">
          {problematicCount === 0 ? (
            'Alla stationer OK'
          ) : (
            `${problematicCount} av ${totalCount} kräver uppmärksamhet`
          )}
        </p>
      </div>
    </div>
  )
}

export default StationHealthBadge
