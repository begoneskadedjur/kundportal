// src/components/admin/TicketItem.tsx
// Enskild ticket-komponent med direction indicator och smooth animations

import { useState, useEffect } from 'react';
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
  Bug,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Ticket, CommentStatus } from '../../services/communicationService';
import type { CaseType } from '../../types/communication';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import type { TicketDirection } from './TicketViewTabs';

interface TicketItemProps {
  ticket: Ticket;
  direction?: TicketDirection;
  currentUserName?: string;
  onStatusChange?: (commentId: string, status: CommentStatus) => Promise<boolean>;
  onOpenCommunication?: (caseId: string, caseType: CaseType, caseTitle: string) => void;
  animationDelay?: number; // Delay i ms för staggered animation
}

const STATUS_CONFIG: Record<CommentStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Öppen', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  resolved: { label: 'Löst', color: 'text-green-400', bgColor: 'bg-green-500/20' },
};

const STATUS_OPTIONS: CommentStatus[] = ['open', 'resolved'];

const DIRECTION_CONFIG = {
  incoming: {
    label: 'Behöver åtgärd',
    shortLabel: 'Inkommande',
    icon: ArrowDownLeft,
    borderClass: 'border-l-4 border-l-amber-500',
    bgClass: 'bg-amber-500/5',
    badgeClass: 'bg-amber-500/20 text-amber-400',
  },
  outgoing: {
    label: 'Väntar på svar',
    shortLabel: 'Utgående',
    icon: ArrowUpRight,
    borderClass: 'border-l-4 border-l-slate-500',
    bgClass: 'bg-slate-800/20',
    badgeClass: 'bg-slate-600/30 text-slate-400',
  },
  all: {
    label: '',
    shortLabel: '',
    icon: null,
    borderClass: '',
    bgClass: '',
    badgeClass: '',
  },
};

export function TicketItem({
  ticket,
  direction = 'all',
  currentUserName,
  onStatusChange,
  onOpenCommunication,
  animationDelay = 0
}: TicketItemProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Smooth fade-in animation med optional delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);
    return () => clearTimeout(timer);
  }, [animationDelay]);

  const { comment, case_id, case_type, case_title, kontaktperson, adress, skadedjur } = ticket;
  const status = comment.status || 'open';
  const statusConfig = STATUS_CONFIG[status];
  const directionConfig = direction !== 'all' ? DIRECTION_CONFIG[direction] : null;

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
    // Om callback finns - öppna kommunikationspanel direkt (slide-over)
    // Detta är bättre UX, särskilt för tekniker som är nämnda men inte tilldelade ärendet
    if (onOpenCommunication) {
      onOpenCommunication(case_id, case_type as CaseType, case_title);
      return;
    }

    // Fallback: Navigera till schedule-sidan och öppna ärendet med kommunikationsfliken
    // Admin och koordinator använder koordinator-schemat, tekniker har sitt eget
    const basePath = profile?.role === 'technician'
      ? '/technician/schedule'
      : '/koordinator/schema';

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

  // Hämta nämnda personer från kommentaren
  const mentionedNames = comment.mentioned_user_names || [];

  return (
    <div
      className={`
        bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl
        cursor-pointer group
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${directionConfig?.borderClass || ''}
        ${directionConfig?.bgClass || ''}
      `}
    >
      {/* Direction badge (om incoming/outgoing) */}
      {directionConfig && directionConfig.label && (
        <div className="px-4 pt-3 pb-1">
          <div className={`
            inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
            ${directionConfig.badgeClass}
          `}>
            {directionConfig.icon && <directionConfig.icon className="w-3 h-3" />}
            {directionConfig.shortLabel}
          </div>
        </div>
      )}

      {/* Header med titel och status */}
      <div className={`flex items-start justify-between p-4 ${directionConfig?.label ? 'pt-2' : ''} pb-2`}>
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
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-t border-slate-700/30 text-xs text-slate-500"
        onClick={handleClick}
      >
        {/* Författare med direction-kontext */}
        {direction === 'incoming' ? (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300">{comment.author_name || 'Okänd'}</span>
            <ArrowRight className="w-3 h-3 text-slate-600" />
            <span className="text-amber-400 font-medium">dig</span>
          </div>
        ) : direction === 'outgoing' ? (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300">Du</span>
            <ArrowRight className="w-3 h-3 text-slate-600" />
            <span className="text-slate-400">
              {mentionedNames.length > 0 ? mentionedNames.slice(0, 2).join(', ') : 'Nämnda'}
              {mentionedNames.length > 2 && ` +${mentionedNames.length - 2}`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span>{comment.author_name || 'Okänd'}</span>
          </div>
        )}

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

        {/* Adress - Dölj på mobil om det blir för trångt */}
        {adress && (
          <div className="hidden sm:flex items-center gap-1.5">
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
