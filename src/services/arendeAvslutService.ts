// src/services/arendeAvslutService.ts
// Gemensam avslutskontroll: samlar spärrarna som ärendemodalerna kör innan ett
// ärende får klarmarkeras (status Avslutat). Varje kontroll nedan är en kopia
// av en befintlig spärr, med källan angiven (fil:rad per 2026-10-22). Undantag:
// rapportspärren (2026-10-24) är ny och finns även i modalernas spara (RAPPORT_SAKNAS_FEL).
// Ändras en spärr i en modal ska den ändras här också, tills
// modalerna själva anropar kontrolleraAvslut.
//
// Kontrollerna läser databasens sparade läge. Osparade ändringar i en öppen
// modal (t.ex. ett nyvalt datum) syns inte här; värden ansvarar för att spara
// först eller kontrollera det själv.
//
// Kundgruppen (EditCaseModal needsCustomerGroup) kontrolleras inte här: modalen
// väljer den lokalt och sparar den aldrig på ärendet, så en kontroll mot
// databasen gav felaktiga hinder. EditCaseModal lägger själv till hindret.

import { supabase } from '../lib/supabase'
import { CaseBillingService } from './caseBillingService'
import {
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer
} from './inspectionSessionService'
import { sluttidForeStart, SLUTTID_FORE_START_FEL } from '../utils/besokstid'

export type ArendeKalla = 'cases' | 'private_cases' | 'business_cases'

export interface AvslutsHinder {
  id: string
  text: string
  steg: 'framme' | 'arbete' | 'foton' | 'rapport' | 'pris' | 'klart'
}

interface ArendeRad {
  start: string | null
  slut: string | null
  /** Rapportens text: work_report på avtalsärenden, rapport på privat/företag */
  rapport: string | null
  serviceType: string | null
}

async function hamtaArende(caseId: string, kalla: ArendeKalla): Promise<ArendeRad | null> {
  if (kalla === 'cases') {
    // Avtalsärenden (EditContractCaseModal/RonderingCaseModal) har scheduled_start/scheduled_end
    const { data, error } = await supabase
      .from('cases')
      .select('scheduled_start, scheduled_end, work_report, service_type')
      .eq('id', caseId)
      .maybeSingle()
    if (error) throw new Error(`Kunde inte läsa ärendet: ${error.message}`)
    if (!data) return null
    return {
      start: data.scheduled_start ?? null,
      slut: data.scheduled_end ?? null,
      rapport: data.work_report ?? null,
      serviceType: data.service_type ?? null
    }
  }
  // Privat-/företagsärenden (EditCaseModal) har start_date/due_date
  const { data, error } = await supabase
    .from(kalla)
    .select('start_date, due_date, rapport')
    .eq('id', caseId)
    .maybeSingle()
  if (error) throw new Error(`Kunde inte läsa ärendet: ${error.message}`)
  if (!data) return null
  const rad = data as unknown as Record<string, string | null | undefined>
  return {
    start: rad.start_date ?? null,
    slut: rad.due_date ?? null,
    rapport: rad.rapport ?? null,
    serviceType: null
  }
}

/**
 * Avtalsärenden som dokumenteras någon annanstans och därför avslutas utan
 * skriven rapport: kontroller (stationerna och Kommentar från tekniker),
 * etableringar (utplaceringen) och egenkontroller (granskningen).
 */
export const UTAN_SKRIVEN_RAPPORT = ['inspection', 'establishment', 'egenkontroll_trafikkontoret']

/** Ärendet kräver en skriven rapport innan det avslutas (2026-10-24) */
export function kraverRapport(kalla: ArendeKalla, serviceType: string | null | undefined): boolean {
  if (kalla !== 'cases') return true
  return !UTAN_SKRIVEN_RAPPORT.includes(serviceType ?? '')
}

export const RAPPORT_SAKNAS_FEL = 'Skriv rapporten innan ärendet avslutas. Beskriv vad du gjorde.'

/**
 * Stationskontrollen (delsystem A): alla kundens stationer ska vara
 * kontrollerade i rundan. Samma regel som klarmarkeringsdialogen i
 * StationInspectionPanel.tsx (tidigare StationInspectionModule.tsx:2634):
 * knappen är avstängd när inspected < total, där total synkas mot kundens
 * faktiska stationsantal (StationInspectionModule.tsx:421-438) och inspected
 * är sessionens räknare inspected_outdoor/indoor_stations.
 */
