import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ThemeSelector } from './ThemeSelector';
import { InstitutionalSeal } from './InstitutionalSeal';
import {
  Lock,
  ShieldAlert,
  User,
  KeyRound,
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  Home,
  CloudCheck,
  CloudOff,
  CheckCircle2,
  Clock,
  RotateCw,
} from 'lucide-react';

interface GatekeeperLockScreenProps {
  onBackToHome?: () => void;
}

export const GatekeeperLockScreen: React.FC<GatekeeperLockScreenProps> = ({ onBackToHome }) => {
  const { handleStaffLogin, settings, connectionStatus } = useApp();

  const [staffId, setStaffId] = useState(() => {
    try {
      return localStorage.getItem('ignou_sc2033_last_staff_id') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccessNotice, setLoginSuccessNotice] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRemainingAttempts(null);

    const cleanId = staffId.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanId) {
      setErrorMessage('Please enter your assigned Staff ID / Username.');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await handleStaffLogin(cleanId, cleanPass);
      setIsSubmitting(false);

      if (res.success && res.user) {
        if (rememberId) {
          try {
            localStorage.setItem('ignou_sc2033_last_staff_id', cleanId);
          } catch {}
        }
        setLoginSuccessNotice(`Authenticated as ${res.user.fullName} (${res.user.role})`);
        return;
      }

      if (res.locked) {
        setIsLocked(true);
        setLockoutMinutes(res.lockoutRemainingMinutes || 15);
        setErrorMessage(
          res.error ||
            'Security Policy Enforced: Account locked due to 5 consecutive failed attempts. Contact Centre Coordinator (Dr. Sant Kumar Gupta).'
        );
        setPassword('');
      } else {
        if (res.remainingAttempts !== undefined) {
          setRemainingAttempts(res.remainingAttempts);
        }
        setErrorMessage(
          res.error || 'Access Denied: Invalid Staff ID or Password. Credentials managed in Google Sheets.'
        );
        setPassword('');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'An unexpected error occurred during authentication.');
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-950 via-zinc-900 to-indigo-950 flex flex-col items-center justify-center p-4 sm:p-6 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Background glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Top Navigation & Controls */}
        <div className="mb-3 flex items-center justify-between gap-2">
          {onBackToHome ? (
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 px-3 py-1.5 rounded-lg transition cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <Home className="w-3.5 h-3.5 text-amber-400" />
              <span>Back to Study Centre Home</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-zinc-400 font-mono tracking-wider">SC-2033 TERMINAL</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Sheet Connection Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                  : 'bg-amber-950/60 text-amber-300 border-amber-700/50'
              }`}
              title="Staff account credentials sync with the Staff_Users sheet in Google Sheets"
            >
              {connectionStatus === 'connected' ? (
                <>
                  <CloudCheck className="w-3 h-3 text-emerald-400" />
                  <span>Google Sheet Synced</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3 text-amber-400" />
                  <span>Offline Store Active</span>
                </>
              )}
            </span>
            <ThemeSelector variant="dropdown" />
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-zinc-900/90 border border-zinc-700/80 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden">
          {/* Institutional Header Banner */}
          <div className="bg-linear-to-r from-zinc-900 via-indigo-950 to-zinc-900 p-6 text-center border-b border-zinc-800">
            <div className="flex flex-col items-center justify-center mb-3">
              <InstitutionalSeal size="lg" className="mb-2 drop-shadow-md hover:scale-105 transition-transform duration-200" />
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold tracking-widest uppercase">
                <Sparkles className="w-3 h-3" />
                <span>INDIRA GANDHI NATIONAL OPEN UNIVERSITY</span>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Assignment Operations Portal
            </h1>

            <p className="text-xs text-zinc-300 font-medium mt-1">
              Study Centre SC-2033 | S.D. Jain Girls&apos; College, Dimapur
            </p>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              Regional Centre: {settings.regionalCentreCode || 'RC-20 Kohima'}
            </p>
          </div>

          {/* Form Area */}
          <div className="p-6 sm:p-7 space-y-5">
            <div className="text-center">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Staff Authentication Gatekeeper
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Enter your official Study Centre 2033 credentials managed via Google Sheets.
              </p>
            </div>

            {/* Lockout Warning State */}
            {isLocked && (
              <div className="p-4 bg-rose-950/90 border-2 border-rose-600 rounded-lg text-rose-200 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wide">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Security Lockout Triggered</span>
                </div>
                <p className="text-xs leading-relaxed text-rose-200">
                  This station/account has been temporarily locked following 5 consecutive failed authentication attempts.
                </p>
                <div className="flex items-center justify-between text-[11px] font-mono bg-rose-900/40 px-3 py-1.5 rounded-md border border-rose-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    Cooldown Window:
                  </span>
                  <span className="font-bold text-white tabular-nums">{lockoutMinutes} minutes</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Contact Centre Coordinator (Dr. Sant Kumar Gupta) to unlock immediately via Google Sheets (`Staff_Users` tab) or the Admin Terminal.
                </p>
              </div>
            )}

            {/* Normal Error Banner */}
            {!isLocked && errorMessage && (
              <div
                id="gatekeeper-error-banner"
                className="p-3.5 bg-rose-950/80 border border-rose-600/70 rounded-lg text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="leading-relaxed font-medium">{errorMessage}</div>
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <div className="text-[11px] font-mono text-amber-300">
                      ⚠ Security Warning: {remainingAttempts} attempt(s) remaining before progressive lockout.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success Notice */}
            {loginSuccessNotice && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-600/70 rounded-lg text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{loginSuccessNotice}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              {/* Staff ID / Username */}
              <div>
                <label
                  htmlFor="staff-id-input"
                  className="block text-xs font-semibold text-zinc-300 mb-1.5"
                >
                  Staff ID / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="staff-id-input"
                    type="text"
                    value={staffId}
                    onChange={(e) => {
                      setStaffId(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. coordinator, desk01, desk02"
                    autoComplete="username"
                    autoFocus={!staffId}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-md text-white font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-zinc-600 placeholder:font-sans"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="staff-password-input"
                    className="block text-xs font-semibold text-zinc-300"
                  >
                    Account Password
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Google Sheets Managed</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="staff-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Enter account password"
                    autoComplete="current-password"
                    autoFocus={Boolean(staffId)}
                    className="w-full pl-9 pr-10 py-2.5 bg-zinc-950 border border-zinc-700 rounded-md text-white font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-zinc-600 placeholder:font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                    aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember ID Checkbox */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberId}
                    onChange={(e) => setRememberId(e.target.checked)}
                    className="rounded-xs border-zinc-700 text-indigo-600 focus:ring-indigo-500 bg-zinc-950"
                  />
                  <span>Remember Staff ID on this station</span>
                </label>
              </div>

              {/* Sign In Button */}
              <button
                id="btn-unlock-terminal"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm rounded-md shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-indigo-300" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-amber-300" />
                    <span>Sign In & Access Terminal</span>
                  </>
                )}
              </button>
            </form>

            {/* Institutional Information Notice */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-md text-center space-y-1">
              <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                Credentials are authenticated against the <code className="text-indigo-400 font-mono">Staff_Users</code> tab in your connected Google Sheet.
              </p>
              <p className="text-[10px] text-zinc-500">
                Surveillance Watchdog auto-locks terminal after 30 minutes of inactivity. Lockout enforced after 5 failed attempts.
              </p>
            </div>

            {onBackToHome && (
              <div>
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="w-full py-2 px-3 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-950/50 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>Return to Study Centre Home Page</span>
                </button>
              </div>
            )}
          </div>

          {/* Institutional Footer Seal */}
          <div className="bg-zinc-950 px-6 py-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>IGNOU SC-2033 Portal</span>
            </span>
            <span className="font-medium text-zinc-400">
              Coordinator: Dr. Sant K. Gupta
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
