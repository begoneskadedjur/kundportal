// src/components/technician/ny/rapporter/rapportHandlingar.ts
// Gemensamt gränssnitt för rapportens val i nya arbetsvyn (Klart-steget och
// Mina rapporter). Värdarna skickar in sina befintliga rapportfunktioner:
//  - privat/företag: useWorkReportGeneration (saneringsrapport)
//  - avtal och rondering: useModernWorkReportGeneration (ärenderapport)
//  - stationskontroll: useKontrollRapport (kontrollrapport, PDF och Excel)
// Felen visar funktionerna själva som toast, här fångas bara undantagen.

import { useAuth } from '../../../../contexts/AuthContext'
import type { SanitationReport } from '../../../../services/sanitationReportService'
import type { RapportMottagare } from '../../../../hooks/useWorkReportGeneration'
import { RAPPORT_NAMN, type RapportSort } from './rapportLogik'

export interface RapportHandlingar {
  sort: RapportSort
  /** "Saneringsrapport" */
  rapportNamn: string
  arendenummer: string | null
  /** Kundens adress som rapporten skickas till */
  kundEpost: string | null
  kundNamn?: string | null
  /** Inloggade teknikerns adress (technicians.email via profilen) */
  minEpost: string | null
  upptagen: boolean
  kanSkapas: boolean
  /** Förklaring när rapporten inte kan tas fram */
  kanInteText?: string
  /** Text om ett tidigare utskick till kunden, visas i bekräftelsen */
  tidigareTillKund?: string | null
  laddaNed: () => Promise<void>
  laddaNedExcel?: () => Promise<void>
  /** Skickar till adressen (redan bekräftad av teknikern). true = skickat. */
  skickaTillKund: (epost: string) => Promise<boolean>
  skickaTillMig: () => Promise<boolean>
}

/** Den inloggade teknikerns e-post och namn ur profilen */
export function useMinEpost(): { epost: string | null; namn: string | null } {
  const { profile } = useAuth()
  const tek = profile?.technicians
  return { epost: tek?.email?.trim() || null, namn: tek?.name || null }
}

/** Det som Klart-steget och Mina rapporter behöver ur de två rapporthookarna */
export interface ArbetsrapportHook {
  downloadReport: (skipWarning?: boolean) => Promise<void>
  sendToTechnician: (skipWarning?: boolean, mottagare?: RapportMottagare) => Promise<void>
  sendToContact: (skipWarning?: boolean, mottagare?: RapportMottagare) => Promise<void>
  isGenerating: boolean
  canGenerateReport: boolean | string
  currentReport: SanitationReport | null
  getTimeSinceReport: (r: SanitationReport) => string
}

async function utan(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn()
    return true
  } catch {
    // Hooken har redan visat felet
    return false
  }
}

/** Bygger rapportens val av en rapporthook (saneringsrapport eller ärenderapport) */
export function franArbetsrapport(
  hook: ArbetsrapportHook,
  opt: {
    sort: 'sanering' | 'arende'
    arendenummer: string | null
    kundEpost: string | null | undefined
    kundNamn?: string | null
    minEpost: string | null
    minNamn?: string | null
  },
): RapportHandlingar {
  const senaste = hook.currentReport
  const tidigare = senaste?.sent_to_customer && senaste.sent_to_customer_at
    ? `Rapporten skickades till kunden ${hook.getTimeSinceReport({ ...senaste, created_at: senaste.sent_to_customer_at }).toLowerCase()}.`
    : senaste?.sent_to_customer ? 'Rapporten har skickats till kunden förut.' : null
  return {
    sort: opt.sort,
    rapportNamn: RAPPORT_NAMN[opt.sort],
    arendenummer: opt.arendenummer,
    kundEpost: opt.kundEpost?.trim() || null,
    kundNamn: opt.kundNamn ?? null,
    minEpost: opt.minEpost,
    upptagen: hook.isGenerating,
    kanSkapas: !!hook.canGenerateReport,
    kanInteText: hook.canGenerateReport ? undefined : 'Rapporten kan tas fram när ärendet har ett namn.',
    tidigareTillKund: tidigare,
    laddaNed: async () => { await utan(() => hook.downloadReport()) },
    // Teknikern har bekräftat i arket, så hookens egen fråga om nytt utskick hoppas över
    skickaTillKund: epost => utan(() => hook.sendToContact(true, { email: epost, namn: opt.kundNamn ?? null })),
    skickaTillMig: () => opt.minEpost
      ? utan(() => hook.sendToTechnician(true, { email: opt.minEpost as string, namn: opt.minNamn ?? null }))
      : Promise.resolve(false),
  }
}
