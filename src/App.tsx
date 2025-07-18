// src/App.tsx - UPPDATERAD MED NYA ONEFLOW ROUTES + TEKNIKER-MANAGEMENT + PROVISIONER + FÖRSÄLJNINGSMÖJLIGHETER + TEKNIKER-DASHBOARD
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Toaster } from 'react-hot-toast'

// Auth pages
import Login from './pages/auth/Login'
import SetPassword from './pages/auth/SetPassword'
import ForgotPassword from './pages/auth/ForgotPassword'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import Customers from './pages/admin/Customers'
import CustomerDetails from './pages/admin/CustomerDetails'
import NewCustomer from './pages/admin/NewCustomer'
import Economics from './pages/admin/Economics'
import BillingManagement from './pages/admin/BillingManagement'
import Technicians from './pages/admin/Technicians'          // Tekniker Performance/Statistik
import TechnicianManagement from './pages/admin/TechnicianManagement'  // Tekniker CRUD
import TechnicianCommissions from './pages/admin/TechnicianCommissions'  // 🆕 PROVISIONER
import SalesOpportunities from './pages/admin/SalesOpportunities'  // 🆕 FÖRSÄLJNINGSMÖJLIGHETER

// 🆕 ONEFLOW ROUTES - UPPDATERADE NAMN
import OneflowContractCreator from './pages/admin/OneflowContractCreator'  // Tidigare OneflowTest
import OneflowDiagnostics from './pages/admin/OneflowDiagnostics'  // Ny diagnostik dashboard

// 🆕 TEKNIKER PAGES - NYA ROUTES
import TechnicianDashboard from './pages/technician/TechnicianDashboard'  // Tekniker huvuddashboard
import TechnicianCommissionsPage from './pages/technician/TechnicianCommissions'  // Tekniker provisioner
import TechnicianCases from './pages/technician/TechnicianCases'  // Tekniker ärenden

// Customer pages
import CustomerPortal from './pages/customer/Portal'
import Cases from './pages/customer/Cases'
import Schedule from './pages/customer/Schedule'

// Shared components
import ProtectedRoute from './components/shared/ProtectedRoute'

// Global styles
import './styles/globals.css'

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-slate-950">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

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

            {/* 🔧 TEKNIKER ROUTES - SEPARATA FUNKTIONER */}
            <Route 
              path="/admin/technicians" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Technicians />
                </ProtectedRoute>
              } 
            />
            {/* 🆕 NY ROUTE: Tekniker Management (CRUD) */}
            <Route 
              path="/admin/technician-management" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <TechnicianManagement />
                </ProtectedRoute>
              } 
            />
            {/* 🆕 NY ROUTE: Provisioner */}
            <Route 
              path="/admin/commissions" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <TechnicianCommissions />
                </ProtectedRoute>
              } 
            />
            {/* 🆕 NY ROUTE: Försäljningsmöjligheter */}
            <Route 
              path="/admin/sales-opportunities" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <SalesOpportunities />
                </ProtectedRoute>
              } 
            />

            {/* 🆕 ONEFLOW ROUTES - UPPDATERADE NAMN OCH STRUKTUR */}
            <Route 
              path="/admin/oneflow-contract-creator" 
              element={
                <ProtectedRoute requiredRole="admin">
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
            
            {/* 🔄 LEGACY ONEFLOW REDIRECT - För bakåtkompatibilitet */}
            <Route 
              path="/admin/oneflow-test" 
              element={<Navigate to="/admin/oneflow-contract-creator" replace />}
            />

            {/* 🆕 TEKNIKER ROUTES - EGEN PORTAL */}
            <Route 
              path="/technician/dashboard" 
              element={
                <ProtectedRoute>
                  <TechnicianDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technician/commissions" 
              element={
                <ProtectedRoute>
                  <TechnicianCommissionsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technician/cases" 
              element={
                <ProtectedRoute>
                  <TechnicianCases />
                </ProtectedRoute>
              } 
            />
            {/* Tekniker har också tillgång till Oneflow */}
            <Route 
              path="/technician/oneflow" 
              element={
                <ProtectedRoute>
                  <OneflowContractCreator />
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

            {/* Default redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/technician" element={<Navigate to="/technician/dashboard" replace />} />
            
            {/* Legacy portal redirects - FIX FOR THE BLACK SCREEN */}
            <Route path="/portal" element={<Navigate to="/customer" replace />} />
            <Route path="/customer/portal" element={<Navigate to="/customer" replace />} />

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b', // slate-800
                color: '#f8fafc', // slate-50
                border: '1px solid #475569', // slate-600
              },
              success: {
                iconTheme: {
                  primary: '#22c55e', // green-500
                  secondary: '#f8fafc', // slate-50
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444', // red-500
                  secondary: '#f8fafc', // slate-50
                },
              },
            }}
          />
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App