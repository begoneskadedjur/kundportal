// src/utils/priorityMapper.ts
// Prioritetsmappning med ClickUps exakta färger och svenska text

export interface PriorityConfig {
  swedishText: string
  color: string
  bgColor: string
  flagColor: string
  order: number
}

// ClickUps officiella prioritetsfärger och mappning till svenska
export const PRIORITY_MAPPING: { [key: string]: PriorityConfig } = {
  'urgent': {
    swedishText: 'Akut',
    color: '#f87171', // ClickUps röda färg
    bgColor: 'bg-red-500',
    flagColor: 'text-red-500', // För Lucide Flag ikon
    order: 1
  },
  'high': {
    swedishText: 'Hög',
    color: '#fb923c', // ClickUps orange färg  
    bgColor: 'bg-orange-500',
    flagColor: 'text-orange-500', // För Lucide Flag ikon
    order: 2
  },
  'normal': {
    swedishText: 'Normal',
    color: '#60a5fa', // ClickUps blå färg
    bgColor: 'bg-blue-500',
    flagColor: 'text-blue-500', // För Lucide Flag ikon
    order: 3
  },
  'low': {
    swedishText: 'Låg',
    color: '#9ca3af', // ClickUps grå färg
    bgColor: 'bg-gray-500',
    flagColor: 'text-gray-500', // För Lucide Flag ikon
    order: 4
  }
}

// Funktion för att hämta prioritetskonfiguration
export function getPriorityConfig(priority: string | null): PriorityConfig {
  if (!priority) {
    return PRIORITY_MAPPING['normal'] // Default
  }
  
  const priorityLower = priority.toLowerCase()
  return PRIORITY_MAPPING[priorityLower] || PRIORITY_MAPPING['normal']
}

// React-komponent för prioritetsvisning
import React from 'react'
import { Flag } from 'lucide-react'

interface PriorityBadgeProps {
  priority: string | null
  size?: 'sm' | 'md' | 'lg'
  showFlag?: boolean
  showText?: boolean
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ 
  priority, 
  size = 'md',
  showFlag = true,
  showText = true
}) => {
  const config = getPriorityConfig(priority)
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm', 
    lg: 'px-4 py-2 text-base'
  }
  
  const flagSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }
  
  return (
    <span 
      className={`inline-flex items-center gap-1.5 rounded-full font-medium text-white ${sizeClasses[size]}`}
      style={{ backgroundColor: config.color }}
    >
      {showFlag && (
        <Flag className={`${flagSizes[size]} ${config.flagColor}`} fill="currentColor" />
      )}
      {showText && <span>{config.swedishText}</span>}
    </span>
  )
}

// Hjälpfunktion för att sortera tasks efter prioritet
export function sortTasksByPriority<T extends { priority?: { priority: string } | null }>(
  tasks: T[]
): T[] {
  return tasks.sort((a, b) => {
    const priorityA = a.priority?.priority || 'normal'
    const priorityB = b.priority?.priority || 'normal'
    
    const configA = getPriorityConfig(priorityA)
    const configB = getPriorityConfig(priorityB)
    
    return configA.order - configB.order
  })
}

// CSS-klass generator för prioritet
export function getPriorityClasses(priority: string | null) {
  const config = getPriorityConfig(priority)
  
  return {
    textColor: `text-white`,
    bgColor: config.bgColor,
    borderColor: `border-[${config.color}]`,
    customStyle: { 
      backgroundColor: config.color,
      color: 'white'
    }
  }
}