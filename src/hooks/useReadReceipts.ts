// src/hooks/useReadReceipts.ts
// Hook för att hantera läsbekräftelser på kommentarer

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  markCommentAsRead,
  getReadReceipts,
} from '../services/communicationService';

interface ReadReceipt {
  userId: string;
  userName: string;
  readAt: string;
}

interface UseReadReceiptsReturn {
  markAsRead: (commentId: string) => void;
  getReceipts: (commentId: string) => Promise<ReadReceipt[]>;
  isMarking: boolean;
}

export function useReadReceipts(): UseReadReceiptsReturn {
  const { user } = useAuth();
  const [isMarking, setIsMarking] = useState(false);
  const markedComments = useRef<Set<string>>(new Set());

  // Markera en kommentar som läst (om den inte redan är markerad)
  const markAsRead = useCallback((commentId: string) => {
    if (!user) return;
    if (markedComments.current.has(commentId)) return;

    // Markera direkt för att undvika dubbletter
    markedComments.current.add(commentId);

    // Skicka till servern i bakgrunden (fire and forget)
    markCommentAsRead(commentId, user.id).catch((err) => {
      console.error('Fel vid markering som läst:', err);
      // Ta bort från set om det misslyckades
      markedComments.current.delete(commentId);
    });
  }, [user]);

  // Hämta läsbekräftelser för en kommentar
  const getReceipts = useCallback(async (commentId: string): Promise<ReadReceipt[]> => {
    return getReadReceipts(commentId);
  }, []);

  return {
    markAsRead,
    getReceipts,
    isMarking,
  };
}

// Hook för att observera när en kommentar blir synlig
export function useCommentVisibility(
  commentId: string,
  authorId: string,
  onVisible: (commentId: string) => void
) {
  const { user } = useAuth();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hasBeenVisible = useRef(false);

  useEffect(() => {
    // Markera inte egna kommentarer som lästa
    if (!user || user.id === authorId) return;
    if (hasBeenVisible.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasBeenVisible.current) {
            hasBeenVisible.current = true;
            onVisible(commentId);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 } // Minst 50% synligt
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [commentId, authorId, user, onVisible]);

  return elementRef;
}
