// src/components/shared/ProtectedRoute.tsx - SLUTGILTIG, ROBUST VERSION MED SWITCH-LOGIK

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'customer' | 'technician'; 
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

  // ✅ 3. NY, TYDLIG LOGIK MED SWITCH-SATS
  let hasAccess = false;
  
  switch (profile.role) {
    case 'admin':
      // En admin har ALLTID tillgång, oavsett vad `requiredRole` är.
      hasAccess = true;
      break;
    
    case 'technician':
      // En tekniker har tillgång OM den begärda sidan är en tekniker-sida.
      if (requiredRole === 'technician') {
        hasAccess = true;
      }
      break;

    case 'customer':
      // En kund har tillgång OM den begärda sidan är en kund-sida.
      if (requiredRole === 'customer') {
        hasAccess = true;
      }
      break;

    default:
      // Om rollen är okänd, nekas alltid tillträde.
      hasAccess = false;
      break;
  }
  
  // 4. Returnera antingen barn-komponenten eller en omdirigering
  if (hasAccess) {
    return <>{children}</>;
  } else {
    // Om access nekas, skicka användaren till deras egen startsida.
    let redirectPath = '/login'; // Fallback
    if (profile.role === 'technician') redirectPath = '/technician/dashboard';
    if (profile.role === 'customer') redirectPath = '/customer';

    console.warn(`Access DENIED for role '${profile.role}' to path '${location.pathname}'. Redirecting to '${redirectPath}'.`);
    return <Navigate to={redirectPath} replace />;
  }
}