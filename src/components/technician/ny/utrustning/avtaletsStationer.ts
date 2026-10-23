// src/components/technician/ny/utrustning/avtaletsStationer.ts
// Hur många stationer avtalet omfattar och hur många av dem som är ute, för
// raden Pågående etablering på Stationer i nya arbetsvyn.
//
// KÄLLAN FÖR AVTALETS ANTAL
// Det finns inget strukturerat fält för "antal stationer enligt avtalet".
// § 4/§ 5-raderna i case_billing_items med station_type_id och
// billing_model = 'premium' är tilläggens interna kostnad (synkas ur
// tilläggsstationerna av sync_addon_article_lines), inte avtalets omfattning.
// Tilläggslogiken (sync_addon_station_line, sync_addon_period_lines) räknar
// aldrig mot ett avtalat antal: den räknar stationer med is_addon = true.
// Det enda stället avtalet säger hur många stationer som ingår är
// avtalsobjektet, texten från Oneflow ("Betongstation Storlek M 26st",
// "18 stycken Betongstationer"), som speglas till customers.agreement_text
// (kundradsavtal och enheter med eget avtal). Teknikern får inte läsa
// contracts (RLS), så kundraden är källan här.
//
// Tolkningen är försiktig: bara ett tal direkt intill ett stationsord räknas
// (station, fälla, låda, aurotrap, råttstopp, RAT-EXX). Inspektioner, besök och
// belopp räknas aldrig. Hittas inget tal blir antalet null och raden visar
// "Avtalets antal saknas".
//
// Multisite: en enhet utan egen avtalstext ärver INTE huvudkontorets text,
// den beskriver alla enheter tillsammans och skulle ge för högt antal.
//
// PLACERADE (X)
// Aktiva stationer hos kunden som INTE är tilläggsstationer (is_addon false),
// oavsett när de placerades. Samma gräns som tilläggslogiken: allt med
// is_addon = true ligger utöver avtalet och faktureras separat, allt annat
// fyller avtalet. Stationer från en tidigare etablering räknas, avtalet gäller
// kundens stationer och inte bara det här ärendet. När avtalet anger typ
// räknas varje typ högst upp till sitt avtalade antal, så att fler
// betongstationer aldrig fyller upp saknade betesstationer.

import { supabase } from '../../../../lib/supabase'

export interface AvtalsTyp {
  /** Stationstypens namn, eller ordet ur avtalstexten om typen inte går att avgöra */
  namn: string
  /** station_types.code, null om texten inte går att knyta till en typ */
  kod: string | null
  avtalat: number
  /** Aktiva avtalsstationer av typen, null om typen är okänd */
  placerade: number | null
}

export interface AvtalsLage {
  /** Avtalets antal enligt avtalstexten, null när det saknas */
  avtalat: number | null
  /** Placerade avtalsstationer att jämföra med avtalat (se ovan) */
  placerade: number
  /** Per typ, tom när avtalet inte anger typ för alla rader */
  perTyp: AvtalsTyp[]
  /** Aktiva tilläggsstationer hos kunden, visas för sig */
  tillagg: number
}

// ── Tolkningen av avtalstexten ─────────────────────────────────────

const ORDTAL: Record<string, number> = {
  en: 1, ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8, nio: 9,
  tio: 10, elva: 11, tolv: 12, femton: 15, tjugo: 20,
}
const ORD_ALT = Object.keys(ORDTAL).join('|')
/** "en" och "ett" räknas bara med siffran inom parentes, "flytta en aurotrap" är inget antal */
const ORD_ALT_FRISTAENDE = Object.keys(ORDTAL).filter(o => ORDTAL[o] > 1).join('|')
const L = '[\\p{L}\\d-]'
const STATIONSORD = '(?:station|fäll|aurotrap|råttstopp|rat-?exx|lådor|låda)'
/** "26", "(3)", "tre (3)" eller "tre" (aldrig ett fristående "en") */
const TAL = `(?:(?:${ORD_ALT})\\s*\\((\\d+)\\)|\\((\\d+)\\)|(\\d+)|(${ORD_ALT_FRISTAENDE}))`
/** Tal följt av högst två ord och ett stationsord: "18 stycken Betongstationer", "Tre (3) mekaniska fällor" */
const FRAMFOR = new RegExp(
  `(?<![\\p{L}\\d])${TAL}\\s*(?:st\\.?|stycken|styck)?\\s+((?:${L}+\\s+){0,2}?${L}*${STATIONSORD}${L}*)`,
  'giu'
)
/** Stationsord följt av högst tre ord och "N st": "Betongstation Storlek M 26st" */
const EFTER = new RegExp(
  `(${L}*${STATIONSORD}${L}*)(?:\\s+${L}+){0,3}?\\s+(\\d+)\\s*(?:st|stycken)(?![\\p{L}])`,
  'giu'
)

function talUr(m: RegExpExecArray): number | null {
  const siffror = m[1] ?? m[2] ?? m[3]
  if (siffror) return Number(siffror)
  const ord = m[4]?.toLowerCase()
  return ord ? ORDTAL[ord] ?? null : null
}

