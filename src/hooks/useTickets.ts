// src/hooks/useTickets.ts
// Hook för att hantera tickets (kommentarer med @mentions)

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getTickets,
  getTicketStats,
  updateCommentStatus,
  type Ticket,
  type TicketFilter,
  type TicketStats,
  type CommentStatus
} from '../services/communicationService';

interface UseTicketsOptions {
  autoFetch?: boolean;
  initialFilter?: TicketFilter;
  pageSize?: number;
}

interface UseTicketsReturn {
  tickets: Ticket[];
  stats: TicketStats | null;
  loading: boolean;
  statsLoading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  filter: TicketFilter;
  setFilter: (filter: TicketFilter) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  updateStatus: (commentId: string, status: CommentStatus) => Promise<boolean>;
}

export function useTickets(options: UseTicketsOptions = {}): UseTicketsReturn {
  const { autoFetch = true, initialFilter = {}, pageSize = 20 } = options;
  const { profile, loading: authLoading } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilterState] = useState<TicketFilter>(initialFilter);

  // Bestäm technicianId baserat på roll
  const technicianId = profile?.role === 'technician' ? profile.technician_id : undefined;

  // Hämta tickets
  const fetchTickets = useCallback(async (reset: boolean = false) => {
    if (authLoading || !profile) return;

    setLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;
      const filterWithTechnician: TicketFilter = {
        ...filter,
        technicianId: technicianId || undefined,
      };

      const result = await getTickets(filterWithTechnician, pageSize, currentOffset);

      if (reset) {
        setTickets(result.tickets);
        setOffset(pageSize);
      } else {
        setTickets(prev => [...prev, ...result.tickets]);
        setOffset(prev => prev + pageSize);
      }

      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Kunde inte hämta tickets');
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile, filter, offset, pageSize, technicianId]);

  // Hämta statistik
  const fetchStats = useCallback(async () => {
    if (authLoading || !profile) return;

    setStatsLoading(true);

    try {
      const result = await getTicketStats(technicianId || undefined);
      setStats(result);
    } catch (err) {
      console.error('Error fetching ticket stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [authLoading, profile, technicianId]);

  // Uppdatera filter och återställ lista
  const setFilter = useCallback((newFilter: TicketFilter) => {
    setFilterState(newFilter);
    setOffset(0);
    setTickets([]);
  }, []);

  // Ladda mer tickets
  const loadMore = useCallback(async () => {
    if (loading || tickets.length >= totalCount) return;
    await fetchTickets(false);
  }, [loading, tickets.length, totalCount, fetchTickets]);

  // Uppdatera allt
  const refresh = useCallback(async () => {
    setOffset(0);
    await Promise.all([
      fetchTickets(true),
      fetchStats(),
    ]);
  }, [fetchTickets, fetchStats]);

  // Uppdatera status på en ticket
  const updateStatus = useCallback(async (commentId: string, status: CommentStatus): Promise<boolean> => {
    if (!profile) return false;

    try {
      const resolvedBy = status === 'resolved' ? profile.id : undefined;
      await updateCommentStatus(commentId, status, resolvedBy);

      // Uppdatera lokalt state
      setTickets(prev => prev.map(ticket =>
        ticket.comment.id === commentId
          ? { ...ticket, comment: { ...ticket.comment, status } }
          : ticket
      ));

      // Uppdatera statistik
      await fetchStats();

      return true;
    } catch (err) {
      console.error('Error updating ticket status:', err);
      setError('Kunde inte uppdatera status');
      return false;
    }
  }, [profile, fetchStats]);

  // Auto-fetch vid mount och filter-ändring
  useEffect(() => {
    if (autoFetch && !authLoading && profile) {
      fetchTickets(true);
      fetchStats();
    }
  }, [autoFetch, authLoading, profile, filter]);

  const hasMore = tickets.length < totalCount;

  return {
    tickets,
    stats,
    loading,
    statsLoading,
    error,
    totalCount,
    hasMore,
    filter,
    setFilter,
    loadMore,
    refresh,
    updateStatus,
  };
}
