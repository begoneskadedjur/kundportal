// src/components/organisation/OrganisationNavigation.tsx - Gemensam navigation för organisationsportalen
import React from 'react'
import { Home, BarChart3, Calendar, AlertTriangle, FileText, Settings, LogOut, User } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useMultisite } from '../../contexts/MultisiteContext'

interface NavigationTab {
  id: string
  label: string
  icon: React.ReactNode
  path: string
}

interface OrganisationNavigationProps {
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

const OrganisationNavigation: React.FC<OrganisationNavigationProps> = ({ userRoleType }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const { organization } = useMultisite()

  // Definiera tabs - alla roller har tillgång till alla sidor
  const getTabs = (): NavigationTab[] => {
    const basePath = `/organisation/${userRoleType}`
    
    return [
      {
        id: 'dashboard',
        label: 'Översikt',
        icon: <Home className="w-5 h-5" />,
        path: basePath
      },
      {
        id: 'statistics',
        label: 'Statistik',
        icon: <BarChart3 className="w-5 h-5" />,
        path: `${basePath}/statistik`
      },
      {
        id: 'cases',
        label: 'Ärenden',
        icon: <AlertTriangle className="w-5 h-5" />,
        path: `${basePath}/arenden`
      },
      {
        id: 'reports',
        label: 'Rapporter',
        icon: <FileText className="w-5 h-5" />,
        path: `${basePath}/rapporter`
      }
    ]
  }

  const tabs = getTabs()
  // Hitta aktiv tab genom att kolla om pathname börjar med tab path
  const currentTab = tabs.find(tab => {
    // För dashboard, matcha exakt
    if (tab.id === 'dashboard') {
      return location.pathname === tab.path
    }
    // För andra tabs, matcha om pathname börjar med tab path
    return location.pathname.startsWith(tab.path)
  }) || tabs[0]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getRoleName = () => {
    switch (userRoleType) {
      case 'verksamhetschef':
        return 'Verksamhetschef'
      case 'regionchef':
        return 'Regionchef'
      case 'platsansvarig':
        return 'Platsansvarig'
      default:
        return 'Organisation'
    }
  }

  return (
    <nav className="bg-slate-900/50 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo och organisation */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">BG</span>
              </div>
              <div>
                <h1 className="text-white font-semibold">BeGone</h1>
                <p className="text-xs text-slate-400">{getRoleName()}</p>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-700" />
            
            <div>
              <p className="text-sm text-white font-medium">{organization?.organization_name}</p>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                  ${currentTab.id === tab.id 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                {tab.icon}
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Min profil"
            >
              <User className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate(`/organisation/${userRoleType}/installningar`)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Inställningar"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Logga ut</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default OrganisationNavigation