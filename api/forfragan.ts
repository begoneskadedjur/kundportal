// api/forfragan.ts
// Leads (Webb): tar emot förfrågningar från formulären på nya begone.se (offertflödet på /prisforslag/,
// startsidan, kontakt, företag, tjänstesidorna och artanalysens formulär) och sparar dem i web_inquiries,
// skilt från B2B-leadsen i tabellen leads. Plan: docs/begone-se/forfragningar-plan.md.
//
// Publik endpoint utan inloggning (undantaget står i docs/sakerhetsplan-api-auth-vag2.md). Skydden:
//   1. CORS: bara begone.se, www.begone.se, förhandsvisningar för begone-se och localhost:4321
//      (api/_lib/begoneSeCors.ts). Annan eller saknad Origin ger 403.
//   2. Högst 32 kB JSON. Bilderna går aldrig genom funktionen: API:t svarar med signerade
//      uppladdnings-URL:er och webbläsaren laddar upp direkt till den privata bucketen.
//   3. Honungsfältet website och minsta tid 3 s: svar 200 { ok: true } utan id, inget sparas.
//   4. withinRateLimit per IP-hash (5 per 10 min, 20 per dygn) och per telefon (3 per timme).
//   5. Validering i api/_lib/forfragan.ts. Inga personuppgifter i loggar.
//
// Anrop:
//   POST { ...förfrågan, bilder?: [{ mime, bytes }] }  -> 200 { ok, id, referens, uppladdning: [{ path, signedUrl }] }
//   POST { id, steg: 'bilder_klara' }                   -> 200 { ok, antal }
// Fel: { fel: 'origin' | 'metod' | 'for_stor' | 'format' | 'validering' | 'rate_limited' | 'serverfel', falt? }

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { satsBegoneSeCors } from './_lib/begoneSeCors'
import { clientIp, withinRateLimit } from './_lib/rateLimit'
import {
  BUCKET,
  TILLATNA_MIME,
  ValideringsFel,
  arRobot,
  hmac,
  notifieraKoordinatorer,
  skickaKvittens,
  validera,
  type Kundgrupp,
} from './_lib/forfragan'

export const config = { maxDuration: 15 }

const MAX_BYTES = 32 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let db: SupabaseClient | null = null
function supabase(): SupabaseClient {
  if (db) return db
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const nyckel = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !nyckel) throw new Error('forfragan: Supabase-miljön saknas')
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
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b)
    } catch {
      return null
    }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null
  return b as Record<string, unknown>
}

