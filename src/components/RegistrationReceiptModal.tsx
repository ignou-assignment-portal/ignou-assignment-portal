import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, formatDateTime } from '../utils/helpers';
import {
  Printer,
  X,
  CheckCircle2,
  ShieldCheck,
  FileCheck,
  Building2,
  ClipboardCheck,
  Calendar,
} from 'lucide-react';

export const RegistrationReceiptModal: React.FC = () => {
  const {
    selectedRegistrationReceipt,
    closeRegistrationReceiptModal,
    updateIntakeDate,
    settings,
    allProgrammes,
    getCourseInfo,
    getCourseTitle,
  } = useApp();

  const receiptDateVal =
    selectedRegistrationReceipt?.submissionDate ||
    selectedRegistrationReceipt?.receiptDate ||
    (selectedRegistrationReceipt?.issuedAt ? String(selectedRegistrationReceipt.issuedAt).split('T')[0] : '') ||
    new Date().toISOString().split('T')[0];

  const [currentReceiptDate, setCurrentReceiptDate] = useState(receiptDateVal);

  useEffect(() => {
    setCurrentReceiptDate(receiptDateVal);
  }, [receiptDateVal]);

  if (!selectedRegistrationReceipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setCurrentReceiptDate(newDate);
    if (newDate) {
      updateIntakeDate(selectedRegistrationReceipt.id || selectedRegistrationReceipt.receiptNumber, newDate);
    }
  };

  // Find programme details from dynamic registry
  const progInfo = allProgrammes.find(
    (p) => p.code === selectedRegistrationReceipt.programmeCode
  );

  return (
    <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto print:m-0 print:border-none print:shadow-none print:w-full">
        {/* Modal Action Bar (Hidden on print) */}
        <div className="px-5 py-3 bg-zinc-900 text-white flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <div>
              <span className="font-bold">Student Assignment Intake Acknowledgment</span>
              <span className="text-xs text-zinc-400 ml-2 hidden sm:inline">
                Zero-Fee Statutory Submission Receipt
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Date Selector */}
            <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded-lg text-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <label htmlFor="reg-receipt-date-picker" className="text-[11px] text-zinc-300 font-medium">
                Date:
              </label>
              <input
                id="reg-receipt-date-picker"
                type="date"
                value={currentReceiptDate}
                onChange={handleDateChange}
                max="2099-12-31"
                className="bg-zinc-950 border border-zinc-700 text-white text-xs px-2 py-0.5 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                title="Select receipt intake date"
              />
            </div>
            <button
              onClick={handlePrint}
              id="print-registration-receipt-btn"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print 1-Page Receipt</span>
            </button>
            <button
              onClick={closeRegistrationReceiptModal}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Canvas */}
        <div className="p-4 sm:p-6 print:p-1 text-zinc-900 bg-white" id="printable-registration-receipt">
          {/* Institutional Top Header */}
          <div className="text-center border-b-2 border-zinc-900 pb-2 print:pb-1">
            <div className="flex items-center justify-center gap-2 text-xs print:text-[8px] tracking-widest font-black uppercase text-zinc-700">
              <Building2 className="w-4 h-4 text-indigo-900 print:hidden inline" />
              <span>Indira Gandhi National Open University (IGNOU)</span>
            </div>
            <h2 className="text-base sm:text-xl print:text-xs font-black tracking-tight text-zinc-950 mt-0.5">
              STUDY CENTRE - {settings.centreCode}
            </h2>
            <div className="text-xs print:text-[8.5px] text-zinc-600 font-medium">
              {settings.institutionName} • Regional Centre: {settings.regionalCentreCode}
            </div>
            <div className="inline-block mt-1 print:mt-0.5 px-3 py-0.5 print:py-0 rounded-full border border-zinc-900 text-[10px] print:text-[8px] font-black tracking-wider uppercase bg-zinc-100">
              STUDENT COURSE ASSIGNMENT INTAKE ACKNOWLEDGMENT RECEIPT
            </div>
          </div>

          {/* Receipt Header Grid */}
          <div className="mt-2 print:mt-1 p-2 print:p-1 bg-zinc-50 border border-zinc-300 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-2 print:gap-1 text-xs print:text-[9px]">
            <div>
              <span className="text-zinc-500 font-semibold block text-[9px] print:text-[7.5px] uppercase">Receipt Number</span>
              <span className="font-mono font-black text-xs print:text-[10px] text-indigo-950 tracking-wider">
                {selectedRegistrationReceipt.receiptNumber}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 font-semibold block text-[9px] print:text-[7.5px] uppercase">Academic Session</span>
              <span className="font-bold text-zinc-900 text-xs print:text-[9.5px]">
                {selectedRegistrationReceipt.session}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 font-semibold block text-[9px] print:text-[7.5px] uppercase">Intake Receipt Date</span>
              <span className="font-bold text-zinc-900 text-xs print:text-[9.5px]">
                {formatDate(currentReceiptDate || receiptDateVal)}
              </span>
            </div>
          </div>

          {/* Student Profile Grid */}
          <div className="mt-2 print:mt-1 border border-zinc-200 rounded-lg p-2 print:p-1 bg-zinc-50/50">
            <h3 className="text-[10px] print:text-[8px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Candidate Identification Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:gap-1 text-xs print:text-[9px]">
              <div>
                <span className="text-zinc-500 text-[9px] print:text-[7.5px] uppercase block font-semibold">Enrolment Number</span>
                <span className="text-xs print:text-[10px] font-mono font-black text-zinc-900 tracking-wider">
                  {selectedRegistrationReceipt.studentId}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[9px] print:text-[7.5px] uppercase block font-semibold">Candidate Full Name</span>
                <span className="text-xs print:text-[9.5px] font-bold text-zinc-900 truncate block">
                  {selectedRegistrationReceipt.studentName}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[9px] print:text-[7.5px] uppercase block font-semibold">Programme Code</span>
                <span className="text-xs print:text-[9.5px] font-bold text-zinc-900 truncate block">
                  {selectedRegistrationReceipt.programmeCode} {progInfo ? `— ${progInfo.name}` : ''}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[9px] print:text-[7.5px] uppercase block font-semibold">Contact Mobile</span>
                <span className="text-xs print:text-[9.5px] font-medium text-zinc-800">
                  {selectedRegistrationReceipt.studentPhone || 'Not Provided'}
                </span>
              </div>
            </div>
          </div>

          {/* Enrolled Courses Submitted for the Session */}
          <div className="mt-2 print:mt-1">
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="text-xs print:text-[8.5px] font-black uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
                <FileCheck className="w-3 h-3 text-indigo-700" />
                <span>Enrolled Assignment Courses Received ({selectedRegistrationReceipt.session})</span>
              </h3>
              <span className="text-xs print:text-[8px] font-semibold text-zinc-600">
                Total Received Courses: <strong>{selectedRegistrationReceipt.registeredCourses.length}</strong>
              </span>
            </div>

            <div className="border border-zinc-300 rounded overflow-hidden">
              <table className="w-full text-xs print:text-[8.5px] text-left">
                <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-300 uppercase text-[9px] print:text-[7.5px]">
                  <tr>
                    <th className="py-1 print:py-0.5 px-2 print:px-1.5 w-10 text-center">#</th>
                    <th className="py-1 print:py-0.5 px-2 print:px-1.5 w-24">Course Code</th>
                    <th className="py-1 print:py-0.5 px-2 print:px-1.5">Course Title</th>
                    <th className="py-1 print:py-0.5 px-2 print:px-1.5 w-16 text-center">Credits</th>
                    <th className="py-1 print:py-0.5 px-2 print:px-1.5 w-32 text-right">Intake Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {selectedRegistrationReceipt.registeredCourses.map((code, idx) => {
                    const cInfo = getCourseInfo(code, selectedRegistrationReceipt.programmeCode);
                    const title = cInfo?.title || getCourseTitle(code, selectedRegistrationReceipt.programmeCode) || 'Curriculum Course Module';
                    const credits = cInfo?.credits || 6;
                    return (
                      <tr key={code} className="hover:bg-zinc-50/50">
                        <td className="py-1 print:py-0.5 px-2 print:px-1.5 text-center text-zinc-500 font-mono font-medium">{idx + 1}</td>
                        <td className="py-1 print:py-0.5 px-2 print:px-1.5 font-mono font-black text-indigo-950">{code}</td>
                        <td className="py-1 print:py-0.5 px-2 print:px-1.5 text-zinc-800 font-medium truncate max-w-[240px]">
                          {title}
                        </td>
                        <td className="py-1 print:py-0.5 px-2 print:px-1.5 text-center font-semibold text-zinc-700">
                          {credits}
                        </td>
                        <td className="py-1 print:py-0.5 px-2 print:px-1.5 text-right">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] print:text-[7.5px] font-bold bg-emerald-100 text-emerald-800">
                            Physical Script Received
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Institutional Counter Verification Details */}
          <div className="mt-2 print:mt-1 border border-zinc-300 rounded-lg p-2 print:p-1 bg-zinc-50">
            <h3 className="text-[10px] print:text-[8px] font-black uppercase tracking-wider text-zinc-800 flex items-center gap-1 mb-1">
              <ClipboardCheck className="w-3 h-3 text-indigo-700" />
              <span>Counter Desk Verification Record</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 print:gap-1 text-xs print:text-[8.5px] bg-white p-2 print:p-1 rounded border border-zinc-200">
              <div>
                <span className="text-zinc-500 text-[9px] print:text-[7px] uppercase font-bold block">Intake Desk Official</span>
                <span className="font-semibold text-zinc-900">
                  {selectedRegistrationReceipt.issuedBy}
                </span>
                <span className="text-[9px] print:text-[7px] text-zinc-500 block">SC-{settings.centreCode} Desk</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[9px] print:text-[7px] uppercase font-bold block">Financial Nature</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 inline-block text-[10px] print:text-[8px]">
                  Zero-Fee Intake
                </span>
                <span className="text-[9px] print:text-[7px] text-zinc-500 block">Strictly Non-Financial at Counter</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[9px] print:text-[7px] uppercase font-bold block">Desk Remarks / Notes</span>
                <span className="text-zinc-700 italic">
                  {selectedRegistrationReceipt.remarks || 'Physical handwritten assignment scripts verified and stamped.'}
                </span>
              </div>
            </div>
          </div>

          {/* Institutional Statutory Declarations */}
          <div className="mt-1.5 print:mt-1 p-2 print:p-1 bg-amber-50/60 border border-amber-200/80 rounded-lg text-[10px] print:text-[8px] text-amber-900 space-y-0.5">
            <div className="font-bold uppercase tracking-wider flex items-center gap-1 text-amber-950">
              <ShieldCheck className="w-3 h-3 text-amber-700 inline" />
              <span>Important Instructions for Student</span>
            </div>
            <p>
              1. Retain this official computer-generated acknowledgment receipt until assignment grades appear on your official IGNOU Grade Card.
            </p>
            <p>
              2. Submitting handwritten assignments for each course is mandatory before appearing in Term-End Examinations (TEE). Minimum passing marks is 40% (Grade D).
            </p>
            <p>
              3. For any discrepancies or marks query, quote Receipt Number <strong className="font-mono text-amber-950">{selectedRegistrationReceipt.receiptNumber}</strong> at Study Centre {settings.centreCode}.
            </p>
          </div>

          {/* Dual Signature & Seal Blocks (NO Dr. Sant Kumar Gupta on stamp) */}
          <div className="mt-2.5 print:mt-1.5 pt-2 print:pt-1 border-t border-dashed border-zinc-300 grid grid-cols-2 gap-4 text-xs print:text-[9px] items-end">
            <div className="text-center">
              <div className="w-3/4 mx-auto border-t border-zinc-500 pt-1 text-zinc-600 font-medium text-[10px] print:text-[8px]">
                Candidate / Student Signature
              </div>
              <div className="text-[8px] print:text-[7px] text-zinc-400 mt-0.5">
                (I certify that the assignments submitted are my original handwritten work)
              </div>
            </div>

            <div className="text-center relative">
              {/* Study Centre Official Stamp without Dr. Sant Kumar Gupta */}
              <div className="inline-block border-2 border-indigo-900 text-indigo-900 rounded px-2.5 py-0.5 text-[8px] print:text-[7px] font-black uppercase tracking-wider rotate-[-2deg] bg-indigo-50/60 leading-tight mb-1">
                VERIFIED & RECEIVED
                <br />
                IGNOU STUDY CENTRE {settings.centreCode}
              </div>
              <div className="w-3/4 mx-auto border-t border-zinc-900 pt-0.5 text-zinc-900 font-bold text-[10px] print:text-[8.5px]">
                Coordinator / Authorised Official
              </div>
              <div className="text-[8px] print:text-[7px] text-zinc-500 mt-0.5">
                {settings.coordinatorDesignation || 'Coordinator, IGNOU SC-2033'} • {settings.institutionName}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden on print) */}
        <div className="px-6 py-3 bg-zinc-100 border-t border-zinc-200 flex items-center justify-between print:hidden text-xs text-zinc-500">
          <span>Official Registration Receipt stored in register: <strong>{selectedRegistrationReceipt.receiptNumber}</strong></span>
          <div className="flex items-center gap-2">
            <button
              onClick={closeRegistrationReceiptModal}
              className="px-4 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-200 font-medium transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print 1-Page Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
