// src/services/caseDuplicationService.ts
// Duplicera ärenden (privat / företag / avtal) med valbara delar.

import { supabase } from '../lib/supabase'
import { CaseNumberService } from './caseNumberService'

export type DuplicateCaseType = 'private' | 'business' | 'contract'

export interface DuplicateCaseOptions {
  /** Title, description, priority, notes */
  caseInfo: boolean
  /** rapport / work_report / recommendations / avvikelser_tillbud_olyckor */
  sanitationReport: boolean
  /** time_spent_minutes + work_started_at */
  loggedTime: boolean
  /** case_preparations-rader */
  preparations: boolean
  /** case_billing_items där item_type='service' */
  billingItems: boolean
  /** case_billing_items där item_type='article' */
  internalCosts: boolean
  /** case_images-rader (samma file_path, ingen storage-duplicering) */
  images: boolean
}

export interface DuplicateCaseInput {
  sourceCaseId: string
  caseType: DuplicateCaseType
  startDate: string | null
  dueDate: string | null
  options: DuplicateCaseOptions
  createdByTechnicianId?: string | null
  createdByTechnicianName?: string | null
}

export interface DuplicateCaseResult {
  id: string
  case_type: DuplicateCaseType
  case_number: string | null
}

/**
 * Hämtar ett ärende från rätt tabell baserat på case_type.
 */
async function fetchSourceCase(caseId: string, caseType: DuplicateCaseType) {
  const table = caseType === 'private' ? 'private_cases'
    : caseType === 'business' ? 'business_cases'
    : 'cases'
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', caseId)
    .single()
  if (error) throw new Error(`Kunde inte hämta ursprungsärende: ${error.message}`)
  return data
}

/**
 * Bygger INSERT-payload för privat-/företagsärende baserat på källan + valda options.
 */
function buildLegacyCasePayload(
  source: any,
  caseType: 'private' | 'business',
  input: DuplicateCaseInput
): any {
  const o = input.options
  const payload: any = {
    // Alltid kopierat
    title: source.title,
    kontaktperson: source.kontaktperson,
    telefon_kontaktperson: source.telefon_kontaktperson,
    e_post_kontaktperson: source.e_post_kontaktperson,
    adress: source.adress,
    skadedjur: source.skadedjur,
    annat_skadedjur: source.annat_skadedjur,
    service_id: source.service_id,
    primary_assignee_id: source.primary_assignee_id,
    primary_assignee_name: source.primary_assignee_name,
    primary_assignee_email: source.primary_assignee_email,
    secondary_assignee_id: source.secondary_assignee_id,
    secondary_assignee_name: source.secondary_assignee_name,
    secondary_assignee_email: source.secondary_assignee_email,
    tertiary_assignee_id: source.tertiary_assignee_id,
    tertiary_assignee_name: source.tertiary_assignee_name,
    tertiary_assignee_email: source.tertiary_assignee_email,
    start_date: input.startDate,
    due_date: input.dueDate,
    parent_case_id: input.sourceCaseId,
    created_by_technician_id: input.createdByTechnicianId ?? null,
    created_by_technician_name: input.createdByTechnicianName ?? null,
    // Status nollställs alltid
    status: 'Bokad',
    completed_date: null,
    billing_status: null,
    commission_amount: null,
    commission_calculated_at: null,
    pris: null,
    material_cost: null,
  }

  if (caseType === 'private') {
    payload.personnummer = source.personnummer
  } else {
    payload.org_nr = source.org_nr
    payload.company_name = source.company_name
  }

  // Ärendeinformation (valbart)
  if (o.caseInfo) {
    payload.description = source.description
    payload.priority = source.priority
  } else {
    payload.description = null
    payload.priority = source.priority // priority är inte "ärendeinformation" i klassisk mening, behåll
  }

  // Saneringsrapport (valbart)
  if (o.sanitationReport) {
    payload.rapport = source.rapport
    payload.status_saneringsrapport = source.status_saneringsrapport
    payload.avvikelser_tillbud_olyckor = source.avvikelser_tillbud_olyckor
  } else {
    payload.rapport = null
    payload.status_saneringsrapport = null
    payload.avvikelser_tillbud_olyckor = null
  }

  // Loggad tid (valbart)
  if (o.loggedTime) {
    payload.time_spent_minutes = source.time_spent_minutes
    payload.work_started_at = source.work_started_at
  } else {
    payload.time_spent_minutes = 0
    payload.work_started_at = null
  }

  return payload
}

