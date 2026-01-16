// src/hooks/useCaseEvents.ts
// Hook för ärende-centrerad händelsevy

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getCasesWithEvents,
  getCaseBasedStats,
  updateCommentStatus,
  type CaseWithEvents,
  type CommentStatus,
  type CaseType
} from '../services/communicationService';

interface UseCaseEventsOptions {
  autoFetch?: boolean;
  pageSize?: number;
}

interface CaseStats {
  totalCases: number;
  unansweredMentions: number;
  waitingForReplies: number;
  newActivity: number;
}

interface UseCaseEventsReturn {
  cases: CaseWithEvents[];
  stats: CaseStats | null;
  loading: boolean;
  statsLoading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  updateStatus: (caseId: string, caseType: CaseType, commentId: string, status: CommentStatus) => Promise<boolean>;
}

export function useCaseEvents(options: UseCaseEventsOptions = {}): UseCaseEventsReturn {
  const { autoFetch = true, pageSize = 20 } = options;
  const { profile, loading: authLoading } = useAuth();

  const [cases, setCases] = useState<CaseWithEvents[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);

  const currentUserId = profile?.id;

  // Hämta ärenden med händelser
  const fetchCases = useCallback(async (reset: boolean = false) => {
    if (authLoading || !profile || !currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getCasesWithEvents(
        currentUserId,
        pageSize,
        reset ? 0 : offset
      );

      if (reset) {
        setCases(result.cases);
        setOffset(result.cases.length);
      } else {
        setCases(prev => [...prev, ...result.cases]);
        setOffset(prev => prev + result.cases.length);
      }

      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error fetching case events:', err);
      setError('Kunde inte hämta ärenden');
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile, currentUserId, offset, pageSize]);

  // Hämta statistik
  const fetchStats = useCallback(async () => {
    if (authLoading || !profile || !currentUserId) return;

    setStatsLoading(true);

    try {
      const statsResult = await getCaseBasedStats(currentUserId);
      setStats(statsResult);
    } catch (err) {
      console.error('Error fetching case stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [authLoading, profile, currentUserId]);

  // Ladda mer
  const loadMore = useCallback(async () => {
    if (loading || error || cases.length >= totalCount) return;
    await fetchCases(false);
  }, [loading, error, cases.length, totalCount, fetchCases]);

  // Refresh allt
  const refresh = useCallback(async () => {
    setOffset(0);
    await Promise.all([
      fetchCases(true),
      fetchStats()
    ]);
  }, [fetchCases, fetchStats]);

  // Uppdatera status på en kommentar i ett ärende
  const updateStatus = useCallback(async (
    caseId: string,
    caseType: CaseType,
    commentId: string,
    status: CommentStatus
  ): Promise<boolean> => {
    if (!profile) return false;

    try {
      const resolvedBy = status === 'resolved' ? profile.id : undefined;
      await updateCommentStatus(commentId, status, resolvedBy);

      // Uppdatera lokalt state
      setCases(prev => prev.map(c => {
        if (c.case_id === caseId && c.case_type === caseType) {
          return { ...c, status };
        }
        return c;
      }));

      // Uppdatera statistik
      await fetchStats();

      return true;
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Kunde inte uppdatera status');
      return false;
    }
  }, [profile, fetchStats]);

  // Auto-fetch vid mount
  useEffect(() => {
    if (autoFetch && !authLoading && profile && currentUserId) {
      setOffset(0);
      setCases([]);
      setTotalCount(0);

      (async () => {
        setLoading(true);
        setError(null);
        try {
          const result = await getCasesWithEvents(currentUserId, pageSize, 0);
          setCases(result.cases);
          setOffset(result.cases.length);
          setTotalCount(result.totalCount);
        } catch (err) {
          console.error('Error fetching case events:', err);
          setError('Kunde inte hämta ärenden');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [autoFetch, authLoading, profile, currentUserId, pageSize]);

  // Hämta stats separat
  useEffect(() => {
    if (autoFetch && !authLoading && profile && currentUserId) {
      fetchStats();
    }
  }, [autoFetch, authLoading, profile, currentUserId, fetchStats]);

  const hasMore = cases.length < totalCount;

  return {
    cases,
    stats,
    loading,
    statsLoading,
    error,
    totalCount,
    hasMore,
    loadMore,
    refresh,
    updateStatus
  };
}
