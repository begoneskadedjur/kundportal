// src/components/shared/ProtectedRoute.tsx - MED KOORDINATOR-STÖD
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'customer' | 'technician' | 'koordinator'; // ✅ NYTT: Lägg till koordinator
};

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  // 1. Visa laddningsskärm som tidigare
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Verifierar behörighet..." />
      </div>
    );
  }

  // 2. Om ingen profil finns, omdirigera alltid till login
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // ✅ 3. UPPDATERAD LOGIK MED ADMIN-ÖVERÅTKOMST
  let hasAccess = false;
  
  switch (profile.role) {
    case 'admin':
      // Admins har FULL åtkomst till ALLT (admin, koordinator, technician, customer)
      hasAccess = true;
      break;
    
    case 'koordinator':
      // Koordinatorer har endast tillgång till koordinator-sidor
      if (requiredRole === 'koordinator') {
        hasAccess = true;
      }
      break;
    
    case 'technician':
      // Tekniker har tillgång till tekniker-sidor
      if (requiredRole === 'technician') {
        hasAccess = true;  
      }
      break;
      
    case 'customer':
      // Kunder har tillgång till kund-sidor
      if (requiredRole === 'customer') {
        hasAccess = true;
      }
      break;
      
    default:
      // Om rollen är okänd, nekas alltid tillträde
      hasAccess = false;
      break;
  }
  
  // 4. Returnera antingen barn-komponenten eller en omdirigering
  if (hasAccess) {
    return <>{children}</>;
  } else {
    // Om access nekas, skicka användaren till deras egen startsida
    let redirectPath = '/login'; // Fallback
    
    switch (profile.role) {
      case 'admin':
        redirectPath = '/admin/dashboard';
        break;
      case 'koordinator':
        redirectPath = '/koordinator/dashboard';
        break;
      case 'technician':
        redirectPath = '/technician/dashboard';
        break;
      case 'customer':
        redirectPath = '/customer';
        break;
    }
    
    console.warn(`Access DENIED for role '${profile.role}' to path '${location.pathname}'. Redirecting to '${redirectPath}'.`);
    return <Navigate to={redirectPath} replace />;
  }
}