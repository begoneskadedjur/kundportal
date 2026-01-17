// src/pages/shared/InternAdministration.tsx
// Dedikerad sida för intern administration - ärende-centrerad vy med händelser
// REDESIGN: Visar ärenden med grupperade händelser istället för enskilda kommentarer

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
import { useCaseEvents } from '../../hooks/useCaseEvents';
import CaseEventCard from '../../components/admin/CaseEventCard';
import { CaseContextCommunicationModal } from '../../components/communication';
import type { CaseType } from '../../types/communication';

// State för valt ärende (för att öppna kommunikationspanel)
interface SelectedCase {
  caseId: string;
  caseType: CaseType;
  caseTitle: string;
}

// Filter-flikar för händelsetyper
type EventFilter = 'all' | 'mentions' | 'replies' | 'activity' | 'archived';

export default function InternAdministration() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();

  // State för kommunikationspanel
  const [selectedCase, setSelectedCase] = useState<SelectedCase | null>(null);

  // State för filter
  const [activeFilter, setActiveFilter] = useState<EventFilter>('all');

  // Hämta aktiva ärenden
  const {
    cases: activeCases,
    stats,
    loading: activeLoading,
    statsLoading,
    error: activeError,
    hasMore: activeHasMore,
    loadMore: activeLoadMore,
    refresh: activeRefresh,
    updateStatus,
  } = useCaseEvents({ includeArchived: false });

  // Hämta arkiverade ärenden
  const {
    cases: archivedCases,
    loading: archivedLoading,
    error: archivedError,
    hasMore: archivedHasMore,
    loadMore: archivedLoadMore,
    refresh: archivedRefresh,
  } = useCaseEvents({ includeArchived: true });

  // Bestäm vilka cases som ska visas baserat på filter
  const isArchiveView = activeFilter === 'archived';
  const cases = isArchiveView ? archivedCases : activeCases;
  const loading = isArchiveView ? archivedLoading : activeLoading;
  const error = isArchiveView ? archivedError : activeError;
  const hasMore = isArchiveView ? archivedHasMore : activeHasMore;
  const loadMore = isArchiveView ? archivedLoadMore : activeLoadMore;
  const refresh = () => {
    activeRefresh();
    archivedRefresh();
  };

  // Hantera URL-parameter
  useEffect(() => {
    const caseId = searchParams.get('caseId');
    const caseType = searchParams.get('caseType') as CaseType | null;
    if (caseId && caseType) {
      // Sök i både aktiva och arkiverade ärenden
      const allCases = [...activeCases, ...archivedCases];
      const foundCase = allCases.find(c => c.case_id === caseId && c.case_type === caseType);
      if (foundCase) {
        setSelectedCase({
          caseId: foundCase.case_id,
          caseType: foundCase.case_type,
          caseTitle: foundCase.case_title
        });
      }
    }
  }, [searchParams, activeCases, archivedCases]);

  const getRoleName = () => {
    switch (profile?.role) {
      case 'admin': return 'Administratör';
      case 'koordinator': return 'Koordinator';
      case 'technician': return 'Tekniker';
      default: return '';
    }
  };

  // Filtrera ärenden baserat på vald flik
  // För arkiv-vyn visas alla arkiverade ärenden utan extra filtrering
  const filteredCases = isArchiveView ? cases : cases.filter(c => {
    switch (activeFilter) {
      case 'mentions':
        // Frågor riktade till mig som jag inte svarat på
        return c.unanswered_mentions > 0;
      case 'replies':
        // Frågor JAG ställt där inte alla har svarat ännu
        // Visas tills ALLA har svarat (inte bara någon)
        return c.outgoing_questions_total > 0 &&
               c.outgoing_questions_answered < c.outgoing_questions_total;
      case 'activity':
        return c.new_comments > 0;
      default:
        return true;
    }
  });

  // Statistik-kort med tydliga namn och tooltips
  const filterTabs = [
    {
      id: 'all' as EventFilter,
      label: 'Alla ärenden',
      shortLabel: 'Alla',
      tooltip: 'Visar alla ärenden där du är involverad, antingen genom att du skrivit eller blivit omnämnd',
      count: stats?.totalCases || 0,
      icon: Inbox,
      color: 'text-slate-400',
      activeColor: 'bg-slate-600 text-white'
    },
    {
      id: 'mentions' as EventFilter,
      label: 'Väntar på svar',
      shortLabel: 'Att göra',
      tooltip: 'Någon har @nämnt dig och väntar på ditt svar. Du behöver agera!',
      count: stats?.unansweredMentions || 0,
      icon: AtSign,
      color: 'text-red-400',
      activeColor: 'bg-red-600 text-white'
    },
    {
      id: 'replies' as EventFilter,
      label: 'Väntar på andras svar',
      shortLabel: 'Bevaka',
      tooltip: 'Du har @nämnt någon annan och väntar på deras svar. Inget du behöver göra just nu.',
      count: stats?.waitingForReplies || 0,
      icon: MessageCircle,
      color: 'text-amber-400',
      activeColor: 'bg-amber-600 text-white'
    },
    {
      id: 'activity' as EventFilter,
      label: 'Ny aktivitet',
      shortLabel: 'Nytt',
      tooltip: 'Ärenden med nya kommentarer som du kanske vill kolla på',
      count: stats?.newActivity || 0,
      icon: Bell,
      color: 'text-blue-400',
      activeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'archived' as EventFilter,
      label: 'Arkiv',
      shortLabel: 'Klart',
      tooltip: 'Avslutade och lösta ärenden. Bra jobbat!',
      count: stats?.archivedCases || 0,
      icon: Archive,
      color: 'text-green-400',
      activeColor: 'bg-green-600 text-white'
    }
  ];

  // Öppna kommunikationspanel för ett ärende
  const handleOpenCase = (caseId: string, caseType: 'private' | 'business' | 'contract') => {
    // Sök i både aktiva och arkiverade ärenden
    const allCases = [...activeCases, ...archivedCases];
    const foundCase = allCases.find(c => c.case_id === caseId && c.case_type === caseType);
    if (foundCase) {
      setSelectedCase({
        caseId: foundCase.case_id,
        caseType: foundCase.case_type,
        caseTitle: foundCase.case_title
      });
    }
  };

  // Stäng kommunikationspanel
  const handleCloseCase = () => {
    setSelectedCase(null);
  };

  // Hantera statusändring (markera löst)
  const handleMarkResolved = async (caseId: string, caseType: 'private' | 'business' | 'contract') => {
    // Sök i både aktiva och arkiverade ärenden
    const allCases = [...activeCases, ...archivedCases];
    const foundCase = allCases.find(c => c.case_id === caseId && c.case_type === caseType);
    if (foundCase && foundCase.events.length > 0) {
      // Uppdatera senaste kommentarens status till resolved
      const latestCommentId = foundCase.events[0].source_comment_id;
      if (latestCommentId) {
        await updateStatus(caseId, caseType as CaseType, latestCommentId, 'resolved');
        // Refresh för att uppdatera listan
        refresh();
      }
    }
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

        {/* Filter-tabs med tooltips */}
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
                  {/* Tooltip arrow */}
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
        {!loading && filteredCases.length > 0 && (
          <div className="text-xs text-slate-500 mb-3">
            Visar {filteredCases.length} ärende{filteredCases.length !== 1 ? 'n' : ''}
            {activeFilter !== 'all' && (
              <span> med {filterTabs.find(t => t.id === activeFilter)?.label.toLowerCase()}</span>
            )}
          </div>
        )}

        {/* Laddar */}
        {loading && cases.length === 0 && (
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

        {/* Ärende-lista */}
        {!loading && filteredCases.length > 0 && (
          <div className="space-y-3">
            {filteredCases.map((caseData) => (
              <CaseEventCard
                key={`${caseData.case_id}:${caseData.case_type}`}
                caseData={caseData}
                onOpenCase={handleOpenCase}
                onMarkResolved={handleMarkResolved}
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
              Ladda fler ärenden
            </button>
          </div>
        )}

        {/* Empty states */}
        {!loading && filteredCases.length === 0 && !isArchiveView && activeCases.length > 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Inga ärenden i denna kategori
            </h3>
            <p className="text-slate-400">
              Byt flik för att se andra ärenden.
            </p>
          </div>
        )}

        {!loading && cases.length === 0 && !isArchiveView && (
          <div className="text-center py-12">
            <Inbox className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Inga aktiva ärenden
            </h3>
            <p className="text-slate-400">
              Du har inga ärenden med aktivitet just nu.
            </p>
          </div>
        )}

        {/* Empty state för arkiv */}
        {!loading && isArchiveView && archivedCases.length === 0 && (
          <div className="text-center py-12">
            <Archive className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Arkivet är tomt
            </h3>
            <p className="text-slate-400">
              Du har inga avklarade ärenden ännu. Klicka "Markera löst" på ett ärende för att arkivera det.
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
