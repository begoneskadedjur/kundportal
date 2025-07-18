// src/components/shared/ProtectedRoute.tsx - UPPDATERAD MED TEKNIKER-STÖD
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

type ProtectedRouteProps = {
  children: React.ReactNode
  requiredRole?: 'admin' | 'customer'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading, isAdmin, isCustomer, isTechnician } = useAuth()

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
    // 🆕 TEKNIKER-STÖD: Tillåt tekniker att använda admin-portalen temporärt
    if (isTechnician) {
      console.log('🔧 Tekniker har tillgång till admin-portalen (temporärt)')
      return <>{children}</>
    }
    
    // Admins only - redirect customers to their portal
    return <Navigate to="/customer" replace />
  }

  if (requiredRole === 'customer' && !isCustomer) {
    // 🆕 TEKNIKER-STÖD: Omdirigera tekniker till tekniker-dashboard
    if (isTechnician) {
      console.log('🔧 Tekniker omdirigeras till tekniker-portalen')
      return <Navigate to="/technician" replace />
    }
    
    // Customers only - redirect admins to admin dashboard  
    return <Navigate to="/admin" replace />
  }

  // 🆕 TEKNIKER-ROUTES: Om ingen required role är satt, tillåt alla autentiserade användare
  // Detta gäller för tekniker-routes som ska vara tillgängliga för tekniker
  if (!requiredRole) {
    return <>{children}</>
  }

  // User is authenticated and has correct role
  return <>{children}</>
}