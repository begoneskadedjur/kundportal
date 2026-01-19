// src/components/shared/CalculatedStatusBadge.tsx
// Badge för att visa beräknad status baserad på mätningar vs tröskelvärden

import { CheckCircle2, AlertTriangle, AlertCircle, Activity } from 'lucide-react'
import { CalculatedStatus } from '../../types/stationTypes'

interface CalculatedStatusBadgeProps {
  status: CalculatedStatus
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const CALCULATED_STATUS_CONFIG: Record<CalculatedStatus, {
  label: string
  shortLabel: string
  description: string
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  icon: typeof CheckCircle2
}> = {
  ok: {
    label: 'OK',
    shortLabel: 'OK',
    description: 'Inom normala värden',
    color: '#10b981', // emerald-500
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    icon: CheckCircle2
  },
  warning: {
    label: 'Varning',
    shortLabel: '!',
    description: 'Överskrider varningströskel',
    color: '#f59e0b', // amber-500
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    icon: AlertTriangle
  },
  critical: {
    label: 'Kritisk',
    shortLabel: '!!',
    description: 'Överskrider kritisk tröskel',
    color: '#ef4444', // red-500
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: AlertCircle
  }
}

export function CalculatedStatusBadge({
  status,
  showLabel = true,
  size = 'md',
  className = ''
}: CalculatedStatusBadgeProps) {
  const config = CALCULATED_STATUS_CONFIG[status]
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

// Kompakt prick för listor och markörer
export function CalculatedStatusDot({
  status,
  size = 'md',
  className = ''
}: {
  status: CalculatedStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const config = CALCULATED_STATUS_CONFIG[status]

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

// Sektion som visar mätningsstatus med värde
export function MeasurementStatusSection({
  calculatedStatus,
  latestValue,
  unit,
  warningThreshold,
  criticalThreshold,
  thresholdDirection,
  className = ''
}: {
  calculatedStatus: CalculatedStatus
  latestValue?: number | null
  unit: string
  warningThreshold?: number | null
  criticalThreshold?: number | null
  thresholdDirection?: 'above' | 'below'
  className?: string
}) {
  const config = CALCULATED_STATUS_CONFIG[calculatedStatus]
  const Icon = config.icon

  const hasThresholds = warningThreshold !== null || criticalThreshold !== null
  const direction = thresholdDirection || 'above'

  return (
    <div className={`p-3 rounded-lg border ${config.borderColor} ${config.bgColor} ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.textColor}`} />
        </div>
        <div>
          <p className={`font-medium ${config.textColor}`}>{config.label}</p>
          {latestValue !== null && latestValue !== undefined && (
            <p className="text-sm text-slate-300">
              Senaste mätning: <span className="font-medium">{latestValue} {unit}</span>
            </p>
          )}
        </div>
      </div>

      {hasThresholds && (
        <div className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700/50">
          <p className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Tröskelvärden ({direction === 'above' ? 'högre är sämre' : 'lägre är sämre'}):
          </p>
          <div className="flex gap-3 mt-1">
            {warningThreshold !== null && (
              <span className="text-amber-400">
                Varning: {direction === 'above' ? '>' : '<'}{warningThreshold} {unit}
              </span>
            )}
            {criticalThreshold !== null && (
              <span className="text-red-400">
                Kritisk: {direction === 'above' ? '>' : '<'}{criticalThreshold} {unit}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CalculatedStatusBadge
