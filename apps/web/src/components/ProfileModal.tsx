import React, { useState, useRef, useEffect } from 'react';
import { UserStatus, MAX_FILE_SIZE_BYTES } from '@chatso/shared';
import { useAuth } from '../hooks/useAuth.js';
import { useTheme } from '../hooks/useTheme.js';
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
  Sun,
  Moon,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
        <div className="w-full max-w-lg my-auto rounded-2xl p-6 dark:glass-panel bg-white text-slate-900 dark:text-white border dark:border-white/10 border-slate-200 shadow-2xl relative space-y-5 transition-colors">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 dark:hover:bg-white/5 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div>
            <h2 className="text-lg font-bold dark:text-white text-slate-900">Profile & Quiet Settings</h2>
            <p className="text-xs dark:text-slate-400 text-slate-500">Configure your introvert boundaries and active devices</p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl dark:bg-red-500/10 bg-red-50 border dark:border-red-500/20 border-red-200 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Visual Appearance & Theme Selection */}
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">
                Visual Experience
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => theme !== 'dark' && toggleTheme()}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    theme === 'dark'
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-sm'
                      : 'dark:bg-slate-900/50 bg-slate-100 dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-600 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Moon className="w-4 h-4 text-blue-400" />
                  <span>Obsidian Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => theme !== 'light' && toggleTheme()}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    theme === 'light'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-400 shadow-sm'
                      : 'dark:bg-slate-900/50 bg-slate-100 dark:border-white/10 border-slate-200 dark:text-slate-400 text-slate-600 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Architect Light</span>
                </button>
              </div>
            </div>

            {/* Avatar Upload */}
            <div className="flex flex-col items-center justify-center mb-2">
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-20 h-20 rounded-2xl object-cover border-2 dark:border-white/20 border-slate-300 shadow-lg"
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
              <p className="text-[11px] dark:text-slate-400 text-slate-500 mt-2">Click image to upload avatar</p>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-white/10 border-slate-200 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Bio / Quiet Note */}
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1">Bio / Quiet Intro</label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Async enthusiast. Prefers thoughtful notes over calls."
                className="w-full px-3.5 py-2.5 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-white/10 border-slate-200 dark:text-white text-slate-900 text-sm dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Social Battery Status */}
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1">Social Battery Mode</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl dark:bg-slate-900 bg-white border dark:border-white/10 border-slate-200 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <label className="block text-xs font-medium dark:text-slate-300 text-slate-700">Cellphone Number</label>
                <span className="text-[10px] dark:text-slate-400 text-slate-500">Optional</span>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+27 82 123 4567"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-white/10 border-slate-200 dark:text-white text-slate-900 text-sm dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Privacy & Boundary Toggles */}
            <div className="p-3.5 rounded-xl dark:bg-slate-900/70 bg-slate-50 border dark:border-white/10 border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold dark:text-white text-slate-900">
                <Shield className="w-4 h-4 text-blue-500" />
                <span>Quiet Boundaries & Privacy</span>
              </div>

              {/* Read Receipts Toggle */}
              <label className="flex items-center justify-between cursor-pointer text-xs">
                <div className="flex items-center gap-2 dark:text-slate-300 text-slate-700">
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <div className="font-medium">Send Read Receipts</div>
                    <div className="text-[10px] dark:text-slate-400 text-slate-500">Let contacts know when you have seen messages</div>
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
                <div className="flex items-center gap-2 dark:text-slate-300 text-slate-700">
                  <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <div className="font-medium">Show Typing Indicator</div>
                    <div className="text-[10px] dark:text-slate-400 text-slate-500">Broadcast &ldquo;is typing...&rdquo; while composing</div>
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
                <div className="flex items-center gap-2 dark:text-slate-300 text-slate-700">
                  <PhoneOff className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <div className="font-medium">Allow Direct Calls</div>
                    <div className="text-[10px] dark:text-slate-400 text-slate-500">Accept audio and video calls from contacts</div>
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
              <div className="p-3.5 rounded-xl dark:bg-slate-900/70 bg-slate-50 border dark:border-white/10 border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold dark:text-white text-slate-900">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-purple-500" />
                    <span>Active Multi-Device Sessions</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold">{activeSessions.length} active</span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {activeSessions.map((session) => (
                    <div
                      key={session._id}
                      className="flex items-center justify-between p-2 rounded-lg dark:bg-black/20 bg-white border dark:border-transparent border-slate-200/80 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        {session.deviceName?.toLowerCase().includes('mobile') ? (
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <div>
                          <div className="dark:text-white text-slate-900 font-medium">{session.deviceName || 'Device'}</div>
                          <div className="text-[10px] dark:text-slate-500 text-slate-400">
                            Logged in {new Date(session.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeSession(session._id)}
                        title="Log out device"
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
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
                className="py-2.5 px-4 rounded-xl border border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
