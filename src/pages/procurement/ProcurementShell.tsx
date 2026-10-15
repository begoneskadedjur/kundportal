// src/pages/procurement/ProcurementShell.tsx
// Skalet för den fristående upphandlingsportalen (docs/upphandlingsportal-ux-plan.md
// avsnitt 2 och 5): topprad med logotyp, fem huvudposter som understrukna
// tabbar, ikonknappar för sök, notiser (bara upphandlingsnotiser), tema och
// konto. På mobil blir huvudposterna en fast bottenrad. Undertabbarna visas
// under sidrubriken. Ingen admin-sidomeny och inga andra portaldelar. Släpper
// bara in profiler med admin eller is_procurement_manager; övriga får ett vänligt nej.

import { Suspense, useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { hasProcurementAccess } from '../../hooks/useProcurementAccess'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { Icon } from '../../components/icons/Icon'
import { ProcurementNotificationBell } from '../../components/procurement/ProcurementNotificationBell'
import { ProcurementSearch } from '../../components/procurement/ProcurementSearch'
import Button from '../../components/ui/Button'
import { ProcurementBrand } from './ProcurementBrand'
import { AccountMenu, BottomNav, MainNav, SectionHeader, ThemeButton } from './ProcurementNav'

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
              <Icon name="allman.logga-ut" className="w-4 h-4 mr-1.5" />
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
  const location = useLocation()

  // Fristående skal: egen fliktitel, annars ärvs "BeGone Kundportal" från index.html
  useEffect(() => {
    const previous = document.title
    document.title = 'Upphandlingsbevakning · BeGone'
    return () => { document.title = previous }
  }, [])

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
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-14">
            <Link to="/" className="min-w-0 lg:shrink-0" aria-label="Upphandlingsbevakning, Idag">
              <ProcurementBrand />
            </Link>
            <MainNav className="hidden lg:flex ml-2 min-w-0" />
            <div className="ml-auto flex items-center">
              <ProcurementSearch />
              <ProcurementNotificationBell />
              <ThemeButton />
              <AccountMenu name={name} onSignOut={() => void signOut()} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-8 pb-28 lg:pb-12">
        <SectionHeader />
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

      <BottomNav />
    </div>
  )
}
