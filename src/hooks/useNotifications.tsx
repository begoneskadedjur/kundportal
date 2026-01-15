// src/hooks/useNotifications.ts
// Hook för att hantera notifikationer

import { useState, useEffect, useCallback } from 'react';
import { Notification } from '../types/communication';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '../services/communicationService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const PAGE_SIZE = 20;

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Hämta notifikationer
  const fetchNotifications = useCallback(async (reset: boolean = false) => {
    if (!user) return;

    try {
      setIsLoading(true);
      // Använd functional update för att undvika dependency på offset
      const currentOffset = reset ? 0 : offset;
      const data = await getNotifications(user.id, PAGE_SIZE, currentOffset);

      if (reset) {
        setNotifications(data);
        setOffset(PAGE_SIZE);
      } else {
        setNotifications(prev => [...prev, ...data]);
        setOffset(prev => prev + PAGE_SIZE);
      }

      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error('Fel vid hämtning av notifikationer:', err);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Medvetet exkluderar offset för att undvika oändlig loop

  // Hämta antal olästa
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    } catch (err) {
      console.error('Fel vid hämtning av olästa notifikationer:', err);
    }
  }, [user]);

  // Initial laddning och realtime subscription
  useEffect(() => {
    if (!user) return;

    fetchNotifications(true);
    fetchUnreadCount();

    const unsubscribe = subscribeToNotifications(user.id, (newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Visa toast-notifikation
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-slate-800 border border-slate-600 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full bg-[#20c58f]/20 flex items-center justify-center">
                  <span className="text-[#20c58f] text-lg">@</span>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">
                  {newNotification.title}
                </p>
                <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                  {newNotification.preview}
                </p>
                {newNotification.case_title && (
                  <p className="mt-1 text-xs text-slate-500">
                    {newNotification.case_title}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex border-l border-slate-700">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-slate-400 hover:text-white focus:outline-none"
            >
              Stäng
            </button>
          </div>
        </div>
      ), {
        duration: 5000,
        position: 'top-right',
      });
    });

    return unsubscribe;
  }, [user, fetchNotifications, fetchUnreadCount]);

  // Ladda fler
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchNotifications(false);
  }, [hasMore, isLoading, fetchNotifications]);

  // Markera som läst
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Fel vid markering av notifikation:', err);
    }
  }, []);

  // Markera alla som lästa
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      await markAllNotificationsAsRead(user.id);
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast.success('Alla notifikationer markerade som lästa');
    } catch (err) {
      console.error('Fel vid markering av alla notifikationer:', err);
      toast.error('Kunde inte markera notifikationer');
    }
  }, [user]);

  // Ta bort notifikation
  const removeNotification = useCallback(async (notificationId: string) => {
    try {
      const notification = notifications.find(n => n.id === notificationId);
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Fel vid borttagning av notifikation:', err);
      toast.error('Kunde inte ta bort notifikation');
    }
  }, [notifications]);

  // Refresh
  const refresh = useCallback(async () => {
    await fetchNotifications(true);
    await fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh,
  };
}
