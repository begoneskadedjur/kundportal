// src/services/webInquiryService.ts
// Leads (Webb): läsning och hantering av förfrågningar från begone.se. Raderna skapas bara av
// api/forfragan.ts (service role); här läser och ändrar admin, koordinator och säljare via RLS.
// Historik för status, tilldelning och konvertering skrivs av databasens trigger.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { toLocalISOStringWithOffset } from '../utils/dateHelpers'
import type { Technician } from '../types/database'
import type {
  StaffProfile,
  WebInquiry,
  WebInquiryArendeTabell,
  WebInquiryEvent,
  WebInquiryKomplettering,
  WebInquiryStatus,
} from '../types/webInquiry'

// Tabellerna finns inte i de genererade typerna; otypad klient för just dessa anrop
const db = supabase as unknown as SupabaseClient

const BUCKET = 'web-inquiry-images'

export class WebInquiryService {
  /** Förfrågningar från och med ett datum (ÅÅÅÅ-MM-DD), nyast först. */
  static async list(fran?: string): Promise<WebInquiry[]> {
    let q = db.from('web_inquiries').select('*').order('created_at', { ascending: false }).limit(2000)
    if (fran) q = q.gte('created_at', `${fran}T00:00:00${offsetFor(fran)}`)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as WebInquiry[]
  }

  static async get(id: string): Promise<WebInquiry | null> {
    const { data, error } = await db.from('web_inquiries').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return (data as WebInquiry) ?? null
  }

  static async getNewCount(): Promise<number> {
    const { data, error } = await db.rpc('web_inquiries_new_count')
    if (error) throw error
    return typeof data === 'number' ? data : 0
  }

  static async setStatus(id: string, status: WebInquiryStatus): Promise<void> {
    const { error } = await db.from('web_inquiries').update({ status }).eq('id', id)
    if (error) throw error
  }

  static async assign(id: string, profileId: string | null): Promise<void> {
    const { error } = await db.from('web_inquiries').update({ tilldelad_till: profileId }).eq('id', id)
    if (error) throw error
  }

  static async linkLead(id: string, leadId: string): Promise<void> {
    const { error } = await db.from('web_inquiries').update({ lead_id: leadId }).eq('id', id)
    if (error) throw error
  }

  /**
   * Kopplar förfrågan till ärendet som skapades från den. Databasens trigger sätter status Bokad,
   * stämplar bokad_at och skriver historikraden "Ärende skapat". Kopplingen kan bara sättas en gång.
   */
  static async linkCase(id: string, tabell: WebInquiryArendeTabell, caseId: string): Promise<WebInquiry> {
    const { data, error } = await db
      .from('web_inquiries')
      .update({ arende_tabell: tabell, arende_id: caseId })
      .eq('id', id)
      .is('arende_id', null)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Förfrågan har redan ett ärende')
    return data as WebInquiry
  }

  /**
   * Kopplar en offert som just skickats från Oneflow-guiden till förfrågan. Databasens trigger
   * kontrollerar att offerten finns och är skickad, sätter status Offert och 90 dagars frist och
   * skriver historikraden "Offert skickad". Anropas bara när offerten faktiskt skickats.
   */
  static async linkOffer(id: string, oneflowContractId: string): Promise<void> {
    const { error } = await db.from('web_inquiries').update({ offert_oneflow_id: oneflowContractId }).eq('id', id)
    if (error) throw error
  }

  /**
   * Sparar personnummer eller org.nr och rättad adress efter samtalet. Databasens trigger stämplar
   * vem och när och skriver historikraden "Uppgifter kompletterade" utan själva numret.
   * Felet som kastas innehåller aldrig numret (felets detaljer kastas bort).
   */
  static async saveKomplettering(id: string, k: WebInquiryKomplettering): Promise<WebInquiry> {
    const { data, error } = await db.from('web_inquiries').update(k).eq('id', id).select('*').maybeSingle()
    if (error || !data) throw new Error('Uppgifterna kunde inte sparas')
    return data as WebInquiry
  }

  /** Aktiva tekniker för ärendemodalens bokning. */
  static async listTechnicians(): Promise<Technician[]> {
    const { data, error } = await supabase.from('technicians').select('*').eq('is_active', true).order('name')
    if (error) throw error
    return (data ?? []) as Technician[]
  }

  /**
   * Förfrågans bilder som filer, för att följa med in i ärendemodalen. Där laddas de upp till
   * ärendet som vanliga ärendebilder (bucketen case-images och tabellen case_images).
   */
  static async imageFiles(id: string, max = 10): Promise<File[]> {
    const lista = await db.storage.from(BUCKET).list(id, { limit: 20 })
    if (lista.error || !lista.data?.length) return []
    const namn = lista.data
      .filter((f) => f.name && !f.name.startsWith('.'))
      .map((f) => f.name)
      .sort()
      .slice(0, max)
    const filer = await Promise.all(
      namn.map(async (n) => {
        const { data, error } = await db.storage.from(BUCKET).download(`${id}/${n}`)
        if (error || !data) return null
        return new File([data], n, { type: data.type || mimeFor(n) })
      }),
    )
    return filer.filter((f): f is File => !!f)
  }

  static async listEvents(id: string): Promise<WebInquiryEvent[]> {
    const { data, error } = await db
      .from('web_inquiry_events')
      .select('*')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as WebInquiryEvent[]
  }

  static async addNote(id: string, profileId: string, text: string): Promise<void> {
    const { error } = await db.from('web_inquiry_events').insert({
      inquiry_id: id,
      typ: 'anteckning',
      text: text.trim().slice(0, 4000),
      profile_id: profileId,
      created_at: toLocalISOStringWithOffset(),
    })
    if (error) throw error
  }

  /** Personal som kan tilldelas: admin, koordinator och säljare (huvudroll eller extra roll). */
  static async listStaff(): Promise<StaffProfile[]> {
    const { data, error } = await db
      .from('profiles')
      .select('id, display_name, email, role, extra_roles, is_active')
      .eq('is_active', true)
    if (error) throw error
    const roller = ['admin', 'koordinator', 'säljare']
    return ((data ?? []) as (StaffProfile & { extra_roles: string[] | null })[])
      .filter((p) => roller.includes(p.role ?? '') || (p.extra_roles ?? []).some((r) => roller.includes(r)))
      .map(({ id, display_name, email, role }) => ({ id, display_name, email, role }))
      .sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email, 'sv'))
  }

  /** Bilderna som finns i bucketen, med signerade visnings-URL:er (1 timme). */
  static async imageUrls(id: string): Promise<{ path: string; url: string }[]> {
    const lista = await db.storage.from(BUCKET).list(id, { limit: 20 })
    if (lista.error || !lista.data?.length) return []
    const paths = lista.data.filter((f) => f.name && !f.name.startsWith('.')).map((f) => `${id}/${f.name}`)
    if (!paths.length) return []
    const { data, error } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600)
    if (error || !data) return []
    return data
      .filter((d) => d.signedUrl)
      .map((d) => ({ path: d.path ?? '', url: d.signedUrl }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }
}

function mimeFor(namn: string): string {
  const ext = namn.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  return 'image/jpeg'
}

/** Svensk offset (+01:00 eller +02:00) för ett datum, så att dagsgränsen blir svensk midnatt. */
function offsetFor(datum: string): string {
  const d = new Date(`${datum}T12:00:00`)
  const iso = toLocalISOStringWithOffset(d)
  return iso.slice(-6)
}
