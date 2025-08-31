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
import Customers from './pages/admin/Customers';
import CustomerDetails from './pages/admin/CustomerDetails';
import NewCustomer from './pages/admin/NewCustomer';
import Economics from './pages/admin/Economics';
import BillingManagement from './pages/admin/BillingManagement';
import Technicians from './pages/admin/Technicians';
import TechnicianManagement from './pages/admin/TechnicianManagement';
import TechnicianCommissions from './pages/admin/TechnicianCommissions';
import SalesOpportunities from './pages/admin/SalesOpportunities';
import ProductManagementPage from './pages/admin/ProductManagement';
import Leads from './pages/admin/Leads';
import LeadAnalytics from './pages/admin/LeadAnalytics';

// Multisite pages
import AdminOrganizationsPage from './pages/admin/multisite/OrganizationsPage';
import CoordinatorOrganizationsPage from './pages/coordinator/multisite/OrganizationsPage';
import OrganizationManagement from './pages/admin/multisite/OrganizationManagement';
import TrafficLightOverview from './pages/admin/multisite/TrafficLightOverview';
import MultisiteBillingManagement from './pages/admin/multisite/BillingManagement';
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
import CoordinatorAnalytics from './pages/coordinator/CoordinatorAnalytics';

// TEKNIKER PAGES
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import TechnicianCommissionsPage from './pages/technician/TechnicianCommissions';
import TechnicianCases from './pages/technician/TechnicianCases';
import TechnicianSchedule from './pages/technician/TechnicianSchedule'; 

// Customer pages
import CustomerPortal from './pages/customer/Portal';
import Cases from './pages/customer/Cases';
import Schedule from './pages/customer/Schedule';

// Organisation Portal Pages
import VerksamhetschefDashboard from './pages/organisation/Verksamhetschef'
import RegionchefDashboard from './pages/organisation/Regionchef'
import PlatsansvarigDashboard from './pages/organisation/Platsansvarig'
import OrganisationRedirect from './pages/organisation/Redirect'

// Shared organisation pages
import OrganisationArenden from './pages/organisation/shared/Arenden';
import OrganisationStatistik from './pages/organisation/shared/Statistik';
import OrganisationRapporter from './pages/organisation/shared/Rapporter';
import OrganisationOfferter from './pages/organisation/shared/Offerter';
import OrganisationOversikt from './pages/organisation/shared/Oversikt';

// Shared components
import ProtectedRoute from './components/shared/ProtectedRoute'
import AdminOrKoordinatorRoute from './components/shared/AdminOrKoordinatorRoute';
import MultisiteProtectedRoute from './components/shared/MultisiteProtectedRoute';

