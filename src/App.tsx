// src/App.tsx - UPPDATERAD MED DEN NYA SCHEMAVYN FÖR KOORDINATOR

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
import Technicians from './pages/admin/Technicians'
import TechnicianManagement from './pages/admin/TechnicianManagement'
import TechnicianCommissions from './pages/admin/TechnicianCommissions'
import SalesOpportunities from './pages/admin/SalesOpportunities'

// ONEFLOW ROUTES
import OneflowContractCreator from './pages/admin/OneflowContractCreator'
import OneflowDiagnostics from './pages/admin/OneflowDiagnostics'

// ✅ KOORDINATOR IMPORTS
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard'
import CoordinatorSchedule from './pages/coordinator/CoordinatorSchedule' // ✅ NY IMPORT FÖR SCHEMAVYN

// TEKNIKER PAGES
import TechnicianDashboard from './pages/technician/TechnicianDashboard'
import TechnicianCommissionsPage from './pages/technician/TechnicianCommissions'
import TechnicianCases from './pages/technician/TechnicianCases'
import TechnicianSchedule from './pages/technician/TechnicianSchedule' 

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
            <Route 
              path="/admin/oneflow-test" 
              element={<Navigate to="/admin/oneflow-contract-creator" replace />}
            />

            {/* KOORDINATOR ROUTES */}
            <Route 
              path="/koordinator/ruttplanerare" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <CoordinatorDashboard />
                </ProtectedRoute>
              } 
            />
            {/* ✅ NY ROUTE FÖR SCHEMAÖVERSIKTEN */}
            <Route 
              path="/koordinator/schema" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <CoordinatorSchedule />
                </ProtectedRoute>
              } 
            />

            {/* TEKNIKER ROUTES - EGEN PORTAL */}
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
            <Route 
              path="/technician/schedule" 
              element={
                <ProtectedRoute>
                  <TechnicianSchedule />
                </ProtectedRoute>
              } 
            />
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
      </AuthProvider>
    </Router>
  )
}

export default App