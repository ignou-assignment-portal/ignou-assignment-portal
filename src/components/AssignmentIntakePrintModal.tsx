import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { formatDate, marksToWords } from '../utils/helpers';
import {
  Printer,
  X,
  Download,
  Building2,
  Users,
  FileCheck2,
  Layers,
  CheckCircle2,
  Calendar,
  FileText,
  Filter,
  Search,
} from 'lucide-react';

interface AssignmentIntakePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssignmentIntakePrintModal: React.FC<AssignmentIntakePrintModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentSession, sessionIntakes, allProgrammes, settings } = useApp();

  // Modal Configuration States
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultMemo = useMemo(() => {
    const cleanSession = currentSession.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `SC2033/RC20/ASGN-REP/${cleanSession || '2026'}/01`;
  }, [currentSession]);

  const [dispatchMemoNo, setDispatchMemoNo] = useState<string>(defaultMemo);
  const [dispatchDate, setDispatchDate] = useState<string>(todayStr);
  const [showCourseBreakup, setShowCourseBreakup] = useState<boolean>(true);
  const [onlyWithSubmissions, setOnlyWithSubmissions] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [coveringNote, setCoveringNote] = useState<string>(
    'Certified that all assignment responses (TMA/CMA) detailed below have been duly received from bonafide learners at the Assignment Intake Desk of IGNOU Study Centre 2033, Dimapur and documented in the primary register.'
  );

  // Compute Programme-wise Data
  const programmeReportRows = useMemo(() => {
    // Collect all distinct programme codes
    const intakeProgCodes = Array.from(new Set(sessionIntakes.map((r) => r.programmeCode.trim().toUpperCase()))).filter(Boolean);
    const masterProgCodes = allProgrammes.map((p) => p.code.trim().toUpperCase());

    const allDistinctCodes = Array.from(new Set([...intakeProgCodes, ...(onlyWithSubmissions ? [] : masterProgCodes)]));

    const rows = allDistinctCodes.map((pCode) => {
      const progMaster = allProgrammes.find((p) => p.code.trim().toUpperCase() === pCode);
      const progIntakes = sessionIntakes.filter((r) => r.programmeCode.trim().toUpperCase() === pCode);

      // Candidates = count of unique enrollment numbers for this programme
      const candidates = new Set(progIntakes.map((r) => r.enrollmentNo.trim())).size;

      // Assignment Intake = total count of course scripts received for this programme
      const assignmentIntake = progIntakes.reduce((acc, r) => acc + r.courseCodes.length, 0);

      // Course-wise breakdown
      const courseMap: Record<string, number> = {};
      progIntakes.forEach((r) => {
        r.courseCodes.forEach((c) => {
          const cleanCode = c.trim().toUpperCase();
          courseMap[cleanCode] = (courseMap[cleanCode] || 0) + 1;
        });
      });

      const coursesBreakup = Object.entries(courseMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, count]) => ({
          code,
          count,
        }));

      return {
        programmeCode: pCode,
        programmeTitle: progMaster ? progMaster.name : `${pCode} Programme`,
        department: progMaster?.department || '',
        candidatesCount: candidates,
        assignmentIntake,
        coursesBreakup,
      };
    });

    // Filter by submission if enabled
    let result = onlyWithSubmissions ? rows.filter((r) => r.assignmentIntake > 0) : rows;

    // Filter by search query if any
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.programmeCode.toLowerCase().includes(q) ||
          r.programmeTitle.toLowerCase().includes(q) ||
          r.coursesBreakup.some((c) => c.code.toLowerCase().includes(q))
      );
    }

    // Sort by assignment intake descending, then programme code ascending
    return result.sort((a, b) => b.assignmentIntake - a.assignmentIntake || a.programmeCode.localeCompare(b.programmeCode));
  }, [sessionIntakes, allProgrammes, onlyWithSubmissions, searchQuery]);

  // Grand Total Calculations
  const grandTotalCandidates = useMemo(() => {
    // Unique candidates across the session
    return new Set(sessionIntakes.map((r) => r.enrollmentNo.trim())).size;
  }, [sessionIntakes]);

  const grandTotalAssignmentIntake = useMemo(() => {
    return sessionIntakes.reduce((acc, r) => acc + r.courseCodes.length, 0);
  }, [sessionIntakes]);

  const filteredTotalCandidates = useMemo(() => {
    return programmeReportRows.reduce((sum, r) => sum + r.candidatesCount, 0);
  }, [programmeReportRows]);

  const filteredTotalAssignmentIntake = useMemo(() => {
    return programmeReportRows.reduce((sum, r) => sum + r.assignmentIntake, 0);
  }, [programmeReportRows]);

  // Export CSV Action
  const handleExportCSV = () => {
    const headers = [
      'S.No',
      'Programme Code',
      'Programme Title',
      'Candidates Count',
      'Assignment Intake (Scripts)',
      'Courses Breakup',
    ];

    const dataRows = programmeReportRows.map((r, idx) => [
      idx + 1,
      r.programmeCode,
      `"${r.programmeTitle.replace(/"/g, '""')}"`,
      r.candidatesCount,
      r.assignmentIntake,
      `"${r.coursesBreakup.map((c) => `${c.code}: ${c.count}`).join('; ')}"`,
    ]);

    const grandTotalRow = [
      '',
      'GRAND TOTAL',
      `"Total Programmes: ${programmeReportRows.length}"`,
      grandTotalCandidates,
      grandTotalAssignmentIntake,
      '""',
    ];

    const csvContent = [
      `"IGNOU STUDY CENTRE 2033 (SC-2033) - PROGRAMME-WISE ASSIGNMENT INTAKE REPORT"`,
      `"Academic Session: ${currentSession} | Dispatch Memo: ${dispatchMemoNo} | Date: ${dispatchDate}"`,
      `"Regional Centre: RC-20 Kohima | Host Institution: S.D. Jain Girls' College, Dimapur"`,
      '',
      headers.join(','),
      ...dataRows.map((row) => row.join(',')),
      grandTotalRow.join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `IGNOU_SC2033_Programme_Intake_Report_${currentSession.replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto print:m-0 print:border-none print:shadow-none print:w-full print:rounded-none">
        {/* Modal Action Bar (Hidden when printing) */}
        <div className="px-5 py-3.5 bg-zinc-900 text-white flex items-center justify-between gap-3 border-b border-zinc-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-100">
                  Regional Office Assignment Intake Report
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-500/40">
                  RC-20 Kohima
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Printable programme-wise summary of students & assignment intake with statutory seal & grand total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition border border-zinc-700 cursor-pointer"
              title="Download Report as CSV file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              type="button"
              id="btn-print-intake-report"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-md cursor-pointer"
              title="Print Report or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition cursor-pointer ml-1"
              title="Close Print Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Strip (Hidden when printing) */}
        <div className="bg-zinc-50 border-b border-zinc-200 px-5 py-3 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                Dispatch Memo Ref No.
              </label>
              <input
                type="text"
                value={dispatchMemoNo}
                onChange={(e) => setDispatchMemoNo(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:ring-2 focus:ring-indigo-500"
                placeholder="Memo Reference"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                Report / Dispatch Date
              </label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-700 font-semibold py-1.5">
                <input
                  type="checkbox"
                  checked={showCourseBreakup}
                  onChange={(e) => setShowCourseBreakup(e.target.checked)}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Include Course-wise Breakup</span>
              </label>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-700 font-semibold py-1.5">
                <input
                  type="checkbox"
                  checked={onlyWithSubmissions}
                  onChange={(e) => setOnlyWithSubmissions(e.target.checked)}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Programmes with Intake Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          id="printable-intake-matrix-report"
          className="p-6 md:p-8 space-y-6 bg-white text-zinc-900 max-h-[78vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-6"
        >
          {/* Institutional University & Study Centre Header */}
          <div className="border-b-2 border-zinc-900 pb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border border-zinc-800 rounded bg-zinc-100">
                  OFFICIAL SUBMISSION REPORT TO REGIONAL CENTRE
                </span>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-950 font-serif mt-1.5">
                  Indira Gandhi National Open University
                </h1>
                <div className="text-sm font-bold text-zinc-800">
                  IGNOU Study Centre 2033 (SC-2033)
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">
                  Host Campus: S.D. Jain Girls' College, Jain Temple Road, Dimapur - 797112, Nagaland
                </div>
                <div className="text-[11px] font-semibold text-indigo-900">
                  Jurisdiction: Regional Centre Kohima (RC-20)
                </div>
              </div>

              <div className="border border-zinc-300 rounded-xl p-3 bg-zinc-50 sm:text-right text-xs shrink-0 min-w-[210px] space-y-1">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                    Dispatch Reference No:
                  </span>
                  <span className="font-mono font-black text-zinc-950 text-xs">
                    {dispatchMemoNo}
                  </span>
                </div>
                <div className="pt-1 border-t border-zinc-200">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                    Report Date:
                  </span>
                  <span className="font-medium text-zinc-900">
                    {formatDate(dispatchDate)}
                  </span>
                </div>
                <div className="pt-1 border-t border-zinc-200">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                    Academic Cycle / Session:
                  </span>
                  <span className="font-mono font-bold text-indigo-950">
                    {currentSession}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="mt-4 pt-3 border-t border-zinc-300 text-center space-y-0.5">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-zinc-950">
                Consolidated Programme-Wise Assignment Intake Report
              </h2>
              <p className="text-xs text-zinc-600 font-medium italic">
                Statement of Assignment Responses Received from Students at Study Centre 2033 for Submission to Regional Director, Regional Centre Kohima
              </p>
            </div>
          </div>

          {/* Addressed To Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-zinc-50 border border-zinc-300 rounded-xl p-3.5">
            <div>
              <span className="text-[10px] font-bold uppercase text-zinc-500 block mb-0.5">
                Addressed To:
              </span>
              <div className="font-bold text-zinc-900 text-sm">The Regional Director</div>
              <div className="text-zinc-800 font-semibold">IGNOU Regional Centre Kohima</div>
              <div className="text-zinc-600">Agriland Building, below AG Office</div>
              <div className="text-zinc-600">AG Colony, Kohima - 797001, Nagaland</div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-zinc-500 block mb-0.5">
                Transmitted By:
              </span>
              <div className="font-bold text-zinc-900 text-sm">
                The Coordinator / In-Charge
              </div>
              <div className="text-zinc-700">IGNOU Study Centre 2033 (SC-2033)</div>
              <div className="text-zinc-600">S.D. Jain Girls' College, Dimapur - 797112</div>
              <div className="text-zinc-600 font-mono text-[11px]">
                Phone: {settings.coordinatorContact || '+91 9436013686'}
              </div>
            </div>
          </div>

          {/* Key Summary Stats Cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border border-zinc-300 bg-zinc-50 rounded-xl p-3">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Programmes Represented
              </div>
              <div className="text-2xl font-black text-zinc-950 font-mono mt-0.5">
                {programmeReportRows.length}
              </div>
              <div className="text-[10px] text-zinc-500">Active Academic Programmes</div>
            </div>

            <div className="border border-indigo-200 bg-indigo-50/60 rounded-xl p-3">
              <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
                Total Unique Candidates
              </div>
              <div className="text-2xl font-black text-indigo-950 font-mono mt-0.5">
                {grandTotalCandidates}
              </div>
              <div className="text-[10px] text-indigo-700 font-medium">Learners Submitted</div>
            </div>

            <div className="border border-amber-300 bg-amber-50/70 rounded-xl p-3">
              <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                Grand Total Assignment Intake
              </div>
              <div className="text-2xl font-black text-amber-950 font-mono mt-0.5">
                {grandTotalAssignmentIntake}
              </div>
              <div className="text-[10px] text-amber-800 font-bold">Physical Assignment Scripts</div>
            </div>
          </div>

          {/* Primary Programme-Wise Tabulation Table */}
          <div className="overflow-x-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-100 text-zinc-900 uppercase text-[10px] font-bold border-b-2 border-zinc-800">
                  <th className="py-2.5 px-3 w-12 text-center border-r border-zinc-300">S.No</th>
                  <th className="py-2.5 px-3 min-w-[220px] border-r border-zinc-300">
                    Programme (Code & Title)
                  </th>
                  <th className="py-2.5 px-3 text-center w-28 border-r border-zinc-300">
                    Candidates <span className="block text-[9px] font-normal text-zinc-500">(Learners)</span>
                  </th>
                  <th className="py-2.5 px-3 text-center w-36 border-r border-zinc-300 bg-amber-50/60 text-amber-950">
                    Assignment Intake <span className="block text-[9px] font-normal text-amber-800">(No. of Scripts)</span>
                  </th>
                  {showCourseBreakup && (
                    <th className="py-2.5 px-3 border-r border-zinc-300 min-w-[260px]">
                      Course Codes Received & Script Count
                    </th>
                  )}
                  <th className="py-2.5 px-3 text-center w-28">Status / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-300 text-zinc-800">
                {programmeReportRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showCourseBreakup ? 6 : 5}
                      className="py-8 text-center text-zinc-500 italic"
                    >
                      No assignment intake records found for academic cycle {currentSession}.
                    </td>
                  </tr>
                ) : (
                  programmeReportRows.map((row, index) => (
                    <tr
                      key={row.programmeCode}
                      className={index % 2 === 1 ? 'bg-zinc-50/50' : 'bg-white'}
                    >
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-600 border-r border-zinc-300">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3 border-r border-zinc-300">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-zinc-200 text-zinc-900 font-mono font-black text-xs border border-zinc-300">
                            {row.programmeCode}
                          </span>
                          <span className="font-bold text-zinc-950">
                            {row.programmeTitle}
                          </span>
                        </div>
                        {row.department && (
                          <div className="text-[10px] text-zinc-500 mt-0.5 ml-1">
                            {row.department}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-950 border-r border-zinc-300 text-sm">
                        {row.candidatesCount}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-amber-950 border-r border-zinc-300 bg-amber-50/30 text-sm">
                        {row.assignmentIntake}
                      </td>
                      {showCourseBreakup && (
                        <td className="py-2.5 px-3 border-r border-zinc-300">
                          {row.coursesBreakup.length === 0 ? (
                            <span className="text-zinc-400 italic text-[11px]">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {row.coursesBreakup.map((c) => (
                                <span
                                  key={c.code}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 font-mono text-[10px] font-semibold border border-zinc-200"
                                >
                                  <span>{c.code}:</span>
                                  <strong className="text-indigo-900">{c.count}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Intake Verified
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Statutory Grand Total Row */}
              <tfoot className="bg-zinc-100 font-bold border-t-2 border-zinc-900 text-zinc-950">
                <tr>
                  <td
                    colSpan={2}
                    className="py-3 px-3 text-left font-black uppercase text-xs border-r border-zinc-300 tracking-wider"
                  >
                    GRAND TOTAL ({programmeReportRows.length} Programmes)
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-base border-r border-zinc-300 text-indigo-950">
                    {grandTotalCandidates}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-base border-r border-zinc-300 bg-amber-100 text-amber-950">
                    {grandTotalAssignmentIntake}
                  </td>
                  {showCourseBreakup && (
                    <td className="py-3 px-3 text-xs text-zinc-600 border-r border-zinc-300 font-medium">
                      Total Course-Script Submissions Received: <strong>{grandTotalAssignmentIntake}</strong>
                    </td>
                  )}
                  <td className="py-3 px-3 text-center text-[10px] uppercase font-bold text-zinc-700">
                    Consolidated
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Intake Count in Words Banner */}
          <div className="p-3 bg-zinc-50 border border-zinc-300 rounded-xl text-xs space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="text-zinc-500 font-medium uppercase text-[10px] tracking-wider">
                  Total Assignment Intake in Words:{' '}
                </span>
                <span className="font-bold text-zinc-950 font-serif">
                  {grandTotalAssignmentIntake > 0
                    ? `${marksToWords(grandTotalAssignmentIntake)} Assignment Scripts Only`
                    : 'Zero Assignment Scripts'}
                </span>
              </div>
              <div className="text-[11px] text-zinc-600">
                Total Unique Learners Registered:{' '}
                <strong className="text-zinc-900">{grandTotalCandidates} Candidates</strong>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 italic pt-1 border-t border-zinc-200">
              {coveringNote}
            </p>
          </div>

          {/* Statutory Formal Sign-Off Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs border-t border-zinc-300">
            {/* Column 1: Intake Desk Official */}
            <div className="p-3.5 flex flex-col justify-between space-y-6 bg-white border-0 border-none shadow-none print:border-none print:shadow-none">
              <div>
                <div className="text-[10px] font-bold uppercase text-zinc-700 tracking-wider">
                  1. Assignment Intake Desk In-Charge
                </div>
                <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                  Verified with primary intake register tokens and physical scripts.
                </p>
              </div>
              <div className="border-t border-dashed border-zinc-400 pt-2 text-center">
                <div className="font-bold text-zinc-900 text-xs">Intake Desk Official</div>
                <div className="text-[10px] text-zinc-500">Assignment Operations, SC-2033</div>
                <div className="text-[10px] font-mono text-zinc-400 mt-0.5">Date: {formatDate(dispatchDate)}</div>
              </div>
            </div>

            {/* Column 2: Study Centre Coordinator Attestation & Seal (Clean open block, no enclosing border box) */}
            <div className="p-3.5 flex flex-col justify-between space-y-6 bg-white border-0 border-none shadow-none print:border-none print:shadow-none">
              <div>
                <div className="text-[10px] font-bold uppercase text-zinc-900 tracking-wider">
                  2. Coordinator Attestation & Seal
                </div>
                <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                  Transmitted to Regional Centre Kohima with intact institutional seal and records.
                </p>
              </div>
              <div className="border-t border-dashed border-zinc-400 pt-2 text-center">
                <div className="font-serif italic font-black text-indigo-950 text-sm">
                  {settings.coordinatorName || 'Dr. Sant Kumar Gupta'}
                </div>
                <div className="font-bold text-[11px] text-zinc-900">
                  {settings.coordinatorDesignation || 'Coordinator, IGNOU SC-2033'}
                </div>
                <div className="text-[10px] text-zinc-600">
                  S.D. Jain Girls' College, Dimapur
                </div>
              </div>
            </div>

            {/* Column 3: Regional Centre Kohima Receipt Acknowledgment Slip */}
            <div className="border border-zinc-400 rounded-xl p-3.5 flex flex-col justify-between space-y-6 bg-zinc-50/50">
              <div>
                <div className="text-[10px] font-bold uppercase text-zinc-700 tracking-wider">
                  3. Regional Centre Kohima Acknowledgment
                </div>
                <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                  For use at Regional Centre Kohima (RC-20) Inward Desk.
                </p>
              </div>
              <div className="border-t border-dashed border-zinc-400 pt-2 text-left space-y-1 text-[10px] font-mono text-zinc-600">
                <div>RC Inward Diary No: __________________</div>
                <div>Date Received: _______________________</div>
                <div>Receiving Official Signature: ___________</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