/** Stationstypens kod ur ordet i texten, null när det inte går att avgöra */
function typkod(ord: string): string | null {
  const o = ord.toLowerCase()
  if (o.includes('betong')) return 'betongstation'
  if (o.includes('betes') || o.includes('betad') || o.includes('betestation') || o.includes('betesl')) return 'betesstation'
  if (o.includes('plåt')) return 'platstation'
  if (o.includes('ljus')) return 'ljusfalla'
  if (o.includes('mekanisk') || o.includes('aurotrap') || o.includes('slagfäll') || o.includes('råttfäll')) return 'mekanisk_falla'
  return null
}

export interface TolkadRad { ord: string; antal: number; kod: string | null }

/**
 * Stationsraderna ur avtalstexten. Texten delas på radbrytning, punkt,
 * semikolon, komma, plus och | så att "6 inspektioner per år." aldrig
 * kopplas ihop med stationsordet på nästa rad.
 */
export function tolkaAvtalstext(text: string | null | undefined): TolkadRad[] {
  if (!text) return []
  const rader: TolkadRad[] = []
  for (const del of text.split(/[\n\r.;,+|]+/)) {
    const bit = del.trim()
    if (!bit) continue
    let traff = false
    FRAMFOR.lastIndex = 0
    for (let m = FRAMFOR.exec(bit); m; m = FRAMFOR.exec(bit)) {
      const antal = talUr(m)
      if (antal && antal > 0 && antal < 10000) {
        const ord = m[5].trim()
        rader.push({ ord, antal, kod: typkod(ord) })
        traff = true
      }
    }
    if (traff) continue
    EFTER.lastIndex = 0
    for (let m = EFTER.exec(bit); m; m = EFTER.exec(bit)) {
      const antal = Number(m[2])
      if (antal > 0 && antal < 10000) rader.push({ ord: m[1], antal, kod: typkod(m[1]) })
    }
  }
  return rader
}

// ── Hämtningen ─────────────────────────────────────────────────────

let typerCache: Promise<Map<string, { code: string; name: string }>> | null = null
function stationstyper(): Promise<Map<string, { code: string; name: string }>> {
  if (!typerCache) {
    typerCache = (async () => {
      const { data, error } = await supabase.from('station_types').select('id, code, name')
      if (error) throw error
      return new Map((data ?? []).map(t => [t.id as string, { code: t.code as string, name: t.name as string }]))
    })()
    typerCache.catch(() => { typerCache = null })
  }
  return typerCache
}

/** Avtalets antal och placerade avtalsstationer hos en kund */
export async function hamtaAvtalsLage(customerId: string, avtalstext: string | null): Promise<AvtalsLage> {
  const [typer, ute, inne] = await Promise.all([
    stationstyper(),
    supabase
      .from('equipment_placements')
      .select('station_type_id, is_addon')
      .eq('customer_id', customerId)
      .eq('status', 'active'),
    supabase
      .from('indoor_stations')
      .select('station_type_id, is_addon, floor_plan:floor_plans!inner(customer_id)')
      .eq('floor_plan.customer_id', customerId)
      .eq('status', 'active'),
  ])
  if (ute.error) throw ute.error
  if (inne.error) throw inne.error

  const perKod = new Map<string, number>()
  let avtalsstationer = 0
  let tillagg = 0
  for (const s of [...(ute.data ?? []), ...(inne.data ?? [])] as Array<{ station_type_id: string | null; is_addon: boolean | null }>) {
    if (s.is_addon) { tillagg++; continue }
    avtalsstationer++
    const kod = s.station_type_id ? typer.get(s.station_type_id)?.code : undefined
    if (kod) perKod.set(kod, (perKod.get(kod) ?? 0) + 1)
  }

  const tolkat = tolkaAvtalstext(avtalstext)
  if (tolkat.length === 0) return { avtalat: null, placerade: avtalsstationer, perTyp: [], tillagg }

  const avtalat = tolkat.reduce((s, r) => s + r.antal, 0)
  const allaTypade = tolkat.every(r => r.kod)
  if (!allaTypade) return { avtalat, placerade: avtalsstationer, perTyp: [], tillagg }

  // Slå ihop rader av samma typ ("Betongstation 10 st" + "Betongstation 6 st")
  const namnPerKod = new Map(Array.from(typer.values()).map(t => [t.code, t.name]))
  const avtalatPerKod = new Map<string, number>()
  for (const r of tolkat) avtalatPerKod.set(r.kod!, (avtalatPerKod.get(r.kod!) ?? 0) + r.antal)
  const perTyp: AvtalsTyp[] = Array.from(avtalatPerKod, ([kod, antal]) => ({
    namn: namnPerKod.get(kod) ?? kod,
    kod,
    avtalat: antal,
    placerade: perKod.get(kod) ?? 0,
  }))
  const placerade = perTyp.reduce((s, t) => s + Math.min(t.placerade ?? 0, t.avtalat), 0)
  return { avtalat, placerade, perTyp, tillagg }
}
