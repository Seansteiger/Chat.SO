import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import {
  MessageSquare,
  Video,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  Mail,
  KeyRound,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

type AuthMode = 'signin' | 'register' | 'verify-signup' | 'forgot-request' | 'forgot-verify';

export const AuthScreen: React.FC = () => {
  const {
    login,
    register,
    requestSignupVerification,
    verifyAndRegister,
    verifySignupByLink,
    requestPasswordReset,
    resetPasswordWithCode,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Auto-verify if user clicks the one-click link in their email
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const emailParam = params.get('email');
    const codeParam = params.get('code') || params.get('verifyCode');

    if (action === 'verify' && emailParam && codeParam) {
      setLoading(true);
      setError(null);
      setSuccess('Verifying your email link and signing you in...');
      verifySignupByLink({ email: emailParam, code: codeParam })
        .then(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err: any) => {
          setError(err.message || 'Verification link expired or invalid.');
          setLoading(false);
          setSuccess(null);
        });
    } else if (action === 'reset' && emailParam && codeParam) {
      setEmail(emailParam);
      setOtpCode(codeParam);
      setMode('forgot-verify');
      setSuccess('Reset code detected from link! Please enter your new password.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [verifySignupByLink]);

  // 1. Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await login({ usernameOrEmail: username.trim(), password });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Request Signup Verification Code (Resend API)
  const handleRequestSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await requestSignupVerification({
        username: cleanUsername,
        email: cleanEmail,
        displayName: displayName.trim() || cleanUsername,
        password,
      });
      setMode('verify-signup');
      setOtpCode('');
      setSuccess(`A verification link and 6-digit code were sent to ${cleanEmail}. Click the link in your email to verify instantly, or enter the code below.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP & Finalize Registration
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the 6-digit code received via email.');
      return;
    }

    setLoading(true);
    try {
      await verifyAndRegister({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim() || username.trim(),
        code: cleanCode,
      });
    } catch (err: any) {
      setError(err.message || 'Verification failed. Code may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Signup Code
  const handleResendSignupCode = async () => {
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      await requestSignupVerification({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        displayName: displayName.trim() || username.trim(),
        password,
      });
      setSuccess(`A new verification link and code were sent to ${email.trim().toLowerCase()}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  // 4. Request Password Reset Code
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset({ email: cleanEmail });
      setMode('forgot-verify');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(`Password reset code sent to ${cleanEmail}. Check your inbox.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Make sure the email is registered.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Verify Reset Code & Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the 6-digit reset code.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithCode({
        email: email.trim().toLowerCase(),
        code: cleanCode,
        newPassword,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Code may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Reset Code
  const handleResendResetCode = async () => {
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      await requestPasswordReset({ email: email.trim().toLowerCase() });
      setSuccess(`A new reset code was sent to ${email.trim().toLowerCase()}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to resend reset code.');
    } finally {
      setResending(false);
    }
  };

  // Instant Demo Logins
  const handleQuickDemo = async (demoUser: 'alice' | 'bob') => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const pass = 'password123';
    const emailAddr = `${demoUser}@example.com`;
    const name = demoUser === 'alice' ? 'Alice Vance' : 'Bob Stone';

    try {
      await login({ usernameOrEmail: demoUser, password: pass });
    } catch {
      try {
        await register({ username: demoUser, email: emailAddr, password: pass, displayName: name });
      } catch (regErr: any) {
        setError(regErr.message || 'Demo initialization failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-radial from-slate-900 via-[#0a0f1d] to-[#05070e]">
      <div className="min-h-full w-full flex flex-col items-center justify-start p-4 py-8 sm:py-12">
        <div className="w-full max-w-md my-auto py-2">
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
            {/* Tabs for Sign In vs Register */}
            {(mode === 'signin' || mode === 'register') && (
              <div className="flex border-b border-white/10 mb-6">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                  className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                    mode === 'signin'
                      ? 'text-blue-400 border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
                  className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                    mode === 'register'
                      ? 'text-blue-400 border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Sub-header for Verify Signup */}
            {mode === 'verify-signup' && (
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Back to registration"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    Verify Your Email
                  </h2>
                  <p className="text-xs text-slate-400">Step 2: Enter 6-digit confirmation code</p>
                </div>
              </div>
            )}

            {/* Sub-header for Forgot Password Request */}
            {mode === 'forgot-request' && (
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Back to Sign In"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    Reset Password
                  </h2>
                  <p className="text-xs text-slate-400">Receive a 6-digit recovery code</p>
                </div>
              </div>
            )}

            {/* Sub-header for Forgot Password Verify */}
            {mode === 'forgot-verify' && (
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => { setMode('forgot-request'); setError(null); setSuccess(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    Enter Reset Code
                  </h2>
                  <p className="text-xs text-slate-400">Set a new password for your account</p>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Banner */}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* VIEW 1: SIGN IN */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
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

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot-request'); setError(null); setSuccess(null); }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
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
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* VIEW 2: REGISTER (Request Code) */}
            {mode === 'register' && (
              <form onSubmit={handleRequestSignup} className="space-y-4">
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
                  <p className="text-[11px] text-slate-500 mt-1">
                    We will send a 6-digit confirmation code to verify this email.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="•••••••• (min. 6 characters)"
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
                      <span>Continue & Verify Email</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* VIEW 3: VERIFY SIGNUP OTP */}
            {mode === 'verify-signup' && (
              <form onSubmit={handleVerifyAndRegister} className="space-y-5">
                <div>
                  <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                    Enter the 6-digit code sent to <strong className="text-white">{email}</strong>:
                  </p>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.4em] text-2xl font-mono py-3 rounded-xl bg-slate-900/80 border border-blue-500/40 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Didn't receive the email?</span>
                  <button
                    type="button"
                    disabled={resending || loading}
                    onClick={handleResendSignupCode}
                    className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                    <span>{resending ? 'Sending...' : 'Resend Code'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* VIEW 4: FORGOT PASSWORD REQUEST */}
            {mode === 'forgot-request' && (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <div>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    Enter the email address associated with your account, and we will send you a 6-digit verification code to reset your password.
                  </p>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Send Recovery Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* VIEW 5: FORGOT PASSWORD VERIFY & SET NEW PASSWORD */}
            {mode === 'forgot-verify' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                    Enter the 6-digit code sent to <strong className="text-white">{email}</strong>:
                  </p>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.4em] text-2xl font-mono py-2.5 rounded-xl bg-slate-900/80 border border-indigo-500/40 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="•••••••• (min. 6 characters)"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Reset Password & Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Didn't receive code?</span>
                  <button
                    type="button"
                    disabled={resending || loading}
                    onClick={handleResendResetCode}
                    className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                    <span>{resending ? 'Sending...' : 'Resend Code'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Quick Demo Fill Buttons (Always accessible on Sign In) */}
            {mode === 'signin' && (
              <div className="mt-6 pt-5 border-t border-white/10">
                <p className="text-xs text-slate-400 text-center mb-3 font-medium tracking-wide uppercase">
                  Quick Demo Accounts
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
            )}
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
    </div>
  );
};
