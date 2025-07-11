// 📁 src/components/ui/ModernPodium.tsx - Topp 3 Prestanda Komponenter
import React from 'react'
import { Trophy, Star, Medal, Crown } from 'lucide-react'
import ModernCard from './ModernCard'

interface PodiumItem {
  id: string | number
  name: string
  value: string | number
  secondaryValue?: string | number
  description?: string
  avatar?: string
  rank: number
  badge?: string
  metrics?: Array<{
    label: string
    value: string | number
  }>
}

interface ModernPodiumProps {
  items: PodiumItem[]
  title: string
  subtitle?: string
  valueLabel?: string
  className?: string
  variant?: 'default' | 'compact' | 'detailed'
  showMetrics?: boolean
  formatValue?: (value: string | number) => string
  formatSecondaryValue?: (value: string | number) => string
}

interface PodiumCardProps {
  item: PodiumItem
  variant: 'default' | 'compact' | 'detailed'
  showMetrics: boolean
  formatValue?: (value: string | number) => string
  formatSecondaryValue?: (value: string | number) => string
}

// Medal/Rank configurations
const rankConfig = {
  1: {
    gradient: 'from-yellow-400 via-yellow-500 to-yellow-600',
    shadow: 'shadow-yellow-500/25',
    border: 'border-yellow-500/50',
    icon: '🥇',
    bgGradient: 'from-yellow-600/20 to-amber-600/20',
    textGlow: 'text-yellow-400'
  },
  2: {
    gradient: 'from-slate-300 via-slate-400 to-slate-500',
    shadow: 'shadow-slate-500/25',
    border: 'border-slate-500/50',
    icon: '🥈',
    bgGradient: 'from-slate-600/20 to-slate-700/20',
    textGlow: 'text-slate-300'
  },
  3: {
    gradient: 'from-amber-600 via-amber-700 to-orange-700',
    shadow: 'shadow-amber-500/25',
    border: 'border-amber-500/50',
    icon: '🥉',
    bgGradient: 'from-amber-600/20 to-orange-600/20',
    textGlow: 'text-amber-400'
  }
}

