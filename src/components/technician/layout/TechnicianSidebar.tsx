// src/components/technician/layout/TechnicianSidebar.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Bug } from 'lucide-react'
import { BugReportModal } from '../../shared/BugReportModal'
import { ViewSwitcher } from '../../shared/ViewSwitcher'
import { IntranetLink } from '../../shared/IntranetLink'
import { ReportIncidentButton } from '../../shared/ReportIncidentButton'
import { topLevelItems, navGroups } from './technicianNavConfig'
import { SidebarNavGroup } from '../../admin/layout/SidebarNavGroup'

interface TechnicianSidebarProps {
  currentPath: string
  userName: string
  onSignOut: () => void
}

export function TechnicianSidebar({ currentPath, userName, onSignOut }: TechnicianSidebarProps) {
  const [showBugModal, setShowBugModal] = useState(false)

  return (
    <>
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 hidden lg:flex flex-col z-40">
      {/* User Profile */}
      <div className="px-3 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-[#fff] text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{userName}</p>
            <p className="text-slate-500 text-xs">Tekniker</p>
          </div>
        </div>
      </div>

      {/* Vy-växlare för användare med flera portalroller */}
      <ViewSwitcher currentView="technician" />

      {/* Rapportera tillbud/olycka/avvikelse */}
      <div className="px-3 pt-3">
        <ReportIncidentButton role="technician" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        {/* Top-level: Översikt */}
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
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          )
        })}

        <div className="h-px bg-slate-700/50 my-3" />

        {/* Nav groups */}
        {navGroups.map(group => (
          <SidebarNavGroup
            key={group.label}
            group={group}
            collapsed={false}
            currentPath={currentPath}
          />
        ))}
      </nav>

      {/* Bottom: Intranät + Bug report + Sign out */}
      <div className="p-3 border-t border-slate-700/50 space-y-1">
        <IntranetLink basePath="/technician" />
        <button
          onClick={() => setShowBugModal(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
        >
          <Bug className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">Rapportera bugg</span>
        </button>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-red-400 hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-teal-400 outline-none"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Logga ut</span>
        </button>
      </div>
    </aside>

    <BugReportModal isOpen={showBugModal} onClose={() => setShowBugModal(false)} />
    </>
  )
}
