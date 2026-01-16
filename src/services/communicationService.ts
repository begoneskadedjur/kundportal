// src/services/communicationService.ts
// Service för kommunikationssystemet - kommentarer, mentions och notifikationer

import { supabase } from '../lib/supabase';
import {
  CaseComment,
  CaseCommentInsert,
  CaseCommentUpdate,
  Notification,
  NotificationInsert,
  CaseType,
  AuthorRole,
  CommentAttachment,
  ParsedMention,
  MentionSuggestion,
  SystemEventType,
  ROLE_MENTIONS,
  extractMentions,
  truncatePreview,
  CommentStatus,
} from '../types/communication';

// Re-export types for consumers
export type { CommentStatus, CaseType };

// === KOMMENTARER ===

export async function getCommentsByCase(
  caseId: string,
  caseType: CaseType
): Promise<CaseComment[]> {
  const { data, error } = await supabase
    .from('case_comments')
    .select('*')
    .eq('case_id', caseId)
    .eq('case_type', caseType)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createComment(
  comment: CaseCommentInsert,
  caseTitle?: string
): Promise<CaseComment> {
  // FÖRENKLAD: Mentions-data skickas nu direkt i comment-objektet
  // från useCaseComments hook istället för att extraheras från text
  const mentionedUserIds = comment.mentioned_user_ids || [];
  const mentionedUserNames = comment.mentioned_user_names || [];
  const mentionedRoles = comment.mentioned_roles || [];
  const mentionsAll = comment.mentions_all || false;

  // Skapa kommentaren
  const { data, error } = await supabase
    .from('case_comments')
    .insert({
      ...comment,
      mentioned_user_ids: mentionedUserIds,
      mentioned_user_names: mentionedUserNames,
      mentioned_roles: mentionedRoles,
      mentions_all: mentionsAll,
    })
    .select()
    .single();

  if (error) throw error;

  // Skapa notifikationer för alla som nämndes
  const recipients = await resolveNotificationRecipients(
    mentionedUserIds,
    mentionedRoles,
    mentionsAll,
    comment.author_id
  );

  if (recipients.length > 0) {
    await createNotificationsForMentions(
      data,
      recipients,
      comment.author_name,
      caseTitle
    );
  }

  return data;
}

export async function updateComment(
  commentId: string,
  update: CaseCommentUpdate
): Promise<CaseComment> {
  const { data, error } = await supabase
    .from('case_comments')
    .update({
      ...update,
      is_edited: true,
      edited_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('case_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

// === SYSTEM-KOMMENTARER ===

export async function createSystemComment(
  caseId: string,
  caseType: CaseType,
  eventType: SystemEventType,
  message: string,
  authorId: string,
  authorName: string
): Promise<CaseComment> {
  const { data, error } = await supabase
    .from('case_comments')
    .insert({
      case_id: caseId,
      case_type: caseType,
      author_id: authorId,
      author_name: 'System',
      author_role: 'admin' as AuthorRole, // System använder admin-roll
      content: message,
      is_system_comment: true,
      system_event_type: eventType,
      attachments: [],
      mentioned_user_ids: [],
      mentioned_roles: [],
      mentions_all: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// === NOTIFIKATIONER ===

export async function getNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}

// === MENTIONS ===

export async function getMentionSuggestions(
  searchQuery: string,
  currentUserId: string
): Promise<MentionSuggestion[]> {
  const suggestions: MentionSuggestion[] = [];
  const query = searchQuery.toLowerCase();

  // Lägg till rollmentions som matchar
  if (query === '' || 'tekniker'.startsWith(query)) {
    const techCount = await getUserCountByRole('technician');
    suggestions.push({
      type: 'role',
      role: 'technician',
      displayName: '@tekniker',
      subtitle: `Alla tekniker (${techCount})`,
    });
  }

  if (query === '' || 'koordinator'.startsWith(query)) {
    const coordCount = await getUserCountByRole('koordinator');
    suggestions.push({
      type: 'role',
      role: 'koordinator',
      displayName: '@koordinator',
      subtitle: `Alla koordinatorer (${coordCount})`,
    });
  }

  if (query === '' || 'admin'.startsWith(query)) {
    const adminCount = await getUserCountByRole('admin');
    suggestions.push({
      type: 'role',
      role: 'admin',
      displayName: '@admin',
      subtitle: `Alla admins (${adminCount})`,
    });
  }

  if (query === '' || 'alla'.startsWith(query)) {
    const totalCount = await getTotalUserCount();
    suggestions.push({
      type: 'all',
      displayName: '@alla',
      subtitle: `Alla användare (${totalCount})`,
    });
  }

  // Sök efter användare - visa alltid (även utan söktext)
  const showAllUsers = query.length === 0;
  const users = await searchUsers(query, currentUserId, showAllUsers);
  for (const user of users) {
    suggestions.push({
      type: 'user',
      id: user.id,
      displayName: user.name,
      subtitle: getRoleDisplayName(user.role),
      avatarUrl: user.avatar_url,
    });
  }

  return suggestions;
}

async function searchUsers(
  query: string,
  excludeUserId: string,
  showAll: boolean = false
): Promise<{ id: string; name: string; role: string; avatar_url?: string }[]> {
  const results: { id: string; name: string; role: string; avatar_url?: string }[] = [];

  // Hämta ENDAST interna användare (admins, koordinatorer och tekniker)
  // Filtrerar bort kunder (role = 'customer')
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(`
      id,
      user_id,
      display_name,
      role,
      technician_id,
      technicians (
        id,
        name,
        role
      )
    `)
    .eq('is_active', true)
    .in('role', ['admin', 'koordinator', 'technician'])
    .neq('id', excludeUserId)
    .order('display_name');

  if (error) {
    console.error('Fel vid sökning efter användare:', error);
    return results;
  }

  // Lägg till användare
  if (profiles) {
    for (const profile of profiles) {
      // Hämta namn: display_name eller teknikerns namn
      const techData = profile.technicians as { id: string; name: string; role: string } | null;
      const displayName = profile.display_name || techData?.name || 'Okänd användare';

      // Filtrera på namn om query finns
      const queryLower = query.toLowerCase();
      if (query.length === 0 || displayName.toLowerCase().includes(queryLower)) {
        // Mappa tekniker-roll till profile-roll om den saknas
        let userRole = profile.role || 'technician';
        if (!profile.role && techData?.role) {
          if (techData.role === 'Admin') userRole = 'admin';
          else if (techData.role === 'Koordinator') userRole = 'koordinator';
          else userRole = 'technician';
        }

        results.push({
          id: profile.id, // profile.id är auth user id
          name: displayName,
          role: userRole,
        });
      }
    }
  }

  // Sortera efter namn (alfabetiskt) och begränsa antal resultat
  // Filtrera bort "Okänd användare" (admins utan display_name)
  const filteredResults = results.filter(r => r.name !== 'Okänd användare');
  filteredResults.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  return filteredResults.slice(0, showAll ? 20 : 10);
}

async function getUserCountByRole(role: string): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', role);

  if (error) return 0;
  return count || 0;
}

async function getTotalUserCount(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (error) return 0;
  return count || 0;
}

function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    admin: 'Admin',
    koordinator: 'Koordinator',
    technician: 'Tekniker',
  };
  return roleNames[role] || role;
}

// === INTERNA HJÄLPFUNKTIONER ===

async function resolveNotificationRecipients(
  userIds: string[],
  roles: string[],
  mentionsAll: boolean,
  excludeUserId: string
): Promise<string[]> {
  const recipients = new Set<string>(userIds);

  if (mentionsAll) {
    // Hämta alla användare
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', excludeUserId);

    data?.forEach(u => recipients.add(u.id));
  } else if (roles.length > 0) {
    // Hämta användare med specifika roller
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .in('role', roles)
      .neq('id', excludeUserId);

    data?.forEach(u => recipients.add(u.id));
  }

  // Ta bort avsändaren från mottagarlistan
  recipients.delete(excludeUserId);

  return [...recipients];
}

async function createNotificationsForMentions(
  comment: CaseComment,
  recipientIds: string[],
  senderName: string,
  caseTitle?: string
): Promise<void> {
  const notifications: NotificationInsert[] = recipientIds.map(recipientId => ({
    recipient_id: recipientId,
    source_comment_id: comment.id,
    case_id: comment.case_id,
    case_type: comment.case_type,
    title: `${senderName} nämnde dig`,
    preview: truncatePreview(comment.content),
    case_title: caseTitle || null,
    sender_id: comment.author_id,
    sender_name: senderName,
  }));

  if (notifications.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      console.error('Fel vid skapande av notifikationer:', error);
    }
  }
}

// === BILAGOR ===

export async function uploadCommentAttachment(
  file: File,
  userId: string
): Promise<CommentAttachment> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('comment-attachments')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('comment-attachments')
    .getPublicUrl(fileName);

  return {
    url: publicUrl,
    filename: file.name,
    mimetype: file.type,
    size: file.size,
    uploaded_at: new Date().toISOString(),
  };
}

export async function deleteCommentAttachment(url: string): Promise<void> {
  // Extrahera filnamnet från URL:en
  const urlParts = url.split('/');
  const fileName = urlParts.slice(-2).join('/');

  const { error } = await supabase.storage
    .from('comment-attachments')
    .remove([fileName]);

  if (error) throw error;
}

// === SÖKNING ===

export async function searchComments(
  query: string,
  limit: number = 20
): Promise<{ comments: CaseComment[]; totalCount: number }> {
  // Använd full-text search
  const { data, error, count } = await supabase
    .from('case_comments')
    .select('*', { count: 'exact' })
    .textSearch('content', query, { type: 'websearch', config: 'swedish' })
    .eq('is_system_comment', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return {
    comments: data || [],
    totalCount: count || 0,
  };
}

// === REALTIME SUBSCRIPTIONS ===

export function subscribeToComments(
  caseId: string,
  caseType: CaseType,
  onInsert: (comment: CaseComment) => void,
  onUpdate: (comment: CaseComment) => void,
  onDelete: (commentId: string) => void
) {
  const channel = supabase
    .channel(`comments:${caseId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'case_comments',
        filter: `case_id=eq.${caseId}`,
      },
      (payload) => {
        if (payload.new.case_type === caseType) {
          onInsert(payload.new as CaseComment);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'case_comments',
        filter: `case_id=eq.${caseId}`,
      },
      (payload) => {
        if (payload.new.case_type === caseType) {
          onUpdate(payload.new as CaseComment);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'case_comments',
        filter: `case_id=eq.${caseId}`,
      },
      (payload) => {
        onDelete(payload.old.id);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToNotifications(
  userId: string,
  onNewNotification: (notification: Notification) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        onNewNotification(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// === LÄSBEKRÄFTELSER ===

export async function markCommentAsRead(
  commentId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('comment_read_receipts')
    .upsert(
      { comment_id: commentId, user_id: userId },
      { onConflict: 'comment_id,user_id' }
    );

  if (error) {
    console.error('Fel vid markering av kommentar som läst:', error);
  }
}

export async function getReadReceipts(
  commentId: string
): Promise<{ userId: string; userName: string; readAt: string }[]> {
  // Steg 1: Hämta läsbekräftelser
  const { data: receipts, error } = await supabase
    .from('comment_read_receipts')
    .select('user_id, read_at')
    .eq('comment_id', commentId);

  if (error) {
    console.error('Fel vid hämtning av läsbekräftelser:', error);
    return [];
  }

  if (!receipts || receipts.length === 0) {
    return [];
  }

  // Steg 2: Hämta användarnamn från profiles separat
  const userIds = receipts.map(r => r.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, technician_id')
    .in('id', userIds);

  // Skapa en map för snabb lookup
  const profileMap = new Map<string, string>();

  if (profiles) {
    // Hämta technician-namn för de som har technician_id
    const technicianIds = profiles
      .filter(p => p.technician_id)
      .map(p => p.technician_id);

    let technicianMap = new Map<string, string>();
    if (technicianIds.length > 0) {
      const { data: technicians } = await supabase
        .from('technicians')
        .select('id, name')
        .in('id', technicianIds);

      if (technicians) {
        technicians.forEach(t => technicianMap.set(t.id, t.name));
      }
    }

    // Bygg profileMap med bästa tillgängliga namn
    profiles.forEach(p => {
      const techName = p.technician_id ? technicianMap.get(p.technician_id) : null;
      profileMap.set(p.id, p.display_name || techName || 'Okänd');
    });
  }

  return receipts.map((receipt) => ({
    userId: receipt.user_id,
    userName: profileMap.get(receipt.user_id) || 'Okänd',
    readAt: receipt.read_at,
  }));
}

export async function getReadCount(commentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('comment_read_receipts')
    .select('*', { count: 'exact', head: true })
    .eq('comment_id', commentId);

  if (error) {
    console.error('Fel vid räkning av läsbekräftelser:', error);
    return 0;
  }

  return count || 0;
}

// === TICKET-STATUS ===

export async function updateCommentStatus(
  commentId: string,
  status: 'open' | 'in_progress' | 'resolved' | 'needs_action',
  resolvedBy?: string
): Promise<void> {
  const updateData: any = { status };

  if (status === 'resolved' && resolvedBy) {
    updateData.resolved_at = new Date().toISOString();
    updateData.resolved_by = resolvedBy;
  } else if (status !== 'resolved') {
    updateData.resolved_at = null;
    updateData.resolved_by = null;
  }

  const { error } = await supabase
    .from('case_comments')
    .update(updateData)
    .eq('id', commentId);

  if (error) {
    console.error('Fel vid uppdatering av kommentarsstatus:', error);
    throw error;
  }
}

// === TICKETS (KOMMENTARER MED @MENTIONS) ===

export interface Ticket {
  comment: CaseComment;
  case_id: string;
  case_type: CaseType;
  case_title: string;
  kontaktperson: string | null;
  adress: string | null;
  skadedjur: string | null;
}

// Hjälpfunktion för att formatera adress från JSON eller sträng
function formatAddress(adress: any): string | null {
  if (!adress) return null;

  // Om det är en sträng, försök parsa JSON
  if (typeof adress === 'string') {
    try {
      const parsed = JSON.parse(adress);
      if (parsed.formatted_address) return parsed.formatted_address;
      if (parsed.address) return parsed.address;
      // Om det inte är JSON, returnera strängen direkt
      return adress;
    } catch {
      // Inte JSON, returnera direkt
      return adress;
    }
  }

  // Om det är ett objekt
  if (typeof adress === 'object') {
    if (adress.formatted_address) return adress.formatted_address;
    if (adress.address) return adress.address;
    // Försök bygga adress från komponenter
    const parts = [];
    if (adress.street) parts.push(adress.street);
    if (adress.city) parts.push(adress.city);
    if (adress.postal_code) parts.push(adress.postal_code);
    if (parts.length > 0) return parts.join(', ');
  }

  return null;
}

export type TicketDirection = 'incoming' | 'outgoing' | 'all';

export interface TicketFilter {
  status?: ('open' | 'in_progress' | 'resolved' | 'needs_action')[];
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  technicianId?: string; // För tekniker: filtrera på deras ärenden
  direction?: TicketDirection; // incoming = nämnda mig, outgoing = jag nämnde
  currentUserId?: string; // För direction-filtrering
}

export interface TicketStats {
  open: number;
  inProgress: number;
  needsAction: number;
  resolved: number;
}

export async function getTickets(
  filter: TicketFilter,
  limit: number = 50,
  offset: number = 0
): Promise<{ tickets: Ticket[]; totalCount: number }> {
  // För "outgoing" behöver vi en mer komplex logik:
  // Vi måste filtrera bort tickets där de nämnda personerna har svarat
  const isOutgoing = filter.direction === 'outgoing' && filter.currentUserId;

  // Bygg query för kommentarer med mentions
  let query = supabase
    .from('case_comments')
    .select('*', { count: 'exact' })
    .eq('is_system_comment', false);

  // Filtrera på status
  if (filter.status && filter.status.length > 0) {
    query = query.in('status', filter.status);
  }

  // Sök i innehåll
  if (filter.searchQuery && filter.searchQuery.trim()) {
    query = query.ilike('content', `%${filter.searchQuery.trim()}%`);
  }

  // Datumfilter
  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }
  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }

  // Direction-filter (incoming/outgoing)
  if (filter.direction && filter.currentUserId && filter.direction !== 'all') {
    if (filter.direction === 'incoming') {
      // Tickets där jag är nämnd men inte är författare
      query = query
        .neq('author_id', filter.currentUserId)
        .contains('mentioned_user_ids', [filter.currentUserId]);
    } else if (filter.direction === 'outgoing') {
      // Tickets där jag är författare OCH har nämnt någon
      // Filtrera bort besvarade tickets efter query
      query = query
        .eq('author_id', filter.currentUserId)
        .not('mentioned_user_ids', 'eq', '{}'); // Har minst en mention
    }
  }

  // Sortera och paginera
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: comments, error, count } = await query;

  if (error) {
    console.error('Fel vid hämtning av tickets:', error);
    throw error;
  }

  if (!comments || comments.length === 0) {
    return { tickets: [], totalCount: 0 };
  }

  // För "outgoing": Filtrera bort tickets där någon av de nämnda personerna har svarat
  let filteredComments = comments;
  if (isOutgoing && filter.currentUserId) {
    // Hämta alla kommentarer i samma ärenden för att kolla efter svar
    const caseIdsForReplyCheck = [...new Set(comments.map(c => c.case_id))];

    const { data: allCaseComments } = await supabase
      .from('case_comments')
      .select('id, case_id, case_type, author_id, created_at')
      .in('case_id', caseIdsForReplyCheck)
      .eq('is_system_comment', false);

    if (allCaseComments) {
      filteredComments = comments.filter(comment => {
        const mentionedUserIds = comment.mentioned_user_ids || [];
        if (mentionedUserIds.length === 0) return false;

        // Kolla om någon av de nämnda har skrivit en NYARE kommentar i samma ärende
        const hasReply = allCaseComments.some(otherComment => {
          const isInSameCase = otherComment.case_id === comment.case_id;
          const isFromMentionedUser = mentionedUserIds.includes(otherComment.author_id);
          const isNewer = new Date(otherComment.created_at) > new Date(comment.created_at);
          return isInSameCase && isFromMentionedUser && isNewer;
        });

        // Behåll ticketen endast om det INTE finns svar
        return !hasReply;
      });
    }
  }

  // Hämta ärendeinformation för varje kommentar
  const caseIds = [...new Set(filteredComments.map(c => c.case_id))];
  const tickets: Ticket[] = [];

  // Hämta private cases
  const { data: privateCases } = await supabase
    .from('private_cases')
    .select('id, title, kontaktperson, adress, skadedjur')
    .in('id', caseIds);

  // Hämta business cases
  const { data: businessCases } = await supabase
    .from('business_cases')
    .select('id, title, kontaktperson, adress, skadedjur')
    .in('id', caseIds);

  // Skapa lookup maps
  const privateCaseMap = new Map(privateCases?.map(c => [c.id, c]) || []);
  const businessCaseMap = new Map(businessCases?.map(c => [c.id, c]) || []);

  // Bygg tickets från filtrerade kommentarer
  for (const comment of filteredComments) {
    let caseData: { title: string; kontaktperson: string | null; adress: any; skadedjur: string | null } | null = null;

    if (comment.case_type === 'private') {
      caseData = privateCaseMap.get(comment.case_id) || null;
    } else if (comment.case_type === 'business') {
      caseData = businessCaseMap.get(comment.case_id) || null;
    }

    // Om vi filtrerar för tekniker, kontrollera om de är tilldelade
    if (filter.technicianId) {
      // Hämta ärende för att kolla assignees
      const { data: caseAssignee } = await supabase
        .from(comment.case_type === 'private' ? 'private_cases' : 'business_cases')
        .select('primary_assignee_id, secondary_assignee_id, tertiary_assignee_id')
        .eq('id', comment.case_id)
        .single();

      if (caseAssignee) {
        const isAssigned =
          caseAssignee.primary_assignee_id === filter.technicianId ||
          caseAssignee.secondary_assignee_id === filter.technicianId ||
          caseAssignee.tertiary_assignee_id === filter.technicianId;

        // Inkludera också om teknikern är nämnd i kommentaren
        const isMentioned = comment.mentioned_user_ids?.includes(filter.technicianId) ||
          comment.author_id === filter.technicianId;

        if (!isAssigned && !isMentioned) {
          continue; // Hoppa över denna ticket
        }
      }
    }

    tickets.push({
      comment: comment as CaseComment,
      case_id: comment.case_id,
      case_type: comment.case_type as CaseType,
      case_title: caseData?.title || 'Okänt ärende',
      kontaktperson: caseData?.kontaktperson || null,
      adress: formatAddress(caseData?.adress),
      skadedjur: caseData?.skadedjur || null,
    });
  }

  return {
    tickets,
    totalCount: count || 0,
  };
}

export async function getTicketStats(technicianId?: string): Promise<TicketStats> {
  // Bygg grundquery
  const buildQuery = (status: string) => {
    let query = supabase
      .from('case_comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_system_comment', false)
      .eq('status', status);

    return query;
  };

  // Kör alla queries parallellt
  const [openRes, inProgressRes, needsActionRes, resolvedRes] = await Promise.all([
    buildQuery('open'),
    buildQuery('in_progress'),
    buildQuery('needs_action'),
    buildQuery('resolved')
      .gte('resolved_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()), // Senaste 30 dagarna
  ]);

  return {
    open: openRes.count || 0,
    inProgress: inProgressRes.count || 0,
    needsAction: needsActionRes.count || 0,
    resolved: resolvedRes.count || 0,
  };
}

// Direction-baserad statistik
export interface DirectionStats {
  incoming: number;  // Tickets där jag är nämnd och väntar på mitt svar
  outgoing: number;  // Tickets där jag nämnt någon och väntar på deras svar
  all: number;       // Totalt antal aktiva
}

export async function getDirectionStats(userId: string): Promise<DirectionStats> {
  // Hämta incoming (där jag är nämnd men inte författare)
  const { count: incomingCount } = await supabase
    .from('case_comments')
    .select('*', { count: 'exact', head: true })
    .eq('is_system_comment', false)
    .neq('author_id', userId)
    .contains('mentioned_user_ids', [userId])
    .neq('status', 'resolved');

  // För outgoing behöver vi en mer komplex logik:
  // Räkna bara tickets där jag nämnt någon OCH de inte har svarat
  const { data: outgoingComments } = await supabase
    .from('case_comments')
    .select('id, case_id, case_type, mentioned_user_ids, created_at')
    .eq('is_system_comment', false)
    .eq('author_id', userId)
    .not('mentioned_user_ids', 'eq', '{}') // Har minst en mention
    .neq('status', 'resolved');

  let outgoingCount = 0;

  if (outgoingComments && outgoingComments.length > 0) {
    // Hämta alla kommentarer i samma ärenden för att kolla efter svar
    const caseIds = [...new Set(outgoingComments.map(c => c.case_id))];

    const { data: allCaseComments } = await supabase
      .from('case_comments')
      .select('id, case_id, author_id, created_at')
      .in('case_id', caseIds)
      .eq('is_system_comment', false);

    if (allCaseComments) {
      // Räkna bara de som INTE har fått svar
      for (const comment of outgoingComments) {
        const mentionedUserIds = comment.mentioned_user_ids || [];
        if (mentionedUserIds.length === 0) continue;

        // Kolla om någon av de nämnda har skrivit en NYARE kommentar i samma ärende
        const hasReply = allCaseComments.some(otherComment => {
          const isInSameCase = otherComment.case_id === comment.case_id;
          const isFromMentionedUser = mentionedUserIds.includes(otherComment.author_id);
          const isNewer = new Date(otherComment.created_at) > new Date(comment.created_at);
          return isInSameCase && isFromMentionedUser && isNewer;
        });

        // Räkna endast om det INTE finns svar
        if (!hasReply) {
          outgoingCount++;
        }
      }
    }
  }

  // Hämta alla aktiva tickets (för referens)
  const { count: allCount } = await supabase
    .from('case_comments')
    .select('*', { count: 'exact', head: true })
    .eq('is_system_comment', false)
    .neq('status', 'resolved');

  return {
    incoming: incomingCount || 0,
    outgoing: outgoingCount,
    all: allCount || 0,
  };
}
