// src/components/admin/customers/ChurnRiskBadge.tsx - Churn Risk badge med tooltip

import React from 'react'
import { AlertTriangle, TrendingDown, Shield } from 'lucide-react'
import TooltipWrapper from '../../ui/TooltipWrapper'

interface ChurnRiskBadgeProps {
  risk: 'low' | 'medium' | 'high'
  score: number
  tooltip: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

export default function ChurnRiskBadge({ 
  risk, 
  score, 
  tooltip, 
  size = 'md',
  showIcon = true 
}: ChurnRiskBadgeProps) {
  const getColorClasses = () => {
    switch (risk) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
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

  const getIcon = () => {
    const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
    switch (risk) {
      case 'high':
        return <AlertTriangle className={iconClass} />
      case 'medium':
        return <TrendingDown className={iconClass} />
      case 'low':
        return <Shield className={iconClass} />
      default:
        return <AlertTriangle className={iconClass} />
    }
  }

  const getRiskLabel = () => {
    switch (risk) {
      case 'high':
        return 'Hög risk'
      case 'medium':
        return 'Medel risk'
      case 'low':
        return 'Låg risk'
      default:
        return 'Okänd risk'
    }
  }

  return (
    <TooltipWrapper content={tooltip} position="top">
      <span className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${getColorClasses()} ${getSizeClasses()}
        cursor-help hover:opacity-80 transition-opacity
        ${risk === 'high' ? 'animate-pulse' : ''}
      `}>
        {showIcon && getIcon()}
        <span>{getRiskLabel()}</span>
      </span>
    </TooltipWrapper>
  )
}