// src/components/shared/indoor/IndoorStationMarker.tsx
// Markör-komponent för stationer på planritning

import type {
  IndoorStationWithRelations,
  IndoorStationType,
  IndoorStationStatus
} from '../../../types/indoor'
import {
  INDOOR_STATION_TYPE_CONFIG,
  INDOOR_STATION_STATUS_CONFIG
} from '../../../types/indoor'
import type { CalculatedStatus } from '../../../types/stationTypes'
import { CALCULATED_STATUS_CONFIG } from '../CalculatedStatusBadge'

interface IndoorStationMarkerProps {
  station: IndoorStationWithRelations
  isSelected?: boolean
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
}

// Hämta typ-konfiguration - prioritera dynamisk data från DB
function getTypeConfig(station: IndoorStationWithRelations) {
  // Prioritera dynamisk data från station_type_data (från DB)
  if (station.station_type_data) {
    return {
      label: station.station_type_data.name,
      color: station.station_type_data.color,
      icon: station.station_type_data.icon,
      prefix: station.station_type_data.prefix
    }
  }
  // Fallback till legacy-config
  const legacyConfig = INDOOR_STATION_TYPE_CONFIG[station.station_type]
  if (legacyConfig) {
    return {
      label: legacyConfig.label,
      color: legacyConfig.color,
      icon: station.station_type === 'mechanical_trap' ? 'crosshair' :
            station.station_type === 'concrete_station' ? 'box' : 'target',
      prefix: legacyConfig.prefix
    }
  }
  // Absolut fallback
  return {
    label: station.station_type || 'Okänd typ',
    color: '#6b7280',
    icon: 'circle',
    prefix: 'ST'
  }
}

export function IndoorStationMarker({
  station,
  isSelected = false,
  onClick,
  size = 'medium'
}: IndoorStationMarkerProps) {
  const typeConfig = getTypeConfig(station)
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
          <StationIcon iconName={typeConfig.icon} className={`text-white ${iconSize[size]}`} />
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

// Ikon baserat på ikon-namn från stationstyp
function StationIcon({ iconName, className = '' }: { iconName: string; className?: string }) {
  // Mappa ikon-namn till SVG
  switch (iconName) {
    case 'crosshair':
      return (
        <svg viewBox="0 0 24 24" className={`w-3 h-3 ${className}`} fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )
    case 'box':
      return (
        <svg viewBox="0 0 24 24" className={`w-3 h-3 ${className}`} fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
      )
    case 'target':
      return (
        <svg viewBox="0 0 24 24" className={`w-3 h-3 ${className}`} fill="currentColor">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
      )
    case 'package':
      return (
        <svg viewBox="0 0 24 24" className={`w-3 h-3 ${className}`} fill="currentColor">
          <path d="M20 6L12 2L4 6V18L12 22L20 18V6Z" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M12 22V12M12 12L4 6M12 12L20 6" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      )
    case 'circle':
    default:
      return (
        <svg viewBox="0 0 24 24" className={`w-3 h-3 ${className}`} fill="currentColor">
          <circle cx="12" cy="12" r="8"/>
        </svg>
      )
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
