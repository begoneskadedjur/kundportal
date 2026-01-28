// src/components/shared/AssessmentScaleBar.tsx
// Segmenterad skalvisare som visar ALLA nivåer med aktuell position markerad

import React from 'react'

// Konfiguration för skadedjursnivå (0-3)
const PEST_LEVELS = [
  { value: 0, label: 'Ingen', shortLabel: '0', color: 'emerald' },
  { value: 1, label: 'Låg', shortLabel: '1', color: 'emerald' },
  { value: 2, label: 'Måttlig', shortLabel: '2', color: 'amber' },
  { value: 3, label: 'Hög', shortLabel: '3', color: 'red' }
]

// Konfiguration för övergripande problembild (1-5)
const PROBLEM_LEVELS = [
  { value: 1, label: 'Utmärkt', shortLabel: '1', color: 'emerald' },
  { value: 2, label: 'Bra', shortLabel: '2', color: 'emerald' },
  { value: 3, label: 'OK', shortLabel: '3', color: 'amber' },
  { value: 4, label: 'Allvarligt', shortLabel: '4', color: 'red' },
  { value: 5, label: 'Kritiskt', shortLabel: '5', color: 'red' }
]

interface AssessmentScaleBarProps {
  type: 'pest' | 'problem'
  value: number
  size?: 'sm' | 'md'
  showLabels?: boolean
  showTitle?: boolean
}

const AssessmentScaleBar: React.FC<AssessmentScaleBarProps> = ({
  type,
  value,
  size = 'md',
  showLabels = true,
  showTitle = true
}) => {
  const levels = type === 'pest' ? PEST_LEVELS : PROBLEM_LEVELS
  const max = type === 'pest' ? 3 : 5
  const title = type === 'pest' ? 'Skadedjursnivå' : 'Övergripande status'

  // Färgklasser baserat på segment
  const getSegmentClasses = (level: typeof levels[0], isActive: boolean) => {
    const baseClasses = 'flex-1 flex flex-col items-center justify-center transition-all duration-200'

    const colorMap = {
      emerald: {
        active: 'bg-emerald-500 text-white',
        inactive: 'bg-emerald-500/20 text-emerald-400/60'
      },
      amber: {
        active: 'bg-amber-500 text-white',
        inactive: 'bg-amber-500/20 text-amber-400/60'
      },
      red: {
        active: 'bg-red-500 text-white',
        inactive: 'bg-red-500/20 text-red-400/60'
      }
    }

    const colors = colorMap[level.color as keyof typeof colorMap]
    return `${baseClasses} ${isActive ? colors.active : colors.inactive}`
  }

  // Storlek baserat på size prop
  const sizeClasses = {
    sm: {
      container: 'h-10',
      segment: 'text-xs',
      label: 'text-[10px]',
      title: 'text-xs',
      value: 'text-sm'
    },
    md: {
      container: 'h-14',
      segment: 'text-sm font-medium',
      label: 'text-xs',
      title: 'text-sm',
      value: 'text-base'
    }
  }[size]

  return (
    <div className="w-full">
      {/* Titel och värde */}
      {showTitle && (
        <div className="flex items-center justify-between mb-2">
          <span className={`text-slate-400 ${sizeClasses.title}`}>{title}</span>
          <span className={`font-bold text-white ${sizeClasses.value}`}>
            {value}/{max}
          </span>
        </div>
      )}

      {/* Segmenterad bar */}
      <div className={`flex rounded-lg overflow-hidden border border-slate-600/50 ${sizeClasses.container}`}>
        {levels.map((level, index) => {
          const isActive = level.value === value
          const isFirst = index === 0
          const isLast = index === levels.length - 1

          return (
            <div
              key={level.value}
              className={`
                ${getSegmentClasses(level, isActive)}
                ${isFirst ? 'rounded-l-lg' : ''}
                ${isLast ? 'rounded-r-lg' : ''}
                ${!isLast ? 'border-r border-slate-600/30' : ''}
                relative
              `}
            >
              {/* Markering för aktiv nivå */}
              {isActive && (
                <div className="absolute inset-0 ring-2 ring-white/50 ring-inset rounded-lg" />
              )}

              {/* Värde */}
              <span className={sizeClasses.segment}>{level.shortLabel}</span>

              {/* Label om showLabels är true */}
              {showLabels && size === 'md' && (
                <span className={`${sizeClasses.label} opacity-80 mt-0.5`}>
                  {level.label}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend för sm-storlek */}
      {showLabels && size === 'sm' && (
        <div className="flex justify-between mt-1 px-1">
          {levels.map((level) => (
            <span
              key={level.value}
              className={`text-[9px] ${level.value === value ? 'text-white font-medium' : 'text-slate-500'}`}
            >
              {level.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default AssessmentScaleBar
