// src/services/caseDeleteService.ts
// Service för radering av ärenden och all relaterad data

import { supabase } from '../lib/supabase';

export type DeleteableCaseType = 'private' | 'business' | 'contract';

export interface CaseDeleteInfo {
  caseId: string;
  caseType: DeleteableCaseType;
  caseTitle: string;
  customerName?: string;
  relatedData: {
    comments: number;
    images: number;
    notifications: number;
    readReceipts: number;
    visits: number;
    billingLogs: number;
    childCases: number;
    invoices: number;
    billingItems: number;
    commissionPosts: number;
  };
  canDelete: boolean;
  blockReason?: string;
}

export interface EventLogEntry {
  event_type: 'case_deleted' | 'case_created' | 'case_updated' | 'status_changed'
    | 'offer_sent' | 'offer_signed' | 'offer_declined' | 'offer_expired' | 'offer_deleted';
  description: string;
  case_id?: string;
  case_type?: string;
  case_title?: string;
  metadata?: Record<string, any>;
  performed_by_id: string;
  performed_by_name: string;
}

// Hämta tabell-namn baserat på ärendetyp
function getTableName(caseType: DeleteableCaseType): string {
  switch (caseType) {
    case 'private':
      return 'private_cases';
    case 'business':
      return 'business_cases';
    case 'contract':
      return 'cases';
    default:
      // Faila högt istället för att tyst returnera undefined → supabase.from(undefined)
      throw new Error(`getTableName: ogiltig caseType "${caseType}"`);
  }
}

/**
 * Fakturastatusar som betyder att fakturan har lämnat portalen: bokförd och
 * skickad i Fortnox, förfallen eller betald. overdue lagras inte på invoices
 * (härleds i UI) men finns på contract_billing_items. En faktura med
 * fortnox_document_number räknas också som skickad, oavsett status.
 */
export const SKICKADE_FAKTURASTATUSAR = ['booked', 'sent', 'overdue', 'paid'];

export interface SkickadFaktura {
  nummer: string | null;
  status: string;
}

type FakturaRad = { invoice_number: string | null; status: string; fortnox_document_number: string | null };

function forstaSkickade(rader: FakturaRad[] | null): SkickadFaktura | null {
  const rad = (rader || []).find(
    r => !!r.fortnox_document_number || SKICKADE_FAKTURASTATUSAR.includes(r.status)
  );
  return rad ? { nummer: rad.invoice_number || rad.fortnox_document_number || null, status: rad.status } : null;
}

/**
 * Spärren mot att ta bort ärenden med skickad faktura (2026-11-23).
 * Letar på två ställen:
 * 1. invoices.case_id = ärendet. Privat- och företagsfakturor (även delfakturor)
 *    och avtalsärendens merförsäljning per ärende. Merförsäljningen har
 *    case_type null, därför filtreras inte på case_type.
 * 2. Avtalsärenden: merförsäljningens rader i contract_billing_items. Månadens
 *    samlade merförsäljningsfaktura har inget case_id, raderna pekar på den
 *    via invoice_id.
 * Kan kontrollen inte göras kastas ett fel, så att ärendet inte tas bort i blindo.
 */
export async function hittaSkickadFaktura(
  caseId: string,
  caseType: DeleteableCaseType
): Promise<SkickadFaktura | null> {
  const { data: direkta, error } = await supabase
    .from('invoices')
    .select('invoice_number, status, fortnox_document_number')
    .eq('case_id', caseId);
  if (error) throw new Error(`Kunde inte kontrollera ärendets fakturor: ${error.message}`);
  const direkt = forstaSkickade(direkta as FakturaRad[] | null);
  if (direkt || caseType !== 'contract') return direkt;

  const { data: rader, error: raderFel } = await supabase
    .from('contract_billing_items')
    .select('status, invoice_id')
    .eq('case_id', caseId);
  if (raderFel) throw new Error(`Kunde inte kontrollera ärendets fakturarader: ${raderFel.message}`);
  const skickadRad = (rader || []).find(r => SKICKADE_FAKTURASTATUSAR.includes(r.status as string));
  if (skickadRad) return { nummer: null, status: skickadRad.status as string };

  const fakturaIds = [...new Set((rader || []).map(r => r.invoice_id as string | null).filter((id): id is string => !!id))];
  if (fakturaIds.length === 0) return null;
  const { data: samlade, error: samladeFel } = await supabase
    .from('invoices')
    .select('invoice_number, status, fortnox_document_number')
    .in('id', fakturaIds);
  if (samladeFel) throw new Error(`Kunde inte kontrollera ärendets fakturor: ${samladeFel.message}`);
  return forstaSkickade(samlade as FakturaRad[] | null);
}

