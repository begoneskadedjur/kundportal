// src/hooks/useProcurementAccess.ts
// Åtkomst till upphandlingsportalen (/admin/upphandlingar): admin har alltid
// åtkomst, övriga när profiles.is_procurement_manager är satt under
// Användarkonton (Personal). Samma regel som has_procurement_access() i databasen.

import { useAuth } from '../contexts/AuthContext'

export function hasProcurementAccess(profile: { is_admin?: boolean; role?: string | null; is_procurement_manager?: boolean; extra_roles?: string[] | null } | null): boolean {
  if (!profile) return false
  return (
    profile.is_admin === true ||
    profile.role === 'admin' ||
    profile.is_procurement_manager === true ||
    (profile.extra_roles ?? []).includes('admin')
  )
}

export function useProcurementAccess(): { allowed: boolean; loading: boolean; isManager: boolean } {
  const { profile, loading } = useAuth()
  return {
    allowed: hasProcurementAccess(profile),
    loading,
    isManager: profile?.is_procurement_manager === true,
  }
}
