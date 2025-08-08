// src/components/admin/customers/PortalAccessBadge.tsx - Portal access status badge

import React from 'react'
import { UserCheck, UserPlus, UserX, Mail } from 'lucide-react'

interface PortalAccessBadgeProps {
  status: 'active' | 'pending' | 'none'
  size?: 'sm' | 'md' | 'lg'
}

export default function PortalAccessBadge({ status, size = 'md' }: PortalAccessBadgeProps) {
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

  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  switch (status) {
    case 'active':
      return (
        <span className={`
          inline-flex items-center gap-1.5 rounded-full font-medium
          bg-green-500/20 text-green-400 border border-green-500/30
          ${getSizeClasses()}
        `}>
          <UserCheck className={iconClass} />
          <span>Aktiv</span>
        </span>
      )
    
    case 'pending':
      return (
        <span className={`
          inline-flex items-center gap-1.5 rounded-full font-medium
          bg-blue-500/20 text-blue-400 border border-blue-500/30
          ${getSizeClasses()}
        `}>
          <Mail className={iconClass} />
          <span>Inbjuden</span>
        </span>
      )
    
    case 'none':
    default:
      return (
        <span className={`
          inline-flex items-center gap-1.5 rounded-full font-medium
          bg-slate-500/20 text-slate-400 border border-slate-500/30
          ${getSizeClasses()}
        `}>
          <UserX className={iconClass} />
          <span>Ej inbjuden</span>
        </span>
      )
  }
}