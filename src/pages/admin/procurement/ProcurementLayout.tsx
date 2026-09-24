// src/pages/admin/procurement/ProcurementLayout.tsx
// Ram för upphandlingsportalen under /admin/upphandlingar: åtkomstkontroll
// (admin eller profiles.is_procurement_manager), rubrik och egen flikrad.
// Flikarna följer planens avsnitt 9. Detaljsidan för en upphandling
// (/admin/upphandlingar/:noticeId) visas utan aktiv flik.
//
// Plan: docs/upphandlingsportal-plan.md

import { Suspense } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { Gavel } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { useProcurementAccess } from '../../../hooks/useProcurementAccess'
import { useProcurementBadge } from '../../../hooks/useProcurementBadge'

const TABS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/admin/upphandlingar', label: 'Marknad', end: true },
  { to: '/admin/upphandlingar/bevakning', label: 'Bevakning' },
  { to: '/admin/upphandlingar/avtalsklocka', label: 'Avtalsklocka' },
  { to: '/admin/upphandlingar/signaler', label: 'Signaler' },
  { to: '/admin/upphandlingar/kopare', label: 'Köpare' },
  { to: '/admin/upphandlingar/konkurrenter', label: 'Konkurrenter' },
  { to: '/admin/upphandlingar/installningar', label: 'Inställningar' },
]

export default function ProcurementLayout() {
  const { allowed, loading } = useProcurementAccess()
  const unread = useProcurementBadge()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }
  if (!allowed) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-1">
          <Gavel className="w-4 h-4 text-[#20c58f]" />
          <h1 className="text-lg font-semibold text-slate-100">Upphandlingar</h1>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Offentliga upphandlingar inom skadedjursbekämpning: bevakning, marknad, avtalsklocka och anbudsarbete.
        </p>

        <nav className="flex gap-5 border-b border-slate-800 mb-6 overflow-x-auto" aria-label="Upphandlingar">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `relative -mb-px pb-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${
                  isActive ? 'border-[#20c58f] text-slate-100 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`
              }
            >
              {t.label}
              {t.label === 'Bevakning' && unread > 0 && (
                <span className="ml-1.5 text-[11px] tabular-nums text-amber-400">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <Suspense
          fallback={
            <div className="py-16 flex justify-center">
              <LoadingSpinner />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
