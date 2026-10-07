// api/samtycke.ts
// Bevis på cookiesamtycke från nya begone.se: cookiebannern loggar varje val hit (src/lib/samtycke.ts i
// repot begone-se) och raden sparas i cookie_consents. Webbläsaren skickar och glömmer (fire and forget),
// så svaret påverkar aldrig bannern.
//
// Publik endpoint utan inloggning, samma skydd som api/forfragan.ts:
//   1. CORS: bara begone.se, www.begone.se, förhandsvisningar för begone-se och localhost:4321
//      (api/_lib/begoneSeCors.ts). Annan eller saknad Origin ger 403.
//   2. Högst 2 kB. Kroppen skickas som text/plain (ingen preflight) eller application/json.
//   3. withinRateLimit per IP-hash (30 per 10 min). IP-adressen sparas aldrig, bara hashen i hastighetsnyckeln.
//   4. Validering: id (uuid), version, val per kategori, handling, lager, action och sökväg. Inga personuppgifter.
//      Landet tas ur Vercels x-vercel-ip-country; IP-adressen sparas aldrig. status räknas fram här.
//   5. Inga sidvisningar loggas, bara val.
//
// Anrop: POST { id, version, nodvandiga, statistik, marknadsforing, handling, lager, action, sida } -> 204
// Fel: { fel: 'origin' | 'metod' | 'for_stor' | 'format' | 'validering' | 'rate_limited' | 'serverfel', falt? }

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { satsBegoneSeCors } from './_lib/begoneSeCors'
import { clientIp, withinRateLimit } from './_lib/rateLimit'
import { hmac } from './_lib/forfragan'

export const config = { maxDuration: 10 }

const MAX_BYTES = 2048
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HANDLINGAR = new Set(['godkann_alla', 'neka', 'eget_val'])
const LAGER = new Set(['banner', 'installningar'])
const ATGARDER = new Set(['first_choice', 'changed', 'withdrawn'])
/**
 * Valbara kategorier som faktiskt används på sajten, för status: accepted när alla är godkända, partial när
 * några är det, rejected när ingen är det. Statistik (Google Analytics 4) sedan CONSENT_VERSION 3 (2026-10-07).
 */
const AKTIVA_KATEGORIER = ['statistik', 'marknadsforing'] as const

let db: SupabaseClient | null = null
function supabase(): SupabaseClient {
  if (db) return db
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const nyckel = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !nyckel) throw new Error('samtycke: Supabase-miljön saknas')
  db = createClient(url, nyckel, { auth: { autoRefreshToken: false, persistSession: false } })
  return db
}

function klientIp(req: VercelRequest): string {
  const real = req.headers['x-real-ip']
  if (typeof real === 'string' && real.trim()) return real.trim()
  return clientIp(req)
}

function lasKropp(req: VercelRequest): Record<string, unknown> | null {
  let b: unknown = req.body
  if (Buffer.isBuffer(b)) b = b.toString('utf8')
  if (typeof b === 'string') {
    if (b.length > MAX_BYTES) return null
    try {
      b = JSON.parse(b)
    } catch {
      return null
    }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null
  return b as Record<string, unknown>
}

export class SamtyckesFel extends Error {
  constructor(public falt: string) {
    super(`validering:${falt}`)
  }
}

/** Kontrollerar kroppen och översätter den till en rad i cookie_consents. Kastar SamtyckesFel. */
export function valideraSamtycke(body: Record<string, unknown>) {
  const id = String(body.id ?? '')
  if (!UUID.test(id)) throw new SamtyckesFel('id')
  const version = Number(body.version)
  if (!Number.isInteger(version) || version < 1 || version > 1000) throw new SamtyckesFel('version')
  if (typeof body.statistik !== 'boolean') throw new SamtyckesFel('statistik')
  if (typeof body.marknadsforing !== 'boolean') throw new SamtyckesFel('marknadsforing')
  const handling = String(body.handling ?? '')
  if (!HANDLINGAR.has(handling)) throw new SamtyckesFel('handling')
  const lager = String(body.lager ?? '')
  if (!LAGER.has(lager)) throw new SamtyckesFel('lager')
  // Bara sökvägen, aldrig frågesträng eller ankare (där kan klick-id och förval stå)
  let sida: string | null = null
  if (typeof body.sida === 'string' && /^\/[^\s?#]{0,299}$/.test(body.sida)) sida = body.sida
  // Saknas action (äldre sajtversion) räknas valet som första valet
  const action = body.action == null ? 'first_choice' : String(body.action)
  if (!ATGARDER.has(action)) throw new SamtyckesFel('action')
  const val: Record<string, boolean> = { statistik: body.statistik === true, marknadsforing: body.marknadsforing === true }
  const ja = AKTIVA_KATEGORIER.filter((k) => val[k]).length
  const status = ja === 0 ? 'rejected' : ja === AKTIVA_KATEGORIER.length ? 'accepted' : 'partial'
  return {
    samtyckes_id: id.toLowerCase(),
    version,
    nodvandiga: true,
    statistik: body.statistik === true,
    marknadsforing: body.marknadsforing === true,
    handling,
    lager,
    sida,
    status,
    action,
  }
}

/** Landskoden ur Vercels header. IP-adressen läses aldrig för det här. */
function land(req: VercelRequest): string | null {
  const v = req.headers['x-vercel-ip-country']
  const s = (Array.isArray(v) ? v[0] : v ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(s) ? s : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const tillaten = satsBegoneSeCors(req, res)
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(tillaten ? 204 : 403).end()
  if (!tillaten) return res.status(403).json({ fel: 'origin' })
  if (req.method !== 'POST') return res.status(405).json({ fel: 'metod' })

  const langd = Number(req.headers['content-length'] || 0)
  if (langd > MAX_BYTES) return res.status(413).json({ fel: 'for_stor' })
  const body = lasKropp(req)
  if (!body) return res.status(400).json({ fel: 'format' })

  let rad
  try {
    rad = valideraSamtycke(body)
  } catch (e) {
    if (e instanceof SamtyckesFel) return res.status(400).json({ fel: 'validering', falt: e.falt })
    return res.status(400).json({ fel: 'format' })
  }

  const ipHash = hmac(klientIp(req), 'samtycke-ip')
  if (!(await withinRateLimit('samtycke:ip:' + ipHash, 30, 600))) return res.status(429).json({ fel: 'rate_limited' })

  try {
    const ins = await supabase().from('cookie_consents').insert({ ...rad, country: land(req) })
    if (ins.error) {
      console.error('[samtycke] kunde inte spara', ins.error.code)
      return res.status(500).json({ fel: 'serverfel' })
    }
    return res.status(204).end()
  } catch {
    console.error('[samtycke] oväntat fel')
    return res.status(500).json({ fel: 'serverfel' })
  }
}
