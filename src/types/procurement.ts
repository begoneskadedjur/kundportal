// src/types/procurement.ts
// Radtyper för upphandlingsportalens tabeller (supabase/migrations/20260924_upphandlingsportal.sql).
// Används av database.ts och direkt av services, cron-jobb och vyer.
// Ren typfil utan import.meta: ingår även i API-projektet via database.ts.

export type ProcurementNoticeKind = 'tender' | 'direct' | 'rfi' | 'prior_information' | 'award' | 'modification' | 'other'

export type ProcurementOurStatus =
  | 'new' | 'watching' | 'analyzing' | 'bidding' | 'submitted' | 'won' | 'lost' | 'declined' | 'cancelled' | 'archived'

export type ProcurementCriteriaType = 'price' | 'quality' | 'mixed' | 'cost'

export type ProcurementSource = 'mercell' | 'ted' | 'kommers' | 'uhm' | 'email' | 'manual'

export type ProcurementAwardSource = 'mercell' | 'ted' | 'ted_xml' | 'uhm' | 'email' | 'manual'

export type ProcurementValueKind = 'ceiling' | 'actual' | 'estimated' | 'unknown'

export type ProcurementEndSource = 'ted_end_plus_renewals' | 'ted_end' | 'mercell_expiry' | 'assumption_2_2' | 'manual'

export type ProcurementAwardStatus = 'open' | 'contacted' | 'planned' | 'done' | 'ignored'

export type ProcurementDocType =
  | 'tender_documents' | 'appendix' | 'award_decision' | 'opening_protocol' | 'evaluation_report'
  | 'price_appendix' | 'rejection' | 'bid' | 'other' | 'unknown'

export type ProcurementRequestStatus =
  | 'draft' | 'sent' | 'reminded' | 'escalated' | 'partial' | 'received' | 'rejected' | 'closed'

export type ProcurementRequirementType = 'skall' | 'bor' | 'bevis' | 'kvalitet'

export type ProcurementSignalType = 'plan' | 'upcoming' | 'rfi' | 'prior_information' | 'contract_expiry' | 'other'

export type ProcurementReliability = 'low' | 'medium' | 'high'

export type ProcurementRuleType = 'cpv_hard' | 'cpv_soft' | 'keyword' | 'negative' | 'county'

/** En rad i matchningens förklaring, sparas i procurement_notices.match_reasons */
export interface ProcurementMatchReason {
  rule: ProcurementRuleType
  label: string
  points: number
}

/** Volymer ur förfrågningsunderlaget, manuellt eller från AI-extraktionen */
export interface ProcurementVolumes {
  objects?: number | null           // antal objekt/fastigheter
  apartments?: number | null        // antal lägenheter
  visits_per_year?: number | null   // planerade besök per år totalt
  stations?: number | null
  callouts_per_year?: number | null // akuta utryckningar per år
  notes?: string | null
}

