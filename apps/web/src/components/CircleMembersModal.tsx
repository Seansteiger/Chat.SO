import React, { useState } from 'react';
import { convex, api as convexApi } from '../convex.js';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../services/api.js';
import {
  X,
  Users,
  Shield,
  UserPlus,
  Trash2,
  LogOut,
  AlertCircle,
  Search,
} from 'lucide-react';

interface CircleMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleName: string;
  maxMembers: number;
  members: Array<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    status: string;
    role: 'ADMIN' | 'MEMBER';
    joinedAt: number;
  }>;
  isAdmin: boolean;
  onLeaveCircle?: () => void;
}

export const CircleMembersModal: React.FC<CircleMembersModalProps> = ({
  isOpen,
  onClose,
  circleId,
  circleName,
  maxMembers,
  members,
  isAdmin,
  onLeaveCircle,
}) => {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentMemberIds = new Set(members.map((m) => m.id));

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await api.searchUsers(q);
      // Filter out users who are already in the circle
      setSearchResults(res.users.filter((u) => !currentMemberIds.has(u.id)));
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async (targetUserId: string) => {
    if (!currentUser?.id) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (members.length >= maxMembers) {
      setErrorMessage(`This intimate circle has reached its maximum limit of ${maxMembers} members.`);
      return;
    }

    try {
      await (convex as any).mutation(convexApi.circles.addCircleMember, {
        circleId: circleId as any,
        adminId: currentUser.id as any,
        targetUserId: targetUserId as any,
      });
      setSuccessMessage('Member added to circle!');
      setSearchResults((prev) => prev.filter((u) => u.id !== targetUserId));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!currentUser?.id) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await (convex as any).mutation(convexApi.circles.removeCircleMember, {
        circleId: circleId as any,
        adminId: currentUser.id as any,
        targetUserId: targetUserId as any,
      });
      setSuccessMessage('Member removed from circle.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove member');
    }
  };

  const handleLeave = async () => {
    if (!currentUser?.id) return;
    try {
      await (convex as any).mutation(convexApi.circles.leaveCircle, {
        circleId: circleId as any,
        userId: currentUser.id as any,
      });
      onClose();
      onLeaveCircle?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to leave circle');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] bg-slate-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{circleName} Members</h3>
              <p className="text-[11px] text-purple-400 font-mono">
                {members.length} / {maxMembers} members (Intimate Limit)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notices */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <span>{successMessage}</span>
          </div>
        )}

        {/* Add Member Search Input (Admins Only) */}
        {isAdmin && members.length < maxMembers && (
          <div className="p-4 border-b border-white/5 bg-slate-900/40">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-purple-400" />
              <span>Invite New Member</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search user by username, display name..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 p-1 rounded-xl bg-slate-900 border border-white/10">
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{u.displayName}</p>
                      <p className="text-[10px] text-slate-400 truncate">@{u.username}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddMember(u.id)}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] shrink-0"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isSearching && (
              <p className="text-[11px] text-slate-500 mt-1 pl-1">Searching...</p>
            )}
          </div>
        )}

        {/* Member List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Circle Members ({members.length})
          </div>

          {members.map((member) => {
            const isSelf = member.id === currentUser?.id;
            const canRemove = isAdmin && !isSelf && member.role !== 'ADMIN';

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.displayName}
                      className="w-9 h-9 rounded-xl object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white truncate">
                        {member.displayName}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] text-slate-400 font-mono">(you)</span>
                      )}
                      {member.role === 'ADMIN' && (
                        <span className="flex items-center gap-0.5 text-[10px] text-purple-400 font-semibold bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                          <Shield className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">@{member.username}</p>
                  </div>
                </div>

                {canRemove && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.id)}
                    title="Remove from circle"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: Leave Circle */}
        <div className="p-4 border-t border-white/5 bg-slate-900/40 flex items-center justify-between">
          <button
            type="button"
            onClick={handleLeave}
            className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Circle</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
