'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Share2,
  Users,
  Globe,
  Lock,
  ShieldAlert,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiDismissNotification,
} from '@/lib/api';
import { NotificationRecord } from '@envbook/shared';
import { useRealTimeEvents } from '@/lib/socket';

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiGetNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Non-fatal if unauthenticated or offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  // Listen for real-time notifications via WebSockets
  useRealTimeEvents({
    onNotification: (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    },
  });

  // Click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await apiMarkNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiDismissNotification(id);
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Ignore
    }
  };

  const handleNotificationClick = async (notif: NotificationRecord) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.pageId) {
      router.push(`/app/page/${notif.pageId}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'share_invite':
        return <Users className="w-3.5 h-3.5 text-primary shrink-0" />;
      case 'permission_change':
        return <Share2 className="w-3.5 h-3.5 text-primary shrink-0" />;
      case 'access_revoked':
        return <Lock className="w-3.5 h-3.5 text-destructive shrink-0" />;
      case 'page_published':
      case 'page_unpublished':
        return <Globe className="w-3.5 h-3.5 text-primary shrink-0" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-primary shrink-0" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-muted text-text-muted hover:text-text-primary transition-colors"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-mono font-bold text-primary-fg shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface-elevated border border-border-muted rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col font-sans animate-fade-in text-xs">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-panel/80">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-mono font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle/40">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-[11px] font-mono">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-[11px] flex flex-col items-center gap-2">
                <Bell className="w-5 h-5 text-border-muted" />
                <span>No notifications right now</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`group flex items-start gap-3 p-3.5 hover:bg-surface-raised cursor-pointer transition-colors ${
                    !n.isRead ? 'bg-surface-subtle/80' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-surface-panel border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-text-primary truncate text-[11px]">
                        {n.pageTitle || 'Workspace Note'}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0 font-mono">
                        {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-text-secondary leading-snug line-clamp-2 mb-1">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                      <span className="text-primary font-mono font-medium">@{n.actorName}</span>
                      {!n.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary ml-auto" />
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    title="Dismiss"
                    onClick={(e) => handleDismiss(n.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-panel transition-all shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
