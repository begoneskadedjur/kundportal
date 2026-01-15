// src/pages/shared/InternAdministration.tsx
// Dedikerad sida för intern administration och ticket-hantering

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, MessageSquareText, Clock, AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTickets } from '../../hooks/useTickets';
import { TicketFilters } from '../../components/admin/TicketFilters';
import { TicketList } from '../../components/admin/TicketList';

export default function InternAdministration() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();

  const {
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

  // KPI-kort konfiguration
  const statCards = [
    {
      label: 'Öppna',
      value: stats?.open || 0,
      icon: Inbox,
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      filterStatus: 'open' as const,
    },
    {
      label: 'Pågår',
      value: stats?.inProgress || 0,
      icon: Clock,
      color: 'from-yellow-500 to-orange-500',
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      filterStatus: 'in_progress' as const,
    },
    {
      label: 'Kräver åtgärd',
      value: stats?.needsAction || 0,
      icon: AlertTriangle,
      color: 'from-red-500 to-pink-500',
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/10',
      filterStatus: 'needs_action' as const,
    },
    {
      label: 'Avklarade (30d)',
      value: stats?.resolved || 0,
      icon: CheckCircle2,
      color: 'from-green-500 to-emerald-500',
      textColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
      filterStatus: 'resolved' as const,
    },
  ];

  const handleStatCardClick = (status: 'open' | 'in_progress' | 'needs_action' | 'resolved') => {
    // Toggle filter - om redan aktivt, ta bort det
    const currentStatuses = filter.status || [];
    if (currentStatuses.length === 1 && currentStatuses[0] === status) {
      setFilter({ ...filter, status: undefined });
    } else {
      setFilter({ ...filter, status: [status] });
    }
  };

  const activeTicketCount = (stats?.open || 0) + (stats?.inProgress || 0) + (stats?.needsAction || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <MessageSquareText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Intern Administration</h1>
                <p className="text-slate-400 text-sm">
                  {profile?.role === 'technician'
                    ? 'Dina ärenden som kräver hantering'
                    : 'Hantera och följ upp ärenden med @mentions'
                  }
                </p>
              </div>
            </div>

            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700
                       border border-slate-700 rounded-lg text-slate-300 hover:text-white
                       transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
          </div>

          {/* Roll och antal */}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{getRoleName()}</span>
            <span>•</span>
            <span>{activeTicketCount} aktiva ärenden</span>
          </div>
        </div>

        {/* KPI-kort */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => {
            const Icon = card.icon;
            const isActive = filter.status?.length === 1 && filter.status[0] === card.filterStatus;

            return (
              <button
                key={card.label}
                onClick={() => handleStatCardClick(card.filterStatus)}
                disabled={statsLoading}
                className={`
                  relative p-4 rounded-xl border transition-all text-left
                  ${isActive
                    ? `${card.bgColor} border-${card.textColor.replace('text-', '')}/50`
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70'
                  }
                  disabled:opacity-50
                `}
              >
                {/* Bakgrundseffekt */}
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-5 rounded-xl`} />
                )}

                <div className="relative">
                  <div className={`p-2 rounded-lg ${card.bgColor} w-fit mb-3`}>
                    <Icon className={`w-5 h-5 ${card.textColor}`} />
                  </div>

                  <div className={`text-3xl font-bold ${card.textColor} mb-1`}>
                    {statsLoading ? '...' : card.value}
                  </div>

                  <div className="text-sm text-slate-400">{card.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter */}
        <div className="mb-6">
          <TicketFilters
            filter={filter}
            onFilterChange={setFilter}
            disabled={loading}
          />
        </div>

        {/* Ticket-lista */}
        <TicketList
          tickets={tickets}
          loading={loading}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onStatusChange={updateStatus}
        />
      </div>
    </div>
  );
}
