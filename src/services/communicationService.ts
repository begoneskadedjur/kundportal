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

// =============================================================================
// PER-MENTION SPÅRNING - Hjälpfunktioner
// =============================================================================

interface MentionQuestion {
  commentId: string;
  caseId: string;
  caseType: string;
  askerId: string;        // Vem som ställde frågan
  mentionedUserId: string; // Vem som blev nämnd
  askedAt: string;        // När frågan ställdes
  isAnswered: boolean;    // Har den nämnda personen svarat?
}

/**
 * Analyserar kommentarer och bygger en lista av "frågor" (mentions) och om de är besvarade.
 *
 * En fråga anses besvarad när den nämnda personen skriver en kommentar
 * EFTER mention-kommentaren i samma ärende.
 */
function analyzeMentionQuestions(comments: any[]): MentionQuestion[] {
  const questions: MentionQuestion[] = [];

  // Sortera kommentarer efter tid (äldst först) för att kunna spåra svar
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Bygg en map av vilka kommentarer varje användare har skrivit per ärende
  // Key: `${caseId}:${caseType}:${userId}`, Value: array av timestamps
  const userCommentsPerCase = new Map<string, string[]>();

  for (const comment of sortedComments) {
    const key = `${comment.case_id}:${comment.case_type}:${comment.author_id}`;
    const existing = userCommentsPerCase.get(key) || [];
    existing.push(comment.created_at);
    userCommentsPerCase.set(key, existing);
  }

  // Gå igenom alla kommentarer och skapa "frågor" för varje mention
  for (const comment of sortedComments) {
    const mentionedUserIds = comment.mentioned_user_ids || [];

    for (const mentionedUserId of mentionedUserIds) {
      // Skippa om man nämner sig själv
      if (mentionedUserId === comment.author_id) continue;

      // Kolla om den nämnda personen har skrivit en kommentar EFTER denna
      const mentionedUserKey = `${comment.case_id}:${comment.case_type}:${mentionedUserId}`;
      const mentionedUserComments = userCommentsPerCase.get(mentionedUserKey) || [];

      const isAnswered = mentionedUserComments.some(
        timestamp => new Date(timestamp) > new Date(comment.created_at)
      );

      questions.push({
        commentId: comment.id,
        caseId: comment.case_id,
        caseType: comment.case_type,
        askerId: comment.author_id,
        mentionedUserId,
        askedAt: comment.created_at,
        isAnswered,
      });
    }
  }

  return questions;
}

/**
 * Hitta obesvarade frågor riktade till en specifik användare (incoming)
 */
function getUnansweredQuestionsForUser(questions: MentionQuestion[], userId: string): MentionQuestion[] {
  return questions.filter(q => q.mentionedUserId === userId && !q.isAnswered);
}

/**
 * Hitta obesvarade frågor som en användare har ställt (outgoing)
 */
function getUnansweredQuestionsFromUser(questions: MentionQuestion[], userId: string): MentionQuestion[] {
  return questions.filter(q => q.askerId === userId && !q.isAnswered);
}

// =============================================================================
// getTickets - Med per-mention spårning
// =============================================================================

