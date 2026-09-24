// src/lib/procurementPortal.ts
// Upphandlingsportalen som fristående plattform (docs/upphandlingsportal-plan.md
// avsnitt 6 och 13). Samma kodbas och Vercel-projekt som kundportalen, men på
// värdnamnet upphandling.begone.se renderas ett eget skal med egna routes på
// roten (/, /bevakning, /avtalsklocka, /:noticeId ...).
//
// Fristående läge gäller när
//   - värdnamnet är upphandling.begone.se, eller
//   - värdnamnet matchar VITE_PROCUREMENT_HOST (t.ex. upphandling.localhost), eller
//   - sidan öppnats med ?procurement=1 (sparas i sessionStorage för fliken,
//     ?procurement=0 stänger av). Bara för lokal utveckling och test.
//
// I adminportalen ligger samma sidor kvar under /admin/upphandlingar som
// reserv för utveckling. Alla länkar inne i sidorna byggs med procurementPath()
// så att de fungerar i båda lägena.

const DEFAULT_HOST = 'upphandling.begone.se'
const SESSION_KEY = 'begone_procurement_standalone'

/** Adressen till den fristående portalen, för länkar från adminportalen */
export const PROCUREMENT_PORTAL_URL: string =
  (import.meta.env.VITE_PROCUREMENT_PORTAL_URL as string | undefined)?.replace(/\/+$/, '') || `https://${DEFAULT_HOST}`

/** Kundportalen (adminportalen), för länkar ut ur den fristående portalen, t.ex. till Användarkonton */
export const MAIN_PORTAL_URL: string =
  (import.meta.env.VITE_MAIN_PORTAL_URL as string | undefined)?.replace(/\/+$/, '') || 'https://kundportal.vercel.app'

/** Adminportalens bas för upphandlingssidorna */
export const PROCUREMENT_ADMIN_BASE = '/admin/upphandlingar'

let cached: boolean | null = null

function readSessionFlag(): boolean | null {
  try {
    const v = window.sessionStorage.getItem(SESSION_KEY)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

function writeSessionFlag(on: boolean) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, on ? '1' : '0')
  } catch {
    // Privat läge eller blockerad lagring: flaggan gäller bara den här sidladdningen
  }
}

/** Sant när appen körs som den fristående upphandlingsportalen */
export function isProcurementStandalone(): boolean {
  if (cached != null) return cached
  if (typeof window === 'undefined') return (cached = false)
  const host = window.location.hostname.toLowerCase()
  const configured = String(import.meta.env.VITE_PROCUREMENT_HOST ?? '').toLowerCase().trim()
  if (host === DEFAULT_HOST || (configured && host === configured)) return (cached = true)

  const param = new URLSearchParams(window.location.search).get('procurement')
  if (param === '1') {
    writeSessionFlag(true)
    return (cached = true)
  }
  if (param === '0') {
    writeSessionFlag(false)
    return (cached = false)
  }
  return (cached = readSessionFlag() === true)
}

/** Bas för routes: tom i fristående läge, annars /admin/upphandlingar */
export function procurementBase(): string {
  return isProcurementStandalone() ? '' : PROCUREMENT_ADMIN_BASE
}

/**
 * Sökväg inne i upphandlingsportalen. procurementPath('/bevakning') blir
 * /bevakning i fristående läge och /admin/upphandlingar/bevakning i adminportalen.
 * procurementPath('') och procurementPath('/') ger startsidan (Marknad).
 */
export function procurementPath(sub = ''): string {
  const clean = !sub || sub === '/' ? '' : sub.startsWith('/') ? sub : `/${sub}`
  const base = procurementBase()
  if (!clean) return base || '/'
  return `${base}${clean}`
}

/** Fullständig adress i den fristående portalen, för länkar ut ur adminportalen */
export function procurementPortalUrl(sub = ''): string {
  const clean = !sub || sub === '/' ? '' : sub.startsWith('/') ? sub : `/${sub}`
  return `${PROCUREMENT_PORTAL_URL}${clean}`
}