/**
 * Bygger INSERT-payload för avtalsärende (cases-tabellen).
 */
function buildContractCasePayload(
  source: any,
  newCaseNumber: string,
  input: DuplicateCaseInput
): any {
  const o = input.options
  const payload: any = {
    case_number: newCaseNumber,
    customer_id: source.customer_id,
    title: source.title,
    contact_person: source.contact_person,
    contact_email: source.contact_email,
    contact_phone: source.contact_phone,
    alternative_contact_person: source.alternative_contact_person,
    alternative_contact_email: source.alternative_contact_email,
    alternative_contact_phone: source.alternative_contact_phone,
    address: source.address,
    pest_type: source.pest_type,
    other_pest_type: source.other_pest_type,
    service_id: source.service_id,
    service_type: source.service_type,
    primary_technician_id: source.primary_technician_id,
    primary_technician_name: source.primary_technician_name,
    primary_technician_email: source.primary_technician_email,
    secondary_technician_id: source.secondary_technician_id,
    secondary_technician_name: source.secondary_technician_name,
    secondary_technician_email: source.secondary_technician_email,
    tertiary_technician_id: source.tertiary_technician_id,
    tertiary_technician_name: source.tertiary_technician_name,
    tertiary_technician_email: source.tertiary_technician_email,
    scheduled_start: input.startDate,
    scheduled_end: input.dueDate,
    parent_case_id: input.sourceCaseId,
    created_by_technician_id: input.createdByTechnicianId ?? null,
    created_by_technician_name: input.createdByTechnicianName ?? null,
    // Status nollställs alltid
    status: 'Bokad',
    completed_date: null,
    billing_status: null,
    commission_amount: null,
    commission_calculated_at: null,
    price: null,
    material_cost: null,
  }

  // Ärendeinformation
  if (o.caseInfo) {
    payload.description = source.description
    payload.notes = source.notes
    payload.priority = source.priority
  } else {
    payload.description = null
    payload.notes = null
    payload.priority = source.priority
  }

  // Saneringsrapport
  if (o.sanitationReport) {
    payload.work_report = source.work_report
    payload.recommendations = source.recommendations
    payload.incidents_report = source.incidents_report
    payload.materials_used = source.materials_used
  } else {
    payload.work_report = null
    payload.recommendations = null
    payload.incidents_report = null
    payload.materials_used = null
  }

  // Loggad tid
  if (o.loggedTime) {
    payload.time_spent_minutes = source.time_spent_minutes
    payload.work_started_at = source.work_started_at
  } else {
    payload.time_spent_minutes = 0
    payload.work_started_at = null
  }

  return payload
}

/**
 * Kopiera case_billing_items med möjlighet till filter på item_type.
 * Returnerar mapping gammalt id → nytt id för efterföljande mapped_service_id-översättning.
 */
async function copyBillingItems(
  sourceCaseId: string,
  newCaseId: string,
  caseType: DuplicateCaseType,
  itemTypeFilter: 'service' | 'article' | 'all'
): Promise<Record<string, string>> {
  let query = supabase
    .from('case_billing_items')
    .select('*')
    .eq('case_id', sourceCaseId)
  if (itemTypeFilter !== 'all') query = query.eq('item_type', itemTypeFilter)
  const { data: items, error } = await query
  if (error) throw new Error(`Kunde inte hämta billing items: ${error.message}`)
  if (!items || items.length === 0) return {}

  const idMap: Record<string, string> = {}
  // Insert utan id, läs returnerade id:n
  const inserts = items.map(it => {
    const { id, created_at, updated_at, mapped_service_id, ...rest } = it
    return {
      ...rest,
      case_id: newCaseId,
      case_type: caseType,
      // mapped_service_id sätts i pass 2
      mapped_service_id: null,
      status: 'pending',
    }
  })
  const { data: inserted, error: insertError } = await supabase
    .from('case_billing_items')
    .insert(inserts)
    .select('id')
  if (insertError) throw new Error(`Kunde inte kopiera billing items: ${insertError.message}`)
  if (!inserted) return {}
  items.forEach((src, idx) => {
    if (inserted[idx]) idMap[src.id] = inserted[idx].id
  })
  return idMap
}

/**
 * Två-pass-kopiering av case_billing_items: först tjänster, sen artiklar med översatt mapped_service_id.
 */
