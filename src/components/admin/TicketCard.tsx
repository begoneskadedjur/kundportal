// src/components/admin/TicketCard.tsx
// Ticket-kort för ticket-centrerad notifikationsvy
// En ticket = en root-kommentar med alla sina svar

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AtSign,
  MessageCircle,
  ExternalLink,
  Home,
  Building2,
  FileText,
  MapPin,
  Clock,
  Bug,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import type { Ticket, CaseComment } from '../../types/communication';
import { formatDistanceToNow } from '../../utils/dateUtils';

interface TicketCardProps {
  ticket: Ticket;
  onOpenCase: (caseId: string, caseType: 'private' | 'business' | 'contract') => void;
  onResolveTicket?: (ticketId: string) => void;
  onReopenTicket?: (ticketId: string) => void;
  isArchiveView?: boolean;
}

// Bestäm kantfärg baserat på ticket-status
const getCardBorderColor = (ticket: Ticket, isArchiveView: boolean): string => {
  if (isArchiveView) {
    return 'border-l-green-500 bg-green-500/5';
  }

  // Röd: Obesvarade frågor TILL mig (jag behöver svara)
  if (ticket.unanswered_mentions > 0) {
    return 'border-l-red-500 bg-red-500/5';
  }

  // Orange: Olästa svar på MINA kommentarer (utan @mention)
  if (ticket.replies_to_my_comments > 0) {
    return 'border-l-orange-500 bg-orange-500/5';
  }

  // Amber: Jag har ställt frågor och väntar på svar
  const hasPendingOutgoing = ticket.outgoing_questions_total > 0 &&
    ticket.outgoing_questions_answered < ticket.outgoing_questions_total;
  if (hasPendingOutgoing) {
    return 'border-l-amber-500 bg-amber-500/5';
  }

  // Grön-ish: Alla har svarat på mina frågor
  if (ticket.outgoing_questions_total > 0 &&
      ticket.outgoing_questions_answered === ticket.outgoing_questions_total) {
    return 'border-l-green-500 bg-green-500/5';
  }

  // Blå: Olästa kommentarer
  if (ticket.unread_count > 0) {
    return 'border-l-blue-500 bg-blue-500/5';
  }

  return 'border-l-slate-600 bg-slate-800/50';
};

