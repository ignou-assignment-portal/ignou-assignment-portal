import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/helpers';
import {
  Settings,
  Building2,
  DollarSign,
  Calendar,
  Download,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Save,
  CheckCircle2,
} from 'lucide-react';

export const SystemSettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetAllData,
    isAdmin,
    isUrlLockedDeskMode,
    allIntakes,
    evaluators,
    currentSession,
  } = useApp();

  const [formData, setFormData] = useState({
    centreCode: settings.centreCode,
    centreName: settings.centreName,
    institutionName: settings.institutionName,
    regionalCentreCode: settings.regionalCentreCode,
    coordinatorName: settings.coordinatorName,
    coordinatorContact: settings.coordinatorContact,
    remunerationRatePerScript: settings.remunerationRatePerScript,
    conveyanceAllowancePerPacket: settings.conveyanceAllowancePerPacket,
    coordinationChargesPerScript: settings.coordinationChargesPerScript,
    adminPin: settings.adminPin || '2033',
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    updateSettings(formData);
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
                value={formData.centreCode}
                onChange={(e) => setFormData({ ...formData, centreCode: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono font-bold bg-zinc-50 disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Regional Centre</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.regionalCentreCode}
                onChange={(e) => setFormData({ ...formData, regionalCentreCode: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-zinc-700 mb-1">Host College / Institution Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.institutionName}
                onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Coordinator / Head Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.coordinatorName}
                onChange={(e) => setFormData({ ...formData, coordinatorName: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Coordinator Contact Phone / Email</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.coordinatorContact}
                onChange={(e) => setFormData({ ...formData, coordinatorContact: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg disabled:opacity-75"
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
                  disabled={!isAdmin}
                  value={formData.remunerationRatePerScript}
                  onChange={(e) =>
                    setFormData({ ...formData, remunerationRatePerScript: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Standard study centre rate (e.g. ₹30)
                </span>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Conveyance Allowance / Packet (₹)
                </label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={formData.conveyanceAllowancePerPacket}
                  onChange={(e) =>
                    setFormData({ ...formData, conveyanceAllowancePerPacket: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Paid to academic counselors per packet
                </span>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Coordination Charges / Script (₹)
                </label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={formData.coordinationChargesPerScript}
                  onChange={(e) =>
                    setFormData({ ...formData, coordinationChargesPerScript: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-bold disabled:opacity-75"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Study centre secretarial allowance
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
                  maxLength={4}
                  value={formData.adminPin}
                  onChange={(e) => setFormData({ ...formData, adminPin: e.target.value })}
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
