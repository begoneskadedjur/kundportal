// src/components/säljare/layout/SäljareLayout.tsx
// Orkestrator-komponent som wrappar alla säljare-routes med sidebar + top header
import { useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { SäljareSidebar } from './SäljareSidebar'
import { SäljareTopHeader } from './SäljareTopHeader'
import { SäljareMobileNav } from './SäljareMobileNav'

export default function SäljareLayout() {
  const { profile, signOut, loading } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Rollkontroll — säljare + admin har tillgång
  const hasAccess = !loading && (profile?.role === 'säljare' || profile?.role === 'admin' || profile?.is_admin === true)

  // Redirect om auth klar men ingen tillgång
  if (!loading && (!profile || !hasAccess)) {
    return <Navigate to="/login" replace />
  }

  const currentPath = location.pathname
  const userName = profile?.display_name || profile?.email?.split('@')[0] || 'Säljare'

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient glow */}
      <div className="fixed top-0 left-64 w-[600px] h-[600px] bg-teal-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Desktop sidebar */}
      <SäljareSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentPath={currentPath}
        userName={userName}
        onSignOut={handleSignOut}
      />

      {/* Mobile nav (header + drawer + bottom tabs) */}
      <SäljareMobileNav
        currentPath={currentPath}
        onSignOut={handleSignOut}
      />

      {/* Desktop top header */}
      <SäljareTopHeader
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner text="Laddar..." />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
