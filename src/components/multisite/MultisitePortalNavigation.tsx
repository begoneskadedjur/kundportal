// src/components/multisite/MultisitePortalNavigation.tsx - Navigation for Multisite Portal
import React from 'react'
import { BarChart3, Home, LogOut, FileText, Circle, RefreshCw, Building2, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { MultisiteUserRoleType } from '../../types/multisite'
import Button from '../ui/Button'

interface MultisitePortalNavigationProps {
  currentView: 'dashboard' | 'statistics' | 'reports' | 'traffic-light'
  onViewChange: (view: 'dashboard' | 'statistics' | 'reports' | 'traffic-light') => void
  organizationName: string
  userRole: MultisiteUserRoleType
  onRefresh: () => void
  refreshing: boolean
}

const MultisitePortalNavigation: React.FC<MultisitePortalNavigationProps> = ({
  currentView,
  onViewChange,
  organizationName,
  userRole,
  onRefresh,
  refreshing
}) => {
  const { signOut, profile } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  // Get role display name in Swedish
  const getRoleDisplayName = (role: MultisiteUserRoleType): string => {
    switch (role) {
      case 'verksamhetschef':
        return 'Verksamhetschef'
      case 'regionschef':
        return 'Regionschef'
      case 'platsansvarig':
        return 'Platsansvarig'
      default:
        return role
    }
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Organization Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">BG</span>
              </div>
              <span className="text-white font-semibold">BeGone</span>
            </div>
            <div className="h-6 w-px bg-slate-600"></div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 text-sm font-medium">
                {organizationName}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-600"></div>
            <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">
              {getRoleDisplayName(userRole)}
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            {/* Link back to Customer Portal (if applicable) */}
            {profile?.role === 'customer' && (
              <a
                href="/customer"
                className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
              >
                <User className="w-4 h-4" />
                Kundportal
              </a>
            )}
            <button
              onClick={() => onViewChange('dashboard')}
              className={`
                px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200
                ${currentView === 'dashboard'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <Home className="w-4 h-4" />
              Översikt
            </button>

            <button
              onClick={() => onViewChange('statistics')}
              className={`
                px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200
                ${currentView === 'statistics'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <BarChart3 className="w-4 h-4" />
              Statistik
            </button>

            <button
              onClick={() => onViewChange('reports')}
              className={`
                px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200
                ${currentView === 'reports'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <FileText className="w-4 h-4" />
              Rapporter
            </button>

            <button
              onClick={() => onViewChange('traffic-light')}
              className={`
                px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200
                ${currentView === 'traffic-light'
                  ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <Circle className="w-4 h-4" />
              Trafikljus
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onRefresh}
              disabled={refreshing}
              variant="secondary"
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border-slate-600 hover:border-slate-500"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              onClick={handleSignOut}
              variant="secondary"
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border-slate-600 hover:border-slate-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logga ut
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MultisitePortalNavigation