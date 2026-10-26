import React, { useState, useRef, useEffect } from 'react';
import { UserStatus, MAX_FILE_SIZE_BYTES } from '@chatso/shared';
import { useAuth } from '../hooks/useAuth.js';
import { uploadFileDirectly } from '../services/uploader.js';
import { convex, api as convexApi } from '../convex.js';
import {
  X,
  Camera,
  LogOut,
  Check,
  AlertCircle,
  Phone,
  Shield,
  Laptop,
  Smartphone,
  Trash2,
  EyeOff,
  Keyboard,
  PhoneOff,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [status, setStatus] = useState<UserStatus>((user?.status as UserStatus) || 'ONLINE');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);

  // Privacy toggles
  const [sendReadReceipts, setSendReadReceipts] = useState(user?.sendReadReceipts !== false);
  const [sendTypingIndicators, setSendTypingIndicators] = useState(user?.sendTypingIndicators !== false);
  const [allowCalls, setAllowCalls] = useState(user?.allowCalls !== false);

  // Active sessions
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Watch active sessions
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let unsub: (() => void) | null = null;
    try {
      const watch = (convex as any).watchQuery(convexApi.users.listActiveSessions, {
        userId: user.id as any,
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
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('Avatar image exceeds 50MB limit.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const res = await uploadFileDirectly(file);
      setAvatarUrl(res.publicUrl);
      setSuccessMessage('Avatar uploaded!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Avatar upload failed');
    } finally {
      setIsUploading(false);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateProfile({
        displayName: displayName.trim(),
        avatarUrl,
        status,
        phoneNumber: phoneNumber.trim() || null,
        bio: bio.trim(),
        sendReadReceipts,
        sendTypingIndicators,
        allowCalls,
      } as any);
      setSuccessMessage('Profile and privacy preferences updated!');
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md overflow-y-auto overflow-x-hidden">
      <div className="min-h-full w-full flex flex-col items-center justify-start p-4 py-8 sm:py-12">
        <div className="w-full max-w-lg my-auto rounded-2xl p-6 glass-panel border border-white/10 shadow-2xl relative space-y-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div>
            <h2 className="text-lg font-bold text-white">Profile & Quiet Settings</h2>
            <p className="text-xs text-slate-400">Configure your introvert boundaries and active devices</p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center justify-center mb-2">
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-2xl text-white shadow-lg">
                    {displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Change Avatar"
                  className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity border border-white/20"
                >
                  {isUploading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Click image to upload avatar</p>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Bio / Quiet Note */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bio / Quiet Intro</label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Async enthusiast. Prefers thoughtful notes over calls."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Social Battery Status */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Social Battery Mode</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ONLINE">Open to Chat (Available for text & calls)</option>
                <option value="LOW_BATTERY">Low Battery (Async Only - Mutes calls)</option>
                <option value="DEEP_FOCUS">Deep Focus (Quiet Hours - Silences all alerts)</option>
                <option value="BUSY">Busy</option>
                <option value="OFFLINE">Invisible / Offline</option>
              </select>
            </div>

            {/* Cellphone Number */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Cellphone Number</label>
                <span className="text-[10px] text-slate-400">Optional</span>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+27 82 123 4567"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Privacy & Boundary Toggles */}
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Quiet Boundaries & Privacy</span>
              </div>

              {/* Read Receipts Toggle */}
              <label className="flex items-center justify-between cursor-pointer text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <div className="font-medium">Send Read Receipts</div>
                    <div className="text-[10px] text-slate-400">Let contacts know when you have seen messages</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendReadReceipts}
                  onChange={(e) => setSendReadReceipts(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                />
              </label>

              {/* Typing Indicators Toggle */}
              <label className="flex items-center justify-between cursor-pointer text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <div className="font-medium">Show Typing Indicator</div>
                    <div className="text-[10px] text-slate-400">Broadcast &ldquo;is typing...&rdquo; while composing</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendTypingIndicators}
                  onChange={(e) => setSendTypingIndicators(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                />
              </label>

              {/* Allow Calls Toggle */}
              <label className="flex items-center justify-between cursor-pointer text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <PhoneOff className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <div className="font-medium">Allow Direct Calls</div>
                    <div className="text-[10px] text-slate-400">Accept audio and video calls from contacts</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowCalls}
                  onChange={(e) => setAllowCalls(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Multi-Device Sessions Manager */}
            {activeSessions.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-purple-400" />
                    <span>Active Multi-Device Sessions</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-400">{activeSessions.length} active</span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {activeSessions.map((session) => (
                    <div
                      key={session._id}
                      className="flex items-center justify-between p-2 rounded-lg bg-black/20 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {session.deviceName?.toLowerCase().includes('mobile') ? (
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <div>
                          <div className="text-white font-medium">{session.deviceName || 'Device'}</div>
                          <div className="text-[10px] text-slate-500">
                            Logged in {new Date(session.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeSession(session._id)}
                        title="Log out device"
                        className="text-slate-400 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={logout}
                className="py-2.5 px-4 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>

              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
              >
                Save Preferences
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
