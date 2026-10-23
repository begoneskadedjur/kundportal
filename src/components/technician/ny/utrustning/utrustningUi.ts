// src/components/technician/ny/utrustning/utrustningUi.ts
// Delade klasser och små hjälpare för Utrustning i nya arbetsvyn.
// Knapparna följer besokUi (52 px primär, 44 px minsta yta).

import { EQUIPMENT_TYPE_CONFIG, EQUIPMENT_STATUS_CONFIG } from '../../../../types/database'
import { INDOOR_STATION_STATUS_CONFIG, type IndoorStationStatus } from '../../../../types/indoor'
import type { HealthStatus } from '../../../shared/StationHealthBadge'
import { resolveStationIcon } from '../../../shared/stationIcons'
import type { Ton } from '../besokTyp'

const KNAPP_BAS = 'h-[52px] px-4 flex items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]'
export const KNAPP_PRIMAR = `${KNAPP_BAS} bg-[#20c58f] text-[#04281c] hover:bg-[#1bb07f]`
export const KNAPP_SEKUNDAR = `${KNAPP_BAS} border border-slate-600 bg-slate-900 text-white hover:bg-slate-800`
export const KNAPP_TYST = `${KNAPP_BAS} border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white`
export const IKONKNAPP = 'w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] disabled:opacity-40'
export const KORT = 'rounded-2xl bg-slate-900 border border-slate-700/60'

/** Det en station behöver för att visas med typens färg och ikon */
export interface TypBar {
  station_type?: string | null
  equipment_type?: string | null
  article?: { icon: string | null } | null
  station_type_data?: { name: string; color: string; icon?: string | null } | null
}

const LEGACY_INNE: Record<string, string> = {
  mechanical_trap: 'Mekanisk fälla',
  concrete_station: 'Betongstation',
  bait_station: 'Betesstation',
}

/**
 * Typens namn, färg och ikon. Texten är ALLTID stationstypen, aldrig produktnamnet.
 * Ikonen är produktens om stationen har en, annars typens (personalvy).
 */
export function typInfo(s: TypBar): { namn: string; farg: string; ikon: string } {
  if (s.station_type_data) {
    return {
      namn: s.station_type_data.name,
      farg: s.station_type_data.color,
      ikon: resolveStationIcon(s.article?.icon, s.station_type_data.icon),
    }
  }
  const kod = s.equipment_type || s.station_type || ''
  const legacy = EQUIPMENT_TYPE_CONFIG[kod as keyof typeof EQUIPMENT_TYPE_CONFIG]
  if (legacy) return { namn: legacy.label, farg: legacy.color, ikon: resolveStationIcon(s.article?.icon, null) }
  return {
    namn: LEGACY_INNE[kod] || kod || 'Station',
    farg: '#6b7280',
    ikon: resolveStationIcon(s.article?.icon, kod || null),
  }
}

/** Stationens status som ton och text (platt text med punkt) */
export function stationStatus(status: string): { ton: Ton; text: string } {
  const text =
    EQUIPMENT_STATUS_CONFIG[status as keyof typeof EQUIPMENT_STATUS_CONFIG]?.label
    || INDOOR_STATION_STATUS_CONFIG[status as IndoorStationStatus]?.label
    || status
  switch (status) {
    case 'active': return { ton: 'gron', text: 'Aktiv' }
    case 'removed': return { ton: 'gra', text: 'Upphämtad' }
    case 'missing': return { ton: 'gul', text }
    case 'damaged': return { ton: 'rod', text: 'Skadad' }
    case 'needs_service': return { ton: 'gul', text: 'Behöver service' }
    default: return { ton: 'gra', text }
  }
}

/** Kundens hälsa (andel stationer som saknas eller är skadade) som ton och text */
export function halsa(h: HealthStatus): { ton: Ton; text: string } {
  switch (h) {
    case 'excellent': return { ton: 'gron', text: 'Inga avvikelser' }
    case 'good': return { ton: 'gul', text: 'Enstaka avvikelser' }
    case 'fair': return { ton: 'gul', text: 'Flera avvikelser' }
    default: return { ton: 'rod', text: 'Många avvikelser' }
  }
}

/** ÅÅÅÅ-MM-DD i svensk tid */
export function datum(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

/** "idag", "igår", "för 5 dagar sedan" eller datumet */
export function senast(iso: string | null | undefined): string {
  if (!iso) return ''
  const dag = datum(iso)
  const idag = datum(new Date().toISOString())
  const dagar = Math.round((new Date(idag).getTime() - new Date(dag).getTime()) / 86_400_000)
  if (dagar <= 0) return 'idag'
  if (dagar === 1) return 'igår'
  if (dagar < 14) return `för ${dagar} dagar sedan`
  return dag
}

export function antalText(n: number, en: string, flera: string): string {
  return `${n} ${n === 1 ? en : flera}`
}

/** Antal kalenderdagar från en YYYY-MM-DD till en annan (svenska kalenderdagar in, inga klockslag) */
export function dagarMellan(fran: string, till: string): number {
  const [y1, m1, d1] = fran.split('-').map(Number)
  const [y2, m2, d2] = till.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/**
 * Avvikelser i ord. Gränserna är desamma som kundens hälsa i
 * calculateHealthStatus (StationHealthBadge.tsx), andelen aktiva stationer
 * som saknas, är skadade eller behöver service:
 *   Inga     0 %
 *   Enstaka  under 10 %
 *   Flera    10 till under 30 %
 *   Många    30 % eller mer
 * Bara Inga är grön. Rött används inte, avvikelser är inte akuta i sig.
 */
export function avvikelseOrd(h: HealthStatus): { ton: Ton; text: string } {
  switch (h) {
    case 'excellent': return { ton: 'gron', text: 'Inga' }
    case 'good': return { ton: 'gul', text: 'Enstaka' }
    case 'fair': return { ton: 'gul', text: 'Flera' }
    default: return { ton: 'gul', text: 'Många' }
  }
}

/** Liten knapp i rader och sidokolumnen, 44 px hög */
export const RADKNAPP = 'h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] disabled:opacity-60'
/** Ikonknapp med ram, 44 px */
export const RAM_IKONKNAPP = 'w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border border-slate-600 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] disabled:opacity-60'
/** Liten primärknapp i rader, 44 px hög (Avsluta etablering när allt är ute) */
export const RADKNAPP_PRIMAR = 'h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#20c58f] text-[#04281c] text-sm font-semibold hover:bg-[#1bb07f] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f] disabled:opacity-60'
