// src/components/shared/MultisiteProtectedRoute.tsx - Route protection for multisite users
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMultisite } from '../../contexts/MultisiteContext';
import LoadingSpinner from './LoadingSpinner';

type MultisiteProtectedRouteProps = {
  children: React.ReactNode;
};

export default function MultisiteProtectedRoute({ children }: MultisiteProtectedRouteProps) {
  const { profile, loading: authLoading } = useAuth();
  const { userRole, loading: multisiteLoading, organization } = useMultisite();

  // Show loading while checking authentication and multisite access
  if (authLoading || multisiteLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Verifierar multisite-behörighet..." />
      </div>
    );
  }

  // If no profile, redirect to login
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Only admins and customers with multisite roles can access
  if (profile.role === 'admin') {
    // Admins can always access multisite (for management purposes)
    return <>{children}</>;
  }

  // For non-admin users, check if they have multisite access
  if (profile.role === 'customer' && userRole && organization) {
    return <>{children}</>;
  }

  // If user doesn't have multisite access, redirect based on their role
  let redirectPath = '/login';
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

  console.warn(`Multisite access DENIED for role '${profile.role}'. User has no multisite role. Redirecting to '${redirectPath}'.`);
  return <Navigate to={redirectPath} replace />;
}