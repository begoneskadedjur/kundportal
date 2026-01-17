// src/components/admin/CaseEventCard.tsx
// Ärendekort med expanderbara händelser för ärende-centrerad notifikationsvy

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AtSign,
  MessageCircle,
  MessageSquare,
  ExternalLink,
  Home,
  Building2,
  MapPin,
  User,
  Clock,
  Bug
} from 'lucide-react';
import { CaseWithEvents, CaseEvent, CaseEventType } from '../../services/communicationService';
import { formatDistanceToNow } from '../../utils/dateUtils';

interface CaseEventCardProps {
  caseData: CaseWithEvents;
  onOpenCase: (caseId: string, caseType: 'private' | 'business' | 'contract') => void;
  onMarkResolved?: (caseId: string, caseType: 'private' | 'business' | 'contract') => void;
  isArchiveView?: boolean; // Om true, visa inte "Markera löst"-knappen
}

// Händelsetyp till ikon
const eventTypeIcons: Record<CaseEventType, React.ReactNode> = {
  mention: <AtSign className="w-3.5 h-3.5" />,
  reply: <MessageCircle className="w-3.5 h-3.5" />,
  comment: <MessageSquare className="w-3.5 h-3.5" />,
  status_change: <Clock className="w-3.5 h-3.5" />,
  assignment: <User className="w-3.5 h-3.5" />
};

// Händelsetyp till färg
const eventTypeColors: Record<CaseEventType, string> = {
  mention: 'text-red-400',
  reply: 'text-amber-400',
  comment: 'text-blue-400',
  status_change: 'text-slate-400',
  assignment: 'text-green-400'
};

// Händelsetyp till bakgrundsfärg för kort
const getCardBorderColor = (caseData: CaseWithEvents): string => {
  // Röd: Obesvarade frågor TILL mig (jag behöver svara)
  if (caseData.unanswered_mentions > 0) {
    return 'border-l-red-500 bg-red-500/5';
  }

  // Amber: Jag har ställt frågor och väntar på svar
  // Visas så länge det finns NÅGON som inte svarat ännu
  const hasPendingOutgoing = caseData.outgoing_questions_total > 0 &&
    caseData.outgoing_questions_answered < caseData.outgoing_questions_total;
  if (hasPendingOutgoing) {
    return 'border-l-amber-500 bg-amber-500/5';
  }

  // Grön-ish: Alla har svarat på mina frågor (kan markeras som löst)
  if (caseData.outgoing_questions_total > 0 &&
      caseData.outgoing_questions_answered === caseData.outgoing_questions_total) {
    return 'border-l-green-500 bg-green-500/5';
  }

  // Blå: Ny aktivitet
  if (caseData.new_comments > 0) {
    return 'border-l-blue-500 bg-blue-500/5';
  }

  return 'border-l-slate-600 bg-slate-800/50';
};

