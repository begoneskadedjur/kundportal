// src/App.tsx - Uppdaterad med separata statistik-rutter
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
import CustomerDetails from './pages/admin/CustomerDetails'
import NewCustomer from './pages/admin/NewCustomer'
import Technicians from './pages/admin/Technicians'
import Economics from './pages/admin/Economics'                    // NYA EKONOMISK STATISTIK-SIDAN
import TechniciansStatistics from './pages/admin/TechniciansStatistics'  // NYA TEKNIKER-STATISTIK-SIDAN

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
            <Route path="/admin/customers/:id" element={
              <ProtectedRoute role="admin">
                <CustomerDetails />
              </ProtectedRoute>
            } />
            <Route path="/admin/technicians" element={
              <ProtectedRoute role="admin">
                <Technicians />
              </ProtectedRoute>
            } />
            
            {/* NYA STATISTIK-RUTTER */}
            <Route path="/admin/economics" element={
              <ProtectedRoute role="admin">
                <Economics />
              </ProtectedRoute>
            } />
            <Route path="/admin/technicians-statistics" element={
              <ProtectedRoute role="admin">
                <TechniciansStatistics />
              </ProtectedRoute>
            } />
            
            {/* Customer Routes */}
            <Route path="/customer" element={
              <ProtectedRoute role="customer">
                <CustomerPortal />
              </ProtectedRoute>
            } />
            <Route path="/customer/cases" element={
              <ProtectedRoute role="customer">
                <Cases />
              </ProtectedRoute>
            } />
            <Route path="/customer/schedule" element={
              <ProtectedRoute role="customer">
                <Schedule />
              </ProtectedRoute>
            } />
          </Routes>
          
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #475569'
              }
            }}
          />
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App