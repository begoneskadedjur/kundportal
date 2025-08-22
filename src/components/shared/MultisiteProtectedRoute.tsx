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

  // Enhanced logging for debugging
  React.useEffect(() => {
    if (!authLoading && !multisiteLoading) {
      console.log('MultisiteProtectedRoute: State check', {
        profile: profile ? {
          id: profile.id,
          role: profile.role,
          customer_id: profile.customer_id,
          email: profile.email
        } : null,
        userRole: userRole ? {
          role_type: userRole.role_type,
          organization_id: userRole.organization_id,
          site_ids: userRole.site_ids
        } : null,
        organization: organization ? {
          id: organization.id,
          organization_id: organization.organization_id,
          organization_name: organization.organization_name
        } : null
      })
    }
  }, [authLoading, multisiteLoading, profile, userRole, organization])

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

  // Only admins, koordinatorer and customers with multisite roles can access
  if (profile.role === 'admin' || profile.role === 'koordinator') {
    // Admins and koordinatorer can always access multisite (for management purposes)
    return <>{children}</>;
  }

  // For customer users, check if they have multisite access
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
      // CRITICAL FIX: Check if customer is multisite user before redirecting
      console.log('MultisiteProtectedRoute: Processing customer redirect logic', {
        customer_id: profile.customer_id,
        userRole: userRole ? userRole.role_type : 'none',
        organization: organization ? organization.organization_name : 'none'
      });
      
      if (!profile.customer_id && userRole && organization) {
        // Multisite user without customer_id but with valid multisite role -> go to main multisite portal
        console.log(`MultisiteProtectedRoute: Customer without customer_id but with multisite role ${userRole.role_type}. Redirecting to /organisation`);
        redirectPath = '/organisation';
      } else if (profile.customer_id && !userRole) {
        // Regular customer with customer_id but no multisite role -> go to customer portal
        console.log(`MultisiteProtectedRoute: Regular customer with customer_id ${profile.customer_id}. Redirecting to /customer`);
        redirectPath = '/customer';
      } else if (profile.customer_id && userRole && organization) {
        // Hybrid customer with both customer_id and multisite role -> this is a valid multisite user
        console.log(`MultisiteProtectedRoute: Hybrid customer with customer_id ${profile.customer_id} and multisite role ${userRole.role_type}. Allowing access to multisite.`);
        return <>{children}</>;
      } else {
        // Edge case: Customer without clear access pattern
        console.warn(`MultisiteProtectedRoute: Edge case - Customer with unclear access pattern`, {
          customer_id: profile.customer_id,
          hasUserRole: !!userRole,
          hasOrganization: !!organization
        });
        redirectPath = profile.customer_id ? '/customer' : '/login';
      }
      break;
  }

  console.log(`MultisiteProtectedRoute: Redirecting ${profile.role} user to ${redirectPath}`);
  return <Navigate to={redirectPath} replace />;
}