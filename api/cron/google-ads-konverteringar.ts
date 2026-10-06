// api/cron/google-ads-konverteringar.ts
// Nattjobb: laddar upp bokade och genomförda uppdrag från Leads (Webb) till Google Ads som
// offline-konverteringar ("Bokat uppdrag (kundportalen)" och "Genomfört uppdrag (kundportalen)").
// Godkänt av Christian 2026-10-06. Bara förfrågningar med samtycke till marknadsföring.
//
// Urval och värden (exkl. moms) räknas i google_ads_konverteringar_urval(), se migrationen
// 20261006_google_ads_konverteringar.sql. Uppladdningen går via Data Manager API, se
// api/_lib/googleAdsKonverteringar.ts. Varje förfrågan och typ laddas upp en gång: raden i
// google_ads_konverteringar (uppladdad, hoppad eller fel; fel försöks igen högst tre gånger) och
// transactionId '<inquiry_id>-<typ>' i Ads. Konverteringar mer än 89 dagar efter förfrågan hoppas över.
//
// Saknas konverteringsåtgärderna i kontot loggas det och jobbet avslutas utan fel.
// Varje körning hämtar också bearbetningens utfall (requestStatus) för tidigare anrop.
//
// Torrkörning: ?torr=1 eller GOOGLE_ADS_KONVERTERINGAR_TORR=1. Då skrivs ingenting i databasen och
// anropet görs med validateOnly; svaret listar urvalet utan personuppgifter.
//
// Körs 05:45 UTC via Vercel Cron, efter web-inquiries-utfall (05:30) som sätter Vunnen.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withCronLog } from '../_lib/cronLogger'
import { requireCronSecret } from '../_lib/cronAuth'
import {
  ATGARDSNAMN,
  byggKonvertering,
  hamtaAccessToken,
  hamtaAtgarder,
  hamtaRequestStatus,
  laddaUpp,
  saknadeMiljovariabler,
  svenskTidMedOffset,
  transaktionsId,
  valjKlickId,
  type Konvertering,
  type KonverteringsTyp,
  type UrvalsRad,
} from '../_lib/googleAdsKonverteringar'

export const config = { maxDuration: 60 }

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type PerTyp = { skickade: number; ok: number; fel: number; hoppade: number; utan_varde: number }

interface Sammanfattning {
  torr: boolean
  urval: number
  per_typ: Record<KonverteringsTyp, PerTyp>
  per_klick_id: Record<string, number>
  request_status?: Record<string, number>
  meddelande?: string
  /** Bara vid torrkörning: urvalet utan personuppgifter. */
  rader?: Array<{ ref: string; typ: KonverteringsTyp; klick_id: string; varde: number | null; tid: string; fel?: string }>
}

const tomPerTyp = (): PerTyp => ({ skickade: 0, ok: 0, fel: 0, hoppade: 0, utan_varde: 0 })

interface SparRad {
  rad: UrvalsRad
  klickIdTyp: string
  varde: number | null
  tidpunkt: string
}

async function sparaRad(k: SparRad, status: 'uppladdad' | 'fel' | 'hoppad', fel: string | null, requestId: string | null) {
  const nu = new Date().toISOString()
  const { error } = await supabase.from('google_ads_konverteringar').upsert(
    {
      inquiry_id: k.rad.inquiry_id,
      typ: k.rad.typ,
      klick_id_typ: k.klickIdTyp,
      varde: k.varde,
      conversion_date_time: k.tidpunkt,
      order_id: transaktionsId(k.rad),
      status,
      forsok: (k.rad.forsok ?? 0) + 1,
      uppladdad_at: status === 'uppladdad' ? nu : null,
      request_id: requestId,
      request_status: null,
      fel,
      updated_at: nu,
    },
    { onConflict: 'inquiry_id,typ' },
  )
  if (error) console.error('[google-ads-konverteringar] Kunde inte spara rad:', error.message)
}

const enkelRad = (rad: UrvalsRad): SparRad => ({
  rad,
  klickIdTyp: valjKlickId(rad).typ,
  varde: rad.varde == null ? null : Number(rad.varde),
  tidpunkt: svenskTidMedOffset(rad.tidpunkt),
})

/** Hämtar bearbetningens utfall för anrop de senaste sju dygnen som inte har ett slutligt utfall. */
async function uppdateraRequestStatus(token: string, s: Sammanfattning) {
  const sedan = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const { data } = await supabase
    .from('google_ads_konverteringar')
    .select('request_id')
    .eq('status', 'uppladdad')
    .not('request_id', 'is', null)
    .or('request_status.is.null,request_status.eq.PROCESSING,request_status.eq.OKAND')
    .gte('uppladdad_at', sedan)
  const ids = [...new Set((data ?? []).map((r: { request_id: string }) => r.request_id))]
  if (!ids.length) return
  s.request_status = {}
  for (const id of ids) {
    const r = await hamtaRequestStatus(token, id)
    s.request_status[r.status] = (s.request_status[r.status] ?? 0) + 1
    await supabase
      .from('google_ads_konverteringar')
      .update({ request_status: r.status, svar: r.svar as object, updated_at: new Date().toISOString() })
      .eq('request_id', id)
  }
}

