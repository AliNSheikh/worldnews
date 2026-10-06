import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowLeft, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface AdminLoginGateProps {
  currentLang: LanguageCode;
  onAuthenticated: () => void;
  onReturnToSite: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({
  currentLang,
  onAuthenticated,
  onReturnToSite,
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: passcode }),
      });

      const rawBody = await response.text();
      let payload: { error?: string; success?: boolean } | null = null;

      if (rawBody) {
        try {
          payload = JSON.parse(rawBody) as { error?: string; success?: boolean };
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        const fallbackMessage = rawBody && !rawBody.trim().startsWith('<')
          ? rawBody.trim().slice(0, 240)
          : `Server request failed with status ${response.status}. Check the Vercel environment variables and deployment logs.`;
        throw new Error(payload?.error || fallbackMessage || 'Authentication failed.');
      }

      if (!payload?.success) {
        throw new Error('The server returned an unexpected authentication response. Please redeploy and try again.');
      }

      sessionStorage.setItem('world_news_admin_auth', 'true');
      onAuthenticated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-sky-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-radial from-slate-900 to-slate-950 pointer-events-none opacity-80" />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Top Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-sky-950/80 border border-sky-800/80 rounded-xl flex items-center justify-center text-sky-400 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Restricted Newsroom Console
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            World News CMS
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Authorized editorial staff, bureau chiefs, and syndication managers only.
          </p>
        </div>

        {/* Informative Security Notice */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">
            🔐 Administrator Authentication Notice
          </p>
          <p>
            Credentials are verified securely by the server. Configure ADMIN_PASSWORD and ADMIN_SESSION_SECRET in your Vercel project environment.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Newsroom Access Passkey
            </label>
            <div className="relative">
              <input
                id="admin-passcode-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter access key..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-hidden focus:border-sky-500 pe-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="admin-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-950"
          >
            <KeyRound className="w-4 h-4" />
            <span>{isSubmitting ? 'Verifying...' : 'Access Newsroom Console'}</span>
          </button>
        </form>

        {/* Exit back to public site */}
        <div className="pt-2 border-t border-slate-800 text-center">
          <button
            onClick={onReturnToSite}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>Return to Public Homepage</span>
          </button>
        </div>
      </div>
    </div>
  );
};
