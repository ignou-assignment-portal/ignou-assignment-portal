import React from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTime } from '../utils/helpers';
import { IGNOU_PROGRAMMES } from '../data/ignouMasterData';
import {
  Printer,
  X,
  CheckCircle2,
  ShieldCheck,
  FileCheck,
  Building2,
  ClipboardCheck,
} from 'lucide-react';

export const RegistrationReceiptModal: React.FC = () => {
  const {
    selectedRegistrationReceipt,
    closeRegistrationReceiptModal,
    settings,
  } = useApp();

  if (!selectedRegistrationReceipt) return null;

  const handlePrint = () => {
    window.print();
  };

  // Find programme details
  const progInfo = IGNOU_PROGRAMMES.find(
    (p) => p.code === selectedRegistrationReceipt.programmeCode
  );

  return (
    <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto print:m-0 print:border-none print:shadow-none print:w-full">
        {/* Modal Action Bar (Hidden on print) */}
        <div className="px-5 py-3.5 bg-zinc-900 text-white flex items-center justify-between print:hidden">
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
            <button
              onClick={handlePrint}
              id="print-registration-receipt-btn"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Receipt</span>
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
        <div className="p-6 sm:p-8 text-zinc-900 bg-white" id="printable-registration-receipt">
          {/* Institutional Top Header */}
          <div className="text-center border-b-2 border-zinc-900 pb-4">
            <div className="flex items-center justify-center gap-2 text-xs tracking-widest font-black uppercase text-zinc-700">
              <Building2 className="w-4 h-4 text-indigo-900 print:hidden inline" />
              <span>Indira Gandhi National Open University (IGNOU)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950 mt-1">
              STUDY CENTRE - {settings.centreCode}
            </h2>
            <div className="text-xs text-zinc-600 font-medium">
              {settings.institutionName} • Regional Centre: {settings.regionalCentreCode}
            </div>
            <div className="inline-block mt-2.5 px-4 py-1 rounded-full border-2 border-zinc-900 text-xs font-black tracking-wider uppercase bg-zinc-100">
              STUDENT COURSE ASSIGNMENT INTAKE ACKNOWLEDGMENT RECEIPT
            </div>
          </div>

          {/* Receipt Header Grid */}
          <div className="mt-4 p-3.5 bg-zinc-50 border border-zinc-300 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-zinc-500 font-semibold block text-[10px] uppercase">Receipt Number</span>
              <span className="font-mono font-black text-sm text-indigo-950 tracking-wider">
                {selectedRegistrationReceipt.receiptNumber}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 font-semibold block text-[10px] uppercase">Academic Session</span>
              <span className="font-bold text-zinc-900 text-xs">
                {selectedRegistrationReceipt.session}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 font-semibold block text-[10px] uppercase">Intake Date & Time</span>
              <span className="font-medium text-zinc-800 text-xs">
                {formatDateTime(selectedRegistrationReceipt.issuedAt)}
              </span>
            </div>
          </div>

          {/* Student Profile Grid */}
          <div className="mt-4 border border-zinc-200 rounded-xl p-4 bg-zinc-50/50">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Candidate Identification Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-zinc-500 text-[10px] uppercase block font-semibold">Enrolment Number</span>
                <span className="text-sm font-mono font-black text-zinc-900 tracking-wider">
                  {selectedRegistrationReceipt.studentId}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase block font-semibold">Candidate Full Name</span>
                <span className="text-xs font-bold text-zinc-900">
                  {selectedRegistrationReceipt.studentName}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase block font-semibold">Programme Code</span>
                <span className="text-xs font-bold text-zinc-900">
                  {selectedRegistrationReceipt.programmeCode} {progInfo ? `— ${progInfo.name}` : ''}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase block font-semibold">Contact Mobile</span>
                <span className="text-xs font-medium text-zinc-800">
                  {selectedRegistrationReceipt.studentPhone || 'Not Provided'}
                </span>
              </div>
            </div>
          </div>

          {/* Enrolled Courses Submitted for the Session */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-indigo-700" />
                <span>Enrolled Assignment Courses Received ({selectedRegistrationReceipt.session})</span>
              </h3>
              <span className="text-xs font-semibold text-zinc-600">
                Total Received Courses: <strong>{selectedRegistrationReceipt.registeredCourses.length}</strong>
              </span>
            </div>

            <div className="border border-zinc-300 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-300 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">#</th>
                    <th className="py-2 px-3 w-32">Course Code</th>
                    <th className="py-2 px-3">Course Title</th>
                    <th className="py-2 px-3 w-20 text-center">Credits</th>
                    <th className="py-2 px-3 w-36 text-right">Intake Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {selectedRegistrationReceipt.registeredCourses.map((code, idx) => {
                    const cInfo = progInfo?.courses.find((c) => c.code === code);
                    return (
                      <tr key={code} className="hover:bg-zinc-50/50">
                        <td className="py-2.5 px-3 text-center text-zinc-500 font-mono font-medium">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-black text-indigo-950">{code}</td>
                        <td className="py-2.5 px-3 text-zinc-800 font-medium">
                          {cInfo ? cInfo.title : 'Curriculum Course Module'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-zinc-700">
                          {cInfo ? cInfo.credits : 6}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
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

          {/* Institutional Counter Verification Details (Zero-Fee Non-Financial Desk) */}
          <div className="mt-4 border border-zinc-300 rounded-xl p-4 bg-zinc-50">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center gap-1.5 mb-2.5">
              <ClipboardCheck className="w-3.5 h-3.5 text-indigo-700" />
              <span>Counter Desk Verification Record</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-lg border border-zinc-200">
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">Intake Desk Official</span>
                <span className="font-semibold text-zinc-900">
                  {selectedRegistrationReceipt.issuedBy}
                </span>
                <span className="text-[10px] text-zinc-500 block">SC-{settings.centreCode} Desk</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">Financial Nature</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block text-[11px]">
                  Zero-Fee Intake
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Strictly Non-Financial at Counter</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">Desk Remarks / Notes</span>
                <span className="text-zinc-700 italic">
                  {selectedRegistrationReceipt.remarks || 'Physical handwritten assignment scripts verified and stamped.'}
                </span>
              </div>
            </div>
          </div>

          {/* Institutional Statutory Declarations */}
          <div className="mt-4 p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg text-[10px] text-amber-900 space-y-1">
            <div className="font-bold uppercase tracking-wider flex items-center gap-1 text-amber-950">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700 inline" />
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

          {/* Dual Signature & Seal Blocks */}
          <div className="mt-8 pt-4 border-t-2 border-dashed border-zinc-300 grid grid-cols-2 gap-8 text-xs">
            <div className="text-center pt-8">
              <div className="w-3/4 mx-auto border-t border-zinc-500 pt-1 text-zinc-600 font-medium">
                Candidate / Student Signature
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                (I certify that the assignments submitted are my original handwritten work)
              </div>
            </div>

            <div className="text-center pt-8 relative">
              {/* Simulated Stamp */}
              <div className="absolute top-0 right-1/4 border-2 border-indigo-900 text-indigo-900 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rotate-[-5deg] opacity-80 pointer-events-none bg-indigo-50/60 leading-tight">
                VERIFIED & RECEIVED
                <br />
                IGNOU {settings.centreCode}
                <br />
                <span className="text-[7.5px] font-semibold text-indigo-800">{settings.coordinatorName || 'Dr. Sant K. Gupta'}</span>
              </div>
              <div className="w-3/4 mx-auto border-t border-zinc-900 pt-1 text-zinc-900 font-bold">
                {settings.coordinatorName || 'Dr. Sant K. Gupta'}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
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
              <span>Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
