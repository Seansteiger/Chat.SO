import React from 'react';
import {
  MessageSquare,
  Users,
  ShieldAlert,
  Phone,
  Download,
  Plus,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

interface NavigationRailProps {
  activeTab: 'chats' | 'circles' | 'requests' | 'calls' | 'settings';
  onSelectTab: (tab: 'chats' | 'circles' | 'requests' | 'calls' | 'settings') => void;
  unreadChatsCount?: number;
  pendingRequestsCount?: number;
  circlesCount?: number;
  onQuickCompose?: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeTab,
  onSelectTab,
  unreadChatsCount = 0,
  pendingRequestsCount = 0,
  circlesCount = 0,
  onQuickCompose,
}) => {
  const { user } = useAuth();
  const { isInstallable, promptInstall } = usePWAInstall();

  return (
    <aside className="chatso-nav-rail hidden lg:flex w-16 h-full flex-col justify-between items-center py-4 z-40 shrink-0 select-none transition-colors border-r dark:bg-[#09090b] dark:border-white/[0.08] bg-[#f4f4f6] border-slate-200">
      {/* Top Brand Logo & Quick Action */}
      <div className="flex flex-col items-center gap-4">
        {/* Glowing Hexagon Logo */}
        <div
          onClick={() => onSelectTab('chats')}
          className="relative group cursor-pointer"
          title="Chat.SO Home"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-md dark:bg-gradient-to-tr dark:from-indigo-900/40 dark:to-indigo-600/30 dark:border dark:border-indigo-500/50 dark:shadow-indigo-500/20 bg-indigo-600 text-white shadow-indigo-500/30">
            <svg
              className="w-5 h-5 dark:text-indigo-300 text-white drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2L2 7V17L12 22L22 17V7L12 2ZM12 4.18L19.5 8.35V15.65L12 19.82L4.5 15.65V8.35L12 4.18ZM10.5 8V16H13.5V8H10.5Z" />
            </svg>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 dark:ring-[#09090b] ring-[#f4f4f6]" />
        </div>

        {/* Quick Compose Button */}
        {onQuickCompose && (
          <button
            type="button"
            onClick={onQuickCompose}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 border dark:bg-[#18181b] dark:border-white/10 dark:text-slate-200 dark:hover:text-indigo-400 dark:hover:border-indigo-500/50 bg-white border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-400 shadow-sm"
            title="Start New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Navigation Tab Stack */}
        <nav className="flex flex-col items-center gap-2 mt-1">
          {/* Chats Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('chats')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all group ${
              activeTab === 'chats'
                ? 'dark:bg-indigo-600/20 dark:text-indigo-400 dark:border dark:border-indigo-500/40 bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm'
                : 'dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Direct Messages"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChatsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center ring-2 dark:ring-[#09090b] ring-[#f4f4f6]">
                {unreadChatsCount > 99 ? '99+' : unreadChatsCount}
              </span>
            )}
          </button>

          {/* Circles Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('circles')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all group ${
              activeTab === 'circles'
                ? 'dark:bg-indigo-600/20 dark:text-indigo-400 dark:border dark:border-indigo-500/40 bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm'
                : 'dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Circles & Communities"
          >
            <Users className="w-5 h-5" />
            {circlesCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-purple-600 text-white font-bold text-[9px] flex items-center justify-center ring-2 dark:ring-[#09090b] ring-[#f4f4f6]">
                {circlesCount}
              </span>
            )}
          </button>

          {/* Requests Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('requests')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all group ${
              activeTab === 'requests'
                ? 'dark:bg-amber-500/20 dark:text-amber-400 dark:border dark:border-amber-500/40 bg-amber-50 text-amber-600 border border-amber-200 shadow-sm'
                : 'dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Handshake Requests"
          >
            <ShieldAlert className="w-5 h-5" />
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] flex items-center justify-center ring-2 dark:ring-[#09090b] ring-[#f4f4f6]">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Calls Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('calls')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all group ${
              activeTab === 'calls'
                ? 'dark:bg-indigo-600/20 dark:text-indigo-400 dark:border dark:border-indigo-500/40 bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm'
                : 'dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Voice & Video Calls"
          >
            <Phone className="w-5 h-5" />
          </button>
        </nav>
      </div>

      {/* Bottom Rail Actions: PWA Install & Settings Profile Avatar */}
      <div className="flex flex-col items-center gap-3">
        {/* PWA Install Button */}
        {isInstallable && (
          <button
            type="button"
            onClick={promptInstall}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            title="Install Chat.SO App"
          >
            <Download className="w-4 h-4" />
          </button>
        )}

        {/* User Profile Avatar with Presence Badge -> Switches to Settings */}
        <div
          onClick={() => onSelectTab('settings')}
          className={`pt-2 border-t dark:border-white/10 border-slate-200 flex flex-col items-center cursor-pointer group transition-transform ${
            activeTab === 'settings' ? 'scale-105' : ''
          }`}
          title={`Settings (${user?.displayName || 'User'})`}
        >
          <div
            className={`relative w-9 h-9 rounded-xl overflow-hidden ring-2 transition-all ${
              activeTab === 'settings'
                ? 'ring-indigo-500 shadow-md shadow-indigo-500/30'
                : 'dark:ring-white/10 ring-slate-300 group-hover:ring-indigo-500'
            }`}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs dark:bg-indigo-950 dark:text-indigo-300 bg-indigo-100 text-indigo-700">
                {(user?.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 dark:ring-[#09090b] ring-[#f4f4f6] ${
                user?.status === 'ONLINE'
                  ? 'bg-emerald-500 presence-pulse'
                  : user?.status === 'LOW_BATTERY'
                  ? 'bg-amber-400'
                  : user?.status === 'DEEP_FOCUS'
                  ? 'bg-purple-500'
                  : user?.status === 'BUSY'
                  ? 'bg-rose-500'
                  : 'bg-slate-500'
              }`}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};
