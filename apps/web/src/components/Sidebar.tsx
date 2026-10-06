import React, { useState } from 'react';
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
} from 'lucide-react';

interface SidebarProps {
  users: UserProfile[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onOpenProfile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  users,
  selectedUser,
  onSelectUser,
  onOpenProfile,
}) => {
  const { user: currentUser, updateProfile } = useAuth();
  const { isInstallable, promptInstall } = usePWAInstall();
  const [searchQuery, setSearchQuery] = useState('');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  });

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

  return (
    <aside className="w-80 h-full flex flex-col bg-slate-950/80 border-r border-white/10 shrink-0 select-none">
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
                currentUser?.status as UserStatus || 'ONLINE'
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

        {/* Actions: PWA Install & Profile Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Contact Search Input */}
      <div className="p-3 border-b border-white/5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500">
            <UserIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No contacts found</p>
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isSelected = selectedUser?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUser(u)}
                className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-left transition-all ${
                  isSelected
                    ? 'bg-blue-600/20 border border-blue-500/30 text-white'
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
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-slate-200 truncate">
                      {u.displayName}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      {u.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">@{u.username}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
