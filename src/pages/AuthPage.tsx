import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Play,
  Globe,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AuthPage: React.FC = () => {
  const {
    loginWithEmail,
    registerWithEmail,
    requestPasswordReset,
    setIsDemoMode,
    capabilities,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [turnstileVerified, setTurnstileVerified] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (capabilities.turnstileConfigured && !turnstileVerified) {
      setErrorMessage('Please complete the Cloudflare Turnstile verification check.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email.trim(), password, turnstileToken);
      } else if (mode === 'register') {
        await registerWithEmail(
          email.trim(),
          password,
          displayName.trim() || email.split('@')[0],
          turnstileToken
        );
      } else if (mode === 'reset') {
        await requestPasswordReset(email.trim());
        setInfoMessage(
          'Password reset request submitted. Note: Resend Email must be configured in Cloudflare Worker secrets to deliver reset emails.'
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Left Architectural Editorial Column */}
      <div className="lg:w-1/2 bg-[#0F172A] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
              WM
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">WhimsyMaya</span>
              <span className="block text-[11px] font-mono uppercase tracking-widest text-indigo-400">
                Plan. Record. Analyse. Improve.
              </span>
            </div>
          </div>

          <div className="mt-14 max-w-xl space-y-5">
            <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
              Cloudflare-Native Executive Work Platform
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Structured planning, work journaling, analyst research, and verifiable performance telemetry.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Engineered on Cloudflare Workers, D1 SQLite, R2 object storage, and Better Auth D1 session architecture. Maintain a permanent, searchable professional track record with zero-trust workspace isolation.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-mono text-indigo-400">01 · Daily Planner & Tasks</div>
              <div className="text-sm font-semibold mt-1">
                Kanban, Calendar & Milestone Tracking
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Automatic project progress calculation from eligible tasks with subtask checklists.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-mono text-emerald-400">02 · Work Journal & R2 Files</div>
              <div className="text-sm font-semibold mt-1">
                Private-by-Default Executive Logs
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Debounced D1 autosave, key achievements, lessons learned, and R2 file evidence.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-mono text-amber-400">03 · Analyst & Market Desk</div>
              <div className="text-sm font-semibold mt-1">
                9 Research Domains + Stock Thesis
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Compare ex-ante Expected Outcomes against realized Actual Outcomes side-by-side.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-mono text-violet-400">04 · Reports & Team RBAC</div>
              <div className="text-sm font-semibold mt-1">
                Excel (.xlsx), CSV & PDF Exports
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Owner, Admin, Manager, and Member permissions with expiring 7-day invite codes.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Runtime: Cloudflare Workers + D1 SQLite + R2</span>
          <span>Auth: Better Auth D1 HTTP-Only Sessions</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {mode === 'login'
                  ? 'Sign In to Workspace'
                  : mode === 'register'
                  ? 'Create Cloudflare D1 Account'
                  : 'Password Recovery'}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {mode === 'login'
                  ? 'Welcome back to WhimsyMaya'
                  : mode === 'register'
                  ? 'Provision your workspace'
                  : 'Reset account password'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {capabilities.betterAuthConfigured
                  ? 'Authenticate with your email and password stored in Cloudflare D1.'
                  : 'Better Auth is currently Not Configured (no BETTER_AUTH_SECRET set). Use Development & Demo Preview Mode below until you configure Cloudflare Worker secrets after deployment.'}
              </p>
            </div>

            {/* Primary Callout when external credentials are not configured yet */}
            {!capabilities.betterAuthConfigured && (
              <div className="p-4 rounded-xl border border-amber-300/80 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 space-y-2.5">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                  <span>Better Auth — Not Configured</span>
                  <span className="font-mono text-[10px] uppercase">Zero-Key Preview Ready</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  Production login is locked because <code className="font-mono">BETTER_AUTH_SECRET</code> has not been provided yet. Click below to explore all modules using isolated Demo / Local Development data.
                </p>
                <button
                  type="button"
                  onClick={() => setIsDemoMode(true)}
                  className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Launch Development & Demo Preview Mode
                </button>
              </div>
            )}

            {/* Mode Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Create Account
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Maya Lin"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Work Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maya@whimsymaya.dev"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Password * (min 8 chars)
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reset');
                          setErrorMessage(null);
                          setInfoMessage(null);
                        }}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Cloudflare Turnstile Status */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={turnstileVerified}
                    onChange={(e) => {
                      setTurnstileVerified(e.target.checked);
                      setTurnstileToken(e.target.checked ? 'turnstile-ready' : '');
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Cloudflare Turnstile
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {capabilities.turnstileConfigured
                        ? 'Turnstile — Configured'
                        : 'Turnstile — Not Configured (Optional in Dev)'}
                    </div>
                  </div>
                </label>
                <span className="text-[10px] font-mono uppercase text-slate-400">
                  Cloudflare
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-indigo-600 hover:opacity-90 disabled:opacity-50 text-white shadow-xs flex items-center justify-center gap-2 transition-opacity cursor-pointer"
              >
                <span>
                  {submitting
                    ? 'Verifying with Cloudflare Worker...'
                    : mode === 'login'
                    ? 'Sign In (Requires Better Auth Secret)'
                    : mode === 'register'
                    ? 'Create Account (Requires Better Auth Secret)'
                    : 'Request Password Reset'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Optional Google OAuth Indicator */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Google Login
                </span>
                <span>
                  {capabilities.googleOAuthConfigured ? 'Configured' : 'Not Configured'}
                </span>
              </div>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pt-1 cursor-pointer"
                >
                  Back to Sign In
                </button>
              )}
            </form>

            {/* Enter Development & Demo Preview Mode */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => setIsDemoMode(true)}
                className="w-full py-2 px-3 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-indigo-500" />
                Return to Development & Demo Preview Mode
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
