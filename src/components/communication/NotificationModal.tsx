// src/components/communication/NotificationModal.tsx
// Fullscreen modal för att visa alla notifikationer med filtrering och sökning

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import { Notification } from '../../types/communication';
import NotificationItem from './NotificationItem';
import {
  X,
  Bell,
  CheckCheck,
  Loader2,
  Inbox,
  Search,
  Filter,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

type FilterType = 'all' | 'unread' | 'read';

export default function NotificationModal({
  isOpen,
  onClose,
  onNotificationClick,
}: NotificationModalProps) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    error,
    loadMore,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh,
  } = useNotifications();

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Filtrera notifikationer
  const filteredNotifications = notifications.filter((notification) => {
    // Filter på läst/oläst
    if (filter === 'unread' && notification.is_read) return false;
    if (filter === 'read' && !notification.is_read) return false;

    // Sök i titel, preview och ärendetitel
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = notification.title.toLowerCase().includes(query);
      const matchesPreview = notification.preview.toLowerCase().includes(query);
      const matchesCaseTitle = notification.case_title?.toLowerCase().includes(query);
      const matchesSender = notification.sender_name.toLowerCase().includes(query);

      if (!matchesTitle && !matchesPreview && !matchesCaseTitle && !matchesSender) {
        return false;
      }
    }

    return true;
  });

  // Infinite scroll observer
  useEffect(() => {
    if (!isOpen) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isOpen, hasMore, isLoading, loadMore]);

  // Stäng vid Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Förhindra scroll på body
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleNotificationClick = useCallback((notification: Notification) => {
    onClose();
    if (onNotificationClick) {
      onNotificationClick(notification);
    } else {
      // Navigera till rätt sida baserat på användarens portal
      const pathname = window.location.pathname;

      if (pathname.includes('/technician')) {
        navigate(`/technician/schedule?openCase=${notification.case_id}&caseType=${notification.case_type}`);
      } else if (pathname.includes('/admin')) {
        navigate(`/admin/case-search?openCase=${notification.case_id}&caseType=${notification.case_type}`);
      } else if (pathname.includes('/coordinator')) {
        navigate(`/coordinator/case-search?openCase=${notification.case_id}&caseType=${notification.case_type}`);
      } else {
        navigate(`/technician/schedule?openCase=${notification.case_id}&caseType=${notification.case_type}`);
      }
    }
  }, [navigate, onClose, onNotificationClick]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="w-6 h-6 text-purple-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold text-white">Alla notifikationer</h2>
              <span className="text-sm text-slate-400">
                ({notifications.length} totalt)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  Markera alla som lästa
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sök och filter */}
          <div className="flex gap-3">
            {/* Sökfält */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Sök i notifikationer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Filter-knappar */}
            <div className="flex bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                Alla
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-2 text-sm font-medium transition-colors border-l border-slate-600 ${
                  filter === 'unread'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                Olästa ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('read')}
                className={`px-3 py-2 text-sm font-medium transition-colors border-l border-slate-600 ${
                  filter === 'read'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                Lästa
              </button>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && notifications.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-3" />
              <p className="text-slate-500">Laddar notifikationer...</p>
            </div>
          ) : error && notifications.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
              <p className="text-red-400 font-medium mb-1">Kunde inte ladda notifikationer</p>
              <p className="text-slate-500 text-sm mb-4">{error}</p>
              <button
                onClick={() => refresh()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Försök igen
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <Inbox className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-500 font-medium mb-1">
                {searchQuery
                  ? 'Inga notifikationer matchar sökningen'
                  : filter === 'unread'
                  ? 'Inga olästa notifikationer'
                  : filter === 'read'
                  ? 'Inga lästa notifikationer'
                  : 'Inga notifikationer'}
              </p>
              <p className="text-slate-600 text-sm">
                {searchQuery
                  ? 'Prova ett annat sökord'
                  : 'Du får notifikationer när någon @nämner dig'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={removeNotification}
                  onClick={handleNotificationClick}
                />
              ))}

              {/* Infinite scroll trigger */}
              {hasMore && !searchQuery && filter === 'all' && (
                <div
                  ref={loadMoreRef}
                  className="p-4 flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  ) : (
                    <button
                      onClick={loadMore}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      Ladda fler...
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer med statistik */}
        {notifications.length > 0 && (
          <div className="flex-shrink-0 px-6 py-3 border-t border-slate-700 bg-slate-800/30">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Visar {filteredNotifications.length} av {notifications.length} notifikationer
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Rensa sökning
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
