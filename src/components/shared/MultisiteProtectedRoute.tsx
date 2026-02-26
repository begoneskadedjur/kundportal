// src/components/shared/MultisiteProtectedRoute.tsx - Route protection for multisite users
import React from 'react'
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

  // Admins and koordinatorer can always access multisite (for management purposes)
  if (profile.role === 'admin' || profile.role === 'koordinator') {
    return <>{children}</>;
  }

  // For customer users, check multisite access
  if (profile.role === 'customer') {
    // If user has a multisite role, they are a multisite user
    if (userRole) {
      if (organization) {
        // All data loaded — render the portal
        return <>{children}</>;
      }
      // userRole exists but organization not loaded yet — show loading (transient state)
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <LoadingSpinner text="Laddar organisationsdata..." />
        </div>
      );
    }
    // No multisite role — redirect to regular customer portal or login
    const redirectPath = profile.customer_id ? '/customer' : '/login';
    return <Navigate to={redirectPath} replace />;
  }

  // Technicians and other roles — redirect to their dashboards
  if (profile.role === 'technician') {
    return <Navigate to="/technician/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}