import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ThemeSelector } from './ThemeSelector';
import { DataSyncMonitor } from './DataSyncMonitor';
import { RbacGovernanceSettings } from './RbacGovernanceSettings';
import { CentreInstallAppBanner } from './CentreInstallAppBanner';
import { formatCurrency, formatDate, formatDateTime } from '../utils/helpers';
import { SessionArchiveRecord, RbacOperation, RbacAccessLevel } from '../types';
import {
  Settings,
  Building2,
  DollarSign,
  Calendar,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Lock,
  KeyRound,
  UserCheck,
  Save,
  CheckCircle2,
  Archive,
  History as HistoryIcon,
  Sparkles,
  CalendarPlus,
  Trash2,
  Eye,
  Clock,
  FileText,
  AlertTriangle,
  Layers,
  Users,
  FileCheck2,
  X,
  Info,
  Palette,
  Maximize2,
  Minimize2,
  ChevronUp,
  RefreshCw,
  Sun,
  Moon,
  Database,
  Activity,
  Check,
  SlidersHorizontal,
  Code,
  Copy,
} from 'lucide-react';
import { OFFICIAL_APPS_SCRIPT_CODE, SCRIPT_URL } from '../services/sheetsService';

type SettingsTabId = 'general' | 'appearance' | 'rates' | 'sync' | 'rbac';

