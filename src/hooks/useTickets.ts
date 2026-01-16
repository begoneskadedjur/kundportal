// src/hooks/useTickets.ts
// Hook för att hantera tickets (kommentarer med @mentions)

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getTickets,
  getTicketStats,
  getDirectionStats,
  updateCommentStatus,
  type Ticket,
  type TicketFilter,
  type TicketStats,
  type DirectionStats,
  type CommentStatus,
  type TicketDirection
} from '../services/communicationService';

interface UseTicketsOptions {
  autoFetch?: boolean;
  initialFilter?: TicketFilter;
  pageSize?: number;
}

interface UseTicketsReturn {
  tickets: Ticket[];
  stats: TicketStats | null;
  directionStats: DirectionStats | null;
  loading: boolean;
  statsLoading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  filter: TicketFilter;
  currentDirection: TicketDirection;
  setFilter: (filter: TicketFilter) => void;
  setDirection: (direction: TicketDirection) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  updateStatus: (commentId: string, status: CommentStatus) => Promise<boolean>;
}

export function useTickets(options: UseTicketsOptions = {}): UseTicketsReturn {
  const { autoFetch = true, initialFilter = {}, pageSize = 20 } = options;
  const { profile, loading: authLoading } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [directionStats, setDirectionStats] = useState<DirectionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilterState] = useState<TicketFilter>(initialFilter);
  const [currentDirection, setCurrentDirection] = useState<TicketDirection>('incoming');

  // Bestäm technicianId baserat på roll
  const technicianId = profile?.role === 'technician' ? profile.technician_id : undefined;
  const currentUserId = profile?.id;

  // Hämta tickets
  const fetchTickets = useCallback(async (reset: boolean = false) => {
    if (authLoading || !profile) return;

    setLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;
      const filterWithContext: TicketFilter = {
        ...filter,
        technicianId: technicianId || undefined,
        direction: currentDirection,
        currentUserId: currentUserId,
      };

      const result = await getTickets(filterWithContext, pageSize, currentOffset);

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
  }, [authLoading, profile, filter, offset, pageSize, technicianId, currentDirection, currentUserId]);

  // Hämta statistik
  const fetchStats = useCallback(async () => {
    if (authLoading || !profile) return;

    setStatsLoading(true);

    try {
      const [statusStats, dirStats] = await Promise.all([
        getTicketStats(technicianId || undefined),
        currentUserId ? getDirectionStats(currentUserId) : Promise.resolve({ incoming: 0, outgoing: 0, all: 0 }),
      ]);

      setStats(statusStats);
      setDirectionStats(dirStats);
    } catch (err) {
      console.error('Error fetching ticket stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [authLoading, profile, technicianId, currentUserId]);

  // Uppdatera filter - behåll stale data tills nya laddats
  // (setTickets([]) tas bort för att undvika layout-hopp)
  const setFilter = useCallback((newFilter: TicketFilter) => {
    setFilterState(newFilter);
    setOffset(0);
    // VIKTIGT: Ta INTE bort tickets här - de rensas automatiskt i fetchTickets(true)
    // Detta undviker att listan "hoppar" när man byter filter
  }, []);

  // Uppdatera direction - behåll stale data tills nya laddats
  const setDirection = useCallback((direction: TicketDirection) => {
    setCurrentDirection(direction);
    setOffset(0);
    // VIKTIGT: Ta INTE bort tickets här - de rensas automatiskt i fetchTickets(true)
    // Detta undviker att listan "hoppar" när man byter flik
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

      // Uppdatera lokalt state optimistiskt
      setTickets(prev => prev.map(ticket =>
        ticket.comment.id === commentId
          ? { ...ticket, comment: { ...ticket.comment, status } }
          : ticket
      ));

      // Uppdatera statistik
      await fetchStats();

      // Gör en fullständig refresh för att uppdatera listan korrekt
      // (tickets kan försvinna/dyka upp baserat på direction-filter)
      setOffset(0);
      await fetchTickets(true);

      return true;
    } catch (err) {
      console.error('Error updating ticket status:', err);
      setError('Kunde inte uppdatera status');
      return false;
    }
  }, [profile, fetchStats, fetchTickets]);

  // Auto-fetch vid mount och filter/direction-ändring
  useEffect(() => {
    if (autoFetch && !authLoading && profile) {
      fetchTickets(true);
    }
  }, [autoFetch, authLoading, profile, filter, currentDirection]);

  // Hämta stats separat
  useEffect(() => {
    if (autoFetch && !authLoading && profile) {
      fetchStats();
    }
  }, [autoFetch, authLoading, profile]);

  const hasMore = tickets.length < totalCount;

  return {
    tickets,
    stats,
    directionStats,
    loading,
    statsLoading,
    error,
    totalCount,
    hasMore,
    filter,
    currentDirection,
    setFilter,
    setDirection,
    loadMore,
    refresh,
    updateStatus,
  };
}
