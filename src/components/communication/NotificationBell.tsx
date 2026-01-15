// src/components/communication/NotificationBell.tsx
// Header-klocka med dropdown för snabb access till notifikationer

import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { Notification } from '../../types/communication';
import NotificationItem from './NotificationItem';
import {
  Bell,
  CheckCheck,
  Loader2,
  Inbox,
  ArrowRight,
  X,
} from 'lucide-react';

interface NotificationBellProps {
  onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationBell({
  onNotificationClick,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotifications();

  // Stäng dropdown vid klick utanför
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Stäng dropdown vid Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    setIsOpen(false);
    if (onNotificationClick) {
      onNotificationClick(notification);
    } else {
      // Navigera till rätt sida baserat på användarens portal
      const pathname = window.location.pathname;

      if (pathname.includes('/technician')) {
        // Tekniker: gå till schema-sidan och öppna ärendet där
        window.location.href = `/technician/schedule?openCase=${notification.case_id}&caseType=${notification.case_type}`;
      } else if (pathname.includes('/admin')) {
        // Admin: gå till ärendesökning
        window.location.href = `/admin/case-search?openCase=${notification.case_id}&caseType=${notification.case_type}`;
      } else if (pathname.includes('/coordinator')) {
        // Koordinator: gå till ärendesökning
        window.location.href = `/coordinator/case-search?openCase=${notification.case_id}&caseType=${notification.case_type}`;
      } else {
        // Fallback
        window.location.href = `/technician/schedule?openCase=${notification.case_id}&caseType=${notification.case_type}`;
      }
    }
  };

  const displayedNotifications = notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Klocka */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative p-2 rounded-lg transition-colors
          ${isOpen
            ? 'bg-slate-700 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }
        `}
        aria-label={`Notifikationer${unreadCount > 0 ? ` (${unreadCount} olästa)` : ''}`}
      >
        <Bell className="w-5 h-5" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-white">Notifikationer</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Läs alla
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-700/50">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500">Inga notifikationer</p>
                <p className="text-slate-600 text-xs mt-1">
                  Du får notifikationer när någon @nämner dig
                </p>
              </div>
            ) : (
              displayedNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={removeNotification}
                  onClick={handleNotificationClick}
                  compact
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 5 && (
            <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // TODO: Navigera till notifikationssida
                }}
                className="w-full text-center text-sm text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
              >
                Visa alla ({notifications.length})
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