export const SystemSettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetAllData,
    isAdmin,
    isUrlLockedDeskMode,
    userRole,
    rbacConfig,
    updateRbacConfig,
    resetRbacToDefaults,
    allIntakes,
    sessionIntakes,
    sessionCourseEvaluations,
    sessionPackets,
    sessionBills,
    evaluators,
    currentSession,
    availableSessions,
    showToast,
    securityPins,
    updateSecurityPins,
    archives,
    createSessionArchive,
    deleteArchive,
    restoreArchive,
    downloadArchiveJSON,
    importArchiveJSON,
    auditLogs,
    exportAuditLogsCSV,
    exportAuditLogsJSON,
    isHeaderCompact,
    toggleHeaderCompact,
    isContentFullWidth,
    toggleContentFullWidth,
    isDark,
    toggleDark,
    connectionStatus,
    isSyncingSheets,
    syncGoogleSheets,
    isSyncingEvaluators,
    syncEvaluatorsDirectory,
    lastSheetSync,
    lastLatencyMs,
    pendingSyncQueue,
    toggleSyncDrawer,
  } = useApp();

  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');

  // Helper to suggest next academic cycle
  const getSuggestedNextSession = (curr: string) => {
    const parts = (curr || '').trim().split(/\s+/);
    if (parts.length >= 2) {
      const term = parts[0].toLowerCase();
      const year = parseInt(parts[1], 10);
      if (!isNaN(year)) {
        if (term.includes('jul')) {
          return `January ${year + 1}`;
        } else if (term.includes('jan')) {
          return `July ${year}`;
        }
      }
    }
    return `January ${new Date().getFullYear() + 1}`;
  };

  // Archival States
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [selectedArchiveDetail, setSelectedArchiveDetail] = useState<SessionArchiveRecord | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // Google Apps Script Diagnostics State
  const [isTestingScript, setIsTestingScript] = useState(false);
  const [scriptTestResult, setScriptTestResult] = useState<{
    status: 'success' | 'error' | null;
    message?: string;
    details?: any;
    testedAt?: string;
  }>({ status: null });
  const [hasCopiedScript, setHasCopiedScript] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);

  const handleTestScriptConnection = async () => {
    setIsTestingScript(true);
    try {
      const activeUrl = settings.appsScriptUrl || settings.googleSheetScriptUrl || SCRIPT_URL;
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PING', scriptUrl: activeUrl }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.reachable) {
        setScriptTestResult({
          status: 'success',
          message: data.message || 'Connection verified: Google Apps Script responded successfully.',
          details: data,
          testedAt: new Date().toLocaleTimeString(),
        });
        showToast('Google Apps Script connection verified successfully!', 'success');
      } else {
        setScriptTestResult({
          status: 'error',
          message: data.message || 'Google Apps Script endpoint pending or unreachable. Operating in local storage mode with zero data loss.',
          details: data,
          testedAt: new Date().toLocaleTimeString(),
        });
        showToast(
          data.localMode ? 'Local storage mode active (zero data loss)' : 'Google Sheets responded with warning',
          'info'
        );
      }
    } catch (err: any) {
      setScriptTestResult({
        status: 'error',
        message: 'Could not connect to Google Apps Script. Operating in local storage mode with zero data loss.',
        testedAt: new Date().toLocaleTimeString(),
      });
      showToast('Operating in local storage mode with zero data loss', 'info');
    } finally {
      setIsTestingScript(false);
    }
  };

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(OFFICIAL_APPS_SCRIPT_CODE);
    setHasCopiedScript(true);
    showToast('Updated Code.gs copied to clipboard!', 'success');
    setTimeout(() => setHasCopiedScript(false), 3000);
  };

  const [archiveForm, setArchiveForm] = useState({
    name: `${currentSession} Closeout Archive`,
    session: currentSession,
    mode: 'archive_and_fresh' as 'archive_and_fresh' | 'snapshot_only',
    newSessionName: getSuggestedNextSession(currentSession),
    notes: 'Academic cycle completed. Assignment data frozen into historical archive.',
    downloadJSON: true,
  });

  useEffect(() => {
    setArchiveForm((prev) => ({
      ...prev,
      name: `${currentSession} Closeout Archive`,
      session: currentSession,
      newSessionName: getSuggestedNextSession(currentSession),
    }));
  }, [currentSession]);

  const handleOpenArchiveModal = (mode: 'archive_and_fresh' | 'snapshot_only') => {
    setArchiveForm((prev) => ({
      ...prev,
      mode,
      name: mode === 'archive_and_fresh' ? `${currentSession} Final Closeout Archive` : `${currentSession} Point-in-Time Snapshot`,
      session: currentSession,
      newSessionName: getSuggestedNextSession(currentSession),
    }));
    setIsArchiveModalOpen(true);
  };

  const handleConfirmArchive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (archiveForm.mode === 'archive_and_fresh') {
      const confirmed = window.confirm(
        `Are you sure you want to snapshot session '${archiveForm.session}' into History and start fresh for session '${archiveForm.newSessionName}'?\n\nThis will freeze the current session's assignment intake, course ledger, and packets into History and reset the active registers for this session. Evaluators directory and study centre details will be preserved.`
      );
      if (!confirmed) return;
    }

    createSessionArchive({
      name: archiveForm.name.trim() || `${archiveForm.session} Archive`,
      session: archiveForm.session,
      notes: archiveForm.notes.trim(),
      startNewSession: archiveForm.mode === 'archive_and_fresh',
      newSessionName: archiveForm.mode === 'archive_and_fresh' ? archiveForm.newSessionName.trim() : undefined,
      downloadJSON: archiveForm.downloadJSON,
    });

    setIsArchiveModalOpen(false);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        importArchiveJSON(parsed);
      } catch (err: any) {
        alert(`Failed to import archive file: ${err?.message || 'Invalid JSON format'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRestoreArchiveConfirm = (archive: SessionArchiveRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore archive snapshot '${archive.name}' for session '${archive.session}' into the active workspace?\n\nThis will load ${archive.stats.totalCourseScripts} course scripts and ${archive.stats.totalIntakes} intake records back into the active database.`
    );
    if (confirmed) {
      restoreArchive(archive.id);
      setSelectedArchiveDetail(null);
    }
  };

  const handleDeleteArchiveConfirm = (archive: SessionArchiveRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete historical snapshot '${archive.name}' (${archive.session}) from History? This cannot be undone.`
    );
    if (confirmed) {
      deleteArchive(archive.id);
      if (selectedArchiveDetail?.id === archive.id) {
        setSelectedArchiveDetail(null);
      }
    }
  };

  const [deskPinInput, setDeskPinInput] = useState(securityPins.deskPin || '1001');
  const [adminPinInput, setAdminPinInput] = useState(securityPins.adminPin || '2033');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinError, setPinError] = useState('');

  const handleSavePins = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!deskPinInput.trim() || deskPinInput.trim().length < 4) {
      setPinError('Desk Official PIN must be at least 4 digits.');
      return;
    }
    if (!adminPinInput.trim() || adminPinInput.trim().length < 4) {
      setPinError('Administrator PIN must be at least 4 digits.');
      return;
    }
    setPinError('');
    updateSecurityPins({
      deskPin: deskPinInput.trim(),
      adminPin: adminPinInput.trim(),
    });
    setPinSuccess(true);
    setTimeout(() => setPinSuccess(false), 3000);
  };

  const [systemSettings, setSystemSettings] = useState(() => {
    const saved = localStorage.getItem("ignou_sc2033_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          centreCode: parsed.centreCode || "SC-2033",
          regionalCentre: parsed.regionalCentre || parsed.regionalCentreCode || "RC-20 Kohima",
          hostInstitution: parsed.hostInstitution || parsed.institutionName || "S.D. Jain Girls' College, Dimapur",
          coordinatorName: parsed.coordinatorName || "Dr. Sant K. Gupta",
          coordinatorPhone: parsed.coordinatorPhone || "9436013686",
          coordinatorEmail: parsed.coordinatorEmail || "sant.k.gupta@gmail.com",
          coordinatorDesignation: parsed.coordinatorDesignation || "Coordinator, IGNOU SC-2033",
          remunerationRatePerScript: parsed.remunerationRatePerScript !== undefined ? parsed.remunerationRatePerScript : settings.remunerationRatePerScript || 27.50,
          conveyanceAllowancePerPacket: parsed.conveyanceAllowancePerPacket !== undefined ? parsed.conveyanceAllowancePerPacket : (settings.conveyanceAllowancePerPacket ?? 0.00),
          coordinationChargesPerScript: parsed.coordinationChargesPerScript !== undefined ? parsed.coordinationChargesPerScript : (settings.coordinationChargesPerScript ?? 0.00),
          adminPin: parsed.adminPin || settings.adminPin || "2033",
        };
      } catch (e) {
        console.warn("Failed to parse ignou_sc2033_settings:", e);
      }
    }
    return {
      centreCode: "SC-2033",
      regionalCentre: "RC-20 Kohima",
      hostInstitution: "S.D. Jain Girls' College, Dimapur",
      coordinatorName: "Dr. Sant K. Gupta",
      coordinatorPhone: "9436013686",
      coordinatorEmail: "sant.k.gupta@gmail.com",
      coordinatorDesignation: "Coordinator, IGNOU SC-2033",
      remunerationRatePerScript: settings.remunerationRatePerScript || 27.50,
      conveyanceAllowancePerPacket: settings.conveyanceAllowancePerPacket ?? 0.00,
      coordinationChargesPerScript: settings.coordinationChargesPerScript ?? 0.00,
      adminPin: settings.adminPin || "2033",
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const updatedSettings = {
      ...settings,
      ...systemSettings,
      centreCode: systemSettings.centreCode.trim(),
      regionalCentre: systemSettings.regionalCentre.trim(),
      regionalCentreCode: systemSettings.regionalCentre.includes('Kohima')
        ? (systemSettings.regionalCentre.includes('(') ? systemSettings.regionalCentre : `${systemSettings.regionalCentre} (Regional Centre Kohima)`)
        : systemSettings.regionalCentre,
      hostInstitution: systemSettings.hostInstitution.trim(),
      institutionName: systemSettings.hostInstitution.trim(),
      collegeName: systemSettings.hostInstitution.trim(),
      coordinatorName: systemSettings.coordinatorName.trim(),
      coordinatorPhone: systemSettings.coordinatorPhone.trim(),
      coordinatorEmail: systemSettings.coordinatorEmail.trim(),
      coordinatorDesignation: systemSettings.coordinatorDesignation?.trim() || 'Coordinator, IGNOU SC-2033',
      coordinatorContact: `+91 ${systemSettings.coordinatorPhone.trim()} | ${systemSettings.coordinatorEmail.trim()}`,
      remunerationRatePerScript: Number(systemSettings.remunerationRatePerScript) || 27.50,
      conveyanceAllowancePerPacket: Number(systemSettings.conveyanceAllowancePerPacket) || 0.00,
      coordinationChargesPerScript: Number(systemSettings.coordinationChargesPerScript) || 0.00,
      adminPin: systemSettings.adminPin || '2033',
    };

    localStorage.setItem("ignou_sc2033_settings", JSON.stringify(updatedSettings));
    updateSettings(updatedSettings);
    showToast("Institutional Settings Saved", "success");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportAllJSON = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      centreCode: settings.centreCode,
      currentSession,
      settings,
      evaluators,
      allIntakes,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `IGNOU_SC2033_InstitutionalBackup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900">
              Study Centre Configuration & Governance
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Configure institutional parameters, visual themes, statutory remuneration rates, and data sync parity for SC-2033.
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Read-Only Mode: Settings modification requires Coordinator PIN (2033).</span>
          </div>
        )}
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>System configuration parameters saved successfully.</span>
        </div>
      )}

      {/* Structured Configuration Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-zinc-100/90 rounded-2xl border border-zinc-200 overflow-x-auto shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'general'
              ? 'bg-white text-indigo-950 shadow-xs border border-zinc-200'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50'
          }`}
        >
          <Building2 className={`w-4 h-4 ${activeTab === 'general' ? 'text-indigo-600' : 'text-zinc-500'}`} />
          <span>General</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'appearance'
              ? 'bg-white text-indigo-950 shadow-xs border border-zinc-200'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50'
          }`}
        >
          <Palette className={`w-4 h-4 ${activeTab === 'appearance' ? 'text-indigo-600' : 'text-zinc-500'}`} />
          <span>Appearance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rates')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'rates'
              ? 'bg-white text-indigo-950 shadow-xs border border-zinc-200'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50'
          }`}
        >
          <DollarSign className={`w-4 h-4 ${activeTab === 'rates' ? 'text-emerald-600' : 'text-zinc-500'}`} />
          <span>Rates & Norms</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'sync'
              ? 'bg-white text-indigo-950 shadow-xs border border-zinc-200'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${activeTab === 'sync' ? 'text-indigo-600' : 'text-zinc-500'}`} />
          <span>Data Sync & Governance</span>
          {pendingSyncQueue.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500 text-white font-bold">
              {pendingSyncQueue.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rbac')}
          id="btn-settings-tab-rbac"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'rbac'
              ? 'bg-white text-indigo-950 shadow-xs border border-zinc-200'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50'
          }`}
        >
          <ShieldCheck className={`w-4 h-4 ${activeTab === 'rbac' ? 'text-indigo-600' : 'text-zinc-500'}`} />
          <span>Access Control & RBAC</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
            Gov
          </span>
        </button>
      </div>

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Centre Details */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Institutional Centre Details</span>
                </div>
                <span className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                  IGNOU Mandate
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Study Centre Code</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={systemSettings.centreCode}
                    onChange={(e) => setSystemSettings({ ...systemSettings, centreCode: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono font-bold bg-zinc-50 disabled:opacity-75 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Regional Centre</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={systemSettings.regionalCentre}
                    onChange={(e) => setSystemSettings({ ...systemSettings, regionalCentre: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-zinc-700 mb-1">Host College / Institution Name</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={systemSettings.hostInstitution}
                    onChange={(e) => setSystemSettings({ ...systemSettings, hostInstitution: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Coordinator Name</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={systemSettings.coordinatorName}
                    onChange={(e) => setSystemSettings({ ...systemSettings, coordinatorName: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Coordinator Official Designation</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={systemSettings.coordinatorDesignation}
                    onChange={(e) => setSystemSettings({ ...systemSettings, coordinatorDesignation: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Coordinator Contact Phone</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={systemSettings.coordinatorPhone}
                    onChange={(e) => setSystemSettings({ ...systemSettings, coordinatorPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Coordinator Email</label>
                  <input
                    type="email"
                    disabled={!isAdmin}
                    value={systemSettings.coordinatorEmail}
                    onChange={(e) => setSystemSettings({ ...systemSettings, coordinatorEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-3 border-t border-zinc-100">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Institutional Details</span>
                  </button>
                </div>
              )}
            </div>
          </form>

          {/* Dedicated In-App PWA Install Banner (Centre Configuration) */}
          <CentreInstallAppBanner />

          {/* Security Credentials Management (Gatekeeper PINs) */}
          {!isUrlLockedDeskMode && isAdmin && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Security Credentials Management (Gatekeeper PINs)</span>
                </div>
                <span className="text-[10px] font-mono bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                  LocalStorage: ignou_sc2033_pins
                </span>
              </div>

              <p className="text-xs text-zinc-500">
                Customize the institutional authentication credentials required at the Gatekeeper terminal login screen. Changes take effect across all application sessions.
              </p>

              {pinSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Security PINs updated and stored successfully.</span>
                </div>
              )}

              {pinError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-semibold">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-800">Desk Official Terminal PIN</label>
                    <span className="text-[10px] text-zinc-400 font-mono">Default: 1001</span>
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={deskPinInput}
                    onChange={(e) => setDeskPinInput(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-center tracking-widest text-sm font-bold bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="1001"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Restricted access to Stage 1 (Intake Desk) and Stage 2 (Draft Evaluation Ledger).
                  </p>
                </div>

                <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-800">Administrator (Coordinator) PIN</label>
                    <span className="text-[10px] text-zinc-400 font-mono">Default: 2033</span>
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-center tracking-widest text-sm font-bold bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="2033"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Master access to all stages, marks locking, billing, rate config, and delete operations.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSavePins}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Institutional PINs</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Workspace Layout & Density Toggles */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span>Workspace Layout & Density Controls</span>
              </div>
              <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded border border-zinc-200">
                User Preference
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Header Compactness Mode */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 text-sm">Top Institution Header Bar</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isHeaderCompact ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      {isHeaderCompact ? 'Compact (Hidden)' : 'Expanded (Visible)'}
                    </span>
                  </div>
                  <p className="text-zinc-500 mt-1">
                    Toggle visibility of the top dark IGNOU institution bar. Compact mode preserves 36px of vertical screen real estate for high-volume intake lists.
                  </p>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={toggleHeaderCompact}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 font-semibold text-zinc-800 shadow-2xs transition cursor-pointer"
                  >
                    <ChevronUp className={`w-3.5 h-3.5 transition-transform ${isHeaderCompact ? 'rotate-180 text-indigo-600' : ''}`} />
                    <span>{isHeaderCompact ? 'Expand Top Bar' : 'Enable Compact Header'}</span>
                  </button>
                </div>
              </div>

              {/* Viewport Width Mode */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 text-sm">Main Content Viewport Width</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isContentFullWidth ? 'bg-indigo-100 text-indigo-900' : 'bg-zinc-200 text-zinc-800'
                    }`}>
                      {isContentFullWidth ? 'Fluid (100% Edge-to-Edge)' : 'Standard (1280px Centered)'}
                    </span>
                  </div>
                  <p className="text-zinc-500 mt-1">
                    Fluid mode expands data tables and registers across your full monitor width. Standard mode centers content in an executive 1280px container.
                  </p>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={toggleContentFullWidth}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 font-semibold text-zinc-800 shadow-2xs transition cursor-pointer"
                  >
                    {isContentFullWidth ? (
                      <Minimize2 className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                    <span>{isContentFullWidth ? 'Switch to Standard 1280px' : 'Switch to Full Width 100%'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Theme & Visual Appearance Cards */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
            <ThemeSelector variant="cards" />
          </div>
        </div>
      )}

      {/* TAB 3: RATES & NORMS */}
      {activeTab === 'rates' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Financial & Evaluation Rates */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Financial Norms & Remuneration Rates (IGNOU Mandate)</span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  Statutory Claim Engine
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Remuneration Rate / Script (₹)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    disabled={!isAdmin}
                    value={systemSettings.remunerationRatePerScript}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, remunerationRatePerScript: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Standard study centre evaluation rate (₹27.50)
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Conveyance Allowance / Packet (₹)
                  </label>
                  <input
                    type="number"
                    disabled={!isAdmin}
                    value={systemSettings.conveyanceAllowancePerPacket}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, conveyanceAllowancePerPacket: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Default ₹0.00 unless applicable
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Coordination Charges / Script (₹)
                  </label>
                  <input
                    type="number"
                    disabled={!isAdmin}
                    value={systemSettings.coordinationChargesPerScript}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, coordinationChargesPerScript: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Default ₹0.00 unless applicable
                  </span>
                </div>
              </div>

              {/* Admin PIN configuration */}
              <div className="pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-2 mb-2 font-bold text-xs text-zinc-900">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Administrator Role Security PIN</span>
                </div>
                <div className="max-w-xs">
                  <label className="block font-semibold text-zinc-700 mb-1 text-xs">
                    4-Digit Admin Authentication PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={systemSettings.adminPin}
                    onChange={(e) => setSystemSettings({ ...systemSettings, adminPin: e.target.value })}
                    placeholder="2033"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono tracking-widest text-center font-bold text-sm bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Default PIN is 2033. Required when switching roles to Coordinator (Admin).
                  </span>
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-3 border-t border-zinc-100">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Financial Rates</span>
                  </button>
                </div>
              )}
            </div>
          </form>

          {/* Statutory Mandate Guidelines Info */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-xs text-zinc-600 space-y-2">
            <div className="font-bold text-zinc-900 flex items-center gap-2 text-sm">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>IGNOU Statutory Remuneration Rules & Compliance</span>
            </div>
            <p>
              Under IGNOU Financial Code norms, academic counselors who evaluate term-end assignment scripts are compensated at fixed rates per script upon verified submission of SED 3-Part Award Sheets.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-500 pt-1">
              <li>Scripts evaluated must be sealed in packets before bill processing.</li>
              <li>TDS deduction and PAN validation occur automatically on evaluator disbursement vouchers.</li>
              <li>Claims are calculated across sealed course packets in Stage 4 (Remuneration Billing).</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: DATA SYNC & GOVERNANCE */}
      {activeTab === 'sync' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Google Sheets Sync & Remote Parity */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-2">
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Google Sheets Live Data Parity & Offline Queue</span>
              </div>
              <div className="flex items-center gap-2">
                <DataSyncMonitor />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] text-zinc-500 uppercase font-semibold">Connection State</div>
                <div className="text-sm font-bold text-zinc-900 mt-0.5 capitalize flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-500' :
                    connectionStatus === 'syncing' ? 'bg-indigo-500 animate-spin' :
                    connectionStatus === 'queued' ? 'bg-amber-500' : 'bg-rose-500'
                  }`} />
                  <span>{connectionStatus}</span>
                </div>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] text-zinc-500 uppercase font-semibold">Roundtrip Latency</div>
                <div className="text-sm font-bold text-zinc-900 font-mono mt-0.5">
                  {lastLatencyMs !== null ? `${lastLatencyMs}ms` : 'Nominal'}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] text-zinc-500 uppercase font-semibold">Offline Queue</div>
                <div className="text-sm font-bold font-mono mt-0.5 text-zinc-900">
                  {pendingSyncQueue.length} Pending
                </div>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] text-zinc-500 uppercase font-semibold">Last Sheet Sync</div>
                <div className="text-xs font-semibold text-zinc-700 truncate mt-0.5 font-mono">
                  {lastSheetSync || 'Active session'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => syncGoogleSheets(true)}
                disabled={isSyncingSheets}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                <span>{isSyncingSheets ? 'Pulling Data...' : 'Pull Latest Sheet Intake'}</span>
              </button>

              <button
                type="button"
                onClick={() => syncEvaluatorsDirectory()}
                disabled={isSyncingEvaluators}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Users className={`w-3.5 h-3.5 ${isSyncingEvaluators ? 'animate-spin text-indigo-600' : 'text-indigo-600'}`} />
                <span>{isSyncingEvaluators ? 'Syncing...' : 'Sync Evaluators Directory'}</span>
              </button>

              <button
                type="button"
                onClick={toggleSyncDrawer}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-zinc-600" />
                <span>Open Parity Inspector Drawer</span>
              </button>
            </div>
          </div>

          {/* Google Apps Script Backend (Code.gs) & Live Sync Diagnostics */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-2">
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                <Code className="w-4 h-4 text-indigo-600" />
                <span>Google Apps Script (Code.gs) & Assignment Persistence Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200 font-semibold">
                  Intake & Course Ledger Parity
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              To guarantee that all student assignment intakes save directly into your Google Sheet and auto-unpack into individual course ledger rows, deploy this updated <strong>Code.gs</strong> script into your connected Google Spreadsheet.
            </p>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-semibold text-zinc-800 flex items-center gap-2">
                    <span>Connected Apps Script Web App</span>
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-200/60 px-1.5 py-0.2 rounded">
                      Production Web App
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-500 truncate max-w-lg">
                    {settings.appsScriptUrl || settings.googleSheetScriptUrl || SCRIPT_URL}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyScriptCode}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    {hasCopiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{hasCopiedScript ? 'Copied to Clipboard!' : 'Copy Updated Code.gs'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowScriptModal(true)}
                    className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-zinc-500" />
                    <span>View Script</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestScriptConnection}
                    disabled={isTestingScript}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingScript ? 'animate-spin' : ''}`} />
                    <span>{isTestingScript ? 'Testing (5s)...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>

              {/* Diagnostic verification report */}
              {scriptTestResult.status && (
                <div
                  className={`mt-2 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    scriptTestResult.status === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {scriptTestResult.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1.5 flex-1">
                    <div className="font-bold flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span>{scriptTestResult.message}</span>
                        {scriptTestResult.details?.latencyMs !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white/70 border rounded text-zinc-700">
                            {scriptTestResult.details.latencyMs}ms
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-normal opacity-75">
                        Tested at {scriptTestResult.testedAt}
                      </span>
                    </div>
                    {scriptTestResult.details && (
                      <div className="text-[11px] font-mono opacity-90 flex flex-wrap gap-2 items-center">
                        {scriptTestResult.details.localMode && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-950 border border-amber-300">
                            Zero Data Loss Local Mode Active
                          </span>
                        )}
                        {scriptTestResult.details.intakeTab && (
                          <span>Intake Tab: <strong>{scriptTestResult.details.intakeTab}</strong> ({scriptTestResult.details.totalIntakes ?? 0} rows) · </span>
                        )}
                        {scriptTestResult.details.ledgerTab && (
                          <span>Course Ledger: <strong>{scriptTestResult.details.ledgerTab}</strong> ({scriptTestResult.details.totalCourseRows ?? 0} rows)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4-Step Deployment Instructions */}
              <div className="border-t border-zinc-200 pt-3 mt-3">
                <div className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-2">
                  4-Step Google Spreadsheet Deployment Instructions:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-600 text-[11px] leading-relaxed">
                  <li>Open your connected Google Spreadsheet, click <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
                  <li>Click on <strong>Code.gs</strong> on the left file list, select all existing code (<kbd className="px-1 py-0.5 bg-zinc-200 rounded font-mono text-[10px]">Ctrl+A</kbd>), and paste the copied code.</li>
                  <li>Click <strong>Deploy</strong> (top right) &gt; <strong>Manage deployments</strong> &gt; Click the <strong>Pencil icon (Edit)</strong> &gt; Select Version: <strong>New version</strong> &gt; Click <strong>Deploy</strong>.</li>
                  <li>Return here and click <strong>Test Connection</strong> to confirm live data synchronization.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Academic Session Archival & History Snapshots */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-zinc-900">
                      Academic Session Archival & History Snapshots
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Session Rollover Engine
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Snapshot assignment data into permanent History state & files. Transition to a new academic cycle with a fresh workspace without manual deletions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => importFileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-zinc-200"
                  title="Upload previously exported session archive JSON"
                >
                  <Upload className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Import History File</span>
                </button>
              </div>
            </div>

            {/* Active Session Status & Quick Archival Actions Banner */}
            <div className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2 text-indigo-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Current Active Academic Cycle</span>
                  </div>
                  <div className="text-2xl font-black text-white mt-1 flex flex-wrap items-baseline gap-2">
                    <span>{currentSession}</span>
                    <span className="text-xs font-normal text-zinc-400">
                      ({sessionIntakes.length} Intake Receipts • {sessionCourseEvaluations.length} Course Scripts)
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 max-w-xl">
                    Ready to conclude this cycle? Snapshot this data into History to preserve audit records, generate an offline JSON backup, and open a clean slate for the next term.
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenArchiveModal('snapshot_only')}
                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-zinc-700 cursor-pointer shadow-xs"
                      title="Take a point-in-time History snapshot without clearing active workspace"
                    >
                      <Archive className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Snapshot to History</span>
                    </button>

                    <button
                      type="button"
                      id="btn-archive-and-fresh-session"
                      onClick={() => handleOpenArchiveModal('archive_and_fresh')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-md"
                      title="Archive current session and initialize clean slate for new term"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      <span>Archive & Start New Session</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Active Session Mini Metric Counter */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/10 text-xs">
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Active Candidates</div>
                  <div className="text-lg font-black text-white font-mono mt-0.5">
                    {new Set(sessionIntakes.map((r) => r.enrollmentNo)).size}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Assignment Scripts</div>
                  <div className="text-lg font-black text-amber-300 font-mono mt-0.5">
                    {sessionCourseEvaluations.length}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Course Packets</div>
                  <div className="text-lg font-black text-indigo-300 font-mono mt-0.5">
                    {sessionPackets.length}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Sealed & Locked</div>
                  <div className="text-lg font-black text-emerald-300 font-mono mt-0.5">
                    {sessionCourseEvaluations.filter((e) => e.isLocked).length}
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Snapshots Ledger */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                <div className="flex items-center gap-1.5">
                  <HistoryIcon className="w-4 h-4 text-indigo-600" />
                  <span>Historical Archives Ledger ({archives.length} Snapshots)</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-normal">
                  Stored persistently in LocalStorage and exportable as JSON
                </span>
              </div>

              {archives.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-zinc-200 rounded-2xl text-center space-y-2 bg-zinc-50/50">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <HistoryIcon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-zinc-800">No Session Archives Saved Yet</div>
                  <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
                    Once an academic session closes, click <strong>"Archive & Start New Session"</strong> above. This will freeze current assignment intake and course ledger records into a historical snapshot and prepare a pristine workspace for the next term without manual deletions.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {archives.map((archive) => (
                    <div
                      key={archive.id}
                      className="bg-zinc-50 hover:bg-zinc-100/70 border border-zinc-200 rounded-xl p-3.5 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-zinc-950 text-sm">{archive.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                            {archive.session}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {formatDateTime(archive.archivedAt)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
                          <span>By: <strong className="text-zinc-800">{archive.archivedBy}</strong></span>
                          <span>•</span>
                          <span className="bg-white border border-zinc-200 px-2 py-0.5 rounded font-mono">
                            <strong>{archive.stats.totalCandidates}</strong> Candidates
                          </span>
                          <span className="bg-white border border-zinc-200 px-2 py-0.5 rounded font-mono text-amber-900 font-semibold">
                            <strong>{archive.stats.totalCourseScripts}</strong> Scripts
                          </span>
                          <span className="bg-white border border-zinc-200 px-2 py-0.5 rounded font-mono">
                            <strong>{archive.stats.totalPackets}</strong> Packets
                          </span>
                          <span className="bg-white border border-zinc-200 px-2 py-0.5 rounded font-mono text-emerald-800">
                            <strong>{archive.stats.totalEvaluated}</strong> Evaluated
                          </span>
                        </div>

                        {archive.notes && (
                          <p className="text-[11px] text-zinc-500 italic max-w-2xl line-clamp-1">
                            "{archive.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedArchiveDetail(archive)}
                          className="px-2.5 py-1.5 bg-white hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-zinc-300 transition cursor-pointer"
                          title="Inspect Snapshot details"
                        >
                          <Eye className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadArchiveJSON(archive)}
                          className="px-2.5 py-1.5 bg-white hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-zinc-300 transition cursor-pointer"
                          title="Download History JSON archive file"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          <span>JSON</span>
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRestoreArchiveConfirm(archive)}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold flex items-center gap-1 border border-amber-200 transition cursor-pointer"
                              title="Restore this historical snapshot into active workspace"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                              <span>Restore</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteArchiveConfirm(archive)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer"
                              title="Delete snapshot from History"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Accountability & Audit Trail Section */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-900">
                <HistoryIcon className="w-4 h-4 text-indigo-600" />
                <span>Audit Trail & Accountability Oversight</span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                {auditLogs.length} Events Logged
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Real-time forensic logs tracking user logins, student assignment modifications, marks locking, and administrative overrides stored persistently in AppContext state.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={exportAuditLogsCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Audit CSV</span>
              </button>
              <button
                type="button"
                onClick={exportAuditLogsJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Export Audit JSON</span>
              </button>
            </div>
          </div>

          {/* Institutional Data Governance & Disaster Recovery */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 font-bold text-sm text-zinc-900">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Institutional Backup & Disaster Recovery</span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
              <div>
                <div className="font-bold text-zinc-900">Export Institutional Database Archive</div>
                <p className="text-zinc-500 mt-0.5 max-w-lg">
                  Download a complete snapshot containing all session intakes ({allIntakes.length} records), evaluators master ({evaluators.length}), course packets, and settings.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportAllJSON}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold flex items-center gap-2 shrink-0 transition cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export Full JSON Archive</span>
              </button>
            </div>

            {/* Word Blueprint Document Download Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                  <FileText className="w-4 h-4 text-indigo-700 shrink-0" />
                  <span>Download Operational System Blueprint (Word .DOCX)</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-200/80 text-indigo-900 border border-indigo-300">
                    Official
                  </span>
                </div>
                <p className="text-indigo-900/80 mt-0.5 max-w-lg">
                  Complete architecture specification, RBAC governance rules, 4-stage assignment lifecycle protocols, and technical schemas in editable Microsoft Word format.
                </p>
              </div>
              <a
                href="/IGNOU_SC2033_Web_App_Blueprint.docx"
                download="IGNOU_SC2033_Web_App_Blueprint.docx"
                className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-semibold flex items-center gap-2 shrink-0 transition cursor-pointer shadow-xs"
                title="Download Microsoft Word (.docx) Blueprint"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>Download Word (.DOCX)</span>
              </a>
            </div>

            {isAdmin && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                <div>
                  <div className="font-bold text-rose-900">Reset to Institutional Factory Baseline</div>
                  <p className="text-rose-700/80 mt-0.5 max-w-lg">
                    Restore initial IGNOU SC-2033 mock intake records, evaluators directory, and default session configurations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetAllData}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold flex items-center gap-2 shrink-0 transition cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Database</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Input for Archive JSON Import */}
      <input
        type="file"
        ref={importFileInputRef}
        onChange={handleImportFileChange}
        style={{ display: 'none' }}
        accept=".json"
      />

      {/* Modal 1: Create Session Archive & Rollover Dialog */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto">
            <div className="px-5 py-4 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Archive className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    {archiveForm.mode === 'archive_and_fresh' ? 'Archive & Start Fresh Academic Session' : 'Snapshot Session to History'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Academic Cycle: {archiveForm.session}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmArchive} className="p-5 space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-zinc-800">Archive / Snapshot Name</label>
                <input
                  type="text"
                  required
                  value={archiveForm.name}
                  onChange={(e) => setArchiveForm({ ...archiveForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              {archiveForm.mode === 'archive_and_fresh' && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                  <label className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <CalendarPlus className="w-4 h-4 text-indigo-600" />
                    <span>Next Term Academic Cycle Name (Fresh Workspace)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={archiveForm.newSessionName}
                    onChange={(e) => setArchiveForm({ ...archiveForm, newSessionName: e.target.value })}
                    className="w-full px-3 py-2 border border-indigo-300 rounded-lg bg-white font-bold text-indigo-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="e.g. July 2028 or January 2029"
                  />
                  <p className="text-[11px] text-indigo-700">
                    Active workspace will be switched directly to this new academic cycle upon archival.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="font-bold text-zinc-800">Archival Notes / Record Summary</label>
                <textarea
                  rows={3}
                  value={archiveForm.notes}
                  onChange={(e) => setArchiveForm({ ...archiveForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Concluded evaluation cycle. All 3-part award sheets forwarded to Regional Centre Kohima."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-download-json"
                  checked={archiveForm.downloadJSON}
                  onChange={(e) => setArchiveForm({ ...archiveForm, downloadJSON: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-zinc-300 cursor-pointer"
                />
                <label htmlFor="chk-download-json" className="text-zinc-700 font-medium cursor-pointer">
                  Automatically download offline JSON snapshot file to local drive
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl hover:bg-zinc-100 transition cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer font-bold shadow-xs"
                >
                  Confirm & Archive Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: ROLE-BASED ACCESS CONTROL (RBAC) & GOVERNANCE */}
      {activeTab === 'rbac' && <RbacGovernanceSettings />}

      {/* Modal 2: Snapshot Detail Inspector Dialog */}
      {selectedArchiveDetail && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Archive className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    {selectedArchiveDetail.name}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    Session: {selectedArchiveDetail.session} • ID: {selectedArchiveDetail.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArchiveDetail(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Candidates</div>
                  <div className="text-lg font-black text-zinc-900 font-mono mt-0.5">
                    {selectedArchiveDetail.stats.totalCandidates}
                  </div>
                </div>
                <div className="bg-amber-50/60 border border-amber-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-amber-800 uppercase font-semibold">Course Scripts</div>
                  <div className="text-lg font-black text-amber-950 font-mono mt-0.5">
                    {selectedArchiveDetail.stats.totalCourseScripts}
                  </div>
                </div>
                <div className="bg-indigo-50/60 border border-indigo-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-indigo-800 uppercase font-semibold">Course Packets</div>
                  <div className="text-lg font-black text-indigo-950 font-mono mt-0.5">
                    {selectedArchiveDetail.stats.totalPackets}
                  </div>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-emerald-800 uppercase font-semibold">Evaluated</div>
                  <div className="text-lg font-black text-emerald-950 font-mono mt-0.5">
                    {selectedArchiveDetail.stats.totalEvaluated}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl space-y-1.5">
                <div className="flex flex-wrap items-center justify-between text-[11px]">
                  <span>Archived On: <strong className="text-zinc-900 font-mono">{formatDateTime(selectedArchiveDetail.archivedAt)}</strong></span>
                  <span>Archived By: <strong className="text-zinc-900">{selectedArchiveDetail.archivedBy}</strong></span>
                </div>
                {selectedArchiveDetail.notes && (
                  <p className="text-[11px] text-zinc-600 italic pt-1 border-t border-zinc-200">
                    Notes: "{selectedArchiveDetail.notes}"
                  </p>
                )}
              </div>

              <div>
                <div className="font-bold text-zinc-800 mb-1.5 flex items-center justify-between">
                  <span>Programme Breakdown in this Snapshot:</span>
                  <span className="text-[10px] text-zinc-500 font-normal">
                    {selectedArchiveDetail.snapshot.intakes?.length || 0} Total Intake Tokens
                  </span>
                </div>
                <div className="border border-zinc-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100 text-zinc-700 uppercase text-[10px] font-bold border-b border-zinc-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Programme</th>
                        <th className="py-2 px-3 text-center">Candidates</th>
                        <th className="py-2 px-3 text-center">Scripts Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {(() => {
                        const progMap: Record<string, { candidates: Set<string>; count: number }> = {};
                        (selectedArchiveDetail.snapshot.intakes || []).forEach((r) => {
                          const p = (r.programmeCode || 'UNKNOWN').trim().toUpperCase();
                          if (!progMap[p]) progMap[p] = { candidates: new Set(), count: 0 };
                          progMap[p].candidates.add(r.enrollmentNo);
                          progMap[p].count += r.courseCodes.length;
                        });
                        const entries = Object.entries(progMap).sort((a, b) => b[1].count - a[1].count);
                        if (entries.length === 0) {
                          return (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-zinc-400 italic">
                                No programme entries recorded in this snapshot.
                              </td>
                            </tr>
                          );
                        }
                        return entries.map(([pCode, stats]) => (
                          <tr key={pCode} className="hover:bg-zinc-50">
                            <td className="py-2 px-3 font-mono font-bold text-zinc-900">{pCode}</td>
                            <td className="py-2 px-3 text-center font-mono">{stats.candidates.size}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-amber-950">{stats.count}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadArchiveJSON(selectedArchiveDetail)}
                  className="px-3.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-800 rounded-xl font-semibold border border-zinc-300 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download JSON File</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRestoreArchiveConfirm(selectedArchiveDetail)}
                    className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-semibold border border-amber-200 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Restore into Workspace</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedArchiveDetail(null)}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE APPS SCRIPT CODE VIEWER MODAL */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">Google Apps Script Source Code (Code.gs)</h3>
                  <p className="text-[11px] text-zinc-400">Master script for Intake, Course Ledger, Evaluators & Admission parity</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-zinc-950 flex-1 overflow-y-auto font-mono text-xs text-zinc-200 leading-relaxed select-all">
              <pre className="whitespace-pre-wrap">{OFFICIAL_APPS_SCRIPT_CODE}</pre>
            </div>

            <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between shrink-0">
              <div className="text-xs text-zinc-500">
                Paste into your Google Spreadsheet's Apps Script editor and deploy as a new version.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyScriptCode}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {hasCopiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{hasCopiedScript ? 'Copied Code!' : 'Copy Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowScriptModal(false)}
                  className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
