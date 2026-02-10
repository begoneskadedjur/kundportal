// src/components/admin/layout/AdminMobileNav.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Menu, X, LogOut } from 'lucide-react'
import { topLevelItems, navGroups, mobileBottomItems } from './adminNavConfig'
import { MobileNavGroup } from './MobileNavGroup'

interface AdminMobileNavProps {
  currentPath: string
  onSignOut: () => void
}

export function AdminMobileNav({ currentPath, onSignOut }: AdminMobileNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
            <span className="text-white font-bold text-xs">BG</span>
          </div>
          <p className="text-white font-semibold text-sm">BeGone</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 relative" aria-label="Notifieringar">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">3</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Meny"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile slide-out menu */}
      <div
        className={`
          lg:hidden fixed top-14 right-0 w-72 h-[calc(100%-3.5rem-4rem)] bg-slate-900/95 backdrop-blur-xl
          border-l border-slate-700/50 z-30 transition-transform duration-300 overflow-y-auto
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <nav className="p-3 space-y-1">
          {topLevelItems.map(item => {
            const Icon = item.icon
            const isActive = currentPath === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                  ${isActive ? 'bg-teal-500/15 text-teal-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
          <div className="h-px bg-slate-700/50 my-3" />
          {navGroups.map(group => (
            <MobileNavGroup key={group.label} group={group} currentPath={currentPath} onNavigate={() => setMobileMenuOpen(false)} />
          ))}
          <div className="h-px bg-slate-700/50 my-3" />
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Logga ut</span>
          </button>
        </nav>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 z-40 px-2 flex items-center justify-around safe-area-bottom">
        {mobileBottomItems.map(item => {
          const Icon = item.icon
          const isActive = currentPath === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${isActive ? 'text-teal-400' : 'text-slate-500'}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg text-slate-500">
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mer</span>
        </button>
      </nav>
    </>
  )
}
