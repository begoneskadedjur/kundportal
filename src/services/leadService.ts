// src/services/leadService.ts
// Leads (B2B) sedan etapp 4: läsning och skrivning mot leads, lead_activities, lead_members och RPC:erna
// lead_overlat, lead_dela, lead_sluta_dela, lead_dubbletter och lead_personal. Behörigheten sköts av RLS
// (admin/koordinator ser allt, övrig personal sina egna, tipsade och delade). Historiken skrivs av
// databasen; klienten skriver bara människans aktiviteter (anteckning, samtal, mejl, möte).

import { supabase } from '../lib/supabase'
import type { Lead, LeadContact, LeadUpdate } from '../types/database'
import type {
  LeadAktivitet,
  LeadAktivitetManuell,
  LeadArendeTabell,
  LeadArendeUnderlag,
  LeadBokatTabell,
  LeadDubblett,
  LeadFranArendeSvar,
  LeadGaller,
  LeadMedlem,
  LeadPerson,
} from '../types/leads'

export type LeadNy = Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'org_nr_norm' | 'phone_norm' | 'email_norm'>> & {
  company_name: string
}

function fel(error: { message?: string } | null, standard: string): never {
  throw new Error(error?.message || standard)
}

export class LeadService {
  /** Alla leads anroparen får se (RLS), med hela raden. */
  static async list(): Promise<Lead[]> {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(2000)
    if (error) fel(error, 'Leads kunde inte hämtas')
    return (data ?? []) as Lead[]
  }

  static async get(id: string): Promise<Lead | null> {
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle()
    if (error) fel(error, 'Leaden kunde inte hämtas')
    return (data as Lead) ?? null
  }

  static async create(rad: LeadNy): Promise<Lead> {
    const { data, error } = await supabase.from('leads').insert(rad).select('*').single()
    if (error) fel(error, 'Leaden kunde inte skapas')
    return data as Lead
  }

  /** Skickar bara de fält som skickas in (diff görs av anroparen). */
  static async update(id: string, andring: LeadUpdate): Promise<Lead> {
    const { data, error } = await supabase.from('leads').update(andring).eq('id', id).select('*').single()
    if (error) fel(error, 'Ändringen kunde inte sparas')
    return data as Lead
  }

