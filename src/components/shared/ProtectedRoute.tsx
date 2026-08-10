// src/components/shared/ProtectedRoute.tsx - MED KOORDINATOR-STÖD OCH MULTISITE
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMultisite } from '../../contexts/MultisiteContext';
import LoadingSpinner from './LoadingSpinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'customer' | 'technician' | 'koordinator' | 'säljare';
};

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { profile, loading, user } = useAuth();
  const { userRole: multisiteRole, loading: multisiteLoading } = useMultisite();
  const location = useLocation();

  // 1. Visa laddningsskärm — skippa multisite-check för roller som inte behöver det
  const needsMultisite = !requiredRole || requiredRole === 'customer'
  if (loading || (needsMultisite && multisiteLoading)) {
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

  // 3. Kontrollera om användaren måste byta lösenord (första inloggning)
  // Tillåt endast /profile sidan om användaren har temp_password flagga
  const mustChangePassword = user?.user_metadata?.temp_password === true || 
                            user?.user_metadata?.must_change_password === true;
  
  if (mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  // 3. Specialhantering för multisite-användare som loggar in första gången
  // Om användaren har multisite-roll men försöker komma åt customer-sidor
  if (multisiteRole && requiredRole === 'customer' && !profile.customer_id) {
    // Redirect multisite-only användare till multisite-portalen
    return <Navigate to="/organisation" replace />;
  }

  // ✅ 4. EFFEKTIVA ROLLER: primärroll + extra_roles (+ is_admin för bakåtkompat)
  // En användare kan ha valfri kombination av admin/koordinator/technician,
  // tilldelat via Användarkonton (Personal). Admin har fortsatt full åtkomst.
  const effectiveRoles = new Set<string>();
  if (profile.role) effectiveRoles.add(profile.role);
  if (profile.is_admin) effectiveRoles.add('admin');
  for (const extraRole of profile.extra_roles || []) effectiveRoles.add(extraRole);

  let hasAccess = false;

  // Om ingen requiredRole är angiven, tillåt alla inloggade användare
  // (används för delade sidor som /larosate, /profile etc.)
  if (!requiredRole) {
    hasAccess = true;
  } else if (effectiveRoles.has('admin')) {
    // Admins har FULL åtkomst till ALLT (admin, koordinator, technician, customer)
    hasAccess = true;
  } else {
    hasAccess = effectiveRoles.has(requiredRole);
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
        redirectPath = profile.is_admin ? '/admin/dashboard' : '/technician/dashboard';
        break;
      case 'customer':
        // Check if user has multisite access
        if (multisiteRole) {
          redirectPath = '/organisation';
        } else {
          redirectPath = '/customer';
        }
        break;
      case 'säljare':
        redirectPath = '/saljare/dashboard';
        break;
    }
    
    console.warn(`Access DENIED for role '${profile.role}' to path '${location.pathname}'. Redirecting to '${redirectPath}'.`);
    return <Navigate to={redirectPath} replace />;
  }
}