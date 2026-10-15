// src/pages/procurement/legacyRoutes.tsx
// Gamla adresser i upphandlingsportalen som måste fungera för alltid
// (docs/upphandlingsportal-ux-plan.md avsnitt 8): /:noticeId från mejl och
// notiser, /bevakning från före 3.63.0 och /admin/upphandlingar/* på
// subdomänen. Används av både det fristående skalet och adminportalens reserv.

import { Navigate, useLocation, useParams } from 'react-router-dom'
import { UUID_RE, noticePath, procurementPath } from '../../lib/procurementPortal'

/**
 * /:noticeId: bara ett uuid tolkas som en upphandling och skickas vidare till
 * /upphandling/:noticeId. Allt annat på roten (ett felstavat ord) går till Idag
 * i stället för att ge "Upphandlingen finns inte".
 */
export function LegacyNoticeRedirect() {
  const { noticeId } = useParams<{ noticeId: string }>()
  const { search, hash } = useLocation()
  if (!noticeId || !UUID_RE.test(noticeId)) return <Navigate to={procurementPath('')} replace />
  return <Navigate to={`${noticePath(noticeId)}${search}${hash}`} replace />
}

/** /bevakning blev /annonser i 3.63.0 */
export function WatchRedirect() {
  const { search } = useLocation()
  return <Navigate to={`${procurementPath('/annonser')}${search}`} replace />
}

/** /admin/upphandlingar/x på subdomänen blir /x (gamla länkar före subdomänen) */
export function AdminPrefixRedirect() {
  const rest = window.location.pathname.replace(/^\/admin\/upphandlingar/, '') || '/'
  return <Navigate to={rest + window.location.search} replace />
}
