import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { IGNOU_PROGRAMMES } from '../data/ignouMasterData';
import { SubmissionMode } from '../types';
import { formatDate, formatDateTime } from '../utils/helpers';
import { IntakeStatusMatrix } from './IntakeStatusMatrix';
import {
  UserPlus,
  BookOpen,
  CheckCircle,
  Hash,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle,
  Plus,
  X,
  Search,
  Receipt,
  ShieldCheck,
  FileCheck,
  Eye,
  CheckCircle2,
  Phone,
  BarChart3,
  ChevronDown,
  Edit3,
  Check,
  TableProperties,
  Trash2,
  Pencil,
} from 'lucide-react';
import { IntakeRegister } from './IntakeRegister';
import { EditIntakeModal } from './EditIntakeModal';

export const IntakeDesk: React.FC = () => {
  const {
    currentSession,
    setSession,
    availableSessions,
    addIntakeRecord,
    deleteIntakeRecord,
    sessionIntakes,
    allIntakes,
    allCourseEvaluations,
    openReceiptModal,
    currentRole,
    isAdmin,
    verifyAndSetAdminRole,
    settings,
    addRegistrationReceipt,
    openRegistrationReceiptModal,
    recordStudentAssignmentSubmissions,
    sessionRegistrationReceipts,
  } = useApp();

  // Form states
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedSession, setSelectedSession] = useState(currentSession);
  const [courseSearchInput, setCourseSearchInput] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [submissionDate, setSubmissionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>('In-Person (Desk)');
  const [consignmentNo, setConsignmentNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [justSubmittedToken, setJustSubmittedToken] = useState<string | null>(null);

  // Programme Combobox & Custom Override states
  const [progSearchQuery, setProgSearchQuery] = useState('');
  const [isProgDropdownOpen, setIsProgDropdownOpen] = useState(false);
  const [isCustomProgMode, setIsCustomProgMode] = useState(false);
  const [customProgInput, setCustomProgInput] = useState('');
  const progDropdownRef = useRef<HTMLDivElement>(null);

  // Sub-view toggle for Desk Official
  const [deskView, setDeskView] = useState<'REGISTER' | 'SUBMISSIONS_REGISTER' | 'RECEIPTS'>('REGISTER');
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const handleEditClick = (record: any) => {
    setEditingRecord(record);
  };

  const handleDeleteClick = (record: any) => {
    // 4. Access Guard: Require Coordinator Mode (PIN 2033) for Delete actions
    if (!isAdmin) {
      const enteredPin = window.prompt('Coordinator PIN Required: Enter PIN 2033 to authorize deletion of intake records:');
      if (!enteredPin) return;
      if (enteredPin.trim() === '2033') {
        const authorized = verifyAndSetAdminRole('2033');
        if (!authorized) {
          alert('Coordinator PIN verification failed.');
          return;
        }
      } else {
        alert('Unauthorized: Incorrect Coordinator PIN.');
        return;
      }
    }

    // 3. Check if any course for this student in courseLedger has status === "Locked" or isLocked
    const activeSession = record.session || currentSession;
    const isAnyCourseLocked = allCourseEvaluations.some(
      (ce) =>
        (ce.intakeId === record.id || ce.enrollmentNo.trim() === record.enrollmentNo.trim()) &&
        ce.session.trim().toLowerCase() === activeSession.trim().toLowerCase() &&
        (ce.isLocked || ce.status === 'Locked' || ce.status === 'Marks Locked')
    );

    if (isAnyCourseLocked) {
      alert('Cannot delete intake. Marks have already been locked for one or more courses.');
      return;
    }

    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete intake receipt for ${record.studentName} (${record.enrollmentNo})? This will also remove unpacked pending scripts from Course Ledger.`
    );

    if (confirmed) {
      deleteIntakeRecord(record.id);
    }
  };

  // Keep selectedSession in sync if currentSession changes
  useEffect(() => {
    setSelectedSession(currentSession);
  }, [currentSession]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (progDropdownRef.current && !progDropdownRef.current.contains(e.target as Node)) {
        setIsProgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Standard IGNOU Programmes from Master Data (19 deduplicated standard programmes)
  const standardProgrammes = useMemo(() => {
    return IGNOU_PROGRAMMES;
  }, []);

  // Filtered programmes for the combobox
  const filteredProgrammes = useMemo(() => {
    const q = progSearchQuery.trim().toUpperCase();
    if (!q) return standardProgrammes;
    return standardProgrammes.filter(
      (p) => p.code.toUpperCase().includes(q) || p.name.toUpperCase().includes(q)
    );
  }, [progSearchQuery, standardProgrammes]);

  // Selected programme info from master data (if standard)
  const programmeData = useMemo(() => {
    return standardProgrammes.find((p) => p.code === selectedProgramme);
  }, [selectedProgramme, standardProgrammes]);

  // Autocomplete course suggestions: all courses matching courseSearchInput
  const courseAutocompleteList = useMemo(() => {
    if (!courseSearchInput.trim()) return [];
    const query = courseSearchInput.trim().toUpperCase();
    const matches: { code: string; title: string; programme: string }[] = [];

    // Search across all master courses
    IGNOU_PROGRAMMES.forEach((p) => {
      p.courses.forEach((c) => {
        if (
          (c.code.toUpperCase().includes(query) || c.title.toUpperCase().includes(query)) &&
          !selectedCourses.includes(c.code)
        ) {
          matches.push({ code: c.code, title: c.title, programme: p.code });
        }
      });
    });

    return matches.slice(0, 8);
  }, [courseSearchInput, selectedCourses]);

  const handleSelectStandardProgramme = (progCode: string) => {
    setSelectedProgramme(progCode);
    setIsCustomProgMode(false);
    setCustomProgInput('');
    setProgSearchQuery('');
    setIsProgDropdownOpen(false);
    setErrorMsg('');
  };

  const handleApplyCustomProgramme = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setSelectedProgramme(clean);
    setIsCustomProgMode(true);
    setCustomProgInput(clean);
    setProgSearchQuery('');
    setIsProgDropdownOpen(false);
    setErrorMsg('');
  };

  // Course addition with strict max 8 limit and duplicate check
  const handleAddCourse = (courseCode: string) => {
    if (!courseCode.trim()) return;
    const splitCourses = courseCode
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (splitCourses.length === 0) return;

    if (selectedCourses.length + splitCourses.length > 8) {
      setErrorMsg('Maximum 8 course codes allowed per registration cycle in IGNOU academic term.');
      return;
    }

    const cleanEnrollment = enrollmentNo.trim();
    const targetSession = selectedSession || currentSession;

    const newCoursesToAdd: string[] = [];

    for (const clean of splitCourses) {
      // Check if this student has already submitted this course code in this session
      if (cleanEnrollment) {
        const isDuplicate =
          allCourseEvaluations.some(
            (ce) =>
              ce.enrollmentNo.trim() === cleanEnrollment &&
              ce.session.trim().toLowerCase() === targetSession.trim().toLowerCase() &&
              ce.courseCode.trim().toUpperCase() === clean
          ) ||
          allIntakes.some(
            (it) =>
              it.enrollmentNo.trim() === cleanEnrollment &&
              it.session.trim().toLowerCase() === targetSession.trim().toLowerCase() &&
              it.courseCodes.some((c) => c.trim().toUpperCase() === clean)
          );

        if (isDuplicate) {
          const msg = `Duplicate Submission Blocked: Student ${cleanEnrollment} has already submitted course ${clean} for session "${targetSession}". Each course may only be submitted once per academic cycle.`;
          alert(msg);
          setErrorMsg(msg);
          return;
        }
      }

      if (!selectedCourses.includes(clean) && !newCoursesToAdd.includes(clean)) {
        newCoursesToAdd.push(clean);
      }
    }

    if (newCoursesToAdd.length > 0) {
      setSelectedCourses([...selectedCourses, ...newCoursesToAdd]);
      setErrorMsg('');
    }
    setCourseSearchInput('');
  };

  const handleRemoveCourse = (courseCode: string) => {
    setSelectedCourses(selectedCourses.filter((c) => c !== courseCode));
    setErrorMsg('');
  };

  // Primary action: "Submit & Generate Receipt" (Strictly Non-Financial)
  const handleSubmitAndGenerateReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validation
    const cleanEnrollment = enrollmentNo.trim();
    if (!cleanEnrollment) {
      setErrorMsg('Student Enrollment Number is required.');
      return;
    }
    if (!/^\d{9,10}$/.test(cleanEnrollment)) {
      setErrorMsg('IGNOU Enrollment Number must be 9 or 10 numeric digits.');
      return;
    }
    if (!studentName.trim()) {
      setErrorMsg('Candidate Name is required.');
      return;
    }
    if (!studentPhone.trim()) {
      setErrorMsg('Contact Number is required for SMS acknowledgment.');
      return;
    }
    if (!selectedProgramme.trim()) {
      setErrorMsg('Please select or specify a Programme Code (e.g. BAG, MEG, BCA, MPS).');
      return;
    }
    // Merge any un-added input in courseSearchInput
    let combinedCourses = [...selectedCourses];
    if (courseSearchInput.trim()) {
      const extra = courseSearchInput
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      extra.forEach((c) => {
        if (!combinedCourses.includes(c)) combinedCourses.push(c);
      });
    }

    const coursesArray = combinedCourses
      .flatMap((c) => c.split(','))
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (coursesArray.length === 0) {
      setErrorMsg('Please enter or select at least one Course Code (up to 8 courses).');
      return;
    }
    if (coursesArray.length > 8) {
      setErrorMsg('Maximum 8 course codes allowed per registration cycle.');
      return;
    }
    if (submissionMode !== 'In-Person (Desk)' && !consignmentNo.trim()) {
      setErrorMsg('Tracking / Consignment number is required for postal or courier submission.');
      return;
    }

    const targetSession = selectedSession || currentSession;

    // Composite Duplicate Check:
    // If the SAME student submits the EXACT SAME course code already recorded for this session:
    // BLOCK submission and trigger an alert.
    // Allow different course codes for the same student in the same session.
    const cleanCourses = coursesArray;
    const existingDuplicates: string[] = [];

    cleanCourses.forEach((course) => {
      const alreadySubmitted =
        allCourseEvaluations.some(
          (ce) =>
            ce.enrollmentNo.trim() === cleanEnrollment &&
            ce.session.trim().toLowerCase() === targetSession.trim().toLowerCase() &&
            ce.courseCode.trim().toUpperCase() === course
        ) ||
        allIntakes.some(
          (it) =>
            it.enrollmentNo.trim() === cleanEnrollment &&
            it.session.trim().toLowerCase() === targetSession.trim().toLowerCase() &&
            it.courseCodes.some((cc) => cc.trim().toUpperCase() === course)
        );

      if (alreadySubmitted && !existingDuplicates.includes(course)) {
        existingDuplicates.push(course);
      }
    });

    if (existingDuplicates.length > 0) {
      const alertMessage = `Duplicate Submission Blocked: Student ${cleanEnrollment} (${studentName.trim()}) has already submitted assignment script(s) for course ${existingDuplicates.join(', ')} in session "${targetSession}". Each course assignment may only be submitted once per academic session.`;
      alert(alertMessage);
      setErrorMsg(alertMessage);
      return;
    }

    try {
      const registeredBy = currentRole === 'ADMIN' ? 'Coordinator Desk' : 'Desk Official - Counter 1';

      // Ensure global session matches selected session if user switched it
      if (targetSession !== currentSession) {
        setSession(targetSession);
      }

      // 1. Create intake record in IntakeMaster and optimistically unpack to Course_Ledger
      const newRecord = addIntakeRecord({
        enrollmentNo: cleanEnrollment,
        studentName: studentName.trim(),
        studentPhone: studentPhone.trim() || undefined,
        studentEmail: studentEmail.trim() || undefined,
        programmeCode: selectedProgramme.trim().toUpperCase(),
        courseCodes: coursesArray,
        submissionDate,
        submissionMode,
        consignmentNo: consignmentNo.trim() || undefined,
        remarks: remarks.trim() || undefined,
        status: 'Received',
        registeredBy,
      });

      // 2. Link each registered course in mock table AssignmentSubmissions
      recordStudentAssignmentSubmissions({
        studentId: cleanEnrollment,
        studentName: studentName.trim(),
        programmeCode: selectedProgramme.trim().toUpperCase(),
        courseCodes: coursesArray,
        session: targetSession,
        initialStatus: 'submitted',
        submissionDate,
        submissionMode,
        consignmentNo: consignmentNo.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      // 3. Store official receipt record in mock table RegistrationReceipts (Non-Financial)
      addRegistrationReceipt({
        studentId: cleanEnrollment,
        studentName: studentName.trim(),
        studentPhone: studentPhone.trim() || undefined,
        studentEmail: studentEmail.trim() || undefined,
        programmeCode: selectedProgramme.trim().toUpperCase(),
        session: targetSession,
        registeredCourses: coursesArray,
        issuedBy: registeredBy,
        remarks: remarks.trim() || undefined,
      });

      setJustSubmittedToken(newRecord.tokenNo);
      setSuccessMsg(`Successfully registered candidate ${studentName.trim()} (${cleanEnrollment}) with Token: ${newRecord.tokenNo}.`);

      // 4. Instantly launch the printable official acknowledgment receipt modal!
      openReceiptModal(newRecord);

      // Reset form fields
      setEnrollmentNo('');
      setStudentName('');
      setStudentPhone('');
      setStudentEmail('');
      setSelectedCourses([]);
      setConsignmentNo('');
      setRemarks('');
      setCourseSearchInput('');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to complete registration and store receipt. Please try again.');
    }
  };

  const handleIntakeSubmit = handleSubmitAndGenerateReceipt;

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-indigo-950 via-zinc-900 to-indigo-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-400 text-zinc-950 uppercase">
              Module A: Student Intake & Status Dashboard
            </span>
            <span className="text-xs text-indigo-200">
              Active Cycle: <strong className="text-white">{currentSession}</strong>
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black mt-1 tracking-tight">
            IGNOU Study Centre SC-2033 Assignment Operations
          </h2>
          <p className="text-xs text-zinc-300 mt-0.5 max-w-2xl">
            Dynamic Multi-Course Registration Desk, instant printable statutory acknowledgment receipt, and comprehensive real-time status matrix.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-xs border border-white/15 flex items-center gap-4">
          <div className="text-right">
            <div className="text-zinc-300 text-[10px] uppercase font-bold">Candidates This Cycle</div>
            <div className="text-xl font-black text-white">
              {new Set(sessionIntakes.map((r) => r.enrollmentNo)).size}
            </div>
          </div>
          <div className="w-px h-8 bg-white/20"></div>
          <div className="text-right">
            <div className="text-zinc-300 text-[10px] uppercase font-bold">Total Scripts</div>
            <div className="text-xl font-black text-amber-300">
              {sessionIntakes.reduce((sum, r) => sum + r.courseCodes.length, 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Desk Official Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-zinc-200/80 rounded-xl max-w-fit text-xs font-semibold">
        <button
          id="desk-view-register-tab"
          type="button"
          onClick={() => setDeskView('REGISTER')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
            deskView === 'REGISTER'
              ? 'bg-white text-zinc-950 shadow-xs font-bold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
          <span>Registration Desk & Status Matrix</span>
        </button>

        <button
          id="desk-view-submissions-tab"
          type="button"
          onClick={() => setDeskView('SUBMISSIONS_REGISTER')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
            deskView === 'SUBMISSIONS_REGISTER'
              ? 'bg-white text-zinc-950 shadow-xs font-bold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <TableProperties className="w-3.5 h-3.5 text-indigo-600" />
          <span>Submissions Register</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
            {sessionIntakes.length}
          </span>
        </button>

        <button
          id="desk-view-receipts-tab"
          type="button"
          onClick={() => setDeskView('RECEIPTS')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
            deskView === 'RECEIPTS'
              ? 'bg-white text-zinc-950 shadow-xs font-bold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-teal-600" />
          <span>Registration Receipts Register</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-800 font-bold">
            {sessionRegistrationReceipts.length}
          </span>
        </button>
      </div>

      {deskView === 'REGISTER' && (
        <div className="space-y-6">
          {/* Intake Registration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Dynamic Multi-Course Registration Desk (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm sm:text-base">
                      Dynamic Multi-Course Registration Desk
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Enter student details, select up to 8 courses, and issue instant acknowledgment receipt.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">Session</span>
                  <span className="text-xs font-bold text-indigo-950">{selectedSession}</span>
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmitAndGenerateReceipt} className="space-y-4">
                {/* 1. Student Enrollment Number (9-10 digits) & Candidate Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Student Enrollment Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        id="enrollment-input"
                        maxLength={10}
                        placeholder="e.g. 2350198421 (9 or 10 digits)"
                        value={enrollmentNo}
                        onChange={(e) => setEnrollmentNo(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold tracking-wider border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        required
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">
                      {enrollmentNo.length}/10 digits (Numbers only)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Candidate Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="student-name-input"
                      placeholder="Candidate name as registered in IGNOU"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                  </div>
                </div>

                {/* 2. Contact Number, Session & Submission Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Contact Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Academic Session <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                      <select
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs font-bold border border-zinc-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      >
                        {availableSessions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Submission Mode <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={submissionMode}
                      onChange={(e) => setSubmissionMode(e.target.value as SubmissionMode)}
                      className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      <option value="In-Person (Desk)">In-Person (Physical Counter)</option>
                      <option value="Speed Post">Speed Post (India Post)</option>
                      <option value="Registered Post">Registered Post (Inward)</option>
                      <option value="Courier">Courier / Dispatch</option>
                    </select>
                  </div>
                </div>

                {submissionMode !== 'In-Person (Desk)' && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg animate-in fade-in">
                    <label className="block text-xs font-semibold text-amber-900 mb-1">
                      Postal Tracking / Consignment No. <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ED948123049IN or RP203948102IN"
                      value={consignmentNo}
                      onChange={(e) => setConsignmentNo(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 text-xs font-mono border border-amber-300 rounded-md bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      required
                    />
                  </div>
                )}

                {/* 3. Programme Master & Flexible Entry (Combobox + Manual Override) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-700">
                      Programme Enrolled <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomProgMode(!isCustomProgMode);
                          if (!isCustomProgMode) {
                            setCustomProgInput(selectedProgramme);
                          }
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isCustomProgMode ? 'Back to Standard Catalog' : 'Custom / Other Programme'}</span>
                      </button>
                    </div>
                  </div>

                  {/* If Manual Custom Programme Mode */}
                  {isCustomProgMode ? (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-900">
                          Manual Programme Override (Any Unlisted IGNOU Code)
                        </span>
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-medium">
                          Custom Entry Active
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type programme code (e.g. BCA, MCA, DTS, BLIS, PGDRD)"
                          value={customProgInput}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            setCustomProgInput(val);
                            setSelectedProgramme(val);
                          }}
                          className="flex-1 px-3 py-2 text-xs font-mono font-bold border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customProgInput.trim()) {
                              handleApplyCustomProgramme(customProgInput);
                            }
                          }}
                          className="px-3 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-lg cursor-pointer"
                        >
                          Set Code
                        </button>
                      </div>
                      <p className="text-[10px] text-amber-800">
                        Desk operators can enter any unlisted programme without validation restriction.
                      </p>
                    </div>
                  ) : (
                    /* Searchable Combobox for Standard Programmes */
                    <div className="relative" ref={progDropdownRef}>
                      <div
                        onClick={() => setIsProgDropdownOpen(!isProgDropdownOpen)}
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg bg-white flex items-center justify-between cursor-pointer hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {selectedProgramme ? (
                            <span className="font-mono font-bold text-indigo-950">
                              {selectedProgramme}
                              {programmeData && (
                                <span className="text-zinc-600 font-sans font-normal ml-2 text-xs">
                                  — {programmeData.name}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-400">Search or select from 19 standard IGNOU programmes...</span>
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isProgDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>

                      {/* Dropdown Menu */}
                      {isProgDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl z-30 overflow-hidden">
                          <div className="p-2 border-b border-zinc-100 bg-zinc-50">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Type to filter programmes (e.g. BAG, MEG, History...)"
                                value={progSearchQuery}
                                onChange={(e) => setProgSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="max-h-52 overflow-y-auto divide-y divide-zinc-100">
                            {filteredProgrammes.length === 0 ? (
                              <div className="p-3 text-center text-xs text-zinc-500">
                                <div>No standard programme matches "{progSearchQuery}".</div>
                                <button
                                  type="button"
                                  onClick={() => handleApplyCustomProgramme(progSearchQuery)}
                                  className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Use "{progSearchQuery.toUpperCase()}" as Custom Programme</span>
                                </button>
                              </div>
                            ) : (
                              filteredProgrammes.map((prog) => (
                                <button
                                  type="button"
                                  key={prog.code}
                                  onClick={() => handleSelectStandardProgramme(prog.code)}
                                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-indigo-50 transition cursor-pointer ${
                                    selectedProgramme === prog.code ? 'bg-indigo-50/80 font-bold' : ''
                                  }`}
                                >
                                  <div>
                                    <span className="font-mono font-black text-indigo-950 mr-2">
                                      {prog.code}
                                    </span>
                                    <span className="text-zinc-700 text-[11px]">{prog.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded font-medium">
                                      {prog.level}
                                    </span>
                                    {selectedProgramme === prog.code && (
                                      <Check className="w-3.5 h-3.5 text-indigo-600" />
                                    )}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>

                          <div className="p-2 bg-zinc-50 border-t border-zinc-100 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setIsProgDropdownOpen(false);
                                setIsCustomProgMode(true);
                              }}
                              className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Programme not in list? Enter Custom / Other Programme</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fast 1-Click Quick Select Pills for Standard Programmes */}
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase font-semibold mb-1 flex items-center justify-between">
                      <span>Standard IGNOU Catalog (19 Programmes):</span>
                      {selectedProgramme && (
                        <span className="text-indigo-700 font-bold">
                          Selected: {selectedProgramme} {isCustomProgMode ? '(Custom Override)' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {standardProgrammes.map((prog) => (
                        <button
                          type="button"
                          key={prog.code}
                          onClick={() => handleSelectStandardProgramme(prog.code)}
                          className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-md transition cursor-pointer ${
                            selectedProgramme === prog.code && !isCustomProgMode
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
                          }`}
                        >
                          {prog.code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Programme Confirmation Ribbon */}
                  {selectedProgramme && (
                    <div className="text-[11px] text-indigo-950 bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-200 flex items-center justify-between">
                      <span>
                        Active Programme: <strong className="font-mono">{selectedProgramme}</strong>
                        {programmeData ? ` — ${programmeData.name} (${programmeData.level})` : ' — Custom Study Centre Override'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProgramme('');
                          setIsCustomProgMode(false);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold cursor-pointer ml-2"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Course Selection: Up to 8 course codes with dynamic chips & auto-suggestions */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-700">
                      Course Selection (Up to 8 Course Codes) <span className="text-rose-500">*</span>
                    </label>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        selectedCourses.length >= 8
                          ? 'bg-rose-100 text-rose-800'
                          : selectedCourses.length > 0
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {selectedCourses.length} / 8 courses selected
                    </span>
                  </div>

                  {/* Suggestions from currently selected standard programme */}
                  {programmeData && programmeData.courses && (
                    <div className="mb-2 p-2 bg-zinc-50 border border-zinc-200 rounded-lg">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                        Curriculum Courses for {programmeData.code} (Click to add):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {programmeData.courses.map((c) => {
                          const isAlreadySelected = selectedCourses.includes(c.code);
                          return (
                            <button
                              type="button"
                              key={c.code}
                              disabled={isAlreadySelected || selectedCourses.length >= 8}
                              onClick={() => handleAddCourse(c.code)}
                              className={`px-2 py-0.5 text-[11px] font-mono rounded font-bold transition cursor-pointer flex items-center gap-1 ${
                                isAlreadySelected
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-60 cursor-not-allowed'
                                  : 'bg-white hover:bg-indigo-50 text-indigo-900 border border-zinc-300 hover:border-indigo-400'
                              }`}
                              title={c.title}
                            >
                              <span>{c.code}</span>
                              {isAlreadySelected ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Search / Manual Add Input */}
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder={
                            selectedCourses.length >= 8
                              ? 'Maximum 8 courses reached'
                              : 'Type course code (e.g. BEGC-101, MCS-011) and press Enter or Add'
                          }
                          disabled={selectedCourses.length >= 8}
                          value={courseSearchInput}
                          onChange={(e) => setCourseSearchInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (courseSearchInput.trim()) {
                                handleAddCourse(courseSearchInput.trim());
                              }
                            }
                          }}
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:bg-zinc-100 disabled:cursor-not-allowed"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={selectedCourses.length >= 8 || !courseSearchInput.trim()}
                        onClick={() => {
                          if (courseSearchInput.trim()) {
                            handleAddCourse(courseSearchInput.trim());
                          }
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-900 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {/* Autocomplete Dropdown List */}
                    {courseAutocompleteList.length > 0 && selectedCourses.length < 8 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-zinc-100">
                        {courseAutocompleteList.map((match) => (
                          <button
                            type="button"
                            key={match.code}
                            onClick={() => handleAddCourse(match.code)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center justify-between group transition cursor-pointer"
                          >
                            <div>
                              <span className="font-mono font-bold text-indigo-900 group-hover:text-indigo-700 mr-2">
                                {match.code}
                              </span>
                              <span className="text-zinc-600 text-[11px]">{match.title}</span>
                            </div>
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-semibold">
                              {match.programme}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Courses Chips Display */}
                  <div className="mt-2.5">
                    {selectedCourses.length === 0 ? (
                      <div className="text-xs text-zinc-400 italic p-2.5 border border-dashed border-zinc-200 rounded-lg text-center">
                        No course codes added yet. Click above suggestions or search/type to add (up to 8).
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 p-2.5 bg-indigo-50/40 border border-indigo-200 rounded-lg">
                        {selectedCourses.map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1.5 bg-indigo-900 text-white text-xs font-mono font-bold px-2.5 py-1 rounded-md shadow-xs"
                          >
                            {code}
                            <button
                              type="button"
                              onClick={() => handleRemoveCourse(code)}
                              className="hover:text-rose-300 transition cursor-pointer"
                              title="Remove Course"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Optional Contact & Remarks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Student Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="student@ignou.ac.in"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Desk Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Identity verified, physical script verified"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Form Actions: "Submit & Generate Receipt" (Non-Financial) */}
                <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-zinc-500">
                    Session: <strong className="text-zinc-800">{selectedSession}</strong> • Non-Financial Counter Intake (SC-2033)
                  </div>

                  <button
                    type="submit"
                    id="submit-and-generate-receipt-btn"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Submit & Generate Receipt</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Counter Live Activity for Current Session (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-bold text-zinc-900 text-sm">
                      Recent Receipts ({currentSession})
                    </h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-semibold">
                    {sessionIntakes.length} Intake Records
                  </span>
                </div>

                <p className="text-xs text-zinc-500 mt-2 mb-3">
                  Click any student record to preview or re-print the official acknowledgment receipt slip.
                </p>

                <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                  {sessionIntakes.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 text-xs">
                      No submissions recorded yet for {currentSession}.
                      <br />
                      Use the registration form on the left to register a student.
                    </div>
                  ) : (
                    sessionIntakes.map((record) => (
                      <div
                        key={record.id}
                        className="p-3 bg-zinc-50 hover:bg-indigo-50/40 border border-zinc-200 hover:border-indigo-300 rounded-xl transition group text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-mono font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                              {record.tokenNo}
                              {record.tokenNo === justSubmittedToken && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-sans font-bold">
                                  JUST GENERATED
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-zinc-800 mt-0.5">
                              {record.studentName}
                              <span className="text-zinc-500 font-normal ml-1">
                                ({record.enrollmentNo})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Edit Intake Receipt */}
                            <button
                              id={`recent-edit-btn-${record.id}`}
                              onClick={() => handleEditClick(record)}
                              className="p-1.5 text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50 border border-zinc-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="Edit Intake Receipt"
                            >
                              <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                            </button>

                            {/* Delete Intake Record */}
                            <button
                              id={`recent-delete-btn-${record.id}`}
                              onClick={() => handleDeleteClick(record)}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border border-zinc-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="Delete Intake Record (Coordinator PIN 2033 Required)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Print Receipt */}
                            <button
                              id={`recent-receipt-btn-${record.id}`}
                              onClick={() => openReceiptModal(record)}
                              className="px-2 py-1 bg-white hover:bg-indigo-600 hover:text-white border border-zinc-300 text-zinc-700 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
                              title="Print Official Acknowledgment Receipt"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Receipt</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-800">
                            {record.programmeCode}
                          </span>
                          {record.courseCodes.map((c) => (
                            <span
                              key={c}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-zinc-700 border border-zinc-200"
                            >
                              {c}
                            </span>
                          ))}
                        </div>

                        <div className="mt-2 pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[10px] text-zinc-500">
                          <span>{record.submissionMode} • {formatDate(record.submissionDate)}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded font-medium ${
                              record.status === 'Evaluated'
                                ? 'bg-emerald-100 text-emerald-800'
                                : record.status === 'Under Evaluation'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {record.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Module A Requirement 3: Assignment Status Analytics & Intake Matrix */}
          <div className="pt-2">
            <IntakeStatusMatrix />
          </div>
        </div>
      )}

      {/* View 2: Submissions Register (Stage 1 Master Table with Edit and Delete Actions) */}
      {deskView === 'SUBMISSIONS_REGISTER' && (
        <IntakeRegister />
      )}

      {/* View 3: Registration Receipts Register (Completely Non-Financial) */}
      {deskView === 'RECEIPTS' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-zinc-900 text-base">
                  Registration Receipts Ledger (Study Centre Acknowledgment Register)
                </h3>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Official statutory intake receipts generated for registered students in <strong className="text-zinc-800">{currentSession}</strong>.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-900 self-start sm:self-auto">
              Total Receipts: {sessionRegistrationReceipts.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-bold border-b border-zinc-200">
                <tr>
                  <th className="py-3 px-4">Receipt Number</th>
                  <th className="py-3 px-4">Candidate Details</th>
                  <th className="py-3 px-4">Programme</th>
                  <th className="py-3 px-4">Registered Courses</th>
                  <th className="py-3 px-4">Submission Mode</th>
                  <th className="py-3 px-4">Issuing Official</th>
                  <th className="py-3 px-4 text-right">Official Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {sessionRegistrationReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-400">
                      No registration receipts issued yet in cycle {currentSession}.
                    </td>
                  </tr>
                ) : (
                  sessionRegistrationReceipts.map((rcpt) => (
                    <tr key={rcpt.id} className="hover:bg-zinc-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-950">
                        {rcpt.receiptNumber}
                        <div className="text-[10px] text-zinc-400 font-sans font-normal">
                          {formatDateTime(rcpt.issuedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900">{rcpt.studentName}</div>
                        <div className="text-zinc-500 font-mono text-[11px]">ID: {rcpt.studentId}</div>
                        {rcpt.studentPhone && (
                          <div className="text-zinc-400 text-[10px]">Ph: {rcpt.studentPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-zinc-700">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-900 font-mono">
                          {rcpt.programmeCode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {rcpt.registeredCourses.map((c) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-900 font-mono text-[10px] font-bold border border-indigo-200"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-700 font-medium">
                        <div className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-800">
                          In-Person / Verified
                        </div>
                        {rcpt.remarks && (
                          <div className="text-[10px] text-zinc-400 italic mt-0.5">
                            {rcpt.remarks}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-600">
                        <div className="font-semibold text-zinc-900">{rcpt.issuedBy}</div>
                        <div className="text-emerald-700 text-[10px] font-bold">
                          Zero-Fee Intake
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openRegistrationReceiptModal(rcpt)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Slip</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Intake Receipt Modal */}
      <EditIntakeModal
        isOpen={!!editingRecord}
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
      />
    </div>
  );
};
