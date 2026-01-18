// src/hooks/useTicketEvents.ts
// Hook för ticket-centrerad händelsevy med realtime-uppdateringar
// En ticket = en root-kommentar (parent_comment_id IS NULL) med alla sina svar

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  getTicketsWithEvents,
  getTicketBasedStats,
  updateCommentStatus,
} from '../services/communicationService';
import type {
  Ticket,
  TicketStats,
  CommentStatus,
  CaseType
} from '../types/communication';

interface UseTicketEventsOptions {
  autoFetch?: boolean;
  pageSize?: number;
  includeArchived?: boolean; // Om true, hämta arkiverade (resolved) tickets
}

interface UseTicketEventsReturn {
  tickets: Ticket[];
  stats: TicketStats | null;
  loading: boolean;
  statsLoading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  resolveTicket: (ticketId: string) => Promise<boolean>;
  reopenTicket: (ticketId: string) => Promise<boolean>;
}

export function useTicketEvents(options: UseTicketEventsOptions = {}): UseTicketEventsReturn {
  const { autoFetch = true, pageSize = 20, includeArchived = false } = options;
  const { profile, loading: authLoading } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);

  const currentUserId = profile?.id;

  // Hämta tickets
  const fetchTickets = useCallback(async (reset: boolean = false) => {
    if (authLoading || !profile || !currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getTicketsWithEvents(
        currentUserId,
        pageSize,
        reset ? 0 : offset,
        includeArchived
      );

      if (reset) {
        setTickets(result.tickets);
        setOffset(result.tickets.length);
      } else {
        setTickets(prev => [...prev, ...result.tickets]);
        setOffset(prev => prev + result.tickets.length);
      }

      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Kunde inte hämta tickets');
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile, currentUserId, offset, pageSize, includeArchived]);

  // Hämta statistik
  const fetchStats = useCallback(async () => {
    if (authLoading || !profile || !currentUserId) return;

    setStatsLoading(true);

    try {
      const statsResult = await getTicketBasedStats(currentUserId);
      setStats(statsResult);
    } catch (err) {
      console.error('Error fetching ticket stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [authLoading, profile, currentUserId]);

  // Ladda mer
  const loadMore = useCallback(async () => {
    if (loading || error || tickets.length >= totalCount) return;
    await fetchTickets(false);
  }, [loading, error, tickets.length, totalCount, fetchTickets]);

  // Refresh allt
  const refresh = useCallback(async () => {
    setOffset(0);
    await Promise.all([
      fetchTickets(true),
      fetchStats()
    ]);
  }, [fetchTickets, fetchStats]);

  // Markera ticket som löst
  const resolveTicket = useCallback(async (ticketId: string): Promise<boolean> => {
    if (!profile) return false;

    try {
      await updateCommentStatus(ticketId, 'resolved', profile.id);

      // Uppdatera lokalt state
      setTickets(prev => prev.map(t => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'resolved' as CommentStatus,
            root_comment: {
              ...t.root_comment,
              status: 'resolved' as CommentStatus,
              resolved_at: new Date().toISOString(),
              resolved_by: profile.id
            }
          };
        }
        return t;
      }));

      // Uppdatera statistik
      await fetchStats();

      return true;
    } catch (err) {
      console.error('Error resolving ticket:', err);
      setError('Kunde inte markera ticket som löst');
      return false;
    }
  }, [profile, fetchStats]);

  // Återöppna ticket
  const reopenTicket = useCallback(async (ticketId: string): Promise<boolean> => {
    if (!profile) return false;

    try {
      await updateCommentStatus(ticketId, 'open');

      // Uppdatera lokalt state
      setTickets(prev => prev.map(t => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'open' as CommentStatus,
            root_comment: {
              ...t.root_comment,
              status: 'open' as CommentStatus,
              resolved_at: null,
              resolved_by: null
            }
          };
        }
        return t;
      }));

      // Uppdatera statistik
      await fetchStats();

      return true;
    } catch (err) {
      console.error('Error reopening ticket:', err);
      setError('Kunde inte återöppna ticket');
      return false;
    }
  }, [profile, fetchStats]);

  // Auto-fetch vid mount
  useEffect(() => {
    if (autoFetch && !authLoading && profile && currentUserId) {
      setOffset(0);
      setTickets([]);
      setTotalCount(0);

      (async () => {
        setLoading(true);
        setError(null);
        try {
          const result = await getTicketsWithEvents(currentUserId, pageSize, 0, includeArchived);
          setTickets(result.tickets);
          setOffset(result.tickets.length);
          setTotalCount(result.totalCount);
        } catch (err) {
          console.error('Error fetching tickets:', err);
          setError('Kunde inte hämta tickets');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [autoFetch, authLoading, profile, currentUserId, pageSize, includeArchived]);

  // Hämta stats separat
  useEffect(() => {
    if (autoFetch && !authLoading && profile && currentUserId) {
      fetchStats();
    }
  }, [autoFetch, authLoading, profile, currentUserId, fetchStats]);

  // Realtime-subscription för automatiska uppdateringar
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      refresh();
    }, 500);
  }, [refresh]);

  useEffect(() => {
    if (!currentUserId || !autoFetch) return;

    const channel = supabase
      .channel('ticket-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'case_comments'
        },
        () => debouncedRefresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comment_read_receipts',
          filter: `user_id=eq.${currentUserId}`
        },
        () => debouncedRefresh()
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [currentUserId, autoFetch, debouncedRefresh]);

  const hasMore = tickets.length < totalCount;

  return {
    tickets,
    stats,
    loading,
    statsLoading,
    error,
    totalCount,
    hasMore,
    loadMore,
    refresh,
    resolveTicket,
    reopenTicket
  };
}