  static async aktiviteter(leadId: string): Promise<LeadAktivitet[]> {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) fel(error, 'Historiken kunde inte hämtas')
    return (data ?? []) as LeadAktivitet[]
  }

  /** occurred_at sätts med svensk offset (tidszon-hantering). */
  static async loggaAktivitet(leadId: string, profileId: string, kind: LeadAktivitetManuell, text: string, occurredAt: string): Promise<void> {
    const { error } = await supabase
      .from('lead_activities')
      .insert({ lead_id: leadId, profile_id: profileId, kind, text: text.trim() || null, occurred_at: occurredAt })
    if (error) fel(error, 'Aktiviteten kunde inte sparas')
  }

  /** Aktiva delningar (removed_at null) för de leads anroparen ser. */
  static async medlemmar(leadId?: string): Promise<LeadMedlem[]> {
    let q = supabase.from('lead_members').select('*').is('removed_at', null)
    if (leadId) q = q.eq('lead_id', leadId)
    const { data, error } = await q
    if (error) fel(error, 'Delningarna kunde inte hämtas')
    return (data ?? []) as LeadMedlem[]
  }

  static async kontakter(leadId: string): Promise<LeadContact[]> {
    const { data, error } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('lead_id', leadId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) fel(error, 'Kontakterna kunde inte hämtas')
    return (data ?? []) as LeadContact[]
  }

  static async personal(): Promise<LeadPerson[]> {
    const { data, error } = await supabase.rpc('lead_personal')
    if (error) fel(error, 'Personalen kunde inte hämtas')
    return (data ?? []) as LeadPerson[]
  }

  static async dubbletter(org: string, telefon: string, epost: string, utom?: string | null): Promise<LeadDubblett[]> {
    const { data, error } = await supabase.rpc('lead_dubbletter', {
      p_org: org || null,
      p_telefon: telefon || null,
      p_epost: epost || null,
      p_utom: utom ?? null,
    })
    if (error) fel(error, 'Dubblettkontrollen kunde inte göras')
    return (data ?? []) as LeadDubblett[]
  }

  static async overlat(leadId: string, nyAgare: string, behallSomDelad: boolean): Promise<void> {
    const { error } = await supabase.rpc('lead_overlat', { p_lead: leadId, p_ny_agare: nyAgare, p_behall_som_delad: behallSomDelad })
    if (error) fel(error, 'Leaden kunde inte överlåtas')
  }

  static async dela(leadId: string, profiler: string[]): Promise<number> {
    const { data, error } = await supabase.rpc('lead_dela', { p_lead: leadId, p_profiler: profiler })
    if (error) fel(error, 'Leaden kunde inte delas')
    return (data as number) ?? 0
  }

  static async slutaDela(leadId: string, profil: string): Promise<void> {
    const { error } = await supabase.rpc('lead_sluta_dela', { p_lead: leadId, p_profil: profil })
    if (error) fel(error, 'Delningen kunde inte tas bort')
  }

  // -------------------------------------------------------------------------
  // Etapp 5: lead från engångsärende, bokat besök och kundkoppling
  // -------------------------------------------------------------------------

  /** Ärendets uppgifter, befintlig lead på ärendet och öppna dubbletter. Kastar om anroparen inte ser ärendet. */
  static async arendeUnderlag(caseType: LeadArendeTabell, caseId: string): Promise<LeadArendeUnderlag> {
    const { data, error } = await supabase.rpc('lead_arende_underlag', { p_case_type: caseType, p_case_id: caseId })
    if (error) fel(error, 'Ärendets uppgifter kunde inte hämtas')
    return data as LeadArendeUnderlag
  }

  /** Skapar leaden från ärendet (eller returnerar den som redan finns, skapad = false). */
  static async franArende(caseType: LeadArendeTabell, caseId: string, galler: LeadGaller, beskrivning: string, foretag?: string | null): Promise<LeadFranArendeSvar> {
    const { data, error } = await supabase.rpc('lead_fran_arende', {
      p_case_type: caseType,
      p_case_id: caseId,
      p_galler: galler,
      p_beskrivning: beskrivning,
      p_foretag: foretag?.trim() || null,
    })
    if (error) fel(error, 'Leaden kunde inte skapas')
    return data as LeadFranArendeSvar
  }

  /** Tipset som anteckning på en befintlig lead (dubblett), med ärendet som referens. */
  static async anteckningFranArende(leadId: string, caseType: LeadArendeTabell, caseId: string, text: string): Promise<void> {
    const { error } = await supabase.rpc('lead_anteckning_fran_arende', { p_lead: leadId, p_case_type: caseType, p_case_id: caseId, p_text: text })
    if (error) fel(error, 'Anteckningen kunde inte sparas')
  }

  /** Kopplar ett ärende som bokats från leaden. Ny eller Kontaktad blir Besök bokat. */
  static async kopplaBesok(leadId: string, caseType: LeadBokatTabell, caseId: string): Promise<void> {
    const { error } = await supabase.rpc('lead_koppla_besok', { p_lead: leadId, p_case_type: caseType, p_case_id: caseId })
    if (error) fel(error, 'Ärendet kunde inte kopplas till leaden')
  }

  /** Kunder att koppla för hand: namn, org.nr eller kundnummer (aktiva, högst 8). */
  static async sokKunder(q: string): Promise<{ id: string; company_name: string; organization_number: string | null; customer_number: number | null }[]> {
    const t = q.trim()
    if (t.length < 2) return []
    const siffror = t.replace(/\D/g, '')
    const villkor = [`company_name.ilike.%${t.replace(/[%,()]/g, ' ')}%`]
    if (siffror.length >= 6) villkor.push(`organization_number.ilike.%${siffror.slice(0, 6)}%`)
    if (/^\d{1,6}$/.test(t)) villkor.push(`customer_number.eq.${t}`)
    const { data, error } = await supabase
      .from('customers')
      .select('id, company_name, organization_number, customer_number')
      .eq('is_active', true)
      .or(villkor.join(','))
      .order('company_name')
      .limit(8)
    if (error) fel(error, 'Kunderna kunde inte sökas')
    return (data ?? []) as { id: string; company_name: string; organization_number: string | null; customer_number: number | null }[]
  }

  /** Kundens namn för Ursprung och kopplingar (null om RLS inte släpper igenom). */
  static async kundnamn(customerId: string): Promise<string | null> {
    const { data } = await supabase.from('customers').select('company_name').eq('id', customerId).maybeSingle()
    return (data as { company_name?: string } | null)?.company_name ?? null
  }
}
