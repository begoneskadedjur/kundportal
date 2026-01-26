// src/components/shared/EventLogCard.tsx
// Kort för att visa händelselogg på dashboards

import { useState, useEffect } from 'react';
import { History, Trash2, FileText, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { getEventLog } from '../../services/caseDeleteService';
import { formatDistanceToNow } from '../../utils/dateUtils';

interface EventLogEntry {
  id: string;
  event_type: string;
  description: string;
  case_id?: string;
  case_type?: string;
  case_title?: string;
  metadata?: Record<string, any>;
  performed_by_id: string;
  performed_by_name: string;
  created_at: string;
}

interface EventLogCardProps {
  maxEntries?: number;
  title?: string;
}

// Ikon och färg baserat på händelsetyp
const getEventTypeInfo = (eventType: string) => {
  switch (eventType) {
    case 'case_deleted':
      return {
        icon: Trash2,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        label: 'Radering'
      };
    case 'case_created':
      return {
        icon: FileText,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        label: 'Skapat'
      };
    case 'case_updated':
      return {
        icon: FileText,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        label: 'Uppdaterat'
      };
    case 'status_changed':
      return {
        icon: RefreshCw,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        label: 'Statusändring'
      };
    default:
      return {
        icon: History,
        color: 'text-slate-400',
        bgColor: 'bg-slate-500/20',
        label: 'Händelse'
      };
  }
};

export default function EventLogCard({ maxEntries = 10, title = 'Händelselogg' }: EventLogCardProps) {
  const [entries, setEntries] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Hämta händelselogg
  const fetchEventLog = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getEventLog({ limit: maxEntries });
      setEntries(result.entries);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error fetching event log:', err);
      setError('Kunde inte hämta händelselogg');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventLog();
  }, [maxEntries]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <History className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">{title}</h3>
            <p className="text-xs text-slate-400">
              {loading ? 'Laddar...' : `${totalCount} händelse${totalCount !== 1 ? 'r' : ''} totalt`}
            </p>
          </div>
        </div>

        <button
          onClick={fetchEventLog}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Innehåll */}
      <div className="p-4">
        {/* Laddning */}
        {loading && entries.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        )}

        {/* Fel */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Tom lista */}
        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-8">
            <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Ingen aktivitet registrerad ännu</p>
          </div>
        )}

        {/* Händelselista */}
        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => {
              const typeInfo = getEventTypeInfo(entry.event_type);
              const Icon = typeInfo.icon;

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg hover:bg-slate-900/50 transition-colors"
                >
                  {/* Ikon */}
                  <div className={`flex-shrink-0 p-1.5 rounded ${typeInfo.bgColor}`}>
                    <Icon className={`w-3.5 h-3.5 ${typeInfo.color}`} />
                  </div>

                  {/* Innehåll */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-tight">
                      {entry.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">
                        {entry.performed_by_name}
                      </span>
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(entry.created_at))}
                      </span>
                    </div>

                    {/* Metadata (t.ex. kundnamn, adress) */}
                    {entry.metadata && (entry.metadata.customer_name || entry.metadata.address) && (
                      <div className="mt-1.5 text-xs text-slate-500">
                        {entry.metadata.customer_name && (
                          <span>{entry.metadata.customer_name}</span>
                        )}
                        {entry.metadata.customer_name && entry.metadata.address && (
                          <span> • </span>
                        )}
                        {entry.metadata.address && (
                          <span className="truncate">
                            {typeof entry.metadata.address === 'string'
                              ? entry.metadata.address
                              : entry.metadata.address.formatted_address || 'Okänd adress'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Visa fler länk om det finns fler */}
            {totalCount > maxEntries && (
              <div className="pt-2 text-center">
                <button className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">
                  Visa alla {totalCount} händelser
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
