import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { RemunerationBill, Evaluator } from '../types';
import { formatCurrency, formatDate, amountToIndianWords, maskAccountNumber, maskPAN } from '../utils/helpers';
import { postGenerateClaimPdf } from '../services/sheetsService';
import { IGNOU_PROGRAMMES } from '../data/ignouMasterData';
import {
  Receipt,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  Printer,
  DollarSign,
  Plus,
  Lock,
  Building,
  CheckCircle,
  AlertCircle,
  Sparkles,
  UserCheck,
  CreditCard,
  Building2,
  Layers,
  FileText,
  Calculator,
  Download,
  Info,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface EvaluatorClaimDraft {
  evaluator: Evaluator;
  totalAllotted: number;
  totalEvaluated: number;
  totalLocked: number;
  courseBreakdown: { courseCode: string; count: number; title: string }[];
  ratePerScript: number;
  scriptAmount: number;
  conveyanceAmount: number;
  grossAmount: number;
}

export const RemunerationBilling: React.FC = () => {
  const {
    currentSession,
    sessionBills,
    evaluators,
    settings,
    updateSettings,
    generateBill,
    sanctionBill,
    disburseBill,
    isAdmin,
    setRole,
    sessionCourseEvaluations,
  } = useApp();

  // Selected bill for viewing/printing official F&AD voucher
  const [selectedPrintBill, setSelectedPrintBill] = useState<RemunerationBill | null>(null);

  // Active Statutory Claim Bill Generator Modal
  const [activeClaimDraft, setActiveClaimDraft] = useState<EvaluatorClaimDraft | null>(null);
  const [draftRate, setDraftRate] = useState<number>(settings.remunerationRatePerScript || 27.50);
  const [includeConveyance, setIncludeConveyance] = useState<boolean>(true);
  const [customBillNotes, setCustomBillNotes] = useState<string>('');

  // Editable global rate in admin mode
  const [isEditingRate, setIsEditingRate] = useState<boolean>(false);
  const [tempRate, setTempRate] = useState<number>(settings.remunerationRatePerScript || 27.50);
  const [isGeneratingClaimPdf, setIsGeneratingClaimPdf] = useState<boolean>(false);

  // If in Desk Official mode, display the strict RBAC restriction screen
  if (!isAdmin) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800 tracking-wider">
          Role-Based Access Control (RBAC)
        </span>
        <h2 className="text-xl font-bold text-zinc-900 mt-3">
          Evaluator Remuneration & Claim Billing Restricted
        </h2>
        <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto leading-relaxed">
          As a <strong>Desk Official</strong>, your role permissions are strictly confined to student intake registration, acknowledgment receipt generation, and marks entry.
          Billing rate overrides, remuneration voucher computation, and financial sanctioning require <strong>Coordinator (Admin)</strong> authorization.
        </p>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setRole('ADMIN')}
            className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <span>Switch to Coordinator (Admin) Mode</span>
          </button>
        </div>
      </div>
    );
  }

  // Course title lookup helper
  const getCourseTitle = (courseCode: string): string => {
    for (const prog of IGNOU_PROGRAMMES) {
      const c = prog.courses.find((x) => x.code === courseCode);
      if (c) return c.title;
    }
    return `${courseCode} Assignment`;
  };

  // Live Evaluator Script Counter & Claim Calculation
  const evaluatorClaimCards = useMemo(() => {
    const rate = settings.remunerationRatePerScript || 27.50;

    return evaluators.map((ev) => {
      // Find all course evaluations in currentSession assigned to this evaluator
      const assigned = sessionCourseEvaluations.filter((e) => e.evaluatorId === ev.id);
      const evaluated = assigned.filter((e) => e.marks !== null);
      const locked = assigned.filter((e) => e.isLocked);

      // Group by course code
      const courseMap = new Map<string, number>();
      evaluated.forEach((e) => {
        courseMap.set(e.courseCode, (courseMap.get(e.courseCode) || 0) + 1);
      });

      const courseBreakdown = Array.from(courseMap.entries()).map(([courseCode, count]) => ({
        courseCode,
        count,
        title: getCourseTitle(courseCode),
      }));

      const scriptAmount = evaluated.length * rate;
      const conveyanceAmount = evaluated.length > 0 ? settings.conveyanceAllowancePerPacket : 0;
      const grossAmount = scriptAmount + conveyanceAmount;

      return {
        evaluator: ev,
        totalAllotted: assigned.length,
        totalEvaluated: evaluated.length,
        totalLocked: locked.length,
        courseBreakdown,
        ratePerScript: rate,
        scriptAmount,
        conveyanceAmount,
        grossAmount,
      };
    });
  }, [evaluators, sessionCourseEvaluations, settings.remunerationRatePerScript, settings.conveyanceAllowancePerPacket]);

  // Overall financial summary
  const totalSanctionedAmount = sessionBills
    .filter((b) => b.sanctionStatus === 'Sanctioned' || b.sanctionStatus === 'Disbursed')
    .reduce((sum, b) => sum + b.grossAmount, 0);

  const totalPendingAmount = sessionBills
    .filter((b) => b.sanctionStatus === 'Draft')
    .reduce((sum, b) => sum + b.grossAmount, 0);

  const totalEvaluatedScriptsAcrossCentre = evaluatorClaimCards.reduce(
    (sum, c) => sum + c.totalEvaluated,
    0
  );

  // Open Statutory Claim Bill Generator
  const handleOpenClaimModal = (claim: EvaluatorClaimDraft) => {
    setDraftRate(settings.remunerationRatePerScript || 27.50);
    setIncludeConveyance(true);
    setCustomBillNotes('');
    setActiveClaimDraft(claim);
  };

  // Submit and save statutory bill to sessionBills
  const handleSaveStatutoryBill = () => {
    if (!activeClaimDraft) return;
    const ev = activeClaimDraft.evaluator;
    const courses = activeClaimDraft.courseBreakdown.map((c) => c.courseCode);
    const count = activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1;

    const newBill = generateBill(ev.id, courses, count, draftRate);
    setActiveClaimDraft(null);
    setSelectedPrintBill(newBill);
  };

  // Update global rate multiplier
  const handleSaveRate = () => {
    if (tempRate <= 0) return;
    updateSettings({ remunerationRatePerScript: tempRate });
    setIsEditingRate(false);
  };

  // 4. Download Statutory Claim Bill PDF: calls action "GENERATE_CLAIM_PDF" and opens URL in new tab
  const handleDownloadClaimPdf = async (customBillData?: any) => {
    setIsGeneratingClaimPdf(true);
    try {
      let payload;
      if (customBillData) {
        payload = {
          billNumber: customBillData.billNumber,
          evaluatorName: customBillData.evaluatorName,
          evaluatorCode: customBillData.evaluatorCode,
          courseCodes: customBillData.courseCodes,
          totalScripts: customBillData.totalScripts,
          ratePerScript: customBillData.ratePerScript,
          scriptAmount: customBillData.scriptAmount,
          conveyanceAmount: customBillData.conveyanceAmount,
          grossAmount: customBillData.grossAmount,
          session: customBillData.session || currentSession,
          centreCode: settings.centreCode,
        };
      } else if (activeClaimDraft) {
        payload = {
          evaluatorName: activeClaimDraft.evaluator.name,
          evaluatorCode: activeClaimDraft.evaluator.evaluatorCode,
          panNumber: activeClaimDraft.evaluator.panNumber,
          bankName: activeClaimDraft.evaluator.bankName,
          accountNumber: activeClaimDraft.evaluator.accountNumber,
          courseCodes: activeClaimDraft.courseBreakdown.map((c) => c.courseCode),
          totalScripts: activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1,
          ratePerScript: draftRate,
          conveyanceAmount: includeConveyance ? settings.conveyanceAllowancePerPacket : 0,
          grossAmount:
            (activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1) * draftRate +
            (includeConveyance ? settings.conveyanceAllowancePerPacket : 0),
          session: currentSession,
          centreCode: settings.centreCode,
        };
      } else if (sessionBills.length > 0) {
        const firstBill = sessionBills[0];
        payload = {
          billNumber: firstBill.billNumber,
          evaluatorName: firstBill.evaluatorName,
          evaluatorCode: firstBill.evaluatorCode,
          courseCodes: firstBill.courseCodes,
          totalScripts: firstBill.totalScripts,
          ratePerScript: firstBill.ratePerScript,
          scriptAmount: firstBill.scriptAmount,
          conveyanceAmount: firstBill.conveyanceAmount,
          grossAmount: firstBill.grossAmount,
          session: firstBill.session || currentSession,
          centreCode: settings.centreCode,
        };
      } else {
        payload = {
          evaluatorName: evaluators[0]?.name || 'Approved Academic Counsellor',
          evaluatorCode: evaluators[0]?.evaluatorCode || 'SC-2033',
          courseCodes: ['ALL COURSES'],
          totalScripts: totalEvaluatedScriptsAcrossCentre || 1,
          ratePerScript: settings.remunerationRatePerScript,
          conveyanceAmount: settings.conveyanceAllowancePerPacket,
          grossAmount:
            (totalEvaluatedScriptsAcrossCentre || 1) * settings.remunerationRatePerScript +
            settings.conveyanceAllowancePerPacket,
          session: currentSession,
          centreCode: settings.centreCode,
        };
      }

      const downloadUrl = await postGenerateClaimPdf(payload);
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to generate Statutory Claim Bill PDF:', err);
    } finally {
      setIsGeneratingClaimPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Stage 4
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              Evaluator_Remuneration_Claim_Billing
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Cycle: {currentSession}
            </span>
          </div>
          <h2 className="text-xl font-black text-zinc-900 tracking-tight mt-1">
            Evaluator Remuneration & Statutory Claim Billing Engine
          </h2>
          <p className="text-xs text-zinc-600 mt-1 max-w-2xl">
            Live answer script counter per academic counsellor with automatic ₹27.50 statutory rate
            multiplier, gross claim computation, and official IGNOU Finance & Accounts Division claim
            vouchers.
          </p>
        </div>

        {/* Actions & Global Rate Multiplier */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            id="btn-download-claim-bill-pdf"
            onClick={() => handleDownloadClaimPdf()}
            disabled={isGeneratingClaimPdf}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            title="Download Statutory Claim Bill PDF via Google Sheets GENERATE_CLAIM_PDF"
          >
            {isGeneratingClaimPdf ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Statutory Claim Bill PDF</span>
              </>
            )}
          </button>

          {/* Global Rate Multiplier Card with inline edit */}
          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl">
          <div className="text-left">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
              Statutory Rate Multiplier
            </span>
            {isEditingRate ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold text-zinc-700">₹</span>
                <input
                  type="number"
                  step="0.50"
                  min="1"
                  value={tempRate}
                  onChange={(e) => setTempRate(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-0.5 bg-white border border-indigo-400 rounded text-xs font-bold text-zinc-900"
                />
                <button
                  onClick={handleSaveRate}
                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingRate(false)}
                  className="px-1.5 py-0.5 text-zinc-500 hover:text-zinc-700 text-[11px]"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg font-black text-indigo-950 font-mono">
                  {formatCurrency(settings.remunerationRatePerScript || 27.50)}
                </span>
                <span className="text-xs text-zinc-500 font-medium">/ copy</span>
                <button
                  onClick={() => {
                    setTempRate(settings.remunerationRatePerScript || 27.50);
                    setIsEditingRate(true);
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Edit Rate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block">
            Approved Rate per Script
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-zinc-950">
              {formatCurrency(settings.remunerationRatePerScript || 27.50)}
            </span>
            <span className="text-xs text-zinc-500">per copy</span>
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            IGNOU Finance & Accounts Division Norms
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block">
            Live Evaluated Scripts
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-indigo-950">
              {totalEvaluatedScriptsAcrossCentre}
            </span>
            <span className="text-xs text-zinc-500">scripts ready</span>
          </div>
          <span className="text-[11px] text-indigo-600 mt-1 block font-medium">
            Across {evaluators.length} Academic Counsellors
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block">
            Sanctioned Amount ({currentSession})
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">
              {formatCurrency(totalSanctionedAmount)}
            </span>
          </div>
          <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
            Signed off by {settings.coordinatorName}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block">
            Pending Sanction
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-600">
              {formatCurrency(totalPendingAmount)}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Draft Bills awaiting Coordinator order
          </span>
        </div>
      </div>

      {/* STAGE 4: LIVE EVALUATOR SCRIPT COUNTER & STATUTORY CLAIM GENERATOR TABLE */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-xs text-zinc-800 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-600" />
              <span>Live Evaluator Script Counter & Gross Claim Calculation</span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Real-time script counters from 2_Course_Evaluation_Master multiplied by statutory rate (
              {formatCurrency(settings.remunerationRatePerScript || 27.50)})
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-600">
            <span>Cycle: </span>
            <strong className="text-zinc-950 font-bold">{currentSession}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-zinc-100/80 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr>
                <th className="py-3 px-4">Academic Evaluator</th>
                <th className="py-3 px-4">Designation & Institution</th>
                <th className="py-3 px-4">Bank / IFSC (Statutory)</th>
                <th className="py-3 px-4">Course Breakdown</th>
                <th className="py-3 px-4 text-center">Live Scripts</th>
                <th className="py-3 px-4 text-right">Rate / Copy</th>
                <th className="py-3 px-4 text-right">Gross Claim</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {evaluatorClaimCards.map((claim) => {
                const ev = claim.evaluator;
                const hasEvaluated = claim.totalEvaluated > 0;

                return (
                  <tr key={ev.id} className="hover:bg-zinc-50/70 transition">
                    {/* Evaluator name & code */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-zinc-900">{ev.name}</div>
                      <div className="font-mono text-[11px] text-indigo-900 font-semibold flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200">
                          {ev.evaluatorCode}
                        </span>
                        <span className="text-zinc-400 font-normal">PAN: {maskPAN(ev.panNumber)}</span>
                      </div>
                    </td>

                    {/* Designation & Institution */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-zinc-800">{ev.designation}</div>
                      <div className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                        {ev.collegeInstitution}
                      </div>
                    </td>

                    {/* Bank Details */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-semibold text-zinc-900 text-[11px]">
                        {ev.bankName}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Acc: {maskAccountNumber(ev.accountNumber)}
                      </div>
                      <div className="text-[10px] text-zinc-600 font-bold">
                        IFSC: {ev.ifscCode}
                      </div>
                    </td>

                    {/* Course Breakdown */}
                    <td className="py-3.5 px-4">
                      {claim.courseBreakdown.length === 0 ? (
                        <span className="text-zinc-400 italic">No evaluated courses yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {claim.courseBreakdown.map((cb) => (
                            <span
                              key={cb.courseCode}
                              className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200"
                              title={`${cb.title} (${cb.count} scripts)`}
                            >
                              {cb.courseCode}: <strong>{cb.count}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Live Script Counter */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={`font-mono font-black text-sm ${
                            hasEvaluated ? 'text-indigo-950' : 'text-zinc-400'
                          }`}
                        >
                          {claim.totalEvaluated}
                        </span>
                        <div className="text-[10px] text-zinc-500 font-medium">
                          {claim.totalLocked} locked / {claim.totalAllotted} total
                        </div>
                      </div>
                    </td>

                    {/* Rate Multiplier */}
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-zinc-800">
                      {formatCurrency(claim.ratePerScript)}
                    </td>

                    {/* Gross Claim */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-mono font-black text-sm text-indigo-950">
                        {formatCurrency(claim.scriptAmount)}
                      </div>
                      {claim.conveyanceAmount > 0 && (
                        <div className="text-[10px] text-zinc-500">
                          + {formatCurrency(claim.conveyanceAmount)} conv.
                        </div>
                      )}
                    </td>

                    {/* Action: Generate Statutory Claim Bill */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenClaimModal(claim)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer shadow-2xs ${
                          hasEvaluated
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300'
                        }`}
                        title="Generate statutory claim bill compliant with IGNOU Finance & Accounts Division format"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Generate Claim Bill</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* HISTORIC SANCTIONED BILLS REGISTER */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
          <div className="font-bold text-xs text-zinc-800 uppercase tracking-wider">
            Sanction Vouchers Register ({sessionBills.length} Bills in {currentSession})
          </div>
          <span className="text-[11px] text-zinc-500">
            Study Centre: <strong>SC-2033</strong> • Coordinator Signatory: <strong>{settings.coordinatorName}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr>
                <th className="py-3 px-4">Bill No / Date</th>
                <th className="py-3 px-4">Evaluator Details</th>
                <th className="py-3 px-4">Courses Evaluated</th>
                <th className="py-3 px-4 text-center">Scripts</th>
                <th className="py-3 px-4 text-right">Script Fee</th>
                <th className="py-3 px-4 text-right">Conveyance</th>
                <th className="py-3 px-4 text-right">Gross Amount</th>
                <th className="py-3 px-4 text-center">Sanction Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {sessionBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-zinc-400">
                    No remuneration bills computed yet for {currentSession}. Click "Generate Claim Bill" above to compute.
                  </td>
                </tr>
              ) : (
                sessionBills.map((bill) => {
                  const ev = evaluators.find((e) => e.id === bill.evaluatorId);
                  return (
                    <tr key={bill.id} className="hover:bg-zinc-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-indigo-950 text-xs">
                          {bill.billNumber}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {bill.sanctionedDate ? formatDate(bill.sanctionedDate) : 'Draft Voucher'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900">{bill.evaluatorName}</div>
                        <div className="font-mono text-[11px] text-zinc-500">
                          {bill.evaluatorCode} {ev ? `• ${ev.bankName}` : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {bill.courseCodes.map((c) => (
                            <span
                              key={c}
                              className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-zinc-900">
                        {bill.totalScripts}
                        <div className="text-[10px] text-zinc-400 font-normal">
                          @{formatCurrency(bill.ratePerScript)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-zinc-800">
                        {formatCurrency(bill.scriptAmount)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-zinc-800">
                        {formatCurrency(bill.conveyanceAmount)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-sm text-indigo-950">
                        {formatCurrency(bill.grossAmount)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            bill.sanctionStatus === 'Sanctioned'
                              ? 'bg-emerald-100 text-emerald-800'
                              : bill.sanctionStatus === 'Disbursed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {bill.sanctionStatus === 'Sanctioned' && <CheckCircle className="w-3 h-3" />}
                          {bill.sanctionStatus}
                        </span>
                        {bill.sanctionedBy && (
                          <div className="text-[9px] text-zinc-400 mt-0.5 max-w-[120px] mx-auto truncate">
                            {bill.sanctionedBy}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {bill.sanctionStatus === 'Draft' && (
                            <button
                              onClick={() => sanctionBill(bill.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                              title="Sanction remuneration bill as Study Centre Coordinator"
                            >
                              <ShieldCheck className="w-3 h-3 text-amber-300" />
                              <span>Sanction</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedPrintBill(bill)}
                            className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Voucher</span>
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

      {/* STATUTORY EVALUATOR CLAIM BILL GENERATION MODAL (IGNOU FINANCE & ACCOUNTS DIVISION FORMAT) */}
      {activeClaimDraft && (
        <div className="fixed inset-0 bg-zinc-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto">
            {/* Modal Top Control Bar */}
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">
                  Statutory Evaluator Claim Bill (IGNOU F&AD Compliant)
                </h3>
              </div>
              <button
                onClick={() => setActiveClaimDraft(null)}
                className="text-zinc-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Editable Configuration Header */}
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                  Rate Per Answer Script (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={draftRate}
                  onChange={(e) => setDraftRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg font-bold text-zinc-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                  Fixed Conveyance Allowance
                </label>
                <label className="flex items-center gap-2 py-1.5 cursor-pointer text-zinc-800">
                  <input
                    type="checkbox"
                    checked={includeConveyance}
                    onChange={(e) => setIncludeConveyance(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Include ₹{settings.conveyanceAllowancePerPacket} Allowance</span>
                </label>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                  Calculation Summary
                </label>
                <div className="py-1 font-mono font-bold text-indigo-950 text-sm">
                  {formatCurrency(
                    (activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1) *
                      draftRate +
                      (includeConveyance ? settings.conveyanceAllowancePerPacket : 0)
                  )}
                </div>
              </div>
            </div>

            {/* STATUTORY BILL PREVIEW (Compliant with IGNOU Finance & Accounts Division) */}
            <div className="p-6 md:p-8 max-h-[65vh] overflow-y-auto space-y-5 bg-white">
              {/* Institution & Form Header */}
              <div className="text-center space-y-1 pb-3 border-b-2 border-zinc-900">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider font-serif text-zinc-950">
                  INDIRA GANDHI NATIONAL OPEN UNIVERSITY
                </h2>
                <div className="text-xs font-bold uppercase text-zinc-800">
                  FINANCE & ACCOUNTS DIVISION • MAIDAN GARHI, NEW DELHI - 110068
                </div>
                <div className="text-xs font-bold text-indigo-950 underline underline-offset-2">
                  FORM OF BILL FOR CLAIMING REMUNERATION FOR EVALUATION OF ASSIGNMENT PAPERS
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Study Centre: {settings.centreCode} ({settings.centreName}) • Session:{' '}
                  {currentSession.toUpperCase()}
                </div>
              </div>

              {/* Evaluator Statutory Profile Details Grid */}
              <div className="grid grid-cols-2 gap-3 border border-zinc-800 p-3.5 rounded-lg text-xs bg-zinc-50/50">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                    1. Name of the Evaluator (In Capital)
                  </span>
                  <span className="font-bold text-zinc-950 text-sm">
                    {activeClaimDraft.evaluator.name.toUpperCase()}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                    2. Evaluator Registration Code
                  </span>
                  <span className="font-mono font-bold text-indigo-950">
                    {activeClaimDraft.evaluator.evaluatorCode}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                    3. Academic Designation & Institution
                  </span>
                  <span className="text-zinc-800 font-medium">
                    {activeClaimDraft.evaluator.designation}, {activeClaimDraft.evaluator.collegeInstitution}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                    4. Permanent Account Number (PAN)
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {activeClaimDraft.evaluator.panNumber}
                  </span>
                </div>

                <div className="col-span-2 pt-2 border-t border-zinc-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                      5. Bank Name & Branch
                    </span>
                    <span className="font-semibold text-zinc-900">
                      {activeClaimDraft.evaluator.bankName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                      6. Bank Account Number
                    </span>
                    <span className="font-mono font-bold text-zinc-900">
                      {activeClaimDraft.evaluator.accountNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                      7. IFSC Code
                    </span>
                    <span className="font-mono font-bold text-zinc-900">
                      {activeClaimDraft.evaluator.ifscCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Course Breakdown Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-2">
                  Course-Wise Script Count & Remuneration Computation:
                </h4>
                <table className="w-full text-xs text-left border-collapse border border-zinc-900">
                  <thead className="bg-zinc-100 border-b border-zinc-900 text-zinc-800 font-bold">
                    <tr>
                      <th className="p-2 border border-zinc-400 w-10 text-center">S.No</th>
                      <th className="p-2 border border-zinc-400 w-28">Course Code</th>
                      <th className="p-2 border border-zinc-400">Course Nomenclature / Title</th>
                      <th className="p-2 border border-zinc-400 text-center w-24">
                        Scripts Evaluated
                      </th>
                      <th className="p-2 border border-zinc-400 text-right w-24">Rate / Copy</th>
                      <th className="p-2 border border-zinc-400 text-right w-28">Total Claim (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeClaimDraft.courseBreakdown.length === 0 ? (
                      <tr>
                        <td className="p-2 border border-zinc-400 text-center">1</td>
                        <td className="p-2 border border-zinc-400 font-mono font-bold">
                          {activeClaimDraft.evaluator.eligibleCourses[0] || 'ASSIGNMENT'}
                        </td>
                        <td className="p-2 border border-zinc-400">
                          {getCourseTitle(activeClaimDraft.evaluator.eligibleCourses[0] || 'ASSIGNMENT')}
                        </td>
                        <td className="p-2 border border-zinc-400 text-center font-mono font-bold">
                          {activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1}
                        </td>
                        <td className="p-2 border border-zinc-400 text-right font-mono">
                          {formatCurrency(draftRate)}
                        </td>
                        <td className="p-2 border border-zinc-400 text-right font-mono font-bold">
                          {formatCurrency(
                            (activeClaimDraft.totalEvaluated > 0
                              ? activeClaimDraft.totalEvaluated
                              : 1) * draftRate
                          )}
                        </td>
                      </tr>
                    ) : (
                      activeClaimDraft.courseBreakdown.map((cb, idx) => (
                        <tr key={cb.courseCode}>
                          <td className="p-2 border border-zinc-400 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="p-2 border border-zinc-400 font-mono font-bold">
                            {cb.courseCode}
                          </td>
                          <td className="p-2 border border-zinc-400">{cb.title}</td>
                          <td className="p-2 border border-zinc-400 text-center font-mono font-bold">
                            {cb.count}
                          </td>
                          <td className="p-2 border border-zinc-400 text-right font-mono">
                            {formatCurrency(draftRate)}
                          </td>
                          <td className="p-2 border border-zinc-400 text-right font-mono font-bold">
                            {formatCurrency(cb.count * draftRate)}
                          </td>
                        </tr>
                      ))
                    )}
                    {/* Fixed Conveyance row */}
                    {includeConveyance && (
                      <tr className="bg-zinc-50 font-semibold">
                        <td
                          colSpan={5}
                          className="p-2 border border-zinc-400 text-right text-zinc-700"
                        >
                          Fixed Conveyance Allowance (Study Centre Delivery):
                        </td>
                        <td className="p-2 border border-zinc-400 text-right font-mono text-zinc-950">
                          {formatCurrency(settings.conveyanceAllowancePerPacket)}
                        </td>
                      </tr>
                    )}
                    {/* Grand Total Row */}
                    <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-900">
                      <td colSpan={3} className="p-2.5 border border-zinc-400 uppercase">
                        Gross Payable Remuneration
                      </td>
                      <td className="p-2.5 border border-zinc-400 text-center font-mono font-black text-sm">
                        {activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1}
                      </td>
                      <td className="p-2.5 border border-zinc-400 text-right text-zinc-500 font-normal">
                        Total
                      </td>
                      <td className="p-2.5 border border-zinc-400 text-right font-mono font-black text-base text-indigo-950">
                        {formatCurrency(
                          (activeClaimDraft.totalEvaluated > 0
                            ? activeClaimDraft.totalEvaluated
                            : 1) *
                            draftRate +
                            (includeConveyance ? settings.conveyanceAllowancePerPacket : 0)
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="p-3 bg-zinc-50 border border-zinc-300 rounded text-xs font-semibold">
                <span className="text-zinc-500 font-normal">Total Amount in Words: </span>
                <span className="font-mono text-zinc-900 font-bold">
                  {amountToIndianWords(
                    (activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1) *
                      draftRate +
                      (includeConveyance ? settings.conveyanceAllowancePerPacket : 0)
                  )}
                </span>
              </div>

              {/* Statutory Certification Undertaking */}
              <div className="border border-zinc-900 p-4 rounded-lg space-y-2 bg-amber-50/20">
                <div className="text-[11px] font-bold uppercase text-zinc-900 tracking-wider">
                  STATUTORY CERTIFICATION UNDERTAKING BY EVALUATOR
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed italic">
                  "Certified that the assignment response sheets of the candidates listed above have
                  been personally evaluated by me strictly according to the evaluation guidelines and
                  marking scheme provided by Indira Gandhi National Open University. The marks/grades
                  awarded have been accurately entered into the official university award list without
                  any omission or unauthorized assistance. I further certify that I have not preferred
                  any other claim for this evaluation work earlier, and shall refund any excess payment
                  if noticed later."
                </p>
                <div className="pt-4 flex justify-between items-end text-xs">
                  <div>
                    <span className="text-zinc-500">Date of Claim: </span>
                    <strong className="font-mono">{formatDate(new Date().toISOString())}</strong>
                  </div>
                  <div className="text-center">
                    <div className="font-serif italic font-bold text-zinc-900">
                      {activeClaimDraft.evaluator.name}
                    </div>
                    <div className="border-t border-zinc-400 pt-1 text-[11px] font-bold text-zinc-800">
                      Signature of Academic Counsellor
                    </div>
                  </div>
                </div>
              </div>

              {/* Study Centre Verification & Payment Order */}
              <div className="border border-zinc-400 p-4 rounded-lg space-y-3 bg-zinc-50/60 text-xs">
                <div className="text-[11px] font-bold uppercase text-zinc-800">
                  VERIFICATION & PAYMENT ORDER (FOR STUDY CENTRE USE ONLY)
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Certified that the evaluation award sheets have been cross-verified with physical
                  scripts and logged in the 2_Course_Evaluation_Master register.
                </p>
                <div className="font-mono font-bold text-zinc-900 bg-white p-2 border border-zinc-200 rounded">
                  Passed for payment of{' '}
                  {formatCurrency(
                    (activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1) *
                      draftRate +
                      (includeConveyance ? settings.conveyanceAllowancePerPacket : 0)
                  )}{' '}
                  (
                  {amountToIndianWords(
                    (activeClaimDraft.totalEvaluated > 0 ? activeClaimDraft.totalEvaluated : 1) *
                      draftRate +
                      (includeConveyance ? settings.conveyanceAllowancePerPacket : 0)
                  )}
                  ) to {activeClaimDraft.evaluator.name}.
                </div>

                <div className="pt-2 flex justify-between items-end">
                  <div className="text-[10px] text-zinc-500">
                    Station: Study Centre {settings.centreCode}
                  </div>
                  <div className="text-center">
                    <div className="font-serif italic text-indigo-950 font-bold">
                      {settings.coordinatorName}
                    </div>
                    <div className="border-t border-zinc-400 pt-0.5 font-bold text-zinc-900">
                      Coordinator Signature & Institutional Seal
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-zinc-100 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setActiveClaimDraft(null)}
                className="px-4 py-2 text-zinc-600 hover:bg-zinc-200 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadClaimPdf()}
                  disabled={isGeneratingClaimPdf}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Download Statutory Claim Bill PDF via Google Sheets GENERATE_CLAIM_PDF"
                >
                  {isGeneratingClaimPdf ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Statutory Claim Bill PDF</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Preview</span>
                </button>

                <button
                  onClick={handleSaveStatutoryBill}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Record & Sanction Claim Bill</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE REMUNERATION VOUCHER MODAL */}
      {selectedPrintBill && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-zinc-300 overflow-hidden my-auto print:m-0 print:border-none print:shadow-none print:w-full">
            <div className="px-5 py-3 bg-zinc-900 text-white flex items-center justify-between print:hidden">
              <span className="text-xs font-semibold">
                Remuneration Bill Voucher ({selectedPrintBill.billNumber})
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownloadClaimPdf(selectedPrintBill)}
                  disabled={isGeneratingClaimPdf}
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Download Statutory Claim Bill PDF via Google Sheets GENERATE_CLAIM_PDF"
                >
                  {isGeneratingClaimPdf ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download Statutory Claim Bill PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Voucher
                </button>
                <button
                  onClick={() => setSelectedPrintBill(null)}
                  className="text-zinc-400 hover:text-white text-xs font-bold px-2 py-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-4 text-xs font-sans">
              {/* Header */}
              <div className="text-center pb-3 border-b-2 border-zinc-900">
                <h1 className="text-sm font-black uppercase tracking-wider font-serif">
                  INDIRA GANDHI NATIONAL OPEN UNIVERSITY
                </h1>
                <h2 className="text-xs font-bold uppercase text-zinc-700">
                  FINANCE & ACCOUNTS DIVISION • MAIDAN GARHI, NEW DELHI
                </h2>
                <div className="text-xs font-bold text-indigo-950 mt-1">
                  OFFICIAL REMUNERATION VOUCHER
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  Study Centre: {settings.centreCode} • Session: {selectedPrintBill.session}
                </div>
              </div>

              {/* Bill Details */}
              <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Bill Number</span>
                  <span className="font-mono font-bold text-indigo-950 text-xs">{selectedPrintBill.billNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Sanction Date</span>
                  <span className="font-semibold text-zinc-800">
                    {selectedPrintBill.sanctionedDate ? formatDate(selectedPrintBill.sanctionedDate) : 'Pending Sanction'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Evaluator Name</span>
                  <span className="font-bold text-zinc-900">{selectedPrintBill.evaluatorName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Evaluator Code</span>
                  <span className="font-mono font-semibold text-zinc-700">{selectedPrintBill.evaluatorCode}</span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full border-collapse border border-zinc-400 text-xs">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-400 text-zinc-800 font-semibold">
                    <th className="p-2 border border-zinc-400">Particulars</th>
                    <th className="p-2 border border-zinc-400 text-center">Courses</th>
                    <th className="p-2 border border-zinc-400 text-center">Scripts</th>
                    <th className="p-2 border border-zinc-400 text-right">Rate</th>
                    <th className="p-2 border border-zinc-400 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-zinc-400 font-medium">Assignment Evaluation Fee</td>
                    <td className="p-2 border border-zinc-400 text-center font-mono">{selectedPrintBill.courseCodes.join(', ')}</td>
                    <td className="p-2 border border-zinc-400 text-center font-mono font-bold">{selectedPrintBill.totalScripts}</td>
                    <td className="p-2 border border-zinc-400 text-right font-mono">{formatCurrency(selectedPrintBill.ratePerScript)}</td>
                    <td className="p-2 border border-zinc-400 text-right font-mono font-semibold">{formatCurrency(selectedPrintBill.scriptAmount)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="p-2 border border-zinc-400 text-right text-zinc-600">Fixed Conveyance Allowance:</td>
                    <td className="p-2 border border-zinc-400 text-right font-mono">{formatCurrency(selectedPrintBill.conveyanceAmount)}</td>
                  </tr>
                  <tr className="bg-zinc-100 font-bold border-t border-zinc-400">
                    <td colSpan={4} className="p-2 border border-zinc-400 uppercase">Gross Sanctioned Amount:</td>
                    <td className="p-2 border border-zinc-400 text-right font-mono text-sm text-indigo-950 font-black">{formatCurrency(selectedPrintBill.grossAmount)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded text-xs">
                <span className="text-zinc-500 font-medium">Amount in Words: </span>
                <span className="font-mono font-bold text-zinc-900">{amountToIndianWords(selectedPrintBill.grossAmount)}</span>
              </div>

              {/* Signatures */}
              <div className="pt-8 flex justify-between items-end border-t border-dashed border-zinc-300">
                <div className="text-center">
                  <div className="font-serif italic text-zinc-700">{selectedPrintBill.evaluatorName}</div>
                  <div className="border-t border-zinc-400 pt-1 font-bold text-zinc-900 text-[11px]">Evaluator Signature</div>
                </div>

                <div className="text-center">
                  <div className="font-serif italic text-indigo-950 font-bold">{settings.coordinatorName}</div>
                  <div className="border-t border-zinc-400 pt-1 font-bold text-zinc-900 text-[11px]">Coordinator SC-2033</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
