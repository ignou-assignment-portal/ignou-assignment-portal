import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lock,
  ShieldAlert,
  UserCheck,
  KeyRound,
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

export const GatekeeperLockScreen: React.FC = () => {
  const { handleLogin, settings } = useApp();
  const [selectedRole, setSelectedRole] = useState<'desk' | 'admin'>('desk');
  const [inputPin, setInputPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!inputPin.trim()) {
      setErrorMessage('Please enter your 4-to-6 digit institutional PIN.');
      return;
    }

    setIsSubmitting(true);
    const success = handleLogin(selectedRole, inputPin.trim());
    setIsSubmitting(false);

    if (!success) {
      setErrorMessage(
        'Access Denied: Invalid Security PIN for selected role. Contact Centre Coordinator (Dr. Sant K. Gupta).'
      );
      setInputPin('');
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-950 via-zinc-900 to-indigo-950 flex flex-col items-center justify-center p-4 sm:p-6 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Subtle background glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Institutional Crest Card */}
        <div className="bg-zinc-900/90 border border-zinc-700/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
          {/* Top Header Banner */}
          <div className="bg-linear-to-r from-zinc-900 via-indigo-950 to-zinc-900 p-6 text-center border-b border-zinc-800">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-widest uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>INDIRA GANDHI NATIONAL OPEN UNIVERSITY</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-bold shadow-xs">
                2033
              </span>
              Assignment Operations Portal
            </h1>

            <p className="text-xs text-zinc-300 font-medium mt-1">
              Study Centre SC-2033 | S.D. Jain Girls&apos; College, Dimapur
            </p>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              Regional Centre: {settings.regionalCentreCode || 'RC-20 Kohima'}
            </p>
          </div>

          {/* Form Content */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-base font-bold text-zinc-100 flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Terminal Security Gatekeeper
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Authorized personnel authentication required to access ledger and records.
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div
                id="gatekeeper-error-banner"
                className="p-3.5 bg-rose-950/80 border border-rose-600/70 rounded-2xl text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              {/* Role Selector Pill Toggle */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Select Operating Role
                </label>
                <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
                  <button
                    id="role-select-desk"
                    type="button"
                    onClick={() => {
                      setSelectedRole('desk');
                      setErrorMessage(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedRole === 'desk'
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Desk Official</span>
                  </button>

                  <button
                    id="role-select-admin"
                    type="button"
                    onClick={() => {
                      setSelectedRole('admin');
                      setErrorMessage(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedRole === 'admin'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Coordinator</span>
                  </button>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1.5 px-1">
                  {selectedRole === 'desk' ? (
                    <span className="text-teal-400 font-medium">
                      ✓ Desk Official: Stage 1 Intake, Stage 2 Ledger Draft, & Student Lookup
                    </span>
                  ) : (
                    <span className="text-indigo-400 font-medium">
                      ✓ Coordinator: Full Master Access, Marks Locking, Billing & PIN Config
                    </span>
                  )}
                </div>
              </div>

              {/* Masked PIN Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="institutional-pin-input"
                    className="block text-xs font-semibold text-zinc-300"
                  >
                    Institutional Access PIN
                  </label>
                  <span className="text-[11px] text-zinc-500 font-mono">4-6 Digits</span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <KeyRound className="w-4 h-4" />
                  </div>

                  <input
                    id="institutional-pin-input"
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="Enter Security PIN"
                    value={inputPin}
                    onChange={(e) => {
                      setInputPin(e.target.value.replace(/\D/g, ''));
                      if (errorMessage) setErrorMessage(null);
                    }}
                    autoFocus
                    className="w-full pl-10 pr-11 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono text-center tracking-widest text-lg font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-zinc-600 placeholder:text-sm placeholder:tracking-normal placeholder:font-sans"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    title={showPin ? 'Hide PIN' : 'Show PIN'}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Unlock Terminal Action Button */}
              <button
                id="btn-unlock-terminal"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-linear-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:from-indigo-800 active:to-indigo-900 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-indigo-500/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4 text-amber-300" />
                <span>Unlock Terminal / Sign In</span>
              </button>
            </form>

            {/* Institutional Confidentiality Notice */}
            <div className="p-3.5 bg-zinc-950/70 border border-zinc-800/90 rounded-2xl text-center space-y-1">
              <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                Authorized institutional personnel only. Enter the terminal PIN assigned by the Centre Coordinator (SC-2033).
              </p>
              <p className="text-[10px] text-zinc-500">
                Inactivity protection auto-locks after 30 minutes. Tab closure securely terminates session.
              </p>
            </div>
          </div>

          {/* Institutional Footer Seal */}
          <div className="bg-zinc-950 px-6 py-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
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