export async function getTickets(
  filter: TicketFilter,
  limit: number = 50,
  offset: number = 0
): Promise<{ tickets: Ticket[]; totalCount: number }> {
  // PER-MENTION LOGIK:
  // - Incoming: Obesvarade frågor riktade till MIG (jag är nämnd och har inte svarat)
  // - Outgoing: Obesvarade frågor JAG har ställt (jag nämnde någon som inte svarat)

  const needsDirectionFilter = filter.direction && filter.currentUserId && filter.direction !== 'all';

  // Bygg grundquery för kommentarer
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

  // Hämta alla för direction-filter eller paginera direkt
  if (!needsDirectionFilter) {
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data: comments, error, count } = await query;

  if (error) {
    console.error('Fel vid hämtning av tickets:', error);
    throw error;
  }

  if (!comments || comments.length === 0) {
    return { tickets: [], totalCount: 0 };
  }

  let filteredComments = comments;
  let actualTotalCount = count || 0; // Startvärde från Supabase

  // Applicera per-mention direction-filter
  if (needsDirectionFilter && filter.currentUserId) {
    // Analysera alla mentions och vilka som är besvarade
    const questions = analyzeMentionQuestions(comments);

    if (filter.direction === 'incoming') {
      // Incoming: Visa kommentarer där JAG är nämnd och INTE har svarat
      const unansweredForMe = getUnansweredQuestionsForUser(questions, filter.currentUserId);

      // Hämta unika comment IDs (en kommentar kan ha flera mentions till mig)
      const incomingCommentIds = new Set(unansweredForMe.map(q => q.commentId));

      // Filtrera till dessa kommentarer, ta den senaste per ärende
      const seenCases = new Set<string>();
      filteredComments = comments.filter(comment => {
        // Måste vara en kommentar som har en obesvarad mention till mig
        if (!incomingCommentIds.has(comment.id)) return false;

        // Visa bara en ticket per ärende (den senaste)
        const caseKey = `${comment.case_id}:${comment.case_type}`;
        if (seenCases.has(caseKey)) return false;
        seenCases.add(caseKey);

        return true;
      });

    } else if (filter.direction === 'outgoing') {
      // Outgoing: Visa kommentarer där JAG nämnde någon som INTE har svarat
      const unansweredFromMe = getUnansweredQuestionsFromUser(questions, filter.currentUserId);

      // Hämta unika comment IDs
      const outgoingCommentIds = new Set(unansweredFromMe.map(q => q.commentId));

      // Filtrera till dessa kommentarer, ta den senaste per ärende
      const seenCases = new Set<string>();
      filteredComments = comments.filter(comment => {
        // Måste vara en kommentar där jag har en obesvarad mention
        if (!outgoingCommentIds.has(comment.id)) return false;

        // Visa bara en ticket per ärende (den senaste)
        const caseKey = `${comment.case_id}:${comment.case_type}`;
        if (seenCases.has(caseKey)) return false;
        seenCases.add(caseKey);

        return true;
      });
    }

    // Spara det faktiska antalet EFTER direction-filtrering men FÖRE paginering
    actualTotalCount = filteredComments.length;

    // Applicera paginering efter filtrering
    filteredComments = filteredComments.slice(offset, offset + limit);
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

    // Om vi filtrerar för tekniker, kontrollera om de är relevanta för ärendet
    if (filter.technicianId) {
      // Kontrollera om teknikern är nämnd i kommentaren eller är författaren
      // Vi behöver INTE hämta ärendet separat - om teknikern är nämnd ska de se ticketen
      // oavsett om de är tilldelade ärendet eller inte
      const isMentioned = comment.mentioned_user_ids?.includes(filter.technicianId);
      const isAuthor = comment.author_id === filter.technicianId;

      // Kontrollera också om teknikern har ett profile_id som matchar (för @mentions via profiles)
      // mentioned_user_ids innehåller profile IDs, inte technician IDs
      const currentUserProfileId = filter.currentUserId;
      const isMentionedByProfile = currentUserProfileId &&
        comment.mentioned_user_ids?.includes(currentUserProfileId);

      if (!isMentioned && !isAuthor && !isMentionedByProfile) {
        continue; // Hoppa över denna ticket
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
    totalCount: actualTotalCount,
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

// Direction-baserad statistik med per-mention spårning
export interface DirectionStats {
  incoming: number;  // Antal obesvarade frågor riktade till mig
  outgoing: number;  // Antal obesvarade frågor jag har ställt
  all: number;       // Totalt antal aktiva ärenden
}

export async function getDirectionStats(userId: string): Promise<DirectionStats> {
  // PER-MENTION LOGIK:
  // - Incoming: Antal ÄRENDEN där jag har obesvarade frågor riktade till mig
  // - Outgoing: Antal ÄRENDEN där jag har obesvarade frågor jag ställt

  // Hämta alla icke-resolved kommentarer
  const { data: allComments } = await supabase
    .from('case_comments')
    .select('id, case_id, case_type, author_id, mentioned_user_ids, created_at')
    .eq('is_system_comment', false)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false });

  if (!allComments || allComments.length === 0) {
    return { incoming: 0, outgoing: 0, all: 0 };
  }

  // Analysera alla mentions
  const questions = analyzeMentionQuestions(allComments);

  // Incoming: Unika ärenden där jag har obesvarade frågor riktade till mig
  const unansweredForMe = getUnansweredQuestionsForUser(questions, userId);
  const incomingCases = new Set(unansweredForMe.map(q => `${q.caseId}:${q.caseType}`));

  // Outgoing: Unika ärenden där jag har obesvarade frågor jag ställt
  const unansweredFromMe = getUnansweredQuestionsFromUser(questions, userId);
  const outgoingCases = new Set(unansweredFromMe.map(q => `${q.caseId}:${q.caseType}`));

  // Totalt antal aktiva ärenden (unika ärenden med icke-resolved kommentarer)
  const allCases = new Set(allComments.map(c => `${c.case_id}:${c.case_type}`));

  return {
    incoming: incomingCases.size,
    outgoing: outgoingCases.size,
    all: allCases.size,
  };
}
