// src/components/communication/NotificationCenter.tsx
// Dashboard-kort för notifikationer

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import { Notification } from '../../types/communication';
import NotificationItem from './NotificationItem';
import {
  Bell,
  CheckCheck,
  Loader2,
  Inbox,
  ArrowRight,
} from 'lucide-react';

interface NotificationCenterProps {
  maxItems?: number;
  showViewAll?: boolean;
  onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationCenter({
  maxItems = 5,
  showViewAll = true,
  onNotificationClick,
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotifications();

  const displayedNotifications = notifications.slice(0, maxItems);

  const handleNotificationClick = (notification: Notification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    } else {
      // Navigera till rätt sida baserat på användarens portal
      const pathname = window.location.pathname;

      if (pathname.includes('/technician')) {
        // Tekniker: gå till schema-sidan och öppna ärendet där
        navigate(`/technician/schedule?openCase=${notification.case_id}&caseType=${notification.case_type}`);
      } else if (pathname.includes('/admin')) {
        // Admin: gå till ärendesökning
        navigate(`/admin/case-search?openCase=${notification.case_id}&caseType=${notification.case_type}`);
      } else if (pathname.includes('/coordinator')) {
        // Koordinator: gå till ärendesökning
        navigate(`/coordinator/case-search?openCase=${notification.case_id}&caseType=${notification.case_type}`);
      } else {
        // Fallback
        navigate(`/technician/schedule?openCase=${notification.case_id}&caseType=${notification.case_type}`);
      }
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-purple-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-white">Notifikationer</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
              {unreadCount} nya
            </span>
          )}
        </div>

        {/* Markera alla som lästa */}
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Markera alla som lästa
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="divide-y divide-slate-700/50">
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
            />
          ))
        )}
      </div>

      {/* Footer */}
      {showViewAll && notifications.length > maxItems && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
          <button
            onClick={() => {
              // TODO: Implementera fullständig notifikationssida eller modal
              console.log('View all notifications');
            }}
            className="w-full text-center text-sm text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
          >
            Visa alla notifikationer
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
