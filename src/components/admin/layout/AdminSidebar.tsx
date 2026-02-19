// src/components/admin/layout/AdminSidebar.tsx
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Plus,
  Star,
  HelpCircle,
  Wrench,
} from 'lucide-react'
import { topLevelItems, navGroups, favoriteItems } from './adminNavConfig'
import { SidebarNavGroup } from './SidebarNavGroup'
import { useAuth } from '../../../contexts/AuthContext'

interface AdminSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  currentPath: string
  userName: string
  onSignOut: () => void
}

export function AdminSidebar({
  collapsed,
  onToggleCollapse,
  currentPath,
  userName,
  onSignOut,
}: AdminSidebarProps) {
  const { hasDualRole, setActiveView } = useAuth()
  const navigate = useNavigate()

  const handleSwitchToTechnician = () => {
    setActiveView('technician')
    navigate('/technician/dashboard')
  }

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50
        hidden lg:flex flex-col z-40 transition-all duration-300
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* User Profile + Collapse toggle */}
      <div className={`px-3 py-3 border-b border-slate-700/50 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <button
            onClick={onToggleCollapse}
            className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center hover:scale-105 transition-all"
            title={userName}
          >
            <span className="text-white text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{userName}</p>
              <p className="text-slate-500 text-xs">Administrator</p>
            </div>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors flex-shrink-0"
              aria-label="Minimera sidopanelen"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Vy-växlare för dual-role användare */}
      {hasDualRole && (
        <div className={`px-3 py-2 border-b border-slate-700/50 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <button
              onClick={handleSwitchToTechnician}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-all"
              title="Byt till Tekniker-vy"
            >
              <Wrench className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSwitchToTechnician}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-all"
            >
              <Wrench className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Byt till Tekniker-vy</span>
            </button>
          )}
        </div>
      )}

      {/* CTA Button */}
      <div className="px-3 pt-3">
        {collapsed ? (
          <Link
            to="/admin/oneflow-contract-creator"
            className="w-full flex items-center justify-center p-2.5 bg-teal-500 hover:bg-teal-400 rounded-xl transition-colors duration-200 shadow-lg shadow-teal-500/25"
            title="Skapa avtal"
          >
            <Plus className="w-5 h-5 text-white" />
          </Link>
        ) : (
          <Link
            to="/admin/oneflow-contract-creator"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-colors duration-200 shadow-lg shadow-teal-500/25"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Skapa avtal</span>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        {/* Top-level items */}
        {topLevelItems.map(item => {
          const Icon = item.icon
          const isActive = currentPath === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 outline-none
                ${isActive
                  ? 'border-l-[3px] border-teal-400 text-white font-medium bg-teal-500/5'
                  : 'border-l-[3px] border-transparent text-slate-400 hover:text-white hover:bg-slate-800/30'
                }
                ${collapsed ? 'justify-center border-l-0' : ''}
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          )
        })}

        <div className="h-px bg-slate-700/50 my-3" />

        {/* Nav groups */}
        {navGroups.map(group => (
          <SidebarNavGroup
            key={group.label}
            group={group}
            collapsed={collapsed}
            currentPath={currentPath}
          />
        ))}

        {/* Separator before favorites */}
        <div className="h-px bg-slate-700/50 my-3" />

        {/* Favorites section */}
        {!collapsed && (
          <div>
            <p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Star className="w-3.5 h-3.5" />
              Favoriter
            </p>
            <div className="space-y-0.5 mt-1">
              {favoriteItems.map(item => {
                const Icon = item.icon
                const isActive = currentPath.startsWith(item.path)
                return (
                  <Link
                    key={`fav-${item.path}`}
                    to={item.path}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm
                      focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
                      ${isActive
                        ? 'text-teal-400 bg-teal-500/5'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
        {collapsed && (
          <button
            className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl text-slate-500 hover:text-amber-400 transition-colors"
            title="Favoriter"
          >
            <Star className="w-5 h-5" />
          </button>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-slate-700/50 space-y-1">
        {/* Search trigger */}
        {!collapsed ? (
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors" aria-label="Sök">
            <Search className="w-4 h-4" />
            <span className="text-sm">Sök...</span>
            <kbd className="ml-auto text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        ) : (
          <button
            className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
            title="Sök (Cmd+K)"
            aria-label="Sök"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        {/* Help center */}
        <Link
          to="/admin/larosate"
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors
            focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Hjälpcenter' : undefined}
        >
          <HelpCircle className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Hjälpcenter</span>}
        </Link>

        {/* Sign out */}
        <button
          onClick={onSignOut}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
            text-slate-400 hover:text-red-400 hover:bg-red-500/10
            focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Logga ut' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-medium">Logga ut</span>
          )}
        </button>
      </div>
    </aside>
  )
}