/** Beskedet när ärendet inte får tas bort för att fakturan är skickad */
export function skickadFakturaText(faktura: SkickadFaktura): string {
  return `Ärendet går inte att ta bort eftersom fakturan${faktura.nummer ? ` ${faktura.nummer}` : ''} redan är skickad till Fortnox.`;
}

/**
 * Kör spärren och returnerar beskedet om ärendet inte får tas bort, annars null.
 * Kunde kontrollen inte göras returneras det felet, så att ingen tar bort i blindo.
 */
export async function taBortSparr(caseId: string, caseType: DeleteableCaseType): Promise<string | null> {
  try {
    const faktura = await hittaSkickadFaktura(caseId, caseType);
    return faktura ? skickadFakturaText(faktura) : null;
  } catch (error) {
    const text = error instanceof Error && error.message ? error.message : 'Kunde inte kontrollera ärendets fakturor';
    return `${text}. Försök igen om en stund.`;
  }
}

/**
 * Kontrollera om ärendet kan raderas och hämta information om relaterad data
 */
export async function getCaseDeleteInfo(
  caseId: string,
  caseType: DeleteableCaseType
): Promise<CaseDeleteInfo> {
  const tableName = getTableName(caseType);

  // Hämta ärendets grundinfo - olika kolumnnamn för contract vs private/business
  const selectFields = caseType === 'contract'
    ? 'id, title, contact_person'
    : 'id, title, kontaktperson';

  const { data: caseData, error: caseError } = await supabase
    .from(tableName)
    .select(selectFields)
    .eq('id', caseId)
    .single();

  if (caseError || !caseData) {
    throw new Error(`Kunde inte hitta ärendet: ${caseError?.message || 'Okänt fel'}`);
  }

  // Normalisera kontaktperson-fältet
  const customerName = caseType === 'contract'
    ? (caseData as any).contact_person
    : (caseData as any).kontaktperson;

  // Kontrollera om det finns underärenden (child cases) - för alla ärendetyper
  let childCasesCount = 0;
  const { count: childCount } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('parent_case_id', caseId);

  childCasesCount = childCount || 0;

  // Räkna kommentarer
  const { count: commentsCount } = await supabase
    .from('case_comments')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('case_type', caseType);

  // Räkna bilder
  const { count: imagesCount } = await supabase
    .from('case_images')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('case_type', caseType);

  // Räkna notifikationer
  const { count: notificationsCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('case_type', caseType);

  // Räkna läsbekräftelser (via comment_ids eftersom tabellen inte har case_id)
  let readReceiptsCount = 0;
  if (commentsCount && commentsCount > 0) {
    // Hämta alla comment_ids för ärendet
    const { data: commentIds } = await supabase
      .from('case_comments')
      .select('id')
      .eq('case_id', caseId)
      .eq('case_type', caseType);

    if (commentIds && commentIds.length > 0) {
      const ids = commentIds.map(c => c.id);
      const { count } = await supabase
        .from('comment_read_receipts')
        .select('id', { count: 'exact', head: true })
        .in('comment_id', ids);
      readReceiptsCount = count || 0;
    }
  }

  // Räkna besök (visits) - endast för contract cases
  let visitsCount = 0;
  if (caseType === 'contract') {
    const { count } = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId);
    visitsCount = count || 0;
  }

  // Räkna billing audit log entries
  const { count: billingLogsCount } = await supabase
    .from('billing_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('case_type', caseType);

  // Räkna fakturor
  const { count: invoicesCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('case_type', caseType);

  // Räkna faktureringsartiklar
  const { count: billingItemsCount } = await supabase
    .from('case_billing_items')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('case_type', caseType);

  // Räkna provisionsposter + kolla om någon är "låst" (på väg till / redan utbetalad)
  const { data: commissionRows } = await supabase
    .from('commission_posts')
    .select('status')
    .eq('case_id', caseId);
  const commissionPostsCount = commissionRows?.length || 0;
  const lockedCommission = (commissionRows || []).find(
    (r: { status: string }) => r.status !== 'pending_invoice'
  );

  // Kolla om någon faktura är exporterad/skickad till Fortnox
  const lockedInvoice = await hittaSkickadFaktura(caseId, caseType);

  // Bestäm om ärendet kan raderas
  let canDelete = childCasesCount === 0;
  let blockReason: string | undefined = childCasesCount > 0
    ? `Ärendet har ${childCasesCount} underärende(n) som måste raderas först.`
    : undefined;

  if (canDelete && lockedInvoice) {
    canDelete = false;
    blockReason = skickadFakturaText(lockedInvoice);
  } else if (canDelete && lockedCommission) {
    canDelete = false;
    blockReason = `Ärendet har provisionsposter som är på väg till utbetalning (status: ${lockedCommission.status}). Återställ provisionen först.`;
  }

  return {
    caseId,
    caseType,
    caseTitle: caseData.title || 'Namnlöst ärende',
    customerName: customerName,
    relatedData: {
      comments: commentsCount || 0,
      images: imagesCount || 0,
      notifications: notificationsCount || 0,
      readReceipts: readReceiptsCount || 0,
      visits: visitsCount,
      billingLogs: billingLogsCount || 0,
      childCases: childCasesCount,
      invoices: invoicesCount || 0,
      billingItems: billingItemsCount || 0,
      commissionPosts: commissionPostsCount,
    },
    canDelete,
    blockReason
  };
}

/**
 * Anledning när en tekniker tar bort ärendet via papperskorgen i Mina ärenden.
 * Sparas i deleted_at/close_reason så att statistiken över stängda ärenden
 * (ClosedCasesFunnel) fortsätter fungera.
 */
export interface CaseCloseReason {
  reason: string;
  notes: string | null;
  technicianId: string | null;
  technicianName: string | null;
}

/**
 * Soft-delete: sätter status = 'Borttaget' och döljer ärendet ur alla vyer.
 * Ärendet och all relaterad data behålls i databasen.
 * Den enda vägen för att ta bort ärenden: Radera i ärendemodalen och
 * teknikerns papperskorg (med closeReason) går båda hit.
 */
/** Anledningar när ett ärende tas bort (samma som Mina ärendens stängning) */
export const ORSAKER_TA_BORT = [
  { value: 'kund_accepterade_inte_pris', label: 'Kund accepterade inte kostnadsförslaget' },
  { value: 'kund_aterkopplade_aldrig', label: 'Kund återkopplade aldrig' },
  { value: 'lost_vid_inspektion', label: 'Löst vid inspektion' },
  { value: 'kund_avbokade', label: 'Kund avbokade' },
  { value: 'kund_ej_narbar', label: 'Kund ej nåbar' },
  { value: 'dublett', label: 'Dublett' },
  { value: 'ovrigt', label: 'Övrigt' },
] as const

export async function deleteCase(
  caseId: string,
  caseType: DeleteableCaseType,
  performedById: string,
  performedByName: string,
  closeReason?: CaseCloseReason
): Promise<{ success: boolean; error?: string }> {
  const tableName = getTableName(caseType);

  // SPÄRR: ärende med skickad faktura tas aldrig bort, oavsett roll och ingång
  const sparr = await taBortSparr(caseId, caseType);
  if (sparr) return { success: false, error: sparr };

  const update: Record<string, unknown> = { status: 'Borttaget' };
  if (closeReason) {
    update.deleted_at = new Date().toISOString();
    update.deleted_by_technician_id = closeReason.technicianId || null;
    update.deleted_by_technician_name = closeReason.technicianName || null;
    update.close_reason = closeReason.reason;
    update.close_reason_notes = closeReason.notes;
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .update(update)
      .eq('id', caseId)
      .select('id');

    if (error) {
      return { success: false, error: `Kunde inte markera ärendet som borttaget: ${error.message}` };
    }
    if (!data || data.length === 0) {
      return { success: false, error: 'Kunde inte markera ärendet som borttaget: inga rader uppdaterades (behörighet kan saknas)' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteCase:', error);
    return { success: false, error: `Ett fel uppstod: ${error.message}` };
  }
}

/**
 * Logga en radering till händelseloggen
 */
async function logCaseDeletion(params: {
  caseId: string;
  caseType: DeleteableCaseType;
  caseTitle: string;
  caseData: any;
  performedById: string;
  performedByName: string;
}): Promise<void> {
  const { caseId, caseType, caseTitle, caseData, performedById, performedByName } = params;

  // Formatera ärendetyp för visning
  const caseTypeLabel = caseType === 'private' ? 'Privatperson'
    : caseType === 'business' ? 'Företag'
    : 'Avtal';

  const entry: EventLogEntry = {
    event_type: 'case_deleted',
    description: `Raderade ärende "${caseTitle}" (${caseTypeLabel})`,
    case_id: caseId,
    case_type: caseType,
    case_title: caseTitle,
    metadata: {
      customer_name: caseData.kontaktperson || caseData.contact_person || null,
      address: caseData.adress?.formatted_address || caseData.address || null,
      pest_type: caseData.skadedjur || caseData.pest_type || null,
      status_at_deletion: caseData.status || null,
      deleted_at: new Date().toISOString()
    },
    performed_by_id: performedById,
    performed_by_name: performedByName
  };

  try {
    await createEventLogEntry(entry);
  } catch (error) {
    // Logga fel men låt inte det stoppa raderingen
    console.error('Failed to log case deletion:', error);
  }
}

/**
 * Skapa en händelselogg-post
 */
export async function createEventLogEntry(entry: EventLogEntry): Promise<void> {
  const { error } = await supabase
    .from('event_log')
    .insert({
      event_type: entry.event_type,
      description: entry.description,
      case_id: entry.case_id,
      case_type: entry.case_type,
      case_title: entry.case_title,
      metadata: entry.metadata,
      performed_by_id: entry.performed_by_id,
      performed_by_name: entry.performed_by_name,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error creating event log entry:', error);
    throw error;
  }
}

/**
 * Hämta händelselogg med paginering
 */
export async function getEventLog(options: {
  limit?: number;
  offset?: number;
  eventTypes?: EventLogEntry['event_type'][];
}): Promise<{ entries: any[]; totalCount: number }> {
  const { limit = 20, offset = 0, eventTypes } = options;

  let query = supabase
    .from('event_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (eventTypes && eventTypes.length > 0) {
    query = query.in('event_type', eventTypes);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching event log:', error);
    throw error;
  }

  return {
    entries: data || [],
    totalCount: count || 0
  };
}

/**
 * Hämta offert-specifika händelser med valfri tekniker-filtrering
 */
export async function getOfferEventLog(options: {
  limit?: number;
  offset?: number;
  technicianEmail?: string;
}): Promise<{ entries: any[]; totalCount: number }> {
  const { limit = 20, offset = 0, technicianEmail } = options;

  let query = supabase
    .from('event_log')
    .select('*', { count: 'exact' })
    .in('event_type', ['offer_sent', 'offer_signed', 'offer_declined', 'offer_expired', 'offer_deleted'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (technicianEmail) {
    query = query.eq('metadata->>technician_email', technicianEmail);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching offer event log:', error);
    throw error;
  }

  return {
    entries: data || [],
    totalCount: count || 0
  };
}
