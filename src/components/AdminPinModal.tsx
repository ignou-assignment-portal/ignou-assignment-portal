import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, ShieldAlert, Lock, X, KeyRound, AlertTriangle } from 'lucide-react';

export const AdminPinModal: React.FC = () => {
  const {
    isAdminPinModalOpen,
    closeAdminPinModal,
    verifyAndSetAdminRole,
    adminPinError,
  } = useApp();

  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdminPinModalOpen) {
      setPin('');
      setLocalError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isAdminPinModalOpen]);

  if (!isAdminPinModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setLocalError('Please enter a 4-digit PIN.');
      return;
    }

    const success = verifyAndSetAdminRole(pin);
    if (!success) {
      setPin('');
      setLocalError('Invalid Administrator PIN. Access denied. Reverting to Desk Official role.');
      inputRef.current?.focus();
    }
  };

  const errorMessage = localError || adminPinError;

  return (
    <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div
        id="admin-pin-modal"
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 text-amber-300 flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 leading-tight">
                Administrator PIN Verification
              </h3>
              <p className="text-[11px] text-zinc-500">Security Gate for SC-2033 Coordinator Role</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAdminPinModal}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
            title="Cancel and remain Desk Official"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
          <KeyRound className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Privileged Operational Role</span>
            <p className="text-[11px] text-indigo-900 mt-0.5 leading-normal">
              Switching to the <strong>Administrator (Coordinator)</strong> persona allows evaluator remuneration billing, sanction approvals, rate overrides, and marks unlocking. Authorized institutional personnel only.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold text-[11px]">{errorMessage}</span>
          </div>
        )}

        {/* PIN Input Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 text-center">
              Enter 4-Digit Administrator PIN
            </label>
            <div className="flex justify-center">
              <input
                ref={inputRef}
                id="admin-pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setLocalError(null);
                  setPin(e.target.value.replace(/\D/g, ''));
                }}
                placeholder="••••"
                className="w-40 text-center tracking-[0.5em] text-2xl font-mono font-black py-2.5 px-4 bg-zinc-50 border-2 border-indigo-950/30 focus:border-indigo-600 rounded-xl text-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition shadow-inner"
                autoComplete="off"
              />
            </div>
            <p className="text-[10px] text-center text-zinc-400 mt-2">
              If wrong PIN is entered, session stays restricted to Desk Official.
            </p>
          </div>

          {/* Quick Keypad Simulation */}
          <div className="grid grid-cols-3 gap-1.5 max-w-[220px] mx-auto pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setLocalError(null);
                  if (k === 'C') {
                    setPin('');
                  } else if (k === '⌫') {
                    setPin((prev) => prev.slice(0, -1));
                  } else {
                    if (pin.length < 4) {
                      setPin((prev) => prev + k);
                    }
                  }
                }}
                className={`py-2 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                  k === 'C'
                    ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                    : k === '⌫'
                    ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200'
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={closeAdminPinModal}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition cursor-pointer"
            >
              Cancel (Desk Official)
            </button>
            <button
              type="submit"
              disabled={pin.length !== 4}
              id="submit-admin-pin-btn"
              className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                pin.length === 4
                  ? 'bg-indigo-950 hover:bg-indigo-900 text-white'
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verify & Unlock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
