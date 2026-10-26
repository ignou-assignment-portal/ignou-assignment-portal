import React, { useEffect, useState } from 'react';
import { ShieldAlert, Clock, RefreshCw, LogOut } from 'lucide-react';

interface IdleTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtendSession: () => void;
  onLockNow: () => void;
}

export const IdleTimeoutModal: React.FC<IdleTimeoutModalProps> = ({
  isOpen,
  secondsRemaining,
  onExtendSession,
  onLockNow,
}) => {
  const [timeLeft, setTimeLeft] = useState(secondsRemaining);

  useEffect(() => {
    setTimeLeft(secondsRemaining);
  }, [secondsRemaining]);

  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, timeLeft]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-amber-500/30 rounded-lg shadow-2xl p-6 text-zinc-100 overflow-hidden">
        {/* Top Warning Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-amber-500 via-amber-400 to-amber-600" />

        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-amber-400 uppercase font-mono">
                Security Policy Alert
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-400 font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                30-Min Idle Watchdog
              </span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mt-1">
              Terminal Inactivity Warning
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              No activity was detected for 28 minutes. To protect student assignment intake data and evaluator records, this station will lock automatically.
            </p>
          </div>
        </div>

        {/* Countdown Timer Display */}
        <div className="my-5 p-4 bg-zinc-950/70 border border-zinc-800 rounded-md text-center">
          <div className="text-xs text-zinc-400 uppercase tracking-widest font-mono mb-1">
            Auto-Locking In
          </div>
          <div className="text-4xl font-mono font-bold tracking-wider text-amber-400 tabular-nums">
            {formattedTime}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Press Extend Session to continue desk operations without interruption.
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExtendSession}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm rounded-md transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Extend Session (30m)</span>
          </button>
          <button
            type="button"
            onClick={onLockNow}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-medium rounded-md transition-colors border border-zinc-700 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
