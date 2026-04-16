// src/App.tsx - SLUTGILTIG VERSION MED KORREKT FORMATERING OCH STRIKT BEHÖRIGHET

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MultisiteProvider } from './contexts/MultisiteContext';
import { Toaster } from 'react-hot-toast';

// Auth pages
import Login from './pages/auth/Login';
import SetPassword from './pages/auth/SetPassword';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Shared pages
import UserProfile from './pages/shared/UserProfile';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import DashboardDemo from './pages/admin/DashboardDemo';
import { AdminLayout } from './components/admin/layout';
import { CoordinatorLayout } from './components/coordinator/layout';
import TechnicianLayout from './components/technician/layout';
import SäljareLayout from './components/säljare/layout/SäljareLayout';
import SäljareDashboard from './pages/säljare/SäljareDashboard';
import Customers from './pages/admin/Customers';
import CustomerDetails from './pages/admin/CustomerDetails';
import Economics from './pages/admin/Economics';
import Technicians from './pages/admin/Technicians';
import TechnicianManagement from './pages/admin/TechnicianManagement';
import TechnicianCommissions from './pages/admin/TechnicianCommissions';
import SalesOpportunities from './pages/admin/SalesOpportunities';
import StationTypesPage from './pages/admin/settings/StationTypesPage';
import PreparationsPage from './pages/admin/settings/PreparationsPage';
import ArticlesPage from './pages/admin/settings/ArticlesPage';
import PriceListsPage from './pages/admin/settings/PriceListsPage';
import ServiceCatalogPage from './pages/admin/settings/ServiceCatalogPage';
import CustomerGroupsPage from './pages/admin/settings/CustomerGroupsPage';
import FortnoxPage from './pages/admin/settings/FortnoxPage';
import SmsTemplatesPage from './pages/admin/settings/SmsTemplatesPage';
import InvoicingPage from './pages/admin/invoicing';
import Leads from './pages/admin/Leads';
import LeadAnalytics from './pages/admin/LeadAnalytics';
import CustomerAnalytics from './pages/admin/CustomerAnalytics';
import ImageBank from './pages/admin/ImageBank';
import TeamChat from './pages/admin/TeamChat';
import IncidentsPage from './pages/admin/IncidentsPage';
import CustomerJourney from './pages/admin/CustomerJourney';
import ClosedCasesFunnel from './pages/admin/ClosedCasesFunnel'
import BugReportsPage from './pages/admin/BugReportsPage';

// Multisite pages
import AdminOrganizationsPage from './pages/admin/multisite/OrganizationsPage';
import CoordinatorOrganizationsPage from './pages/coordinator/multisite/OrganizationsPage';
import OrganizationManagement from './pages/admin/multisite/OrganizationManagement';
import TrafficLightOverview from './pages/admin/multisite/TrafficLightOverview';

import MultisiteRegistrationPage from './pages/admin/multisite/MultisiteRegistrationPage';
import CoordinatorMultisiteRegistrationPage from './pages/coordinator/MultisiteRegistrationPage';

// ONEFLOW ROUTES
import OneflowContractCreator from './pages/admin/OneflowContractCreator';
import OneflowDiagnostics from './pages/admin/OneflowDiagnostics';
import ContractsOverview from './pages/admin/ContractsOverview';
import WebhookConfig from './pages/admin/WebhookConfig';

// KOORDINATOR IMPORTS
import CoordinatorMainDashboard from './pages/coordinator/Dashboard';
import CoordinatorSchedule from './pages/coordinator/CoordinatorSchedule';
import ScheduleOptimizer from './pages/coordinator/ScheduleOptimizer';
import CaseSearch from './pages/coordinator/CaseSearch';
import CasePipeline from './pages/coordinator/CasePipeline';
import OfferFollowUp from './pages/coordinator/OfferFollowUp';
import CoordinatorAnalytics from './pages/coordinator/CoordinatorAnalytics';

// TEKNIKER PAGES
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import TechnicianCommissionsPage from './pages/technician/TechnicianCommissions';
import TechnicianCases from './pages/technician/TechnicianCases';
import TechnicianSchedule from './pages/technician/TechnicianSchedule';
import StationInspectionModule from './pages/technician/StationInspectionModule';
import TechnicianEquipment from './pages/technician/TechnicianEquipment';
import TechnicianCustomerJourney from './pages/technician/TechnicianCustomerJourney';
import EquipmentPlacementGuide from './pages/technician/guides/EquipmentPlacementGuide';
import FollowUpCaseGuide from './pages/technician/guides/FollowUpCaseGuide';
import CaseDeletionGuide from './pages/technician/guides/CaseDeletionGuide';
import TicketSystemGuide from './pages/technician/guides/TicketSystemGuide';

