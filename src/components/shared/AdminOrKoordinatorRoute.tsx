// AdminOrKoordinatorRoute.tsx - Wrapper för sidor som både admin och koordinator kan komma åt
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

type AdminOrKoordinatorRouteProps = {
  children: React.ReactNode;
};

export default function AdminOrKoordinatorRoute({ children }: AdminOrKoordinatorRouteProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Verifierar behörighet..." />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Tillåt både admin och koordinator
  if (profile.role === 'admin' || profile.is_koordinator) {
    return <>{children}</>;
  }

  // Om användaren inte har rätt behörighet, skicka till deras startsida
  let redirectPath = '/login';
  
  switch (profile.role) {
    case 'technician':
      redirectPath = '/technician/dashboard';
      break;
    case 'customer':
      redirectPath = '/customer';
      break;
    default:
      redirectPath = '/login';
  }

  return <Navigate to={redirectPath} replace />;
}