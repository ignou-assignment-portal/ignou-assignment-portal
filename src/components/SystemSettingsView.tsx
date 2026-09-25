import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ThemeSelector } from './ThemeSelector';
import { formatCurrency, formatDate, formatDateTime } from '../utils/helpers';
import { SessionArchiveRecord } from '../types';
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
} from 'lucide-react';

export const SystemSettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetAllData,
    isAdmin,
    isUrlLockedDeskMode,
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
  } = useApp();

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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900">
              Study Centre Configuration & Data Governance
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Manage Study Centre SC-2033 institutional parameters, remuneration rates, academic cycles, and data backup.
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Read-Only mode: Settings modification requires Coordinator role.</span>
          </div>
        )}
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>System configuration parameters saved successfully.</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Theme & Visual Appearance Section */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <ThemeSelector variant="cards" />
        </div>

        {/* Centre Details */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 font-bold text-sm text-zinc-900">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Institutional Centre Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Study Centre Code</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={systemSettings.centreCode}
                onChange={(e) => setSystemSettings({ ...systemSettings, centreCode: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono font-bold bg-zinc-50 disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Regional Centre</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={systemSettings.regionalCentre}
                onChange={(e) => setSystemSettings({ ...systemSettings, regionalCentre: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-zinc-700 mb-1">Host College / Institution Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={systemSettings.hostInstitution}
                onChange={(e) => setSystemSettings({ ...systemSettings, hostInstitution: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Coordinator Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={systemSettings.coordinatorName}
                onChange={(e) => setSystemSettings({ ...systemSettings, coordinatorName: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Coordinator Official Designation</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={systemSettings.coordinatorDesignation}
                onChange={(e) => setSystemSettings({ ...systemSettings, coordinatorDesignation: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Coordinator Contact Phone</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={systemSettings.coordinatorPhone}
                onChange={(e) => setSystemSettings({ ...systemSettings, coordinatorPhone: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Coordinator Email</label>
              <input
                type="email"
                disabled={!isAdmin}
                value={systemSettings.coordinatorEmail}
                onChange={(e) => setSystemSettings({ ...systemSettings, coordinatorEmail: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Financial & Evaluation Rates (Admin Only - Hidden in Desk Official mode) */}
        {!isUrlLockedDeskMode && isAdmin && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 font-bold text-sm text-zinc-900">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Financial Norms & Remuneration Rates (IGNOU Mandate)</span>
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
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Standard study centre rate (₹27.50)
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
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Default ₹0.00 unless entered
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
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Default ₹0.00 unless entered
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
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono tracking-widest text-center font-bold text-sm bg-zinc-50 focus:bg-white"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Default PIN is 2033. Required when switching roles to Coordinator (Admin).
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Security Credentials Management (Admin Only) */}
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
              Customize the institutional authentication credentials required at the Gatekeeper terminal login screen. Changes are saved immediately to local storage and take effect across all sessions.
            </p>

            {pinSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Security PINs updated and stored in LocalStorage successfully.</span>
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
                  Grants restricted terminal access to Stage 1 (Intake Desk) and Stage 2 (Draft Evaluation Ledger).
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
                  Grants master access to all stages, marks locking, billing, rate config, and delete operations.
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Audit CSV</span>
            </button>
            <button
              type="button"
              onClick={exportAuditLogsJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Export Audit JSON</span>
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save System Settings</span>
            </button>
          </div>
        )}
      </form>

      {/* Hidden File Input for Archive JSON Import */}
      <input
        type="file"
        ref={importFileInputRef}
        onChange={handleImportFileChange}
        style={{ display: 'none' }}
        accept=".json"
      />

      {/* Module: Academic Session Archival & Historical Snapshots Section */}
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
              {/* Mode Toggle */}
              <div>
                <label className="block font-bold text-zinc-800 uppercase tracking-wider text-[10px] mb-2">
                  Archival Mode & Rollover Behavior
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition ${
                      archiveForm.mode === 'archive_and_fresh'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="archiveMode"
                        checked={archiveForm.mode === 'archive_and_fresh'}
                        onChange={() =>
                          setArchiveForm({
                            ...archiveForm,
                            mode: 'archive_and_fresh',
                            name: `${archiveForm.session} Final Closeout Archive`,
                          })
                        }
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-bold text-zinc-900">Archive & Start Fresh</div>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
                          Freezes current term into History and clears active records for a clean slate in the new cycle.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition ${
                      archiveForm.mode === 'snapshot_only'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="archiveMode"
                        checked={archiveForm.mode === 'snapshot_only'}
                        onChange={() =>
                          setArchiveForm({
                            ...archiveForm,
                            mode: 'snapshot_only',
                            name: `${archiveForm.session} Point-in-Time Snapshot`,
                          })
                        }
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-bold text-zinc-900">Snapshot Only</div>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
                          Creates a History snapshot & JSON file while keeping active records intact.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Target Session */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Academic Session to Snapshot
                  </label>
                  <select
                    value={archiveForm.session}
                    onChange={(e) =>
                      setArchiveForm({
                        ...archiveForm,
                        session: e.target.value,
                        name: `${e.target.value} Closeout Archive`,
                        newSessionName: getSuggestedNextSession(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-bold bg-white text-zinc-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {availableSessions.map((s) => (
                      <option key={s} value={s}>
                        {s} {s === currentSession ? '(Current Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {archiveForm.mode === 'archive_and_fresh' && (
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">
                      New Academic Session Name
                    </label>
                    <input
                      type="text"
                      required
                      value={archiveForm.newSessionName}
                      onChange={(e) => setArchiveForm({ ...archiveForm, newSessionName: e.target.value })}
                      placeholder="e.g. January 2027"
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-bold bg-white text-zinc-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Snapshot Name */}
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Archive Snapshot Title
                </label>
                <input
                  type="text"
                  required
                  value={archiveForm.name}
                  onChange={(e) => setArchiveForm({ ...archiveForm, name: e.target.value })}
                  placeholder="e.g. July 2026 Closeout Archive"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-semibold bg-white text-zinc-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Administrative Closeout Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={archiveForm.notes}
                  onChange={(e) => setArchiveForm({ ...archiveForm, notes: e.target.value })}
                  placeholder="e.g. Evaluation completed, all award sheets forwarded to RC Kohima."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl bg-white text-zinc-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Download JSON option */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-800">Download History JSON Archive File</div>
                  <p className="text-[11px] text-zinc-500">
                    Automatically saves a full offline backup file (.json) to your computer.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={archiveForm.downloadJSON}
                  onChange={(e) => setArchiveForm({ ...archiveForm, downloadJSON: e.target.checked })}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-100 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{archiveForm.mode === 'archive_and_fresh' ? 'Archive & Launch New Session' : 'Save History Snapshot'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Snapshot Details & Breakdown Dialog */}
      {selectedArchiveDetail && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <FileText className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    {selectedArchiveDetail.name}
                  </h3>
                  <p className="text-xs text-zinc-400">
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
              {/* Meta Info Strip */}
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

              {/* Archive Info */}
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

              {/* Programme Breakdown Table */}
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

            {/* Footer Buttons */}
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

      {/* Institutional Data Governance & Backup Section */}
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
  );
};
