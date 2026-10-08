// src/services/marknadService.ts
// Läser sidan Marknad (/admin/leads-webb/marknad) via RPC:erna i migrationen 20261007_marknad.sql.
// Alla RPC:er kräver profiles.can_view_marketing och kastar annars fel 42501.

import { supabase } from '../lib/supabase'

export interface MarknadKampanj {
  campaign_id: string
  namn: string
  status: string | null
  kanaltyp: string | null
  kostnad: number
  visningar: number
  klick: number
  interaktioner: number
  konverteringar: number
  konverteringsvarde: number
  sokvisningsandel: number | null
  formular: number
  samtal_annons: number
  samtal_webb: number
  bokat: number
  bokat_varde: number
  genomfort: number
  genomfort_varde: number
}

export interface MarknadDag {
  datum: string
  kostnad: number
  klick: number
  visningar: number
  konverteringar: number
  formular: number
  samtal: number
}

export interface MarknadOversikt {
  totalt: {
    kostnad: number
    visningar: number
    klick: number
    interaktioner: number
    konverteringar: number
    konverteringsvarde: number
    dagar_med_data: number
  }
  konv_typer: Partial<Record<'formular' | 'samtal_annons' | 'samtal_webb' | 'bokat' | 'genomfort' | 'ovrigt', { antal: number; varde: number }>>
  per_kampanj: MarknadKampanj[]
  per_dag: MarknadDag[]
  data: { forsta_datum: string | null; sista_datum: string | null; hamtad_at: string | null }
}

export interface MarknadSokterm {
  sokterm: string
  kostnad: number
  visningar: number
  klick: number
  konverteringar: number
  kampanjer: string
}

export interface MarknadSoktermer {
  fran_vecka: string
  antal_termer: number
  rader: MarknadSokterm[]
}

export type LeadKalla = 'google_ads' | 'organiskt' | 'direkt' | 'ovrigt'

export interface MarknadLeads {
  totalt: number
  skrap: number
  samtycke: number
  samtycke_underlag: number
  samtycke_ej_skrap: number
  per_kalla: Array<{ kalla: LeadKalla; antal: number; vunnen: number; forlorad: number; pagar: number; skrap: number; befintlig_kund: number; samtycke: number }>
  per_tjanst: Array<{ tjanst: string; antal: number; google_ads: number; vunnen: number; forlorad: number; pagar: number; skrap: number }>
  per_status: Record<string, number>
  per_dag: Array<{ datum: string; google_ads: number; ovriga: number }>
}

export interface UtfallGrupp {
  forfragningar: number
  bokat: number
  bokat_varde: number
  genomfort: number
  genomfort_varde: number
}

export interface MarknadUtfall {
  alla: UtfallGrupp
  google_ads: UtfallGrupp
  uppladdning: Array<{ typ: 'bokat' | 'genomfort'; status: string; antal: number; varde: number; senast: string | null }>
  uppladdning_totalt: number
}

export interface SamtyckeRad {
  samtyckes_id: string
  land: string | null
  status: 'accepted' | 'rejected' | 'partial'
  action: 'first_choice' | 'changed' | 'withdrawn'
  handling: string
  lager: string
  statistik: boolean
  marknadsforing: boolean
  version: number
  tid: string
}

export interface MarknadSamtycke {
  totalt: number
  godkant: number
  nekat: number
  delvis: number
  unika: number
  forsta_loggen: string | null
  per_dag: Array<{ datum: string; godkant: number; nekat: number; delvis: number }>
  per_land: Array<{ land: string; antal: number }>
  senaste: SamtyckeRad[]
}

export interface RetargetingLista {
  user_list_id: string
  namn: string
  typ: string | null
  status: string | null
  datum: string
  storlek_sok: number | null
  storlek_display: number | null
  storleksintervall_sok: string | null
  kan_visas_i_sok: boolean | null
  start_datum: string | null
  start_storlek_sok: number | null
  start_storlek_display: number | null
  trend: Array<{ datum: string; sok: number | null; display: number | null }>
}

export interface RetargetingVarden {
  visningar: number
  klick: number
  kostnad: number
  konverteringar: number
  konverteringsvarde: number
}

export interface RetargetingJamforelse {
  campaign_id: string
  kampanj: string
  kampanjstatus: string | null
  criterion_id: string
  user_list_id: string | null
  lista: string
  bud_justering: number | null
  /** Första dagen i perioden som listan hade data i kampanjen. */
  fran: string
  /** Besökare på listan (målgruppsraden). */
  lista_varden: RetargetingVarden
  /** Kampanjens totaler minus listan, från samma dag. */
  ovriga: RetargetingVarden
}

export interface MarknadRetargeting {
  listor: RetargetingLista[]
  jamforelse: RetargetingJamforelse[]
  data: { listor_hamtad_at: string | null; malgrupp_forsta_datum: string | null; malgrupp_hamtad_at: string | null }
}

/** Fel från RPC:erna när behörigheten saknas (errcode 42501). */
export class SaknarBehorighetError extends Error {}

async function anropa<T>(namn: string, params: Record<string, unknown>): Promise<T> {
  // RPC:erna finns inte i de genererade databastyperna
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>
  const { data, error } = await rpc.call(supabase, namn, params)
  if (error) {
    if (error.code === '42501') throw new SaknarBehorighetError(error.message)
    throw new Error(error.message)
  }
  return data as T
}

const period = (fran: string, till: string) => ({ p_fran: fran, p_till: till })

export const marknadService = {
  oversikt: (fran: string, till: string) => anropa<MarknadOversikt>('marknad_oversikt', period(fran, till)),
  soktermer: (fran: string, till: string, antal = 50) =>
    anropa<MarknadSoktermer>('marknad_soktermer', { ...period(fran, till), p_antal: antal }),
  leads: (fran: string, till: string) => anropa<MarknadLeads>('marknad_leads', period(fran, till)),
  utfall: (fran: string, till: string) => anropa<MarknadUtfall>('marknad_utfall', period(fran, till)),
  samtycke: (fran: string, till: string) => anropa<MarknadSamtycke>('marknad_samtycke', period(fran, till)),
  retargeting: (fran: string, till: string) => anropa<MarknadRetargeting>('marknad_retargeting', period(fran, till)),
}
