// src/components/technician/layout/TechnicianTopHeader.tsx
import { useState, useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Bell, Shield } from 'lucide-react'
import { breadcrumbMap } from './technicianNavConfig'
import { useAuth } from '../../../contexts/AuthContext'
import { getTicketStats } from '../../../services/communicationService'

interface TechnicianTopHeaderProps {
  userName: string
}

export function TechnicianTopHeader({ userName }: TechnicianTopHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, hasDualRole, setActiveView } = useAuth()
  const currentLabel = breadcrumbMap[location.pathname] || 'Översikt'
  const [ticketCount, setTicketCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return
    getTicketStats(profile.id).then(stats => {
      setTicketCount(stats.open)
    }).catch(() => {})
  }, [profile?.id])

  return (
    <header className="hidden lg:flex fixed top-0 right-0 left-64 h-12 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/30 z-30 items-center justify-between px-6">
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
        <Link to="/technician/tickets" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors relative" aria-label="Notifieringar">
          <Bell className="w-5 h-5" />
          {ticketCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
              {ticketCount > 9 ? '9+' : ticketCount}
            </span>
          )}
        </Link>
        {hasDualRole && (
          <button
            onClick={() => { setActiveView('admin'); navigate('/admin/dashboard') }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-all"
            title="Byt till Admin-vy"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Admin-vy</span>
          </button>
        )}
        <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
          <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
        </div>
      </div>
    </header>
  )
}
