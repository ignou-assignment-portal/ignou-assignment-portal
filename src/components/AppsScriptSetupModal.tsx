import React, { useState } from 'react';
import {
  Code2,
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { OFFICIAL_APPS_SCRIPT_CODE } from '../services/sheetsService';
import { useApp } from '../context/AppContext';

interface AppsScriptSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppsScriptSetupModal: React.FC<AppsScriptSetupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showToast, syncGoogleSheets, isSyncingSheets } = useApp();
  const [copied, setCopied] = useState<boolean>(false);
  const [activeStepTab, setActiveStepTab] = useState<'DEPLOY_STEPS' | 'CODE' | 'ARCHITECTURE'>('DEPLOY_STEPS');

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(OFFICIAL_APPS_SCRIPT_CODE);
      setCopied(true);
      showToast('Master Google Apps Script (Code.gs) copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Please select and copy the code manually.', 'warning');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Code2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white tracking-tight">
                  Google Apps Script Setup (Code.gs)
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SC-2033 Master Script
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete guide to install or update Code.gs in your Google Sheet for Group (A) & (B) operations
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

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 py-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveStepTab('DEPLOY_STEPS')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeStepTab === 'DEPLOY_STEPS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Step-by-Step Deployment Guide
            </button>
            <button
              type="button"
              onClick={() => setActiveStepTab('CODE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeStepTab === 'CODE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              View Full Code.gs Source
            </button>
            <button
              type="button"
              onClick={() => setActiveStepTab('ARCHITECTURE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeStepTab === 'ARCHITECTURE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Separation of (A) & (B) Rules
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Code.gs'}</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-1">

          {/* TAB 1: STEP-BY-STEP DEPLOYMENT GUIDE */}
          {activeStepTab === 'DEPLOY_STEPS' && (
            <div className="space-y-5">
              {/* Notice Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-950 text-xs">
                    How Google Sheets Updates Work
                  </div>
                  <p className="text-amber-900 leading-relaxed text-[11px]">
                    Google Apps Script runs inside your Google Spreadsheet. It exposes an official Web App endpoint (<code>/exec</code>) that this web application connects to. Whenever you add rows or new session tabs in Google Sheets, the script reads them live via <code>doGet()</code>.
                  </p>
                </div>
              </div>

              {/* Numbered Steps */}
              <div className="space-y-3">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Step-by-Step Instructions: Copy, Paste & Deploy in Google Sheets</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-indigo-600">01.</span>
                      <span>Open Your Google Sheet</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Go to Google Drive and open your official IGNOU SC-2033 spreadsheet containing your intake records and admission tabs.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-indigo-600">02.</span>
                      <span>Open Apps Script Editor</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      In the Google Sheets top menu bar, click <strong>Extensions</strong> &rarr; <strong>Apps Script</strong>. A new browser tab will open with the code editor.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-indigo-600">03.</span>
                      <span>Paste Code into Code.gs</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      In the left files list, click <code>Code.gs</code>. Select all existing text (Ctrl+A / Cmd+A), delete it, and paste the copied script.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-indigo-600">04.</span>
                      <span>Save the Script Project</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Click the <strong>Save project</strong> floppy disk icon in the Apps Script toolbar or press <strong>Ctrl+S</strong> / <strong>Cmd+S</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1.5 md:col-span-2">
                    <div className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-indigo-700">05.</span>
                      <span>Deploy / Update Deployment (Crucial Step)</span>
                    </div>
                    <div className="text-[11px] text-indigo-900 space-y-1 leading-relaxed">
                      <p>
                        Click the blue <strong>Deploy</strong> button in the top right corner of Apps Script:
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>
                          <strong>If updating an existing deployment:</strong> Select <strong>Manage deployments</strong> &rarr; Click the <strong>Pencil (Edit) icon</strong> &rarr; In the <strong>Version</strong> dropdown, choose <strong>New version</strong> &rarr; Click <strong>Deploy</strong>.
                        </li>
                        <li>
                          <strong>If creating a new deployment:</strong> Select <strong>New deployment</strong> &rarr; Click gear icon next to "Select type" &rarr; Choose <strong>Web app</strong>.
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-indigo-600">06.</span>
                      <span>Execution Permissions</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Set <strong>Execute as:</strong> <code className="bg-slate-200 px-1 py-0.5 rounded">Me (your-email@gmail.com)</code>. Set <strong>Who has access:</strong> <code className="bg-slate-200 px-1 py-0.5 rounded">Anyone</code>.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-indigo-600">07.</span>
                      <span>Authorize Google Account</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      If prompted, click <strong>Authorize access</strong>, select your Google account, click <strong>Advanced</strong>, then click <strong>Go to Untitled project (unsafe)</strong>, and click <strong>Allow</strong>.
                    </p>
                  </div>
                </div>

                {/* Verification Action */}
                <div className="pt-2 flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="space-y-0.5">
                    <div className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Ready to sync?</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Once deployed in your Google Sheet, click the button to verify connection and pull fresh data.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => syncGoogleSheets(false)}
                    disabled={isSyncingSheets}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSheets ? 'Syncing...' : 'Sync Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CODE.GS FULL SOURCE */}
          {activeStepTab === 'CODE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-xs">Complete Drop-in Code.gs:</span>
                  <p className="text-[11px] text-slate-500">
                    Paste this entire file into Google Apps Script. It handles both Group (A) intake saving and Group (B) multi-tab reading.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-96 border border-slate-800 selection:bg-indigo-700">
                {OFFICIAL_APPS_SCRIPT_CODE}
              </pre>
            </div>
          )}

          {/* TAB 3: SEPARATION OF A & B RULES */}
          {activeStepTab === 'ARCHITECTURE' && (
            <div className="space-y-4">
              <div className="font-bold text-slate-900 text-xs">
                Architectural Separation Policy: Group (A) vs Group (B)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Group A Box */}
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-900 text-white font-bold flex items-center justify-center text-xs">A</span>
                    <h4 className="font-bold text-indigo-950 text-xs">Assignment Operations & Academic</h4>
                  </div>
                  <p className="text-[11px] text-indigo-900 leading-relaxed">
                    <strong>1. Student Intake & Desk</strong>, <strong>2. Evaluation Master</strong>, and <strong>3. SED Award Sheets & Remuneration</strong>.
                  </p>
                  <ul className="text-[11px] text-indigo-800 list-disc pl-4 space-y-1">
                    <li>Saves intake records to Google Sheet (<code>Intake_Register</code>) upon receipt.</li>
                    <li>Always stays in two-way synchronization with Google Sheets.</li>
                    <li>Generates official computerized acknowledgment tokens and SED award sheets.</li>
                  </ul>
                </div>

                {/* Group B Box */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-xs">B</span>
                    <h4 className="font-bold text-amber-950 text-xs">Student Status (Admission & Re-Registration)</h4>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Recorded separately to verify official student registration status and course eligibility.
                  </p>
                  <ul className="text-[11px] text-amber-800 list-disc pl-4 space-y-1">
                    <li><strong>Strict Read-Only:</strong> Web app never pushes, clears, or overwrites admission tabs.</li>
                    <li><strong>Exact Values:</strong> Enrollment No., Name, Programme, Mobile, and Email are preserved verbatim.</li>
                    <li>No fake fallback emails (e.g. <code>@ignou.ac.in</code>) or mock phone generators.</li>
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                <strong>Result:</strong> Group (A) operations do not corrupt or overwrite Group (B) admission records. Your Google Sheets remains the authoritative, uncorrupted master database.
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Strict Read-Only mode active for Admission & Re-Registration tabs</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              {copied ? 'Copied!' : 'Copy Code.gs'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
