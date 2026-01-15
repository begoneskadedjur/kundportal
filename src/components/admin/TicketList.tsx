// src/components/admin/TicketList.tsx
// Lista med tickets

import { useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { TicketItem } from './TicketItem';
import type { Ticket, CommentStatus, TicketDirection } from '../../services/communicationService';

interface TicketListProps {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onStatusChange?: (commentId: string, status: CommentStatus) => Promise<boolean>;
  currentDirection?: TicketDirection;
}

export function TicketList({
  tickets,
  loading,
  error,
  hasMore,
  onLoadMore,
  onStatusChange,
  currentDirection = 'all',
}: TicketListProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll med IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const element = observerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: '100px',
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [handleObserver]);

  // Error state
  if (error && tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Något gick fel</h3>
        <p className="text-slate-400">{error}</p>
      </div>
    );
  }

  // Loading skeleton (initial)
  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-slate-700 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-slate-700 rounded w-48 mb-2" />
                <div className="h-3 bg-slate-700/50 rounded w-24" />
              </div>
              <div className="h-7 bg-slate-700 rounded-lg w-24" />
            </div>
            <div className="h-4 bg-slate-700/50 rounded w-full mb-2" />
            <div className="h-4 bg-slate-700/50 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state handled by parent component now
  if (!loading && tickets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <TicketItem
          key={ticket.comment.id}
          ticket={ticket}
          direction={currentDirection}
          onStatusChange={onStatusChange}
        />
      ))}

      {/* Infinite scroll trigger */}
      <div ref={observerRef} className="h-4" />

      {/* Loading more indicator */}
      {loading && tickets.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <span className="ml-2 text-slate-400">Laddar fler...</span>
        </div>
      )}

      {/* End of list */}
      {!hasMore && tickets.length > 0 && (
        <div className="text-center py-4 text-slate-500 text-sm">
          Visar alla {tickets.length} tickets
        </div>
      )}
    </div>
  );
}
