import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { RegistrationCadre, AcademicYearLevel, StudentRegistrationRecord } from '../types';
import { exportRegistrationsToExcel } from '../services/registrationExcelService';
import { RegistrationExcelUploadModal } from './RegistrationExcelUploadModal';
import { AddRegistrationModal } from './AddRegistrationModal';
import {
  GraduationCap,
  Users,
  Search,
  Filter,
  FileSpreadsheet,
  PlusCircle,
  Download,
  Calendar,
  Layers,
  Phone,
  Mail,
  Copy,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  BookOpen,
  RefreshCw,
  Code2,
  X,
} from 'lucide-react';

const APPS_SCRIPT_SOURCE = `/**
 * IGNOU SC-2033 Multi-Tab Admissions & Assessment Script (Code.gs)
 * Reads:
 * 1. Fresh Jan 2025, Fresh July 2025, Fresh Jan 2026
 * 2. RR Jan 2025, RR July 2025, RR Jan 2026
 * 3. Intake_Register, Course_Ledger, Evaluators_Master
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {
    intakeRegister: getSheetDataAsArray(ss, "Intake_Register"),
    courseLedger: getSheetDataAsArray(ss, "Course_Ledger"),
    evaluatorsMaster: getSheetDataAsArray(ss, "Evaluators_Master"),
    studentRegistrations: []
  };

  var allSheets = ss.getSheets();
  var allRegistrations = [];

  for (var i = 0; i < allSheets.length; i++) {
    var sheet = allSheets[i];
    var name = sheet.getName();
    var lower = name.toLowerCase();

    var isFresh = lower.includes("fresh");
    var isRR = lower.includes("rr") || lower.includes("re-reg") || lower.includes("rereg");
    var isAdmissions = lower.includes("admission") || lower.includes("registration");

    if (isFresh || isRR || isAdmissions) {
      var rows = getSheetDataAsArray(ss, name);
      result[name] = rows;

      var defaultCadre = isRR ? "RE_REGISTRATION" : "FRESH";
      var defaultSession = "July 2026";
      if (lower.includes("jan") && lower.includes("2025")) defaultSession = "January 2025";
      else if (lower.includes("jul") && lower.includes("2025")) defaultSession = "July 2025";
      else if (lower.includes("jan") && lower.includes("2026")) defaultSession = "January 2026";
      else if (lower.includes("jul") && lower.includes("2026")) defaultSession = "July 2026";

      for (var j = 0; j < rows.length; j++) {
        var r = rows[j];
        if (!r.cadre && !r.Cadre) r.cadre = defaultCadre;
        if (!r.session && !r.Session) r.session = defaultSession;
        var emailVal = r["Email"] || r["Email ID"] || r["Email_ID"] || r["email"] || r["studentEmail"] || r["Candidate Email"] || "";
        if (emailVal) r.studentEmail = emailVal;
        allRegistrations.push(r);
      }
    }
  }

  result.studentRegistrations = allRegistrations;

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  var payload = body.payload || body;

  if (action === "SYNC_ADMISSIONS") {
    var tabRecords = payload.tabRecords || {};
    var count = 0;
    for (var tabName in tabRecords) {
      var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
      sheet.clearContents();
      var rows = tabRecords[tabName];
      if (rows && rows.length > 0) {
        var headers = ["Enrollment No", "Student Name", "Email Address", "Mobile Number", "Programme Code", "Cadre", "Academic Year", "Session", "Course Codes", "Status", "Registration Date"];
        var values = [headers];
        for (var r = 0; r < rows.length; r++) {
          var rec = rows[r];
          values.push([
            rec.enrollmentNo || "",
            rec.studentName || "",
            rec.studentEmail || "",
            rec.studentPhone || "",
            rec.programmeCode || "",
            rec.cadre || "",
            rec.academicYear || "",
            rec.session || "",
            Array.isArray(rec.courseCodes) ? rec.courseCodes.join(", ") : (rec.courseCodes || ""),
            rec.status || "Confirmed",
            rec.registrationDate || ""
          ]);
        }
        sheet.getRange(1, 1, values.length, headers.length).setValues(values);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#eef2ff");
        count += rows.length;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Synced " + count + " records across tabs." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "success", action: action }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetDataAsArray(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var h = 0; h < headers.length; h++) {
      var key = String(headers[h]).trim();
      if (key) obj[key] = row[h];
    }
    rows.push(obj);
  }
  return rows;
}
`;

