// api/mejlassistent-gemini.ts
// AI-tjänst för Mejlassistenten (det lokala programmet i C:\Users\<namn>\Mejlassistent).
// Programmet har ingen egen Gemini-nyckel. Det skickar sin Microsoft 365-inloggning hit,
// och den här funktionen anropar Gemini med serverns nyckel (GOOGLE_AI_API_KEY).
//
// POST { modell, systemInstruction, contents, generationConfig }
//   Authorization: Bearer <Microsoft Graph-token från Mejlassistenten>
// Svar: Geminis generateContent-svar oförändrat (inklusive usageMetadata).
//
// Skydd:
//   - Token måste vara utfärdad i BeGones katalog till appen Mejlassistent och
//     godkännas av Microsoft Graph (/me). Förfalskade eller utgångna token nekas.
//   - Bara modeller i MODELLER, högst MAX_TECKEN tecken in och MAX_UT tokens ut.
//   - Enkel takt per användare och serverinstans.
//   - Mejltext loggas aldrig, bara användare, modell och antal tokens.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'

export const config = { maxDuration: 60 }

const TENANT = '0b84f71c-5c22-433a-9eee-6f9744976e8f'
const CLIENT_ID = '3fb6abf6-b71f-470f-87d0-b1ddbf971405'
const MODELLER = new Set(['gemini-3-flash-preview'])
const MAX_TECKEN = 300_000
const MAX_UT = 16_384
const PER_MINUT = 30

type Godkand = { anvandare: string; till: number }
const godkanda = new Map<string, Godkand>()
const takt = new Map<string, number[]>()

function lasJwt(token: string): Record<string, unknown> | null {
  try {
    const del = token.split('.')[1]
    return JSON.parse(Buffer.from(del.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch {
    return null
  }
}

async function kontrollera(token: string): Promise<string | null> {
  const nyckel = createHash('sha256').update(token).digest('hex')
  const kand = godkanda.get(nyckel)
  if (kand && kand.till > Date.now()) return kand.anvandare

  const p = lasJwt(token)
  if (!p) return null
  const exp = Number(p.exp) * 1000
  if (p.tid !== TENANT || (p.appid ?? p.azp) !== CLIENT_ID || !(exp > Date.now())) return null

  // Microsoft kontrollerar signaturen: bara äkta token ger svar från Graph
  const r = await fetch('https://graph.microsoft.com/v1.0/me?$select=userPrincipalName', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  const jag = (await r.json()) as { userPrincipalName?: string }
  const anvandare = String(jag.userPrincipalName || p.upn || 'okänd').toLowerCase()
  godkanda.set(nyckel, { anvandare, till: Math.min(exp, Date.now() + 30 * 60_000) })
  if (godkanda.size > 500) godkanda.clear()
  return anvandare
}

function inomTakt(anvandare: string): boolean {
  const nu = Date.now()
  const senaste = (takt.get(anvandare) || []).filter(t => nu - t < 60_000)
  if (senaste.length >= PER_MINUT) return false
  senaste.push(nu)
  takt.set(anvandare, senaste)
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ fel: 'Bara POST' })
  const nyckel = process.env.GOOGLE_AI_API_KEY
  if (!nyckel) return res.status(500).json({ fel: 'AI är inte konfigurerat på servern' })

  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const anvandare = token ? await kontrollera(token) : null
  if (!anvandare) return res.status(401).json({ fel: 'Logga in med Microsoft 365 i Mejlassistenten igen' })
  if (!inomTakt(anvandare)) return res.status(429).json({ fel: 'För många AI-anrop på kort tid, vänta en minut' })

  const { modell, systemInstruction, contents, generationConfig } = (req.body || {}) as Record<string, unknown>
  if (typeof modell !== 'string' || !MODELLER.has(modell)) return res.status(400).json({ fel: 'Modellen är inte tillåten' })
  if (!Array.isArray(contents)) return res.status(400).json({ fel: 'contents saknas' })
  if (JSON.stringify({ systemInstruction, contents }).length > MAX_TECKEN) return res.status(413).json({ fel: 'För mycket text i ett anrop' })

  const konfig = { ...((generationConfig as Record<string, unknown>) || {}) }
  konfig.maxOutputTokens = Math.min(Number(konfig.maxOutputTokens) || MAX_UT, MAX_UT)

  try {
    const svar = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modell}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': nyckel },
      body: JSON.stringify({ systemInstruction, contents, generationConfig: konfig }),
    })
    const data = (await svar.json()) as { usageMetadata?: Record<string, number> }
    const u = data.usageMetadata || {}
    console.log(`[mejlassistent] ${anvandare} ${modell} in=${u.promptTokenCount ?? 0} ut=${(u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0)} status=${svar.status}`)
    return res.status(svar.status).json(data)
  } catch (e) {
    console.error('[mejlassistent] Gemini-fel', e instanceof Error ? e.message : e)
    return res.status(502).json({ fel: 'Kunde inte nå Gemini' })
  }
}
