// src/components/admin/TicketItem.tsx
// Enskild ticket-komponent

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  User,
  MapPin,
  Clock,
  ChevronDown,
  Building2,
  Home,
  ExternalLink,
  Bug
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Ticket, CommentStatus } from '../../services/communicationService';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface TicketItemProps {
  ticket: Ticket;
  onStatusChange?: (commentId: string, status: CommentStatus) => Promise<boolean>;
}

const STATUS_CONFIG: Record<CommentStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Öppen', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  in_progress: { label: 'Pågår', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  needs_action: { label: 'Kräver åtgärd', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  resolved: { label: 'Avklarad', color: 'text-green-400', bgColor: 'bg-green-500/20' },
};

const STATUS_OPTIONS: CommentStatus[] = ['open', 'in_progress', 'needs_action', 'resolved'];

export function TicketItem({ ticket, onStatusChange }: TicketItemProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const { comment, case_id, case_type, case_title, kontaktperson, adress, skadedjur } = ticket;
  const status = comment.status || 'open';
  const statusConfig = STATUS_CONFIG[status];

  // Kan ändra status: admin, koordinator och tekniker
  const canChangeStatus = profile?.role === 'admin' || profile?.role === 'koordinator' || profile?.role === 'technician';

  const handleStatusChange = async (newStatus: CommentStatus) => {
    if (!onStatusChange || updating) return;

    setUpdating(true);
    setStatusMenuOpen(false);

    const success = await onStatusChange(comment.id, newStatus);
    if (!success) {
      // Visa felmeddelande (hanteras i useTickets)
    }

    setUpdating(false);
  };

  const handleClick = () => {
    // Navigera till schedule-sidan och öppna ärendet med kommunikationsfliken
    const basePath = profile?.role === 'technician'
      ? '/technician/schedule'
      : profile?.role === 'koordinator'
        ? '/koordinator/schema'
        : '/koordinator/schema'; // Admin använder koordinator-schema

    // Öppna ärendet med query params för att öppna rätt case och visa kommunikation
    navigate(`${basePath}?openCase=${case_id}&caseType=${case_type}&tab=communication`);
  };

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: sv,
  });

  // Formattera kommentarstext (ta bort långa texter)
  const truncatedContent = comment.content.length > 200
    ? comment.content.substring(0, 200) + '...'
    : comment.content;

  return (
    <div
      className="bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl
               transition-all cursor-pointer group"
    >
      {/* Header med titel och status */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex items-center gap-3 flex-1 min-w-0" onClick={handleClick}>
          {/* Ikon för ärendetyp */}
          <div className={`
            p-2 rounded-lg flex-shrink-0
            ${case_type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'}
          `}>
            {case_type === 'private'
              ? <Home className="w-5 h-5 text-purple-400" />
              : <Building2 className="w-5 h-5 text-blue-400" />
            }
          </div>

          {/* Titel */}
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-white truncate group-hover:text-purple-300 transition-colors">
              {case_title}
            </h3>
            <span className="text-xs text-slate-500">
              {case_type === 'private' ? 'Privat' : 'Företag'}
            </span>
          </div>
        </div>

        {/* Status-knapp */}
        <div className="relative flex-shrink-0 ml-3">
          {canChangeStatus ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatusMenuOpen(!statusMenuOpen);
              }}
              disabled={updating}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                ${statusConfig.bgColor} ${statusConfig.color}
                hover:opacity-80 transition-opacity
                disabled:opacity-50
              `}
            >
              {updating ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  {statusConfig.label}
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          ) : (
            <span className={`
              px-3 py-1.5 rounded-lg text-sm font-medium
              ${statusConfig.bgColor} ${statusConfig.color}
            `}>
              {statusConfig.label}
            </span>
          )}

          {/* Status dropdown */}
          {statusMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700
                       rounded-lg shadow-xl overflow-hidden z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map((statusOption) => {
                const config = STATUS_CONFIG[statusOption];
                const isActive = statusOption === status;

                return (
                  <button
                    key={statusOption}
                    onClick={() => handleStatusChange(statusOption)}
                    className={`
                      w-full px-4 py-2 text-left text-sm flex items-center gap-2
                      transition-colors
                      ${isActive
                        ? 'bg-slate-700 text-white'
                        : `${config.color} hover:bg-slate-700/50`
                      }
                    `}
                  >
                    <span className={`w-2 h-2 rounded-full ${config.bgColor.replace('/20', '')}`} />
                    {config.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Kommentarsinnehåll */}
      <div className="px-4 pb-3" onClick={handleClick}>
        <p className="text-slate-300 text-sm leading-relaxed">
          "{truncatedContent}"
        </p>
      </div>

      {/* Footer med metadata */}
      <div
        className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-slate-700/30 text-xs text-slate-500"
        onClick={handleClick}
      >
        {/* Författare */}
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          <span>{comment.author_name || 'Okänd'}</span>
        </div>

        {/* Kontaktperson */}
        {kontaktperson && (
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{kontaktperson}</span>
          </div>
        )}

        {/* Skadedjur */}
        {skadedjur && (
          <div className="flex items-center gap-1.5 text-orange-400">
            <Bug className="w-3.5 h-3.5" />
            <span>{skadedjur}</span>
          </div>
        )}

        {/* Adress */}
        {adress && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate max-w-[200px]">{adress}</span>
          </div>
        )}

        {/* Tid */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeAgo}</span>
        </div>

        {/* Extern länk-ikon */}
        <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 transition-colors" />
      </div>
    </div>
  );
}
