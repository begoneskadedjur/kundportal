// src/components/technician/layout/TechnicianLayout.tsx
// Orkestrator-komponent som wrappar alla tekniker-routes med sidebar + top header + mobile nav
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { TechnicianSidebar } from './TechnicianSidebar'
import { TechnicianTopHeader } from './TechnicianTopHeader'
import { TechnicianMobileNav } from './TechnicianMobileNav'

export default function TechnicianLayout() {
  const { profile, signOut, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar..." />
      </div>
    )
  }

  const hasTechnicianAccess = profile?.role === 'technician' || profile?.role === 'admin' || profile?.role === 'koordinator'
  if (!profile || !hasTechnicianAccess) {
    return <Navigate to="/login" replace />
  }

  const currentPath = location.pathname
  const userName = profile?.display_name || profile?.email?.split('@')[0] || 'Tekniker'

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient glow */}
      <div className="fixed top-0 left-64 w-[600px] h-[600px] bg-teal-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Desktop sidebar (always w-64, no collapse) */}
      <TechnicianSidebar
        currentPath={currentPath}
        userName={userName}
        onSignOut={handleSignOut}
      />

      {/* Mobile nav (header + drawer + bottom tabs) */}
      <TechnicianMobileNav
        currentPath={currentPath}
        onSignOut={handleSignOut}
      />

      {/* Desktop top header */}
      <TechnicianTopHeader userName={userName} />

      {/* Main content area */}
      <main className="min-h-screen pt-14 pb-20 lg:pb-0 lg:pl-64 lg:pt-12 transition-all duration-300">
        <Outlet />
      </main>
    </div>
  )
}
