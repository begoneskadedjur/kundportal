// src/pages/shared/IntranetPage.tsx
// Intranät - skal med undernav och interna routes.
// Monteras som `intranat/*` under varje rollprefix, så alla undersidor
// delar rollens sidofält och header.
//
// Start        - hero, anslag, att göra, snabblänkar, KMA, onboarding
// Policys      - obligatoriska dokument grupperade per kategori
// Handbok      - guider med sök och kategorifilter
// Kontakter    - personkort + ansvarsroller
// Kvittenser   - adminens läsmatris
// :slug        - dokument-/guideläsare

import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import {
  Home,
  ShieldCheck,
  BookOpen,
  Users,
  ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useRoleBasePath } from '../../hooks/useRoleBasePath'
import IntranetStart from './intranet/IntranetStart'
import IntranetPolicys from './intranet/IntranetPolicys'
import IntranetHandbok from './intranet/IntranetHandbok'
import IntranetKontakter from './intranet/IntranetKontakter'
import IntranetDocumentPage from './IntranetDocumentPage'
import IntranetAckMatrix from '../../components/admin/intranet/IntranetAckMatrix'

function Subnav({ basePath, isAdmin }: { basePath: string; isAdmin: boolean }) {
  const tabs = [
    { to: `${basePath}/intranat`, label: 'Start', icon: Home, end: true },
    { to: `${basePath}/intranat/policys`, label: 'Policys & rutiner', icon: ShieldCheck, end: false },
    { to: `${basePath}/intranat/handbok`, label: 'Handbok', icon: BookOpen, end: false },
    { to: `${basePath}/intranat/kontakter`, label: 'Kontakter', icon: Users, end: false },
    ...(isAdmin ? [{ to: `${basePath}/intranat/kvittenser`, label: 'Läskvittenser', icon: ClipboardCheck, end: false }] : []),
  ]
  return (
    <nav className="flex gap-1 p-1 bg-slate-800/50 border border-slate-700 rounded-xl w-fit max-w-full overflow-x-auto">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActive ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
            }`
          }
        >
          <tab.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{tab.label}</span>
          <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default function IntranetPage() {
  const { isAdmin } = useAuth()
  const basePath = useRoleBasePath()

  return (
    <Routes>
      {/* Dokumentläsaren har egen layout utan undernav */}
      <Route path="dokument/:slug" element={<IntranetDocumentPage />} />
      {/* Bakåtkompatibilitet: gamla direktlänkar /intranat/<slug> */}
      <Route path=":slug" element={<LegacySlugRedirect basePath={basePath} />} />
      <Route
        path=""
        element={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
            <Subnav basePath={basePath} isAdmin={isAdmin} />
            <IntranetStart />
          </div>
        }
      />
      <Route
        path="policys"
        element={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
            <Subnav basePath={basePath} isAdmin={isAdmin} />
            <IntranetPolicys />
          </div>
        }
      />
      <Route
        path="handbok"
        element={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
            <Subnav basePath={basePath} isAdmin={isAdmin} />
            <IntranetHandbok />
          </div>
        }
      />
      <Route
        path="kontakter"
        element={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
            <Subnav basePath={basePath} isAdmin={isAdmin} />
            <IntranetKontakter />
          </div>
        }
      />
      {isAdmin && (
        <Route
          path="kvittenser"
          element={
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
              <Subnav basePath={basePath} isAdmin={isAdmin} />
              <IntranetAckMatrix />
            </div>
          }
        />
      )}
      <Route path="*" element={<Navigate to={`${basePath}/intranat`} replace />} />
    </Routes>
  )
}

/**
 * Gamla länkar pekade på /intranat/<slug> - flikarna äger nu de namnen,
 * så dokument ligger under /intranat/dokument/<slug>. Kända fliknamn
 * släpps igenom av routerna ovan; allt annat tolkas som dokumentslug.
 */
function LegacySlugRedirect({ basePath }: { basePath: string }) {
  const slug = window.location.pathname.split('/').pop() || ''
  return <Navigate to={`${basePath}/intranat/dokument/${slug}`} replace />
}
