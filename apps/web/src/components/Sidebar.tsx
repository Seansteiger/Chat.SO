import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, UserStatus, MAX_FILE_SIZE_BYTES } from '@chatso/shared';
import { useAuth } from '../hooks/useAuth.js';
import { useTheme } from '../hooks/useTheme.js';
import { StatusTicks } from './StatusTicks.js';
import { uploadFileDirectly } from '../services/uploader.js';
import {
  Search,
  Settings,
  CheckCircle2,
  Clock,
  CircleOff,
  BatteryCharging,
  Moon,
  Sun,
  Bookmark,
  Bell,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Video,
  MessageSquarePlus,
  Globe,
  Users,
  ShieldAlert,
  ShieldCheck,
  Plus,
  X,
  ChevronRight,
  Camera,
  Edit3,
  LogOut,
  Laptop,
  Smartphone,
  Trash2,
  Eye,
  Keyboard,
} from 'lucide-react';
import { convex, api as convexApi } from '../convex.js';
import { api } from '../services/api.js';
import { NotificationService } from '../services/notifications.js';
import { CreateCircleModal } from './CreateCircleModal.js';
import { SavedMessagesModal } from './SavedMessagesModal.js';

interface SidebarProps {
  users: UserProfile[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  selectedCircleId?: string | null;
  onSelectCircle?: (circleId: string | null) => void;
  unreadMap?: Record<string, number>;
  lastMessageMap?: Record<
    string,
    { content?: string; attachmentName?: string; createdAt: number; senderId?: string; status?: any }
  >;
  onOpenNotificationsPanel?: () => void;
  unreadNotificationsCount?: number;
  onStartCall?: (user: UserProfile, isVideo: boolean) => void;
  activeTab?: 'chats' | 'circles' | 'requests' | 'calls' | 'settings';
  onTabChange?: (tab: 'chats' | 'circles' | 'requests' | 'calls' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  users,
  selectedUser,
  onSelectUser,
  selectedCircleId,
  onSelectCircle,
  unreadMap = {},
  lastMessageMap = {},
  onOpenNotificationsPanel,
  unreadNotificationsCount = 0,
  onStartCall,
  activeTab: controlledActiveTab,
  onTabChange,
}) => {
  const { user: currentUser, updateProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [internalTab, setInternalTab] = useState<'chats' | 'circles' | 'requests' | 'calls' | 'settings'>('chats');
  
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;
  const setActiveTab = (tab: 'chats' | 'circles' | 'requests' | 'calls' | 'settings') => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  // Telegram Settings State
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(currentUser?.displayName || '');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phoneNumber || '');
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    if (currentUser) {
      setEditDisplayName(currentUser.displayName || '');
      setEditBio(currentUser.bio || '');
      setEditPhone(currentUser.phoneNumber || '');
    }
  }, [currentUser]);

  // Watch Active Multi-Device Sessions for Settings
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.users.listActiveSessions, {
        userId: currentUser.id as any,
      });
      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (Array.isArray(res)) setActiveSessions(res);
      });
    } catch (err) {
      console.warn('Sessions watch error:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert('Avatar image exceeds 50MB limit.');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const res = await uploadFileDirectly(file);
      await updateProfile({ avatarUrl: res.publicUrl });
    } catch (err: any) {
      alert(err.message || 'Avatar upload failed');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfileInfo = async () => {
    try {
      await updateProfile({
        displayName: editDisplayName.trim() || currentUser?.displayName,
        bio: editBio.trim(),
        phoneNumber: editPhone.trim() || null,
      });
      setIsEditingProfile(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile info');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await (convex as any).mutation(convexApi.users.revokeSession, {
        sessionId: sessionId as any,
      });
    } catch (err) {
      console.error('Failed to revoke session:', err);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [myCircles, setMyCircles] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isCreateCircleOpen, setIsCreateCircleOpen] = useState(false);
  const [isSavedMessagesOpen, setIsSavedMessagesOpen] = useState(false);

  // Global Directory Search
  const [directoryResults, setDirectoryResults] = useState<UserProfile[]>([]);
  const [isSearchingDirectory, setIsSearchingDirectory] = useState(false);

  // New Chat Modal
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState('');
  const [newChatResults, setNewChatResults] = useState<UserProfile[]>([]);
  const [isSearchingNewChat, setIsSearchingNewChat] = useState(false);

  // Notification Permission Prompt
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const dismissed = sessionStorage.getItem('chatso_notif_banner_dismissed');
        if (!dismissed) setShowNotifPrompt(true);
      }
    }
  }, []);

  // Watch Circles
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.circles.listMyCircles, {
        userId: currentUser.id as any,
      });
      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (Array.isArray(res)) setMyCircles(res);
      });
    } catch (err) {
      console.warn('Circles watch error:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id]);

  // Watch Handshake Requests
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.messages.listPendingRequests, {
        currentUserId: currentUser.id as any,
      });
      unsub = watch.onUpdate(() => {
        const res = watch.localQueryResult();
        if (Array.isArray(res)) setPendingRequests(res);
      });
    } catch (err) {
      console.warn('Pending requests watch error:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id]);

  // Watch Call logs
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.webrtc.getCallLogs, {
        userId: currentUser.id,
      });
      unsub = watch.onUpdate(() => {
        const result = watch.localQueryResult();
        if (Array.isArray(result)) setCallLogs(result);
      });
    } catch (err) {
      console.warn('Call logs watchQuery error:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id]);

  // Debounced search
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
        setDirectoryResults(res.users.filter((u) => !contactedIds.has(u.id)));
      } catch (err) {
        console.error('[Sidebar] Failed to search directory:', err);
      } finally {
        setIsSearchingDirectory(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, users]);

  // Debounced New Chat modal search
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
      case 'LOW_BATTERY':
        return 'bg-amber-400';
      case 'DEEP_FOCUS':
        return 'bg-purple-500';
      case 'BUSY':
        return 'bg-rose-500';
      case 'OFFLINE':
      default:
        return 'bg-slate-400 dark:bg-slate-500';
    }
  };

  const getStatusLabel = (status: UserStatus) => {
    switch (status) {
      case 'ONLINE':
        return 'Open to Chat';
      case 'LOW_BATTERY':
        return 'Low Battery (Async Only)';
      case 'DEEP_FOCUS':
        return 'Deep Focus (Quiet Hours)';
      case 'BUSY':
        return 'Busy';
      case 'OFFLINE':
      default:
        return 'Invisible';
    }
  };

  // Open Personal Vault
  const handleOpenPersonalVault = async () => {
    if (!currentUser) return;
    const vaultUser: UserProfile = {
      id: currentUser.id,
      username: currentUser.username,
      email: currentUser.email,
      displayName: 'My Space (Personal Vault)',
      avatarUrl: currentUser.avatarUrl,
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    onSelectCircle?.(null);
    onSelectUser(vaultUser);
  };

  const totalUnreadChats = Object.values(unreadMap).reduce((acc, curr) => acc + curr, 0);

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const filteredCircles = myCircles.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q));
  });

  const renderContactItem = (u: UserProfile) => {
    const isSelected = selectedUser?.id === u.id && !selectedCircleId;
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
          onSelectCircle?.(null);
          onSelectUser(u);
          if (searchQuery) setSearchQuery('');
        }}
        className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-left transition-all ${
          isSelected
            ? 'dark:bg-indigo-950/40 dark:border-indigo-500/40 dark:text-white bg-white border border-slate-200 border-l-4 border-l-indigo-600 text-slate-900 shadow-sm'
            : hasUnread
            ? 'dark:bg-[#18181b] dark:border-emerald-500/30 bg-emerald-50/50 border border-emerald-200 text-slate-900 dark:text-white'
            : 'dark:hover:bg-white/[0.04] hover:bg-slate-100/90 dark:text-slate-300 text-slate-700 border border-transparent'
        }`}
      >
        <div className="relative shrink-0">
          {u.avatarUrl ? (
            <img
              src={u.avatarUrl}
              alt={u.displayName}
              className="w-10 h-10 rounded-xl object-cover ring-1 dark:ring-white/10 ring-slate-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl dark:bg-indigo-950/50 dark:border-white/10 dark:text-indigo-300 bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">
              {u.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 dark:border-[#121215] border-white ${getStatusColor(
              u.status as UserStatus
            )}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span
              className={`text-xs truncate ${
                hasUnread
                  ? 'font-bold dark:text-white text-slate-950'
                  : 'font-medium dark:text-slate-200 text-slate-800'
              }`}
            >
              {u.displayName}
            </span>
            <span
              className={`text-[10px] tabular-numbers shrink-0 ${
                hasUnread
                  ? 'dark:text-emerald-400 text-emerald-600 font-semibold'
                  : 'dark:text-slate-500 text-slate-400'
              }`}
            >
              {formattedTime || (u.status === 'LOW_BATTERY' ? 'Async' : u.status === 'DEEP_FOCUS' ? 'Focus' : u.status.toLowerCase())}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1.5 mt-0.5">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {lastMsg?.senderId === currentUser?.id && (
                <span className="shrink-0 flex items-center">
                  <StatusTicks status={lastMsg.status} size="sm" />
                </span>
              )}
              <p
                className={`text-[11px] truncate ${
                  hasUnread
                    ? 'dark:text-slate-200 text-slate-900 font-medium'
                    : 'dark:text-slate-400 text-slate-500'
                }`}
              >
                {lastMsg?.content ||
                  (lastMsg?.attachmentName ? `📎 ${lastMsg.attachmentName}` : `@${u.username}`)}
              </p>
            </div>

            {hasUnread && (
              <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <aside className="w-full md:w-80 h-full flex flex-col dark:bg-[#121215] bg-[#fbfbfa] border-r dark:border-white/[0.08] border-slate-200 shrink-0 select-none transition-colors">
      {/* Clean Telegram-style Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b dark:border-white/[0.08] border-slate-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight dark:text-white text-slate-900 capitalize">
            {activeTab === 'chats' ? 'Chats' : activeTab === 'circles' ? 'Circles' : activeTab === 'requests' ? 'Requests' : activeTab === 'calls' ? 'Calls' : 'Settings'}
          </h1>
        </div>

        {activeTab === 'chats' && (
          <button
            type="button"
            onClick={() => setIsNewChatModalOpen(true)}
            title="Start New Chat"
            className="p-2 rounded-xl dark:bg-indigo-600/15 dark:hover:bg-indigo-600/30 dark:border-indigo-500/30 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 transition-all text-xs flex items-center gap-1.5 shadow-xs"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span className="font-semibold text-xs hidden sm:inline">New Chat</span>
          </button>
        )}

        {activeTab === 'circles' && (
          <button
            type="button"
            onClick={() => setIsCreateCircleOpen(true)}
            title="Create Circle"
            className="p-2 rounded-xl dark:bg-purple-600/15 dark:hover:bg-purple-600/30 dark:border-purple-500/30 dark:text-purple-400 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-600 transition-all text-xs flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span className="font-semibold text-xs hidden sm:inline">New Circle</span>
          </button>
        )}
      </div>

      {/* Omnibox Search Input (Only for Chats & Circles) */}
      {(activeTab === 'chats' || activeTab === 'circles') && (
        <div className="p-3 border-b dark:border-white/[0.08] border-slate-200">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'chats'
                  ? 'Search chats or find by @user, email... (⌘K)'
                  : 'Search circles...'
              }
              className="w-full pl-9 pr-12 py-2 dark:bg-[#18181b] bg-white border dark:border-white/10 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 font-mono text-[10px] dark:bg-white/5 bg-slate-100 border dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-500 px-1.5 py-0.5 rounded pointer-events-none">
                ⌘K
              </kbd>
            )}
          </div>
        </div>
      )}

      {/* Notification Permission Banner */}
      {showNotifPrompt && (
        <div className="mx-3 my-2 p-2.5 rounded-xl dark:bg-indigo-950/60 dark:border-indigo-500/30 bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-2 text-xs dark:text-indigo-200 text-indigo-900 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="truncate text-[11px] font-medium">Enable notifications for calls & messages</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={async () => {
                const res = await NotificationService.requestPermission();
                if (res !== 'default') setShowNotifPrompt(false);
              }}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-[11px] transition-colors shadow-sm"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNotifPrompt(false);
                sessionStorage.setItem('chatso_notif_banner_dismissed', '1');
              }}
              className="p-1 dark:text-slate-400 text-slate-500 hover:text-slate-900"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'chats' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {/* Pinned "My Space" Personal Vault Card */}
          <button
            type="button"
            onClick={handleOpenPersonalVault}
            className="w-full p-2.5 mb-1 rounded-xl dark:bg-gradient-to-r dark:from-amber-500/10 dark:to-orange-500/10 dark:hover:from-amber-500/20 dark:hover:to-orange-500/20 dark:border-amber-500/20 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 flex items-center gap-3 text-left transition-all group shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-md">
              <Bookmark className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold dark:text-white text-slate-900 group-hover:text-amber-500">
                  My Space (Personal Vault)
                </span>
                <span className="text-[10px] text-amber-500 font-semibold">Synced</span>
              </div>
              <p className="text-[11px] dark:text-slate-400 text-slate-600 truncate mt-0.5">
                Self-notes, code snippets & cross-device transfer
              </p>
            </div>
          </button>

          {/* Normal Chats list */}
          {filteredUsers.length === 0 && directoryResults.length === 0 ? (
            <div className="text-center py-12 px-4 dark:text-slate-500 text-slate-400">
              <p className="text-xs font-medium">No conversations found</p>
            </div>
          ) : (
            filteredUsers.map(renderContactItem)
          )}

          {/* Directory Search Results */}
          {isSearchingDirectory ? (
            <div className="text-center py-4 text-xs dark:text-slate-500 text-slate-400 animate-pulse">
              Searching directory...
            </div>
          ) : directoryResults.length > 0 ? (
            <div className="pt-3 border-t dark:border-white/10 border-slate-200 mt-2 space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold dark:text-slate-400 text-slate-500 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                <span>Global Directory ({directoryResults.length})</span>
              </div>
              {directoryResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectUser(u)}
                  className="w-full p-2.5 rounded-xl flex items-center gap-3 dark:hover:bg-white/5 hover:bg-slate-100 text-left transition-all border border-transparent"
                >
                  <div className="w-10 h-10 rounded-xl dark:bg-slate-800 dark:border-white/10 dark:text-slate-300 bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold dark:text-white text-slate-900 truncate">{u.displayName}</p>
                    <p className="text-[11px] dark:text-slate-400 text-slate-500 truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Circles Tab */}
      {activeTab === 'circles' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {/* Create Circle Button */}
          <button
            type="button"
            onClick={() => setIsCreateCircleOpen(true)}
            className="w-full p-2.5 mb-2 rounded-xl dark:bg-purple-600/15 dark:hover:bg-purple-600/25 dark:border-purple-500/30 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center gap-2 text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Intimate Circle (Max 25)</span>
          </button>

          {filteredCircles.length === 0 ? (
            <div className="text-center py-12 px-4 dark:text-slate-500 text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-500" />
              <p className="text-xs font-medium">No circles yet</p>
              <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-1 max-w-xs mx-auto">
                Create a quiet, small group with friends or colleagues for focused discussion.
              </p>
            </div>
          ) : (
            filteredCircles.map((circle) => {
              const isSelected = selectedCircleId === circle._id;
              return (
                <button
                  key={circle._id}
                  type="button"
                  onClick={() => {
                    onSelectCircle?.(circle._id);
                    if (searchQuery) setSearchQuery('');
                  }}
                  className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-left transition-all ${
                    isSelected
                      ? 'dark:bg-purple-600/20 dark:border-purple-500/40 dark:text-white bg-purple-50 border border-purple-200 text-purple-900 shadow-sm'
                      : 'dark:hover:bg-white/5 hover:bg-slate-100 dark:text-slate-300 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl dark:bg-purple-900/30 dark:border-purple-500/20 dark:text-purple-300 bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold dark:text-white text-slate-900 truncate">
                        {circle.name}
                      </span>
                      <span className="text-[10px] dark:text-purple-400 text-purple-600 font-medium">
                        {circle.membersCount || 1} members
                      </span>
                    </div>
                    {circle.topic && (
                      <p className="text-[11px] dark:text-purple-300/80 text-purple-800/80 truncate mt-0.5">
                        {circle.topic}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 px-4 dark:text-slate-500 text-slate-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
              <p className="text-xs font-medium">No pending requests</p>
              <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-1">
                Your quiet sanctuary is clear of incoming conversation handshakes.
              </p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.conversationId}
                className="p-3 rounded-xl dark:bg-[#18181b] bg-white border dark:border-amber-500/30 border-amber-200 shadow-sm space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl dark:bg-amber-500/20 dark:text-amber-300 bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {req.initiator?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold dark:text-white text-slate-900 truncate">
                      {req.initiator?.displayName}
                    </p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500 truncate">
                      @{req.initiator?.username} requested to connect
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.respondToHandshake(req.conversationId, 'ACCEPT');
                        if (req.initiator) onSelectUser(req.initiator);
                      } catch (err) {
                        console.error('Failed to accept request:', err);
                      }
                    }}
                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.respondToHandshake(req.conversationId, 'DECLINE');
                      } catch (err) {
                        console.error('Failed to decline request:', err);
                      }
                    }}
                    className="flex-1 py-1.5 px-2 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Calls Tab */}
      {activeTab === 'calls' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {callLogs.length === 0 ? (
            <div className="text-center py-12 px-4 dark:text-slate-500 text-slate-400">
              <Phone className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-500" />
              <p className="text-xs font-medium">No call history</p>
            </div>
          ) : (
            callLogs.map((call) => (
              <div
                key={call.id}
                className="w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-left dark:hover:bg-white/5 hover:bg-slate-100 cursor-pointer border border-transparent"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold dark:text-white text-slate-900 truncate block">
                    {call.peer?.displayName || 'User'}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] dark:text-slate-400 text-slate-500 mt-0.5">
                    {call.direction === 'incoming' ? (
                      call.status === 'MISSED' ? (
                        <span className="flex items-center gap-1 text-rose-500 font-medium">
                          <PhoneMissed className="w-3.5 h-3.5" /> Missed
                        </span>
                      ) : call.status === 'REJECTED' ? (
                        <span className="flex items-center gap-1 text-slate-500">
                          <PhoneOff className="w-3.5 h-3.5 text-rose-500" /> Declined
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-500">
                          <PhoneIncoming className="w-3.5 h-3.5" /> Incoming
                        </span>
                      )
                    ) : (
                      <span className="flex items-center gap-1 text-indigo-500">
                        <PhoneOutgoing className="w-3.5 h-3.5" /> Outgoing
                      </span>
                    )}
                    <span>•</span>
                    <span>{call.isVideo ? 'Video' : 'Voice'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onStartCall?.(call.peer, call.isVideo)}
                  className="p-2 rounded-xl dark:bg-white/5 dark:hover:bg-indigo-600 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white transition-colors"
                >
                  {call.isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settings Tab (Telegram-Grade Experience) */}
      {activeTab === 'settings' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3.5 select-none">
          {/* User Profile Card */}
          <div className="dark:bg-[#18181b] bg-white border dark:border-white/10 border-slate-200/90 rounded-2xl p-4 flex flex-col items-center text-center shadow-xs relative">
            {/* Avatar with Camera Overlay */}
            <div className="relative group mb-2.5">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
                  className="w-18 h-18 rounded-2xl object-cover ring-2 dark:ring-white/20 ring-slate-300 shadow-md"
                />
              ) : (
                <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center font-bold text-2xl text-white shadow-md">
                  {currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}

              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="Change Profile Photo"
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-transform group-hover:scale-110 ring-2 dark:ring-[#18181b] ring-white"
              >
                {isUploadingAvatar ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Display Name & Handle */}
            {isEditingProfile ? (
              <div className="w-full space-y-2 mt-1">
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Display Name"
                  className="w-full px-3 py-1.5 rounded-xl dark:bg-[#121215] bg-slate-50 border dark:border-white/15 border-slate-300 text-center text-xs font-semibold dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Bio / Quiet Intro"
                  className="w-full px-3 py-1.5 rounded-xl dark:bg-[#121215] bg-slate-50 border dark:border-white/15 border-slate-300 text-center text-xs dark:text-slate-300 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Cellphone (+27...)"
                  className="w-full px-3 py-1.5 rounded-xl dark:bg-[#121215] bg-slate-50 border dark:border-white/15 border-slate-300 text-center text-xs dark:text-slate-300 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-1 rounded-lg text-xs dark:text-slate-400 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfileInfo}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-1.5">
                  <h2 className="text-sm font-bold dark:text-white text-slate-900">
                    {currentUser?.displayName || 'User'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    title="Edit profile"
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] dark:text-slate-400 text-slate-500">@{currentUser?.username}</p>
                {currentUser?.phoneNumber && (
                  <p className="text-[11px] dark:text-slate-500 text-slate-400 mt-0.5">{currentUser.phoneNumber}</p>
                )}
                {currentUser?.bio && (
                  <p className="text-xs dark:text-slate-300 text-slate-600 mt-1.5 line-clamp-2 px-2">
                    &ldquo;{currentUser.bio}&rdquo;
                  </p>
                )}
              </>
            )}

            {/* Social Battery / Status Pill Picker */}
            <div className="relative mt-3">
              <button
                type="button"
                onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                className="px-3 py-1 rounded-full text-xs font-medium dark:bg-white/5 bg-slate-100 hover:bg-slate-200 dark:hover:bg-white/10 border dark:border-white/10 border-slate-200 flex items-center gap-1.5 transition-all"
              >
                <span className={`w-2 h-2 rounded-full ${getStatusColor((currentUser?.status as UserStatus) || 'ONLINE')}`} />
                <span className="capitalize dark:text-slate-200 text-slate-700">{getStatusLabel((currentUser?.status as UserStatus) || 'ONLINE')}</span>
                <span className="text-[9px] opacity-60">▼</span>
              </button>

              {isStatusMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-60 py-1.5 dark:bg-[#18181b] bg-white border dark:border-white/15 border-slate-200 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 text-left divide-y dark:divide-white/5 divide-slate-100">
                  <button
                    type="button"
                    onClick={() => handleStatusChange('ONLINE')}
                    className="w-full px-3 py-2 text-xs hover:dark:bg-white/5 hover:bg-slate-50 flex items-center gap-2.5 dark:text-slate-200 text-slate-800"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-semibold">Open to Chat</div>
                      <div className="text-[10px] dark:text-slate-400 text-slate-500">Available for text & calls</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange('LOW_BATTERY')}
                    className="w-full px-3 py-2 text-xs hover:dark:bg-white/5 hover:bg-slate-50 flex items-center gap-2.5 dark:text-slate-200 text-slate-800"
                  >
                    <BatteryCharging className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-amber-500">Low Battery (Async Only)</div>
                      <div className="text-[10px] dark:text-slate-400 text-slate-500">Mutes calls; async messages only</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange('DEEP_FOCUS')}
                    className="w-full px-3 py-2 text-xs hover:dark:bg-white/5 hover:bg-slate-50 flex items-center gap-2.5 dark:text-slate-200 text-slate-800"
                  >
                    <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-purple-500">Deep Focus (Quiet Hours)</div>
                      <div className="text-[10px] dark:text-slate-400 text-slate-500">Silences calls & alerts completely</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange('BUSY')}
                    className="w-full px-3 py-2 text-xs hover:dark:bg-white/5 hover:bg-slate-50 flex items-center gap-2.5 dark:text-slate-200 text-slate-800"
                  >
                    <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <div>
                      <div className="font-semibold">Busy</div>
                      <div className="text-[10px] dark:text-slate-400 text-slate-500">In a meeting or task</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange('OFFLINE')}
                    className="w-full px-3 py-2 text-xs hover:dark:bg-white/5 hover:bg-slate-50 flex items-center gap-2.5 dark:text-slate-200 text-slate-800"
                  >
                    <CircleOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Invisible</div>
                      <div className="text-[10px] dark:text-slate-400 text-slate-500">Appear offline to all contacts</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Group 1: Cloud & Notifications */}
          <div className="dark:bg-[#18181b] bg-white border dark:border-white/10 border-slate-200/90 rounded-2xl overflow-hidden shadow-xs divide-y dark:divide-white/5 divide-slate-100">
            {/* Saved Messages */}
            <button
              type="button"
              onClick={handleOpenPersonalVault}
              className="w-full p-3 flex items-center justify-between text-left dark:hover:bg-white/5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-xs">
                  <Bookmark className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <div className="text-xs font-semibold dark:text-white text-slate-900">Saved Messages</div>
                  <div className="text-[10px] dark:text-slate-400 text-slate-500">Personal cloud vault & notes</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Notifications */}
            <button
              type="button"
              onClick={onOpenNotificationsPanel}
              className="w-full p-3 flex items-center justify-between text-left dark:hover:bg-white/5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold dark:text-white text-slate-900">Notifications</div>
                  <div className="text-[10px] dark:text-slate-400 text-slate-500">In-app alerts & badges</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {unreadNotificationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    {unreadNotificationsCount} new
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </div>

          {/* Group 2: Appearance (Telegram Night Mode) */}
          <div className="space-y-1">
            <p className="px-1 text-[10px] font-bold tracking-wider uppercase dark:text-slate-500 text-slate-400">
              Appearance
            </p>
            <div className="dark:bg-[#18181b] bg-white border dark:border-white/10 border-slate-200/90 rounded-2xl p-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-300" />}
                </div>
                <div>
                  <div className="text-xs font-semibold dark:text-white text-slate-900">Night Mode</div>
                  <div className="text-[10px] dark:text-slate-400 text-slate-500">
                    {theme === 'dark' ? 'Obsidian Dark' : 'Architect Light'}
                  </div>
                </div>
              </div>

              {/* iOS Switch */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle Night Mode"
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                  theme === 'dark' ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          </div>

          {/* Group 3: Privacy & Introvert Boundaries */}
          <div className="space-y-1">
            <p className="px-1 text-[10px] font-bold tracking-wider uppercase dark:text-slate-500 text-slate-400">
              Privacy & Permissions
            </p>
            <div className="dark:bg-[#18181b] bg-white border dark:border-white/10 border-slate-200/90 rounded-2xl overflow-hidden shadow-xs divide-y dark:divide-white/5 divide-slate-100">
              {/* Read Receipts */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold dark:text-white text-slate-900">Read Receipts</div>
                    <div className="text-[10px] dark:text-slate-400 text-slate-500">Let contacts see when you read messages</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateProfile({ sendReadReceipts: currentUser?.sendReadReceipts === false ? true : false })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    currentUser?.sendReadReceipts !== false ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {/* Typing Indicator */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold dark:text-white text-slate-900">Typing Status</div>
                    <div className="text-[10px] dark:text-slate-400 text-slate-500">Broadcast typing status while composing</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateProfile({ sendTypingIndicators: currentUser?.sendTypingIndicators === false ? true : false })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    currentUser?.sendTypingIndicators !== false ? 'bg-amber-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {/* Direct Calls */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold dark:text-white text-slate-900">Direct Calls</div>
                    <div className="text-[10px] dark:text-slate-400 text-slate-500">Accept incoming voice & video calls</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateProfile({ allowCalls: currentUser?.allowCalls === false ? true : false })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    currentUser?.allowCalls !== false ? 'bg-sky-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>
          </div>

          {/* Group 4: Active Devices / Sessions */}
          <div className="space-y-1">
            <p className="px-1 text-[10px] font-bold tracking-wider uppercase dark:text-slate-500 text-slate-400">
              Active Devices ({activeSessions.length || 1})
            </p>
            <div className="dark:bg-[#18181b] bg-white border dark:border-white/10 border-slate-200/90 rounded-2xl p-3 shadow-xs space-y-2">
              {activeSessions.length === 0 ? (
                <div className="flex items-center gap-2.5 text-xs">
                  <Laptop className="w-4 h-4 text-purple-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold dark:text-white text-slate-900">Current Web Session</p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500">Active now</p>
                  </div>
                </div>
              ) : (
                activeSessions.map((session) => (
                  <div key={session._id} className="flex items-center justify-between text-xs py-1 border-b dark:border-white/5 border-slate-100 last:border-0">
                    <div className="flex items-center gap-2.5">
                      {session.deviceName?.toLowerCase().includes('mobile') ? (
                        <Smartphone className="w-4 h-4 text-purple-500" />
                      ) : (
                        <Laptop className="w-4 h-4 text-purple-500" />
                      )}
                      <div>
                        <p className="font-semibold dark:text-white text-slate-900">{session.deviceName || 'Web Device'}</p>
                        <p className="text-[10px] dark:text-slate-400 text-slate-500">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(session._id)}
                      title="Log out device"
                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Group 5: Account & Sign Out */}
          <div className="pt-1">
            <button
              type="button"
              onClick={logout}
              className="w-full p-3 rounded-2xl dark:bg-rose-500/10 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-500/15 border dark:border-rose-500/20 border-rose-200 flex items-center justify-between transition-colors shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
                  <LogOut className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400">Log Out</div>
                  <div className="text-[10px] dark:text-slate-400 text-slate-500">Sign out of Chat.SO on this device</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Glassy Bottom Navigation Dock for Mobile/Compact screens */}
      <div className="lg:hidden shrink-0 p-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] bg-gradient-to-t dark:from-[#09090b] dark:via-[#09090b]/80 from-[#fbfbfa] via-[#fbfbfa]/90 to-transparent z-20 select-none">
        <nav className="flex items-center justify-around px-1.5 py-1.5 rounded-2xl dark:bg-[#121215]/85 dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] bg-white/95 border-slate-200/90 shadow-xl backdrop-blur-2xl border ring-1 dark:ring-white/5 ring-black/5">
          {/* Chats Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200 group ${
              activeTab === 'chats'
                ? 'dark:bg-indigo-600/20 dark:text-indigo-400 bg-indigo-50 text-indigo-700 border dark:border-indigo-500/30 border-indigo-200'
                : 'dark:text-slate-400 text-slate-600 hover:dark:bg-white/5 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <div className="relative p-0.5">
              <MessageSquare className="w-5 h-5 transition-transform group-active:scale-90" />
              {totalUnreadChats > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center ring-2 dark:ring-slate-950 ring-white">
                  {totalUnreadChats > 99 ? '99+' : totalUnreadChats}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === 'chats' ? 'font-bold' : 'font-medium'}`}>
              Chats
            </span>
          </button>

          {/* Circles Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('circles')}
            className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200 group ${
              activeTab === 'circles'
                ? 'dark:bg-purple-600/20 dark:text-purple-300 bg-purple-50 text-purple-700 border dark:border-purple-500/30 border-purple-200'
                : 'dark:text-slate-400 text-slate-600 hover:dark:bg-white/5 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <div className="relative p-0.5">
              <Users className="w-5 h-5 transition-transform group-active:scale-90" />
              {myCircles.length > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-purple-600 text-white font-bold text-[9px] flex items-center justify-center ring-2 dark:ring-slate-950 ring-white">
                  {myCircles.length}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === 'circles' ? 'font-bold' : 'font-medium'}`}>
              Circles
            </span>
          </button>

          {/* Requests Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200 group ${
              activeTab === 'requests'
                ? 'dark:bg-amber-500/20 dark:text-amber-300 bg-amber-50 text-amber-700 border dark:border-amber-500/30 border-amber-200'
                : 'dark:text-slate-400 text-slate-600 hover:dark:bg-white/5 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <div className="relative p-0.5">
              <ShieldAlert className="w-5 h-5 transition-transform group-active:scale-90" />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] flex items-center justify-center ring-2 dark:ring-slate-950 ring-white">
                  {pendingRequests.length}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === 'requests' ? 'font-bold' : 'font-medium'}`}>
              Requests
            </span>
          </button>

          {/* Calls Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200 group ${
              activeTab === 'calls'
                ? 'dark:bg-indigo-600/20 dark:text-indigo-400 bg-indigo-50 text-indigo-700 border dark:border-indigo-500/30 border-indigo-200'
                : 'dark:text-slate-400 text-slate-600 hover:dark:bg-white/5 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <div className="relative p-0.5">
              <Phone className="w-5 h-5 transition-transform group-active:scale-90" />
            </div>
            <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === 'calls' ? 'font-bold' : 'font-medium'}`}>
              Calls
            </span>
          </button>

          {/* Settings Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200 group ${
              activeTab === 'settings'
                ? 'dark:bg-indigo-600/20 dark:text-indigo-400 bg-indigo-50 text-indigo-700 border dark:border-indigo-500/30 border-indigo-200'
                : 'dark:text-slate-400 text-slate-600 hover:dark:bg-white/5 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <div className="relative p-0.5">
              <Settings className="w-5 h-5 transition-transform group-active:scale-90" />
            </div>
            <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === 'settings' ? 'font-bold' : 'font-medium'}`}>
              Settings
            </span>
          </button>
        </nav>
      </div>

      {/* Modals */}
      <CreateCircleModal
        isOpen={isCreateCircleOpen}
        onClose={() => setIsCreateCircleOpen(false)}
        onCircleCreated={(c) => {
          onSelectCircle?.(c._id);
        }}
      />

      <SavedMessagesModal
        isOpen={isSavedMessagesOpen}
        onClose={() => setIsSavedMessagesOpen(false)}
      />

      {/* New Conversation Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dark:bg-[#18181b] bg-white border dark:border-white/10 border-slate-200 rounded-2xl w-full max-w-md p-4 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b dark:border-white/10 border-slate-200">
              <h3 className="text-sm font-semibold dark:text-white text-slate-900">Start New Conversation</h3>
              <button
                type="button"
                onClick={() => {
                  setIsNewChatModalOpen(false);
                  setNewChatQuery('');
                  setNewChatResults([]);
                }}
                className="p-1 dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  value={newChatQuery}
                  onChange={(e) => setNewChatQuery(e.target.value)}
                  placeholder="Search by username, display name, or email..."
                  className="w-full pl-9 pr-3 py-2 dark:bg-[#121215] bg-slate-50 border dark:border-white/10 border-slate-200 rounded-xl text-xs dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {isSearchingNewChat ? (
                <p className="text-center py-6 text-xs text-slate-500">Searching...</p>
              ) : newChatResults.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-500">
                  {newChatQuery.trim().length < 2 ? 'Type at least 2 characters to search' : 'No users found'}
                </p>
              ) : (
                newChatResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onSelectUser(u);
                      setIsNewChatModalOpen(false);
                      setNewChatQuery('');
                      setNewChatResults([]);
                    }}
                    className="w-full p-2 rounded-xl flex items-center gap-3 dark:hover:bg-white/5 hover:bg-slate-100 text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-500 flex items-center justify-center font-bold text-xs">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold dark:text-white text-slate-900 truncate">{u.displayName}</p>
                      <p className="text-[10px] dark:text-slate-400 text-slate-500 truncate">@{u.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
