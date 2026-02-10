// src/components/admin/layout/AdminTopHeader.tsx
import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Search, RefreshCw, Bell } from 'lucide-react'
import { breadcrumbMap } from './adminNavConfig'
import { useAuth } from '../../../contexts/AuthContext'
import { getTicketStats } from '../../../services/communicationService'

interface AdminTopHeaderProps {
  sidebarCollapsed: boolean
  userName: string
}

export function AdminTopHeader({ sidebarCollapsed, userName }: AdminTopHeaderProps) {
  const location = useLocation()
  const { profile } = useAuth()
  const currentLabel = breadcrumbMap[location.pathname] || 'Översikt'
  const [ticketCount, setTicketCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return
    getTicketStats(profile.id).then(stats => {
      setTicketCount(stats.open)
    }).catch(() => {})
  }, [profile?.id])

  return (
    <header
      className={`
        hidden lg:flex fixed top-0 right-0 h-12 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/30
        z-30 items-center justify-between px-6 transition-all duration-300
        ${sidebarCollapsed ? 'left-20' : 'left-64'}
      `}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-slate-400">BeGone</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-white font-medium">{currentLabel}</span>
      </div>

      {/* Centered search */}
      <button
        className="flex-1 max-w-md mx-auto flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/60 ring-1 ring-slate-700/50 hover:ring-slate-600 text-slate-400 transition-all duration-200"
        aria-label="Sök"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Sök i systemet...</span>
        <kbd className="ml-auto text-[10px] bg-slate-700/50 text-slate-500 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {/* Right side icons */}
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors" aria-label="Synka data" title="Synka data">
          <RefreshCw className="w-4 h-4" />
        </button>
        <Link to="/admin/tickets" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors relative" aria-label="Notifieringar">
          <Bell className="w-5 h-5" />
          {ticketCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
              {ticketCount > 9 ? '9+' : ticketCount}
            </span>
          )}
        </Link>
        <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
          <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
        </div>
      </div>
    </header>
  )
}
