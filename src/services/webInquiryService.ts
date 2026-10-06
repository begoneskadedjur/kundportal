// src/services/webInquiryService.ts
// Leads (Webb): läsning och hantering av förfrågningar från begone.se. Raderna skapas bara av
// api/forfragan.ts (service role); här läser och ändrar admin, koordinator och säljare via RLS.
// Historik för status, tilldelning och konvertering skrivs av databasens trigger.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { toLocalISOStringWithOffset } from '../utils/dateHelpers'
import type { Technician } from '../types/database'
import { resolveContractsForCustomers } from './contractResolver'
import { todayKey } from '../utils/contractLifecycle'
import { inheritOrgNr } from '../utils/multisiteHelpers'
import { effektivtIdNummer } from '../shared/webLeadUppgifter'
import type {
  ArendeTraff,
  KundMatchning,
  KundMatchSatt,
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
  static async linkCase(id: string, tabell: WebInquiryArendeTabell, caseId: string, kopplat = false): Promise<WebInquiry> {
    const { data, error } = await db
      .from('web_inquiries')
      .update({ arende_tabell: tabell, arende_id: caseId, arende_kopplat: kopplat })
      .eq('id', id)
      .is('arende_id', null)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Förfrågan har redan ett ärende')
    return data as WebInquiry
  }

  /**
   * Söker ett ärende på ärendenummer i alla tre ärendetabellerna, för Koppla befintligt ärende.
   * "9012", "be9012" och "BE-0009012" ger samma sökning. Rondering och egenkontroll tas inte med.
   */
  static async findCaseByNumber(nummer: string): Promise<ArendeTraff[]> {
    const n = normaliseraArendenummer(nummer)
    if (!n) return []
    const [pc, bc, c] = await Promise.all([
      db.from('private_cases').select('id, case_number, created_at, kontaktperson, status').eq('case_number', n).limit(5),
      db.from('business_cases').select('id, case_number, created_at, company_name, kontaktperson, status').eq('case_number', n).limit(5),
      db.from('cases').select('id, case_number, created_at, customer_id, service_type, status').eq('case_number', n).limit(5),
    ])
    if (pc.error || bc.error || c.error) throw new Error('Ärendet kunde inte sökas')

    const kundIds = [...new Set(((c.data ?? []) as { customer_id: string | null }[]).map((r) => r.customer_id).filter((x): x is string => !!x))]
    const kundNamn = new Map<string, string>()
    if (kundIds.length) {
      const { data } = await db.from('customers').select('id, company_name').in('id', kundIds)
      for (const k of (data ?? []) as { id: string; company_name: string | null }[]) kundNamn.set(k.id, k.company_name ?? '')
    }

    type Rad = { id: string; case_number: string; created_at: string; status: string | null }
    const traffar: ArendeTraff[] = [
      ...((pc.data ?? []) as (Rad & { kontaktperson: string | null })[]).map((r) => ({
        tabell: 'private_cases' as const, id: r.id, case_number: r.case_number, created_at: r.created_at,
        kund: r.kontaktperson, typ: 'Privatperson', service_type: null, status: r.status, kopplat: false,
      })),
      ...((bc.data ?? []) as (Rad & { company_name: string | null; kontaktperson: string | null })[]).map((r) => ({
        tabell: 'business_cases' as const, id: r.id, case_number: r.case_number, created_at: r.created_at,
        kund: r.company_name || r.kontaktperson, typ: 'Företag', service_type: null, status: r.status, kopplat: false,
      })),
      ...((c.data ?? []) as (Rad & { customer_id: string | null; service_type: string | null })[])
        .filter((r) => r.service_type !== 'rondering_trafikkontoret' && r.service_type !== 'egenkontroll_trafikkontoret')
        .map((r) => ({
          tabell: 'cases' as const, id: r.id, case_number: r.case_number, created_at: r.created_at,
          kund: r.customer_id ? kundNamn.get(r.customer_id) ?? null : null,
          typ: r.service_type === 'inspection' ? 'Stationskontroll' : r.service_type === 'establishment' ? 'Etablering' : 'Avtalsärende',
          service_type: r.service_type, status: r.status, kopplat: false,
        })),
    ]
    if (traffar.length) {
      const { data } = await db.from('web_inquiries').select('arende_tabell, arende_id').in('arende_id', traffar.map((t) => t.id))
      const kopplade = new Set(((data ?? []) as { arende_tabell: string; arende_id: string }[]).map((r) => `${r.arende_tabell}:${r.arende_id}`))
      for (const t of traffar) t.kopplat = kopplade.has(`${t.tabell}:${t.id}`)
    }
    return traffar
  }

  /** Status för avtalsärenden (tabellen cases), för statistiken över befintliga kunder. */
  static async contractCaseStatuses(ids: string[]): Promise<Record<string, string>> {
    const unika = [...new Set(ids)].filter(Boolean)
    if (!unika.length) return {}
    const ut: Record<string, string> = {}
    for (let i = 0; i < unika.length; i += 200) {
      const { data, error } = await db.from('cases').select('id, status').in('id', unika.slice(i, i + 200))
      if (error) throw error
      for (const r of (data ?? []) as { id: string; status: string | null }[]) ut[r.id] = r.status ?? ''
    }
    return ut
  }

  /**
   * Aktiva kunder i kundregistret som förfrågan matchar: först org.nr (även det koordinatorn
   * fyllt i under Uppgifter), sedan e-postdomän mot kundernas kontakt- och fakturamejl (aldrig
   * allmänna domäner), sedan telefonnummer. Enheter utan eget org.nr matchar via huvudkontoret.
   * Avtalet slås upp med avtalsresolvern (eget avtal, avtalsomfattning, huvudkontorets avtal för
   * alla enheter) och annars kundradens avtal, med arv från huvudkontoret.
   * Inga kunduppgifter loggas.
   */
  static async findCustomerMatches(inquiry: WebInquiry): Promise<KundMatchning[]> {
    const { data, error } = await db
      .from('customers')
      .select('id, company_name, site_name, site_type, is_active, parent_customer_id, organization_number, contact_email, billing_email, contact_phone, contract_status, contract_end_date, customer_number')
      .limit(5000)
    if (error) throw new Error('Kundregistret kunde inte läsas')
    const alla = (data ?? []) as KundRad[]
    const perId = new Map(alla.map((k) => [k.id, k]))
    const foralder = (k: KundRad) => (k.parent_customer_id ? perId.get(k.parent_customer_id) ?? null : null)
    const aktiva = alla.filter((k) => k.is_active)

    let satt: KundMatchSatt | null = null
    let traffar: KundRad[] = []

    // 1. Org.nr, med arv från huvudkontoret
    const idn = new Set(
      [effektivtIdNummer(inquiry)?.varde, inquiry.id_nummer_typ === 'orgnr' ? inquiry.id_nummer : null, inquiry.organization_number]
        .map(normaliseraOrgnr)
        .filter((x): x is string => !!x),
    )
    if (idn.size) {
      traffar = aktiva.filter((k) => {
        const nr = normaliseraOrgnr(inheritOrgNr(k, foralder(k)))
        return !!nr && idn.has(nr)
      })
      if (traffar.length) satt = 'orgnr'
    }

    // 2. E-postdomän
    const doman = epostDoman(inquiry.email)
    if (!satt && doman && !arAllmanDoman(doman)) {
      traffar = aktiva.filter((k) => domaner(k.contact_email).includes(doman) || domaner(k.billing_email).includes(doman))
      if (traffar.length) satt = 'epostdoman'
    }

    // 3. Telefonnummer
    const tel = normaliseraTelefon(inquiry.phone)
    if (!satt && tel) {
      traffar = aktiva.filter((k) => telefonnummer(k.contact_phone).includes(tel))
      if (traffar.length) satt = 'telefon'
    }

    if (!satt || !traffar.length) return []
    const traffSatt: KundMatchSatt = satt

    // Avtalen: resolvern först, kundradens avtal (med arv) som reserv
    const idag = todayKey()
    const avtalPerKund = await resolveContractsForCustomers(traffar.map((k) => k.id)).catch(() => ({} as Record<string, string>))
    const avtalIds = [...new Set(Object.values(avtalPerKund))]
    const slutPerAvtal = new Map<string, string | null>()
    if (avtalIds.length) {
      const { data: avtal } = await db.from('contracts').select('id, contract_end_date, effective_end_date').in('id', avtalIds)
      for (const a of (avtal ?? []) as { id: string; contract_end_date: string | null; effective_end_date: string | null }[]) {
        slutPerAvtal.set(a.id, a.effective_end_date || a.contract_end_date || null)
      }
    }

    return traffar
      .map((k): KundMatchning => {
        const hk = foralder(k)
        const avtalId = avtalPerKund[k.id]
        const radStatus = k.contract_status || hk?.contract_status || null
        const radSlut = k.contract_end_date || hk?.contract_end_date || null
        const radAvtal = (radStatus === 'signed' || radStatus === 'active') && (!radSlut || radSlut >= idag)
        return {
          customer_id: k.id,
          namn: k.company_name || k.site_name || 'Namnlös kund',
          kundnummer: k.customer_number ?? hk?.customer_number ?? null,
          ar_enhet: !!k.parent_customer_id,
          huvudkontor_id: k.parent_customer_id,
          huvudkontor_namn: hk?.company_name ?? null,
          har_avtal: !!avtalId || radAvtal,
          avtal_till: (avtalId ? slutPerAvtal.get(avtalId) ?? null : null) || radSlut,
          satt: traffSatt,
        }
      })
      .sort((a, b) =>
        Number(b.har_avtal) - Number(a.har_avtal) ||
        Number(a.ar_enhet) - Number(b.ar_enhet) ||
        a.namn.localeCompare(b.namn, 'sv'),
      )
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

interface KundRad {
  id: string
  company_name: string | null
  site_name: string | null
  site_type: string | null
  is_active: boolean | null
  parent_customer_id: string | null
  organization_number: string | null
  contact_email: string | null
  billing_email: string | null
  contact_phone: string | null
  contract_status: string | null
  contract_end_date: string | null
  customer_number: number | null
}

/** Ärendenummer som BE-0009012. Bara siffror eller BE utan bindestreck fylls ut till sju siffror. */
function normaliseraArendenummer(s: string): string | null {
  const t = s.trim().toUpperCase().replace(/\s+/g, '')
  if (!t) return null
  const m = t.match(/^(?:BE-?)?(\d{1,7})$/)
  if (m) return `BE-${m[1].padStart(7, '0')}`
  return t
}

/** Org.nr eller personnummer som tio siffror (sekel och bindestreck bort). */
function normaliseraOrgnr(s: string | null | undefined): string | null {
  const d = (s ?? '').replace(/\D/g, '')
  if (d.length === 12 && /^(16|18|19|20)/.test(d)) return d.slice(2)
  return d.length === 10 ? d : null
}

/** Telefonnummer som svenskt nummer med inledande nolla, bara siffror. Minst åtta siffror. */
function normaliseraTelefon(s: string | null | undefined): string | null {
  let d = (s ?? '').replace(/\D/g, '')
  if (d.startsWith('0046')) d = `0${d.slice(4)}`
  else if (d.startsWith('46') && d.length >= 11) d = `0${d.slice(2)}`
  if (d.startsWith('00')) return null
  return d.length >= 8 ? d : null
}

function telefonnummer(falt: string | null | undefined): string[] {
  return (falt ?? '')
    .split(/[,;/]|\boch\b/)
    .map(normaliseraTelefon)
    .filter((x): x is string => !!x)
}

function epostDoman(epost: string | null | undefined): string | null {
  const m = (epost ?? '').trim().toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/)
  return m ? m[1] : null
}

function domaner(falt: string | null | undefined): string[] {
  return [...(falt ?? '').toLowerCase().matchAll(/@([a-z0-9.-]+\.[a-z]{2,})/g)].map((m) => m[1])
}

/** Allmänna e-posttjänster och vår egen domän: säger inget om vilket företag det är. */
const ALLMANNA_DOMANER = new Set([
  'gmail', 'googlemail', 'hotmail', 'outlook', 'live', 'icloud', 'mac', 'yahoo', 'ymail', 'telia', 'spray',
  'bredband', 'bredband2', 'comhem', 'tele2', 'bahnhof', 'msn', 'me', 'aol', 'gmx', 'protonmail', 'proton',
])

/**
 * Sant för allmänna e-posttjänster och vår egen domän. Varje del utom toppdomänen prövas, så att
 * även hotmail.co.uk och yahoo.com.au räknas som allmänna.
 */
function arAllmanDoman(doman: string): boolean {
  if (doman === 'begone.se' || doman.endsWith('.begone.se')) return true
  const delar = doman.split('.')
  return delar.slice(0, -1).some((d) => ALLMANNA_DOMANER.has(d))
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
