import React from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, formatDateTime } from '../utils/helpers';
import { IGNOU_PROGRAMMES } from '../data/ignouMasterData';
import { Printer, X, CheckCircle2, AlertTriangle, Building2, QrCode } from 'lucide-react';

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
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto print:m-0 print:border-none print:shadow-none print:w-full">
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
        <div className="p-6 sm:p-8 text-zinc-900 bg-white" id="printable-receipt">
          {/* Institutional Header */}
          <div className="text-center border-b-2 border-zinc-900 pb-4">
            <h1 className="text-sm sm:text-base font-black tracking-tight text-zinc-950 uppercase">
              INDIRA GANDHI NATIONAL OPEN UNIVERSITY - STUDY CENTRE SC-2033
            </h1>
            <div className="text-xs text-zinc-600 font-medium mt-0.5">
              {settings.institutionName} • Regional Centre: {settings.regionalCentreCode}
            </div>
            <div className="inline-block mt-2.5 px-3.5 py-1 rounded-full border-2 border-zinc-900 text-xs font-black tracking-wider uppercase bg-zinc-100">
              OFFICIAL STUDENT ASSIGNMENT SUBMISSION ACKNOWLEDGMENT RECEIPT
            </div>
          </div>

          {/* Session cycle, timestamp, submission counter ID */}
          <div className="mt-4 p-3 bg-zinc-50 border border-zinc-300 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-zinc-500 font-bold block text-[10px] uppercase">Token / Receipt No.</span>
              <span className="font-mono font-black text-xs sm:text-sm text-indigo-950 tracking-wider">
                {selectedReceiptRecord.tokenNo}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 font-bold block text-[10px] uppercase">Session Cycle</span>
              <span className="font-bold text-zinc-900">{selectedReceiptRecord.session}</span>
            </div>
            <div>
              <span className="text-zinc-500 font-bold block text-[10px] uppercase">Submission Counter ID</span>
              <span className="font-mono font-bold text-zinc-800">COUNTER-01 (Intake Desk)</span>
            </div>
            <div>
              <span className="text-zinc-500 font-bold block text-[10px] uppercase">Date & Timestamp</span>
              <span className="font-medium text-zinc-800">
                {formatDate(selectedReceiptRecord.submissionDate)} ({formatDateTime(selectedReceiptRecord.createdAt)})
              </span>
            </div>
          </div>

          {/* Simulated Barcode & QR Code Block */}
          <div className="mt-3.5 p-3 bg-white border border-zinc-300 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Simulated Barcode */}
            <div className="flex flex-col items-center">
              <div className="h-10 flex items-end gap-[1.5px] px-3 py-1 bg-zinc-50 border border-zinc-200 rounded">
                {barcodePattern.map((width, idx) => (
                  <div
                    key={idx}
                    className={`bg-zinc-950 ${idx % 2 === 0 ? 'h-full' : 'h-3/4'}`}
                    style={{ width: `${width * 1.5}px` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] text-zinc-700 font-bold tracking-widest mt-1">
                *{selectedReceiptRecord.tokenNo}*
              </span>
            </div>

            {/* Simulated QR Code */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white p-1 border-2 border-zinc-900 rounded shrink-0 flex items-center justify-center relative">
                {/* SVG Simulated QR Pattern */}
                <svg viewBox="0 0 24 24" className="w-full h-full text-zinc-950 fill-current">
                  {/* Top-left locator square */}
                  <rect x="1" y="1" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <rect x="3" y="3" width="3" height="3" fill="currentColor" />
                  {/* Top-right locator square */}
                  <rect x="16" y="1" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <rect x="18" y="3" width="3" height="3" fill="currentColor" />
                  {/* Bottom-left locator square */}
                  <rect x="1" y="16" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <rect x="3" y="18" width="3" height="3" fill="currentColor" />
                  {/* Inner matrix dots */}
                  <rect x="10" y="2" width="2" height="2" />
                  <rect x="10" y="6" width="2" height="2" />
                  <rect x="10" y="10" width="4" height="2" />
                  <rect x="15" y="10" width="2" height="2" />
                  <rect x="2" y="10" width="2" height="2" />
                  <rect x="6" y="10" width="2" height="2" />
                  <rect x="10" y="14" width="2" height="4" />
                  <rect x="14" y="14" width="3" height="3" />
                  <rect x="18" y="18" width="3" height="3" />
                  <rect x="10" y="20" width="2" height="2" />
                </svg>
              </div>
              <div className="text-[10px] text-zinc-600 leading-tight">
                <div className="font-bold text-zinc-900 flex items-center gap-1">
                  <QrCode className="w-3 h-3 text-indigo-700" />
                  <span>Portal Verification QR Code</span>
                </div>
                <div className="text-zinc-500 mt-0.5">Scan to authenticate student intake at SC-2033</div>
                <div className="font-mono text-[9px] text-indigo-950 font-bold mt-0.5">
                  ID: {selectedReceiptRecord.enrollmentNo} • {selectedReceiptRecord.programmeCode}
                </div>
              </div>
            </div>
          </div>

          {/* Student Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs border border-zinc-200 rounded-lg p-3 bg-zinc-50/60">
            <div>
              <div className="text-zinc-500 text-[10px] uppercase font-bold">Enrollment Number</div>
              <div className="text-sm font-mono font-black text-zinc-900 tracking-wider">
                {selectedReceiptRecord.enrollmentNo}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-[10px] uppercase font-bold">Candidate Name</div>
              <div className="text-xs font-bold text-zinc-900">
                {selectedReceiptRecord.studentName}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-[10px] uppercase font-bold">Contact Number</div>
              <div className="text-xs font-medium text-zinc-800">
                {selectedReceiptRecord.studentPhone || 'Not Provided'}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-[10px] uppercase font-bold">Enrolled Programme</div>
              <div className="font-bold text-zinc-900 text-xs">
                {selectedReceiptRecord.programmeCode} {progInfo ? `(${progInfo.name})` : ''}
              </div>
            </div>
          </div>

          {/* Submission Mode & Tracking */}
          <div className="mt-2 text-xs flex items-center justify-between px-3 py-1.5 bg-zinc-100 rounded border border-zinc-200">
            <span className="text-zinc-600">
              <strong>Submission Mode: </strong>
              {selectedReceiptRecord.submissionMode}
              {selectedReceiptRecord.consignmentNo && (
                <span className="font-mono ml-2 text-indigo-900">
                  [Consignment/Speed Post: {selectedReceiptRecord.consignmentNo}]
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold text-emerald-800">
              Status: Verified at Desk
            </span>
          </div>

          {/* Bulleted / Structured Table of Registered Course Codes */}
          <div className="mt-4">
            <div className="text-xs font-black text-zinc-900 mb-1.5 flex items-center justify-between uppercase tracking-wider">
              <span>REGISTERED ASSIGNMENT COURSE CODES ({selectedReceiptRecord.courseCodes.length} Scripts)</span>
              <span className="text-[11px] font-semibold text-zinc-500 lowercase">
                session: {selectedReceiptRecord.session}
              </span>
            </div>
            <table className="w-full text-xs border border-zinc-300 rounded-md overflow-hidden">
              <thead className="bg-zinc-100 text-zinc-800 font-bold border-b border-zinc-300 uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3 text-left w-12 border-r border-zinc-300">S.No.</th>
                  <th className="py-2 px-3 text-left w-28 border-r border-zinc-300">Course Code</th>
                  <th className="py-2 px-3 text-left border-r border-zinc-300">Course Title</th>
                  <th className="py-2 px-3 text-center w-16 border-r border-zinc-300">Credits</th>
                  <th className="py-2 px-3 text-right">Physical Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {selectedReceiptRecord.courseCodes.map((code, index) => {
                  const cInfo = progInfo?.courses.find((c) => c.code === code);
                  return (
                    <tr key={code} className="hover:bg-zinc-50">
                      <td className="py-2 px-3 font-medium text-zinc-600 border-r border-zinc-200">
                        {index + 1}.
                      </td>
                      <td className="py-2 px-3 font-bold text-indigo-950 font-mono border-r border-zinc-200">
                        {code}
                      </td>
                      <td className="py-2 px-3 text-zinc-800 border-r border-zinc-200">
                        {cInfo ? cInfo.title : 'Course Curriculum Module'}
                      </td>
                      <td className="py-2 px-3 text-center text-zinc-700 font-semibold border-r border-zinc-200">
                        {cInfo ? cInfo.credits : 6}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-800 font-bold text-[11px]">
                        ✓ Physical Handwritten Script Received
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedReceiptRecord.remarks && (
            <div className="mt-3 text-[11px] text-zinc-600 bg-zinc-50 p-2 rounded border border-zinc-200">
              <span className="font-bold text-zinc-800">Desk Verification Remarks: </span>
              {selectedReceiptRecord.remarks}
            </div>
          )}

          {/* Important Notices for the Learner */}
          <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-[11px] text-amber-900">
            <div className="font-bold flex items-center gap-1 text-amber-950 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>IMPORTANT STATUTORY INSTRUCTIONS FOR THE LEARNER:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-950 leading-relaxed text-[10px]">
              <li>Retain this official computer-generated acknowledgment slip until assignment marks reflect on your IGNOU Grade Card.</li>
              <li>Assignments carry 30% weightage in continuous evaluation. Minimum passing mark in assignment is 40% (Grade D).</li>
              <li>In case of discrepancy, produce this original token receipt at Study Centre 2033 coordinator desk.</li>
            </ul>
          </div>

          {/* Sign-off Placeholder: Receiving Desk Official Signature & Seal */}
          <div className="mt-8 pt-4 border-t-2 border-dashed border-zinc-300 grid grid-cols-3 gap-4 text-xs items-end">
            <div>
              <div className="text-zinc-500 text-[10px] uppercase font-bold">Counter Received By</div>
              <div className="font-bold text-zinc-900 text-xs mt-0.5">{selectedReceiptRecord.registeredBy}</div>
              <div className="text-[10px] text-zinc-500">{settings.institutionName || "S.D. Jain Girls' College, Dimapur"} ({settings.centreCode})</div>
            </div>

            <div className="text-center relative">
              {/* Simulated Stamp Seal */}
              <div className="w-36 h-16 mx-auto border-2 border-indigo-900 text-indigo-900 rounded-lg p-1 flex flex-col items-center justify-center text-[9px] font-black uppercase tracking-wider rotate-[-4deg] bg-indigo-50/40">
                <span>IGNOU {settings.centreCode}</span>
                <span className="text-[8px] font-bold text-indigo-800">VERIFIED & RECEIVED</span>
                <span className="text-[7px] text-indigo-600 font-mono">{formatDate(selectedReceiptRecord.submissionDate)}</span>
                <span className="text-[7px] text-indigo-900 font-semibold">{settings.coordinatorName || 'Dr. Sant K. Gupta'}</span>
              </div>
              <div className="text-[10px] font-bold text-zinc-700 mt-1">Study Centre Official Stamp</div>
            </div>

            <div className="text-right">
              <div className="w-40 ml-auto border-b-2 border-zinc-900 mb-1"></div>
              <div className="font-black text-zinc-950 text-xs">{settings.coordinatorName || 'Dr. Sant K. Gupta'}</div>
              <div className="text-[10px] text-zinc-500">{settings.coordinatorDesignation || 'Coordinator, IGNOU SC-2033'}</div>
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

