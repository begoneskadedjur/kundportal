// src/pages/procurement/ProcurementApp.tsx
// Den fristående upphandlingsportalen på upphandling.begone.se. Samma kodbas,
// Supabase-auth och Vercel-projekt som kundportalen, men egna routes på roten
// och ett eget skal (ProcurementShell). Inga andra portaldelar är nåbara här:
// allt som inte matchar går till startsidan.
//
// Sidkomponenterna är desamma som under /admin/upphandlingar; länkar inne i
// dem byggs med procurementPath() (src/lib/procurementPortal.ts).
//
// Sedan 3.63.0 (docs/upphandlingsportal-ux-plan.md avsnitt 2 och 8): Idag på
// roten, fem huvudposter med undervägar, och alla gamla adresser kvar:
// /:noticeId (bara uuid) och /bevakning omdirigeras, /admin/upphandlingar/*
// tas bort ur adressen.

import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminPrefixRedirect, LegacyNoticeRedirect, WatchRedirect } from './legacyRoutes'
import ProcurementShell from './ProcurementShell'
import ProcurementLogin from './ProcurementLogin'
import ForgotPassword from '../auth/ForgotPassword'
import ResetPassword from '../auth/ResetPassword'
import SetPassword from '../auth/SetPassword'

const Today = lazy(() => import('../admin/procurement/TodayPage'))
const Market = lazy(() => import('../admin/procurement/MarketPage'))
const Lessons = lazy(() => import('../admin/procurement/LessonsPage'))
const Watch = lazy(() => import('../admin/procurement/WatchPage'))
const NoticeDetail = lazy(() => import('../admin/procurement/NoticeDetailPage'))
const ContractClock = lazy(() => import('../admin/procurement/ContractClockPage'))
const Signals = lazy(() => import('../admin/procurement/SignalsPage'))
const Forecast = lazy(() => import('../admin/procurement/ForecastPage'))
const AnswerLibraryPage = lazy(() => import('../admin/procurement/AnswerLibraryPage'))
const Buyers = lazy(() => import('../admin/procurement/BuyersPage'))
const BuyerProfile = lazy(() => import('../admin/procurement/BuyerProfilePage'))
const Competitors = lazy(() => import('../admin/procurement/CompetitorsPage'))
const CompetitorProfile = lazy(() => import('../admin/procurement/CompetitorProfilePage'))
const Settings = lazy(() => import('../admin/procurement/SettingsPage'))
const Ask = lazy(() => import('../admin/procurement/AskPage'))
const Account = lazy(() => import('./ProcurementAccountPage'))

export default function ProcurementApp() {
  return (
    <Routes>
      <Route path="/login" element={<ProcurementLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/set-password" element={<SetPassword />} />

      <Route path="/" element={<ProcurementShell />}>
        <Route index element={<Today />} />
        {/* Framförhållning */}
        <Route path="avtalsklocka" element={<ContractClock />} />
        <Route path="signaler" element={<Signals />} />
        <Route path="prognos" element={<Forecast />} />
        {/* Annonser (tidigare Bevakning) */}
        <Route path="annonser" element={<Watch />} />
        <Route path="bevakning" element={<WatchRedirect />} />
        {/* Anbud */}
        <Route path="anbud" element={<Watch key="anbud" mode="anbud" />} />
        <Route path="anbud/lista" element={<Watch key="anbud" mode="anbud" />} />
        <Route path="anbud/bibliotek" element={<AnswerLibraryPage />} />
        <Route path="upphandling/:noticeId" element={<NoticeDetail />} />
        <Route path="upphandling/:noticeId/:steg" element={<NoticeDetail />} />
        {/* Marknad */}
        <Route path="marknad" element={<Market />} />
        <Route path="marknad/lardomar" element={<Lessons />} />
        <Route path="kopare" element={<Buyers />} />
        <Route path="kopare/:buyerId" element={<BuyerProfile />} />
        <Route path="konkurrenter" element={<Competitors />} />
        <Route path="konkurrenter/:supplierId" element={<CompetitorProfile />} />
        <Route path="fraga" element={<Ask />} />
        {/* Kontomenyn */}
        <Route path="installningar" element={<Settings />} />
        <Route path="mitt-konto" element={<Account />} />
        {/* Gamla länkar från mejl och notiser */}
        <Route path="admin/upphandlingar/*" element={<AdminPrefixRedirect />} />
        <Route path=":noticeId" element={<LegacyNoticeRedirect />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