async function copyBillingItemsBoth(
  sourceCaseId: string,
  newCaseId: string,
  caseType: DuplicateCaseType,
  copyServices: boolean,
  copyArticles: boolean
) {
  // Pass 1: tjänster
  const serviceIdMap = copyServices
    ? await copyBillingItems(sourceCaseId, newCaseId, caseType, 'service')
    : {}

  // Pass 2: artiklar — först hämta originalen för att läsa deras mapped_service_id
  if (!copyArticles) return

  const { data: articles, error } = await supabase
    .from('case_billing_items')
    .select('*')
    .eq('case_id', sourceCaseId)
    .eq('item_type', 'article')
  if (error) throw new Error(`Kunde inte hämta artiklar: ${error.message}`)
  if (!articles || articles.length === 0) return

  const inserts = articles.map(a => {
    const { id, created_at, updated_at, mapped_service_id, ...rest } = a
    const newMapped = mapped_service_id && serviceIdMap[mapped_service_id]
      ? serviceIdMap[mapped_service_id]
      : null
    return {
      ...rest,
      case_id: newCaseId,
      case_type: caseType,
      mapped_service_id: newMapped,
      status: 'pending',
    }
  })
  const { error: insertError } = await supabase
    .from('case_billing_items')
    .insert(inserts)
  if (insertError) throw new Error(`Kunde inte kopiera artiklar: ${insertError.message}`)
}

async function copyPreparations(
  sourceCaseId: string,
  newCaseId: string,
  caseType: DuplicateCaseType
) {
  const { data, error } = await supabase
    .from('case_preparations')
    .select('*')
    .eq('case_id', sourceCaseId)
  if (error) throw new Error(`Kunde inte hämta preparat: ${error.message}`)
  if (!data || data.length === 0) return
  const inserts = data.map(p => {
    const { id, created_at, updated_at, ...rest } = p
    return { ...rest, case_id: newCaseId, case_type: caseType }
  })
  const { error: insertError } = await supabase
    .from('case_preparations')
    .insert(inserts)
  if (insertError) throw new Error(`Kunde inte kopiera preparat: ${insertError.message}`)
}

async function copyImages(
  sourceCaseId: string,
  newCaseId: string,
  caseType: DuplicateCaseType
) {
  const { data, error } = await supabase
    .from('case_images')
    .select('*')
    .eq('case_id', sourceCaseId)
  if (error) throw new Error(`Kunde inte hämta bilder: ${error.message}`)
  if (!data || data.length === 0) return
  // case_images.case_id är text — använd nya id som sträng
  const inserts = data.map(img => {
    const { id, uploaded_at, ...rest } = img
    return { ...rest, case_id: newCaseId, case_type: caseType }
  })
  const { error: insertError } = await supabase
    .from('case_images')
    .insert(inserts)
  if (insertError) throw new Error(`Kunde inte kopiera bilder: ${insertError.message}`)
}

export class CaseDuplicationService {
  static async duplicateCase(input: DuplicateCaseInput): Promise<DuplicateCaseResult> {
    const source = await fetchSourceCase(input.sourceCaseId, input.caseType)

    let newCaseId: string
    let newCaseNumber: string | null = null

    if (input.caseType === 'contract') {
      newCaseNumber = await CaseNumberService.generateUniqueCaseNumber()
      const payload = buildContractCasePayload(source, newCaseNumber, input)
      const { data, error } = await supabase
        .from('cases')
        .insert(payload)
        .select('id, case_number')
        .single()
      if (error) throw new Error(`Kunde inte skapa kopia: ${error.message}`)
      newCaseId = data.id
      newCaseNumber = data.case_number
    } else {
      const table = input.caseType === 'private' ? 'private_cases' : 'business_cases'
      const payload = buildLegacyCasePayload(source, input.caseType, input)
      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select('id, case_number')
        .single()
      if (error) throw new Error(`Kunde inte skapa kopia: ${error.message}`)
      newCaseId = data.id
      newCaseNumber = data.case_number
    }

    const o = input.options

    // 1:N-kopior
    if (o.preparations) {
      await copyPreparations(input.sourceCaseId, newCaseId, input.caseType)
    }
    if (o.billingItems || o.internalCosts) {
      await copyBillingItemsBoth(
        input.sourceCaseId,
        newCaseId,
        input.caseType,
        o.billingItems,
        o.internalCosts
      )
    }
    if (o.images) {
      await copyImages(input.sourceCaseId, newCaseId, input.caseType)
    }

    return { id: newCaseId, case_type: input.caseType, case_number: newCaseNumber }
  }
}