export const AdmissionsView: React.FC = () => {
  const {
    studentRegistrations,
    freshAdmissions,
    reRegistrations,
    deleteStudentRegistration,
    allProgrammes,
    isAdmin,
    verifyAndSetAdminRole,
    isSyncingAdmissions,
    syncAdmissionsWithGoogleSheets,
    calibrateStudentRegistrations,
    showToast,
  } = useApp();

  // Active Register: Fresh Admissions (1st Year) vs Re-Registration (2nd & 3rd Year)
  const [activeCadre, setActiveCadre] = useState<RegistrationCadre>('FRESH');

  // Filter States
  const [sessionFilter, setSessionFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [programmeFilter, setProgrammeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Active Dataset based on activeCadre
  const activeDataset = useMemo(() => {
    return activeCadre === 'FRESH' ? freshAdmissions : reRegistrations;
  }, [activeCadre, freshAdmissions, reRegistrations]);

  // Available sessions in active dataset
  const availableSessions = useMemo(() => {
    const s = new Set<string>();
    activeDataset.forEach((r) => {
      if (r.session) s.add(r.session.trim());
    });
    return Array.from(s).sort().reverse();
  }, [activeDataset]);

  // Available programmes in active dataset
  const availableProgrammes = useMemo(() => {
    const map = new Map<string, number>();
    activeDataset.forEach((r) => {
      const code = (r.programmeCode || '').toUpperCase();
      if (code) {
        map.set(code, (map.get(code) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeDataset]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return activeDataset.filter((r) => {
      if (sessionFilter !== 'ALL' && (r.session || '').toUpperCase() !== sessionFilter.toUpperCase()) {
        return false;
      }
      if (yearFilter !== 'ALL' && r.academicYear !== yearFilter) {
        return false;
      }
      if (programmeFilter !== 'ALL' && (r.programmeCode || '').toUpperCase() !== programmeFilter.toUpperCase()) {
        return false;
      }
      if (!q) return true;

      const enr = (r.enrollmentNo || '').toUpperCase();
      const name = (r.studentName || '').toUpperCase();
      const prog = (r.programmeCode || '').toUpperCase();
      const phone = (r.studentPhone || '').toUpperCase();
      const email = (r.studentEmail || '').toUpperCase();
      const courses = (r.courseCodes || []).join(' ').toUpperCase();

      return (
        enr.includes(q) ||
        name.includes(q) ||
        prog.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        courses.includes(q)
      );
    });
  }, [activeDataset, sessionFilter, yearFilter, programmeFilter, searchQuery]);

  // Summary Metrics & Multi-Session Cohort Verification
  const metrics = useMemo(() => {
    const total = activeDataset.length;
    const julyCount = activeDataset.filter((r) => (r.session || '').toLowerCase().includes('july')).length;
    const janCount = activeDataset.filter((r) => (r.session || '').toLowerCase().includes('jan')).length;
    const yr2Count = activeDataset.filter((r) => r.academicYear === '2nd Year').length;
    const yr3Count = activeDataset.filter((r) => r.academicYear === '3rd Year').length;

    // Specific Multi-Session Cohort Totals (Target: Jan 2025: 39, July 2025: 94, Jan 2026: 26)
    const jan2025Count = activeDataset.filter((r) => {
      const s = (r.session || '').toLowerCase();
      return s.includes('jan') && s.includes('2025');
    }).length;

    const july2025Count = activeDataset.filter((r) => {
      const s = (r.session || '').toLowerCase();
      return s.includes('jul') && s.includes('2025');
    }).length;

    const jan2026Count = activeDataset.filter((r) => {
      const s = (r.session || '').toLowerCase();
      return s.includes('jan') && s.includes('2026');
    }).length;

    const july2026Count = activeDataset.filter((r) => {
      const s = (r.session || '').toLowerCase();
      return s.includes('jul') && s.includes('2026');
    }).length;

    return {
      total,
      julyCount,
      janCount,
      yr2Count,
      yr3Count,
      jan2025Count,
      july2025Count,
      jan2026Count,
      july2026Count,
    };
  }, [activeDataset]);

  const handleCopyEnrollment = (enr: string) => {
    navigator.clipboard.writeText(enr);
    showToast(`Copied enrollment ${enr} to clipboard.`, 'success');
  };

  const handleDeleteRecord = (record: StudentRegistrationRecord) => {
    if (!isAdmin) {
      const pin = window.prompt('Coordinator PIN Required: Enter PIN 2033 to delete registration record:');
      if (!pin) return;
      if (pin.trim() === '2033') {
        verifyAndSetAdminRole('2033');
      } else {
        showToast('Unauthorized: Incorrect Coordinator PIN.', 'error');
        return;
      }
    }

    const confirmed = window.confirm(
      `Delete Registration?\n\nAre you sure you want to remove ${record.studentName} (${record.enrollmentNo}) from the roster?`
    );
    if (confirmed) {
      deleteStudentRegistration(record.id);
      showToast(`Removed ${record.studentName} (${record.enrollmentNo}) from roster.`, 'success');
    }
  };

  const handleExport = () => {
    const prefix =
      activeCadre === 'FRESH'
        ? 'IGNOU_SC2033_Fresh_Admissions'
        : 'IGNOU_SC2033_Re_Registrations';
    exportRegistrationsToExcel(filteredRecords, prefix);
    showToast(`Exported ${filteredRecords.length} records to Excel.`, 'success');
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Page Title & Register Selector Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-950 text-white flex items-center justify-center font-bold shadow-xs shrink-0 ring-1 ring-indigo-900/40">
              <GraduationCap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Admissions & Re-Registration Master
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  SC-2033
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Official student admission and re-registration rosters across January & July academic sessions
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ New Entry</span>
            </button>

            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={syncAdmissionsWithGoogleSheets}
              disabled={isSyncingAdmissions}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Synchronize admissions & re-registrations with Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncingAdmissions ? 'animate-spin' : ''}`} />
              <span>{isSyncingAdmissions ? 'Syncing...' : 'Sync Sheets'}</span>
            </button>

            <button
              type="button"
              onClick={calibrateStudentRegistrations}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Recalibrate official cohorts: 161 Fresh (Jan 2026: 33, July 2025: 99, Jan 2025: 29) & 159 RR (Jan 2025: 39, July 2025: 94, Jan 2026: 26) with verified email addresses"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Calibrate Roster</span>
            </button>
          </div>
        </div>

        {/* Separate Sovereign Registers Switcher */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveCadre('FRESH');
              setYearFilter('ALL');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              activeCadre === 'FRESH'
                ? 'bg-indigo-950 text-white border-indigo-900 shadow-sm ring-1 ring-indigo-900'
                : 'bg-slate-50/70 hover:bg-slate-100/70 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  activeCadre === 'FRESH'
                    ? 'bg-amber-400 text-indigo-950 font-black'
                    : 'bg-slate-200 text-slate-700 font-bold'
                }`}
              >
                1
              </div>
              <div>
                <div className="text-xs font-black">Fresh Admissions (1st Year)</div>
                <div
                  className={`text-[10px] ${
                    activeCadre === 'FRESH' ? 'text-indigo-200' : 'text-slate-500'
                  }`}
                >
                  New students entering study centre in Year 1
                </div>
              </div>
            </div>

            <div
              className={`text-xs font-mono font-black px-2 py-0.5 rounded-full border ${
                activeCadre === 'FRESH'
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white text-slate-800 border-slate-200'
              }`}
            >
              {freshAdmissions.length} Students
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCadre('RE_REGISTRATION');
              setYearFilter('ALL');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              activeCadre === 'RE_REGISTRATION'
                ? 'bg-indigo-950 text-white border-indigo-900 shadow-sm ring-1 ring-indigo-900'
                : 'bg-slate-50/70 hover:bg-slate-100/70 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  activeCadre === 'RE_REGISTRATION'
                    ? 'bg-amber-400 text-indigo-950 font-black'
                    : 'bg-slate-200 text-slate-700 font-bold'
                }`}
              >
                2
              </div>
              <div>
                <div className="text-xs font-black">Re-Registration (2nd & 3rd Year)</div>
                <div
                  className={`text-[10px] ${
                    activeCadre === 'RE_REGISTRATION' ? 'text-indigo-200' : 'text-slate-500'
                  }`}
                >
                  Continuing learners registering for Years 2 and 3
                </div>
              </div>
            </div>

            <div
              className={`text-xs font-mono font-black px-2 py-0.5 rounded-full border ${
                activeCadre === 'RE_REGISTRATION'
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white text-slate-800 border-slate-200'
              }`}
            >
              {reRegistrations.length} Students
            </div>
          </button>
        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Total {activeCadre === 'FRESH' ? '1st Year Fresh' : 'Re-Registered'}
          </div>
          <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
            {metrics.total}
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            July Monsoon Cycle
          </div>
          <div className="text-xl font-black text-indigo-950 font-mono mt-0.5">
            {metrics.julyCount}
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            January Winter Cycle
          </div>
          <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
            {metrics.janCount}
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {activeCadre === 'FRESH' ? 'Programmes Represented' : '2nd vs 3rd Year'}
          </div>
          <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
            {activeCadre === 'FRESH'
              ? availableProgrammes.length
              : `${metrics.yr2Count} (Yr 2) / ${metrics.yr3Count} (Yr 3)`}
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search enrollment number, student name, course..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Session Cycle Filter */}
          <div className="sm:col-span-3">
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="ALL">All Academic Sessions</option>
              <option value="July 2026">July 2026</option>
              <option value="January 2026">January 2026</option>
              <option value="July 2025">July 2025</option>
              <option value="January 2025">January 2025</option>
              {availableSessions
                .filter((s) => !['July 2026', 'January 2026', 'July 2025', 'January 2025'].includes(s))
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>

          {/* Academic Year Filter (Re-Registration only) */}
          {activeCadre === 'RE_REGISTRATION' && (
            <div className="sm:col-span-2">
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
              >
                <option value="ALL">All Years</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="Semester">Semester</option>
              </select>
            </div>
          )}

          {/* Programme Filter */}
          <div className={activeCadre === 'RE_REGISTRATION' ? 'sm:col-span-2' : 'sm:col-span-4'}>
            <select
              value={programmeFilter}
              onChange={(e) => setProgrammeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="ALL">All Programmes ({availableProgrammes.length})</option>
              {availableProgrammes.map(([code, count]) => (
                <option key={code} value={code}>
                  {code} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Multi-Session Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Quick Session:</span>
          <button
            type="button"
            onClick={() => setSessionFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              sessionFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            All Sessions ({activeDataset.length})
          </button>

          <button
            type="button"
            onClick={() => setSessionFilter('July 2026')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              sessionFilter === 'July 2026'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border-indigo-200'
            }`}
          >
            July 2026 ({metrics.july2026Count})
          </button>

          <button
            type="button"
            onClick={() => setSessionFilter('January 2026')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              sessionFilter === 'January 2026'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border-indigo-200'
            }`}
          >
            Jan 2026 ({metrics.jan2026Count})
          </button>

          <button
            type="button"
            onClick={() => setSessionFilter('July 2025')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              sessionFilter === 'July 2025'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border-indigo-200'
            }`}
          >
            July 2025 ({metrics.july2025Count})
          </button>

          <button
            type="button"
            onClick={() => setSessionFilter('January 2025')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              sessionFilter === 'January 2025'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border-indigo-200'
            }`}
          >
            Jan 2025 ({metrics.jan2025Count})
          </button>
        </div>

        {/* Multi-Tab Google Sheets Sync Notification */}
        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between text-xs text-emerald-950 gap-3">
          <div className="flex items-start sm:items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span>
                <strong>Multi-Tab Google Sheets Sync:</strong> Dedicated sheets (<code>Fresh Jan 2025</code>, <code>RR Jan 2025</code>, <code>Fresh July 2025</code>, <code>RR July 2025</code>, <code>Fresh Jan 2026</code>, <code>RR Jan 2026</code>) with <code>Email</code> & <code>Email ID</code> column mapping.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsScriptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
              title="View & copy complete Google Apps Script Code.gs to read all tabs and emails"
            >
              <Code2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Apps Script Setup (Code.gs)</span>
            </button>
            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 font-bold px-2 py-1 rounded-md border border-emerald-300">
              Google Sheets Master
            </span>
          </div>
        </div>

        {/* Filter stats pill */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <div>
            Showing <strong>{filteredRecords.length}</strong> of{' '}
            <strong>{activeDataset.length}</strong> records in{' '}
            {activeCadre === 'FRESH' ? 'Fresh Admissions' : 'Re-Registration'} Register
          </div>
          {(sessionFilter !== 'ALL' || yearFilter !== 'ALL' || programmeFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSessionFilter('ALL');
                setYearFilter('ALL');
                setProgrammeFilter('ALL');
                setSearchQuery('');
              }}
              className="text-indigo-600 hover:text-indigo-900 font-semibold cursor-pointer underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Structured Master Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[9px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-10">S.No.</th>
                <th className="py-2.5 px-3 w-32">Enrollment No</th>
                <th className="py-2.5 px-3">Candidate Name</th>
                <th className="py-2.5 px-3 w-24">Programme</th>
                <th className="py-2.5 px-3 w-28">Session</th>
                <th className="py-2.5 px-3 w-24">Level</th>
                <th className="py-2.5 px-3">Registered Courses</th>
                <th className="py-2.5 px-3 w-32">Contact Mobile</th>
                <th className="py-2.5 px-3 w-16 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700">No records found</p>
                      <p className="text-[11px] text-slate-500">
                        No students match the selected filters. Use "+ New Entry" or "Import Excel / CSV" to add records.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {r.enrollmentNo}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyEnrollment(r.enrollmentNo)}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                          title="Copy Enrollment"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div>{r.studentName}</div>
                      {r.studentEmail ? (
                        <div className="text-[10px] text-indigo-700 font-normal font-mono truncate max-w-[200px] flex items-center gap-1 mt-0.5" title={r.studentEmail}>
                          <Mail className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="truncate">{r.studentEmail}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-normal italic flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>Email pending</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-200/80 text-[11px]">
                        {r.programmeCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 font-mono text-[11px]">
                      {r.session}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.academicYear === '1st Year'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : r.academicYear === '2nd Year'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                      >
                        {r.academicYear}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center flex-wrap gap-1 max-w-sm">
                        {(r.courseCodes || []).map((code) => (
                          <span
                            key={code}
                            className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[10px]"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 text-xs">
                      {r.studentPhone || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(r)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete registration (Requires Coordinator PIN 2033)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <RegistrationExcelUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultCadre={activeCadre}
      />

      <AddRegistrationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        defaultCadre={activeCadre}
      />

      {/* Google Apps Script Backend Code Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-300 overflow-hidden my-auto flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Code2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Google Apps Script Setup (Multi-Tab Admissions & Assessment)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Deploy this script into your Google Sheet to pull all admission tabs and student emails
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Why this step is required:</span>
                </div>
                <p className="text-amber-900 leading-relaxed text-[11px]">
                  Google Apps Script executes remotely inside your Google Sheet. Currently, it only exports 3 sheets (<code>Intake_Register</code>, <code>Course_Ledger</code>, <code>Evaluators_Master</code>).
                  Updating your <code>Code.gs</code> with this script allows Google Sheets to read your admission tabs (<code>Fresh Jan 2025</code>, <code>Fresh July 2025</code>, <code>Fresh Jan 2026</code>, <code>RR Jan 2025</code>, <code>RR July 2025</code>, <code>RR Jan 2026</code>) and extract emails from <code>Email</code> or <code>Email ID</code> columns.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-slate-900 text-xs">
                  Quick 3-Step Setup in Google Sheets:
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 text-[11px]">
                  <li>Open your Google Sheet &rarr; Click <strong>Extensions</strong> in the top menu &rarr; <strong>Apps Script</strong>.</li>
                  <li>In the Apps Script editor, open <code>Code.gs</code>, select all existing text, delete it, and paste the code below. Click <strong>Save</strong> (disk icon).</li>
                  <li>Click <strong>Deploy</strong> (blue button top right) &rarr; <strong>Manage deployments</strong> &rarr; Click the <strong>Pencil (Edit) icon</strong> &rarr; Under Version, choose <strong>New version</strong> &rarr; Click <strong>Deploy</strong>.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 font-mono text-xs">Code.gs Source Code:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(APPS_SCRIPT_SOURCE);
                      setCopiedScript(true);
                      showToast('Copied Apps Script Code.gs to clipboard!', 'success');
                      setTimeout(() => setCopiedScript(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedScript ? 'Copied to Clipboard!' : 'Copy Entire Script'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-64 border border-slate-800 selection:bg-indigo-700">
                  {APPS_SCRIPT_SOURCE}
                </pre>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-[11px] text-slate-500">
                After deploying, click <strong>"Sync Sheets"</strong> to pull your data.
              </span>
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
