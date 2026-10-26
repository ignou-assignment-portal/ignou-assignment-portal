import React, { useState, useMemo } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  Database,
  Trash2,
  Check,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  reconcileLedgerFromIntakes,
  pushCleanedLedgerToSheets,
  ReconciliationResult,
} from '../services/ledgerReconciliationService';

interface LedgerDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LedgerDuplicateModal: React.FC<LedgerDuplicateModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentSession,
    intakes,
    courseLedger,
    setCourseLedger,
    showToast,
    logAuditEvent,
    currentRole,
    settings,
  } = useApp();

  const [isApplying, setIsApplying] = useState(false);
  const [isPushingSheets, setIsPushingSheets] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [sheetsPushedSuccess, setSheetsPushedSuccess] = useState(false);

  // Compute real-time reconciliation analysis
  const reconResult: ReconciliationResult = useMemo(() => {
    return reconcileLedgerFromIntakes(intakes, courseLedger, currentSession);
  }, [intakes, courseLedger, currentSession]);

  const candidateCount = useMemo(() => {
    const list = intakes.filter((i) => i.session === currentSession);
    const uniqueEnrs = new Set(list.map((i) => i.enrollmentNo.trim().toUpperCase()));
    return uniqueEnrs.size || list.length;
  }, [intakes, currentSession]);

  if (!isOpen) return null;

  const handleApplyReconciliation = () => {
    setIsApplying(true);
    try {
      // 1. Update React State
      setCourseLedger(reconResult.reconciledLedger);

      // 2. Persist to localStorage
      try {
        localStorage.setItem('ignou_sc2033_course_ledger', JSON.stringify(reconResult.reconciledLedger));
        localStorage.setItem('ignou_sc2033_course_evaluations', JSON.stringify(reconResult.reconciledLedger));
      } catch (e) {
        console.warn('Failed saving reconciled ledger to localStorage', e);
      }

      // 3. Post to backend Express store
      try {
        fetch('/api/intake/reconcile-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session: currentSession,
            reconciledLedger: reconResult.reconciledLedger,
          }),
        }).catch(() => {});
      } catch {}

      // 4. Log audit event
      logAuditEvent({
        action: 'LEDGER_RECONCILED',
        category: 'MARKS_EVALUATION',
        actor: currentRole === 'ADMIN' ? `${settings.coordinatorName || 'Coordinator'} (Admin)` : 'Desk Official',
        role: currentRole,
        session: currentSession,
        summary: `Reconciled Course Ledger: Replaced ${reconResult.originalLedgerCount} entries with ${reconResult.canonicalScriptCount} canonical scripts, removing ${reconResult.duplicateCount} duplicate entries.`,
        details: {
          originalCount: reconResult.originalLedgerCount,
          reconciledCount: reconResult.canonicalScriptCount,
          duplicatesRemoved: reconResult.duplicateCount,
        },
        status: 'SUCCESS',
      });

      setAppliedSuccess(true);
      showToast(
        `Course Ledger strictly re-synced! Now showing exactly ${reconResult.canonicalScriptCount} scripts for ${candidateCount} candidates.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Error reconciling course ledger.', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const handlePushToGoogleSheets = async () => {
    setIsPushingSheets(true);
    try {
      const res = await pushCleanedLedgerToSheets(reconResult.reconciledLedger);
      if (res.success) {
        setSheetsPushedSuccess(true);
        showToast(
          `Google Sheets Course_Ledger tab updated with ${res.rowsPushed} canonical scripts!`,
          'success'
        );
      } else {
        showToast(res.message, 'warning');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to sync to Google Sheets.', 'error');
    } finally {
      setIsPushingSheets(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-300 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white tracking-tight">
                  Course Ledger Discrepancy & Duplicate Reconciliation
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                  {currentSession}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Reconcile Course Ledger strictly from the registered candidates in Intake Register
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-slate-700 text-sm">
          
          {/* Comparison KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Intake Register
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {candidateCount}
                </span>
                <span className="text-xs text-slate-600 font-medium">Candidates</span>
              </div>
              <div className="mt-1 text-xs text-indigo-700 font-bold font-mono">
                {reconResult.canonicalScriptCount} Registered Scripts
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
              <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                Current Evaluation Master
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-950">
                  {reconResult.originalLedgerCount}
                </span>
                <span className="text-xs text-amber-800 font-medium">Scripts in Ledger</span>
              </div>
              <div className="mt-1 text-xs text-rose-700 font-bold font-mono">
                +{reconResult.duplicateCount} Duplicate Rows
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
              <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                Reconciled Canonical Target
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-950">
                  {reconResult.canonicalScriptCount}
                </span>
                <span className="text-xs text-emerald-800 font-medium">Exact Scripts</span>
              </div>
              <div className="mt-1 text-xs text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Duplicate Parity</span>
              </div>
            </div>
          </div>

          {/* Audit & Explanation Note */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-600 space-y-1.5 leading-relaxed">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero-Data-Loss Conflict Resolution Policy</span>
            </div>
            <p>
              When reconciling the ledger, the engine matches each student's registered courses directly from the Intake Register. For any duplicate unpacked row:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>
                <strong>Marks & Evaluation Safeguard:</strong> If one duplicate entry has entered marks or an assigned evaluator, that specific row is strictly preserved.
              </li>
              <li>
                <strong>Dual Component Allowance:</strong> Courses with legitimate distinct components (e.g. Theory Assignment + Practical record like BAPI-003) retain both rows. Redundant duplicate copies of the same component are pruned.
              </li>
              <li>
                <strong>Immediate Web App Parity:</strong> The Evaluation Master will instantly reflect exactly <strong>{reconResult.canonicalScriptCount} scripts</strong>.
              </li>
            </ul>
          </div>

          {/* Duplicates Audit List (if duplicates found) */}
          {reconResult.duplicatesAudited.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Identified Duplicate Entries ({reconResult.duplicatesAudited.length})</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Component-Aware Deduplication
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs">
                {reconResult.duplicatesAudited.map((dup, idx) => (
                  <div key={idx} className="p-3 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 font-mono font-bold text-slate-900">
                        <span>{dup.enrollmentNo}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-indigo-900">{dup.studentName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                          {dup.courseCode} ({dup.componentType})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {dup.actionTaken}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>Pruning {dup.duplicateCount - 1} extra row</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : reconResult.duplicateCount > 0 ? (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Found <strong>{reconResult.duplicateCount}</strong> duplicate or unlinked script rows in the Course Ledger that exceed the {reconResult.canonicalScriptCount} registered course entries.
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                The Course Ledger is currently in 100% parity with the Intake Register (<strong>{reconResult.canonicalScriptCount} scripts</strong>). No duplicate entries detected.
              </span>
            </div>
          )}

          {/* Success Banners */}
          {appliedSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Web App Course Ledger successfully reconciled to <strong>{reconResult.canonicalScriptCount} scripts</strong>!
                </span>
              </div>
              {!sheetsPushedSuccess && (
                <button
                  type="button"
                  onClick={handlePushToGoogleSheets}
                  disabled={isPushingSheets}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition cursor-pointer shadow-xs shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{isPushingSheets ? 'Syncing to Sheets...' : 'Sync Cleaned Ledger to Google Sheets'}</span>
                </button>
              )}
            </div>
          )}

          {sheetsPushedSuccess && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2 font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Google Sheets Course_Ledger tab is now updated with the clean {reconResult.canonicalScriptCount} scripts.
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-mono">
            Target parity: {candidateCount} Candidates = {reconResult.canonicalScriptCount} Scripts
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              {appliedSuccess ? 'Done' : 'Cancel'}
            </button>

            {!appliedSuccess ? (
              <button
                type="button"
                onClick={handleApplyReconciliation}
                disabled={isApplying || reconResult.duplicateCount === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Reconciling Ledger...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Strictly Re-sync Ledger ({reconResult.canonicalScriptCount} Scripts)</span>
                  </>
                )}
              </button>
            ) : !sheetsPushedSuccess ? (
              <button
                type="button"
                onClick={handlePushToGoogleSheets}
                disabled={isPushingSheets}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPushingSheets ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing to Google Sheets...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Sync Cleaned Ledger to Google Sheets</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
};
