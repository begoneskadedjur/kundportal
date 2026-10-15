// src/pages/admin/procurement/ProcurementLayout.tsx
// Ram för upphandlingsportalen under /admin/upphandlingar: åtkomstkontroll
// (admin eller profiles.is_procurement_manager), rubrik och egen flikrad.
// Sedan 3.63.0 samma två nivåer som den fristående portalen: fem huvudposter
// och undertabbar ur procurementTabs.ts (docs/upphandlingsportal-ux-plan.md).
//
// Sedan 2026-09-25 är upphandlingsportalen en fristående plattform på
// upphandling.begone.se (src/pages/procurement/ProcurementApp.tsx). Den här
// ramen finns kvar i adminportalen som reserv för utveckling.
//
// Plan: docs/upphandlingsportal-plan.md

import { Suspense } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { Icon } from '../../../components/icons/Icon'
import { ProcurementSearch } from '../../../components/procurement/ProcurementSearch'
import { useProcurementAccess } from '../../../hooks/useProcurementAccess'
import { PROCUREMENT_PORTAL_URL } from '../../../lib/procurementPortal'
import { MainNav, SectionHeader } from '../../procurement/ProcurementNav'

export default function ProcurementLayout() {
  const { allowed, loading } = useProcurementAccess()

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
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="upphandling.anbud" size={16} className="text-[#20c58f]" />
          <span className="text-lg font-semibold text-slate-100">Upphandlingar</span>
          <div className="ml-auto flex items-center gap-1">
            <ProcurementSearch />
            <a
              href={PROCUREMENT_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 min-h-[44px] text-[12px] text-slate-400 hover:text-[#20c58f]"
            >
              Öppna Upphandlingsbevakning
              <Icon name="rapport.oppna" className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="border-b border-slate-800 mb-8 overflow-x-auto">
          <MainNav />
        </div>

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
      </div>
    </div>
  )
}
