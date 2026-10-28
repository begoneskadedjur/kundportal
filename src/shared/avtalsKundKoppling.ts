// src/shared/avtalsKundKoppling.ts
// Ren logik för kundkopplingen i Skapa avtal eller offert (3.100.0).
// Ingen databas: delas mellan wizarden, api/oneflow/create-contract och
// signeringen (api/_lib/contractSigning.ts) och går att testa fristående.
//
// Beslut (Christian 2026-10-28):
//   - Org.nr är kundens identitet. Stämmer avtalets org.nr inte med den kopplade
//     kundens släpps kopplingen, i wizarden direkt och vid signering.
//   - Multisite-enheter utan eget org.nr jämförs mot huvudkontorets.
//   - Avtalet läggs på huvudkontoret med valda enheter (contract_sites), eller på
//     en enskild enhet (customer_id = enheten).

import { orgDigits } from './fortnoxCustomerNumbers'

/** Kundradens fält som kopplingen behöver. */
export interface KopplingsKund {
  id: string
  is_active?: boolean | null
  parent_customer_id?: string | null
  site_type?: string | null
  organization_number?: string | null
}

/** Org- eller personnummer som tio siffror, annars null (tomt eller ofullständigt). */
export function idNummerSiffror(raw: string | null | undefined): string | null {
  let d = orgDigits(raw ?? null)
  // Organisationsnummer skrivs ibland med prefixet 16 (12 siffror)
  if (d && d.length === 12 && d.startsWith('16')) d = d.slice(2)
  return d && d.length === 10 ? d : null
}

/**
 * Kundens identitetsnummer med arv: enhetens eget, annars huvudkontorets.
 * Samma regel som inheritOrgNr i src/utils/multisiteHelpers.ts (som inte går
 * att importera på servern eftersom filen läser webbläsarens Supabase-klient).
 */
export function kundensIdNummer(
  kund: { organization_number?: string | null },
  huvudkontor?: { organization_number?: string | null } | null
): string | null {
  return (kund.organization_number || '').trim() || (huvudkontor?.organization_number || '').trim() || null
}

export type IdNummerJamforelse =
  /** Numren är samma (normaliserat) */
  | 'samma'
  /** Numren skiljer sig */
  | 'annat'
  /** Kunden har inget nummer att jämföra med */
  | 'kund_saknar'
  /** Det angivna numret är tomt eller inte tio siffror ännu */
  | 'ofullstandigt'

/** Jämför ett angivet nummer med kundens (med och utan bindestreck, med och utan sekel). */
export function jamforIdNummer(angivet: string | null | undefined, kundens: string | null | undefined): IdNummerJamforelse {
  const k = idNummerSiffror(kundens)
  if (!k) return 'kund_saknar'
  const a = idNummerSiffror(angivet)
  if (!a) return 'ofullstandigt'
  return a === k ? 'samma' : 'annat'
}

/**
 * Ska kopplingen släppas? Ett fullständigt nummer som skiljer sig släpper
 * direkt. När användaren lämnat fältet (slutgiltigt) släpper också ett tomt
 * eller ofullständigt nummer. Har kunden inget nummer finns inget att jämföra.
 */
export function kopplingSkaSlappas(
  angivet: string | null | undefined,
  kundens: string | null | undefined,
  slutgiltigt: boolean
): boolean {
  const j = jamforIdNummer(angivet, kundens)
  if (j === 'annat') return true
  if (j === 'ofullstandigt') return slutgiltigt
  return false
}

export interface OmfattningsVal {
  /** Hela verksamheten: covers_all_sites på huvudkontorets avtal */
  coversAllSites?: boolean | null
  /** Kundrader som avtalet omfattar (huvudkontoret och/eller dess enheter) */
  siteIds?: string[] | null
}

export interface ValideringsSvar {
  ok: boolean
  fel: string | null
  /** Rensat urval att spara: unika id:n, null när urvalet inte gäller */
  siteIds: string[] | null
  coversAllSites: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const arUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

/**
 * Validerar kunden och enhetsurvalet mot kundregistret.
 * kund: kundraden avtalet läggs på. rader: kundraderna i urvalet, som de står i
 * registret (hämtade på id). harEnheter: kunden har minst en aktiv enhet.
 */
export function valideraKundOchOmfattning(
  kund: KopplingsKund | null,
  val: OmfattningsVal,
  rader: KopplingsKund[],
  harEnheter: boolean
): ValideringsSvar {
  const nej = (fel: string): ValideringsSvar => ({ ok: false, fel, siteIds: null, coversAllSites: false })
  if (!kund) return nej('Kunden finns inte i kundregistret.')
  if (kund.is_active === false) return nej('Kunden är inaktiv i kundregistret.')

  if (val.coversAllSites) {
    if (!harEnheter) return nej('Hela verksamheten kan bara väljas för ett huvudkontor med enheter.')
    return { ok: true, fel: null, siteIds: null, coversAllSites: true }
  }

  const ids = [...new Set((val.siteIds ?? []).filter((v) => typeof v === 'string'))]
  if (ids.length === 0) return { ok: true, fel: null, siteIds: null, coversAllSites: false }
  if (ids.some((id) => !arUuid(id))) return nej('Urvalet av enheter innehåller ett ogiltigt id.')

  const perId = new Map(rader.map((r) => [r.id, r]))
  for (const id of ids) {
    const r = perId.get(id)
    if (!r) return nej('En vald enhet finns inte i kundregistret.')
    const hor = r.id === kund.id || r.parent_customer_id === kund.id
    if (!hor) return nej('En vald enhet hör inte till kunden.')
    if (r.is_active === false) return nej('En vald enhet är inaktiv.')
  }
  return { ok: true, fel: null, siteIds: ids, coversAllSites: false }
}

/** "1 enhet" / "3 enheter" */
export const enheterText = (n: number) => `${n} ${n === 1 ? 'enhet' : 'enheter'}`
