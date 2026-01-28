// src/components/customer/CustomerPortalLayout.tsx
// Modern layout med sidebar på desktop och bottom navigation på mobil

import React, { useState } from 'react'
import {
  Home,
  LogOut,
  FileText,
  Building2,
  Receipt,
  ClipboardCheck,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMultisite } from '../../contexts/MultisiteContext'

export type CustomerPortalView = 'dashboard' | 'stations' | 'inspections' | 'cases' | 'reports' | 'quotes'

interface NavItem {
  id: CustomerPortalView
  label: string
  shortLabel: string
  icon: React.ElementType
  activeColor: string
  activeBg: string
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Översikt',
    shortLabel: 'Översikt',
    icon: Home,
    activeColor: 'text-emerald-400',
    activeBg: 'bg-emerald-500/20'
  },
  {
    id: 'stations',
    label: 'Fällor & stationer',
    shortLabel: 'Fällor',
    icon: MapPin,
    activeColor: 'text-emerald-400',
    activeBg: 'bg-emerald-500/20'
  },
  {
    id: 'inspections',
    label: 'Genomförda kontroller',
    shortLabel: 'Kontroller',
    icon: ClipboardCheck,
    activeColor: 'text-teal-400',
    activeBg: 'bg-teal-500/20'
  },
  {
    id: 'cases',
    label: 'Dina ärenden',
    shortLabel: 'Ärenden',
    icon: FileText,
    activeColor: 'text-cyan-400',
    activeBg: 'bg-cyan-500/20'
  },
  {
    id: 'reports',
    label: 'Rapporter',
    shortLabel: 'Rapporter',
    icon: FileText,
    activeColor: 'text-blue-400',
    activeBg: 'bg-blue-500/20'
  },
  {
    id: 'quotes',
    label: 'Offerter',
    shortLabel: 'Offerter',
    icon: Receipt,
    activeColor: 'text-amber-400',
    activeBg: 'bg-amber-500/20'
  }
]

interface CustomerPortalLayoutProps {
  currentView: CustomerPortalView
  onViewChange: (view: CustomerPortalView) => void
  customerName: string
  children: React.ReactNode
}

export function CustomerPortalLayout({
  currentView,
  onViewChange,
  customerName,
  children
}: CustomerPortalLayoutProps) {
  const { signOut } = useAuth()
  const { userRole: multisiteRole, organization } = useMultisite()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* ===== DESKTOP SIDEBAR (hidden on mobile) ===== */}
      <aside
        className={`
          fixed left-0 top-0 h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50
          hidden lg:flex flex-col z-40 transition-all duration-300
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        {/* Logo & Company */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <span className="text-white font-bold text-sm">BG</span>
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-white font-semibold text-sm">BeGone</p>
                <p className="text-slate-400 text-xs truncate">{customerName}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {/* Multisite Link */}
          {multisiteRole && organization && (
            <a
              href="/multisite"
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30
                text-purple-300 hover:from-purple-600/30 hover:to-blue-600/30
                ${sidebarCollapsed ? 'justify-center' : ''}
              `}
              title={sidebarCollapsed ? 'Multisite-portal' : undefined}
            >
              <Building2 className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">Multisite-portal</span>
              )}
            </a>
          )}

          {/* Separator */}
          {multisiteRole && organization && (
            <div className="h-px bg-slate-700/50 my-3" />
          )}

          {/* Main Nav Items */}
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${isActive
                    ? `${item.activeBg} ${item.activeColor}`
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-slate-700/50 space-y-2">
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Minimera</span>
              </>
            )}
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
              text-slate-400 hover:text-red-400 hover:bg-red-500/10
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
            title={sidebarCollapsed ? 'Logga ut' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-sm font-medium">Logga ut</span>
            )}
          </button>
        </div>
      </aside>

      {/* ===== MOBILE HEADER (hidden on desktop) ===== */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 z-40 px-4 flex items-center justify-between">
        {/* Logo & Company */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-xs">BG</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">BeGone</p>
            <p className="text-slate-400 text-[10px] leading-tight truncate max-w-[150px]">{customerName}</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Multisite Link (if available) */}
          {multisiteRole && organization && (
            <a
              href="/multisite"
              className="p-2 rounded-lg bg-purple-600/20 text-purple-400"
            >
              <Building2 className="w-5 h-5" />
            </a>
          )}

          {/* Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Menu */}
      <div
        className={`
          lg:hidden fixed top-14 right-0 w-64 h-[calc(100%-3.5rem-4rem)] bg-slate-900/95 backdrop-blur-xl
          border-l border-slate-700/50 z-30 transition-transform duration-300 overflow-y-auto
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id

            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id)
                  setMobileMenuOpen(false)
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                  ${isActive
                    ? `${item.activeBg} ${item.activeColor}`
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            )
          })}

          {/* Divider */}
          <div className="h-px bg-slate-700/50 my-3" />

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Logga ut</span>
          </button>
        </nav>
      </div>

      {/* ===== MOBILE BOTTOM NAV (hidden on desktop) ===== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 z-40 px-2 flex items-center justify-around safe-area-bottom">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`
                flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all
                ${isActive
                  ? item.activeColor
                  : 'text-slate-500'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-medium">{item.shortLabel}</span>
            </button>
          )
        })}
        {/* More menu indicator */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg text-slate-500"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mer</span>
        </button>
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main
        className={`
          min-h-screen
          pt-14 pb-20 lg:pt-0 lg:pb-0
          transition-all duration-300
          ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
        `}
      >
        {children}
      </main>
    </div>
  )
}

export default CustomerPortalLayout
