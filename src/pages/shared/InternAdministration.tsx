// src/pages/shared/InternAdministration.tsx
// Dedikerad sida för intern administration och ticket-hantering
// REDESIGN: Tydlig separation mellan navigation, statistik och filtrering

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, MessageSquareText, Clock, AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTickets } from '../../hooks/useTickets';
import { TicketFilters } from '../../components/admin/TicketFilters';
import { TicketList } from '../../components/admin/TicketList';
import { TicketViewTabs, type TicketDirection } from '../../components/admin/TicketViewTabs';
import { CaseContextCommunicationModal } from '../../components/communication';
import type { CaseType } from '../../types/communication';

// State för vald ticket (för att öppna kommunikationspanel)
interface SelectedTicket {
  caseId: string;
  caseType: CaseType;
  caseTitle: string;
}

export default function InternAdministration() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();

  // State för kommunikationspanel (öppnas vid klick på ticket)
  const [selectedTicket, setSelectedTicket] = useState<SelectedTicket | null>(null);

  const {
    tickets,
    stats,
    directionStats,
    loading,
    statsLoading,
    error,
    hasMore,
    filter,
    currentDirection,
    setFilter,
    setDirection,
    loadMore,
    refresh,
    updateStatus,
  } = useTickets();

  // Filtrera på status från URL
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam && ['open', 'in_progress', 'needs_action', 'resolved'].includes(statusParam)) {
      setFilter({ ...filter, status: [statusParam as any] });
    }
  }, [searchParams]);

  const getRoleName = () => {
    switch (profile?.role) {
      case 'admin': return 'Administratör';
      case 'koordinator': return 'Koordinator';
      case 'technician': return 'Tekniker';
      default: return '';
    }
  };

  // Status-statistik (endast informativ, INTE klickbar)
  const statusStats = [
    {
      label: 'Öppna',
      value: stats?.open || 0,
      icon: Inbox,
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Pågår',
      value: stats?.inProgress || 0,
      icon: Clock,
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: 'Kräver åtgärd',
      value: stats?.needsAction || 0,
      icon: AlertTriangle,
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Avklarade',
      value: stats?.resolved || 0,
      icon: CheckCircle2,
      textColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
  ];

  const handleDirectionChange = (direction: TicketDirection) => {
    setDirection(direction);
  };

  // Öppna kommunikationspanel för en ticket
  const handleOpenCommunication = (caseId: string, caseType: CaseType, caseTitle: string) => {
    setSelectedTicket({ caseId, caseType, caseTitle });
  };

  // Stäng kommunikationspanel
  const handleCloseCommunication = () => {
    setSelectedTicket(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <MessageSquareText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Intern Administration</h1>
                <p className="text-slate-400 text-sm">
                  Hantera och följ upp ärenden med @mentions
                </p>
              </div>
            </div>

            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700
                       border border-slate-700 rounded-lg text-slate-300 hover:text-white
                       transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
          </div>

          {/* Roll */}
          <div className="text-sm text-slate-500">
            {getRoleName()}
          </div>
        </div>

        {/* PRIMÄR NAVIGATION: Direction Tabs */}
        <TicketViewTabs
          activeTab={currentDirection}
          counts={{
            incoming: directionStats?.incoming || 0,
            outgoing: directionStats?.outgoing || 0,
            all: directionStats?.all || 0,
          }}
          onTabChange={handleDirectionChange}
        />

        {/* STATISTIK: Status-översikt (endast informativ, ej klickbar) */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
          {statusStats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-2 sm:p-3"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${stat.textColor}`} />
                  <span className="text-[10px] sm:text-xs text-slate-500 truncate">{stat.label}</span>
                </div>
                <div className={`text-lg sm:text-xl font-bold ${stat.textColor}`}>
                  {statsLoading ? '...' : stat.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* SEKUNDÄR FILTRERING: Sök och status-filter */}
        <div className="mb-6">
          <TicketFilters
            filter={filter}
            onFilterChange={setFilter}
            disabled={loading}
          />
        </div>

        {/* Visar antal resultat */}
        {!loading && tickets.length > 0 && (
          <div className="text-xs text-slate-500 mb-3">
            Visar {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            {filter.status && filter.status.length > 0 && (
              <span> med status-filter aktivt</span>
            )}
          </div>
        )}

        {/* Ticket-lista */}
        <TicketList
          tickets={tickets}
          loading={loading}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onStatusChange={updateStatus}
          currentDirection={currentDirection}
          onOpenCommunication={handleOpenCommunication}
        />

        {/* Kontextuell kommunikationsmodal */}
        <CaseContextCommunicationModal
          isOpen={!!selectedTicket}
          onClose={handleCloseCommunication}
          caseId={selectedTicket?.caseId || ''}
          caseType={selectedTicket?.caseType || 'private'}
          caseTitle={selectedTicket?.caseTitle || ''}
        />

        {/* Empty states */}
        {!loading && tickets.length === 0 && (
          <div className="text-center py-12">
            {currentDirection === 'incoming' ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Allt avklarat!
                </h3>
                <p className="text-slate-400">
                  Du har inga tickets som väntar på din åtgärd.
                </p>
              </>
            ) : currentDirection === 'outgoing' ? (
              <>
                <Inbox className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Inga utestående frågor
                </h3>
                <p className="text-slate-400">
                  Du har inte nämnt någon i öppna tickets.
                </p>
              </>
            ) : (
              <>
                <Inbox className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Inga tickets
                </h3>
                <p className="text-slate-400">
                  Det finns inga tickets som matchar dina filter.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
