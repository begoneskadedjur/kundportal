// api/cron/sync-google-reviews.ts
// Nattlig hämtning av Begones Google-omdömen till Supabase (vercel.json, 03:45 UTC).
// Nya begone.se läser google_place_stats och google_reviews vid bygget via
// Supabase REST med den publika anon-nyckeln.
//
// Places API (New), Place Details med languageCode=sv. Google returnerar högst
// fem omdömen per anrop, så tabellen växer över tid när nya omdömen dyker upp.
// Nyckeln läses ur process.env.GOOGLE_MAPS_API_KEY och loggas ALDRIG.
//
// Place ID läses ur GOOGLE_PLACE_ID med fallback till konstanten nedan (härledd
// ur CID 8285488030404856972, ej verifierad). Svarar Google NOT_FOUND eller
// INVALID_ARGUMENT görs en Text Search på "Begone Skadedjur" och träffarna
// loggas så att rätt ID kan sättas i GOOGLE_PLACE_ID. Inget sparas automatiskt.
//
// Manuell körning: curl -H "Authorization: Bearer $CRON_SECRET" https://<domän>/api/cron/sync-google-reviews

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'

export const config = { maxDuration: 60 }

const DEFAULT_PLACE_ID = 'ChIJpy8_jCfYNY8RjEwIG3f3-3I'
const DETAILS_FIELD_MASK = 'id,displayName,rating,userRatingCount,googleMapsUri,reviews'
const SEARCH_FIELD_MASK = 'places.id,places.displayName,places.rating,places.userRatingCount'
const LOG = '[sync-google-reviews]'

interface GoogleError {
  error?: { code?: number; status?: string; message?: string }
}

interface GoogleReview {
  name?: string
  rating?: number
  relativePublishTimeDescription?: string
  publishTime?: string
  text?: { text?: string; languageCode?: string }
  originalText?: { text?: string; languageCode?: string }
  authorAttribution?: { displayName?: string }
}

interface GooglePlace {
  id?: string
  displayName?: { text?: string }
  rating?: number
  userRatingCount?: number
  googleMapsUri?: string
  reviews?: GoogleReview[]
}

interface Candidate {
  id?: string
  namn?: string
  betyg?: number
  antal?: number
}

interface SyncSummary {
  place_id: string
  betyg?: number | null
  antal_omdomen?: number | null
  omdomen_sparade?: number
  google_status?: string
  kandidater?: Candidate[]
}

interface GoogleApiError {
  httpStatus: number
  googleStatus: string
  message: string
}

async function readGoogleError(resp: Response): Promise<GoogleApiError> {
  let body: GoogleError = {}
  try {
    body = (await resp.json()) as GoogleError
  } catch {
    // svaret var inte JSON
  }
  return {
    httpStatus: resp.status,
    googleStatus: body.error?.status ?? `HTTP_${resp.status}`,
    message: body.error?.message ?? resp.statusText,
  }
}

async function searchCandidates(apiKey: string): Promise<Candidate[]> {
  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: 'Begone Skadedjur', languageCode: 'sv', regionCode: 'SE' }),
  })
  if (!resp.ok) {
    const err = await readGoogleError(resp)
    console.error(`${LOG} Text Search misslyckades: ${err.googleStatus} (${err.httpStatus}): ${err.message}`)
    return []
  }
  const data = (await resp.json()) as { places?: GooglePlace[] }
  const candidates: Candidate[] = (data.places ?? []).map((p) => ({
    id: p.id,
    namn: p.displayName?.text,
    betyg: p.rating,
    antal: p.userRatingCount,
  }))
  if (candidates.length === 0) {
    console.warn(`${LOG} Text Search "Begone Skadedjur" gav inga träffar`)
  }
  for (const c of candidates) {
    console.warn(`${LOG} Kandidat: id=${c.id} namn="${c.namn}" betyg=${c.betyg ?? '-'} antal=${c.antal ?? '-'}`)
  }
  console.warn(`${LOG} Sätt rätt ID i env GOOGLE_PLACE_ID. Inget har sparats.`)
  return candidates
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error(`${LOG} GOOGLE_MAPS_API_KEY saknas i miljön`)
    return res.status(503).json({ status: 'failed', error: 'GOOGLE_MAPS_API_KEY är inte konfigurerad' })
  }
  const placeId = (process.env.GOOGLE_PLACE_ID || DEFAULT_PLACE_ID).trim()

  let googleFailed = false
  const result = await withCronLog<SyncSummary>('sync-google-reviews', async () => {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=sv`
    const resp = await fetch(url, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
    })

    if (!resp.ok) {
      const err = await readGoogleError(resp)
      console.error(
        `${LOG} Place Details misslyckades för place_id=${placeId}: ${err.googleStatus} (${err.httpStatus}): ${err.message}`,
      )
      const summary: SyncSummary = { place_id: placeId, google_status: err.googleStatus }
      if (err.googleStatus === 'NOT_FOUND' || err.googleStatus === 'INVALID_ARGUMENT') {
        console.warn(`${LOG} Place ID ser ut att vara fel. Söker kandidater med Text Search.`)
        summary.kandidater = await searchCandidates(apiKey)
      }
      googleFailed = true
      return {
        status: 'failed',
        summary,
        errorMessage: `Google Places svarade ${err.googleStatus}: ${err.message}`,
      }
    }

    const place = (await resp.json()) as GooglePlace
    const now = new Date().toISOString()
    const storedPlaceId = place.id ?? placeId

    const sb = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
    )

    const { error: statsError } = await sb.from('google_place_stats').upsert(
      {
        place_id: storedPlaceId,
        namn: place.displayName?.text ?? null,
        betyg: place.rating ?? null,
        antal_omdomen: place.userRatingCount ?? null,
        google_maps_url: place.googleMapsUri ?? null,
        hamtad_at: now,
      },
      { onConflict: 'place_id' },
    )
    if (statsError) throw new Error(`Kunde inte spara google_place_stats: ${statsError.message}`)

    const rows = (place.reviews ?? [])
      .filter((r) => typeof r.name === 'string' && r.name.length > 0)
      .map((r) => ({
        id: r.name as string,
        place_id: storedPlaceId,
        forfattare: r.authorAttribution?.displayName ?? null,
        betyg: typeof r.rating === 'number' ? Math.round(r.rating) : null,
        text: r.text?.text ?? r.originalText?.text ?? null,
        sprak: r.text?.languageCode ?? r.originalText?.languageCode ?? null,
        publicerad_at: r.publishTime ?? null,
        relativ_tid: r.relativePublishTimeDescription ?? null,
        hamtad_at: now,
      }))

    if (rows.length > 0) {
      const { error: reviewsError } = await sb.from('google_reviews').upsert(rows, { onConflict: 'id' })
      if (reviewsError) throw new Error(`Kunde inte spara google_reviews: ${reviewsError.message}`)
    }

    console.log(
      `${LOG} ${place.displayName?.text ?? storedPlaceId}: betyg ${place.rating ?? '-'}, ${place.userRatingCount ?? 0} omdömen totalt, ${rows.length} sparade`,
    )
    return {
      status: 'success',
      summary: {
        place_id: storedPlaceId,
        betyg: place.rating ?? null,
        antal_omdomen: place.userRatingCount ?? null,
        omdomen_sparade: rows.length,
      },
    }
  })

  if (result.status === 'failed') {
    return res.status(googleFailed ? 502 : 500).json({
      status: 'failed',
      error: result.errorMessage ?? 'Okänt fel',
      summary: result.summary,
    })
  }
  return res.status(200).json({ status: result.status, summary: result.summary })
}
