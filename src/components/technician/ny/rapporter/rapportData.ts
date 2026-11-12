// src/components/technician/ny/rapporter/rapportData.ts
// Hämtning för Mina rapporter: avslutade ärenden där inloggad tekniker är
// tekniker 1, 2 eller 3 (samma regel som hamtaAllaArenden i teknikerDagService),
// avslutade från och med en dag (svensk tid, ISO med uttrycklig offset).
// Hämtas sida för sida med range() eftersom PostgREST klipper vid 1 000 rader.
// Egenkontroll har ingen ärenderapport och tas inte med.

import { supabase } from '../../../../lib/supabase'
import {
  TYP_ETIKETT, formateraAdress, svenskMidnatt, typForServiceType, type BesokTyp,
} from '../../../../services/teknikerDagService'
import { dagFor, rapportSortFor, type RapportRad } from './rapportLogik'

const SIDA = 1000

const CASES_FALT = 'id, case_number, status, service_type, completed_date, title, pest_type, contact_person, contact_email, primary_technician_id, secondary_technician_id, tertiary_technician_id, customer:customers(company_name, contact_person, contact_email)'
const PRIVAT_FALT = 'id, case_number, status, completed_date, title, skadedjur, annat_skadedjur, kontaktperson, e_post_kontaktperson, adress'
const FORETAG_FALT = `${PRIVAT_FALT}, company_name, bestallare`

/** Hämtar alla sidor för en fråga. byggFraga får from/to och ska returnera frågan med range(). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function allaSidor(byggFraga: (fran: number, till: number) => PromiseLike<{ data: any[] | null; error: unknown }>): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ut: any[] = []
  for (let fran = 0; ; fran += SIDA) {
    const { data, error } = await byggFraga(fran, fran + SIDA - 1)
    if (error) throw error
    const rader = data || []
    ut.push(...rader)
    if (rader.length < SIDA) break
  }
  return ut
}

function tjanstText(typ: BesokTyp, skadedjur: string | null | undefined): string {
  const etikett = typ === 'inspection' ? 'Stationskontroll' : TYP_ETIKETT[typ]
  return skadedjur ? `${etikett}, ${skadedjur.toLowerCase()}` : etikett
}

function tid(v: unknown): Date | null {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

function rensa(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Avslutade ärenden med rapport från och med dagen fran (YYYY-MM-DD, svensk tid) */
export async function hamtaRapporter(technicianId: string, fran: string): Promise<RapportRad[]> {
  const tek = technicianId
  const gte = svenskMidnatt(fran)

  const [cases, privat, foretag] = await Promise.all([
    allaSidor((a, b) => supabase.from('cases').select(CASES_FALT)
      .or(`primary_technician_id.eq.${tek},secondary_technician_id.eq.${tek},tertiary_technician_id.eq.${tek}`)
      .is('deleted_at', null)
      .eq('status', 'Avslutat')
      .gte('completed_date', gte)
      .order('completed_date', { ascending: false })
      .order('id')
      .range(a, b)),
    allaSidor((a, b) => supabase.from('private_cases').select(PRIVAT_FALT)
      .or(`primary_assignee_id.eq.${tek},secondary_assignee_id.eq.${tek},tertiary_assignee_id.eq.${tek}`)
      .is('deleted_at', null)
      .is('legacy_archived_at', null)
      .eq('status', 'Avslutat')
      .gte('completed_date', gte)
      .order('completed_date', { ascending: false })
      .order('id')
      .range(a, b)),
    allaSidor((a, b) => supabase.from('business_cases').select(FORETAG_FALT)
      .or(`primary_assignee_id.eq.${tek},secondary_assignee_id.eq.${tek},tertiary_assignee_id.eq.${tek}`)
      .is('deleted_at', null)
      .is('legacy_archived_at', null)
      .eq('status', 'Avslutat')
      .gte('completed_date', gte)
      .order('completed_date', { ascending: false })
      .order('id')
      .range(a, b)),
  ])

  const ut: RapportRad[] = []

  for (const c of cases) {
    const typ = typForServiceType(c.service_type)
    const sort = rapportSortFor(typ)
    const avslutad = tid(c.completed_date)
    if (!sort || !avslutad) continue
    const kund = Array.isArray(c.customer) ? c.customer[0] : c.customer
    // Samma adress som ärendemodalerna skickar till: kontrollrapporten tar kundkortets
    // adress först, ärenderapporten ärendets kontaktadress (rondering bara ärendets)
    const kundEpost = typ === 'inspection'
      ? rensa(kund?.contact_email) ?? rensa(c.contact_email)
      : typ === 'rondering'
        ? rensa(c.contact_email)
        : rensa(c.contact_email) ?? rensa(kund?.contact_email)
    ut.push({
      nyckel: `cases:${c.id}`,
      kalla: 'cases',
      id: c.id,
      typ,
      sort,
      arendenummer: c.case_number ?? null,
      avslutad,
      dag: dagFor(avslutad),
      kund: kund?.company_name || c.title || 'Okänd kund',
      tjanst: tjanstText(typ, c.pest_type),
      kundEpost,
      kontaktperson: rensa(c.contact_person) ?? rensa(kund?.contact_person),
    })
  }

  const clickup = (rader: typeof privat, kalla: 'private' | 'business') => {
    for (const c of rader) {
      const avslutad = tid(c.completed_date)
      if (!avslutad) continue
      const adress = formateraAdress(c.adress)
      const namn = (kalla === 'business' ? c.company_name || c.bestallare : null) || c.kontaktperson || c.title || 'Okänd kund'
      ut.push({
        nyckel: `${kalla}:${c.id}`,
        kalla,
        id: c.id,
        typ: kalla,
        sort: 'sanering',
        arendenummer: c.case_number ?? null,
        avslutad,
        dag: dagFor(avslutad),
        kund: kalla === 'private' && adress ? `${namn}, ${adress.split(',')[0]}` : namn,
        tjanst: tjanstText(kalla, c.skadedjur || c.annat_skadedjur),
        kundEpost: rensa(c.e_post_kontaktperson),
        kontaktperson: rensa(c.kontaktperson),
      })
    }
  }
  clickup(privat, 'private')
  clickup(foretag, 'business')

  return ut.sort((a, b) => b.avslutad.getTime() - a.avslutad.getTime())
}
