// src/hooks/useRoleBasePath.ts
// Hjälpare för sidor som delas mellan rollvyerna (admin/koordinator/technician/saljare)

import { useLocation } from 'react-router-dom'

/** Rollprefix ur aktuell URL, t.ex. '/admin' eller '/technician' */
export function useRoleBasePath(): string {
  const location = useLocation()
  return '/' + location.pathname.split('/')[1]
}

/** Skriv om en guide-sökväg till aktuellt rollprefix */
export function guidePathForRole(guideId: string, basePath: string): string {
  if (basePath === '/admin') return `/admin/larosate/guides/${guideId}`
  return `${basePath}/guides/${guideId}`
}
