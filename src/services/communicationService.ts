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
} from '../types/communication';

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

  // Hämta ALLA aktiva användare (admins, koordinatorer och tekniker)
  // Borttagen: .not('technician_id', 'is', null) som blockerade admins/koordinatorer
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

  // Begränsa antal resultat
  return results.slice(0, showAll ? 20 : 10);
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
  const { data, error } = await supabase
    .from('comment_read_receipts')
    .select(`
      user_id,
      read_at,
      profiles!inner (
        display_name,
        technicians (
          name
        )
      )
    `)
    .eq('comment_id', commentId);

  if (error) {
    console.error('Fel vid hämtning av läsbekräftelser:', error);
    return [];
  }

  return (data || []).map((receipt: any) => ({
    userId: receipt.user_id,
    userName: receipt.profiles?.display_name || receipt.profiles?.technicians?.name || 'Okänd',
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
