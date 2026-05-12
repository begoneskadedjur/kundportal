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
  const { data: invoiceRows } = await supabase
    .from('invoices')
    .select('status, fortnox_document_number')
    .eq('case_id', caseId)
    .eq('case_type', caseType);
  const lockedInvoice = (invoiceRows || []).find(
    (r: { status: string; fortnox_document_number: string | null }) =>
      !!r.fortnox_document_number ||
      ['sent', 'booked', 'paid'].includes(r.status)
  );

  // Bestäm om ärendet kan raderas
  let canDelete = childCasesCount === 0;
  let blockReason: string | undefined = childCasesCount > 0
    ? `Ärendet har ${childCasesCount} underärende(n) som måste raderas först.`
    : undefined;

  if (canDelete && lockedInvoice) {
    canDelete = false;
    blockReason = `Ärendet har en faktura som är skickad till Fortnox (status: ${lockedInvoice.status}). Makulera fakturan först om ärendet ska raderas.`;
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
 * Soft-delete: sätter status = 'Borttaget' och döljer ärendet ur alla vyer.
 * Ärendet och all relaterad data behålls i databasen.
 */
export async function deleteCase(
  caseId: string,
  caseType: DeleteableCaseType,
  performedById: string,
  performedByName: string
): Promise<{ success: boolean; error?: string }> {
  const tableName = getTableName(caseType);

  try {
    const { error } = await supabase
      .from(tableName)
      .update({ status: 'Borttaget' })
      .eq('id', caseId);

    if (error) {
      return { success: false, error: `Kunde inte markera ärendet som borttaget: ${error.message}` };
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