// Individual Podium Card Component
const PodiumCard: React.FC<PodiumCardProps> = ({
  item,
  variant,
  showMetrics,
  formatValue,
  formatSecondaryValue
}) => {
  const config = rankConfig[item.rank as keyof typeof rankConfig]
  
  if (!config) return null

  const displayValue = formatValue ? formatValue(item.value) : item.value
  const displaySecondaryValue = item.secondaryValue && formatSecondaryValue 
    ? formatSecondaryValue(item.secondaryValue) 
    : item.secondaryValue

  return (
    <div className="relative group">
      {/* Rank Badge */}
      <div className={`
        absolute -top-3 -right-3 w-12 h-12 rounded-full 
        bg-gradient-to-r ${config.gradient} 
        flex items-center justify-center 
        font-bold text-lg shadow-xl ${config.shadow}
        border-2 ${config.border}
        z-10 group-hover:scale-110 transition-transform duration-300
      `}>
        <span className="text-white">{item.rank}</span>
      </div>

      <ModernCard 
        hoverable 
        className={`
          h-full bg-gradient-to-br ${config.bgGradient} 
          border-2 ${config.border} ${config.shadow}
          group-hover:scale-105 transition-all duration-300
          ${variant === 'compact' ? 'p-4' : 'p-6'}
        `}
      >
        <div className="text-center h-full flex flex-col justify-between">
          {/* Icon/Avatar */}
          <div className="mb-4">
            {item.avatar ? (
              <img 
                src={item.avatar} 
                alt={item.name}
                className="w-16 h-16 rounded-full mx-auto border-4 border-white/20 shadow-lg"
              />
            ) : (
              <div className="text-4xl mb-2">{config.icon}</div>
            )}
          </div>

          {/* Name */}
          <h4 className={`
            text-xl font-bold text-white mb-2
            ${variant === 'compact' ? 'text-lg' : 'text-xl'}
            group-hover:${config.textGlow} transition-colors duration-300
          `}>
            {item.name}
          </h4>

          {/* Badge */}
          {item.badge && (
            <div className="mb-3">
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium text-white">
                {item.badge}
              </span>
            </div>
          )}

          {/* Main Value */}
          <div className="mb-4">
            <div className={`
              font-bold text-white group-hover:scale-110 transition-transform duration-300
              ${variant === 'compact' ? 'text-2xl' : 'text-3xl'}
            `}>
              {displayValue}
            </div>
            
            {displaySecondaryValue && (
              <div className="text-white/80 text-sm mt-1">
                {displaySecondaryValue}
              </div>
            )}
          </div>

          {/* Description */}
          {item.description && variant !== 'compact' && (
            <p className="text-white/70 text-sm mb-4">{item.description}</p>
          )}

          {/* Metrics */}
          {showMetrics && item.metrics && variant === 'detailed' && (
            <div className="space-y-2 mt-auto">
              <div className="h-px bg-white/20 mb-3"></div>
              {item.metrics.map((metric, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-white/70">{metric.label}</span>
                  <span className="text-white font-medium">{metric.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModernCard>
    </div>
  )
}

// Main ModernPodium Component
const ModernPodium: React.FC<ModernPodiumProps> = ({
  items,
  title,
  subtitle,
  valueLabel,
  className = '',
  variant = 'default',
  showMetrics = false,
  formatValue,
  formatSecondaryValue
}) => {
  // Take only top 3 items and ensure they have ranks 1, 2, 3
  const topThree = items
    .slice(0, 3)
    .map((item, index) => ({ ...item, rank: index + 1 }))

  if (topThree.length === 0) {
    return (
      <ModernCard className={className}>
        <div className="p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto text-slate-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-2">Ingen data tillgänglig</h3>
          <p className="text-sm text-slate-500">Väntar på prestanda-data...</p>
        </div>
      </ModernCard>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          {title}
        </h2>
        {subtitle && (
          <p className="text-slate-400 text-sm">{subtitle}</p>
        )}
        {valueLabel && (
          <p className="text-slate-500 text-xs mt-1">{valueLabel}</p>
        )}
      </div>

      {/* Podium Grid */}
      <div className={`
        grid gap-6
        ${topThree.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : ''}
        ${topThree.length === 2 ? 'grid-cols-1 md:grid-cols-2' : ''}
        ${topThree.length === 3 ? 'grid-cols-1 md:grid-cols-3' : ''}
      `}>
        {topThree.map((item) => (
          <PodiumCard
            key={item.id}
            item={item}
            variant={variant}
            showMetrics={showMetrics}
            formatValue={formatValue}
            formatSecondaryValue={formatSecondaryValue}
          />
        ))}
      </div>

      {/* Footer with total count if more than 3 items */}
      {items.length > 3 && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
            <Star className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-sm">
              Visar topp 3 av {items.length} deltagare
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Export component with additional utilities
export default ModernPodium

// Utility functions for podium data
export const createPodiumItem = (
  id: string | number,
  name: string,
  value: string | number,
  secondaryValue?: string | number,
  description?: string,
  metrics?: Array<{ label: string; value: string | number }>
): PodiumItem => ({
  id,
  name,
  value,
  secondaryValue,
  description,
  rank: 0, // Will be set by the podium component
  metrics
})

// Helper function to format technician data for podium
export const formatTechnicianForPodium = (
  technician: any,
  formatCurrency: (value: number) => string
): PodiumItem => ({
  id: technician.name,
  name: technician.name,
  value: formatCurrency(technician.total_revenue || 0),
  secondaryValue: `${technician.total_cases || 0} ärenden`,
  description: `${technician.private_cases || 0} privat • ${technician.business_cases || 0} företag`,
  rank: technician.rank || 0,
  metrics: [
    { label: 'Genomsnitt/ärende', value: formatCurrency(technician.avg_case_value || 0) },
    { label: 'Privatpersoner', value: formatCurrency(technician.private_revenue || 0) },
    { label: 'Företag', value: formatCurrency(technician.business_revenue || 0) }
  ]
})