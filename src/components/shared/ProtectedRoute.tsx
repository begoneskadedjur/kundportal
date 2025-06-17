// src/components/shared/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

type ProtectedRouteProps = {
  children: React.ReactNode
  role?: 'admin' | 'customer'
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, profile, loading, isAdmin, isCustomer } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" />
  }

  if (role === 'admin' && !isAdmin) {
    return <Navigate to="/portal" />
  }

  if (role === 'customer' && !isCustomer) {
    return <Navigate to="/admin" />
  }

  return <>{children}</>
}