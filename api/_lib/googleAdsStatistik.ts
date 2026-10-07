// api/_lib/googleAdsStatistik.ts
// Hämtar statistik från Google Ads (API v25, GAQL via searchStream) till sidan Marknad:
// kampanj per dag, konverteringar per dag och åtgärd, söktermer per vecka. Tre frågor per körning,
// alltså tre operationer mot Explorer-kvoten (2 880 per dygn).
//
// Används av nattjobbet api/cron/google-ads-statistik.ts och av engångsskriptet
// scripts/ads/backfill-statistik.mjs (laddar den här filen med jiti). Ingen Supabase-import här.
// Raderna skrivs med databasfunktionen google_ads_statistik_spara() (migrationen 20261007_marknad.sql).
//
// Datum är kontots tidszon (Europe/Stockholm). Konverteringar räknas på klickdagen (Googles standard),
// så sena konverteringar och offline-uppladdningar ändrar äldre dagar; därför hämtas ett fönster bakåt.

import { hamtaAccessToken } from './googleAdsKonverteringar'

export { hamtaAccessToken }

export interface KampanjDag {
  datum: string
  campaign_id: string
  kampanjnamn: string
  status: string | null
  kanaltyp: string | null
  kostnad_sek: number
  visningar: number
  klick: number
  interaktioner: number
  konverteringar: number
  konverteringsvarde: number
  alla_konverteringar: number
  sokvisningsandel: number | null
  tappad_andel_budget: number | null
  tappad_andel_rank: number | null
}

export interface KonverteringDag {
  datum: string
  campaign_id: string
  atgard_id: string
  konverteringsatgard: string
  kategori: string | null
  konverteringar: number
  konverteringsvarde: number
  alla_konverteringar: number
  alla_konverteringsvarde: number
}

export interface SoktermVecka {
  vecka: string
  campaign_id: string
  sokterm: string
  kostnad_sek: number
  visningar: number
  klick: number
  konverteringar: number
}

export interface Statistik {
  customerId: string
  fran: string
  till: string
  sokFran: string
  kampanj: KampanjDag[]
  konv: KonverteringDag[]
  sok: SoktermVecka[]
  operationer: number
}

const env = () => process.env
const adsBas = () => `https://googleads.googleapis.com/${env().GOOGLE_ADS_API_VERSION || 'v25'}`
export const kundId = () => (env().GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '')
const mccId = () => (env().GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '')

// ---------------------------------------------------------------------------
// Datum i svensk tid

const DAG = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Dagens datum i Stockholm som ÅÅÅÅ-MM-DD. */
export const idagSverige = (nu: Date = new Date()) => DAG.format(nu)

