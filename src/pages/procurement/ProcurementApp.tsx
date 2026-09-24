// src/pages/procurement/ProcurementApp.tsx
// Den fristående upphandlingsportalen på upphandling.begone.se. Samma kodbas,
// Supabase-auth och Vercel-projekt som kundportalen, men egna routes på roten
// och ett eget skal (ProcurementShell). Inga andra portaldelar är nåbara här:
// allt som inte matchar går till startsidan.
//
// Sidkomponenterna är desamma som under /admin/upphandlingar; länkar inne i
// dem byggs med procurementPath() (src/lib/procurementPortal.ts).

import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProcurementShell from './ProcurementShell'
import ProcurementLogin from './ProcurementLogin'
import ForgotPassword from '../auth/ForgotPassword'
import ResetPassword from '../auth/ResetPassword'
import SetPassword from '../auth/SetPassword'

const Market = lazy(() => import('../admin/procurement/MarketPage'))
const Watch = lazy(() => import('../admin/procurement/WatchPage'))
const NoticeDetail = lazy(() => import('../admin/procurement/NoticeDetailPage'))
const ContractClock = lazy(() => import('../admin/procurement/ContractClockPage'))
const Signals = lazy(() => import('../admin/procurement/SignalsPage'))
const Buyers = lazy(() => import('../admin/procurement/BuyersPage'))
const BuyerProfile = lazy(() => import('../admin/procurement/BuyerProfilePage'))
const Competitors = lazy(() => import('../admin/procurement/CompetitorsPage'))
const CompetitorProfile = lazy(() => import('../admin/procurement/CompetitorProfilePage'))
const Settings = lazy(() => import('../admin/procurement/SettingsPage'))
const Account = lazy(() => import('./ProcurementAccountPage'))

export default function ProcurementApp() {
  return (
    <Routes>
      <Route path="/login" element={<ProcurementLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/set-password" element={<SetPassword />} />

      <Route path="/" element={<ProcurementShell />}>
        <Route index element={<Market />} />
        <Route path="bevakning" element={<Watch />} />
        <Route path="avtalsklocka" element={<ContractClock />} />
        <Route path="signaler" element={<Signals />} />
        <Route path="kopare" element={<Buyers />} />
        <Route path="kopare/:buyerId" element={<BuyerProfile />} />
        <Route path="konkurrenter" element={<Competitors />} />
        <Route path="konkurrenter/:supplierId" element={<CompetitorProfile />} />
        <Route path="installningar" element={<Settings />} />
        <Route path="mitt-konto" element={<Account />} />
        {/* Gamla länkar från mejl och notiser före subdomänen */}
        <Route path="admin/upphandlingar/*" element={<LegacyRedirect />} />
        <Route path="upphandling/:noticeId" element={<NoticeDetail />} />
        <Route path=":noticeId" element={<NoticeDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** /admin/upphandlingar/x på subdomänen blir /x */
function LegacyRedirect() {
  const rest = window.location.pathname.replace(/^\/admin\/upphandlingar/, '') || '/'
  return <Navigate to={rest + window.location.search} replace />
}
