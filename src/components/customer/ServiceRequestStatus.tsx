// src/components/customer/ServiceRequestStatus.tsx - Visual Status Indicator
import React from 'react'
import { Clock, Calendar, Wrench, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { CaseStatus, caseStatusConfig } from '../../types/cases'

interface ServiceRequestStatusProps {
  status: CaseStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
  scheduledDate?: string | null
  technicianName?: string | null
}

const ServiceRequestStatus: React.FC<ServiceRequestStatusProps> = ({ 
  status, 
  size = 'md', 
  showLabel = true,
  className = '',
  scheduledDate,
  technicianName
}) => {
  const config = caseStatusConfig[status]
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  const getIcon = () => {
    switch (status) {
      case 'requested':
        return <Clock className={`${iconSizes[size]} animate-pulse`} />
      case 'scheduled':
        return <Calendar className={iconSizes[size]} />
      case 'in_progress':
        return <Wrench className={`${iconSizes[size]} animate-spin-slow`} />
      case 'completed':
        return <CheckCircle className={iconSizes[size]} />
      case 'cancelled':
        return <XCircle className={iconSizes[size]} />
      default:
        return <AlertCircle className={iconSizes[size]} />
    }
  }

  const formatScheduledDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('sv-SE', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <div className={`
        inline-flex items-center gap-2 rounded-lg border font-medium
        ${config.bgColor} ${config.borderColor} ${config.textColor}
        ${sizeClasses[size]}
        transition-all duration-200 hover:scale-105
      `}>
        {getIcon()}
        {showLabel && <span>{config.label}</span>}
      </div>
      
      {/* Additional info for scheduled status */}
      {status === 'scheduled' && scheduledDate && (
        <div className="text-xs text-slate-400 ml-1">
          <div>{formatScheduledDate(scheduledDate)}</div>
          {technicianName && (
            <div className="text-slate-500">Tekniker: {technicianName}</div>
          )}
        </div>
      )}
      
      {/* Response time for requested status */}
      {status === 'requested' && (
        <div className="text-xs text-amber-400/80 ml-1 animate-pulse">
          Svar inom 24h
        </div>
      )}
    </div>
  )
}

export default ServiceRequestStatus