// Enskild händelse-rad
const EventItem: React.FC<{ event: CaseEvent }> = ({ event }) => {
  const icon = eventTypeIcons[event.event_type];
  const colorClass = eventTypeColors[event.event_type];

  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-700/50 last:border-0">
      <div className={`mt-0.5 ${colorClass}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{event.actor_name}</span>
          <span className="text-xs text-slate-500">
            {formatDistanceToNow(new Date(event.created_at))}
          </span>
        </div>
        {event.preview && (
          <p className="text-sm text-slate-400 truncate mt-0.5">
            "{event.preview}"
          </p>
        )}
      </div>
    </div>
  );
};

export default function CaseEventCard({ caseData, onOpenCase, onMarkResolved, isArchiveView = false }: CaseEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Arkiverade ärenden har grön kant
  const borderColorClass = isArchiveView
    ? 'border-l-green-500 bg-green-500/5'
    : getCardBorderColor(caseData);
  const isResolved = caseData.status === 'resolved';
  const CaseIcon = caseData.case_type === 'private' ? Home : Building2;

  // Sammanfattning av händelser
  const getSummaryText = (): string => {
    const parts: string[] = [];

    if (caseData.unanswered_mentions > 0) {
      parts.push(`${caseData.unanswered_mentions} obesvarad${caseData.unanswered_mentions > 1 ? 'e' : ''} fråg${caseData.unanswered_mentions > 1 ? 'or' : 'a'} till dig`);
    }

    // Multi-mention: Visa "X av Y har svarat" om det finns utgående frågor
    if (caseData.outgoing_questions_total > 0) {
      const answered = caseData.outgoing_questions_answered;
      const total = caseData.outgoing_questions_total;
      const pendingNames = caseData.outgoing_questions_pending_names || [];

      if (answered === total) {
        // Alla har svarat - anpassa text baserat på antal
        if (total === 1) {
          parts.push('Svar mottaget');
        } else {
          parts.push(`Alla ${total} har svarat`);
        }
      } else if (answered > 0) {
        // Delvis svar
        parts.push(`${answered} av ${total} har svarat`);
      } else {
        // Ingen har svarat
        if (total === 1) {
          parts.push('Väntar på svar');
        } else {
          parts.push(`Väntar på svar från ${total} personer`);
        }
      }

      // Visa vilka som inte svarat (max 3 namn)
      if (pendingNames.length > 0 && pendingNames.length <= 3) {
        parts.push(`Väntar på: ${pendingNames.join(', ')}`);
      } else if (pendingNames.length > 3) {
        parts.push(`Väntar på: ${pendingNames.slice(0, 3).join(', ')} +${pendingNames.length - 3}`);
      }
    }

    if (caseData.new_comments > 0) {
      parts.push(`${caseData.new_comments} ny${caseData.new_comments > 1 ? 'a' : ''} kommentar${caseData.new_comments > 1 ? 'er' : ''}`);
    }

    if (parts.length === 0) {
      return `${caseData.events.length} händelse${caseData.events.length > 1 ? 'r' : ''}`;
    }

    return parts.join(' • ');
  };

  const handleCardClick = () => {
    onOpenCase(caseData.case_id, caseData.case_type);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`rounded-lg border-l-4 border border-slate-700/50 overflow-hidden transition-all ${borderColorClass}`}
    >
      {/* Huvud-innehåll (alltid synligt) */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-700/20 transition-colors"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Vänster: Ärende-info */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Ikon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
              <CaseIcon className="w-5 h-5 text-slate-400" />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-slate-100 truncate">
                  {caseData.case_title}
                </h3>
                <span className="flex-shrink-0 text-xs text-slate-500 capitalize">
                  {caseData.case_type === 'private' ? 'Privat' : 'Företag'}
                </span>
              </div>

              {/* Adress och skadedjur */}
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                {caseData.skadedjur && (
                  <span className="flex items-center gap-1">
                    <Bug className="w-3 h-3 text-red-400" />
                    {caseData.skadedjur}
                  </span>
                )}
                {caseData.adress && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" />
                    {caseData.adress}
                  </span>
                )}
              </div>

              {/* Händelse-sammanfattning */}
              <div className="mt-2 p-2 rounded bg-slate-900/50 border border-slate-700/30">
                <p className="text-xs text-slate-300">
                  {getSummaryText()}
                </p>
                {caseData.events[0] && (
                  <p className="text-xs text-slate-500 mt-1">
                    Senast: {caseData.events[0].actor_name} • {formatDistanceToNow(new Date(caseData.latest_event_at))}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Höger: Status-indikator och expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Visa "Avklarad" badge endast för arkiverade ärenden */}
            {isResolved && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                Avklarad
              </span>
            )}

            {/* Expand-knapp */}
            <button
              onClick={handleExpandClick}
              className="p-1.5 rounded hover:bg-slate-700/50 transition-colors"
              aria-label={isExpanded ? 'Dölj händelser' : 'Visa händelser'}
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanderat innehåll */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50">
          <div className="mt-3">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Senaste händelser
            </h4>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
              {caseData.events.map(event => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          </div>

          {/* Åtgärder */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleCardClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600
                         rounded text-sm text-slate-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Öppna ärende
            </button>

            {/* Visa "Markera löst"-knappen endast för aktiva ärenden (inte arkiv) */}
            {onMarkResolved && !isArchiveView && !isResolved && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkResolved(caseData.case_id, caseData.case_type);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30
                           border border-green-500/30 rounded text-sm text-green-400 transition-colors"
              >
                Markera löst
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
