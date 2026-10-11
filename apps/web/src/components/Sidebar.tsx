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
  MessageSquarePlus,
  Globe,
  X,
} from 'lucide-react';
import { NotificationService } from '../services/notifications.js';
import { convex, api as convexApi } from '../convex.js';
import { api } from '../services/api.js';

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

  // Global Directory Search State (inline in search bar)
  const [directoryResults, setDirectoryResults] = useState<UserProfile[]>([]);
  const [isSearchingDirectory, setIsSearchingDirectory] = useState(false);

  // "Start New Chat" Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState('');
  const [newChatResults, setNewChatResults] = useState<UserProfile[]>([]);
  const [isSearchingNewChat, setIsSearchingNewChat] = useState(false);

  // Debounced directory search in sidebar
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2 || activeTab !== 'chats') {
      setDirectoryResults([]);
      setIsSearchingDirectory(false);
      return;
    }

    setIsSearchingDirectory(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchUsers(q);
        const contactedIds = new Set(users.map((u) => u.id));
        // Exclude users already in the contacted list to prevent duplication
        setDirectoryResults(res.users.filter((u) => !contactedIds.has(u.id)));
      } catch (err) {
        console.error('[Sidebar] Failed to search directory:', err);
      } finally {
        setIsSearchingDirectory(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, users]);

  // Debounced search inside the New Chat modal
  useEffect(() => {
    const q = newChatQuery.trim();
    if (q.length < 2) {
      setNewChatResults([]);
      setIsSearchingNewChat(false);
      return;
    }

    setIsSearchingNewChat(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchUsers(q);
        setNewChatResults(res.users);
      } catch (err) {
        console.error('[Sidebar] Failed to search in modal:', err);
      } finally {
        setIsSearchingNewChat(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [newChatQuery]);

  const handleTabChange = (tab: 'chats' | 'calls') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === 'calls') {
      window.history.pushState({ tab: 'calls' }, '', '#calls');
    } else {
      if (window.location.hash === '#calls') {
        window.history.back();
      }
    }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (activeTab === 'calls' && event.state?.tab !== 'calls') {
        setActiveTab('chats');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

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

  // Filter contacted chats by search query (matching name, username, email, phone)
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const cleanDigits = q.replace(/\D/g, '');
    const phoneDigits = (u.phoneNumber || '').replace(/\D/g, '');
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (cleanDigits.length >= 4 && phoneDigits.includes(cleanDigits))
    );
  });

  const renderContactItem = (u: UserProfile) => {
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
        onClick={() => {
          onSelectUser(u);
          if (searchQuery) setSearchQuery('');
        }}
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
  };

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

        {/* Actions: Start New Chat, Notifications, PWA Install & Profile Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsNewChatModalOpen(true)}
            title="Start New Chat"
            className="p-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 hover:text-white transition-all text-xs flex items-center justify-center shadow-sm"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>

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
          onClick={() => handleTabChange('chats')}
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
          onClick={() => handleTabChange('calls')}
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
            placeholder={
              activeTab === 'chats'
                ? 'Search chats or find by @user, email, phone...'
                : 'Search call logs...'
            }
            className="w-full pl-9 pr-8 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
          {searchQuery.trim().length > 0 ? (
            /* Search Mode: Contacted Matches + Directory Matches */
            <>
              {/* Contacted Chats Matching Search */}
              {filteredUsers.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Recent Chats ({filteredUsers.length})
                  </div>
                  {filteredUsers.map(renderContactItem)}
                </div>
              )}

              {/* Global Directory Matches */}
              {directoryResults.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <div className="px-2 py-1 text-[11px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Global Directory ({directoryResults.length})</span>
                  </div>
                  {directoryResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        onSelectUser(u);
                        setSearchQuery('');
                      }}
                      className="w-full p-2.5 my-1 rounded-xl bg-slate-900/50 hover:bg-blue-600/15 border border-white/5 hover:border-blue-500/30 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.displayName}
                              className="w-10 h-10 rounded-xl object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                              {u.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${getStatusColor(
                              u.status as UserStatus
                            )}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                            {u.displayName}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                            <span>@{u.username}</span>
                            {u.phoneNumber && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400">{u.phoneNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold shrink-0 transition-colors shadow-sm shadow-blue-500/20"
                      >
                        Message
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Loading Indicator */}
              {isSearchingDirectory && (
                <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <span>Searching directory...</span>
                </div>
              )}

              {/* No Results at all */}
              {filteredUsers.length === 0 && directoryResults.length === 0 && !isSearchingDirectory && (
                <div className="text-center py-12 px-4 text-slate-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30 text-blue-400" />
                  <p className="text-xs text-slate-300 font-medium">No users found for &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                    Try searching for their exact @username, full email address, or cellphone number.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Normal Mode: When not searching */
            users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/10">
                  <MessageSquarePlus className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">No Conversations Yet</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mb-4">
                  Chat.SO keeps your directory private. Search for friends by username, email, or cellphone number to start chatting.
                </p>
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Start New Chat</span>
                </button>
              </div>
            ) : (
              users.map(renderContactItem)
            )
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

      {/* Start New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl glass-panel border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <MessageSquarePlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Start New Chat</h3>
                  <p className="text-[11px] text-slate-400">Search by username, email, or cellphone</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsNewChatModalOpen(false);
                  setNewChatQuery('');
                  setNewChatResults([]);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input Box */}
            <div className="p-4 border-b border-white/5 bg-slate-900/40">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  value={newChatQuery}
                  onChange={(e) => setNewChatQuery(e.target.value)}
                  placeholder="Enter @username, email, or cellphone..."
                  className="w-full pl-9 pr-9 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {newChatQuery && (
                  <button
                    type="button"
                    onClick={() => setNewChatQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Suggestions / Guide Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2.5 text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                  @username
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                  user@email.com
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                  +27... cellphone
                </span>
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[160px]">
              {isSearchingNewChat ? (
                <div className="flex items-center justify-center py-12 text-xs text-slate-400 gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <span>Searching directory...</span>
                </div>
              ) : newChatQuery.trim().length >= 2 ? (
                newChatResults.length === 0 ? (
                  <div className="text-center py-10 px-4 text-slate-500">
                    <UserIcon className="w-8 h-8 mx-auto mb-2 opacity-30 text-blue-400" />
                    <p className="text-xs text-slate-300 font-medium">No users found</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                      Could not find anyone matching &ldquo;{newChatQuery}&rdquo;. Check the username, email, or cellphone number and try again.
                    </p>
                  </div>
                ) : (
                  newChatResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        onSelectUser(u);
                        setIsNewChatModalOpen(false);
                        setNewChatQuery('');
                        setNewChatResults([]);
                      }}
                      className="p-3 rounded-xl bg-slate-900/60 hover:bg-blue-600/15 border border-white/10 hover:border-blue-500/30 cursor-pointer flex items-center justify-between gap-3 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.displayName}
                              className="w-10 h-10 rounded-xl object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                              {u.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${getStatusColor(
                              u.status as UserStatus
                            )}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                            {u.displayName}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                            <span>@{u.username}</span>
                            {u.phoneNumber && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400">{u.phoneNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shrink-0 transition-colors shadow-sm shadow-blue-500/20"
                      >
                        Message
                      </button>
                    </div>
                  ))
                )
              ) : (
                <div className="text-center py-10 px-4 text-slate-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs text-slate-400">Search for anyone on Chat.SO</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter at least 2 characters to find contacts by username, email, or cellphone number.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
