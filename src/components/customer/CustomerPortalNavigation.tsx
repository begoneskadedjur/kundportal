// src/components/customer/CustomerPortalNavigation.tsx - Navigation for Customer Portal
import React from 'react'
import { BarChart3, Home, LogOut, FileText, Building2, Receipt, MapPin } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMultisite } from '../../contexts/MultisiteContext'
import Button from '../ui/Button'

interface CustomerPortalNavigationProps {
  currentView: 'dashboard' | 'equipment' | 'statistics' | 'reports' | 'quotes'
  onViewChange: (view: 'dashboard' | 'equipment' | 'statistics' | 'reports' | 'quotes') => void
  customerName: string
}

const CustomerPortalNavigation: React.FC<CustomerPortalNavigationProps> = ({
  currentView,
  onViewChange,
  customerName
}) => {
  const { signOut } = useAuth()
  const { userRole: multisiteRole, organization } = useMultisite()

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Company Name */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">BG</span>
              </div>
              <span className="text-white font-semibold">BeGone</span>
            </div>
            <div className="h-6 w-px bg-slate-600"></div>
            <span className="text-slate-300 text-sm">
              {customerName}
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            {/* Multisite Portal Link (if user has access) - More prominent styling */}
            {multisiteRole && organization && (
              <a
                href="/multisite"
                className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-purple-500/25"
              >
                <Building2 className="w-4 h-4" />
                Multisite-portal
                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {multisiteRole === 'verksamhetschef' ? 'Verksamhet' : 
                   multisiteRole === 'regionchef' ? 'Region' : 
                   'Plats'}
                </span>
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
              onClick={() => onViewChange('equipment')}
              className={`
                px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200
                ${currentView === 'equipment'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <MapPin className="w-4 h-4" />
              Utrustning
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
              onClick={() => onViewChange('quotes')}
              className={`
                px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200
                ${currentView === 'quotes'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <Receipt className="w-4 h-4" />
              Offerter
            </button>
          </div>

          {/* Sign Out */}
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
  )
}

export default CustomerPortalNavigation