// Kommentar-rad
const CommentItem: React.FC<{ comment: CaseComment; isRoot?: boolean }> = ({ comment, isRoot }) => {
  const hasMentions = comment.mentioned_user_ids && comment.mentioned_user_ids.length > 0;

  return (
    <div className={`py-2 ${!isRoot ? 'pl-4 border-l-2 border-slate-700/50' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-200">{comment.author_name}</span>
        {hasMentions && (
          <AtSign className="w-3 h-3 text-red-400" />
        )}
        <span className="text-xs text-slate-500">
          {formatDistanceToNow(new Date(comment.created_at))}
        </span>
      </div>
      <p className="text-sm text-slate-400 mt-0.5 whitespace-pre-wrap">
        {comment.content.length > 200
          ? comment.content.substring(0, 200) + '...'
          : comment.content}
      </p>
      {hasMentions && comment.mentioned_user_names && comment.mentioned_user_names.length > 0 && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {comment.mentioned_user_names.map((name, i) => (
            <span
              key={i}
              className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-300"
            >
              @{name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default function TicketCard({
  ticket,
  onOpenCase,
  onResolveTicket,
  onReopenTicket,
  isArchiveView = false
}: TicketCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const borderColorClass = getCardBorderColor(ticket, isArchiveView);
  const isResolved = ticket.status === 'resolved';

  // Välj ikon baserat på ärendetyp
  const CaseIcon = ticket.case_type === 'private'
    ? Home
    : ticket.case_type === 'business'
      ? Building2
      : FileText;

  // Sammanfattningstext
  const getSummaryText = (): string => {
    const parts: string[] = [];

    if (ticket.unanswered_mentions > 0) {
      parts.push(`${ticket.unanswered_mentions} obesvarad fråga till dig`);
    }

    if (ticket.outgoing_questions_total > 0) {
      const answered = ticket.outgoing_questions_answered;
      const total = ticket.outgoing_questions_total;
      const pendingNames = ticket.outgoing_questions_pending_names || [];

      if (answered === total) {
        parts.push(total === 1 ? 'Svar mottaget' : `Alla ${total} har svarat`);
      } else if (answered > 0) {
        parts.push(`${answered} av ${total} har svarat`);
      } else {
        parts.push(total === 1 ? 'Väntar på svar' : `Väntar på ${total} svar`);
      }

      if (pendingNames.length > 0 && pendingNames.length <= 3) {
        parts.push(`Väntar på: ${pendingNames.join(', ')}`);
      } else if (pendingNames.length > 3) {
        parts.push(`Väntar på: ${pendingNames.slice(0, 3).join(', ')} +${pendingNames.length - 3}`);
      }
    }

    if (ticket.unread_count > 0 && parts.length === 0) {
      parts.push(`${ticket.unread_count} oläst${ticket.unread_count > 1 ? 'a' : ''}`);
    }

    if (parts.length === 0) {
      const replyCount = ticket.reply_count;
      return replyCount > 0
        ? `${replyCount} svar`
        : 'Ingen aktivitet';
    }

    return parts.join(' • ');
  };

  const handleCardClick = () => {
    onOpenCase(ticket.case_id, ticket.case_type);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`rounded-lg border-l-4 border border-slate-700/50 overflow-hidden transition-all ${borderColorClass}`}
    >
      {/* Huvud-innehåll */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-700/20 transition-colors"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Vänster: Ticket-info */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Ikon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
              <CaseIcon className="w-5 h-5 text-slate-400" />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              {/* Ärende-titel och typ */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-slate-100 truncate">
                  {ticket.case_title}
                </h3>
                <span className="flex-shrink-0 text-xs text-slate-500 capitalize">
                  {ticket.case_type === 'private' ? 'Privat' :
                   ticket.case_type === 'business' ? 'Företag' : 'Avtal'}
                </span>
              </div>

              {/* Adress och skadedjur */}
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                {ticket.skadedjur && (
                  <span className="flex items-center gap-1">
                    <Bug className="w-3 h-3 text-red-400" />
                    {ticket.skadedjur}
                  </span>
                )}
                {ticket.adress && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" />
                    {ticket.adress}
                  </span>
                )}
              </div>

              {/* Ticket-innehåll (root-kommentar preview) */}
              <div className="mt-2 p-2 rounded bg-slate-900/50 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-300">
                    {ticket.root_comment.author_name}
                  </span>
                  {ticket.root_comment.mentioned_user_names && ticket.root_comment.mentioned_user_names.length > 0 && (
                    <span className="text-xs text-red-400">
                      → @{ticket.root_comment.mentioned_user_names.join(', @')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {ticket.root_comment.content}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(ticket.latest_activity_at))}
                  </span>
                  {ticket.reply_count > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {ticket.reply_count} svar
                    </span>
                  )}
                </div>
              </div>

              {/* Sammanfattning */}
              <p className="text-xs text-slate-300 mt-2">
                {getSummaryText()}
              </p>
            </div>
          </div>

          {/* Höger: Status och expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isResolved && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Löst
              </span>
            )}

            <button
              onClick={handleExpandClick}
              className="p-1.5 rounded hover:bg-slate-700/50 transition-colors"
              aria-label={isExpanded ? 'Dölj innehåll' : 'Visa innehåll'}
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
              Tråd ({1 + ticket.replies.length} {ticket.replies.length === 0 ? 'inlägg' : 'inlägg'})
            </h4>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 space-y-2">
              {/* Root-kommentar */}
              <CommentItem comment={ticket.root_comment} isRoot />

              {/* Svar */}
              {ticket.replies.slice(0, 5).map(reply => (
                <CommentItem key={reply.id} comment={reply} />
              ))}

              {ticket.replies.length > 5 && (
                <p className="text-xs text-slate-500 pl-4">
                  + {ticket.replies.length - 5} fler svar...
                </p>
              )}
            </div>
          </div>

          {/* Åtgärder */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={handleCardClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600
                         rounded text-sm text-slate-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Öppna ärende
            </button>

            {/* Markera löst (endast för aktiva tickets) */}
            {onResolveTicket && !isArchiveView && !isResolved && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolveTicket(ticket.id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30
                           border border-green-500/30 rounded text-sm text-green-400 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Markera löst
              </button>
            )}

            {/* Återöppna (endast för arkiverade tickets) */}
            {onReopenTicket && isArchiveView && isResolved && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReopenTicket(ticket.id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30
                           border border-amber-500/30 rounded text-sm text-amber-400 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Återöppna
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