// Global styles
import './styles/globals.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <MultisiteProvider>
          <div className="min-h-screen bg-slate-950">
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Admin routes */}
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/customers" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Customers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/leads" 
              element={
                <ProtectedRoute requiredRole={["admin", "koordinator", "technician"]}>
                  <Leads />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/leads/analytics" 
              element={
                <ProtectedRoute requiredRole={["admin", "koordinator", "technician"]}>
                  <LeadAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/customers/:id" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <CustomerDetails />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/customers/new" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <NewCustomer />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/economics" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Economics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/billing" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <BillingManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/technicians" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Technicians />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/technician-management" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <TechnicianManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/commissions" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <TechnicianCommissions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/sales-opportunities" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <SalesOpportunities />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/product-management" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <ProductManagementPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Organisation Management Routes - Admin */}
            <Route 
              path="/admin/organisation/register" 
              element={
                <AdminOrKoordinatorRoute>
                  <MultisiteRegistrationPage />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/admin/organisation/organizations" 
              element={
                <AdminOrKoordinatorRoute>
                  <AdminOrganizationsPage />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/admin/organisation/organizations-manage" 
              element={
                <AdminOrKoordinatorRoute>
                  <OrganizationManagement />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/admin/organisation/traffic-light" 
              element={
                <AdminOrKoordinatorRoute>
                  <TrafficLightOverview />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/admin/organisation/billing" 
              element={
                <AdminOrKoordinatorRoute>
                  <MultisiteBillingManagement />
                </AdminOrKoordinatorRoute>
              } 
            />
            
            {/* OneflowContractCreator - TILLGÄNGLIG FÖR ADMIN, KOORDINATOR OCH TEKNIKER */}
            <Route 
              path="/admin/oneflow-contract-creator" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <OneflowContractCreator />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/koordinator/oneflow-contract-creator" 
              element={
                <ProtectedRoute requiredRole="koordinator">
                  <OneflowContractCreator />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technician/oneflow-contract-creator" 
              element={
                <ProtectedRoute requiredRole="technician">
                  <OneflowContractCreator />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/oneflow-diagnostics" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <OneflowDiagnostics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/contracts-overview" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <ContractsOverview />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/webhook-config" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <WebhookConfig />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/oneflow-test" 
              element={<Navigate to="/admin/oneflow-contract-creator" replace />}
            />

            {/* Koordinator-rutter (skyddas av 'koordinator'-rollen) */}
            <Route 
              path="/koordinator/dashboard" 
              element={
                <ProtectedRoute requiredRole="koordinator">
                  <CoordinatorMainDashboard />
                </ProtectedRoute>
              } 
            />
            {/* Organisation Management Routes - Koordinator */}
            <Route 
              path="/koordinator/organisation/register" 
              element={
                <AdminOrKoordinatorRoute>
                  <CoordinatorMultisiteRegistrationPage />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/koordinator/organisation/organizations" 
              element={
                <AdminOrKoordinatorRoute>
                  <CoordinatorOrganizationsPage />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/koordinator/organisation/organizations-manage" 
              element={
                <AdminOrKoordinatorRoute>
                  <OrganizationManagement />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/koordinator/organisation/traffic-light" 
              element={
                <AdminOrKoordinatorRoute>
                  <TrafficLightOverview />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/koordinator/organisation/billing" 
              element={
                <AdminOrKoordinatorRoute>
                  <MultisiteBillingManagement />
                </AdminOrKoordinatorRoute>
              } 
            />
            <Route 
              path="/koordinator/schema" 
              element={
                <ProtectedRoute requiredRole="koordinator">
                  <CoordinatorSchedule />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/koordinator/booking-assistant" 
              element={
                <ProtectedRoute requiredRole="koordinator">
                  <ScheduleOptimizer />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/koordinator/sok-arenden" 
              element={
                <ProtectedRoute requiredRole="koordinator">
                  <CaseSearch />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/koordinator/analytics" 
              element={
                <ProtectedRoute requiredRole="koordinator">
                  <CoordinatorAnalytics />
                </ProtectedRoute>
              } 
            />

            {/* --- TEKNIKER ROUTES (UPPDATERADE MED STRIKT BEHÖRIGHET) --- */}
            <Route 
              path="/technician/dashboard" 
              element={
                <ProtectedRoute requiredRole="technician">
                  <TechnicianDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technician/commissions" 
              element={
                <ProtectedRoute requiredRole="technician">
                  <TechnicianCommissionsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technician/cases" 
              element={
                <ProtectedRoute requiredRole="technician">
                  <TechnicianCases />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technician/schedule" 
              element={
                <ProtectedRoute requiredRole="technician">
                  <TechnicianSchedule />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technician/oneflow" 
              element={
                <ProtectedRoute requiredRole="technician">
                  <OneflowContractCreator />
                </ProtectedRoute>
              } 
            />

            {/* Shared routes - accessible by all authenticated users */}
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              } 
            />

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

            {/* Organisation Portal routes */}
            <Route 
              path="/organisation" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationRedirect />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/verksamhetschef" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationOversikt />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/regionchef" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationOversikt />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/platsansvarig" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationOversikt />
                </MultisiteProtectedRoute>
              } 
            />
            
            {/* Organisation sub-routes for verksamhetschef */}
            <Route 
              path="/organisation/verksamhetschef/statistik" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationStatistik />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/verksamhetschef/arenden" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationArenden />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/verksamhetschef/rapporter" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationRapporter />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/verksamhetschef/offerter" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationOfferter />
                </MultisiteProtectedRoute>
              } 
            />

            {/* Organisation sub-routes for regionchef */}
            <Route 
              path="/organisation/regionchef/statistik" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationStatistik />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/regionchef/arenden" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationArenden />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/regionchef/rapporter" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationRapporter />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/regionchef/offerter" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationOfferter />
                </MultisiteProtectedRoute>
              } 
            />

            {/* Organisation sub-routes for platsansvarig */}
            <Route 
              path="/organisation/platsansvarig/statistik" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationStatistik />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/platsansvarig/arenden" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationArenden />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/platsansvarig/rapporter" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationRapporter />
                </MultisiteProtectedRoute>
              } 
            />
            <Route 
              path="/organisation/platsansvarig/offerter" 
              element={
                <MultisiteProtectedRoute>
                  <OrganisationOfferter />
                </MultisiteProtectedRoute>
              } 
            />

            {/* Default redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/technician" element={<Navigate to="/technician/dashboard" replace />} />
            <Route path="/koordinator" element={<Navigate to="/koordinator/dashboard" replace />} />
            
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
        </MultisiteProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;