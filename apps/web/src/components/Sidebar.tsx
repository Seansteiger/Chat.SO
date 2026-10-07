import React, { useState, useEffect } from 'react';
import { UserProfile, UserStatus } from '@chatso/shared';
import { useAuth } from '../hooks/useAuth.js';
import { usePWAInstall } from '../hooks/usePWAInstall.js';
import {
  Search,
  Settings,
  Download,
  CheckCircle2,
  Clock,
  CircleOff,
  User as UserIcon,
  Bell,
  BellOff,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Video,
} from 'lucide-react';
import { NotificationService } from '../services/notifications.js';
import { convex, api as convexApi } from '../convex.js';

interface SidebarProps {
  users: UserProfile[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onOpenProfile: () => void;
  unreadMap?: Record<string, number>;
  lastMessageMap?: Record<
    string,
    { content?: string; attachmentName?: string; createdAt: number }
  >;
  onOpenNotificationsPanel?: () => void;
  unreadNotificationsCount?: number;
  onStartCall?: (user: UserProfile, isVideo: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  users,
  selectedUser,
  onSelectUser,
  onOpenProfile,
  unreadMap = {},
  lastMessageMap = {},
  onOpenNotificationsPanel,
  unreadNotificationsCount = 0,
  onStartCall,
}) => {
  const { user: currentUser, updateProfile } = useAuth();
  const { isInstallable, promptInstall } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'chats' | 'calls'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [notificationPerm, setNotificationPerm] = useState<NotificationPermission>(() =>
    NotificationService.getPermission()
  );

  // Watch real-time call logs from Convex
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.webrtc.getCallLogs, {
        userId: currentUser.id,
      });
      unsub = watch.onUpdate(() => {
        const result = watch.localQueryResult();
        if (Array.isArray(result)) {
          setCallLogs(result);
        }
      });
    } catch (err) {
      console.warn('Call logs watchQuery error:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id]);

  const handleToggleNotifications = async () => {
    const perm = await NotificationService.requestPermission();
    setNotificationPerm(perm);
  };

  const handleStatusChange = async (status: UserStatus) => {
    setIsStatusMenuOpen(false);
    try {
      await updateProfile({ status });
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500';
      case 'BUSY':
        return 'bg-amber-500';
      case 'OFFLINE':
      default:
        return 'bg-slate-500';
    }
  };

  // Filter contacts by search query
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  });

  // Filter call logs by search query
  const filteredCallLogs = callLogs.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = c.peer?.displayName || '';
    const username = c.peer?.username || '';
    return name.toLowerCase().includes(q) || username.toLowerCase().includes(q);
  });

  const totalUnreadChats = Object.values(unreadMap).reduce((acc, curr) => acc + curr, 0);
  const missedCallsCount = callLogs.filter(
    (c) => c.direction === 'incoming' && c.status === 'missed'
  ).length;

  const formatDuration = (secs?: number) => {
    if (!secs || secs <= 0) return '';
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins === 0) return `${remSecs}s`;
    return `${mins}m ${remSecs}s`;
  };

  const formatCallDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const handleCallPeer = (peer: any, isVideo: boolean) => {
    if (!peer?.id) return;
    const foundUser = users.find((u) => u.id === peer.id);
    const targetUser: UserProfile = foundUser || {
      id: peer.id,
      username: peer.username || 'user',
      email: '',
      displayName: peer.displayName || 'User',
      avatarUrl: peer.avatarUrl || null,
      status: peer.status || 'OFFLINE',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    onSelectUser(targetUser);
    if (onStartCall) {
      onStartCall(targetUser, isVideo);
    }
  };

  return (
    <aside className="w-full md:w-80 h-full flex flex-col bg-slate-950/80 border-r border-white/10 shrink-0 select-none">
      {/* Current User Card */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.displayName}
                className="w-10 h-10 rounded-xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${getStatusColor(
                (currentUser?.status as UserStatus) || 'ONLINE'
              )}`}
            />
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-slate-100 truncate">
              {currentUser?.displayName}
            </h3>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                <span className="capitalize">{currentUser?.status?.toLowerCase()}</span>
                <span className="text-[10px]">▼</span>
              </button>

              {/* Status Picker Popover */}
              {isStatusMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-32 py-1 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50">
                  <button
                    type="button"
                    onClick={() => handleStatusChange('ONLINE')}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-800 flex items-center gap-2 text-slate-200"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Online
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('BUSY')}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-800 flex items-center gap-2 text-slate-200"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Busy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('OFFLINE')}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-800 flex items-center gap-2 text-slate-200"
                  >
                    <CircleOff className="w-3.5 h-3.5 text-slate-400" />
                    Invisible
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions: Notifications, PWA Install & Profile Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onOpenNotificationsPanel) {
                onOpenNotificationsPanel();
              } else {
                handleToggleNotifications();
              }
            }}
            title="Notifications Panel"
            className={`p-2 rounded-xl border transition-all relative ${
              unreadNotificationsCount > 0
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
                : notificationPerm === 'granted'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'hover:bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {notificationPerm === 'granted' ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-slate-950 font-bold text-[9px] flex items-center justify-center shadow-md animate-pulse">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {isInstallable && (
            <button
              type="button"
              onClick={promptInstall}
              title="Install Chat.SO app to desktop"
              className="p-2 rounded-xl bg-gradient-to-r from-blue-600/30 to-indigo-600/30 hover:from-blue-600/50 hover:to-indigo-600/50 border border-blue-500/30 text-blue-400 hover:text-white transition-all text-xs flex items-center gap-1 animate-pulse"
            >
              <Download className="w-4 h-4" />
              <span className="text-[11px] font-semibold hidden sm:inline">Install</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenProfile}
            title="Profile Settings"
            className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tab Switcher: Chats vs Calls */}
      <div className="flex items-center p-1.5 mx-3 mt-3 bg-slate-900/90 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'chats'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chats</span>
          {totalUnreadChats > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-slate-950 font-bold text-[9px] flex items-center justify-center">
              {totalUnreadChats > 99 ? '99+' : totalUnreadChats}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calls')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'calls'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Calls</span>
          {missedCallsCount > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center">
              {missedCallsCount > 9 ? '9+' : missedCallsCount}
            </span>
          )}
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-white/5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'chats' ? 'Search contacts...' : 'Search call logs...'}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Enable Notifications Banner (Prompt if not granted) */}
      {notificationPerm !== 'granted' && (
        <div className="mx-3 my-2 p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-xs text-slate-300 truncate">Enable notifications</p>
          </div>
          <button
            type="button"
            onClick={handleToggleNotifications}
            className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shrink-0 transition-colors shadow-sm shadow-blue-500/20"
          >
            Enable
          </button>
        </div>
      )}

      {/* Content Area: Chats List OR Calls History */}
      {activeTab === 'chats' ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-500">
              <UserIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No contacts found</p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              const unreadCount = unreadMap[u.id] || 0;
              const lastMsg = lastMessageMap[u.id];
              const hasUnread = unreadCount > 0;

              const formatTime = (ts?: number) => {
                if (!ts) return null;
                const d = new Date(ts);
                const now = new Date();
                if (d.toDateString() === now.toDateString()) {
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
              };

              const formattedTime = formatTime(lastMsg?.createdAt);

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectUser(u)}
                  className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-left transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                      : hasUnread
                      ? 'bg-slate-900/60 border border-emerald-500/20 hover:bg-slate-900/90 text-slate-100'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="relative shrink-0">
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt={u.displayName}
                        className="w-10 h-10 rounded-xl object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-slate-300">
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${getStatusColor(
                        u.status as UserStatus
                      )}`}
                    />
                    {hasUnread && (
                      <span className="absolute -inset-0.5 rounded-xl border border-emerald-500/60 pointer-events-none animate-pulse" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs truncate ${
                          hasUnread ? 'font-bold text-white' : 'font-medium text-slate-200'
                        }`}
                      >
                        {u.displayName}
                      </span>
                      <span
                        className={`text-[10px] tabular-numbers shrink-0 ${
                          hasUnread
                            ? 'text-emerald-400 font-semibold'
                            : 'text-slate-500 capitalize'
                        }`}
                      >
                        {formattedTime || u.status.toLowerCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 mt-0.5">
                      <p
                        className={`text-[11px] truncate flex-1 ${
                          hasUnread ? 'text-slate-100 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {lastMsg?.content ||
                          (lastMsg?.attachmentName ? `📎 ${lastMsg.attachmentName}` : `@${u.username}`)}
                      </p>

                      {/* WhatsApp-style unread counter badge */}
                      {hasUnread && (
                        <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/40 animate-in zoom-in-75">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : (
        /* Calls History Tab */
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {filteredCallLogs.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-500">
              <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium text-slate-400">No call history yet</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Audio and video calls with your contacts will appear here.
              </p>
            </div>
          ) : (
            filteredCallLogs.map((call) => {
              const isIncoming = call.direction === 'incoming';
              const isMissed = call.status === 'missed';
              const isDeclined = call.status === 'declined';
              const isOngoing = call.status === 'ongoing';

              return (
                <div
                  key={call.id}
                  onClick={() => handleCallPeer(call.peer, call.isVideo)}
                  className="w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-all hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5 group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      {call.peer?.avatarUrl ? (
                        <img
                          src={call.peer.avatarUrl}
                          alt={call.peer.displayName}
                          className="w-10 h-10 rounded-xl object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-slate-300">
                          {call.peer?.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-semibold truncate ${
                            isMissed ? 'text-rose-400' : 'text-slate-200'
                          }`}
                        >
                          {call.peer?.displayName || 'User'}
                        </span>
                        <span className="text-[10px] text-slate-500 tabular-numbers shrink-0">
                          {formatCallDate(call.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                        {isIncoming ? (
                          isMissed ? (
                            <div className="flex items-center gap-1 text-rose-400 font-medium">
                              <PhoneMissed className="w-3.5 h-3.5 shrink-0" />
                              <span>Missed call</span>
                            </div>
                          ) : isDeclined ? (
                            <div className="flex items-center gap-1 text-slate-400">
                              <PhoneOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>Declined</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-emerald-400">
                              <PhoneIncoming className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-slate-400">
                                Incoming {call.duration > 0 ? `(${formatDuration(call.duration)})` : ''}
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-1 text-blue-400">
                            <PhoneOutgoing className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-slate-400">
                              Outgoing {call.duration > 0 ? `(${formatDuration(call.duration)})` : isDeclined ? '(Declined)' : '(Unanswered)'}
                            </span>
                          </div>
                        )}

                        {isOngoing && (
                          <span className="text-emerald-400 animate-pulse font-medium ml-1">
                            • Live
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 1-Tap Redial Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCallPeer(call.peer, call.isVideo);
                    }}
                    title={call.isVideo ? 'Start video call' : 'Start audio call'}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-400 border border-white/10 transition-all shrink-0 active:scale-95 group-hover:border-blue-500/30"
                  >
                    {call.isVideo ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
};
