import React, { useEffect, useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  BellOff,
} from 'lucide-react';
import { NotificationService, InAppNotification } from '../services/notifications.js';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  permission: NotificationPermission;
  onRequestPermission: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  permission,
  onRequestPermission,
}) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  useEffect(() => {
    const unsub = NotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleClickItem = (notif: InAppNotification) => {
    if (notif.senderId) {
      onSelectUser(notif.senderId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-sm sm:max-w-md h-full bg-slate-950/95 border-l border-white/10 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Notifications Panel
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-slate-950">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">All activity & incoming message alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => NotificationService.markAllAsRead()}
                  title="Mark all as read"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xs"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => NotificationService.clearAll()}
                  title="Clear all"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors text-xs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* System Permission Bar */}
        <div className="p-3 bg-slate-900/40 border-b border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            {permission === 'granted' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>OS notifications panel enabled</span>
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 text-amber-400 shrink-0" />
                <span>OS notifications panel disabled</span>
              </>
            )}
          </div>
          {permission !== 'granted' && (
            <button
              type="button"
              onClick={onRequestPermission}
              className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Enable
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-slate-400">
                <Bell className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-semibold text-slate-300">No notifications yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                When contacts send you messages or initiate calls, alerts will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleClickItem(notif)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  !notif.read
                    ? 'bg-blue-600/10 border-blue-500/30 hover:bg-blue-600/20'
                    : 'bg-slate-900/40 border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold text-xs">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  {!notif.read && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-semibold text-white truncate">
                      {notif.senderName}
                    </h4>
                    <span className="text-[10px] text-slate-500 shrink-0 tabular-numbers">
                      {formatTime(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.content}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-600 self-center shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
