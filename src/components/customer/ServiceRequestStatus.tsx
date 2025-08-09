// src/components/customer/ServiceRequestStatus.tsx - Visual Status Indicator
import React from 'react'
import { Clock, Calendar, Wrench, CheckCircle, XCircle, AlertCircle, FileText, Eye } from 'lucide-react'
import { ClickUpStatus, STATUS_CONFIG, getStatusColor, getCustomerStatusDisplay } from '../../types/database'

interface ServiceRequestStatusProps {
  status: ClickUpStatus | string
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
  // Get status config from database types
  const statusName = status as ClickUpStatus
  const statusInfo = STATUS_CONFIG[statusName]
  const statusColor = statusInfo ? statusInfo.color : '#87909e'
  
  // Use customer-facing display name
  const customerDisplayName = getCustomerStatusDisplay(statusName)
  
  // Create config for backward compatibility
  const config = {
    label: customerDisplayName, // Use customer-friendly name
    color: statusColor,
    bgColor: `bg-[${statusColor}]/10`,
    borderColor: `border-[${statusColor}]/20`,
    textColor: `text-[${statusColor}]`
  }
  
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
    switch (statusName) {
      case 'Öppen':
        return <Clock className={`${iconSizes[size]} animate-pulse`} />
      case 'Bokad':
      case 'Bokat':
        return <Calendar className={iconSizes[size]} />
      case 'Offert skickad':
        return <FileText className={iconSizes[size]} />
      case 'Offert signerad - boka in':
        return <CheckCircle className={iconSizes[size]} />
      case 'Återbesök 1':
      case 'Återbesök 2':
      case 'Återbesök 3':
      case 'Återbesök 4':
      case 'Återbesök 5':
        return <Wrench className={`${iconSizes[size]} animate-spin-slow`} />
      case 'Privatperson - review':
        return <Eye className={iconSizes[size]} />
      case 'Avslutat':
        return <CheckCircle className={iconSizes[size]} />
      case 'Stängt - slasklogg':
        return <XCircle className={iconSizes[size]} />
      // Legacy statuses
      case 'Bomkörning':
      case 'Generera saneringsrapport':
      case 'Ombokning':
      case 'Reklamation':
        return <AlertCircle className={iconSizes[size]} />
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
      
      {/* Additional info for scheduled/ongoing status */}
      {(statusName === 'Bokad' || statusName === 'Bokat' || 
        statusName === 'Återbesök 1' || statusName === 'Återbesök 2' || 
        statusName === 'Återbesök 3' || statusName === 'Återbesök 4' || statusName === 'Återbesök 5') && scheduledDate && (
        <div className="text-xs text-slate-400 ml-1">
          <div>{formatScheduledDate(scheduledDate)}</div>
          {technicianName && (
            <div className="text-slate-500">Tekniker: {technicianName}</div>
          )}
        </div>
      )}
      
      {/* Response time for requested status */}
      {statusName === 'Öppen' && (
        <div className="text-xs text-amber-400/80 ml-1 animate-pulse">
          Svar inom 24h
        </div>
      )}
      
      {/* Progress indicator for ongoing work */}
      {(statusName === 'Återbesök 1' || statusName === 'Återbesök 2' || 
        statusName === 'Återbesök 3' || statusName === 'Återbesök 4' || statusName === 'Återbesök 5') && (
        <div className="text-xs text-blue-400/80 ml-1">
          Arbete pågår
        </div>
      )}
    </div>
  )
}

export default ServiceRequestStatus