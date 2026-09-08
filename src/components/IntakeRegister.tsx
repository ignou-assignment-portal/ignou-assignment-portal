import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { IntakeStatus, SubmissionMode } from '../types';
import { formatDate, calculateIGNOUGrade } from '../utils/helpers';
import {
  Search,
  Filter,
  Download,
  Printer,
  Trash2,
  Edit2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileSpreadsheet,
  Award,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { EditIntakeModal } from './EditIntakeModal';

export const IntakeRegister: React.FC = () => {
  const {
    currentSession,
    sessionIntakes,
    allIntakes,
    allCourseEvaluations,
    updateIntakeRecord,
    deleteIntakeRecord,
    openReceiptModal,
    isAdmin,
    verifyAndSetAdminRole,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [selectedProgramme, setSelectedProgramme] = useState<string>('ALL');
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

  // Filtered records strictly for active session
  const filteredRecords = useMemo(() => {
    return sessionIntakes.filter((record) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        record.tokenNo.toLowerCase().includes(q) ||
        record.enrollmentNo.toLowerCase().includes(q) ||
        record.studentName.toLowerCase().includes(q) ||
        record.programmeCode.toLowerCase().includes(q) ||
        record.courseCodes.some((c) => c.toLowerCase().includes(q));

      const matchesStatus = selectedStatus === 'ALL' || record.status === selectedStatus;
      const matchesMode = selectedMode === 'ALL' || record.submissionMode === selectedMode;
      const matchesProgramme = selectedProgramme === 'ALL' || record.programmeCode === selectedProgramme;

      return matchesQuery && matchesStatus && matchesMode && matchesProgramme;
    });
  }, [sessionIntakes, searchQuery, selectedStatus, selectedMode, selectedProgramme]);

  // Unique programmes in this session
  const sessionProgrammes = useMemo(() => {
    return Array.from(new Set(sessionIntakes.map((r) => r.programmeCode)));
  }, [sessionIntakes]);

  // Counts across other sessions to demonstrate isolation
  const otherSessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allIntakes.forEach((r) => {
      if (r.session !== currentSession) {
        counts[r.session] = (counts[r.session] || 0) + 1;
      }
    });
    return counts;
  }, [allIntakes, currentSession]);

  const handleStatusChange = (id: string, newStatus: IntakeStatus) => {
    updateIntakeRecord(id, { status: newStatus });
  };

  const handleExportCSV = () => {
    const headers = [
      'Token No',
      'Session',
      'Enrollment No',
      'Student Name',
      'Programme',
      'Course Codes',
      'Submission Date',
      'Submission Mode',
      'Status',
      'Marks',
      'Registered By',
    ];

    const rows = filteredRecords.map((r) => [
      r.tokenNo,
      r.session,
      `'${r.enrollmentNo}`, // escape for excel
      `"${r.studentName}"`,
      r.programmeCode,
      `"${r.courseCodes.join(', ')}"`,
      r.submissionDate,
      r.submissionMode,
      r.status,
      `"${Object.entries(r.marks).map(([c, m]) => `${c}:${m ?? 'NA'}`).join(', ')}"`,
      r.registeredBy,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IGNOU_SC2033_IntakeRegister_${currentSession.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Session Isolation Banner */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-zinc-900 flex items-center gap-2">
              <span>Intake Register (Strict Session Isolated)</span>
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-mono">
                {currentSession}
              </span>
            </div>
            <p className="text-zinc-500 mt-0.5">
              Displaying records exclusively for <strong className="text-zinc-700">{currentSession}</strong> ({sessionIntakes.length} total).
              {Object.keys(otherSessionCounts).length > 0 && (
                <span className="text-zinc-400 ml-1">
                  (Other cycles: {Object.entries(otherSessionCounts).map(([s, count]) => `${s}: ${count}`).join(' | ')})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg font-semibold transition border border-zinc-300 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Register (.CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Enrollment, Name, Token, Course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="Received">Received at Counter</option>
              <option value="In Packet">In Packet</option>
              <option value="Under Evaluation">Under Evaluation</option>
              <option value="Evaluated">Evaluated</option>
              <option value="Marks Uploaded">Marks Uploaded</option>
            </select>
          </div>

          {/* Programme Filter */}
          <div>
            <select
              value={selectedProgramme}
              onChange={(e) => setSelectedProgramme(e.target.value)}
              className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="ALL">All Programmes</option>
              {sessionProgrammes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Submission Mode Filter */}
          <div>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="ALL">All Submission Modes</option>
              <option value="In-Person (Desk)">In-Person (Desk)</option>
              <option value="Speed Post">Speed Post</option>
              <option value="Registered Post">Registered Post</option>
              <option value="Courier">Courier</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-100">
          <span>
            Showing <strong className="text-zinc-800">{filteredRecords.length}</strong> of{' '}
            <strong className="text-zinc-800">{sessionIntakes.length}</strong> submissions in {currentSession}
          </span>
          {(searchQuery || selectedStatus !== 'ALL' || selectedMode !== 'ALL' || selectedProgramme !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('ALL');
                setSelectedMode('ALL');
                setSelectedProgramme('ALL');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Register Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-100/80 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr>
                <th className="py-3 px-4">Token / Date</th>
                <th className="py-3 px-4">Student & Enrollment</th>
                <th className="py-3 px-4">Prog</th>
                <th className="py-3 px-4">Courses Submitted</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Assignment Status</th>
                <th className="py-3 px-4">Marks Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    No assignment submissions match your criteria in {currentSession}.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const marksEntries = Object.entries(record.marks);
                  const marksCount = marksEntries.filter(([_, m]) => m !== null).length;
                  const allMarksEntered = marksCount === record.courseCodes.length;

                  return (
                    <tr key={record.id} className="hover:bg-zinc-50 transition">
                      {/* Token & Date */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-indigo-950 text-xs">
                          {record.tokenNo}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {formatDate(record.submissionDate)}
                        </div>
                      </td>

                      {/* Student Info */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900">
                          {record.studentName}
                        </div>
                        <div className="font-mono text-zinc-500 text-[11px]">
                          Enr: {record.enrollmentNo}
                        </div>
                        {record.studentPhone && (
                          <div className="text-[10px] text-zinc-400">
                            {record.studentPhone}
                          </div>
                        )}
                      </td>

                      {/* Programme */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                          {record.programmeCode}
                        </span>
                      </td>

                      {/* Courses */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {record.courseCodes.map((code) => {
                            const mark = record.marks[code];
                            return (
                              <span
                                key={code}
                                className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  mark !== null && mark !== undefined
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-zinc-50 text-zinc-700 border-zinc-200'
                                }`}
                                title={mark !== null ? `Marks: ${mark}/100` : 'Marks pending'}
                              >
                                {code}
                                {mark !== null && (
                                  <span className="ml-1 text-emerald-700">({mark})</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Mode */}
                      <td className="py-3 px-4">
                        <span className="text-zinc-700 text-[11px] block font-medium">
                          {record.submissionMode}
                        </span>
                        {record.consignmentNo && (
                          <span className="font-mono text-[10px] text-zinc-500 block">
                            {record.consignmentNo}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <select
                          value={record.status}
                          onChange={(e) => handleStatusChange(record.id, e.target.value as IntakeStatus)}
                          className={`text-[11px] font-semibold rounded-lg px-2 py-1 border transition focus:outline-hidden ${
                            record.status === 'Evaluated'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : record.status === 'Under Evaluation'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : record.status === 'In Packet'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : record.status === 'Marks Uploaded'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                          }`}
                        >
                          <option value="Received">Received</option>
                          <option value="In Packet">In Packet</option>
                          <option value="Under Evaluation">Under Evaluation</option>
                          <option value="Evaluated">Evaluated</option>
                          <option value="Marks Uploaded">Marks Uploaded</option>
                        </select>
                      </td>

                      {/* Marks Award Status */}
                      <td className="py-3 px-4">
                        <div className="text-[11px]">
                          {allMarksEntered ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              All Awarded ({marksCount}/{record.courseCodes.length})
                            </span>
                          ) : marksCount > 0 ? (
                            <span className="text-amber-700 font-medium">
                              Partial ({marksCount}/{record.courseCodes.length})
                            </span>
                          ) : (
                            <span className="text-zinc-400">Pending Evaluation</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            id={`edit-btn-${record.id}`}
                            onClick={() => handleEditClick(record)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:text-indigo-700 bg-zinc-100 hover:bg-indigo-50 border border-zinc-200 hover:border-indigo-300 rounded-lg transition shadow-2xs cursor-pointer"
                            title="Edit Intake Receipt"
                          >
                            <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            id={`delete-btn-${record.id}`}
                            onClick={() => handleDeleteClick(record)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition shadow-2xs cursor-pointer"
                            title="Delete Intake Record (Coordinator PIN 2033 Required)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>

                          {/* Print / View Acknowledgment Slip */}
                          <button
                            id={`print-slip-${record.id}`}
                            onClick={() => openReceiptModal(record)}
                            className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Print / View Official Acknowledgment Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Intake Receipt Modal */}
      <EditIntakeModal
        isOpen={!!editingRecord}
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
      />
    </div>
  );
};
