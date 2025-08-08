// src/components/admin/customers/HealthScoreBadge.tsx - Health Score badge med tooltip

import React from 'react'
import { Activity } from 'lucide-react'
import TooltipWrapper from '../../ui/TooltipWrapper'

interface HealthScoreBadgeProps {
  score: number
  level: 'excellent' | 'good' | 'fair' | 'poor'
  tooltip: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

export default function HealthScoreBadge({ 
  score, 
  level, 
  tooltip, 
  size = 'md',
  showIcon = true 
}: HealthScoreBadgeProps) {
  const getColorClasses = () => {
    switch (level) {
      case 'excellent':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'good':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'fair':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'poor':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1'
      case 'md':
        return 'text-sm px-2.5 py-1'
      case 'lg':
        return 'text-base px-3 py-1.5'
      default:
        return 'text-sm px-2.5 py-1'
    }
  }

  return (
    <TooltipWrapper content={tooltip} position="top">
      <span className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${getColorClasses()} ${getSizeClasses()}
        cursor-help hover:opacity-80 transition-opacity
      `}>
        {showIcon && <Activity className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
        <span className="font-bold">{score}</span>
        <span className="opacity-75">/100</span>
      </span>
    </TooltipWrapper>
  )
}