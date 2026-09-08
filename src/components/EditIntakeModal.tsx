import React, { useState, useEffect, useMemo } from 'react';
import { IntakeRecord } from '../types';
import { useApp } from '../context/AppContext';
import { IGNOU_PROGRAMMES } from '../data/ignouMasterData';
import {
  X,
  Edit3,
  Save,
  BookOpen,
  User,
  Phone,
  Hash,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
} from 'lucide-react';

interface EditIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: IntakeRecord | null;
}

export const EditIntakeModal: React.FC<EditIntakeModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  const { editIntakeEntry, currentSession, allCourseEvaluations } = useApp();

  const [originalEnrollmentNo, setOriginalEnrollmentNo] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [contact, setContact] = useState('');
  const [programme, setProgramme] = useState('');
  const [coursesInput, setCoursesInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form fields whenever record changes
  useEffect(() => {
    if (record) {
      setOriginalEnrollmentNo(record.enrollmentNo);
      setEnrollmentNo(record.enrollmentNo);
      setCandidateName(record.studentName || '');
      setContact(record.studentPhone || '');
      setProgramme(record.programmeCode || '');
      setCoursesInput(record.courseCodes ? record.courseCodes.join(', ') : '');
      setFormError(null);
    }
  }, [record]);

  // Parse comma-separated courses into clean array of uppercase codes
  const parsedCourses = useMemo(() => {
    if (!coursesInput) return [];
    return Array.from(
      new Set(
        coursesInput
          .split(',')
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean)
      )
    );
  }, [coursesInput]);

  // Check which existing courses for this student are already locked
  const lockedCourseCodes = useMemo(() => {
    if (!record) return [];
    const activeSession = record.session || currentSession;
    return allCourseEvaluations
      .filter(
        (ce) =>
          (ce.intakeId === record.id || ce.enrollmentNo.trim() === record.enrollmentNo.trim()) &&
          ce.session.trim().toLowerCase() === activeSession.trim().toLowerCase() &&
          (ce.isLocked || ce.status === 'Locked' || ce.status === 'Marks Locked')
      )
      .map((ce) => ce.courseCode.toUpperCase());
  }, [record, currentSession, allCourseEvaluations]);

  if (!isOpen || !record) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEnr = enrollmentNo.trim();
    const cleanName = candidateName.trim();
    const cleanContact = contact.trim();
    const cleanProg = programme.trim().toUpperCase();

    if (!cleanEnr) {
      setFormError('Please enter a valid Enrollment Number.');
      return;
    }

    if (cleanEnr.length < 7 || cleanEnr.length > 12) {
      setFormError('Enrollment Number is typically 9 or 10 digits.');
      return;
    }

    if (!cleanName) {
      setFormError('Please enter Student / Candidate Name.');
      return;
    }

    if (!cleanProg) {
      setFormError('Please enter or select a Programme code (e.g., MEG, BAG, MPS).');
      return;
    }

    if (parsedCourses.length === 0) {
      setFormError('Please enter at least one Course Code (e.g. MEG01, MEG02).');
      return;
    }

    if (parsedCourses.length > 8) {
      setFormError('Maximum 8 courses can be registered in a single intake receipt.');
      return;
    }

    // Check if any course that was already locked is being removed
    const removedLockedCourses = lockedCourseCodes.filter((c) => !parsedCourses.includes(c));
    if (removedLockedCourses.length > 0) {
      setFormError(
        `Cannot remove locked course(s): ${removedLockedCourses.join(', ')}. Marks have already been locked by Coordinator.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      // Perform optimistic state update & dispatch POST EDIT_INTAKE via AppContext
      editIntakeEntry({
        id: record.id,
        originalEnrollmentNo: originalEnrollmentNo.trim(),
        enrollmentNo: cleanEnr,
        candidateName: cleanName,
        contact: cleanContact,
        programme: cleanProg,
        courses: parsedCourses,
        session: record.session || currentSession,
      });

      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err?.message || 'Failed to update intake receipt.');
    }
  };

  return (
    <div
      id="edit-intake-modal-backdrop"
      className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="edit-intake-modal"
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-sm sm:text-base flex items-center gap-2">
                <span>Edit Intake Receipt</span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {record.tokenNo}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500">
                Update student identity or course registrations for session{' '}
                <strong className="text-zinc-700">{record.session || currentSession}</strong>.
              </p>
            </div>
          </div>

          <button
            id="edit-intake-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {formError && (
            <div
              id="edit-intake-error"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{formError}</div>
            </div>
          )}

          {/* Original Enrollment Info Badge */}
          <div className="p-2.5 bg-zinc-100 rounded-xl flex items-center justify-between text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-zinc-500" />
              <span>Original Enrollment ID:</span>
              <strong className="font-mono text-zinc-900">{originalEnrollmentNo}</strong>
            </div>
            <span className="text-[10px] text-zinc-500">
              Receipt Token: <span className="font-mono">{record.tokenNo}</span>
            </span>
          </div>

          {/* Grid: Enrollment Number & Student Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-enrollment-input"
                className="block text-xs font-bold text-zinc-700 mb-1"
              >
                Enrollment Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="edit-enrollment-input"
                  type="text"
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value.trim())}
                  placeholder="e.g., 2401928371"
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-student-name-input"
                className="block text-xs font-bold text-zinc-700 mb-1"
              >
                Candidate Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="edit-student-name-input"
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="Full student name"
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Grid: Contact Number & Programme */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-contact-input"
                className="block text-xs font-bold text-zinc-700 mb-1"
              >
                Contact / Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="edit-contact-input"
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-programme-input"
                className="block text-xs font-bold text-zinc-700 mb-1"
              >
                Programme Code <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="edit-programme-input"
                  type="text"
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value.toUpperCase())}
                  placeholder="e.g., MEG, BAG, MPS"
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold uppercase border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Courses Field (Comma-separated) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="edit-courses-input"
                className="block text-xs font-bold text-zinc-700"
              >
                Registered Courses (Comma-separated){' '}
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-zinc-500">
                {parsedCourses.length} course{parsedCourses.length === 1 ? '' : 's'} recognized
              </span>
            </div>

            <input
              id="edit-courses-input"
              type="text"
              value={coursesInput}
              onChange={(e) => setCoursesInput(e.target.value)}
              placeholder="e.g. MEG01, MEG02, MEG03, MEG04"
              required
              className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Separate course codes with commas. Up to 8 courses allowed per student intake.
            </p>

            {/* Real-time recognized course chips */}
            {parsedCourses.length > 0 && (
              <div className="mt-2.5 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5 flex items-center justify-between">
                  <span>Recognized Course List:</span>
                  {lockedCourseCodes.length > 0 && (
                    <span className="text-amber-800 font-semibold flex items-center gap-1 text-[10px]">
                      <Lock className="w-3 h-3 text-amber-700" />
                      {lockedCourseCodes.length} course(s) locked
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsedCourses.map((c) => {
                    const isLocked = lockedCourseCodes.includes(c);
                    return (
                      <span
                        key={c}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                          isLocked
                            ? 'bg-amber-100 text-amber-950 border-amber-300'
                            : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                        }`}
                      >
                        {isLocked && <Lock className="w-3 h-3 text-amber-700" />}
                        {c}
                        {isLocked && <span className="text-[9px] font-sans font-normal">(Locked)</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sync & Persistence Guarantee Note */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Optimistic State & Google Sheets Sync</span>
            </div>
            <p className="text-[10px] text-indigo-800 leading-relaxed">
              Submitting updates both the <strong>Intake Register</strong> and the individual course rows in <strong>Course Ledger</strong>.
              A dispatch with action <code className="bg-white/80 px-1 py-0.2 rounded font-mono">EDIT_INTAKE</code> is sent to the Google Apps Script backend.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2.5">
            <button
              id="edit-intake-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-100 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="edit-intake-save-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving & Syncing...' : 'Save & Sync Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