async function kontrolleraStationer(caseId: string): Promise<AvslutsHinder[]> {
  const { data: session, error } = await supabase
    .from('station_inspection_sessions')
    .select('id, customer_id, inspected_outdoor_stations, inspected_indoor_stations')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Kunde inte läsa stationskontrollen: ${error.message}`)
  if (!session) return []

  const [ute, inne] = await Promise.all([
    getOutdoorStationsForCustomer(session.customer_id),
    getIndoorStationsForCustomer(session.customer_id)
  ])
  const totalt = ute.length + inne.length
  const kontrollerade = (session.inspected_outdoor_stations ?? 0) + (session.inspected_indoor_stations ?? 0)
  if (kontrollerade >= totalt) return []
  const kvar = totalt - kontrollerade
  return [{
    id: 'stationer-okontrollerade',
    text: `${kvar} av ${totalt} stationer är inte kontrollerade. Kontrollera alla stationer innan ärendet klarmarkeras.`,
    steg: 'arbete'
  }]
}

export async function kontrolleraAvslut(args: {
  caseId: string
  kalla: ArendeKalla
  serviceType?: string | null
}): Promise<AvslutsHinder[]> {
  const { caseId, kalla, serviceType } = args
  const hinder: AvslutsHinder[] = []

  const arende = await hamtaArende(caseId, kalla)
  if (!arende) {
    return [{ id: 'arende-saknas', text: 'Ärendet hittades inte.', steg: 'klart' }]
  }

  // 1. Sluttid före start.
  // Källa: EditCaseModal.tsx:1065-1068, EditContractCaseModal.tsx:1202-1205,
  // RonderingCaseModal.tsx:612-615 (sluttidForeStart i utils/besokstid.ts)
  if (sluttidForeStart(arende.start, arende.slut)) {
    // Pekar på Framme, där tiden står i Rondering och Egenkontroll. Avtals- och
    // privatmodalen visar tiden i Alla uppgifter och styr dit på hindrets id.
    hinder.push({ id: 'sluttid-fore-start', text: SLUTTID_FORE_START_FEL, steg: 'framme' })
  }

  // 1b. Rapporten ska vara skriven (inte kontroller, etableringar och egenkontroller).
  // Ärendets egen tjänstetyp går före den som skickas in.
  if (kraverRapport(kalla, arende.serviceType ?? serviceType) && !arende.rapport?.trim()) {
    hinder.push({ id: 'rapport-saknas', text: RAPPORT_SAKNAS_FEL, steg: 'rapport' })
  }

  // 2. Stationskontroll: alla stationer kontrollerade (bara avtalsärenden med session)
  if (kalla === 'cases' && (serviceType == null || serviceType === 'inspection')) {
    hinder.push(...await kontrolleraStationer(caseId))
  }

  // 3. ROT/RUT utan fastighetsbeteckning (bara privatärenden).
  // Källa: EditCaseModal.tsx:1070-1092 (CaseBillingService.getRotRutItemsMissingFastighet)
  if (kalla === 'private_cases') {
    const saknar = await CaseBillingService.getRotRutItemsMissingFastighet(caseId, 'private')
    if (saknar.length > 0) {
      hinder.push({
        id: 'rotrut-fastighet',
        text: `Fastighetsbeteckning krävs för ROT/RUT på: ${saknar.join(', ')}.`,
        steg: 'pris'
      })
    }
  }

  // 4. Rabatt utan motivering (avtalstillägg räknas inte som rabatt, exkluderas i servicen).
  // Källa: EditCaseModal.tsx:1094-1107, EditContractCaseModal.tsx:1207-1219,
  // RonderingCaseModal.tsx:616-629
  const omotiverade = await CaseBillingService.getUnmotivatedDiscountItems(caseId)
  if (omotiverade.length > 0) {
    const namn = omotiverade.map(i => `${i.name} (-${i.discount_percent}%)`).join(', ')
    hinder.push({
      id: 'rabatt-motivering',
      text: `Motivera rabatten på ${namn} under Tjänster & fakturarader.`,
      steg: 'pris'
    })
  }

  // 5. Artikel med kundpris utan koppling till tjänst (faktureras annars aldrig).
  // Källa: EditCaseModal.tsx:1108-1117, EditContractCaseModal.tsx:1220-1229,
  // RonderingCaseModal.tsx:630-639
  const omappade = await CaseBillingService.getUnmappedCustomerPricedArticles(caseId)
  if (omappade.length > 0) {
    hinder.push({
      id: 'kundpris-utan-tjanst',
      text: `${omappade.map(u => `${u.quantity} st ${u.name}`).join(', ')} har kundpris men ingen tjänst att faktureras på. Mappa dem mot en tjänst i prisguiden.`,
      steg: 'pris'
    })
  }

  return hinder
}
