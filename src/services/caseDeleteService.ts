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
  };
  canDelete: boolean;
  blockReason?: string;
}

export interface EventLogEntry {
  event_type: 'case_deleted' | 'case_created' | 'case_updated' | 'status_changed';
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

  // Hämta ärendets grundinfo
  const { data: caseData, error: caseError } = await supabase
    .from(tableName)
    .select('id, title, kontaktperson')
    .eq('id', caseId)
    .single();

  if (caseError || !caseData) {
    throw new Error(`Kunde inte hitta ärendet: ${caseError?.message || 'Okänt fel'}`);
  }

  // Kontrollera om det finns underärenden (child cases) - endast för private/business
  let childCasesCount = 0;
  if (caseType === 'private' || caseType === 'business') {
    const { count: childCount } = await supabase
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .eq('parent_case_id', caseId);

    childCasesCount = childCount || 0;
  }

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

  // Räkna läsbekräftelser
  const { count: readReceiptsCount } = await supabase
    .from('comment_read_receipts')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('case_type', caseType);

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

  // Bestäm om ärendet kan raderas
  const canDelete = childCasesCount === 0;
  const blockReason = childCasesCount > 0
    ? `Ärendet har ${childCasesCount} underärende(n) som måste raderas först.`
    : undefined;

  return {
    caseId,
    caseType,
    caseTitle: caseData.title || 'Namnlöst ärende',
    customerName: caseData.kontaktperson,
    relatedData: {
      comments: commentsCount || 0,
      images: imagesCount || 0,
      notifications: notificationsCount || 0,
      readReceipts: readReceiptsCount || 0,
      visits: visitsCount,
      billingLogs: billingLogsCount || 0,
      childCases: childCasesCount
    },
    canDelete,
    blockReason
  };
}

/**
 * Radera ett ärende och all relaterad data
 * Returnerar true om raderingen lyckades
 */
export async function deleteCase(
  caseId: string,
  caseType: DeleteableCaseType,
  performedById: string,
  performedByName: string
): Promise<{ success: boolean; error?: string }> {
  const tableName = getTableName(caseType);

  try {
    // Hämta ärende-info innan vi raderar (för loggning)
    const { data: caseData, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', caseId)
      .single();

    if (fetchError || !caseData) {
      return { success: false, error: `Kunde inte hitta ärendet: ${fetchError?.message}` };
    }

    // Kontrollera om det finns child cases
    if (caseType === 'private' || caseType === 'business') {
      const { count: childCount } = await supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .eq('parent_case_id', caseId);

      if (childCount && childCount > 0) {
        return {
          success: false,
          error: `Ärendet har ${childCount} underärende(n) som måste raderas först.`
        };
      }
    }

    // Radera i rätt ordning (beroenden först)

    // 1. Radera läsbekräftelser
    const { error: readReceiptsError } = await supabase
      .from('comment_read_receipts')
      .delete()
      .eq('case_id', caseId)
      .eq('case_type', caseType);

    if (readReceiptsError) {
      console.error('Error deleting read receipts:', readReceiptsError);
    }

    // 2. Radera notifikationer
    const { error: notificationsError } = await supabase
      .from('notifications')
      .delete()
      .eq('case_id', caseId)
      .eq('case_type', caseType);

    if (notificationsError) {
      console.error('Error deleting notifications:', notificationsError);
    }

    // 3. Radera kommentarer
    const { error: commentsError } = await supabase
      .from('case_comments')
      .delete()
      .eq('case_id', caseId)
      .eq('case_type', caseType);

    if (commentsError) {
      console.error('Error deleting comments:', commentsError);
    }

    // 4. Radera bilder (radera även från storage)
    const { data: images } = await supabase
      .from('case_images')
      .select('image_url')
      .eq('case_id', caseId)
      .eq('case_type', caseType);

    if (images && images.length > 0) {
      // Extrahera filnamn från URL:er och radera från storage
      const filePaths = images
        .map(img => {
          if (img.image_url) {
            // Extrahera sökvägen efter 'case-images/'
            const match = img.image_url.match(/case-images\/(.+)/);
            return match ? match[1] : null;
          }
          return null;
        })
        .filter((path): path is string => path !== null);

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('case-images')
          .remove(filePaths);

        if (storageError) {
          console.error('Error deleting images from storage:', storageError);
        }
      }
    }

    // Radera bild-poster från tabellen
    const { error: imagesError } = await supabase
      .from('case_images')
      .delete()
      .eq('case_id', caseId)
      .eq('case_type', caseType);

    if (imagesError) {
      console.error('Error deleting image records:', imagesError);
    }

    // 5. Radera besök (endast för contract)
    if (caseType === 'contract') {
      const { error: visitsError } = await supabase
        .from('visits')
        .delete()
        .eq('case_id', caseId);

      if (visitsError) {
        console.error('Error deleting visits:', visitsError);
      }
    }

    // 6. Radera billing audit log
    const { error: billingError } = await supabase
      .from('billing_audit_log')
      .delete()
      .eq('case_id', caseId)
      .eq('case_type', caseType);

    if (billingError) {
      console.error('Error deleting billing logs:', billingError);
    }

    // 7. Slutligen, radera själva ärendet
    const { error: caseDeleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', caseId);

    if (caseDeleteError) {
      return { success: false, error: `Kunde inte radera ärendet: ${caseDeleteError.message}` };
    }

    // 8. Logga händelsen
    await logCaseDeletion({
      caseId,
      caseType,
      caseTitle: caseData.title || 'Namnlöst ärende',
      caseData,
      performedById,
      performedByName
    });

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
