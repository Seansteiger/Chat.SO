import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { Sparkles, MessageSquare, Video, ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register({ username, email, password, displayName: displayName || username });
      } else {
        await login({ usernameOrEmail: username, password });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoUser: 'alice' | 'bob') => {
    setError(null);
    setLoading(true);
    const pass = 'password123';
    const emailAddr = `${demoUser}@example.com`;
    const name = demoUser === 'alice' ? 'Alice Vance' : 'Bob Stone';

    try {
      // Try login first
      await login({ usernameOrEmail: demoUser, password: pass });
    } catch {
      try {
        // If account doesn't exist, register
        await register({ username: demoUser, email: emailAddr, password: pass, displayName: name });
      } catch (regErr: any) {
        setError(regErr.message || 'Demo initialization failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-radial from-slate-900 via-[#0a0f1d] to-[#05070e]">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 shadow-xl shadow-indigo-500/20 mb-4 border border-white/10">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Chat.SO
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Real-time messaging, WebRTC calling & direct 50MB cloud file sharing.
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex border-b border-white/10 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                !isRegister
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                isRegister
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username or Handle
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alice"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alice Vance"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alice@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Complete Registration' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-slate-400 text-center mb-3 font-medium flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Quick Demo Logins
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemo('alice')}
                className="py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 text-xs text-slate-200 font-medium transition-all flex items-center justify-center gap-2 hover:border-blue-500/30"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                Test as Alice
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemo('bob')}
                className="py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 text-xs text-slate-200 font-medium transition-all flex items-center justify-center gap-2 hover:border-purple-500/30"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                Test as Bob
              </button>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
            <span>50MB Direct Upload</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Video className="w-4 h-4 text-blue-500/80" />
            <span>WebRTC Audio/Video</span>
          </div>
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-purple-500/80" />
            <span>PWA Installable</span>
          </div>
        </div>
      </div>
    </div>
  );
};
