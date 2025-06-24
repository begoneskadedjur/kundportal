// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Toaster } from 'react-hot-toast'

// Pages
import Home from './pages/Home'
import Login from './pages/auth/Login'
import SetPassword from './pages/auth/SetPassword'

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard'
import Customers from './pages/admin/Customers'
import NewCustomer from './pages/admin/NewCustomer'
import TestEdgeFunction from './pages/admin/TestEdgeFunction'

// Customer Pages
import CustomerPortal from './pages/customer/Portal'
import Cases from './pages/customer/Cases'
import Schedule from './pages/customer/Schedule'

// Components
import ProtectedRoute from './components/shared/ProtectedRoute'

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-slate-950">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/customers" element={
              <ProtectedRoute role="admin">
                <Customers />
              </ProtectedRoute>
            } />
            <Route path="/admin/customers/new" element={
              <ProtectedRoute role="admin">
                <NewCustomer />
              </ProtectedRoute>
            } />
            <Route path="/admin/test-functions" element={
              <ProtectedRoute role="admin">
                <TestEdgeFunction />
              </ProtectedRoute>
            } />
            
            {/* Customer Routes */}
            <Route path="/portal" element={
              <ProtectedRoute role="customer">
                <CustomerPortal />
              </ProtectedRoute>
            } />
            <Route path="/portal/cases" element={
              <ProtectedRoute role="customer">
                <Cases />
              </ProtectedRoute>
            } />
            <Route path="/portal/schedule" element={
              <ProtectedRoute role="customer">
                <Schedule />
              </ProtectedRoute>
            } />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App