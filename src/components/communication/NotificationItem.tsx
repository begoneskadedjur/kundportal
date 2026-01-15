// src/components/communication/NotificationItem.tsx
// Enskild notifikation i listan

import React from 'react';
import { Notification, formatCommentTime } from '../../types/communication';
import { AtSign, FileText, Clock, X, Check } from 'lucide-react';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: Notification) => void;
  compact?: boolean;
}

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClick,
  compact = false,
}: NotificationItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    onClick(notification);
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkAsRead(notification.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification.id);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group relative cursor-pointer transition-colors
        ${notification.is_read
          ? 'bg-transparent hover:bg-slate-800/50'
          : 'bg-slate-700/50 hover:bg-slate-700/70'
        }
        ${compact ? 'p-3' : 'p-4'}
        ${!notification.is_read ? 'border-l-2 border-[#20c58f]' : ''}
      `}
    >
      <div className="flex gap-3">
        {/* Ikon */}
        <div className={`
          flex-shrink-0 rounded-full flex items-center justify-center
          ${compact ? 'w-8 h-8' : 'w-10 h-10'}
          ${notification.is_read ? 'bg-slate-700' : 'bg-[#20c58f]/20'}
        `}>
          <AtSign className={`
            ${compact ? 'w-4 h-4' : 'w-5 h-5'}
            ${notification.is_read ? 'text-slate-400' : 'text-[#20c58f]'}
          `} />
        </div>

        {/* Innehåll */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`
              font-medium truncate
              ${notification.is_read ? 'text-slate-300' : 'text-white'}
              ${compact ? 'text-sm' : ''}
            `}>
              {notification.sender_name}
            </span>
            <span className="text-slate-500 text-xs truncate">
              {notification.title.replace(notification.sender_name, '').trim()}
            </span>
          </div>

          {/* Ärenderubrik */}
          {notification.case_title && (
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <span className="text-xs text-slate-400 truncate">
                {notification.case_title}
              </span>
            </div>
          )}

          {/* Preview */}
          <p className={`
            text-slate-400 truncate
            ${compact ? 'text-xs' : 'text-sm'}
          `}>
            {notification.preview}
          </p>

          {/* Tid */}
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="w-3 h-3 text-slate-600" />
            <span className="text-xs text-slate-500">
              {formatCommentTime(notification.created_at)}
            </span>
          </div>
        </div>

        {/* Åtgärder */}
        <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!notification.is_read && (
            <button
              onClick={handleMarkRead}
              className="p-1.5 text-slate-400 hover:text-[#20c58f] hover:bg-slate-700 rounded transition-colors"
              title="Markera som läst"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
            title="Ta bort"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Oläst-indikator (dot) */}
      {!notification.is_read && (
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1.5 h-1.5 bg-[#20c58f] rounded-full" />
      )}
    </div>
  );
}
