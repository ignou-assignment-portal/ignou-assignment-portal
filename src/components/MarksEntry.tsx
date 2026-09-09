import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateIGNOUGrade, formatDate, getIgnouGrade } from '../utils/helpers';
import { SCRIPT_URL } from '../services/sheetsService';
import {
  Award,
  BookOpen,
  Check,
  Search,
  Printer,
  FileCheck,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Lock,
  Unlock,
  Stamp,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export const MarksEntry: React.FC = () => {
  const {
    sessionIntakes,
    currentSession,
    updateMarks,
    settings,
    sessionCourseEvaluations,
    toggleLockMarks,
    saveOrUpdateMarksAndLock,
    showToast,
    isAdmin,
  } = useApp();

  // Extract all unique course codes submitted in the current session
  const activeCourseCodes = useMemo(() => {
    const codes = new Set<string>();
    sessionIntakes.forEach((r) => {
      r.courseCodes.forEach((c) => codes.add(c));
    });
    return Array.from(codes).sort();
  }, [sessionIntakes]);

  const [selectedCourse, setSelectedCourse] = useState<string>(() => {
    return activeCourseCodes[0] || '';
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [isAwardListModalOpen, setIsAwardListModalOpen] = useState(false);

  // Update selected course if activeCourseCodes changes and current is empty
  React.useEffect(() => {
    if (!selectedCourse && activeCourseCodes.length > 0) {
      setSelectedCourse(activeCourseCodes[0]);
    }
  }, [activeCourseCodes, selectedCourse]);

  // Students who submitted the selected course in current session
  const enrolledStudents = useMemo(() => {
    if (!selectedCourse) return [];
    return sessionIntakes.filter((r) => r.courseCodes.includes(selectedCourse));
  }, [sessionIntakes, selectedCourse]);

  // Filtered by search query
  const filteredStudents = useMemo(() => {
    if (!searchFilter.trim()) return enrolledStudents;
    const q = searchFilter.toLowerCase().trim();
    return enrolledStudents.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.enrollmentNo.includes(q) ||
        s.tokenNo.toLowerCase().includes(q)
    );
  }, [enrolledStudents, searchFilter]);

  // Analytics for the selected course
  const stats = useMemo(() => {
    const total = enrolledStudents.length;
    let evaluated = 0;
    let totalMarks = 0;
    let passed = 0;

    enrolledStudents.forEach((s) => {
      const mark = s.marks[selectedCourse];
      if (mark !== null && mark !== undefined) {
        evaluated++;
        totalMarks += mark;
        if (mark >= 40) passed++;
      }
    });

    const average = evaluated > 0 ? (totalMarks / evaluated).toFixed(1) : '—';
    const passPercentage = evaluated > 0 ? Math.round((passed / evaluated) * 100) : 0;

    return { total, evaluated, pending: total - evaluated, average, passPercentage };
  }, [enrolledStudents, selectedCourse]);

  // Count of students with marks entered but not yet locked
  const evaluatedNotLockedCount = useMemo(() => {
    return enrolledStudents.filter((s) => {
      const mark = s.marks[selectedCourse];
      const matchingEval = sessionCourseEvaluations.find(
        (e) => e.enrollmentNo === s.enrollmentNo && e.courseCode === selectedCourse
      );
      return mark !== null && mark !== undefined && !matchingEval?.isLocked;
    }).length;
  }, [enrolledStudents, sessionCourseEvaluations, selectedCourse]);

  const handleMarkChange = (intakeId: string, valueStr: string) => {
    if (valueStr === '') {
      updateMarks(intakeId, selectedCourse, null);
      return;
    }
    const val = parseInt(valueStr, 10);
    if (isNaN(val) || val < 0 || val > 100) return;
    updateMarks(intakeId, selectedCourse, val);
  };

  const handleSaveAndLock = async (
    student: (typeof enrolledStudents)[0],
    matchingEval: any,
    isLockAction: boolean
  ) => {
    const currentMark = student.marks[selectedCourse];
    if (currentMark === null || currentMark === undefined) {
      if (isLockAction) {
        alert('Cannot lock script: A valid numerical mark (0-100) must be recorded before locking.');
        return;
      }
    }

    const row = matchingEval || {
      Sub_ID: `SUB_${student.enrollmentNo.trim()}_${selectedCourse.trim().toUpperCase()}_${currentSession.replace(/\s+/g, '')}`,
      subId: `SUB_${student.enrollmentNo.trim()}_${selectedCourse.trim().toUpperCase()}_${currentSession.replace(/\s+/g, '')}`,
      Enrollment_No: student.enrollmentNo,
      enrollmentNo: student.enrollmentNo,
      Course_Code: selectedCourse,
      courseCode: selectedCourse,
      tokenNo: student.tokenNo,
      studentName: student.studentName,
      programmeCode: student.programmeCode,
      session: currentSession,
      isLocked: isLockAction,
      intakeId: student.id,
    };

    await saveOrUpdateMarksAndLock(row, currentMark, isLockAction);
  };

  const handleUnlockMarks = async (
    student: (typeof enrolledStudents)[0],
    matchingEval: any
  ) => {
    if (!isAdmin) {
      alert('Permission Denied: Only an Administrator (Coordinator) can unlock marks for verified scripts.');
      return;
    }
    const row = matchingEval || {
      Sub_ID: `SUB_${student.enrollmentNo.trim()}_${selectedCourse.trim().toUpperCase()}_${currentSession.replace(/\s+/g, '')}`,
      subId: `SUB_${student.enrollmentNo.trim()}_${selectedCourse.trim().toUpperCase()}_${currentSession.replace(/\s+/g, '')}`,
      Enrollment_No: student.enrollmentNo,
      enrollmentNo: student.enrollmentNo,
      Course_Code: selectedCourse,
      courseCode: selectedCourse,
      tokenNo: student.tokenNo,
      studentName: student.studentName,
      programmeCode: student.programmeCode,
      session: currentSession,
      isLocked: false,
      intakeId: student.id,
    };
    await saveOrUpdateMarksAndLock(row, row.marks ?? student.marks[selectedCourse], false);
  };

  const handleBatchLockAllEvaluated = async () => {
    const toLock = enrolledStudents.filter((s) => {
      const mark = s.marks[selectedCourse];
      const matchingEval = sessionCourseEvaluations.find(
        (e) => e.enrollmentNo === s.enrollmentNo && e.courseCode === selectedCourse
      );
      return mark !== null && mark !== undefined && !matchingEval?.isLocked;
    });

    if (toLock.length === 0) return;
    if (!window.confirm(`Save & Lock marks for ${toLock.length} evaluated student(s) in course ${selectedCourse}?`)) {
      return;
    }

    for (const student of toLock) {
      const matchingEval = sessionCourseEvaluations.find(
        (e) => e.enrollmentNo === student.enrollmentNo && e.courseCode === selectedCourse
      );
      await handleSaveAndLock(student, matchingEval, true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900">
              Continuous Evaluation & Marks Award Entry
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Enter marks (out of 100) from physical evaluator award lists for academic cycle{' '}
            <strong className="text-zinc-800">{currentSession}</strong>. Computes IGNOU 5-point letter grade automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBatchLockAllEvaluated}
            disabled={!selectedCourse || evaluatedNotLockedCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Lock all evaluated marks for this course and sync to Google Sheets"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Save & Lock Evaluated ({evaluatedNotLockedCount})</span>
          </button>

          <button
            onClick={() => setIsAwardListModalOpen(true)}
            disabled={!selectedCourse || enrolledStudents.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Generate Official TE-Award Sheet</span>
          </button>
        </div>
      </div>

      {/* Course Selector Tabs */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
        <div className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-2.5">
          Select Course for Marks Entry ({currentSession})
        </div>

        {activeCourseCodes.length === 0 ? (
          <div className="text-xs text-zinc-400 py-4 text-center">
            No courses submitted yet in {currentSession}.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeCourseCodes.map((code) => {
              const count = sessionIntakes.filter((r) => r.courseCodes.includes(code)).length;
              const isSelected = selectedCourse === code;
              return (
                <button
                  key={code}
                  onClick={() => setSelectedCourse(code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-950 text-white shadow-xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                  }`}
                >
                  <span>{code}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans ${
                      isSelected ? 'bg-indigo-700 text-white' : 'bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedCourse && (
        <>
          {/* Quick Metrics for this course */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                Total Submissions
              </span>
              <span className="text-xl font-black text-zinc-900 mt-1 block">
                {stats.total}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                Evaluated / Pending
              </span>
              <span className="text-xl font-black text-indigo-600 mt-1 block">
                {stats.evaluated}{' '}
                <span className="text-xs font-normal text-zinc-400">/ {stats.pending} left</span>
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                Class Average
              </span>
              <span className="text-xl font-black text-zinc-900 mt-1 block">
                {stats.average}
                <span className="text-xs font-normal text-zinc-400 ml-1">/ 100</span>
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                Pass Percentage (≥40%)
              </span>
              <span className="text-xl font-black text-emerald-700 mt-1 block">
                {stats.passPercentage}%
              </span>
            </div>
          </div>

          {/* Student Marks Table */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 bg-zinc-50">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-indigo-950 px-2 py-0.5 bg-indigo-100 rounded">
                  {selectedCourse}
                </span>
                <span className="text-xs text-zinc-600 font-medium">
                  Enrollment Award Register ({filteredStudents.length} Students)
                </span>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter student or enrollment..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-200">
                  <tr>
                    <th className="py-2.5 px-4 w-12">S.No</th>
                    <th className="py-2.5 px-4">Enrollment Number</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4">Token & Date</th>
                    <th className="py-2.5 px-4 w-36">Marks (0-100)</th>
                    <th className="py-2.5 px-4">IGNOU Grade</th>
                    <th className="py-2.5 px-4">Status & Verification Seal</th>
                    <th className="py-2.5 px-4 text-center w-40">Lock Engine & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400">
                        No students found for this course.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, idx) => {
                      const currentMark = student.marks[selectedCourse];
                      const gradeInfo = calculateIGNOUGrade(currentMark);
                      const matchingEval = sessionCourseEvaluations.find(
                        (e) => e.enrollmentNo === student.enrollmentNo && e.courseCode === selectedCourse
                      );
                      const isLocked = !!matchingEval?.isLocked;

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-zinc-50 transition ${
                            isLocked ? 'bg-purple-50/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono text-zinc-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-zinc-900 text-xs">
                            <div>{student.enrollmentNo}</div>
                            {matchingEval?.submissionKey && (
                              <div className="text-[10px] text-indigo-700 font-mono font-normal mt-0.5">
                                {matchingEval.submissionKey}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-900">
                            {student.studentName}
                          </td>
                          <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                            {student.tokenNo}
                            <div className="text-[10px] text-zinc-400">
                              {formatDate(student.submissionDate)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isLocked ? (
                              <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-900 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-lg w-fit">
                                <Lock className="w-3 h-3 text-purple-700" />
                                <span>{currentMark !== null && currentMark !== undefined ? currentMark : '—'}</span>
                                <span className="text-[10px] text-zinc-400 font-normal">/ 100</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder="0-100"
                                  value={currentMark !== null && currentMark !== undefined ? currentMark : ''}
                                  onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                  onBlur={() => handleSaveAndLock(student, matchingEval, false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveAndLock(student, matchingEval, false);
                                    }
                                  }}
                                  className="w-20 px-2.5 py-1.5 font-mono text-xs font-bold border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                                  title="Press Enter or click away to save marks draft"
                                />
                                <span className="text-[10px] text-zinc-400 font-mono">/100</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${gradeInfo.badgeClass}`}
                            >
                              Grade {gradeInfo.grade}
                              <span className="font-normal text-[10px] opacity-75">
                                ({gradeInfo.label})
                              </span>
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isLocked ? (
                              <div className="bg-purple-100/70 border border-purple-200 px-2.5 py-1 rounded-lg text-[11px] text-purple-900 font-medium space-y-0.5 w-fit">
                                <div className="flex items-center gap-1 font-bold">
                                  <Stamp className="w-3.5 h-3.5 text-purple-700" />
                                  <span>LOCKED / VERIFIED</span>
                                </div>
                                <div className="text-[10px] text-purple-700 font-mono">
                                  {matchingEval?.lockedBy || 'Coordinator'} • {matchingEval?.lockedAt ? formatDate(matchingEval.lockedAt) : 'Cycle Approved'}
                                </div>
                              </div>
                            ) : currentMark !== null && currentMark !== undefined ? (
                              <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Marks Drafted (Unverified)
                              </span>
                            ) : (
                              <span className="text-zinc-400 text-xs italic">Awaiting marks</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isLocked ? (
                              isAdmin ? (
                                <button
                                  onClick={() => handleUnlockMarks(student, matchingEval)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                                  title="Administrator Override: Click to Unlock"
                                >
                                  <Unlock className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Unlock</span>
                                </button>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200 cursor-not-allowed"
                                  title="Locked by Coordinator. Administrative privileges required to unlock."
                                >
                                  <Lock className="w-3 h-3 text-zinc-400" />
                                  <span>Sealed</span>
                                </span>
                              )
                            ) : (
                              <button
                                onClick={() => handleSaveAndLock(student, matchingEval, true)}
                                disabled={currentMark === null || currentMark === undefined}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-2xs ${
                                  currentMark !== null && currentMark !== undefined
                                    ? 'bg-purple-600 hover:bg-purple-700 text-white border border-purple-700 active:scale-95'
                                    : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed opacity-60'
                                }`}
                                title={
                                  currentMark !== null
                                    ? 'Save & Lock Marks (Dispatches UPDATE_MARKS to Google Sheets)'
                                    : 'Enter marks (0-100) before locking'
                                }
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Save & Lock Marks</span>
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
        </>
      )}

      {/* Official IGNOU TE-Award Sheet Printable Layout Modal */}
      {isAwardListModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto print:m-0 print:border-none print:shadow-none print:w-full">
            {/* Modal Controls */}
            <div className="px-5 py-3 bg-zinc-900 text-white flex items-center justify-between print:hidden">
              <div className="font-semibold text-xs flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>IGNOU TE-Award Sheet Preview ({selectedCourse})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Award Sheet
                </button>
                <button
                  onClick={() => setIsAwardListModalOpen(false)}
                  className="px-2 py-1 text-zinc-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Award Sheet Body */}
            <div className="p-8 text-zinc-900 bg-white">
              {/* Sheet Header */}
              <div className="text-center border-b-2 border-zinc-900 pb-3">
                <div className="text-xs uppercase font-black tracking-widest text-zinc-800">
                  Indira Gandhi National Open University (IGNOU)
                </div>
                <div className="text-sm font-black text-zinc-900 uppercase mt-0.5">
                  Term-End Assignment Award List (TE-Format)
                </div>
                <div className="text-xs text-zinc-600 font-medium">
                  Study Centre: {settings.centreCode} ({settings.institutionName}) • Regional Centre: {settings.regionalCentreCode}
                </div>
              </div>

              {/* Course & Session Info Bar */}
              <div className="grid grid-cols-4 gap-2 my-4 text-xs border border-zinc-300 p-2.5 rounded bg-zinc-50">
                <div>
                  <span className="text-zinc-500 font-bold block text-[10px] uppercase">Course Code:</span>
                  <span className="font-mono font-black text-sm text-zinc-900">{selectedCourse}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-bold block text-[10px] uppercase">Exam / Session:</span>
                  <span className="font-bold text-zinc-900">{currentSession}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-bold block text-[10px] uppercase">Max Marks:</span>
                  <span className="font-bold text-zinc-900">100 (Pass Marks: 40)</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-bold block text-[10px] uppercase">Total Candidates:</span>
                  <span className="font-bold text-zinc-900">{enrolledStudents.length}</span>
                </div>
              </div>

              {/* Award Table */}
              <table className="w-full text-xs border border-zinc-400 text-left">
                <thead className="bg-zinc-100 font-bold border-b border-zinc-400">
                  <tr>
                    <th className="py-2 px-2 border-r border-zinc-300 w-10 text-center">S.N.</th>
                    <th className="py-2 px-3 border-r border-zinc-300">Enrollment Number</th>
                    <th className="py-2 px-3 border-r border-zinc-300">Student Name</th>
                    <th className="py-2 px-3 border-r border-zinc-300 text-center">Marks (In Figures)</th>
                    <th className="py-2 px-3 border-r border-zinc-300">Grade</th>
                    <th className="py-2 px-3 text-center">Signature of Evaluator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-300">
                  {enrolledStudents.map((student, i) => {
                    const mark = student.marks[selectedCourse];
                    const grade = calculateIGNOUGrade(mark);
                    return (
                      <tr key={student.id}>
                        <td className="py-2 px-2 border-r border-zinc-300 text-center font-mono">{i + 1}</td>
                        <td className="py-2 px-3 border-r border-zinc-300 font-mono font-bold">{student.enrollmentNo}</td>
                        <td className="py-2 px-3 border-r border-zinc-300 font-medium">{student.studentName}</td>
                        <td className="py-2 px-3 border-r border-zinc-300 text-center font-mono font-bold text-sm">
                          {mark !== null && mark !== undefined ? mark : 'AB'}
                        </td>
                        <td className="py-2 px-3 border-r border-zinc-300 font-bold">
                          {grade.grade}
                        </td>
                        <td className="py-2 px-3 border-zinc-300"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Evaluator Certification Footer */}
              <div className="mt-8 pt-4 border-t border-zinc-300 grid grid-cols-2 gap-8 text-xs">
                <div>
                  <div className="font-bold text-zinc-800">Evaluator Certification:</div>
                  <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                    Certified that all the assignment scripts received under this course have been evaluated by me strictly according to IGNOU criteria. No marks have been erased or altered without signature.
                  </p>
                  <div className="mt-6">
                    <div className="w-48 border-b border-zinc-800 mb-1"></div>
                    <span className="font-bold">Signature of Approved Evaluator</span>
                  </div>
                </div>

                <div className="text-right flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-zinc-800">Study Centre Verification:</div>
                    <div className="text-[10px] text-zinc-500 mt-1">Verified and checked against counter receipts.</div>
                  </div>
                  <div className="mt-6">
                    <div className="w-48 border-b border-zinc-800 mb-1 ml-auto"></div>
                    <span className="font-bold">Coordinator / PIC (SC-2033)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 px-6 py-3 border-t border-zinc-200 text-right print:hidden">
              <button
                onClick={() => setIsAwardListModalOpen(false)}
                className="px-4 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-lg text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
