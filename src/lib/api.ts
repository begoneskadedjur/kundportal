// src/lib/api.ts - Central API-hjälpare för anrop till /api-endpoints
// (docs/sakerhetsplan-api-auth-vag2.md, etapp 1)
//
// Semantik som gör utrullningen noll-störnings-säker:
//  - Session finns  → Authorization: Bearer <token> bifogas automatiskt
//  - Session saknas → anropet skickas ÄNDÅ, utan header (kastar aldrig, till
//    skillnad från getAuthHeaders) — beteendet mot en ännu oskyddad endpoint
//    är därmed identiskt med ett vanligt fetch-anrop
//  - 401-svar → exakt ETT försök med refreshSession + omsänt anrop (fångar
//    utgången token i långlivade flikar), annars returneras svaret orört så
//    att anroparens befintliga felhantering tar vid
//
// Använd apiFetch för ALLA anrop till /api/* — ESLint-regeln no-restricted-syntax
// stoppar nya nakna fetch('/api/…'). Publika undantag (lösenordsflöden) är
// listade i eslint-konfigurationen.
import { supabase } from './supabase'

async function buildHeaders(init: RequestInit, token: string | null): Promise<Headers> {
  const headers = new Headers(init.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type') && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  } catch {
    return null
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: await buildHeaders(init, await getAccessToken())
  })

  if (response.status !== 401) return response

  // Ett refresh-försök — utgången token i en flik som stått öppen länge
  try {
    const { data: { session } } = await supabase.auth.refreshSession()
    if (session?.access_token) {
      return fetch(input, {
        ...init,
        headers: await buildHeaders(init, session.access_token)
      })
    }
  } catch {
    // refresh misslyckades — låt ursprungssvaret gå tillbaka till anroparen
  }
  return response
}