export interface ProcurementBuyer {
  id: string
  org_number: string | null
  name: string
  normalized_name: string
  aliases: string[]
  sector: string | null
  county_code: string | null
  county_name: string | null
  nuts_codes: string[]
  customer_id: string | null
  registrar_email: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementSupplier {
  id: string
  org_number: string | null
  name: string
  normalized_name: string
  aliases: string[]
  is_begone: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementNotice {
  id: string
  bgu_number: number
  title: string
  normalized_title: string
  description: string | null
  buyer_id: string | null
  buyer_name: string | null
  buyer_org_number: string | null
  cpv_codes: string[]
  nuts_codes: string[]
  county_codes: string[]
  county_names: string[]
  published_at: string | null
  questions_deadline: string | null
  tender_deadline: string | null
  opening_at: string | null
  award_decision_at: string | null
  estimated_value: number | null
  value_currency: string | null
  procedure_type: string | null
  is_framework: boolean | null
  contract_start: string | null
  contract_end: string | null
  renewal_max: number | null
  duration_months: number | null
  criteria_type: ProcurementCriteriaType | null
  criteria_weights: Array<{ name: string; weight: number | null; type?: string | null }> | null
  price_model: string | null
  volumes: ProcurementVolumes | null
  notice_kind: ProcurementNoticeKind
  source_status: string | null
  platform_url: string | null
  document_url: string | null
  our_status: ProcurementOurStatus
  owner_id: string | null
  match_score: number
  match_reasons: ProcurementMatchReason[]
  expected_bids: number | null
  win_probability: number | null
  annual_value: number | null
  expected_contribution: number | null
  ai_summary: string | null
  ai_deciders: string[] | null
  requirements_summary: Record<string, unknown> | null
  notes: string | null
  dedup_key: string | null
  first_seen_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface ProcurementNoticeSource {
  id: string
  notice_id: string
  source: ProcurementSource
  source_id: string
  source_sub: string | null
  external_ref: string | null
  url: string | null
  raw: Record<string, unknown> | null
  fetched_at: string
}

export interface ProcurementAward {
  id: string
  award_key: string
  notice_id: string | null
  buyer_id: string | null
  buyer_name: string | null
  title: string | null
  cpv_codes: string[]
  county_code: string | null
  source: ProcurementAwardSource
  source_ref: string | null
  supplier_id: string | null
  winner_org_number: string | null
  winner_name: string | null
  value: number | null
  value_kind: ProcurementValueKind
  bids_received: number | null
  lowest_bid: number | null
  highest_bid: number | null
  criteria_type: string | null
  procedure_type: string | null
  is_framework: boolean | null
  award_date: string | null
  contract_signed_date: string | null
  contract_start: string | null
  contract_end: string | null
  renewal_max: number | null
  calc_end_date: string | null
  calc_end_source: ProcurementEndSource | null
  corrected_end_date: string | null
  corrected_by: string | null
  corrected_at: string | null
  window_start: string | null
  window_end: string | null
  was_appealed: boolean | null
  status: ProcurementAwardStatus
  owner_id: string | null
  notes: string | null
  raw: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ProcurementBidder {
  id: string
  bidder_key: string
  notice_id: string | null
  award_id: string | null
  source_ref: string | null
  supplier_id: string | null
  org_number: string | null
  name: string
  price: number | null
  score: number | null
  rank: number | null
  is_winner: boolean
  is_begone: boolean
  source: 'ted' | 'ted_xml' | 'uhm' | 'email' | 'document' | 'manual'
  document_id: string | null
  verified: boolean
  verified_by: string | null
  verified_at: string | null
  raw: Record<string, unknown> | null
  created_at: string
}

export interface ProcurementBid {
  id: string
  notice_id: string
  label: string | null
  calc: Record<string, unknown>
  volumes: Record<string, unknown>
  contract_years: number | null
  annual_cost: number | null
  floor_price: number | null
  target_price: number | null
  submitted_price: number | null
  win_probability: number | null
  expected_contribution: number | null
  is_current: boolean
  outcome: 'pending' | 'won' | 'lost' | 'cancelled' | 'withdrawn'
  lesson: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementDocumentRequest {
  id: string
  notice_id: string | null
  award_id: string | null
  buyer_id: string | null
  doc_types: string[]
  recipient_email: string
  reply_to: string | null
  subject: string | null
  body: string | null
  status: ProcurementRequestStatus
  sent_at: string | null
  reminded_at: string | null
  escalated_at: string | null
  received_at: string | null
  resend_message_id: string | null
  created_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementInboundEmail {
  id: string
  message_id: string | null
  from_email: string | null
  from_domain: string | null
  to_emails: string[]
  subject: string | null
  text_body: string | null
  received_at: string
  notice_id: string | null
  request_id: string | null
  match_method: 'reply_to' | 'subject_tag' | 'sender_domain' | 'manual' | null
  status: 'matched' | 'unsorted' | 'ignored'
  ai_classification: Record<string, unknown> | null
  raw: Record<string, unknown> | null
  created_at: string
}

/** Strukturerad AI-extraktion av ett förfrågningsunderlag (procurement_documents.ai_extraction) */
export interface ProcurementExtraction {
  volumes?: ProcurementVolumes & { source_page?: string | null }
  criteria?: Array<{ name: string; weight: number | null; type: 'price' | 'quality' | 'other'; page?: string | null }>
  price_model?: { kind: string | null; description: string | null; page?: string | null } | null
  questions_deadline?: string | null
  tender_deadline?: string | null
  contract?: { duration_months: number | null; options: string | null; start: string | null; page?: string | null } | null
  requirements?: Array<{ text: string; type: ProcurementRequirementType; page?: string | null; weight?: number | null }>
  penalties?: Array<{ text: string; page?: string | null }>
  references?: { count: number | null; text: string | null; page?: string | null } | null
  response_time?: string | null
  certifications?: string[]
  summary?: string | null
  deciders?: string[]
  suggested_questions?: Array<{ question: string; reason: string | null }>
  /** Klassning av inkomna handlingar */
  doc_type?: ProcurementDocType
  bidders?: Array<{ name: string; org_number: string | null; price: number | null; score: number | null; rank: number | null; is_winner: boolean | null }>
}

export interface ProcurementDocument {
  id: string
  notice_id: string | null
  request_id: string | null
  inbound_email_id: string | null
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  doc_type: ProcurementDocType
  origin: 'upload' | 'email'
  uploaded_by: string | null
  ai_status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  ai_extraction: ProcurementExtraction | null
  ai_summary: string | null
  ai_error: string | null
  verified: boolean
  verified_by: string | null
  verified_at: string | null
  created_at: string
}

export interface ProcurementRequirement {
  id: string
  notice_id: string
  text: string
  req_type: ProcurementRequirementType
  weight: number | null
  page: string | null
  owner_id: string | null
  done: boolean
  attachment_document_id: string | null
  attachment_note: string | null
  source: 'ai' | 'manual'
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementQuestion {
  id: string
  notice_id: string
  question: string
  reason: string | null
  source: 'ai' | 'manual'
  status: 'draft' | 'sent' | 'answered' | 'dropped'
  answer: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementPriceLine {
  id: string
  notice_id: string
  label: string
  unit: string | null
  quantity: number
  unit_price: number | null
  unit_cost: number | null
  price_list_item_id: string | null
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementSignalSource {
  id: string
  name: string
  url: string
  buyer_id: string | null
  kind: 'kommun' | 'region' | 'bostadsbolag' | 'stat' | 'other'
  county_code: string | null
  content_hash: string | null
  last_text: string | null
  last_fetched_at: string | null
  last_changed_at: string | null
  last_status: number | null
  last_error: string | null
  active: boolean
  verified: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementSignal {
  id: string
  signal_key: string
  signal_type: ProcurementSignalType
  buyer_id: string | null
  buyer_name: string | null
  text: string
  expected_quarter: string | null
  reliability: ProcurementReliability
  source: string
  url: string | null
  signal_source_id: string | null
  award_id: string | null
  notice_id: string | null
  status: 'new' | 'watching' | 'converted' | 'dismissed'
  raw: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ProcurementWatchRule {
  id: string
  name: string
  rule_type: ProcurementRuleType
  cpv_prefixes: string[]
  keywords: string[]
  county_codes: string[]
  points: number
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementEvent {
  id: string
  notice_id: string | null
  award_id: string | null
  event_type: string
  title: string
  detail: string | null
  metadata: Record<string, unknown>
  actor_id: string | null
  actor_name: string | null
  created_at: string
}

export interface ProcurementReadState {
  user_id: string
  notice_id: string
  seen_at: string
}

export interface ProcurementSourceHealth {
  source: string
  last_run_at: string | null
  last_success_at: string | null
  last_count: number | null
  consecutive_failures: number
  last_error: string | null
  cursor: string | null
  updated_at: string
}

export interface ProcurementUserSettings {
  user_id: string
  digest_enabled: boolean
  updated_at: string
}

// ---------------------------------------------------------------------------
// Etiketter för UI

export const OUR_STATUS_LABEL: Record<ProcurementOurStatus, string> = {
  new: 'Ny',
  watching: 'Bevakas',
  analyzing: 'Analyseras',
  bidding: 'Anbud pågår',
  submitted: 'Anbud lämnat',
  won: 'Vunnen',
  lost: 'Förlorad',
  declined: 'Avstår',
  cancelled: 'Avbruten',
  archived: 'Arkiverad',
}

/** Tailwind-färg på statuspunkten (bg-klass) */
export const OUR_STATUS_DOT: Record<ProcurementOurStatus, string> = {
  new: 'bg-sky-400',
  watching: 'bg-slate-400',
  analyzing: 'bg-amber-400',
  bidding: 'bg-[#20c58f]',
  submitted: 'bg-[#20c58f]',
  won: 'bg-emerald-400',
  lost: 'bg-red-400',
  declined: 'bg-slate-600',
  cancelled: 'bg-slate-600',
  archived: 'bg-slate-700',
}

export const NOTICE_KIND_LABEL: Record<ProcurementNoticeKind, string> = {
  tender: 'Annons',
  direct: 'Direktupphandling',
  rfi: 'RFI',
  prior_information: 'Förhandsannons',
  award: 'Tilldelning',
  modification: 'Ändring',
  other: 'Övrigt',
}

export const CRITERIA_TYPE_LABEL: Record<ProcurementCriteriaType, string> = {
  price: 'Pris',
  quality: 'Kvalitet',
  mixed: 'Pris och kvalitet',
  cost: 'Kostnad',
}

export const DOC_TYPE_LABEL: Record<ProcurementDocType, string> = {
  tender_documents: 'Förfrågningsunderlag',
  appendix: 'Bilaga',
  award_decision: 'Tilldelningsbeslut',
  opening_protocol: 'Anbudsöppningsprotokoll',
  evaluation_report: 'Utvärderingsrapport',
  price_appendix: 'Prisbilaga',
  rejection: 'Avslag',
  bid: 'Eget anbud',
  other: 'Övrigt',
  unknown: 'Ej klassad',
}

export const REQUEST_STATUS_LABEL: Record<ProcurementRequestStatus, string> = {
  draft: 'Utkast',
  sent: 'Skickad',
  reminded: 'Påmind',
  escalated: 'Eskalerad',
  partial: 'Delvis mottagen',
  received: 'Mottagen',
  rejected: 'Avslagen',
  closed: 'Stängd',
}

export const REQUIREMENT_TYPE_LABEL: Record<ProcurementRequirementType, string> = {
  skall: 'Skallkrav',
  bor: 'Börkrav',
  bevis: 'Bevis',
  kvalitet: 'Kvalitet',
}

export const SIGNAL_TYPE_LABEL: Record<ProcurementSignalType, string> = {
  plan: 'Upphandlingsplan',
  upcoming: 'Planerad upphandling',
  rfi: 'RFI',
  prior_information: 'Förhandsannons',
  contract_expiry: 'Avtal löper ut',
  other: 'Övrigt',
}

export const RELIABILITY_LABEL: Record<ProcurementReliability, string> = {
  low: 'Låg',
  medium: 'Medel',
  high: 'Hög',
}

export const END_SOURCE_LABEL: Record<ProcurementEndSource, string> = {
  ted_end_plus_renewals: 'TED slutdatum plus förlängningar',
  ted_end: 'TED slutdatum',
  mercell_expiry: 'Mercell avtalsslut',
  assumption_2_2: 'Antagande två plus två år',
  manual: 'Rättat manuellt',
}

export const DOCUMENT_REQUEST_TYPES: Array<{ key: string; label: string }> = [
  { key: 'award_decision', label: 'Tilldelningsbeslut' },
  { key: 'opening_protocol', label: 'Anbudsöppningsprotokoll' },
  { key: 'evaluation_report', label: 'Utvärderingsrapport' },
  { key: 'price_appendix', label: 'Vinnande anbudsgivares prisbilaga' },
]
