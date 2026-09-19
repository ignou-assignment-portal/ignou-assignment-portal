import React from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, formatDateTime } from '../utils/helpers';
import { IGNOU_PROGRAMMES } from '../data/ignouMasterData';
import { Printer, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export const ReceiptModal: React.FC = () => {
  const { selectedReceiptRecord, closeReceiptModal, settings } = useApp();

  if (!selectedReceiptRecord) return null;

  const handlePrint = () => {
    window.print();
  };

  // Programme info
  const progInfo = IGNOU_PROGRAMMES.find((p) => p.code === selectedReceiptRecord.programmeCode);

  // Simulated barcode stripes pattern
  const barcodePattern = [
    3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 4, 1, 2, 1, 3, 1, 4, 2, 1, 3, 2, 1, 2, 4, 1, 3, 1, 2, 3, 1, 4
  ];

  return (
    <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto print:m-0 print:border-none print:shadow-none print:w-full print:rounded-none">
        {/* Modal Action Bar (Hidden on print) */}
        <div className="px-5 py-3 bg-zinc-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Official Assignment Submission Acknowledgment</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              id="print-receipt-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Acknowledgment (Slip)</span>
            </button>
            <button
              onClick={closeReceiptModal}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-4 sm:p-6 print:p-2 text-zinc-900 bg-white" id="printable-receipt">
          {/* Institutional Header */}
          <div className="text-center border-b-2 border-zinc-900 pb-2.5 print:pb-1.5">
            <h1 className="text-xs sm:text-sm print:text-xs font-black tracking-tight text-zinc-950 uppercase">
              INDIRA GANDHI NATIONAL OPEN UNIVERSITY - STUDY CENTRE SC-2033
            </h1>
            <div className="text-[11px] print:text-[9.5px] text-zinc-600 font-medium mt-0.5">
              {settings.institutionName} • Regional Centre: {settings.regionalCentreCode}
            </div>
            <div className="inline-block mt-1 px-3 py-0.5 rounded-full border border-zinc-900 text-[10px] print:text-[8.5px] font-black tracking-wider uppercase bg-zinc-100">
              OFFICIAL STUDENT ASSIGNMENT SUBMISSION ACKNOWLEDGMENT RECEIPT
            </div>
          </div>

          {/* Session cycle, timestamp, submission counter ID */}
          <div className="mt-2.5 print:mt-1.5 p-2 print:p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs print:text-[10px]">
            <div>
              <span className="text-zinc-500 font-bold block text-[9px] uppercase">Token / Receipt No.</span>
              <span className="font-mono font-black text-xs print:text-[11px] text-indigo-950 tracking-wider">
                {selectedReceiptRecord.tokenNo}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 font-bold block text-[9px] uppercase">Session Cycle</span>
              <span className="font-bold text-zinc-900">{selectedReceiptRecord.session}</span>
            </div>
            <div>
              <span className="text-zinc-500 font-bold block text-[9px] uppercase">Submission Counter ID</span>
              <span className="font-mono font-bold text-zinc-800">COUNTER-01 (Intake Desk)</span>
            </div>
            <div>
              <span className="text-zinc-500 font-bold block text-[9px] uppercase">Date & Timestamp</span>
              <span className="font-medium text-zinc-800">
                {formatDate(selectedReceiptRecord.submissionDate)} ({formatDateTime(selectedReceiptRecord.createdAt)})
              </span>
            </div>
          </div>

          {/* Barcode & Verification Tracking Strip (QR code removed per requirement) */}
          <div className="mt-2 print:mt-1.5 p-2 print:p-1.5 bg-white border border-zinc-300 rounded-lg flex flex-row items-center justify-between gap-3">
            {/* Barcode */}
            <div className="flex flex-col items-start sm:items-center">
              <div className="h-7 print:h-6 flex items-end gap-[1.5px] px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded">
                {barcodePattern.map((width, idx) => (
                  <div
                    key={idx}
                    className={`bg-zinc-950 ${idx % 2 === 0 ? 'h-full' : 'h-3/4'}`}
                    style={{ width: `${width * 1.3}px` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[9px] print:text-[8px] text-zinc-700 font-bold tracking-widest mt-0.5">
                *{selectedReceiptRecord.tokenNo}*
              </span>
            </div>

            {/* Verification & Intake Status Badge */}
            <div className="text-right">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] print:text-[9px] font-bold">
                ✓ Verified & Intake Stamped at Desk
              </div>
              <div className="text-[10px] print:text-[8.5px] text-zinc-500 font-mono mt-0.5">
                Enrol: {selectedReceiptRecord.enrollmentNo} • Prog: {selectedReceiptRecord.programmeCode}
              </div>
            </div>
          </div>

          {/* Student Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 print:mt-1.5 text-xs print:text-[10px] border border-zinc-200 rounded-lg p-2.5 print:p-1.5 bg-zinc-50/60">
            <div>
              <div className="text-zinc-500 text-[9px] uppercase font-bold">Enrollment Number</div>
              <div className="text-xs print:text-[11px] font-mono font-black text-zinc-900 tracking-wider">
                {selectedReceiptRecord.enrollmentNo}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-[9px] uppercase font-bold">Candidate Name</div>
              <div className="text-[11px] font-bold text-zinc-900 truncate">
                {selectedReceiptRecord.studentName}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-[9px] uppercase font-bold">Contact Number</div>
              <div className="text-[11px] font-medium text-zinc-800">
                {selectedReceiptRecord.studentPhone || 'Not Provided'}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-[9px] uppercase font-bold">Enrolled Programme</div>
              <div className="font-bold text-zinc-900 text-[11px] truncate">
                {selectedReceiptRecord.programmeCode} {progInfo ? `(${progInfo.name})` : ''}
              </div>
            </div>
          </div>

          {/* Submission Mode & Tracking */}
          <div className="mt-1.5 text-xs print:text-[10px] flex items-center justify-between px-2.5 py-1 bg-zinc-100 rounded border border-zinc-200">
            <span className="text-zinc-700">
              <strong>Submission Mode: </strong>
              {selectedReceiptRecord.submissionMode}
              {selectedReceiptRecord.consignmentNo && (
                <span className="font-mono ml-2 text-indigo-900">
                  [Consignment/Speed Post: {selectedReceiptRecord.consignmentNo}]
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold text-emerald-800">
              Status: Verified at Desk
            </span>
          </div>

          {/* Bulleted / Structured Table of Registered Course Codes */}
          <div className="mt-2.5 print:mt-1.5">
            <div className="text-[11px] print:text-[9.5px] font-black text-zinc-900 mb-1 flex items-center justify-between uppercase tracking-wider">
              <span>REGISTERED ASSIGNMENT COURSE CODES ({selectedReceiptRecord.courseCodes.length} Scripts)</span>
              <span className="text-[10px] font-semibold text-zinc-500 lowercase">
                session: {selectedReceiptRecord.session}
              </span>
            </div>
            <table className="w-full text-xs print:text-[10px] border border-zinc-300 rounded overflow-hidden">
              <thead className="bg-zinc-100 text-zinc-800 font-bold border-b border-zinc-300 uppercase text-[9px] print:text-[8px]">
                <tr>
                  <th className="py-1 px-2 text-left w-10 border-r border-zinc-300">S.No.</th>
                  <th className="py-1 px-2 text-left w-24 border-r border-zinc-300">Course Code</th>
                  <th className="py-1 px-2 text-left border-r border-zinc-300">Course Title</th>
                  <th className="py-1 px-2 text-center w-14 border-r border-zinc-300">Credits</th>
                  <th className="py-1 px-2 text-right">Physical Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {selectedReceiptRecord.courseCodes.map((code, index) => {
                  const cInfo = progInfo?.courses.find((c) => c.code === code);
                  return (
                    <tr key={code} className="hover:bg-zinc-50">
                      <td className="py-1 px-2 font-medium text-zinc-600 border-r border-zinc-200">
                        {index + 1}.
                      </td>
                      <td className="py-1 px-2 font-bold text-indigo-950 font-mono border-r border-zinc-200">
                        {code}
                      </td>
                      <td className="py-1 px-2 text-zinc-800 border-r border-zinc-200 truncate max-w-[200px]">
                        {cInfo ? cInfo.title : 'Course Curriculum Module'}
                      </td>
                      <td className="py-1 px-2 text-center text-zinc-700 font-semibold border-r border-zinc-200">
                        {cInfo ? cInfo.credits : 6}
                      </td>
                      <td className="py-1 px-2 text-right text-emerald-800 font-bold text-[10px] print:text-[9px]">
                        ✓ Physical Script Received
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedReceiptRecord.remarks && (
            <div className="mt-1.5 text-[10px] print:text-[9px] text-zinc-600 bg-zinc-50 p-1.5 rounded border border-zinc-200">
              <span className="font-bold text-zinc-800">Desk Verification Remarks: </span>
              {selectedReceiptRecord.remarks}
            </div>
          )}

          {/* Important Notices for the Learner */}
          <div className="mt-2 print:mt-1.5 p-2 print:p-1.5 rounded-lg border border-amber-200 bg-amber-50/70 text-[10px] print:text-[8.5px] text-amber-900">
            <div className="font-bold flex items-center gap-1 text-amber-950 mb-0.5">
              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
              <span>IMPORTANT STATUTORY INSTRUCTIONS FOR THE LEARNER:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-950 leading-tight">
              <li>Retain this official computer-generated acknowledgment slip until assignment marks reflect on your IGNOU Grade Card.</li>
              <li>Assignments carry 30% weightage in continuous evaluation. Minimum passing mark is 40% (Grade D).</li>
              <li>In case of discrepancy, produce this original token receipt at Study Centre 2033 coordinator desk.</li>
            </ul>
          </div>

          {/* Sign-off Placeholder: Receiving Desk Official Signature & Seal */}
          <div className="mt-4 print:mt-3 pt-2.5 print:pt-2 border-t border-dashed border-zinc-300 grid grid-cols-3 gap-3 text-xs print:text-[10px] items-end">
            <div>
              <div className="text-zinc-500 text-[9px] uppercase font-bold">Counter Received By</div>
              <div className="font-bold text-zinc-900 text-xs mt-0.5">{selectedReceiptRecord.registeredBy}</div>
              <div className="text-[9px] text-zinc-500">{settings.institutionName || "S.D. Jain Girls' College, Dimapur"} ({settings.centreCode})</div>
            </div>

            <div className="text-center relative">
              {/* Simulated Stamp Seal - Official Study Centre Stamp without personal name */}
              <div className="w-36 h-14 mx-auto border-2 border-indigo-900 text-indigo-900 rounded-md p-1 flex flex-col items-center justify-center text-[9px] font-black uppercase tracking-wider rotate-[-3deg] bg-indigo-50/40">
                <span>IGNOU {settings.centreCode}</span>
                <span className="text-[8px] font-bold text-indigo-800">VERIFIED & RECEIVED</span>
                <span className="text-[7px] text-indigo-600 font-mono">{formatDate(selectedReceiptRecord.submissionDate)}</span>
              </div>
              <div className="text-[9px] font-bold text-zinc-700 mt-1">Study Centre Official Stamp</div>
            </div>

            <div className="text-right">
              <div className="w-36 ml-auto border-b border-zinc-900 mb-1"></div>
              <div className="font-black text-zinc-950 text-xs">Coordinator / Authorised Official</div>
              <div className="text-[9px] text-zinc-500">{settings.coordinatorDesignation || 'Coordinator, IGNOU SC-2033'}</div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden on print) */}
        <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-3 flex items-center justify-between text-xs text-zinc-500 print:hidden">
          <span>Official Institutional Record • Token: <strong>{selectedReceiptRecord.tokenNo}</strong></span>
          <div className="flex items-center gap-2">
            <button
              onClick={closeReceiptModal}
              className="px-3.5 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
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

