// src/types/specialReport.ts
// Specialrapporter: en fri rapport kopplad till ett ärende, uppbyggd av
// sektioner (med etikett) som innehåller block (text, händelser, bilder,
// kartutsnitt). Ett ritat område på översiktskartan hör till en sektion.

export type SpecialReportCaseType = 'contract' | 'private' | 'business'

export type SpecialReportSectionLabel = 'omrade' | 'besok' | 'underlev' | 'fritt'

export type SpecialReportBlockType = 'text' | 'events' | 'images' | 'map'

export type SpecialReportEventType =
  | 'inspektion'
  | 'besok'
  | 'betning'
  | 'atgard'
  | 'underlev'
  | 'notering'

export type SpecialReportDocType = 'Saneringsrapport' | 'Inspektionsrapport' | 'Åtgärdsrapport'

/** En punkt i ett kartområde (WGS84) */
export interface LatLng {
  lat: number
  lng: number
}

/** Kartans utsnitt på översikten */
export interface SpecialReportMapView {
  lat: number
  lng: number
  zoom: number
}

export interface SpecialReport {
  id: string
  title: string
  doc_type: SpecialReportDocType
  case_id: string
  case_type: SpecialReportCaseType
  /** Ögonblicksbild från ärendet när rapporten skapades */
  case_number: string | null
  customer_id: string | null
  customer_name: string | null
  customer_number: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  intro: string | null
  assessment: string | null
  recommendations: string | null
  /** Översiktskartans utsnitt, null = ingen översiktskarta */
  map_view: SpecialReportMapView | null
  /** Versionen som pågår. Skickade versioner är låsta i special_report_versions */
  current_version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface SpecialReportSection {
  id: string
  report_id: string
  position: number
  title: string
  subtitle: string | null
  label: SpecialReportSectionLabel
  /** Ritat område, yttre ring utan upprepad startpunkt. null = inget område */
  area: LatLng[] | null
  created_at: string
  updated_at: string
}

export interface SpecialReportBlock {
  id: string
  section_id: string
  position: number
  type: SpecialReportBlockType
  /** text: { text } · övriga: {} */
  content: { text?: string }
  created_at: string
}

export interface SpecialReportEvent {
  id: string
  section_id: string
  /** ÅÅÅÅ-MM-DD */
  event_date: string
  type: SpecialReportEventType
  title: string
  description: string | null
  /** Varifrån händelsen hämtades, för att inte importera samma sak två gånger */
  source: 'visit' | 'inspection_session' | null
  source_id: string | null
  created_by: string | null
  created_at: string
}

export interface SpecialReportImage {
  id: string
  report_id: string
  section_id: string
  event_id: string | null
  /** Sökväg i bucketen special-reports: {report_id}/{uuid}.webp */
  storage_path: string
  caption: string | null
  position: number
  created_at: string
  /** Signerad URL, fylls i av tjänsten vid läsning */
  url?: string
}

export interface SpecialReportVersion {
  id: string
  report_id: string
  version: number
  /** Sökväg i bucketen special-reports: {report_id}/versioner/v{n}.pdf */
  pdf_path: string
  page_count: number | null
  sent_at: string | null
  sent_to: string[]
  sent_by: string | null
  subject: string | null
  message: string | null
  created_at: string
}

/** En hel rapport som redigeraren arbetar med */
export interface SpecialReportFull extends SpecialReport {
  sections: (SpecialReportSection & {
    blocks: SpecialReportBlock[]
    events: SpecialReportEvent[]
    images: SpecialReportImage[]
  })[]
  versions: SpecialReportVersion[]
}

/** Rad i listan över rapporter */
export interface SpecialReportListItem {
  id: string
  title: string
  doc_type: SpecialReportDocType
  case_id: string
  case_type: SpecialReportCaseType
  case_number: string | null
  customer_name: string | null
  customer_number: string | null
  section_count: number
  event_count: number
  current_version: number
  last_sent_at: string | null
  last_sent_version: number | null
  updated_at: string
  updated_by_name: string | null
}

/** Ärende som kan kopplas till en ny rapport */
export interface SpecialReportCaseOption {
  case_id: string
  case_type: SpecialReportCaseType
  case_number: string | null
  title: string | null
  customer_id: string | null
  customer_name: string | null
  customer_number: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  service: string | null
}

/** Något i ärendet som kan hämtas in som händelse */
export interface SpecialReportImportCandidate {
  source: 'visit' | 'inspection_session'
  source_id: string
  event_date: string
  type: SpecialReportEventType
  title: string
  description: string | null
  /** Redan inhämtad i den här rapporten */
  already_imported: boolean
}

export type SpecialReportStart = 'tom' | 'karta' | 'per_besok' | 'kopia'

export const SECTION_LABELS: Record<SpecialReportSectionLabel, string> = {
  omrade: 'Område',
  besok: 'Besök',
  underlev: 'Underleverantör',
  fritt: 'Fritt',
}

export const BLOCK_LABELS: Record<SpecialReportBlockType, string> = {
  text: 'Text',
  events: 'Händelser',
  images: 'Bilder',
  map: 'Kartutsnitt',
}

export const EVENT_TYPES: Record<SpecialReportEventType, { label: string; color: string; defaultTitle: string }> = {
  inspektion: { label: 'Inspektion', color: '#60a5fa', defaultTitle: 'Inspektion' },
  besok: { label: 'Besök', color: '#20c58f', defaultTitle: 'Besök' },
  betning: { label: 'Betning', color: '#f59e0b', defaultTitle: 'Betning' },
  atgard: { label: 'Åtgärd', color: '#c084fc', defaultTitle: 'Åtgärd' },
  underlev: { label: 'Underleverantör', color: '#cbd5e1', defaultTitle: 'Arbete av underleverantör' },
  notering: { label: 'Notering', color: '#94a3b8', defaultTitle: 'Notering' },
}
