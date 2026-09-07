import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CourseEvaluationRecord } from '../types';
import { calculateIGNOUGrade, formatDate } from '../utils/helpers';
import {
  Layers,
  Award,
  CheckCircle2,
  Lock,
  Unlock,
  UserCheck,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  FileCheck2,
  Printer,
  ChevronDown,
  UserX,
  Sparkles,
  Info,
  Clock,
  Stamp,
  ArrowUpDown,
  BookOpen,
} from 'lucide-react';

export const CourseEvaluationMaster: React.FC = () => {
  const {
    currentSession,
    sessionCourseEvaluations,
    allCourseEvaluations,
    evaluators,
    allotEvaluatorToEvaluations,
    updateEvaluationMarks,
    toggleLockMarks,
    batchLockMarks,
    isAdmin,
    currentRole,
    settings,
  } = useApp();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [lockFilter, setLockFilter] = useState<string>('ALL');

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchEvaluatorId, setBatchEvaluatorId] = useState<string>('');
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  // Print Award Sheet Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printCourseCode, setPrintCourseCode] = useState<string>('');

  // Extract all distinct course codes in active session
  const distinctCourses = useMemo(() => {
    const set = new Set<string>();
    sessionCourseEvaluations.forEach((rec) => set.add(rec.courseCode));
    return Array.from(set).sort();
  }, [sessionCourseEvaluations]);

  // Filtered rows
  const filteredRecords = useMemo(() => {
    return sessionCourseEvaluations.filter((rec) => {
      // Course code filter
      if (selectedCourseFilter !== 'ALL' && rec.courseCode !== selectedCourseFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && rec.status !== statusFilter) {
        return false;
      }
      // Lock filter
      if (lockFilter === 'LOCKED' && !rec.isLocked) return false;
      if (lockFilter === 'UNLOCKED' && rec.isLocked) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEnr = rec.enrollmentNo.toLowerCase().includes(q);
        const matchName = rec.studentName.toLowerCase().includes(q);
        const matchKey = rec.submissionKey.toLowerCase().includes(q);
        const matchCourse = rec.courseCode.toLowerCase().includes(q);
        const matchEvaluator = rec.evaluatorName?.toLowerCase().includes(q);
        const matchToken = rec.tokenNo.toLowerCase().includes(q);
        if (!matchEnr && !matchName && !matchKey && !matchCourse && !matchEvaluator && !matchToken) {
          return false;
        }
      }
      return true;
    });
  }, [sessionCourseEvaluations, selectedCourseFilter, statusFilter, lockFilter, searchQuery]);

  // Evaluator lookup
  const getEvaluator = (id: string | null | undefined) => {
    if (!id) return null;
    return evaluators.find((e) => e.id === id);
  };

  // Get evaluators eligible for a given course
  const getEligibleEvaluators = (courseCode: string) => {
    return evaluators.filter((ev) => ev.eligibleCourses.includes(courseCode));
  };

  // Checkbox selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredRecords.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // Batch Allotment Action
  const handleBatchAllot = () => {
    if (selectedIds.length === 0) {
      setBatchMessage('Please select at least one script to allot.');
      setTimeout(() => setBatchMessage(null), 3500);
      return;
    }
    if (!batchEvaluatorId) {
      setBatchMessage('Please choose an academic counsellor for allotment.');
      setTimeout(() => setBatchMessage(null), 3500);
      return;
    }

    const targetEvaluator = evaluators.find((e) => e.id === batchEvaluatorId);
    if (!targetEvaluator) return;

    // Check if evaluator is eligible for all selected courses
    const selectedRecords = sessionCourseEvaluations.filter((r) => selectedIds.includes(r.id));
    const ineligible = selectedRecords.filter((r) => !targetEvaluator.eligibleCourses.includes(r.courseCode));

    if (ineligible.length > 0) {
      const distinctBadCourses = Array.from(new Set(ineligible.map((r) => r.courseCode))).join(', ');
      alert(
        `Academic Validation Warning: ${targetEvaluator.name} (${targetEvaluator.evaluatorCode}) is not approved to evaluate courses: ${distinctBadCourses}.\nOnly eligible courses can be assigned to this counsellor.`
      );
      return;
    }

    allotEvaluatorToEvaluations(selectedIds, batchEvaluatorId);
    setBatchMessage(`Successfully allotted ${selectedIds.length} script(s) to ${targetEvaluator.name} (${targetEvaluator.evaluatorCode}).`);
    setSelectedIds([]);
    setTimeout(() => setBatchMessage(null), 4000);
  };

  // Batch Lock / Unlock
  const handleBatchLock = (shouldLock: boolean) => {
    if (selectedIds.length === 0) return;
    if (!shouldLock && !isAdmin) {
      alert('Security Alert: Only an Administrator (Coordinator) can unlock marks for verified scripts.');
      return;
    }

    batchLockMarks(selectedIds, shouldLock);
    setSelectedIds([]);
  };

  // Statistics calculation for active session
  const summaryStats = useMemo(() => {
    const total = sessionCourseEvaluations.length;
    const pendingAllotment = sessionCourseEvaluations.filter((r) => !r.evaluatorId).length;
    const allotted = sessionCourseEvaluations.filter((r) => r.evaluatorId && r.marks === null).length;
    const evaluated = sessionCourseEvaluations.filter((r) => r.marks !== null && !r.isLocked).length;
    const locked = sessionCourseEvaluations.filter((r) => r.isLocked).length;

    // Grades tally
    let gradeA = 0;
    let gradeB = 0;
    let gradeC = 0;
    let gradeD = 0;
    let gradeE = 0;
    let totalMarksSum = 0;
    let marksCount = 0;

    sessionCourseEvaluations.forEach((r) => {
      if (r.marks !== null) {
        marksCount++;
        totalMarksSum += r.marks;
        if (r.grade === 'A') gradeA++;
        else if (r.grade === 'B') gradeB++;
        else if (r.grade === 'C') gradeC++;
        else if (r.grade === 'D') gradeD++;
        else if (r.grade === 'E') gradeE++;
      }
    });

    const averageMark = marksCount > 0 ? (totalMarksSum / marksCount).toFixed(1) : '—';
    const passCount = gradeA + gradeB + gradeC + gradeD;
    const passRate = marksCount > 0 ? Math.round((passCount / marksCount) * 100) : 0;

    return {
      total,
      pendingAllotment,
      allotted,
      evaluated,
      locked,
      gradeA,
      gradeB,
      gradeC,
      gradeD,
      gradeE,
      marksCount,
      averageMark,
      passRate,
    };
  }, [sessionCourseEvaluations]);

  return (
    <div className="space-y-6">
      {/* Module B Header Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Module B
              </span>
              <span className="text-xs text-zinc-500 font-mono">2_Course_Evaluation_Master</span>
              <span className="text-zinc-300">•</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Cycle: {currentSession}
              </span>
            </div>
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">
              Course Evaluation Ledger & Marks Engine
            </h2>
            <p className="text-xs text-zinc-600 mt-1 max-w-2xl">
              Deterministic 1-to-N registration unpacking, academic counsellor allotment with course eligibility validation, real-time IGNOU 5-point scale calculation, and administrative marks locking.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setPrintCourseCode(selectedCourseFilter !== 'ALL' ? selectedCourseFilter : distinctCourses[0] || '');
                setIsPrintModalOpen(true);
              }}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-600" />
              <span>Print Official Award Sheet</span>
            </button>

            {isAdmin ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-medium text-indigo-900">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Coordinator Mode: Unlock Enabled</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Desk Official: Read-Only for Locked Scripts</span>
              </div>
            )}
          </div>
        </div>

        {/* Real-Time Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-zinc-100">
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Total Unpacked Scripts
            </span>
            <span className="text-2xl font-black text-zinc-900 mt-0.5 block font-mono">
              {summaryStats.total}
            </span>
            <span className="text-[10px] text-zinc-500">1:N split from Intakes</span>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              Pending Allotment
            </span>
            <span className="text-2xl font-black text-amber-900 mt-0.5 block font-mono">
              {summaryStats.pendingAllotment}
            </span>
            <span className="text-[10px] text-amber-700">Awaiting Counsellor</span>
          </div>

          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
              Under Evaluation
            </span>
            <span className="text-2xl font-black text-blue-900 mt-0.5 block font-mono">
              {summaryStats.allotted}
            </span>
            <span className="text-[10px] text-blue-700">Allotted to Counsellors</span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Marks Entered
            </span>
            <span className="text-2xl font-black text-emerald-900 mt-0.5 block font-mono">
              {summaryStats.evaluated}
            </span>
            <span className="text-[10px] text-emerald-700">Ready for Verification</span>
          </div>

          <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
              Locked & Verified
            </span>
            <span className="text-2xl font-black text-purple-900 mt-0.5 block font-mono">
              {summaryStats.locked}
            </span>
            <span className="text-[10px] text-purple-700">Sealed by Coordinator</span>
          </div>
        </div>

        {/* IGNOU 5-Point Scale Reference Pill Banner */}
        <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200/70 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-700 font-semibold">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>IGNOU 5-Point Grading Master:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-medium">
              <strong>A</strong> (80-100%): Excellent
            </span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded font-medium">
              <strong>B</strong> (60-79.9%): Very Good
            </span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-medium">
              <strong>C</strong> (50-59.9%): Good
            </span>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-900 border border-orange-300 rounded font-medium">
              <strong>D</strong> (40-49.9%): Satisfactory
            </span>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 rounded font-medium">
              <strong>E</strong> (0-39.9%): Unsatisfactory / Failed
            </span>
          </div>
        </div>
      </div>

      {/* Batch Allotment & Action Bar (when rows are selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-900 text-white rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-indigo-800 rounded-lg text-xs font-mono font-bold">
              {selectedIds.length} script(s) selected
            </span>
            <span className="text-xs text-indigo-200 hidden sm:inline">
              Batch action on evaluation ledger rows
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Batch Allotment Dropdown */}
            <div className="flex items-center gap-1.5 bg-indigo-950/80 px-2.5 py-1.5 rounded-xl border border-indigo-700">
              <UserCheck className="w-3.5 h-3.5 text-indigo-300" />
              <select
                value={batchEvaluatorId}
                onChange={(e) => setBatchEvaluatorId(e.target.value)}
                className="bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer max-w-[200px]"
              >
                <option value="" className="text-zinc-800">
                  Select Counsellor...
                </option>
                {evaluators.map((ev) => (
                  <option key={ev.id} value={ev.id} className="text-zinc-800">
                    {ev.name} ({ev.evaluatorCode}) - [{ev.eligibleCourses.join(', ')}]
                  </option>
                ))}
              </select>
              <button
                onClick={handleBatchAllot}
                className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Allot
              </button>
            </div>

            {/* Batch Lock */}
            <button
              onClick={() => handleBatchLock(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Lock marks for selected evaluated scripts"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Marks</span>
            </button>

            {/* Batch Unlock (Admin Only) */}
            {isAdmin && (
              <button
                onClick={() => handleBatchLock(false)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Admin Override: Unlock marks"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlock (Admin)</span>
              </button>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-200 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Batch Feedback Banner */}
      {batchMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{batchMessage}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search Enrollment, Name, SUB Key, Token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Course Filter */}
          <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 px-2.5 py-1.5 rounded-xl text-xs">
            <span className="text-zinc-500 font-medium">Course:</span>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="bg-transparent font-bold text-zinc-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Courses ({distinctCourses.length})</option>
              {distinctCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 px-2.5 py-1.5 rounded-xl text-xs">
            <span className="text-zinc-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-zinc-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending Allotment">Pending Allotment</option>
              <option value="Allotted">Allotted</option>
              <option value="Evaluated">Evaluated</option>
              <option value="Marks Locked">Marks Locked</option>
            </select>
          </div>

          {/* Lock Filter */}
          <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 px-2.5 py-1.5 rounded-xl text-xs">
            <span className="text-zinc-500 font-medium">Seal:</span>
            <select
              value={lockFilter}
              onChange={(e) => setLockFilter(e.target.value)}
              className="bg-transparent font-bold text-zinc-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All (Locked & Unlocked)</option>
              <option value="LOCKED">Locked / Verified Only</option>
              <option value="UNLOCKED">Editable / Unlocked Only</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-zinc-500 font-mono">
          Showing <strong>{filteredRecords.length}</strong> of {sessionCourseEvaluations.length} ledger rows
        </div>
      </div>

      {/* Primary Unpacked Ledger Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredRecords.length > 0 &&
                      filteredRecords.every((r) => selectedIds.includes(r.id))
                    }
                    onChange={handleSelectAll}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3.5">Deterministic Key (SUB_ENR_COURSE_TERM)</th>
                <th className="p-3.5">Candidate & Token</th>
                <th className="p-3.5">Course Code</th>
                <th className="p-3.5">Academic Counsellor Allotment</th>
                <th className="p-3.5 w-32">Marks (0-100)</th>
                <th className="p-3.5 w-28">IGNOU Grade</th>
                <th className="p-3.5">Status & Verification Seal</th>
                <th className="p-3.5 text-center w-28">Lock Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Layers className="w-8 h-8 text-zinc-300 mx-auto" />
                      <p className="font-semibold text-zinc-700">No evaluation ledger records found</p>
                      <p className="text-[11px] text-zinc-400">
                        Try clearing search filters or register students via Module A Intake Desk to automatically unpack course scripts.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isSelected = selectedIds.includes(record.id);
                  const eligibleEvaluators = getEligibleEvaluators(record.courseCode);
                  const currentEvaluator = getEvaluator(record.evaluatorId);
                  const gradeInfo = calculateIGNOUGrade(record.marks);

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-zinc-50/70 transition ${
                        record.isLocked
                          ? 'bg-purple-50/15'
                          : isSelected
                          ? 'bg-indigo-50/40'
                          : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(record.id)}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Primary Key */}
                      <td className="p-3.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                            {record.submissionKey}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                          <span>Mode: {record.submissionMode}</span>
                          {record.consignmentNo && (
                            <span className="text-zinc-600 font-mono font-medium">
                              ({record.consignmentNo})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Candidate */}
                      <td className="p-3.5">
                        <div className="font-bold text-zinc-900 text-xs">
                          {record.studentName}
                        </div>
                        <div className="text-zinc-500 font-mono text-[11px]">
                          Enr: {record.enrollmentNo}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                          {record.tokenNo} • {record.programmeCode}
                        </div>
                      </td>

                      {/* Course Code */}
                      <td className="p-3.5">
                        <span className="inline-block px-2.5 py-1 bg-zinc-100 text-zinc-800 font-mono font-bold rounded-lg border border-zinc-200 text-xs">
                          {record.courseCode}
                        </span>
                      </td>

                      {/* Academic Counsellor Allotment (with eligibility validation) */}
                      <td className="p-3.5">
                        {record.isLocked ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-zinc-800">
                              {record.evaluatorName || 'Unallotted'}
                            </span>
                            {record.evaluatorCode && (
                              <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-1 rounded">
                                {record.evaluatorCode}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={record.evaluatorId || ''}
                              onChange={(e) =>
                                allotEvaluatorToEvaluations([record.id], e.target.value || null)
                              }
                              className={`w-full max-w-[210px] text-xs py-1 px-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                                record.evaluatorId
                                  ? 'bg-blue-50/50 border-blue-200 text-blue-950 font-medium'
                                  : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                              }`}
                            >
                              <option value="">— Choose Counsellor —</option>
                              {eligibleEvaluators.map((ev) => (
                                <option key={ev.id} value={ev.id}>
                                  {ev.name} ({ev.evaluatorCode})
                                </option>
                              ))}
                            </select>

                            {eligibleEvaluators.length === 0 && (
                              <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                No approved evaluator for {record.courseCode}
                              </p>
                            )}

                            {record.allottedDate && (
                              <p className="text-[10px] text-zinc-400">
                                Allotted: {formatDate(record.allottedDate)}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Numeric Marks Input (0 - 100) */}
                      <td className="p-3.5">
                        {record.isLocked ? (
                          <span className="font-mono font-black text-sm text-zinc-900 bg-zinc-100 px-3 py-1 rounded-lg border border-zinc-200">
                            {record.marks !== null ? `${record.marks} / 100` : '—'}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={record.marks !== null && record.marks !== undefined ? record.marks : ''}
                              placeholder="0-100"
                              onChange={(e) => {
                                const valStr = e.target.value;
                                if (valStr === '') {
                                  updateEvaluationMarks(record.id, null);
                                  return;
                                }
                                const n = parseInt(valStr, 10);
                                if (isNaN(n) || n < 0 || n > 100) return;
                                updateEvaluationMarks(record.id, n);
                              }}
                              className="w-20 px-2.5 py-1 text-xs font-mono font-bold border border-zinc-300 rounded-lg text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-[11px] text-zinc-400 font-mono">/100</span>
                          </div>
                        )}
                      </td>

                      {/* Real-time IGNOU Grade Badge */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded border ${gradeInfo.badgeClass}`}
                          >
                            Grade {gradeInfo.grade}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block mt-0.5 font-medium">
                          {gradeInfo.label}
                        </span>
                      </td>

                      {/* Status & Official Verification Seal */}
                      <td className="p-3.5">
                        {record.isLocked ? (
                          <div className="bg-purple-50 border border-purple-200 p-2 rounded-xl text-[11px] space-y-1">
                            <div className="flex items-center gap-1.5 text-purple-900 font-bold">
                              <Stamp className="w-3.5 h-3.5 text-purple-700" />
                              <span>LOCKED & VERIFIED</span>
                            </div>
                            <div className="text-[10px] text-purple-700 font-mono">
                              By: {record.lockedBy || 'Coordinator'}
                            </div>
                            <div className="text-[10px] text-purple-600 font-mono">
                              {record.lockedAt ? formatDate(record.lockedAt) : 'Cycle Approved'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                record.status === 'Evaluated'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : record.status === 'Allotted'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {record.status}
                            </span>
                            <div className="text-[10px] text-zinc-400 mt-1">
                              {record.marks !== null ? 'Ready to Lock' : 'Pending Entry'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Lock / Unlock Toggle Button */}
                      <td className="p-3.5 text-center">
                        {record.isLocked ? (
                          isAdmin ? (
                            <button
                              onClick={() => toggleLockMarks(record.id, false)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer mx-auto shadow-2xs"
                              title="Administrator Override: Click to Unlock"
                            >
                              <Unlock className="w-3 h-3 text-rose-600" />
                              <span>Unlock</span>
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-100 px-2 py-1 rounded border border-zinc-200 cursor-not-allowed"
                              title="Locked by Coordinator. Administrative privilege required to unlock."
                            >
                              <Lock className="w-3 h-3 text-zinc-400" />
                              <span>Sealed</span>
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => toggleLockMarks(record.id, true)}
                            disabled={record.marks === null || record.marks === undefined}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer mx-auto shadow-2xs ${
                              record.marks !== null && record.marks !== undefined
                                ? 'bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300'
                                : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed opacity-60'
                            }`}
                            title={
                              record.marks !== null
                                ? 'Lock and verify marks'
                                : 'Enter marks before locking'
                            }
                          >
                            <Lock className="w-3 h-3" />
                            <span>Lock</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Award Sheet Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8 print:m-0 print:p-0 print:shadow-none">
            {/* Modal Controls (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-zinc-900">
                  Print Official IGNOU Course Award List
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={printCourseCode}
                  onChange={(e) => setPrintCourseCode(e.target.value)}
                  className="px-3 py-1.5 bg-zinc-100 border border-zinc-300 rounded-lg text-xs font-bold"
                >
                  {distinctCourses.map((c) => (
                    <option key={c} value={c}>
                      Course: {c}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>

                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Formal Award Sheet Content */}
            <div className="p-6 border-2 border-zinc-800 rounded-lg space-y-6 print:border-none print:p-0">
              {/* Institutional Header */}
              <div className="text-center border-b-2 border-zinc-800 pb-4 space-y-1">
                <h1 className="text-lg font-black tracking-wide uppercase text-zinc-950">
                  INDIRA GANDHI NATIONAL OPEN UNIVERSITY
                </h1>
                <p className="text-xs font-bold text-zinc-800">
                  STUDY CENTRE SC-2033 • EVALUATION & EXAMINATION CELL
                </p>
                <p className="text-[11px] text-zinc-600">
                  OFFICIAL ASSIGNMENT EVALUATION MASTER & MARKS AWARD SHEET
                </p>
                <div className="flex justify-center gap-4 text-xs font-mono font-bold text-zinc-900 mt-2">
                  <span>SESSION: {currentSession.toUpperCase()}</span>
                  <span>•</span>
                  <span>COURSE CODE: {printCourseCode || 'ALL COURSES'}</span>
                  <span>•</span>
                  <span>CENTRE CODE: SC-2033</span>
                </div>
              </div>

              {/* Award Table */}
              <table className="w-full text-left border-collapse border border-zinc-800 text-xs">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-800 text-[10px] font-bold uppercase">
                    <th className="border border-zinc-800 p-2 w-10 text-center">S.No</th>
                    <th className="border border-zinc-800 p-2">Deterministic Primary Key</th>
                    <th className="border border-zinc-800 p-2">Enrollment No</th>
                    <th className="border border-zinc-800 p-2">Candidate Name</th>
                    <th className="border border-zinc-800 p-2 text-center w-24">Marks (100)</th>
                    <th className="border border-zinc-800 p-2 text-center w-20">Grade</th>
                    <th className="border border-zinc-800 p-2">Evaluator</th>
                    <th className="border border-zinc-800 p-2 text-center w-24">Lock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionCourseEvaluations
                    .filter((r) => !printCourseCode || r.courseCode === printCourseCode)
                    .map((row, idx) => (
                      <tr key={row.id} className="border-b border-zinc-300">
                        <td className="border border-zinc-400 p-2 text-center font-mono">{idx + 1}</td>
                        <td className="border border-zinc-400 p-2 font-mono text-[11px]">{row.submissionKey}</td>
                        <td className="border border-zinc-400 p-2 font-mono font-bold">{row.enrollmentNo}</td>
                        <td className="border border-zinc-400 p-2 font-semibold">{row.studentName}</td>
                        <td className="border border-zinc-400 p-2 text-center font-mono font-bold text-sm">
                          {row.marks !== null ? row.marks : 'AB'}
                        </td>
                        <td className="border border-zinc-400 p-2 text-center font-bold">
                          {row.grade}
                        </td>
                        <td className="border border-zinc-400 p-2 text-[11px]">
                          {row.evaluatorName || 'Pending'}
                        </td>
                        <td className="border border-zinc-400 p-2 text-center text-[10px] font-bold">
                          {row.isLocked ? 'VERIFIED' : 'DRAFT'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {/* Institutional Sign-off Block */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-xs">
                <div className="text-center space-y-8">
                  <div className="h-10"></div>
                  <div className="border-t border-zinc-700 pt-1 font-bold">
                    Signature & Seal of Academic Counsellor
                  </div>
                </div>
                <div className="text-center space-y-8">
                  <div className="h-10 flex items-center justify-center">
                    <span className="font-serif italic font-bold text-indigo-900">
                      Dr. V. K. Aggarwal
                    </span>
                  </div>
                  <div className="border-t border-zinc-700 pt-1 font-bold">
                    Coordinator Signature & Centre Stamp (SC-2033)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
