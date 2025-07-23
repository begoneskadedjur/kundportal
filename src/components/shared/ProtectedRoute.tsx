// src/components/shared/ProtectedRoute.tsx - SLUTGILTIG VERSION MED STRIKT BEHÖRIGHETSSTYRNING

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
  // Rollkravet är nu mer flexibelt och matchar alla roller
  requiredRole?: 'admin' | 'customer' | 'technician'; 
};

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { profile, loading, isAdmin, isCustomer, isTechnician } = useAuth();
  const location = useLocation(); // Används för att veta vilken sida vi skyddar

  // 1. Visa laddningsskärm medan vi väntar på autentiseringsstatus
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Verifierar behörighet..." />
      </div>
    );
  }

  // 2. Om ingen profil finns, omdirigera alltid till login
  if (!profile) {
    console.log(`ProtectedRoute: No profile found. Redirecting to /login from ${location.pathname}`);
    return <Navigate to="/login" replace />;
  }

  // 3. Ge Admin en "huvudnyckel" till alla sidor
  if (isAdmin) {
    return <>{children}</>;
  }

  // 4. Hantera behörighetskrav för andra roller (Tekniker och Kunder)
  let hasAccess = false;
  let redirectPath = '/login'; // En säker fallback om något är fel

  if (isTechnician) {
    // En tekniker har tillgång OM den önskade sidan är en tekniker-sida.
    // I din App.tsx ska alla tekniker-rutter ha requiredRole='technician'.
    if (requiredRole === 'technician') {
      hasAccess = true;
    } else {
      // Om en tekniker försöker nå en admin- eller kundsida, skicka dem till sin startsida.
      redirectPath = '/technician/dashboard';
    }
  } else if (isCustomer) {
    // En kund har tillgång OM den önskade sidan är en kund-sida.
    if (requiredRole === 'customer') {
      hasAccess = true;
    } else {
      // Om en kund försöker nå en admin- eller tekniker-sida, skicka dem till sin startsida.
      redirectPath = '/customer';
    }
  }
  
  // 5. Returnera antingen barn-komponenten (om access beviljas) eller en omdirigering
  if (hasAccess) {
    return <>{children}</>;
  } else {
    // Denna logg är användbar för felsökning
    console.warn(`Access DENIED for role '${profile.role}' to path '${location.pathname}'. Redirecting to '${redirectPath}'.`);
    return <Navigate to={redirectPath} replace />;
  }
}