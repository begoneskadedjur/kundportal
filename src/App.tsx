// src/App.tsx - UPPDATERAD MED TEKNIKER-MANAGEMENT ROUTE
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
import TechnicianManagement from './pages/admin/TechnicianManagement'  // 🆕 NY TEKNIKER CRUD

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