// Customer pages
import CustomerPortal from './pages/customer/Portal';
import Cases from './pages/customer/Cases';
import Schedule from './pages/customer/Schedule';

// Organisation Portal
import OrganisationPortal from './pages/organisation/Portal'

// Shared components
import ProtectedRoute from './components/shared/ProtectedRoute'
import AdminOrKoordinatorRoute from './components/shared/AdminOrKoordinatorRoute';
import MultisiteProtectedRoute from './components/shared/MultisiteProtectedRoute';
import { AppLayout } from './components/shared/AppLayout';

// Tickets (shared page for internal communication)
import InternAdministration from './pages/shared/InternAdministration';

// Lärosäte (shared learning center for all internal roles)
import Larosate from './pages/shared/Larosate';

// Global styles
import './styles/globals.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <MultisiteProvider>
          <AppLayout>
          <div className="min-h-screen bg-slate-950">
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Admin routes — nasted under AdminLayout med persistent sidebar */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="dashboard-demo" element={<ProtectedRoute requiredRole="admin"><DashboardDemo /></ProtectedRoute>} />
              <Route path="befintliga-kunder" element={<ProtectedRoute requiredRole="admin"><Customers /></ProtectedRoute>} />
              <Route path="befintliga-kunder/:id" element={<ProtectedRoute requiredRole="admin"><CustomerDetails /></ProtectedRoute>} />
              <Route path="kundprognos" element={<ProtectedRoute requiredRole="admin"><CustomerAnalytics /></ProtectedRoute>} />
              <Route path="leads" element={<ProtectedRoute requiredRole={["admin", "koordinator", "technician"] as any}><Leads /></ProtectedRoute>} />
              <Route path="leadsstatistik" element={<ProtectedRoute requiredRole={["admin", "koordinator", "technician"] as any}><LeadAnalytics /></ProtectedRoute>} />
              <Route path="ekonomi" element={<ProtectedRoute requiredRole="admin"><Economics /></ProtectedRoute>} />
              <Route path="teknikerstatistik" element={<ProtectedRoute requiredRole="admin"><Technicians /></ProtectedRoute>} />
              <Route path="anvandarkonton-personal" element={<ProtectedRoute requiredRole="admin"><TechnicianManagement /></ProtectedRoute>} />
              <Route path="provisioner" element={<ProtectedRoute requiredRole="admin"><TechnicianCommissions /></ProtectedRoute>} />
              <Route path="forsaljningsmojligheter" element={<ProtectedRoute requiredRole="admin"><SalesOpportunities /></ProtectedRoute>} />
              <Route path="bildbank" element={<ProtectedRoute requiredRole="admin"><ImageBank /></ProtectedRoute>} />
              <Route path="ai-assistent" element={<ProtectedRoute requiredRole="admin"><TeamChat /></ProtectedRoute>} />
              <Route path="stationer-fallor" element={<ProtectedRoute requiredRole="admin"><StationTypesPage /></ProtectedRoute>} />
              <Route path="preparat" element={<ProtectedRoute requiredRole="admin"><PreparationsPage /></ProtectedRoute>} />
              <Route path="artiklar" element={<ProtectedRoute requiredRole="admin"><ArticlesPage /></ProtectedRoute>} />
              <Route path="prislistor" element={<ProtectedRoute requiredRole="admin"><PriceListsPage /></ProtectedRoute>} />
              <Route path="tjansteutbud" element={<ProtectedRoute requiredRole="admin"><ServiceCatalogPage /></ProtectedRoute>} />
              <Route path="fakturering" element={<ProtectedRoute requiredRole="admin"><InvoicingPage /></ProtectedRoute>} />
              <Route path="fakturering/*" element={<ProtectedRoute requiredRole="admin"><InvoicingPage /></ProtectedRoute>} />
              <Route path="skapa-avtal" element={<ProtectedRoute requiredRole="admin"><OneflowContractCreator /></ProtectedRoute>} />
              <Route path="avtalsdiagnostik" element={<ProtectedRoute requiredRole="admin"><OneflowDiagnostics /></ProtectedRoute>} />
              <Route path="forsaljningspipeline" element={<ProtectedRoute requiredRole="admin"><ContractsOverview /></ProtectedRoute>} />
              <Route path="offerthantering" element={<ProtectedRoute requiredRole="admin"><CasePipeline /></ProtectedRoute>} />
              <Route path="kundresa" element={<ProtectedRoute requiredRole="admin"><CustomerJourney /></ProtectedRoute>} />
              <Route path="avslutade-arenden" element={<ProtectedRoute requiredRole="admin"><ClosedCasesFunnel /></ProtectedRoute>} />
              <Route path="webhook-config" element={<ProtectedRoute requiredRole="admin"><WebhookConfig /></ProtectedRoute>} />
              <Route path="kundgrupper" element={<ProtectedRoute requiredRole="admin"><CustomerGroupsPage /></ProtectedRoute>} />
              <Route path="installningar/fortnox" element={<ProtectedRoute requiredRole="admin"><FortnoxPage /></ProtectedRoute>} />
              <Route path="sms-mallar" element={<ProtectedRoute requiredRole="admin"><SmsTemplatesPage /></ProtectedRoute>} />
              <Route path="oneflow-test" element={<Navigate to="/admin/skapa-avtal" replace />} />
              <Route path="tickets" element={<ProtectedRoute requiredRole="admin"><InternAdministration /></ProtectedRoute>} />
              <Route path="tillbud-avvikelser" element={<ProtectedRoute requiredRole="admin"><IncidentsPage /></ProtectedRoute>} />
              <Route path="bug-reports" element={<ProtectedRoute requiredRole="admin"><BugReportsPage /></ProtectedRoute>} />
              <Route path="guides/case-deletion" element={<ProtectedRoute requiredRole="admin"><CaseDeletionGuide /></ProtectedRoute>} />
              <Route path="guides/ticket-system" element={<ProtectedRoute requiredRole="admin"><TicketSystemGuide /></ProtectedRoute>} />
              {/* Användarkonton (Kund) - konsoliderad portalhantering */}
              <Route path="anvandarkonton-kund" element={<AdminOrKoordinatorRoute><AdminOrganizationsPage /></AdminOrKoordinatorRoute>} />
              {/* Behåll gamla routes för bakåtkompatibilitet */}
              <Route path="organisation/organizations" element={<Navigate to="/admin/anvandarkonton-kund" replace />} />
              <Route path="organisation/organizations-manage" element={<Navigate to="/admin/anvandarkonton-kund" replace />} />
              <Route path="organisation/register" element={<Navigate to="/admin/anvandarkonton-kund" replace />} />
              {/* Organisation routes */}
              <Route path="trafikljusoversikt" element={<AdminOrKoordinatorRoute><TrafficLightOverview /></AdminOrKoordinatorRoute>} />

              {/* Lärosäte - Internt kunskapscenter för alla interna roller */}
              <Route path="larosate" element={<ProtectedRoute requiredRole={["admin", "koordinator", "technician"] as any}><Larosate /></ProtectedRoute>} />
              <Route path="larosate/guides/ticket-system" element={<ProtectedRoute requiredRole={["admin", "koordinator", "technician"] as any}><TicketSystemGuide /></ProtectedRoute>} />
              <Route path="larosate/guides/follow-up-case" element={<ProtectedRoute requiredRole={["admin", "koordinator", "technician"] as any}><FollowUpCaseGuide /></ProtectedRoute>} />
              <Route path="larosate/guides/case-deletion" element={<ProtectedRoute requiredRole={["admin", "koordinator", "technician"] as any}><CaseDeletionGuide /></ProtectedRoute>} />
              <Route path="larosate/guides/equipment-placement" element={<ProtectedRoute requiredRole={["admin", "koordinator", "technician"] as any}><EquipmentPlacementGuide /></ProtectedRoute>} />

              {/* Bakåtkompatibilitet: gamla URL:er redirectar till nya */}
              <Route path="customers" element={<Navigate to="/admin/befintliga-kunder" replace />} />
              <Route path="customers/analytics" element={<Navigate to="/admin/kundprognos" replace />} />
              <Route path="customer-access" element={<Navigate to="/admin/anvandarkonton-kund" replace />} />
              <Route path="contracts-overview" element={<Navigate to="/admin/forsaljningspipeline" replace />} />
              <Route path="leads/analytics" element={<Navigate to="/admin/leadsstatistik" replace />} />
              <Route path="technician-management" element={<Navigate to="/admin/anvandarkonton-personal" replace />} />
              <Route path="team-chat" element={<Navigate to="/admin/ai-assistent" replace />} />
              <Route path="image-bank" element={<Navigate to="/admin/bildbank" replace />} />
              <Route path="settings/station-types" element={<Navigate to="/admin/stationer-fallor" replace />} />
              <Route path="economics" element={<Navigate to="/admin/ekonomi" replace />} />
              <Route path="invoicing" element={<Navigate to="/admin/fakturering" replace />} />
              <Route path="commissions" element={<Navigate to="/admin/provisioner" replace />} />
              <Route path="technicians" element={<Navigate to="/admin/teknikerstatistik" replace />} />
              <Route path="sales-opportunities" element={<Navigate to="/admin/forsaljningsmojligheter" replace />} />
              <Route path="oneflow-diagnostics" element={<Navigate to="/admin/avtalsdiagnostik" replace />} />
              <Route path="oneflow-contract-creator" element={<Navigate to="/admin/skapa-avtal" replace />} />
              <Route path="settings/preparations" element={<Navigate to="/admin/preparat" replace />} />
              <Route path="settings/price-lists" element={<Navigate to="/admin/prislistor" replace />} />
              <Route path="settings/articles" element={<Navigate to="/admin/artiklar" replace />} />
              <Route path="organisation/traffic-light" element={<Navigate to="/admin/trafikljusoversikt" replace />} />

            </Route>


            {/* Koordinator routes — nested under CoordinatorLayout med persistent sidebar */}
            <Route path="/koordinator" element={<CoordinatorLayout />}>
              <Route index element={<Navigate to="/koordinator/dashboard" replace />} />
              <Route path="dashboard" element={<ProtectedRoute requiredRole="koordinator"><CoordinatorMainDashboard /></ProtectedRoute>} />

              {/* Kunder & Avtal */}
              <Route path="befintliga-kunder" element={<ProtectedRoute requiredRole="koordinator"><Customers /></ProtectedRoute>} />
              <Route path="befintliga-kunder/:id" element={<ProtectedRoute requiredRole="koordinator"><CustomerDetails /></ProtectedRoute>} />
              <Route path="trafikljusoversikt" element={<AdminOrKoordinatorRoute><TrafficLightOverview /></AdminOrKoordinatorRoute>} />
              <Route path="kundprognos" element={<ProtectedRoute requiredRole="koordinator"><CustomerAnalytics /></ProtectedRoute>} />
              <Route path="customer-access" element={<AdminOrKoordinatorRoute><CoordinatorOrganizationsPage /></AdminOrKoordinatorRoute>} />

              {/* Försäljning */}
              <Route path="forsaljningspipeline" element={<ProtectedRoute requiredRole="koordinator"><ContractsOverview /></ProtectedRoute>} />
              <Route path="forsaljningsmojligheter" element={<ProtectedRoute requiredRole="koordinator"><SalesOpportunities /></ProtectedRoute>} />
              <Route path="leads" element={<ProtectedRoute requiredRole="koordinator"><Leads /></ProtectedRoute>} />
              <Route path="leadsstatistik" element={<ProtectedRoute requiredRole="koordinator"><LeadAnalytics /></ProtectedRoute>} />
              <Route path="offertuppfoljning" element={<ProtectedRoute requiredRole="koordinator"><OfferFollowUp /></ProtectedRoute>} />

              {/* Fakturering */}
              <Route path="fakturering" element={<ProtectedRoute requiredRole="koordinator"><InvoicingPage /></ProtectedRoute>} />
              <Route path="fakturering/*" element={<ProtectedRoute requiredRole="koordinator"><InvoicingPage /></ProtectedRoute>} />

              {/* Organisation */}
              <Route path="tickets" element={<ProtectedRoute requiredRole="koordinator"><InternAdministration /></ProtectedRoute>} />
              <Route path="tillbud-avvikelser" element={<ProtectedRoute requiredRole="koordinator"><IncidentsPage /></ProtectedRoute>} />

              {/* Verktyg */}
              <Route path="team-chat" element={<ProtectedRoute requiredRole="koordinator"><TeamChat /></ProtectedRoute>} />
              <Route path="bildbank" element={<ProtectedRoute requiredRole="koordinator"><ImageBank /></ProtectedRoute>} />

              {/* Planering (koordinator-specifik) */}
              <Route path="schema" element={<ProtectedRoute requiredRole="koordinator"><CoordinatorSchedule /></ProtectedRoute>} />
              <Route path="booking-assistant" element={<ProtectedRoute requiredRole="koordinator"><ScheduleOptimizer /></ProtectedRoute>} />

              {/* Ärenden (koordinator-specifik) */}
              <Route path="offerthantering" element={<ProtectedRoute requiredRole="koordinator"><CasePipeline /></ProtectedRoute>} />
              <Route path="sok-arenden" element={<ProtectedRoute requiredRole="koordinator"><CaseSearch /></ProtectedRoute>} />
              <Route path="oneflow-contract-creator" element={<ProtectedRoute requiredRole="koordinator"><OneflowContractCreator /></ProtectedRoute>} />
              <Route path="analytics" element={<ProtectedRoute requiredRole="koordinator"><CoordinatorAnalytics /></ProtectedRoute>} />

              {/* Guides & Lärosäte */}
              <Route path="guides/case-deletion" element={<ProtectedRoute requiredRole="koordinator"><CaseDeletionGuide /></ProtectedRoute>} />
              <Route path="guides/ticket-system" element={<ProtectedRoute requiredRole="koordinator"><TicketSystemGuide /></ProtectedRoute>} />
              <Route path="larosate" element={<ProtectedRoute requiredRole="koordinator"><Larosate /></ProtectedRoute>} />

              {/* Bakåtkompatibilitet */}
              <Route path="organisation/register" element={<Navigate to="/koordinator/customer-access" replace />} />
              <Route path="organisation/organizations" element={<Navigate to="/koordinator/customer-access" replace />} />
              <Route path="organisation/organizations-manage" element={<Navigate to="/koordinator/customer-access" replace />} />
              <Route path="organisation/traffic-light" element={<Navigate to="/koordinator/trafikljusoversikt" replace />} />
            </Route>

            {/* Redirect gammal engelsk URL */}
            <Route path="/coordinator/leads" element={<Navigate to="/koordinator/leads" replace />} />

            {/* --- SÄLJARE ROUTES — nested under SäljareLayout med persistent sidebar --- */}
            <Route path="/säljare" element={<SäljareLayout />}>
              <Route index element={<Navigate to="/säljare/dashboard" replace />} />
              <Route path="dashboard" element={<ProtectedRoute requiredRole="säljare"><SäljareDashboard /></ProtectedRoute>} />

              {/* Kunder & Avtal */}
              <Route path="befintliga-kunder" element={<ProtectedRoute requiredRole="säljare"><Customers /></ProtectedRoute>} />
              <Route path="befintliga-kunder/:id" element={<ProtectedRoute requiredRole="säljare"><CustomerDetails /></ProtectedRoute>} />
              <Route path="trafikljusoversikt" element={<ProtectedRoute requiredRole="säljare"><TrafficLightOverview /></ProtectedRoute>} />
              <Route path="kundprognos" element={<ProtectedRoute requiredRole="säljare"><CustomerAnalytics /></ProtectedRoute>} />
              <Route path="anvandarkonton-kund" element={<ProtectedRoute requiredRole="säljare"><CoordinatorOrganizationsPage /></ProtectedRoute>} />

              {/* Försäljning */}
              <Route path="forsaljningspipeline" element={<ProtectedRoute requiredRole="säljare"><ContractsOverview /></ProtectedRoute>} />
              <Route path="forsaljningsmojligheter" element={<ProtectedRoute requiredRole="säljare"><SalesOpportunities /></ProtectedRoute>} />
              <Route path="leads" element={<ProtectedRoute requiredRole="säljare"><Leads /></ProtectedRoute>} />
              <Route path="leadsstatistik" element={<ProtectedRoute requiredRole="säljare"><LeadAnalytics /></ProtectedRoute>} />
              <Route path="offerthantering" element={<ProtectedRoute requiredRole="säljare"><CasePipeline /></ProtectedRoute>} />
              <Route path="kundresa" element={<ProtectedRoute requiredRole="säljare"><CustomerJourney /></ProtectedRoute>} />
              <Route path="avslutade-arenden" element={<ProtectedRoute requiredRole="säljare"><ClosedCasesFunnel /></ProtectedRoute>} />

              {/* Verktyg */}
              <Route path="ai-assistent" element={<ProtectedRoute requiredRole="säljare"><TeamChat /></ProtectedRoute>} />
            </Route>

            {/* --- TEKNIKER ROUTES — nested under TechnicianLayout med persistent sidebar --- */}
            <Route path="/technician" element={<TechnicianLayout />}>
              <Route index element={<Navigate to="/technician/dashboard" replace />} />
              <Route path="dashboard" element={<ProtectedRoute requiredRole="technician"><TechnicianDashboard /></ProtectedRoute>} />
              <Route path="commissions" element={<ProtectedRoute requiredRole="technician"><TechnicianCommissionsPage /></ProtectedRoute>} />
              <Route path="cases" element={<ProtectedRoute requiredRole="technician"><TechnicianCases /></ProtectedRoute>} />
              <Route path="schedule" element={<ProtectedRoute requiredRole="technician"><TechnicianSchedule /></ProtectedRoute>} />
              <Route path="inspection/:caseId" element={<ProtectedRoute requiredRole="technician"><StationInspectionModule /></ProtectedRoute>} />
              <Route path="leads" element={<ProtectedRoute requiredRole="technician"><Leads /></ProtectedRoute>} />
              <Route path="oneflow" element={<ProtectedRoute requiredRole="technician"><OneflowContractCreator /></ProtectedRoute>} />
              <Route path="oneflow-contract-creator" element={<ProtectedRoute requiredRole="technician"><OneflowContractCreator /></ProtectedRoute>} />
              <Route path="offer-follow-up" element={<ProtectedRoute requiredRole="technician"><OfferFollowUp /></ProtectedRoute>} />
              <Route path="min-kundresa" element={<ProtectedRoute requiredRole="technician"><TechnicianCustomerJourney /></ProtectedRoute>} />
              <Route path="equipment" element={<ProtectedRoute requiredRole="technician"><TechnicianEquipment /></ProtectedRoute>} />
              <Route path="team-chat" element={<ProtectedRoute requiredRole="technician"><TeamChat /></ProtectedRoute>} />
              <Route path="tillbud-avvikelser" element={<ProtectedRoute requiredRole="technician"><IncidentsPage /></ProtectedRoute>} />
              <Route path="tickets" element={<ProtectedRoute requiredRole="technician"><InternAdministration /></ProtectedRoute>} />
              <Route path="guides/equipment-placement" element={<ProtectedRoute requiredRole="technician"><EquipmentPlacementGuide /></ProtectedRoute>} />
              <Route path="guides/follow-up-case" element={<ProtectedRoute requiredRole="technician"><FollowUpCaseGuide /></ProtectedRoute>} />
              <Route path="guides/case-deletion" element={<ProtectedRoute requiredRole="technician"><CaseDeletionGuide /></ProtectedRoute>} />
              <Route path="guides/ticket-system" element={<ProtectedRoute requiredRole="technician"><TicketSystemGuide /></ProtectedRoute>} />
            </Route>

            {/* Shared routes - accessible by all authenticated users */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              }
            />

            {/* Lärosäte redirects — bakåtkompatibilitet */}
            <Route path="/larosate" element={<Navigate to="/admin/larosate" replace />} />
            <Route path="/larosate/guides/ticket-system" element={<Navigate to="/admin/larosate/guides/ticket-system" replace />} />
            <Route path="/larosate/guides/follow-up-case" element={<Navigate to="/admin/larosate/guides/follow-up-case" replace />} />
            <Route path="/larosate/guides/case-deletion" element={<Navigate to="/admin/larosate/guides/case-deletion" replace />} />
            <Route path="/larosate/guides/equipment-placement" element={<Navigate to="/admin/larosate/guides/equipment-placement" replace />} />

            {/* Customer routes */}
            <Route 
              path="/customer" 
              element={
                <ProtectedRoute requiredRole="customer">
                  <CustomerPortal />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/customer/cases" 
              element={
                <ProtectedRoute requiredRole="customer">
                  <Cases />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/customer/schedule" 
              element={
                <ProtectedRoute requiredRole="customer">
                  <Schedule />
                </ProtectedRoute>
              } 
            />

            {/* Organisation Portal — unified multisite portal */}
            <Route
              path="/organisation"
              element={
                <MultisiteProtectedRoute>
                  <OrganisationPortal />
                </MultisiteProtectedRoute>
              }
            />
            {/* Legacy organisation redirects */}
            <Route path="/organisation/verksamhetschef/*" element={<Navigate to="/organisation" replace />} />
            <Route path="/organisation/regionchef/*" element={<Navigate to="/organisation" replace />} />
            <Route path="/organisation/platsansvarig/*" element={<Navigate to="/organisation" replace />} />
            <Route path="/multisite" element={<Navigate to="/organisation" replace />} />

            {/* Default redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Legacy portal redirects */}
            <Route path="/portal" element={<Navigate to="/customer" replace />} />
            <Route path="/customer/portal" element={<Navigate to="/customer" replace />} />

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#f8fafc',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f8fafc',
                },
              },
            }}
          />
        </div>
        </AppLayout>
        </MultisiteProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;