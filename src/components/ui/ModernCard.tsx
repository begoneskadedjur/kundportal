// 📁 src/components/ui/ModernCard.tsx - Återanvändbar Modern Kortkomponent
import React from 'react'
import type { Icon as LucideIcon } from 'lucide-react';

interface ModernCardProps {
  children: React.ReactNode
  className?: string
  gradient?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow' | 'pink' | 'teal'
  hoverable?: boolean
  glowing?: boolean
}

interface ModernCardHeaderProps {
  icon?: LucideIcon
  iconColor?: string
  title: string
  subtitle?: string
  rightElement?: React.ReactNode
  className?: string
}

interface ModernCardContentProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

interface ModernStatCardProps {
  icon?: LucideIcon
  iconGradient?: string
  label: string
  value: string | number
  change?: {
    value: string
    positive: boolean
  }
  trend?: 'up' | 'down' | 'neutral'
  className?: string
  hoverable?: boolean
}

// Gradient mappings
const gradientMap = {
  blue: 'from-blue-600/20 to-blue-800/20 border-blue-500/30',
  green: 'from-green-600/20 to-green-800/20 border-green-500/30',
  purple: 'from-purple-600/20 to-purple-800/20 border-purple-500/30',
  orange: 'from-orange-600/20 to-orange-800/20 border-orange-500/30',
  red: 'from-red-600/20 to-red-800/20 border-red-500/30',
  yellow: 'from-yellow-600/20 to-yellow-800/20 border-yellow-500/30',
  pink: 'from-pink-600/20 to-pink-800/20 border-pink-500/30',
  teal: 'from-teal-600/20 to-teal-800/20 border-teal-500/30'
}

const glowMap = {
  blue: 'shadow-lg shadow-blue-500/25',
  green: 'shadow-lg shadow-green-500/25',
  purple: 'shadow-lg shadow-purple-500/25',
  orange: 'shadow-lg shadow-orange-500/25',
  red: 'shadow-lg shadow-red-500/25',
  yellow: 'shadow-lg shadow-yellow-500/25',
  pink: 'shadow-lg shadow-pink-500/25',
  teal: 'shadow-lg shadow-teal-500/25'
}

// Main ModernCard Component
const ModernCard: React.FC<ModernCardProps> = ({ 
  children, 
  className = '', 
  gradient,
  hoverable = false,
  glowing = false
}) => {
  const baseClasses = 'rounded-xl border backdrop-blur-sm transition-all duration-300'
  
  let gradientClasses = 'bg-slate-900/50 border-slate-800'
  let glowClasses = ''
  
  if (gradient) {
    gradientClasses = `bg-gradient-to-br ${gradientMap[gradient]}`
  }
  
  if (glowing && gradient) {
    glowClasses = glowMap[gradient]
  }
  
  const hoverClasses = hoverable ? 'hover:scale-[1.02] hover:border-opacity-60 cursor-pointer' : ''
  
  return (
    <div className={`${baseClasses} ${gradientClasses} ${glowClasses} ${hoverClasses} ${className}`}>
      {children}
    </div>
  )
}

// ModernCard Header Sub-component
const ModernCardHeader: React.FC<ModernCardHeaderProps> = ({
  icon: Icon,
  iconColor = 'text-blue-500',
  title,
  subtitle,
  rightElement,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-between p-6 ${className}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && (
            <p className="text-sm text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {rightElement && (
        <div className="flex items-center gap-2">
          {rightElement}
        </div>
      )}
    </div>
  )
}

// ModernCard Content Sub-component
const ModernCardContent: React.FC<ModernCardContentProps> = ({
  children,
  className = '',
  noPadding = false
}) => {
  return (
    <div className={`${!noPadding ? 'p-6 pt-0' : ''} ${className}`}>
      {children}
    </div>
  )
}

// Modern Stat Card Component
const ModernStatCard: React.FC<ModernStatCardProps> = ({
  icon: Icon,
  iconGradient = 'from-blue-500 to-blue-600',
  label,
  value,
  change,
  trend = 'neutral',
  className = '',
  hoverable = true
}) => {
  const trendIcons = {
    up: '↗️',
    down: '↘️',
    neutral: '➡️'
  }

  const changeColors = {
    positive: 'text-green-400',
    negative: 'text-red-400'
  }

  return (
    <ModernCard 
      hoverable={hoverable}
      className={`group ${className}`}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          {Icon && (
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${iconGradient} flex items-center justify-center text-white shadow-lg`}>
              <Icon className="w-6 h-6" />
            </div>
          )}
          {trend !== 'neutral' && (
            <span className="text-2xl">{trendIcons[trend]}</span>
          )}
        </div>
        
        <div className="mb-2">
          <p className="text-3xl font-bold text-white group-hover:text-blue-400 transition-colors">
            {value}
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">{label}</p>
          {change && (
            <div className={`text-sm font-medium flex items-center gap-1 ${
              change.positive ? changeColors.positive : changeColors.negative
            }`}>
              <span>{change.positive ? '+' : ''}{change.value}</span>
            </div>
          )}
        </div>
      </div>
    </ModernCard>
  )
}

// Export sub-components as properties of main component
ModernCard.Header = ModernCardHeader
ModernCard.Content = ModernCardContent
ModernCard.Stat = ModernStatCard

export default ModernCard