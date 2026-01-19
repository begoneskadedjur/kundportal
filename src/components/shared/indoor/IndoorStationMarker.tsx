// src/components/shared/indoor/IndoorStationMarker.tsx
// Markör-komponent för stationer på planritning

import {
  IndoorStationWithRelations,
  IndoorStationType,
  IndoorStationStatus,
  INDOOR_STATION_TYPE_CONFIG,
  INDOOR_STATION_STATUS_CONFIG
} from '../../../types/indoor'
import { CalculatedStatus } from '../../../types/stationTypes'
import { CALCULATED_STATUS_CONFIG } from '../CalculatedStatusBadge'

interface IndoorStationMarkerProps {
  station: IndoorStationWithRelations
  isSelected?: boolean
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
}

export function IndoorStationMarker({
  station,
  isSelected = false,
  onClick,
  size = 'medium'
}: IndoorStationMarkerProps) {
  const typeConfig = INDOOR_STATION_TYPE_CONFIG[station.station_type]
  const statusConfig = INDOOR_STATION_STATUS_CONFIG[station.status]

  // Storlek baserat på prop
  const sizeClasses = {
    small: 'w-5 h-5',
    medium: 'w-7 h-7',
    large: 'w-9 h-9'
  }

  const iconSize = {
    small: 'text-[10px]',
    medium: 'text-xs',
    large: 'text-sm'
  }

  // Opacity baserat på status
  const getOpacity = (status: IndoorStationStatus): string => {
    switch (status) {
      case 'removed':
        return 'opacity-50'
      case 'missing':
      case 'damaged':
        return 'opacity-85'
      default:
        return 'opacity-100'
    }
  }

  // Status-symbol
  const getStatusSymbol = (status: IndoorStationStatus): string | null => {
    switch (status) {
      case 'removed':
        return '✕'
      case 'missing':
        return '?'
      case 'damaged':
        return '!'
      default:
        return null
    }
  }

  const statusSymbol = getStatusSymbol(station.status)

  return (
    <div
      className={`
        absolute cursor-pointer transition-all duration-200
        ${getOpacity(station.status)}
        ${isSelected ? 'z-20 scale-125' : 'z-10 hover:scale-110'}
      `}
      style={{
        left: `${station.position_x_percent}%`,
        top: `${station.position_y_percent}%`,
        transform: 'translate(-50%, -50%)'
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 -m-1 rounded-full border-2 border-white animate-pulse" />
      )}

      {/* Main marker */}
      <div
        className={`
          ${sizeClasses[size]} rounded-full border-2 border-white shadow-lg
          flex items-center justify-center
          ${isSelected ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-900' : ''}
        `}
        style={{ backgroundColor: typeConfig.color }}
        title={`${typeConfig.label} - ${station.station_number || 'Utan nummer'}`}
      >
        {/* Station number or status symbol */}
        {statusSymbol ? (
          <span className={`text-white font-bold ${iconSize[size]}`}>
            {statusSymbol}
          </span>
        ) : (
          <StationIcon type={station.station_type} className={`text-white ${iconSize[size]}`} />
        )}
      </div>

      {/* Status badge for non-active stations OR calculated status warning/critical */}
      {station.status !== 'active' ? (
        <div
          className={`
            absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-white
            ${statusConfig.bgColor.replace('/20', '')}
          `}
          style={{
            backgroundColor:
              station.status === 'missing' ? '#f59e0b' :
              station.status === 'damaged' ? '#ef4444' :
              '#64748b'
          }}
        />
      ) : station.calculated_status && station.calculated_status !== 'ok' && (
        <div
          className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-white"
          style={{
            backgroundColor: CALCULATED_STATUS_CONFIG[station.calculated_status as CalculatedStatus]?.color || '#64748b'
          }}
          title={CALCULATED_STATUS_CONFIG[station.calculated_status as CalculatedStatus]?.label}
        />
      )}

      {/* Tooltip on hover - desktop only */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
        <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
          <p className="font-medium">{station.station_number || 'Utan nummer'}</p>
          <p className="text-slate-400">{typeConfig.label}</p>
        </div>
      </div>
    </div>
  )
}

// Ikon baserat på stationstyp
function StationIcon({ type, className = '' }: { type: IndoorStationType; className?: string }) {
  switch (type) {
    case 'mechanical_trap':
      return (
        <svg viewBox="0 0 24 24" className={`w-3 h-3 ${className}`} fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )
    case 'concrete_station':
      return (
        <svg viewBox="0 0 24 24" className={`w-3 h-3 ${className}`} fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
      )
    case 'bait_station':
      return (
        <svg viewBox="0 0 24 24" className={`w-3 h-3 ${className}`} fill="currentColor">
          <circle cx="12" cy="12" r="8"/>
        </svg>
      )
    default:
      return null
  }
}

// Export för användning i legend etc
export function StationLegend() {
  const types: IndoorStationType[] = ['mechanical_trap', 'concrete_station', 'bait_station']

  return (
    <div className="flex flex-wrap gap-3">
      {types.map((type) => {
        const config = INDOOR_STATION_TYPE_CONFIG[type]
        return (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full border border-white/50"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-xs text-slate-400">{config.label}</span>
          </div>
        )
      })}
    </div>
  )
}
