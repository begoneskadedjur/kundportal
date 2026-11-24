// src/utils/stationTaxonomy.ts
//
// equipment_placements.equipment_type är FRITEXT och har vuxit fram över tid.
// Samma stationstyp finns därför i flera stavningar:
//   Betongstation (609) · betongstation (63) · betesstation (51)
//   mekanisk_falla (20) · Plåtstation (6)
//
// station_types.code är däremot alltid gemener. Uppslag mot fritexten rakt av
// missar därför 609 rader — 81 % av beståndet — som då renderas grå i stället
// för sin rätta färg, och räknas som noll i all typstatistik.

/** Fritext → kanonisk kod som matchar station_types.code */
const CANON: Record<string, string> = {
  betongstation: 'betongstation',
  betesstation: 'betesstation',
  platstation: 'platstation',
  plåtstation: 'platstation',
  mekanisk_falla: 'mekanisk_falla',
  mekaniskfalla: 'mekanisk_falla',
  ljusfalla: 'ljusfalla',
  ljusfälla: 'ljusfalla',
}

/**
 * Normaliserar en fritextstyp till den kod station_types använder.
 * "Betongstation" | "betongstation" | "Plåtstation" → kanonisk kod.
 */
export function canonicalTypeCode(raw: string | null | undefined): string {
  if (!raw) return 'okand'
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  return CANON[key] ?? key
}

/** Visningsnamn när ingen station_type finns att hämta namnet ur. */
export function typeDisplayName(raw: string | null | undefined): string {
  if (!raw) return 'Okänd typ'
  const t = raw.trim().replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/**
 * Slår ihop stationer på kanonisk typ och räknar dem.
 * Löser att "Betongstation" och "betongstation" annars blir två poster.
 */
export function countByCanonicalType<T extends {
  equipment_type?: string | null
  station_type_data?: { name?: string | null } | null
}>(
  rows: T[]
): { code: string; label: string; count: number }[] {
  const acc = new Map<string, { label: string; count: number; fromType: boolean }>()
  for (const r of rows) {
    const code = canonicalTypeCode(r.equipment_type)
    // Stationstypens riktiga namn gäller före namnet som byggs ur koden
    const typeName = r.station_type_data?.name || null
    const prev = acc.get(code)
    if (prev) {
      prev.count += 1
      if (!prev.fromType && typeName) {
        prev.label = typeName
        prev.fromType = true
      }
    } else {
      acc.set(code, {
        label: typeName ?? typeDisplayName(r.equipment_type),
        count: 1,
        fromType: !!typeName,
      })
    }
  }
  return [...acc.entries()]
    .map(([code, v]) => ({ code, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Mätvärde med etikett, där enheten bara skrivs en gång.
 * Etiketten "Antal avdödade (st)" har redan enheten, så "3 st" blir bara "3".
 */
export function formatMeasurement(
  label: string | null | undefined,
  value: number | string,
  unit: string | null | undefined
): string {
  const l = label || 'Mätvärde'
  const u = unit || 'st'
  // Etiketten skriver ofta enheten kort: "Förbrukning (g)" med enheten gram
  const kort: Record<string, string> = { gram: 'g', procent: '%' }
  const enhet = u.trim().toLowerCase()
  const slut = l.trim().toLowerCase()
  const hasUnit = slut.endsWith(`(${enhet})`) || (!!kort[enhet] && slut.endsWith(`(${kort[enhet]})`))
  return hasUnit ? `${l}: ${value}` : `${l}: ${value} ${u}`
}
