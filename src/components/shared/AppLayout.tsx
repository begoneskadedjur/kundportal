// src/components/shared/AppLayout.tsx
// Layout wrapper som visar AppHeader för interna användare

import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from './AppHeader';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Sidor som INTE ska ha header
const EXCLUDED_PATHS = [
  '/',
  '/login',
  '/set-password',
  '/forgot-password',
  '/reset-password',
];

// Prefix för portaler som har egen layout
const EXCLUDED_PREFIXES = [
  '/customer',
  '/organisation',
];

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  // Kolla om sidan ska exkluderas
  const isExcludedPath = EXCLUDED_PATHS.includes(location.pathname);
  const isExcludedPrefix = EXCLUDED_PREFIXES.some(prefix =>
    location.pathname.startsWith(prefix)
  );

  // Kolla om användaren är intern (admin/koordinator/tekniker)
  const isInternalUser = profile?.role &&
    ['admin', 'koordinator', 'technician'].includes(profile.role);

  // Visa ingen header om:
  // - Fortfarande laddar auth
  // - På exkluderad sida
  // - Inte intern användare
  const showHeader = !loading && !isExcludedPath && !isExcludedPrefix && isInternalUser;

  return (
    <>
      {showHeader && <AppHeader />}
      {children}
    </>
  );
}
