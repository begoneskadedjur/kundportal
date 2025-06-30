// src/components/shared/ProtectedRoute.tsx - FIXED VERSION
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

type ProtectedRouteProps = {
  children: React.ReactNode
  requiredRole?: 'admin' | 'customer'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading, isAdmin, isCustomer } = useAuth()

  // Show loading while authentication state is being determined
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Verifierar behörighet...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if no user or profile
  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  // Check role-based access
  if (requiredRole === 'admin' && !isAdmin) {
    // Admins only - redirect customers to their portal
    return <Navigate to="/customer" replace />
  }

  if (requiredRole === 'customer' && !isCustomer) {
    // Customers only - redirect admins to admin dashboard  
    return <Navigate to="/admin" replace />
  }

  // User is authenticated and has correct role
  return <>{children}</>
}