/** Lägger till dagar på ett ÅÅÅÅ-MM-DD-datum (räknas i UTC-middag, ingen tidszonsglidning). */
export function plusDagar(datum: string, dagar: number): string {
  const d = new Date(`${datum}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dagar)
  return d.toISOString().slice(0, 10)
}

/** Måndagen i veckan som datumet ligger i. */
export function mandag(datum: string): string {
  const d = new Date(`${datum}T12:00:00Z`)
  const veckodag = (d.getUTCDay() + 6) % 7 // måndag = 0
  return plusDagar(datum, -veckodag)
}

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/

// ---------------------------------------------------------------------------
// GAQL

/** En rad ur searchStream (camelCase som API:t svarar). */
interface GaqlRad {
  segments?: { date?: string; week?: string; conversionAction?: string; conversionActionName?: string; conversionActionCategory?: string }
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string }
  campaignSearchTermView?: { searchTerm?: string }
  metrics?: Record<string, unknown>
}

interface GaqlSvar {
  rader: GaqlRad[]
}

async function gaql(token: string, query: string): Promise<GaqlSvar> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  if (env().GOOGLE_ADS_DEVELOPER_TOKEN) h['developer-token'] = env().GOOGLE_ADS_DEVELOPER_TOKEN!
  if (mccId()) h['login-customer-id'] = mccId()
  const svar = await fetch(`${adsBas()}/customers/${kundId()}/googleAds:searchStream`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ query }),
  })
  const data = (await svar.json().catch(() => null)) as unknown
  if (!svar.ok || !Array.isArray(data)) {
    const fel = (Array.isArray(data) ? data[0] : data) as { error?: { message?: string; details?: unknown } } | null
    throw new Error(`Google Ads svarade ${svar.status}: ${fel?.error?.message ?? 'okänt fel'}`)
  }
  return { rader: (data as Array<{ results?: GaqlRad[] }>).flatMap((d) => d.results ?? []) }
}

const tal = (v: unknown) => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const avrunda = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec
const andel = (v: unknown) => (v == null ? null : avrunda(tal(v), 4))
const sistaDelen = (resurs: string | undefined) => (resurs ?? '').split('/').pop() ?? ''

// ---------------------------------------------------------------------------
// Hämtning

/**
 * Hämtar kampanj- och konverteringsdata för [fran, till] och söktermer för veckorna från måndagen
 * före fran till och med till. Exakt tre GAQL-anrop.
 */
export async function hamtaStatistik(token: string, fran: string, till: string): Promise<Statistik> {
  if (!DATUM_RE.test(fran) || !DATUM_RE.test(till) || till < fran) throw new Error('Ogiltigt datumintervall')
  const sokFran = mandag(fran)
  let operationer = 0

  // 1. Kampanj per dag
  const k = await gaql(
    token,
    'SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ' +
      'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.interactions, metrics.conversions, ' +
      'metrics.conversions_value, metrics.all_conversions, metrics.search_impression_share, ' +
      'metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share ' +
      `FROM campaign WHERE segments.date BETWEEN '${fran}' AND '${till}' AND metrics.impressions > 0`,
  )
  operationer++
  const kampanjer = new Map<string, KampanjDag>()
  for (const r of k.rader) {
    const datum = String(r.segments?.date ?? '')
    const id = String(r.campaign?.id ?? '')
    if (!datum || !id) continue
    const m = r.metrics ?? {}
    const nyckel = `${datum}|${id}`
    const fore = kampanjer.get(nyckel)
    const rad: KampanjDag = {
      datum,
      campaign_id: id,
      kampanjnamn: String(r.campaign?.name ?? id),
      status: r.campaign?.status ?? null,
      kanaltyp: r.campaign?.advertisingChannelType ?? null,
      kostnad_sek: avrunda(tal(m.costMicros) / 1e6 + (fore?.kostnad_sek ?? 0)),
      visningar: tal(m.impressions) + (fore?.visningar ?? 0),
      klick: tal(m.clicks) + (fore?.klick ?? 0),
      interaktioner: tal(m.interactions) + (fore?.interaktioner ?? 0),
      konverteringar: avrunda(tal(m.conversions) + (fore?.konverteringar ?? 0)),
      konverteringsvarde: avrunda(tal(m.conversionsValue) + (fore?.konverteringsvarde ?? 0)),
      alla_konverteringar: avrunda(tal(m.allConversions) + (fore?.alla_konverteringar ?? 0)),
      sokvisningsandel: andel(m.searchImpressionShare),
      tappad_andel_budget: andel(m.searchBudgetLostImpressionShare),
      tappad_andel_rank: andel(m.searchRankLostImpressionShare),
    }
    kampanjer.set(nyckel, rad)
  }

  // 2. Konverteringar per dag, kampanj och åtgärd (primära och sekundära)
  const c = await gaql(
    token,
    'SELECT segments.date, campaign.id, segments.conversion_action, segments.conversion_action_name, ' +
      'segments.conversion_action_category, metrics.conversions, metrics.conversions_value, ' +
      'metrics.all_conversions, metrics.all_conversions_value ' +
      `FROM campaign WHERE segments.date BETWEEN '${fran}' AND '${till}' AND metrics.all_conversions > 0`,
  )
  operationer++
  const konv = new Map<string, KonverteringDag>()
  for (const r of c.rader) {
    const datum = String(r.segments?.date ?? '')
    const id = String(r.campaign?.id ?? '')
    const atgard = sistaDelen(r.segments?.conversionAction)
    if (!datum || !id || !atgard) continue
    const m = r.metrics ?? {}
    const nyckel = `${datum}|${id}|${atgard}`
    const fore = konv.get(nyckel)
    konv.set(nyckel, {
      datum,
      campaign_id: id,
      atgard_id: atgard,
      konverteringsatgard: String(r.segments?.conversionActionName ?? atgard),
      kategori: r.segments?.conversionActionCategory ?? null,
      konverteringar: avrunda(tal(m.conversions) + (fore?.konverteringar ?? 0)),
      konverteringsvarde: avrunda(tal(m.conversionsValue) + (fore?.konverteringsvarde ?? 0)),
      alla_konverteringar: avrunda(tal(m.allConversions) + (fore?.alla_konverteringar ?? 0)),
      alla_konverteringsvarde: avrunda(tal(m.allConversionsValue) + (fore?.alla_konverteringsvarde ?? 0)),
    })
  }

  // 3. Söktermer per vecka (bara termer med klick). Gäller även Performance Max.
  const s = await gaql(
    token,
    'SELECT segments.week, campaign.id, campaign_search_term_view.search_term, metrics.cost_micros, ' +
      'metrics.impressions, metrics.clicks, metrics.conversions FROM campaign_search_term_view ' +
      `WHERE segments.date BETWEEN '${sokFran}' AND '${till}' AND metrics.clicks > 0`,
  )
  operationer++
  const sok = new Map<string, SoktermVecka>()
  for (const r of s.rader) {
    const vecka = String(r.segments?.week ?? '')
    const id = String(r.campaign?.id ?? '')
    const term = String(r.campaignSearchTermView?.searchTerm ?? '').trim().slice(0, 300)
    if (!vecka || !id || !term) continue
    const m = r.metrics ?? {}
    const nyckel = `${vecka}|${id}|${term}`
    const fore = sok.get(nyckel)
    sok.set(nyckel, {
      vecka,
      campaign_id: id,
      sokterm: term,
      kostnad_sek: avrunda(tal(m.costMicros) / 1e6 + (fore?.kostnad_sek ?? 0)),
      visningar: tal(m.impressions) + (fore?.visningar ?? 0),
      klick: tal(m.clicks) + (fore?.klick ?? 0),
      konverteringar: avrunda(tal(m.conversions) + (fore?.konverteringar ?? 0)),
    })
  }

  return {
    customerId: kundId(),
    fran,
    till,
    sokFran,
    kampanj: [...kampanjer.values()],
    konv: [...konv.values()],
    sok: [...sok.values()],
    operationer,
  }
}

/** Parametrarna till google_ads_statistik_spara(). */
export function sparaParametrar(st: Statistik) {
  return {
    p_customer_id: st.customerId,
    p_fran: st.fran,
    p_till: st.till,
    p_kampanj: st.kampanj,
    p_konv: st.konv,
    p_sok: st.sok,
    p_sok_fran: st.sokFran,
  }
}
