import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldAlert,
  UserCheck,
  Calendar,
  Layers,
  Building2,
  ChevronDown,
  PlusCircle,
  Clock,
  Sparkles,
  AlertCircle,
  FileCheck2,
  Search,
  Menu,
  Lock,
  RefreshCw,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentSession,
    setSession,
    availableSessions,
    addSession,
    currentRole,
    setRole,
    toggleRole,
    isAdmin,
    isUrlLockedDeskMode,
    sessionIntakes,
    settings,
    openSearchModal,
    isSidebarHidden,
    toggleSidebarHidden,
    isSyncingSheets,
    syncGoogleSheets,
    isSyncingEvaluators,
    syncEvaluatorsDirectory,
    lastSheetSync,
    syncStatus,
  } = useApp();

  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionInput, setNewSessionInput] = useState('');

  const handleAddSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionInput.trim()) return;
    addSession(newSessionInput.trim());
    setNewSessionInput('');
    setIsNewSessionModalOpen(false);
    setIsSessionDropdownOpen(false);
  };

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs">
      {/* Top institution bar */}
      <div className="bg-zinc-900 text-zinc-100 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wider text-amber-400">IGNOU</span>
          <span className="text-zinc-400">|</span>
          <span className="text-zinc-300 font-medium">INDIRA GANDHI NATIONAL OPEN UNIVERSITY</span>
          <span className="hidden sm:inline text-zinc-500">•</span>
          <span className="hidden sm:inline text-zinc-400">Regional Centre: {settings.regionalCentreCode}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Study Centre Portal (SC-2033)</span>
          </div>
          <span className="text-zinc-600 hidden md:inline">|</span>
          <span className="text-zinc-400 hidden md:inline">Coordinator: {settings.coordinatorName}</span>
        </div>
      </div>

      {/* Main header toolbar */}
      <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Burger Button & Centre branding */}
        <div className="flex items-center gap-3">
          <button
            id="sidebar-burger-btn"
            type="button"
            onClick={toggleSidebarHidden}
            className="p-2 rounded-xl text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 transition shadow-2xs cursor-pointer flex items-center justify-center shrink-0"
            title={isSidebarHidden ? 'Show Left Navigation Drawer' : 'Hide Left Navigation Drawer'}
            aria-label="Toggle Navigation Sidebar"
          >
            <Menu className="w-5 h-5 text-indigo-950" />
          </button>

          <div className="w-10 h-10 rounded-lg bg-indigo-950 flex items-center justify-center text-white font-bold text-lg border border-indigo-800 shadow-xs">
            2033
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight">
                Assignment Operations Cell
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-300">
                SC-2033
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-normal">
              {settings.institutionName}
            </p>
          </div>
        </div>

        {/* Right Controls: Global Search + Session Isolation Selector + RBAC Role Switcher */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Module E: Global Student Search & Status Lookup Trigger */}
          <button
            id="global-student-search-btn"
            onClick={() => openSearchModal()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 text-xs font-semibold transition shadow-2xs cursor-pointer group"
            title="Instant Student Status & Evaluation Lookup (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition" />
            <span className="hidden sm:inline">Student Lookup</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 text-zinc-500 rounded border border-zinc-200">
              Ctrl+K
            </kbd>
          </button>

          {/* Strict Session Selector */}
          <div className="relative">
            <button
              id="session-selector-btn"
              onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 text-xs font-medium transition shadow-2xs"
              title="Filter entire application by academic admission/exam cycle"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <div className="text-left">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Active Cycle</div>
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  {currentSession}
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 ml-1" />
            </button>

            {isSessionDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white border border-zinc-200 rounded-xl shadow-lg p-2 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 mb-1">
                  Select Cycle (Isolated Data)
                </div>
                <div className="space-y-1">
                  {availableSessions.map((session) => (
                    <button
                      key={session}
                      onClick={() => {
                        setSession(session);
                        setIsSessionDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                        currentSession === session
                          ? 'bg-indigo-50 text-indigo-900 font-semibold border border-indigo-200'
                          : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${currentSession === session ? 'bg-indigo-600' : 'bg-zinc-300'}`} />
                        {session}
                      </span>
                      {currentSession === session && (
                        <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                          Active
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-zinc-100 mt-2 pt-2">
                  <button
                    onClick={() => {
                      setIsSessionDropdownOpen(false);
                      setIsNewSessionModalOpen(true);
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1.5 font-medium transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add New Academic Cycle
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RBAC Role Switcher Toggle (Hidden if URL mode locks to Desk Official) */}
          {isUrlLockedDeskMode ? (
            <div
              id="role-desk-locked-badge"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-300 text-teal-900 text-xs font-bold shadow-2xs"
              title="URL Parameter (?mode=desk or ?role=official) enforces strict Desk Official operation. Role switcher is disabled."
            >
              <Lock className="w-3.5 h-3.5 text-teal-700" />
              <span>Desk Official (Terminal Locked)</span>
            </div>
          ) : (
            <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button
                id="role-btn-official"
                onClick={() => setRole('OFFICIAL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  !isAdmin
                    ? 'bg-white text-teal-800 shadow-xs border border-teal-300'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Desk Official</span>
              </button>

              <button
                id="role-btn-admin"
                onClick={() => setRole('ADMIN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isAdmin
                    ? 'bg-indigo-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
                title="Requires 4-Digit Administrator PIN (Default: 2033)"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                <span>Coordinator (Admin)</span>
              </button>
            </div>
          )}

          {/* Active Role Indicator Badge */}
          <div className="hidden lg:flex items-center">
            {isUrlLockedDeskMode ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-xs">
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                <span className="font-semibold">Desk Terminal Mode</span>
                <span className="text-[11px] text-teal-600 font-mono">(URL Enforced)</span>
              </div>
            ) : isAdmin ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <span className="font-semibold">Full Admin Access</span>
                <span className="text-[11px] text-indigo-600">(Billing, Rates & Allocation)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-xs">
                <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                <span className="font-semibold">Desk Official Mode</span>
                <span className="text-[11px] text-teal-600">(Registration & Marks Entry)</span>
              </div>
            )}
          </div>

          {/* Google Sheets Backend Sync Button */}
          <button
            id="btn-sync-sheets"
            type="button"
            onClick={() => syncGoogleSheets(false)}
            disabled={isSyncingSheets}
            style={{ touchAction: 'manipulation' }}
            className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 select-none shadow-2xs"
            title={`Sync with Google Sheets (Last synced: ${lastSheetSync})`}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncingSheets ? 'animate-spin' : ''}`} />
            <span className="font-mono text-[11px] whitespace-nowrap">
              {isSyncingSheets ? 'Syncing...' : syncStatus || 'Sync with Google Sheets'}
            </span>
          </button>

          {/* Sync Evaluators Directory Button */}
          <button
            id="btn-sync-evaluators-header"
            onClick={() => syncEvaluatorsDirectory()}
            disabled={isSyncingEvaluators}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            title="Reload latest Academic Counselors / Evaluators Master Directory from Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingEvaluators ? 'animate-spin text-indigo-600' : 'text-indigo-600'}`} />
            <span className="font-mono text-[11px]">{isSyncingEvaluators ? 'Syncing...' : 'Sync Evaluators'}</span>
          </button>
        </div>
      </div>

      {/* New Academic Cycle Modal */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2 text-zinc-900 font-bold text-base">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Initialize New Academic Cycle
              </div>
              <button
                onClick={() => setIsNewSessionModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSession} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Session Name (IGNOU Format)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jan 2028 or July 2028"
                  value={newSessionInput}
                  onChange={(e) => setNewSessionInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  A fresh isolated workspace will be created. Submissions, packets, and bills from previous cycles will remain strictly separated.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Create & Switch Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
