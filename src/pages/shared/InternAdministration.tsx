// src/pages/shared/InternAdministration.tsx
// Tickets - Sida för intern kommunikation med @mentions
// TICKET-centrerad vy: Visar individuella tickets (root-kommentarer) istället för hela ärenden

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  MessageSquareText,
  AtSign,
  MessageCircle,
  Bell,
  CheckCircle2,
  Inbox,
  Loader2,
  Archive
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTicketEvents } from '../../hooks/useTicketEvents';
import TicketCard from '../../components/admin/TicketCard';
import { CaseContextCommunicationModal } from '../../components/communication';
import type { CaseType } from '../../types/communication';

// State för valt ärende (för att öppna kommunikationspanel)
interface SelectedCase {
  caseId: string;
  caseType: CaseType;
  caseTitle: string;
}

// Filter-flikar för ticket-typer
type TicketFilter = 'all' | 'mentions' | 'replies' | 'activity' | 'archived';

export default function InternAdministration() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();

  // State för kommunikationspanel
  const [selectedCase, setSelectedCase] = useState<SelectedCase | null>(null);

  // State för filter
  const [activeFilter, setActiveFilter] = useState<TicketFilter>('mentions');

  // Hämta aktiva tickets
  const {
    tickets: activeTickets,
    stats,
    loading: activeLoading,
    statsLoading,
    error: activeError,
    hasMore: activeHasMore,
    loadMore: activeLoadMore,
    refresh: activeRefresh,
    resolveTicket,
  } = useTicketEvents({ includeArchived: false });

  // Hämta arkiverade tickets
  const {
    tickets: archivedTickets,
    loading: archivedLoading,
    error: archivedError,
    hasMore: archivedHasMore,
    loadMore: archivedLoadMore,
    refresh: archivedRefresh,
    reopenTicket,
  } = useTicketEvents({ includeArchived: true });

  // Bestäm vilka tickets som ska visas baserat på filter
  const isArchiveView = activeFilter === 'archived';
  const tickets = isArchiveView ? archivedTickets : activeTickets;
  const loading = isArchiveView ? archivedLoading : activeLoading;
  const error = isArchiveView ? archivedError : activeError;
  const hasMore = isArchiveView ? archivedHasMore : activeHasMore;
  const loadMore = isArchiveView ? archivedLoadMore : activeLoadMore;
  const refresh = () => {
    activeRefresh();
    archivedRefresh();
  };

  // Hantera URL-parameter för att öppna specifikt ärende
  useEffect(() => {
    const caseId = searchParams.get('caseId');
    const caseType = searchParams.get('caseType') as CaseType | null;
    if (caseId && caseType) {
      // Sök i både aktiva och arkiverade tickets
      const allTickets = [...activeTickets, ...archivedTickets];
      const foundTicket = allTickets.find(t => t.case_id === caseId && t.case_type === caseType);
      if (foundTicket) {
        setSelectedCase({
          caseId: foundTicket.case_id,
          caseType: foundTicket.case_type,
          caseTitle: foundTicket.case_title
        });
      }
    }
  }, [searchParams, activeTickets, archivedTickets]);

  const getRoleName = () => {
    switch (profile?.role) {
      case 'admin': return 'Administratör';
      case 'koordinator': return 'Koordinator';
      case 'technician': return 'Tekniker';
      default: return '';
    }
  };

  // Filtrera tickets baserat på vald flik
  const filteredTickets = isArchiveView ? tickets : tickets.filter(t => {
    switch (activeFilter) {
      case 'mentions':
        // Frågor riktade till mig som jag inte svarat på
        return t.unanswered_mentions > 0;
      case 'replies':
        // Frågor JAG ställt där inte alla har svarat ännu
        return t.outgoing_questions_total > 0 &&
               t.outgoing_questions_answered < t.outgoing_questions_total;
      case 'activity':
        return t.unread_count > 0;
      default:
        return true;
    }
  });

  // Statistik-kort med tooltips
  const filterTabs = [
    {
      id: 'mentions' as TicketFilter,
      label: 'Väntar på ditt svar',
      shortLabel: 'Att göra',
      tooltip: 'Någon har @nämnt dig i en ticket och väntar på ditt svar.',
      count: stats?.unansweredMentions || 0,
      icon: AtSign,
      color: 'text-red-400',
      activeColor: 'bg-red-600 text-white'
    },
    {
      id: 'replies' as TicketFilter,
      label: 'Väntar på andras svar',
      shortLabel: 'Bevaka',
      tooltip: 'Du har @nämnt någon annan och väntar på deras svar.',
      count: stats?.waitingForReplies || 0,
      icon: MessageCircle,
      color: 'text-amber-400',
      activeColor: 'bg-amber-600 text-white'
    },
    {
      id: 'activity' as TicketFilter,
      label: 'Ny aktivitet',
      shortLabel: 'Nytt',
      tooltip: 'Tickets med olästa kommentarer',
      count: stats?.newActivity || 0,
      icon: Bell,
      color: 'text-blue-400',
      activeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'all' as TicketFilter,
      label: 'Alla tickets',
      shortLabel: 'Alla',
      tooltip: 'Alla tickets där du är involverad',
      count: stats?.openTickets || 0,
      icon: Inbox,
      color: 'text-slate-400',
      activeColor: 'bg-slate-600 text-white'
    },
    {
      id: 'archived' as TicketFilter,
      label: 'Avslutade',
      shortLabel: 'Klart',
      tooltip: 'Lösta tickets. Bra jobbat!',
      count: stats?.resolvedTickets || 0,
      icon: Archive,
      color: 'text-green-400',
      activeColor: 'bg-green-600 text-white'
    }
  ];

  // Öppna kommunikationspanel för ett ärende
  const handleOpenCase = (caseId: string, caseType: 'private' | 'business' | 'contract') => {
    const allTickets = [...activeTickets, ...archivedTickets];
    const foundTicket = allTickets.find(t => t.case_id === caseId && t.case_type === caseType);
    if (foundTicket) {
      setSelectedCase({
        caseId: foundTicket.case_id,
        caseType: foundTicket.case_type,
        caseTitle: foundTicket.case_title
      });
    }
  };

  // Stäng kommunikationspanel
  const handleCloseCase = () => {
    setSelectedCase(null);
  };

  // Markera ticket som löst
  const handleResolveTicket = async (ticketId: string) => {
    await resolveTicket(ticketId);
    // Refresh för att flytta ticket till arkiv
    refresh();
  };

  // Återöppna ticket
  const handleReopenTicket = async (ticketId: string) => {
    await reopenTicket(ticketId);
    refresh();
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
                <h1 className="text-xl sm:text-2xl font-bold text-white">Tickets</h1>
                <p className="text-slate-400 text-sm">
                  Intern kommunikation med @mentions
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

        {/* Filter-tabs */}
        <div className="flex flex-wrap gap-2 mb-6 p-1 bg-slate-800/50 rounded-lg">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFilter === tab.id;

            return (
              <div key={tab.id} className="relative group/tab">
                <button
                  onClick={() => setActiveFilter(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${isActive
                      ? tab.activeColor
                      : `bg-transparent ${tab.color} hover:bg-slate-700/50`
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-bold
                    ${isActive ? 'bg-white/20' : 'bg-slate-700'}`}>
                    {statsLoading ? '...' : tab.count}
                  </span>
                </button>
                {/* Tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2
                              bg-slate-900 border border-slate-700 rounded-lg shadow-xl
                              text-xs text-slate-300 whitespace-normal w-48 text-center
                              opacity-0 invisible group-hover/tab:opacity-100 group-hover/tab:visible
                              transition-all duration-200 z-50 pointer-events-none">
                  {tab.tooltip}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0
                                border-l-[6px] border-l-transparent
                                border-r-[6px] border-r-transparent
                                border-t-[6px] border-t-slate-700" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Resultat-info */}
        {!loading && filteredTickets.length > 0 && (
          <div className="text-xs text-slate-500 mb-3">
            Visar {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
            {activeFilter !== 'all' && activeFilter !== 'archived' && (
              <span> med {filterTabs.find(t => t.id === activeFilter)?.label.toLowerCase()}</span>
            )}
          </div>
        )}

        {/* Laddar */}
        {loading && tickets.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Ticket-lista */}
        {!loading && filteredTickets.length > 0 && (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onOpenCase={handleOpenCase}
                onResolveTicket={handleResolveTicket}
                onReopenTicket={handleReopenTicket}
                isArchiveView={isArchiveView}
              />
            ))}
          </div>
        )}

        {/* Ladda mer */}
        {hasMore && !loading && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMore}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700
                       rounded-lg text-slate-300 hover:text-white transition-colors"
            >
              Ladda fler tickets
            </button>
          </div>
        )}

        {/* Empty states */}
        {!loading && filteredTickets.length === 0 && !isArchiveView && activeTickets.length > 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Inga tickets i denna kategori
            </h3>
            <p className="text-slate-400">
              Byt flik för att se andra tickets.
            </p>
          </div>
        )}

        {!loading && tickets.length === 0 && !isArchiveView && (
          <div className="text-center py-12">
            <Inbox className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Inga aktiva tickets
            </h3>
            <p className="text-slate-400">
              Du har inga tickets med aktivitet just nu.
            </p>
          </div>
        )}

        {/* Empty state för arkiv */}
        {!loading && isArchiveView && archivedTickets.length === 0 && (
          <div className="text-center py-12">
            <Archive className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Arkivet är tomt
            </h3>
            <p className="text-slate-400">
              Du har inga avklarade tickets ännu. Klicka "Markera löst" på en ticket för att arkivera den.
            </p>
          </div>
        )}

        {/* Kontextuell kommunikationsmodal */}
        <CaseContextCommunicationModal
          isOpen={!!selectedCase}
          onClose={handleCloseCase}
          caseId={selectedCase?.caseId || ''}
          caseType={selectedCase?.caseType || 'private'}
          caseTitle={selectedCase?.caseTitle || ''}
        />
      </div>
    </div>
  );
}
