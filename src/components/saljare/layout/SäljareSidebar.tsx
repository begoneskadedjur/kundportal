// src/components/saljare/layout/SäljareSidebar.tsx
import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Target,
  HelpCircle,
  Bug,
} from 'lucide-react'
import { BugReportModal } from '../../shared/BugReportModal'
import { topLevelItems, navGroups } from './saljareNavConfig'
import { SidebarNavGroup } from '../../admin/layout/SidebarNavGroup'

interface SäljareSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  currentPath: string
  userName: string
  onSignOut: () => void
}

export function SäljareSidebar({
  collapsed,
  onToggleCollapse,
  currentPath,
  userName,
  onSignOut,
}: SäljareSidebarProps) {
  const [showBugModal, setShowBugModal] = useState(false)

  return (
    <>
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
              <p className="text-slate-500 text-xs">Säljare</p>
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

      {/* CTA Button - Ny Lead */}
      <div className="px-3 pt-3">
        {collapsed ? (
          <Link
            to="/saljare/leads"
            className="w-full flex items-center justify-center p-2.5 bg-teal-500 hover:bg-teal-400 rounded-xl transition-colors duration-200 shadow-lg shadow-teal-500/25"
            title="Ny Lead"
          >
            <Target className="w-5 h-5 text-white" />
          </Link>
        ) : (
          <Link
            to="/saljare/leads"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-colors duration-200 shadow-lg shadow-teal-500/25"
          >
            <Target className="w-4 h-4" />
            <span className="text-sm">Ny Lead</span>
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

        {/* Rapportera bugg */}
        <button
          onClick={() => setShowBugModal(true)}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Rapportera bugg' : undefined}
        >
          <Bug className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Rapportera bugg</span>}
        </button>

        {/* Help center */}
        <Link
          to="/saljare/larosate"
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

    {collapsed && (
      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex fixed left-20 top-1/2 -translate-y-1/2 z-50 w-5 h-8 bg-slate-700 hover:bg-slate-600 rounded-r-lg items-center justify-center transition-colors"
        aria-label="Expandera sidopanelen"
      >
        <ChevronRight className="w-3 h-3 text-slate-400" />
      </button>
    )}

    <BugReportModal isOpen={showBugModal} onClose={() => setShowBugModal(false)} />
    </>
  )
}
