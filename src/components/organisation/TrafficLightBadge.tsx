// src/components/organisation/TrafficLightBadge.tsx
import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface TrafficLightBadgeProps {
  pestLevel?: number | null
  problemRating?: number | null
  size?: 'small' | 'medium' | 'large'
  showTooltip?: boolean
  className?: string
}

const TrafficLightBadge: React.FC<TrafficLightBadgeProps> = ({
  pestLevel,
  problemRating,
  size = 'medium',
  showTooltip = true,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false)

  // Beräkna trafikljusstatus
  const getTrafficLightStatus = () => {
    if (pestLevel === null && problemRating === null) return null
    if (pestLevel === undefined && problemRating === undefined) return null
    
    const pest = pestLevel ?? -1
    const problem = problemRating ?? -1
    
    if (pest >= 3 || problem >= 4) return 'red'
    if (pest === 2 || problem === 3) return 'yellow'
    if (pest >= 0 || problem >= 0) return 'green'
    return null
  }

  const status = getTrafficLightStatus()
  
  // Om ingen status, visa ingenting
  if (!status) return null

  // Statusfärger och stilar
  const statusStyles = {
    green: {
      container: 'bg-green-500/20 border-green-500/50',
      text: 'text-green-400',
      icon: '🟢',
      label: 'OK',
      fullLabel: 'OK - Kontrollerad situation'
    },
    yellow: {
      container: 'bg-yellow-500/20 border-yellow-500/50',
      text: 'text-yellow-400',
      icon: '🟡',
      label: 'Varning',
      fullLabel: 'VARNING - Övervakning krävs'
    },
    red: {
      container: 'bg-red-500/20 border-red-500/50',
      text: 'text-red-400',
      icon: '🔴',
      label: 'Kritisk',
      fullLabel: 'KRITISK - Omedelbar åtgärd'
    }
  }

  // Storleksstilar
  const sizeStyles = {
    small: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
    medium: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
    large: 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-base font-semibold shadow-lg'
  }

  const currentStyle = statusStyles[status]
  const sizeStyle = sizeStyles[size]

  // Beskrivningar för tooltip
  const getPestLevelDescription = (level: number | null | undefined) => {
    if (level === null || level === undefined) return 'Ej bedömt'
    switch(level) {
      case 0: return 'Ingen förekomst'
      case 1: return 'Låg nivå'
      case 2: return 'Måttlig nivå'
      case 3: return 'Hög nivå'
      default: return 'Ej bedömt'
    }
  }

  const getProblemRatingDescription = (rating: number | null | undefined) => {
    if (rating === null || rating === undefined) return 'Ej bedömt'
    switch(rating) {
      case 1: return 'Utmärkt'
      case 2: return 'Bra'
      case 3: return 'OK'
      case 4: return 'Allvarligt'
      case 5: return 'Kritiskt'
      default: return 'Ej bedömt'
    }
  }

  return (
    <div className="relative inline-block">
      <div
        className={`${sizeStyle} ${currentStyle.container} ${currentStyle.text} border transition-all duration-200 ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className={size === 'small' ? 'text-sm' : size === 'medium' ? 'text-base' : 'text-xl'}>
          {currentStyle.icon}
        </span>
        {size !== 'small' && (
          <span className={size === 'large' ? 'font-semibold' : ''}>{currentStyle.label}</span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[200px]">
            {/* Arrow */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45"></div>
            
            <div className="relative">
              <p className={`text-sm font-semibold ${currentStyle.text} mb-2`}>
                {currentStyle.fullLabel}
              </p>
              
              <div className="space-y-1 text-xs">
                {pestLevel !== null && pestLevel !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Skadedjursnivå:</span>
                    <span className="text-white font-medium">
                      {pestLevel} - {getPestLevelDescription(pestLevel)}
                    </span>
                  </div>
                )}
                
                {problemRating !== null && problemRating !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Problembild:</span>
                    <span className="text-white font-medium">
                      {problemRating}/5 - {getProblemRatingDescription(problemRating)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrafficLightBadge