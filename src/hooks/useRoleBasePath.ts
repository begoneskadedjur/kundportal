// src/hooks/useRoleBasePath.ts
// Hjälpare för sidor som delas mellan rollvyerna (admin/koordinator/technician/saljare)

import { useLocation } from 'react-router-dom'

/** Rollprefix ur aktuell URL, t.ex. '/admin' eller '/technician' */
export function useRoleBasePath(): string {
  const location = useLocation()
  return '/' + location.pathname.split('/')[1]
}
