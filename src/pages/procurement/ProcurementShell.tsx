// src/pages/procurement/ProcurementShell.tsx
// Skalet för den fristående upphandlingsportalen: topprad med logotyp,
// flikrad, notisklocka (bara upphandlingsnotiser), temaväxlare, Mitt konto och
// Logga ut. Ingen admin-sidomeny och inga andra portaldelar. Släpper bara in
// profiler med admin eller is_procurement_manager; övriga får ett vänligt nej.

import { Suspense } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { hasProcurementAccess } from '../../hooks/useProcurementAccess'
import { useProcurementBadge } from '../../hooks/useProcurementBadge'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { ThemeToggle } from '../../components/shared/ThemeToggle'
import { ProcurementNotificationBell } from '../../components/procurement/ProcurementNotificationBell'
import Button from '../../components/ui/Button'
import { ProcurementBrand } from './ProcurementBrand'
import { PROCUREMENT_TABS } from './procurementTabs'

function NoAccess({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <ProcurementBrand size="lg" />
        <div className="mt-6 border border-slate-800 rounded-xl p-5 bg-slate-900/40">
          <h1 className="text-[15px] font-semibold text-slate-100">Du har inte åtkomst hit</h1>
          <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">
            Upphandlingsbevakningen är öppen för administratörer och upphandlingsansvariga.
            {email ? <> Du är inloggad som <span className="text-slate-200">{email}</span>.</> : null} Be en administratör sätta
            Upphandlingsansvarig på ditt personkort under Användarkonton (Personal) om du behöver åtkomst.
          </p>
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onSignOut}>
              <LogOut className="w-4 h-4 mr-1.5" />
              Logga ut
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProcurementShell() {
  const { profile, user, loading, signOut } = useAuth()
  const unread = useProcurementBadge()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar..." />
      </div>
    )
  }
  if (!user || !profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!hasProcurementAccess(profile)) return <NoAccess email={profile.email ?? user.email ?? null} onSignOut={() => void signOut()} />

  const name = profile.display_name || profile.email?.split('@')[0] || 'Mitt konto'

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-14">
            <NavLink to="/" className="min-w-0" aria-label="Upphandlingsbevakning, startsidan">
              <ProcurementBrand />
            </NavLink>
            <div className="ml-auto flex items-center gap-1">
              <ProcurementNotificationBell />
              <ThemeToggle />
              <NavLink
                to="/mitt-konto"
                className={({ isActive }) =>
                  `hidden sm:inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors ${isActive ? 'text-slate-100 bg-slate-800' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`
                }
                title="Mitt konto"
              >
                <UserRound className="w-4 h-4" />
                <span className="max-w-[140px] truncate">{name}</span>
              </NavLink>
              <NavLink to="/mitt-konto" className="sm:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100" aria-label="Mitt konto">
                <UserRound className="w-[18px] h-[18px]" />
              </NavLink>
              <button
                type="button"
                onClick={() => void signOut()}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
                aria-label="Logga ut"
                title="Logga ut"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
          <nav className="flex gap-5 overflow-x-auto -mb-px" aria-label="Upphandlingsbevakning">
            {PROCUREMENT_TABS.map((t) => (
              <NavLink
                key={t.sub}
                to={t.sub || '/'}
                end={t.end}
                className={({ isActive }) =>
                  `relative pb-2.5 pt-1 text-sm whitespace-nowrap transition-colors border-b-2 ${
                    isActive ? 'border-[#20c58f] text-slate-100 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                {t.label}
                {t.label === 'Bevakning' && unread > 0 && <span className="ml-1.5 text-[11px] tabular-nums text-amber-400">{unread}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Suspense
          fallback={
            <div className="py-16 flex justify-center">
              <LoadingSpinner />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
