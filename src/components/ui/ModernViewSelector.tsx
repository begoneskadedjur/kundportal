// 📁 src/components/ui/ModernViewSelector.tsx - Växla mellan olika vyer
import React from 'react'
import type { Icon as LucideIcon } from 'lucide-react';

interface ViewOption {
  key: string
  label: string
  description?: string
  icon?: LucideIcon
  badge?: string | number
  gradient?: string
  disabled?: boolean
}

interface ModernViewSelectorProps {
  options: ViewOption[]
  selectedView: string
  onViewChange: (view: string) => void
  layout?: 'horizontal' | 'vertical' | 'grid'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'cards'
  className?: string
}

interface ViewCardProps {
  option: ViewOption
  isSelected: boolean
  onSelect: () => void
  size: 'sm' | 'md' | 'lg'
  variant: 'default' | 'compact' | 'cards'
}

// Predefined gradient options
const gradientOptions = {
  blue: 'from-blue-600 to-blue-700',
  green: 'from-green-600 to-green-700',
  purple: 'from-purple-600 to-purple-700',
  orange: 'from-orange-600 to-orange-700',
  red: 'from-red-600 to-red-700',
  yellow: 'from-yellow-600 to-yellow-700',
  pink: 'from-pink-600 to-pink-700',
  teal: 'from-teal-600 to-teal-700',
  indigo: 'from-indigo-600 to-indigo-700',
  cyan: 'from-cyan-600 to-cyan-700'
}

// Individual View Card Component
const ViewCard: React.FC<ViewCardProps> = ({
  option,
  isSelected,
  onSelect,
  size,
  variant
}) => {
  const Icon = option.icon

  // Size configurations
  const sizeConfig = {
    sm: {
      padding: 'p-3',
      iconSize: 'w-4 h-4',
      titleSize: 'text-sm',
      descSize: 'text-xs',
      badgeSize: 'text-xs px-2 py-1'
    },
    md: {
      padding: 'p-4',
      iconSize: 'w-5 h-5',
      titleSize: 'text-base',
      descSize: 'text-sm',
      badgeSize: 'text-xs px-2 py-1'
    },
    lg: {
      padding: 'p-6',
      iconSize: 'w-6 h-6',
      titleSize: 'text-lg',
      descSize: 'text-sm',
      badgeSize: 'text-sm px-3 py-1'
    }
  }

  const config = sizeConfig[size]

  // Get gradient from predefined options or use custom
  const getGradient = () => {
    if (!option.gradient) return 'from-slate-600 to-slate-700'
    if (option.gradient in gradientOptions) {
      return gradientOptions[option.gradient as keyof typeof gradientOptions]
    }
    return option.gradient
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={onSelect}
        disabled={option.disabled}
        className={`
          ${config.padding} rounded-lg border transition-all duration-200 flex items-center gap-3
          ${isSelected 
            ? `bg-gradient-to-r ${getGradient()} border-transparent text-white shadow-lg` 
            : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600'
          }
          ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}
        `}
      >
        {Icon && (
          <Icon className={`${config.iconSize} ${isSelected ? 'text-white' : 'text-slate-400'}`} />
        )}
        <div className="flex-1 text-left">
          <div className={`font-semibold ${config.titleSize}`}>
            {option.label}
          </div>
          {option.description && (
            <div className={`opacity-80 ${config.descSize}`}>
              {option.description}
            </div>
          )}
        </div>
        {option.badge && (
          <span className={`
            ${config.badgeSize} rounded-full font-medium
            ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}
          `}>
            {option.badge}
          </span>
        )}
      </button>
    )
  }

  if (variant === 'cards') {
    return (
      <button
        onClick={onSelect}
        disabled={option.disabled}
        className={`
          ${config.padding} rounded-xl border transition-all duration-300 text-left group
          ${isSelected 
            ? `bg-gradient-to-br ${getGradient()} border-transparent text-white shadow-xl shadow-blue-500/25` 
            : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
          }
          ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-lg'}
        `}
      >
        <div className="flex items-start justify-between mb-3">
          {Icon && (
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200
              ${isSelected 
                ? 'bg-white/20 text-white' 
                : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
              }
            `}>
              <Icon className={config.iconSize} />
            </div>
          )}
          {option.badge && (
            <span className={`
              ${config.badgeSize} rounded-full font-medium
              ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'}
            `}>
              {option.badge}
            </span>
          )}
        </div>
        
        <div>
          <div className={`font-semibold ${config.titleSize} mb-1`}>
            {option.label}
          </div>
          {option.description && (
            <div className={`opacity-80 ${config.descSize}`}>
              {option.description}
            </div>
          )}
        </div>
      </button>
    )
  }

  // Default variant
  return (
    <button
      onClick={onSelect}
      disabled={option.disabled}
      className={`
        ${config.padding} rounded-lg border transition-all duration-200 flex items-center justify-center gap-2
        ${isSelected 
          ? `bg-gradient-to-r ${getGradient()} border-transparent text-white shadow-lg` 
          : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/50'
        }
        ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
      `}
    >
      {Icon && (
        <Icon className={`${config.iconSize} ${isSelected ? 'text-white' : 'text-slate-400'}`} />
      )}
      <span className={`font-medium ${config.titleSize}`}>
        {option.label}
      </span>
      {option.badge && (
        <span className={`
          ${config.badgeSize} rounded-full font-medium ml-2
          ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}
        `}>
          {option.badge}
        </span>
      )}
    </button>
  )
}

// Main ModernViewSelector Component
const ModernViewSelector: React.FC<ModernViewSelectorProps> = ({
  options,
  selectedView,
  onViewChange,
  layout = 'horizontal',
  size = 'md',
  variant = 'default',
  className = ''
}) => {
  // Layout configurations
  const layoutClasses = {
    horizontal: 'flex flex-wrap gap-3',
    vertical: 'flex flex-col gap-3',
    grid: `grid gap-3 ${
      options.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
      options.length <= 3 ? 'grid-cols-1 md:grid-cols-3' :
      options.length <= 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
      'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    }`
  }

  return (
    <div className={`${layoutClasses[layout]} ${className}`}>
      {options.map((option) => (
        <ViewCard
          key={option.key}
          option={option}
          isSelected={selectedView === option.key}
          onSelect={() => !option.disabled && onViewChange(option.key)}
          size={size}
          variant={variant}
        />
      ))}
    </div>
  )
}

export default ModernViewSelector

// Utility function to create view options
export const createViewOption = (
  key: string,
  label: string,
  options?: {
    description?: string
    icon?: LucideIcon
    badge?: string | number
    gradient?: string
    disabled?: boolean
  }
): ViewOption => ({
  key,
  label,
  ...options
})

// Predefined common view options
export const commonViewOptions = {
  begone: (badge?: string | number) => createViewOption(
    'begone',
    'BeGone Tekniker',
    {
      description: 'Bara engångsjobb',
      gradient: 'blue',
      badge
    }
  ),
  contract: (badge?: string | number) => createViewOption(
    'contract',
    'Avtalskund Tekniker', 
    {
      description: 'Nya avtal + Merförsäljning',
      gradient: 'green',
      badge
    }
  ),
  combined: (badge?: string | number) => createViewOption(
    'combined',
    'Kombinerad Vy',
    {
      description: 'Alla tekniker sammanslagen',
      gradient: 'purple',
      badge
    }
  )
}