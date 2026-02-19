// src/components/coordinator/layout/CoordinatorLayout.tsx
// Orkestrator-komponent som wrappar alla koordinator-routes med sidebar + top header
import { useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { CoordinatorSidebar } from './CoordinatorSidebar'
import { CoordinatorTopHeader } from './CoordinatorTopHeader'
import { CoordinatorMobileNav } from './CoordinatorMobileNav'

export default function CoordinatorLayout() {
  const { profile, signOut, loading } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar..." />
      </div>
    )
  }

  // Rollkontroll — koordinator + admin har tillgång
  const hasAccess = profile?.role === 'koordinator' || profile?.role === 'admin' || profile?.is_admin === true
  if (!profile || !hasAccess) {
    return <Navigate to="/login" replace />
  }

  const currentPath = location.pathname
  const userName = profile?.display_name || profile?.email?.split('@')[0] || 'Koordinator'

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient glow */}
      <div className="fixed top-0 left-64 w-[600px] h-[600px] bg-teal-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Desktop sidebar */}
      <CoordinatorSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentPath={currentPath}
        userName={userName}
        onSignOut={handleSignOut}
      />

      {/* Mobile nav (header + drawer + bottom tabs) */}
      <CoordinatorMobileNav
        currentPath={currentPath}
        onSignOut={handleSignOut}
      />

      {/* Desktop top header */}
      <CoordinatorTopHeader
        sidebarCollapsed={sidebarCollapsed}
        userName={userName}
      />

      {/* Main content area */}
      <main
        className={`
          min-h-screen pt-14 pb-20 lg:pb-0
          transition-all duration-300
          ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
          lg:pt-12
        `}
      >
        <Outlet />
      </main>
    </div>
  )
}
