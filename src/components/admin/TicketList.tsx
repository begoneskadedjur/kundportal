// src/components/admin/TicketList.tsx
// Lista med tickets - förbättrad med stabil layout för att undvika hopp

import { useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { TicketItem } from './TicketItem';
import type { Ticket, CommentStatus, TicketDirection } from '../../services/communicationService';
import type { CaseType } from '../../types/communication';

interface TicketListProps {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onStatusChange?: (commentId: string, status: CommentStatus) => Promise<boolean>;
  currentDirection?: TicketDirection;
  onOpenCommunication?: (caseId: string, caseType: CaseType, caseTitle: string) => void;
}

// Skeleton som matchar TicketItem-strukturen exakt (~200px höjd)
function TicketSkeleton({ showDirectionBadge = true }: { showDirectionBadge?: boolean }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl animate-pulse border-l-4 border-l-slate-600">
      {/* Direction badge placeholder */}
      {showDirectionBadge && (
        <div className="px-4 pt-3 pb-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700/50 w-24 h-6" />
        </div>
      )}

      {/* Header med titel och status - matchar TicketItem header */}
      <div className={`flex items-start justify-between p-4 ${showDirectionBadge ? 'pt-2' : ''} pb-2`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Ikon för ärendetyp */}
          <div className="p-2 rounded-lg flex-shrink-0 bg-slate-700/50 w-9 h-9" />

          {/* Titel och typ */}
          <div className="min-w-0 flex-1">
            <div className="h-5 bg-slate-700 rounded w-48 mb-2" />
            <div className="h-3 bg-slate-700/50 rounded w-16" />
          </div>
        </div>

        {/* Status-knapp placeholder */}
        <div className="flex-shrink-0 ml-3">
          <div className="h-8 bg-slate-700/50 rounded-lg w-24" />
        </div>
      </div>

      {/* Kommentarsinnehåll placeholder */}
      <div className="px-4 pb-3">
        <div className="h-4 bg-slate-700/50 rounded w-full mb-2" />
        <div className="h-4 bg-slate-700/50 rounded w-4/5" />
      </div>

      {/* Footer med metadata placeholder */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-700/30">
        <div className="h-3 bg-slate-700/50 rounded w-24" />
        <div className="h-3 bg-slate-700/50 rounded w-20" />
        <div className="h-3 bg-slate-700/50 rounded w-16 ml-auto" />
      </div>
    </div>
  );
}

export function TicketList({
  tickets,
  loading,
  error,
  hasMore,
  onLoadMore,
  onStatusChange,
  currentDirection = 'all',
  onOpenCommunication,
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

  // Visa direction badge i skeleton om vi filtrerar på incoming/outgoing
  const showDirectionBadge = currentDirection !== 'all';

  // Error state
  if (error && tickets.length === 0) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Något gick fel</h3>
        <p className="text-slate-400">{error}</p>
      </div>
    );
  }

  // Loading skeleton (initial) - med stabil min-height
  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-3 min-h-[400px]">
        {[...Array(5)].map((_, i) => (
          <TicketSkeleton key={i} showDirectionBadge={showDirectionBadge} />
        ))}
      </div>
    );
  }

  // Empty state handled by parent component now
  if (!loading && tickets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 min-h-[400px]">
      {tickets.map((ticket, index) => (
        <TicketItem
          key={ticket.comment.id}
          ticket={ticket}
          direction={currentDirection}
          onStatusChange={onStatusChange}
          onOpenCommunication={onOpenCommunication}
          animationDelay={index * 50} // Staggered animation
        />
      ))}

      {/* Infinite scroll trigger */}
      <div ref={observerRef} className="h-4" />

      {/* Loading more indicator - fast höjd för att undvika hopp */}
      <div className="h-14 flex items-center justify-center">
        {loading && tickets.length > 0 && (
          <div className="flex items-center justify-center py-4 animate-in fade-in duration-200">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            <span className="ml-2 text-slate-400">Laddar fler...</span>
          </div>
        )}

        {/* End of list */}
        {!hasMore && tickets.length > 0 && !loading && (
          <div className="text-center py-4 text-slate-500 text-sm">
            Visar alla {tickets.length} tickets
          </div>
        )}
      </div>
    </div>
  );
}
