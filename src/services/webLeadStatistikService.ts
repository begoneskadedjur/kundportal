// src/services/webLeadStatistikService.ts
// Fliken Statistik i Leads (Webb): läser RPC:n web_inquiry_statistik (migrationen
// 20261007_web_inquiry_statistik.sql). All aggregering sker i databasen så att fliken skalar till
// tiotusentals förfrågningar; klienten får några hundra grupprader och slår bara ihop dem per
// visningsnamn (tjänst, källa, kanal). Kräver samma behörighet som att läsa web_inquiries.

import { supabase } from '../lib/supabase'

export type StatGran = 'dag' | 'vecka' | 'manad'

export type StatGrupp =
  | 'totalt'
  | 'tjanst'
  | 'kundgrupp'
  | 'kalla'
  | 'kanal'
  | 'kampanj'
  | 'sokord'
  | 'sida'
  | 'ort'
  | 'vecka'
  | 'heat'
  | 'matris'
  | 'tid_alla'
  | 'tid_kundgrupp'
  | 'tid_kanal'

/** Måtten som räknas för varje grupp. */
export interface StatMatt {
  n: number
  akuta: number
  kontaktade: number
  samma_dag: number
  bokade: number
  vunna: number
  forl_efter: number
  forl_utan: number
  pagaende: number
  /** Summan av värdet på vunna ärenden (exkl. moms), 0 när inget belopp finns. */
  varde: number
  med_varde: number
  /** Median i minuter från förfrågan till första kontakt (klocktid), null utan underlag. */
  svarstid_median: number | null
}

export interface StatRad extends StatMatt {
  g: StatGrupp
  k: string
  /** Hinkens första dag ÅÅÅÅ-MM-DD för tid_*-grupperna, annars null. */
  b: string | null
}

export interface WebLeadStatistik {
  fran: string
  till: string
  gran: StatGran
  skrap: number
  befintliga: number
  rader: StatRad[]
}

export const TOM_MATT: StatMatt = {
  n: 0,
  akuta: 0,
  kontaktade: 0,
  samma_dag: 0,
  bokade: 0,
  vunna: 0,
  forl_efter: 0,
  forl_utan: 0,
  pagaende: 0,
  varde: 0,
  med_varde: 0,
  svarstid_median: null,
}

export const SUMMERBARA: Exclude<keyof StatMatt, 'svarstid_median'>[] = [
  'n',
  'akuta',
  'kontaktade',
  'samma_dag',
  'bokade',
  'vunna',
  'forl_efter',
  'forl_utan',
  'pagaende',
  'varde',
  'med_varde',
]

export const webLeadStatistikService = {
  async hamta(fran: string, till: string, gran: StatGran): Promise<WebLeadStatistik> {
    // RPC:n finns inte i de genererade databastyperna
    const rpc = supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>
    const { data, error } = await rpc.call(supabase, 'web_inquiry_statistik', { p_fran: fran, p_till: till, p_gran: gran })
    if (error) {
      if (error.code === '42501') throw new Error('Du saknar behörighet till webbförfrågningarna.')
      throw new Error(error.message)
    }
    const d = data as WebLeadStatistik
    // numeric kommer som tal från jsonb, men säkra upp mot strängar
    d.rader = (d.rader ?? []).map((r) => ({ ...r, varde: Number(r.varde) || 0 }))
    return d
  },
}