/** Steg 2: webbläsaren har laddat upp. Markera vilka filer som finns. */
async function bilderKlara(id: string, res: VercelResponse) {
  const s = supabase()
  const { data: rad, error } = await s.from('web_inquiries').select('id, bilder, created_at').eq('id', id).maybeSingle()
  if (error) {
    console.error('[forfragan] bilder_klara: läsfel', error.code)
    return res.status(500).json({ fel: 'serverfel' })
  }
  // Bara nyss skapade förfrågningar (de signerade URL:erna gäller i två timmar)
  if (!rad || Date.now() - new Date(rad.created_at as string).getTime() > 3 * 3600 * 1000) {
    return res.status(404).json({ fel: 'saknas' })
  }
  const lista = await s.storage.from(BUCKET).list(id, { limit: 20 })
  if (lista.error) {
    console.error('[forfragan] bilder_klara: listfel', id)
    return res.status(500).json({ fel: 'serverfel' })
  }
  const finns = new Set((lista.data ?? []).map((f) => `${id}/${f.name}`))
  const bilder = (Array.isArray(rad.bilder) ? rad.bilder : []) as { path: string; uppladdad?: boolean }[]
  const nya = bilder.map((b) => ({ ...b, uppladdad: finns.has(b.path) }))
  const antal = nya.filter((b) => b.uppladdad).length
  const upd = await s.from('web_inquiries').update({ bilder: nya }).eq('id', id)
  if (upd.error) {
    console.error('[forfragan] bilder_klara: skrivfel', upd.error.code)
    return res.status(500).json({ fel: 'serverfel' })
  }
  if (antal > 0) {
    await s.from('web_inquiry_events').insert({
      inquiry_id: id,
      typ: 'bilder',
      text: antal === 1 ? '1 bild uppladdad' : `${antal} bilder uppladdade`,
    })
  }
  console.log('[forfragan] bilder klara', id, antal)
  return res.status(200).json({ ok: true, antal })
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
  if (JSON.stringify(body).length > MAX_BYTES) return res.status(413).json({ fel: 'for_stor' })

  const ipHash = hmac(klientIp(req), 'ip')

  // Steg 2: bilderna uppladdade
  if (body.steg === 'bilder_klara') {
    const id = String(body.id ?? '')
    if (!UUID.test(id)) return res.status(400).json({ fel: 'format' })
    if (!(await withinRateLimit('forfragan:bilder:' + ipHash, 10, 600))) return res.status(429).json({ fel: 'rate_limited' })
    try {
      return await bilderKlara(id, res)
    } catch {
      console.error('[forfragan] bilder_klara: oväntat fel')
      return res.status(500).json({ fel: 'serverfel' })
    }
  }

  // Robotar får samma svar som ett lyckat inskick, men inget sparas och inget skickas
  if (arRobot(body)) return res.status(200).json({ ok: true })

  let validerad
  try {
    validerad = validera(body)
  } catch (e) {
    if (e instanceof ValideringsFel) return res.status(400).json({ fel: 'validering', falt: e.falt })
    return res.status(400).json({ fel: 'format' })
  }
  const { rad, bilder, fornamn } = validerad

  const telHash = hmac(String(rad.phone), 'tel')
  const [ip10, ipDygn, tel] = await Promise.all([
    withinRateLimit('forfragan:ip:' + ipHash, 5, 600),
    withinRateLimit('forfragan:ip-dygn:' + ipHash, 20, 86400),
    withinRateLimit('forfragan:tel:' + telHash, 3, 3600),
  ])
  if (!ip10 || !ipDygn || !tel) return res.status(429).json({ fel: 'rate_limited' })

  try {
    const s = supabase()
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null
    const ins = await s
      .from('web_inquiries')
      .insert({ ...rad, ip_hash: ipHash, user_agent: ua })
      .select('id, referens')
      .single()
    if (ins.error || !ins.data) {
      console.error('[forfragan] kunde inte spara', ins.error?.code)
      return res.status(500).json({ fel: 'serverfel' })
    }
    const id = ins.data.id as string
    const referens = ins.data.referens as string

    // Signerade uppladdnings-URL:er (gäller två timmar). Texten är redan sparad om något fallerar här.
    const uppladdning: { path: string; signedUrl: string }[] = []
    const bildRader: { path: string; mime: string; bytes: number; uppladdad: boolean }[] = []
    for (let i = 0; i < bilder.length; i++) {
      const b = bilder[i]
      const path = `${id}/${i + 1}.${TILLATNA_MIME[b.mime]}`
      const sign = await s.storage.from(BUCKET).createSignedUploadUrl(path)
      if (sign.error || !sign.data) {
        console.warn('[forfragan] signerad URL saknas', id, i + 1)
        continue
      }
      uppladdning.push({ path, signedUrl: sign.data.signedUrl })
      bildRader.push({ path, mime: b.mime, bytes: b.bytes, uppladdad: false })
    }
    if (bildRader.length) {
      const upd = await s.from('web_inquiries').update({ bilder: bildRader }).eq('id', id)
      if (upd.error) console.warn('[forfragan] bildraderna kunde inte sparas', upd.error.code)
    }

    // Kvittens och notis stoppar aldrig svaret till sajten
    const efter: Promise<unknown>[] = []
    if (typeof rad.email === 'string' && rad.email) {
      efter.push(
        skickaKvittens({
          till: rad.email,
          fornamn,
          referens,
          pest: (rad.pest_type as string | null) ?? null,
          foretag: (rad.company_name as string | null) ?? null,
        }).then(async (ok) => {
          if (ok) await s.from('web_inquiries').update({ kvittens_skickad_at: new Date().toISOString() }).eq('id', id)
        }),
      )
    }
    efter.push(
      notifieraKoordinatorer(s, {
        id,
        pest: (rad.pest_type as string | null) ?? null,
        city: (rad.city as string | null) ?? null,
        akut: rad.akut === true,
        kundgrupp: rad.kundgrupp as Kundgrupp,
        kalla: String(rad.kalla),
        fran: (rad.fran as string | null) ?? null,
      }),
    )
    await Promise.allSettled(efter)

    console.log('[forfragan] sparad', id, 'bilder', uppladdning.length)
    return res.status(200).json({ ok: true, id, referens, uppladdning })
  } catch {
    console.error('[forfragan] oväntat fel')
    return res.status(500).json({ fel: 'serverfel' })
  }
}