async function kor(torr: boolean): Promise<Sammanfattning> {
  const s: Sammanfattning = { torr, urval: 0, per_typ: { bokat: tomPerTyp(), genomfort: tomPerTyp() }, per_klick_id: {} }

  const { data, error } = await supabase.rpc('google_ads_konverteringar_urval')
  if (error) throw error
  const urval = (data ?? []) as UrvalsRad[]
  s.urval = urval.length
  if (torr) s.rader = []
  const torrRad = (k: SparRad, fel?: string) =>
    s.rader?.push({ ref: k.rad.inquiry_id.slice(0, 8), typ: k.rad.typ, klick_id: k.klickIdTyp, varde: k.varde, tid: k.tidpunkt, ...(fel ? { fel } : {}) })

  // För gamla (mer än 89 dagar efter förfrågan): markeras som hoppade, skickas aldrig.
  const aktuella: UrvalsRad[] = []
  for (const rad of urval) {
    if (!rad.for_gammal) {
      aktuella.push(rad)
      continue
    }
    s.per_typ[rad.typ].hoppade++
    if (torr) torrRad(enkelRad(rad), 'för gammal, hoppas över')
    else await sparaRad(enkelRad(rad), 'hoppad', 'Mer än 89 dagar efter förfrågan', null)
  }

  const saknas = saknadeMiljovariabler()
  if (saknas.length) {
    s.meddelande = `Google Ads-variabler saknas i miljön: ${saknas.join(', ')}`
    console.warn('[google-ads-konverteringar]', s.meddelande)
    return s
  }

  const token = await hamtaAccessToken()
  if (!torr) await uppdateraRequestStatus(token, s)

  if (!aktuella.length) {
    s.meddelande = 'Inget att ladda upp'
    return s
  }

  const atgarder = await hamtaAtgarder(token)
  const saknadeAtgarder = (Object.keys(ATGARDSNAMN) as KonverteringsTyp[]).filter((t) => !atgarder[t])
  if (saknadeAtgarder.length) {
    s.meddelande = `Konverteringsåtgärden saknas eller är inte aktiv i kontot: ${saknadeAtgarder.map((t) => ATGARDSNAMN[t]).join(', ')}`
    console.warn('[google-ads-konverteringar]', s.meddelande)
  }

  for (const typ of Object.keys(ATGARDSNAMN) as KonverteringsTyp[]) {
    const rader = aktuella.filter((r) => r.typ === typ)
    const atgard = atgarder[typ]
    if (!rader.length) continue
    if (!atgard) {
      // Raden lämnas orörd och tas med när åtgärden finns.
      for (const rad of rader) torrRad(enkelRad(rad), 'åtgärden saknas i kontot')
      continue
    }
    const konverteringar: Konvertering[] = []
    for (const rad of rader) {
      const k = byggKonvertering(rad)
      if (k) konverteringar.push(k)
      else {
        s.per_typ[typ].hoppade++
        if (torr) torrRad(enkelRad(rad), 'varken klick-id eller giltig e-post/telefon')
        else await sparaRad(enkelRad(rad), 'hoppad', 'Varken klick-id eller giltig e-post/telefon', null)
      }
    }

    // Högst 2 000 händelser per anrop
    for (let i = 0; i < konverteringar.length; i += 2000) {
      const del = konverteringar.slice(i, i + 2000)
      const res = await laddaUpp(token, atgard, del.map((k) => k.event), torr)
      for (let j = 0; j < del.length; j++) {
        const k = del[j]!
        const t = s.per_typ[typ]
        t.skickade++
        if (k.varde == null) t.utan_varde++
        s.per_klick_id[k.klickIdTyp] = (s.per_klick_id[k.klickIdTyp] ?? 0) + 1
        const fel = res.helaAnropetFel ?? res.felPerIndex.get(j) ?? null
        if (fel) t.fel++
        else t.ok++
        if (torr) torrRad(k, fel ?? undefined)
        else await sparaRad(k, fel ? 'fel' : 'uppladdad', fel, fel ? null : res.requestId)
      }
      if (res.helaAnropetFel) s.meddelande = `Anropet till Google avvisades: ${res.helaAnropetFel}`
    }
  }
  return s
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const q = req.query?.torr
  const torr = q === '1' || q === 'true' || process.env.GOOGLE_ADS_KONVERTERINGAR_TORR === '1'

  const result = await withCronLog('google-ads-konverteringar', async () => {
    const summary = await kor(torr)
    const fel = summary.per_typ.bokat.fel + summary.per_typ.genomfort.fel
    const ok = summary.per_typ.bokat.ok + summary.per_typ.genomfort.ok
    return {
      status: (fel && !ok ? 'failed' : fel ? 'partial' : 'success') as 'failed' | 'partial' | 'success',
      summary,
      ...(fel ? { errorMessage: summary.meddelande ?? `${fel} konverteringar underkändes` } : {}),
    }
  })

  return res
    .status(result.status === 'failed' ? 500 : 200)
    .json({ success: result.status !== 'failed', ...result.summary, error: result.errorMessage })
}
