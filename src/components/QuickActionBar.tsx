import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TabType } from './Sidebar';
import {
  UserPlus,
  Search,
  Receipt,
  FileCheck2,
  Clock,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { formatDate } from '../utils/helpers';
import { IntakeRecord } from '../types';

interface QuickActionBarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const {
    sessionIntakes,
    allIntakes,
    sessionCourseEvaluations,
    currentSession,
    openReceiptModal,
    openSearchModal,
    setIsSyncDrawerOpen,
    isSyncingSheets,
    syncStatus,
    isAdmin,
  } = useApp();

  // Compute Today's Date String
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute Intakes processed today
  const todayIntakesCount = useMemo(() => {
    return sessionIntakes.filter((i) => {
      const d = (i.submissionDate || i.createdAt || '').slice(0, 10);
      return d === todayStr;
    }).length;
  }, [sessionIntakes, todayStr]);

  // Compute Pending Evaluations in current cycle
  const pendingEvalsCount = useMemo(() => {
    return sessionCourseEvaluations.filter(
      (e) => !e.isLocked && (e.marks === null || e.marks === undefined)
    ).length;
  }, [sessionCourseEvaluations]);

  // Extract recent 4 intakes for the fast desk strip
  // Uses multi-factor recency score (registration timestamp, ID timestamp, token sequence, and date)
  // so newly entered student intakes always appear immediately at the top bar regardless of whether
  // their assignment was submitted today or backdated.
  const recentIntakes = useMemo(() => {
    // Start with current session intakes
    const intakePool: IntakeRecord[] = [...sessionIntakes];
    const poolKeys = new Set(intakePool.map((i) => i.id || i.tokenNo));

    // Also include any intake recorded or modified at the desk within the last 48 hours across all sessions
    const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
    (allIntakes || []).forEach((it) => {
      const key = it.id || it.tokenNo;
      if (!poolKeys.has(key)) {
        const regTime = (it as any).registeredAt ? new Date((it as any).registeredAt).getTime() : 0;
        const upTime = it.updatedAt ? new Date(it.updatedAt).getTime() : 0;
        const idMatch = (it.id || '').match(/(\d{12,14})/);
        const idTime = idMatch ? parseInt(idMatch[1], 10) : 0;
        if (Math.max(regTime, upTime, idTime) > cutoff48h) {
          intakePool.push(it);
          poolKeys.add(key);
        }
      }
    });

    const getRecencyScore = (item: IntakeRecord) => {
      // 1. Desk entry / update wall-clock time
      const regTime = (item as any).registeredAt ? new Date((item as any).registeredAt).getTime() : 0;
      const upTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;

      // 2. Timestamp encoded in ID (e.g. intake-17482910... or REG-17482910...)
      let idTime = 0;
      const idMatch = (item.id || '').match(/(\d{12,14})/);
      if (idMatch) {
        idTime = parseInt(idMatch[1], 10);
      }

      // 3. Sequential Token Sequence Number (e.g. SC2033-JUL26-0042 -> 42)
      let tokenSeq = 0;
      const tokMatch = (item.tokenNo || '').match(/(\d{3,5})$/);
      if (tokMatch) {
        tokenSeq = parseInt(tokMatch[1], 10);
      }

      // 4. Submission / Receipt date fallback
      const createdTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      const subTime = item.submissionDate ? new Date(item.submissionDate).getTime() : 0;

      // Primary desk recency: wall clock registration or ID creation timestamp
      const wallTime = Math.max(regTime, upTime, idTime);
      return {
        wallTime,
        tokenSeq,
        dateFallback: Math.max(createdTime, subTime),
      };
    };

    return intakePool
      .sort((a, b) => {
        const pA = getRecencyScore(a);
        const pB = getRecencyScore(b);

        // If either has a valid desk registration wall-time, sort by that first
        if (pA.wallTime > 0 || pB.wallTime > 0) {
          if (pA.wallTime !== pB.wallTime) {
            return pB.wallTime - pA.wallTime;
          }
        }

        // If sequential token is available, higher token means entered later
        if (pA.tokenSeq > 0 || pB.tokenSeq > 0) {
          if (pA.tokenSeq !== pB.tokenSeq) {
            return pB.tokenSeq - pA.tokenSeq;
          }
        }

        // Otherwise fallback to submission date
        return pB.dateFallback - pA.dateFallback;
      })
      .slice(0, 4);
  }, [sessionIntakes, allIntakes]);

  const handleNewIntakeClick = () => {
    setActiveTab('INTAKE_DESK');
    // Ensure focus shifts to student enrollment input if available
    setTimeout(() => {
      const input = document.getElementById('enrollmentNo') as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  return (
    <div
      id="counter-quick-action-bar"
      className="bg-white border-b border-slate-200/90 px-3 sm:px-6 py-2.5 shadow-2xs transition-colors"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        {/* Left Actions: New Intake Button & Search Shortcut */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={handleNewIntakeClick}
            id="quick-action-new-intake"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
              activeTab === 'INTAKE_DESK'
                ? 'bg-indigo-900 text-white ring-2 ring-indigo-500/30'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            title="Start new student intake submission registration"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span>+ New Intake</span>
          </button>

          <button
            type="button"
            onClick={() => openSearchModal()}
            id="quick-action-search"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs group"
            title="Search student by enrollment number, name, or course (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600 shrink-0" />
            <span>Search Student</span>
            <kbd className="hidden sm:inline px-1.5 py-0.2 text-[10px] font-mono bg-white text-slate-500 rounded border border-slate-200">
              Ctrl+K
            </kbd>
          </button>

          {/* Quick Counter Metrics */}
          <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-slate-200 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Today:</span>
              <strong className="font-mono text-indigo-900">{todayIntakesCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-medium border border-amber-200/60">
              <span>Pending Eval:</span>
              <strong className="font-mono">{pendingEvalsCount}</strong>
            </span>
          </div>
        </div>

        {/* Center / Right Section: Recent Counter Intakes Strip */}
        <div className="flex items-center justify-between lg:justify-end gap-2 min-w-0 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="hidden sm:inline">Recent Intakes:</span>
          </div>

          {recentIntakes.length === 0 ? (
            <span className="text-xs text-slate-400 italic px-2">No intakes yet in this session</span>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              {recentIntakes.map((intake) => {
                const coursesCount = (intake.courseCodes || []).length;
                return (
                  <button
                    key={intake.id || intake.tokenNo}
                    type="button"
                    onClick={() => openReceiptModal(intake)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200/80 bg-slate-50/70 hover:bg-indigo-50/80 hover:border-indigo-200 hover:text-indigo-950 text-slate-700 text-xs transition cursor-pointer shrink-0 shadow-2xs group"
                    title={`Click to view/print receipt for ${intake.studentName} (${intake.enrollmentNo})`}
                  >
                    <Receipt className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                    <span className="font-mono font-bold text-slate-900 text-[11px]">
                      {intake.tokenNo || intake.enrollmentNo}
                    </span>
                    <span className="font-medium text-slate-600 truncate max-w-[85px] sm:max-w-[110px]">
                      {intake.studentName}
                    </span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-500">
                      {coursesCount} crs
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Google Sheets Sync Telemetry Launcher (Coordinator / Admin Only) */}
          {isAdmin && (
            <div className="pl-2 border-l border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setIsSyncDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="Open Google Sheets Telemetry & Cloud Sync Monitor"
              >
                <RefreshCw
                  className={`w-3 h-3 text-emerald-600 shrink-0 ${
                    isSyncingSheets ? 'animate-spin' : ''
                  }`}
                />
                <span className="hidden md:inline font-mono text-[11px]">Sync Monitor</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
