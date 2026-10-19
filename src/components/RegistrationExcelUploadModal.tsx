import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { RegistrationCadre, AcademicYearLevel, StudentRegistrationRecord } from '../types';
import {
  parseExcelSpreadsheet,
  validateAndMapRows,
  getRegistrationCompositeKey,
  ColumnMapping,
  ParsedExcelResult,
  ValidationItem,
} from '../services/registrationExcelService';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ArrowRight,
  ArrowLeft,
  Layers,
  FileCheck,
  Check,
  RotateCcw,
} from 'lucide-react';

interface RegistrationExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCadre?: RegistrationCadre;
}

export const RegistrationExcelUploadModal: React.FC<RegistrationExcelUploadModalProps> = ({
  isOpen,
  onClose,
  defaultCadre = 'FRESH',
}) => {
  const {
    currentSession,
    availableSessions,
    studentRegistrations,
    batchImportStudentRegistrations,
    syncAdmissionsWithGoogleSheets,
    showToast,
  } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetCadre, setTargetCadre] = useState<RegistrationCadre>(defaultCadre);
  const [targetSession, setTargetSession] = useState<string>(currentSession || 'July 2026');
  const [autoDetectedNote, setAutoDetectedNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parsed Sheet Data
  const [parsedData, setParsedData] = useState<ParsedExcelResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    enrollmentKey: '',
    nameKey: '',
    programmeKey: '',
    coursesKey: '',
    phoneKey: '',
    emailKey: '',
    cadreKey: '',
    yearKey: '',
    sessionKey: '',
  });

  // Duplicate strategy: overwrite vs skip
  const [overwriteDuplicates, setOverwriteDuplicates] = useState<boolean>(true);

  // Reset when opening
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedFile(null);
      setTargetCadre(defaultCadre);
      setTargetSession(currentSession || 'July 2026');
      setAutoDetectedNote(null);
      setParseError(null);
      setParsedData(null);
    }
  }, [isOpen, defaultCadre, currentSession]);

  // Existing composite registration keys set (prevents cross-session false duplicates)
  const existingKeys = useMemo(() => {
    const s = new Set<string>();
    studentRegistrations.forEach((r) => {
      if (r.enrollmentNo) {
        s.add(getRegistrationCompositeKey(r.enrollmentNo, r.session, r.academicYear, r.cadre));
      }
    });
    return s;
  }, [studentRegistrations]);

  // Handle file drop / selection
  const handleFileChange = async (file: File) => {
    setParseError(null);
    setSelectedFile(file);
    setIsLoading(true);

    try {
      const result = await parseExcelSpreadsheet(file);
      setParsedData(result);
      setColumnMapping(result.detectedMapping);

      const detectedHints: string[] = [];
      if (result.detectedCadre) {
        setTargetCadre(result.detectedCadre);
        detectedHints.push(result.detectedCadre === 'FRESH' ? 'Fresh Admissions' : 'Re-Registration');
      }
      if (result.detectedSession) {
        setTargetSession(result.detectedSession);
        detectedHints.push(result.detectedSession);
      }

      if (detectedHints.length > 0) {
        setAutoDetectedNote(`Detected from file: ${detectedHints.join(' · ')}`);
      }

      setStep(2);
    } catch (err: any) {
      setParseError(err.message || 'Failed to read spreadsheet file. Ensure it is a valid .xlsx, .xls, or .csv file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Validation Items computed from rows and mapping
  const validationItems: ValidationItem[] = useMemo(() => {
    if (!parsedData || !parsedData.rawRows) return [];
    return validateAndMapRows(
      parsedData.rawRows,
      columnMapping,
      targetCadre,
      targetSession,
      existingKeys
    );
  }, [parsedData, columnMapping, targetCadre, targetSession, existingKeys]);

  const validCount = validationItems.filter((item) => item.isValid).length;
  const errorCount = validationItems.filter((item) => !item.isValid).length;
  const warningCount = validationItems.filter((item) => item.warnings.length > 0).length;

  const handleConfirmImport = () => {
    const validRecords = validationItems
      .filter((item) => item.isValid)
      .map((item) => item.record as StudentRegistrationRecord);

    if (validRecords.length === 0) {
      showToast('No valid records found to import.', 'error');
      return;
    }

    const { added, updated, skipped } = batchImportStudentRegistrations(validRecords, overwriteDuplicates);
    const cadreLabel = targetCadre === 'FRESH' ? 'Fresh Admissions' : 'Re-Registrations';
    showToast(
      `Import complete: ${added} added, ${updated} updated, ${skipped} skipped in ${cadreLabel}. Automatically synchronizing to Google Sheets...`,
      'success'
    );

    // Automatically trigger Google Sheets sync in the background
    try {
      syncAdmissionsWithGoogleSheets();
    } catch (e) {
      console.warn('Auto Google Sheets sync error:', e);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-300 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>Excel & CSV Ingestion Wizard</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono">
                  Step {step} of 3
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {step === 1 && 'Upload admission file & select target register'}
                {step === 2 && 'Review intelligent column mappings'}
                {step === 3 && 'Verify parity preview & commit records'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Cancel and close wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Progress Bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold shrink-0">
          <div
            className={`flex items-center gap-1.5 ${
              step >= 1 ? 'text-indigo-950 font-black' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step > 1
                  ? 'bg-emerald-600 text-white'
                  : step === 1
                  ? 'bg-indigo-900 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {step > 1 ? '✓' : '1'}
            </span>
            <span>Upload File</span>
          </div>

          <div className="w-8 h-0.5 bg-slate-200" />

          <div
            className={`flex items-center gap-1.5 ${
              step >= 2 ? 'text-indigo-950 font-black' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step > 2
                  ? 'bg-emerald-600 text-white'
                  : step === 2
                  ? 'bg-indigo-900 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {step > 2 ? '✓' : '2'}
            </span>
            <span>Column Mapping</span>
          </div>

          <div className="w-8 h-0.5 bg-slate-200" />

          <div
            className={`flex items-center gap-1.5 ${
              step === 3 ? 'text-indigo-950 font-black' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 3 ? 'bg-indigo-900 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </span>
            <span>Verify & Commit</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: FILE SELECTION & TARGET REGISTER */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Target Register Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Target Register <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetCadre('FRESH')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        targetCadre === 'FRESH'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-black">Fresh Admissions</div>
                      <div className="text-[10px] text-slate-500 font-normal">1st Year New Entrants</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetCadre('RE_REGISTRATION')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        targetCadre === 'RE_REGISTRATION'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-black">Re-Registration</div>
                      <div className="text-[10px] text-slate-500 font-normal">2nd & 3rd Year Continuing</div>
                    </button>
                  </div>
                </div>

                {/* Admission Session Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Target Admission Session <span className="text-rose-500">*</span>
                    </label>
                    {autoDetectedNote && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {autoDetectedNote}
                      </span>
                    )}
                  </div>
                  <select
                    value={targetSession}
                    onChange={(e) => setTargetSession(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="January 2025">January 2025 (Re-Reg: 39 Target)</option>
                    <option value="July 2025">July 2025 (Re-Reg: 94 Target)</option>
                    <option value="January 2026">January 2026 (Re-Reg: 26 Target)</option>
                    <option value="July 2026">July 2026 (Active Monsoon Cycle)</option>
                    {availableSessions
                      .filter((s) => !['July 2026', 'January 2026', 'July 2025', 'January 2025'].includes(s))
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                  {/* Quick Select Session Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {['January 2025', 'July 2025', 'January 2026', 'July 2026'].map((sess) => (
                      <button
                        key={sess}
                        type="button"
                        onClick={() => setTargetSession(sess)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer border ${
                          targetSession === sess
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                        }`}
                      >
                        {sess}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    If spreadsheet does not contain a session column, this session is assigned. Multi-session registrations coexist without duplicates.
                  </p>
                </div>
              </div>

              {/* Drag & Drop Upload Container */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-50/60 hover:bg-indigo-50/30 transition cursor-pointer relative"
              >
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isLoading}
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-900 flex items-center justify-center shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Choose Excel spreadsheet or drag and drop here
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Supports standard IGNOU regional files (.xlsx, .xls, .csv)
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-mono text-slate-600 shadow-2xs mt-2">
                    <span>Columns: Enrollment, Name, Programme, Courses, Mobile</span>
                  </div>
                </div>
              </div>

              {parseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 2 && parsedData && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-center justify-between">
                <div>
                  <strong>Sheet: </strong> {parsedData.activeSheet} • <strong>Rows Detected: </strong>{' '}
                  {parsedData.rawRows.length}
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold underline cursor-pointer"
                >
                  Choose Different File
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Enrollment No */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Enrollment Number Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={columnMapping.enrollmentKey}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, enrollmentKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Candidate Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Candidate Name Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={columnMapping.nameKey}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, nameKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Programme Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Programme Code Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={columnMapping.programmeKey}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, programmeKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Courses Taken */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Registered Courses Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={columnMapping.coursesKey}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, coursesKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Mobile Phone Column (Optional)
                  </label>
                  <select
                    value={columnMapping.phoneKey}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, phoneKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  >
                    <option value="">-- None / Skip --</option>
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Email Address Column (Optional)
                  </label>
                  <select
                    value={columnMapping.emailKey}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, emailKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white text-slate-900"
                  >
                    <option value="">-- None / Skip --</option>
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & PARITY VERIFICATION */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              {/* Quality Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-lg font-black text-emerald-800 font-mono">{validCount}</div>
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Ready to Import</div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <div className="text-lg font-black text-amber-800 font-mono">{warningCount}</div>
                  <div className="text-[10px] text-amber-700 font-bold uppercase">Warnings / Duplicates</div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <div className="text-lg font-black text-rose-800 font-mono">{errorCount}</div>
                  <div className="text-[10px] text-rose-700 font-bold uppercase">Errors (Skipped)</div>
                </div>
              </div>

              {/* Deduplication Preference */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <div className="font-bold text-slate-900">Duplicate Enrollment Handling:</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium">
                    <input
                      type="radio"
                      name="dedupStrategy"
                      checked={overwriteDuplicates}
                      onChange={() => setOverwriteDuplicates(true)}
                      className="text-indigo-600"
                    />
                    <span>Update existing records with new data</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium">
                    <input
                      type="radio"
                      name="dedupStrategy"
                      checked={!overwriteDuplicates}
                      onChange={() => setOverwriteDuplicates(false)}
                      className="text-indigo-600"
                    />
                    <span>Skip already existing enrollments</span>
                  </label>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5">Row</th>
                      <th className="py-1.5 px-2.5">Enrollment</th>
                      <th className="py-1.5 px-2.5">Candidate Name</th>
                      <th className="py-1.5 px-2.5">Prog</th>
                      <th className="py-1.5 px-2.5">Courses</th>
                      <th className="py-1.5 px-2.5">Mobile</th>
                      <th className="py-1.5 px-2.5">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationItems.slice(0, 15).map((item) => (
                      <tr key={item.rowIndex} className="hover:bg-slate-50/80">
                        <td className="py-1.5 px-2.5 text-slate-500 font-mono text-[11px]">{item.rowIndex}</td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900">
                          {item.record.enrollmentNo || '-'}
                        </td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-800">{item.record.studentName || '-'}</td>
                        <td className="py-1.5 px-2.5 font-bold text-indigo-900">{item.record.programmeCode || '-'}</td>
                        <td className="py-1.5 px-2.5 text-slate-600 font-mono text-[10px]">
                          {(item.record.courseCodes || []).join(', ') || '-'}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-slate-600 text-[11px]">
                          {item.record.studentPhone || '-'}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {item.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-bold" title={item.errors.join(', ')}>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as 1 | 2)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  if (!columnMapping.enrollmentKey || !columnMapping.nameKey) {
                    showToast('Please map Enrollment Number and Candidate Name columns.', 'error');
                    return;
                  }
                  setStep(3);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <span>Continue to Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={validCount === 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Ingest {validCount} Records</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
