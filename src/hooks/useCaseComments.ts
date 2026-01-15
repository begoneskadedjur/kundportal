// src/hooks/useCaseComments.ts
// Hook för att hantera kommentarer på ärenden
// FÖRENKLAD: Tar emot mentions separat från text

import { useState, useEffect, useCallback } from 'react';
import {
  CaseComment,
  CaseCommentInsert,
  CaseType,
  AuthorRole,
  CommentAttachment,
} from '../types/communication';
import {
  getCommentsByCase,
  createComment,
  updateComment,
  deleteComment,
  subscribeToComments,
  uploadCommentAttachment,
} from '../services/communicationService';
import { useAuth } from '../contexts/AuthContext';
import { TrackedMention } from './useMentions';
import toast from 'react-hot-toast';

interface UseCaseCommentsOptions {
  caseId: string;
  caseType: CaseType;
  caseTitle?: string;
}

interface UseCaseCommentsReturn {
  comments: CaseComment[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  addComment: (content: string, attachments?: File[], mentions?: TrackedMention[]) => Promise<void>;
  editComment: (commentId: string, content: string) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCaseComments({
  caseId,
  caseType,
  caseTitle,
}: UseCaseCommentsOptions): UseCaseCommentsReturn {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CaseComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hämta kommentarer
  const fetchComments = useCallback(async () => {
    if (!caseId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await getCommentsByCase(caseId, caseType);
      setComments(data);
    } catch (err) {
      console.error('Fel vid hämtning av kommentarer:', err);
      setError('Kunde inte hämta kommentarer');
    } finally {
      setIsLoading(false);
    }
  }, [caseId, caseType]);

  // Prenumerera på realtidsuppdateringar
  useEffect(() => {
    if (!caseId) return;

    fetchComments();

    const unsubscribe = subscribeToComments(
      caseId,
      caseType,
      (newComment) => {
        setComments((prev) => [...prev, newComment]);
      },
      (updatedComment) => {
        setComments((prev) =>
          prev.map((c) => (c.id === updatedComment.id ? updatedComment : c))
        );
      },
      (deletedId) => {
        setComments((prev) => prev.filter((c) => c.id !== deletedId));
      }
    );

    return unsubscribe;
  }, [caseId, caseType, fetchComments]);

  // Lägg till kommentar - FÖRENKLAD: tar emot mentions separat
  const addComment = useCallback(
    async (content: string, attachments?: File[], mentions?: TrackedMention[]) => {
      if (!user || !profile) {
        toast.error('Du måste vara inloggad för att kommentera');
        return;
      }

      if (!content.trim() && (!attachments || attachments.length === 0)) {
        toast.error('Kommentaren kan inte vara tom');
        return;
      }

      try {
        setIsSubmitting(true);

        // Ladda upp bilagor först
        const uploadedAttachments: CommentAttachment[] = [];
        if (attachments && attachments.length > 0) {
          for (const file of attachments) {
            const attachment = await uploadCommentAttachment(file, user.id);
            uploadedAttachments.push(attachment);
          }
        }

        // Hämta användarnamn
        const authorName = await getAuthorName(user.id, profile.role);

        // Extrahera mentions-data från TrackedMention[]
        const mentionedUserIds: string[] = [];
        const mentionedRoles: string[] = [];
        let mentionsAll = false;

        if (mentions && mentions.length > 0) {
          for (const mention of mentions) {
            if (mention.type === 'all') {
              mentionsAll = true;
            } else if (mention.type === 'role' && mention.role) {
              if (!mentionedRoles.includes(mention.role)) {
                mentionedRoles.push(mention.role);
              }
            } else if (mention.type === 'user') {
              if (!mentionedUserIds.includes(mention.userId)) {
                mentionedUserIds.push(mention.userId);
              }
            }
          }
        }

        const commentData: CaseCommentInsert = {
          case_id: caseId,
          case_type: caseType,
          author_id: user.id,
          author_name: authorName,
          author_role: profile.role as AuthorRole,
          content: content.trim(),
          attachments: uploadedAttachments,
          mentioned_user_ids: mentionedUserIds,
          mentioned_roles: mentionedRoles,
          mentions_all: mentionsAll,
        };

        const newComment = await createComment(commentData, caseTitle);

        // Lägg till kommentaren direkt i listan (optimistisk uppdatering)
        // Realtime subscription kan vara långsam eller inaktiverad
        setComments((prev) => {
          // Kontrollera om kommentaren redan finns (från realtime)
          if (prev.some((c) => c.id === newComment.id)) {
            return prev;
          }
          return [...prev, newComment];
        });
      } catch (err) {
        console.error('Fel vid skapande av kommentar:', err);
        toast.error('Kunde inte skapa kommentar');
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, profile, caseId, caseType, caseTitle]
  );

  // Redigera kommentar
  const editComment = useCallback(
    async (commentId: string, content: string) => {
      if (!content.trim()) {
        toast.error('Kommentaren kan inte vara tom');
        return;
      }

      try {
        setIsSubmitting(true);
        await updateComment(commentId, { content: content.trim() });
        toast.success('Kommentar uppdaterad');
      } catch (err) {
        console.error('Fel vid uppdatering av kommentar:', err);
        toast.error('Kunde inte uppdatera kommentar');
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  // Ta bort kommentar
  const removeComment = useCallback(async (commentId: string) => {
    try {
      setIsSubmitting(true);
      await deleteComment(commentId);
      toast.success('Kommentar borttagen');
    } catch (err) {
      console.error('Fel vid borttagning av kommentar:', err);
      toast.error('Kunde inte ta bort kommentar');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    comments,
    isLoading,
    isSubmitting,
    error,
    addComment,
    editComment,
    removeComment,
    refresh: fetchComments,
  };
}

// Hjälpfunktion för att hämta användarnamn
async function getAuthorName(userId: string, role: string): Promise<string> {
  const { supabase } = await import('../lib/supabase');

  // Försök hämta via profiles med join till technicians
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      display_name,
      technicians (
        name
      )
    `)
    .eq('id', userId)
    .single();

  if (profile) {
    // Använd display_name eller teknikerns namn
    const techData = profile.technicians as { name: string } | null;
    if (profile.display_name) return profile.display_name;
    if (techData?.name) return techData.name;
  }

  // Fallback till generic namn baserat på roll
  const roleNames: Record<string, string> = {
    admin: 'Admin',
    koordinator: 'Koordinator',
    technician: 'Tekniker',
  };

  return roleNames[role] || 'Användare';
}
