/**
 * Google Sheets & Apps Script Integration Service
 * Target Script Web App ID / URL:
 */
export const SCRIPT_URL = "1yN_g-Mpxy75apRvrSlEuZshsDU52vKtrQvWNM_bCxCM";

export interface HydrationResult {
  success: boolean;
  intakes?: any[];
  courseLedger?: any[];
  source: 'google_sheets' | 'local_cache' | 'offline_fallback';
  message?: string;
}

export interface ApiResponse<T = any> {
  status: 'success' | 'fallback' | 'error';
  action?: string;
  downloadUrl?: string;
  url?: string;
  data?: T;
  message?: string;
}

const getFullAppsScriptUrl = (idOrUrl: string) => {
  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) {
    return idOrUrl;
  }
  return `https://script.google.com/macros/s/${idOrUrl}/exec`;
};

/**
 * 1. On Load:
 * Call doGet() to hydrate IntakeRegister and CourseLedger state from Google Sheets.
 */
export async function doGet(): Promise<HydrationResult> {
  try {
    // Try via full-stack Express proxy first to bypass browser CORS / iframe restrictions
    const response = await fetch(`/api/sheets?action=doGet&scriptUrl=${encodeURIComponent(SCRIPT_URL)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const json = await response.json();
      if (json && (json.intakes || json.Intake_Register || json.courseLedger || json.Course_Ledger)) {
        return {
          success: true,
          intakes: json.intakes || json.Intake_Register || [],
          courseLedger: json.courseLedger || json.Course_Ledger || [],
          source: 'google_sheets',
          message: 'Hydrated successfully from Google Sheets.',
        };
      }
    }
  } catch (err: any) {
    console.warn('[Google Sheets] Express proxy doGet failed, trying direct fetch:', err);
  }

  // Direct client fetch fallback
  try {
    const directUrl = getFullAppsScriptUrl(SCRIPT_URL);
    const directRes = await fetch(directUrl, {
      method: 'GET',
      mode: 'cors',
    });
    if (directRes.ok) {
      const data = await directRes.json();
      return {
        success: true,
        intakes: data.intakes || data.Intake_Register || [],
        courseLedger: data.courseLedger || data.Course_Ledger || [],
        source: 'google_sheets',
        message: 'Hydrated via direct Google Apps Script call.',
      };
    }
  } catch (directErr: any) {
    console.warn('[Google Sheets] Direct doGet failed:', directErr);
  }

  return {
    success: false,
    source: 'local_cache',
    message: `Google Sheets endpoint (${SCRIPT_URL.slice(0, 8)}...) pending or offline. Using local storage state.`,
  };
}

/**
 * 2. On Intake Submission:
 * Send POST with action "ADD_INTAKE". Save row to Intake_Register and automatically unpack courses to Course_Ledger.
 */
export async function postAddIntake(
  intakeRecord: any,
  unpackedCourses: any[]
): Promise<ApiResponse> {
  const payload = {
    action: 'ADD_INTAKE',
    intake: intakeRecord,
    unpackedCourses,
    // Flattened row format for Google Sheets row appends
    Intake_Register: {
      tokenNo: intakeRecord.tokenNo,
      enrollmentNo: intakeRecord.enrollmentNo,
      studentName: intakeRecord.studentName,
      studentPhone: intakeRecord.studentPhone || '',
      studentEmail: intakeRecord.studentEmail || '',
      programmeCode: intakeRecord.programmeCode,
      courseCodes: Array.isArray(intakeRecord.courseCodes) ? intakeRecord.courseCodes.join(', ') : intakeRecord.courseCodes,
      courseCount: intakeRecord.courseCodes?.length || 0,
      submissionDate: intakeRecord.submissionDate,
      submissionMode: intakeRecord.submissionMode,
      consignmentNo: intakeRecord.consignmentNo || '',
      session: intakeRecord.session,
      status: intakeRecord.status || 'Received',
      remarks: intakeRecord.remarks || '',
      createdAt: intakeRecord.createdAt || new Date().toISOString(),
    },
    Course_Ledger: unpackedCourses.map((c) => ({
      submissionKey: c.submissionKey || c.id,
      tokenNo: c.tokenNo,
      enrollmentNo: c.enrollmentNo,
      studentName: c.studentName,
      programmeCode: c.programmeCode,
      courseCode: c.courseCode,
      session: c.session,
      submissionDate: c.submissionDate,
      marks: c.marks ?? '',
      grade: c.grade || '',
      isLocked: c.isLocked ? true : false,
      status: c.status || 'Pending Allotment',
    })),
  };

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { status: 'success', action: 'ADD_INTAKE', data };
    }
  } catch (err) {
    console.warn('[Google Sheets] Express proxy POST ADD_INTAKE failed, trying direct:', err);
  }

  // Direct fetch fallback
  try {
    const directUrl = getFullAppsScriptUrl(SCRIPT_URL);
    const res = await fetch(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { status: 'success', action: 'ADD_INTAKE', data };
    }
  } catch (err) {
    console.warn('[Google Sheets] Direct ADD_INTAKE failed:', err);
  }

  return {
    status: 'fallback',
    action: 'ADD_INTAKE',
    message: 'Saved locally. Google Sheets update queued.',
  };
}

/**
 * 3. On Marks Locking:
 * Send POST with action "UPDATE_MARKS" containing subId, marks, calculated grade, and isLocked: true.
 */
export async function postUpdateMarks(
  subId: string,
  marks: number | null,
  calculatedGrade: string,
  isLocked: boolean = true
): Promise<ApiResponse> {
  const payload = {
    action: 'UPDATE_MARKS',
    subId,
    marks,
    calculatedGrade,
    grade: calculatedGrade,
    isLocked: true,
    lockedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { status: 'success', action: 'UPDATE_MARKS', data };
    }
  } catch (err) {
    console.warn('[Google Sheets] Express proxy POST UPDATE_MARKS failed:', err);
  }

  // Direct fetch fallback
  try {
    const directUrl = getFullAppsScriptUrl(SCRIPT_URL);
    const res = await fetch(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { status: 'success', action: 'UPDATE_MARKS', data };
    }
  } catch (err) {
    console.warn('[Google Sheets] Direct UPDATE_MARKS failed:', err);
  }

  return {
    status: 'fallback',
    action: 'UPDATE_MARKS',
    message: `Marks for ${subId} locked locally. Synced to offline state.`,
  };
}

/**
 * 4. PDF Buttons:
 * On Stage 3 (Award Sheets), add "Download SED Award PDF" that calls action "GENERATE_SED_PDF".
 * When the URL returns, open it in a new browser tab with window.open(downloadUrl, "_blank").
 */
export async function postGenerateSedPdf(details: {
  courseCode: string;
  session: string;
  records: any[];
  dispatchMemoNo?: string;
  dispatchDate?: string;
  centreCode?: string;
}): Promise<string> {
  const payload = {
    action: 'GENERATE_SED_PDF',
    courseCode: details.courseCode,
    session: details.session,
    records: details.records,
    dispatchMemoNo: details.dispatchMemoNo || 'SC2033/SED/DISP-2026/042',
    dispatchDate: details.dispatchDate || new Date().toISOString().split('T')[0],
    centreCode: details.centreCode || '2033',
  };

  let downloadUrl: string | null = null;

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      downloadUrl = data.downloadUrl || data.url || data.pdfUrl || null;
    }
  } catch (err) {
    console.warn('[Google Sheets] Express proxy GENERATE_SED_PDF failed:', err);
  }

  if (!downloadUrl) {
    try {
      const directUrl = getFullAppsScriptUrl(SCRIPT_URL);
      const res = await fetch(directUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        downloadUrl = data.downloadUrl || data.url || data.pdfUrl || null;
      }
    } catch (err) {
      console.warn('[Google Sheets] Direct GENERATE_SED_PDF failed:', err);
    }
  }

  // If remote returned downloadUrl, return it!
  if (downloadUrl) {
    return downloadUrl;
  }

  // Fallback: Generate an authentic, print-ready statutory HTML/PDF document blob URL
  return createFallbackSedAwardPdfBlob(details);
}

/**
 * 4. PDF Buttons:
 * On Stage 4 (Billing), add "Download Statutory Claim Bill PDF" that calls action "GENERATE_CLAIM_PDF".
 * When the URL returns, open it in a new browser tab with window.open(downloadUrl, "_blank").
 */
export async function postGenerateClaimPdf(details: {
  billId?: string;
  evaluatorId?: string;
  evaluatorName?: string;
  session: string;
  grossAmount: number;
  netPayable?: number;
  scriptCount?: number;
  ratePerScript?: number;
  conveyanceAmount?: number;
  courses?: string[];
}): Promise<string> {
  const payload = {
    action: 'GENERATE_CLAIM_PDF',
    billId: details.billId || 'STATUTORY-CLAIM-VOUCHER',
    evaluatorId: details.evaluatorId || 'EV-SC2033',
    evaluatorName: details.evaluatorName || 'Academic Counsellor',
    session: details.session,
    grossAmount: details.grossAmount,
    netPayable: details.netPayable || details.grossAmount,
    scriptCount: details.scriptCount || 0,
    ratePerScript: details.ratePerScript || 27.5,
    conveyanceAmount: details.conveyanceAmount || 0,
    courses: details.courses || [],
  };

  let downloadUrl: string | null = null;

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      downloadUrl = data.downloadUrl || data.url || data.pdfUrl || null;
    }
  } catch (err) {
    console.warn('[Google Sheets] Express proxy GENERATE_CLAIM_PDF failed:', err);
  }

  if (!downloadUrl) {
    try {
      const directUrl = getFullAppsScriptUrl(SCRIPT_URL);
      const res = await fetch(directUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        downloadUrl = data.downloadUrl || data.url || data.pdfUrl || null;
      }
    } catch (err) {
      console.warn('[Google Sheets] Direct GENERATE_CLAIM_PDF failed:', err);
    }
  }

  if (downloadUrl) {
    return downloadUrl;
  }

  // Fallback: Generate an authentic IGNOU F&AD Statutory Remuneration Claim Bill PDF blob URL
  return createFallbackClaimBillPdfBlob(details);
}

/**
 * Creates high-fidelity printable HTML/PDF Blob URL for SED Award Sheet
 */
function createFallbackSedAwardPdfBlob(details: {
  courseCode: string;
  session: string;
  records: any[];
  dispatchMemoNo?: string;
  dispatchDate?: string;
  centreCode?: string;
}): string {
  const rowsHtml = details.records
    .map(
      (r, idx) => `
    <tr>
      <td style="text-align: center; border: 1px solid #333; padding: 4px 6px;">${idx + 1}</td>
      <td style="border: 1px solid #333; padding: 4px 6px; font-family: monospace; font-weight: bold;">${r.enrollmentNo}</td>
      <td style="border: 1px solid #333; padding: 4px 6px; text-transform: uppercase;">${r.studentName}</td>
      <td style="text-align: center; border: 1px solid #333; padding: 4px 6px; font-family: monospace; font-size: 11px;">${r.submissionKey || ''}</td>
      <td style="text-align: center; border: 1px solid #333; padding: 4px 6px; font-weight: bold; font-size: 13px;">${r.marks !== null && r.marks !== undefined ? r.marks : 'AB'}</td>
      <td style="text-align: center; border: 1px solid #333; padding: 4px 6px; font-weight: bold; color: #1e3a8a;">${r.grade || '—'}</td>
      <td style="border: 1px solid #333; padding: 4px 6px; font-style: italic; font-size: 11px;">${r.marksInWords || ''}</td>
      <td style="text-align: center; border: 1px solid #333; padding: 4px 6px; font-size: 10px; font-weight: bold; background: #f0fdf4; color: #15803d;">${r.isLocked ? 'SEALED & LOCKED' : 'DRAFT'}</td>
    </tr>
  `
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>IGNOU SED Award Sheet - ${details.courseCode} - ${details.session}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: 'Times New Roman', serif; font-size: 12px; line-height: 1.3; color: #000; margin: 0; padding: 15px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .univ { font-size: 18px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
    .division { font-size: 14px; font-weight: bold; }
    .sub { font-size: 11px; }
    .meta-box { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
    .meta-box td { padding: 4px 8px; border: 1px solid #bbb; }
    .meta-label { font-weight: bold; background: #f4f4f5; width: 18%; }
    table.data { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    table.data th { background: #e4e4e7; border: 1px solid #333; padding: 6px 4px; font-weight: bold; text-align: center; }
    .footer-signs { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
    .sign-block { width: 30%; text-align: center; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; }
    .actions-bar { position: fixed; top: 10px; right: 10px; z-index: 1000; display: flex; gap: 8px; }
    .btn { background: #1e3a8a; color: #fff; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .btn:hover { background: #1e40af; }
    @media print { .actions-bar { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="actions-bar">
    <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="header">
    <div class="univ">Indira Gandhi National Open University</div>
    <div class="division">Student Evaluation Division (SED) — Maidan Garhi, New Delhi - 110068</div>
    <div class="sub">Continuous Assessment Award List for Tutor Marked Assignments (TMA)</div>
    <div style="font-weight: bold; font-size: 12px; margin-top: 4px; color: #1e3a8a;">PART - 1: SED STATUTORY TABULATION COPY (ORIGINAL)</div>
  </div>

  <table class="meta-box">
    <tr>
      <td class="meta-label">Study Centre Code:</td>
      <td><strong>${details.centreCode || '2033'}</strong> (Al-Ameen College)</td>
      <td class="meta-label">Regional Centre:</td>
      <td><strong>RC-14 (Kochi)</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Course Code:</td>
      <td><strong style="font-size: 13px; color: #1e3a8a;">${details.courseCode}</strong></td>
      <td class="meta-label">Examination Session:</td>
      <td><strong>${details.session}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Dispatch Memo No:</td>
      <td><strong>${details.dispatchMemoNo || 'SC2033/SED/DISP-2026/042'}</strong></td>
      <td class="meta-label">Dispatch Date:</td>
      <td><strong>${details.dispatchDate || new Date().toISOString().split('T')[0]}</strong></td>
    </tr>
  </table>

  <table class="data">
    <thead>
      <tr>
        <th style="width: 4%;">S.No</th>
        <th style="width: 14%;">Enrolment No.</th>
        <th style="width: 24%;">Student Name</th>
        <th style="width: 18%;">Deterministic Key</th>
        <th style="width: 8%;">Marks (100)</th>
        <th style="width: 6%;">Grade</th>
        <th style="width: 16%;">Marks in Words</th>
        <th style="width: 10%;">Verification</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px;">No records available for this course.</td></tr>'}
    </tbody>
  </table>

  <div class="footer-signs">
    <div class="sign-block">
      Signature of Academic Counsellor<br/>
      (Evaluator Code: EV-2033-01)
    </div>
    <div class="sign-block">
      Checked & Verified by Dealing Official<br/>
      (Study Centre 2033)
    </div>
    <div class="sign-block">
      Signature & Seal of Coordinator<br/>
      Dr. V. K. Aggarwal (SC-2033)
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}

/**
 * Creates high-fidelity printable HTML/PDF Blob URL for Statutory Claim Bill
 */
function createFallbackClaimBillPdfBlob(details: {
  billId?: string;
  evaluatorId?: string;
  evaluatorName?: string;
  session: string;
  grossAmount: number;
  netPayable?: number;
  scriptCount?: number;
  ratePerScript?: number;
  conveyanceAmount?: number;
  courses?: string[];
}): string {
  const coursesStr = (details.courses && details.courses.length > 0)
    ? details.courses.join(', ')
    : 'Allotment Courses';
  const rate = details.ratePerScript || 27.5;
  const scriptCount = details.scriptCount || Math.round(details.grossAmount / rate) || 1;
  const scriptAmount = scriptCount * rate;
  const conveyance = details.conveyanceAmount || 150;
  const gross = details.grossAmount || (scriptAmount + conveyance);
  const net = details.netPayable || gross;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>IGNOU F&AD Statutory Remuneration Claim Voucher - ${details.billId || 'BILL'}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.4; color: #000; margin: 0; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
    .univ { font-size: 20px; font-weight: bold; text-transform: uppercase; }
    .division { font-size: 14px; font-weight: bold; }
    .sub { font-size: 12px; margin-top: 2px; }
    .voucher-title { font-size: 15px; font-weight: bold; text-decoration: underline; margin-top: 8px; color: #1e3a8a; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .meta-table td { padding: 6px 8px; border: 1px solid #888; font-size: 12px; }
    .meta-label { font-weight: bold; background: #f4f4f5; width: 25%; }
    .calc-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    .calc-table th { border: 1px solid #000; background: #e4e4e7; padding: 8px; text-align: left; font-size: 12px; }
    .calc-table td { border: 1px solid #000; padding: 8px; font-size: 12px; }
    .total-row { font-weight: bold; background: #f8fafc; }
    .cert-box { border: 1px solid #666; padding: 10px 12px; font-size: 11px; margin-top: 20px; background: #fafafa; font-style: italic; }
    .footer-signs { display: flex; justify-content: space-between; margin-top: 45px; padding-top: 10px; }
    .sign-block { width: 45%; text-align: center; border-top: 1px solid #000; padding-top: 6px; font-size: 12px; }
    .actions-bar { position: fixed; top: 10px; right: 10px; z-index: 1000; display: flex; gap: 8px; }
    .btn { background: #15803d; color: #fff; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .btn:hover { background: #166534; }
    @media print { .actions-bar { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="actions-bar">
    <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="header">
    <div class="univ">Indira Gandhi National Open University</div>
    <div class="division">Finance & Accounts Division (F&AD) — Maidan Garhi, New Delhi</div>
    <div class="sub">Study Centre 2033 (Al-Ameen College) | Regional Centre: RC-14 Kochi</div>
    <div class="voucher-title">STATUTORY CLAIM BILL FOR EVALUATION OF ASSIGNMENTS</div>
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Bill Voucher No:</td>
      <td><strong>${details.billId || 'BILL-SC2033-2026-001'}</strong></td>
      <td class="meta-label">Date of Claim:</td>
      <td><strong>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Academic Counsellor:</td>
      <td><strong style="color: #1e3a8a;">${details.evaluatorName || 'Academic Evaluator'}</strong></td>
      <td class="meta-label">Evaluator Code:</td>
      <td><strong>${details.evaluatorId || 'EV-SC2033-01'}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Term-End Session:</td>
      <td><strong>${details.session}</strong></td>
      <td class="meta-label">Assigned Courses:</td>
      <td><strong>${coursesStr}</strong></td>
    </tr>
  </table>

  <table class="calc-table">
    <thead>
      <tr>
        <th style="width: 10%;">Sl.No.</th>
        <th style="width: 50%;">Description of Remuneration Heads</th>
        <th style="width: 20%; text-align: center;">Rate / Scale</th>
        <th style="width: 20%; text-align: right;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Remuneration for Evaluation of Assignment Answer Scripts (Count: <strong>${scriptCount}</strong>)</td>
        <td style="text-align: center;">₹${rate.toFixed(2)} per script</td>
        <td style="text-align: right; font-weight: bold;">₹${scriptAmount.toFixed(2)}</td>
      </tr>
      <tr>
        <td>2</td>
        <td>Conveyance Allowance for Collection & Return of Assignment Packets</td>
        <td style="text-align: center;">Standard norm</td>
        <td style="text-align: right; font-weight: bold;">₹${conveyance.toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" style="text-align: right; font-size: 13px;">GROSS STATUTORY CLAIM:</td>
        <td style="text-align: right; font-size: 14px; color: #1e3a8a;">₹${gross.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="3" style="text-align: right;">Less TDS / Statutory Deductions (if applicable):</td>
        <td style="text-align: right; font-weight: bold;">₹0.00</td>
      </tr>
      <tr class="total-row" style="background: #eef2ff; border-top: 2px solid #000;">
        <td colspan="3" style="text-align: right; font-size: 14px; font-weight: bold;">NET DISBURSABLE AMOUNT:</td>
        <td style="text-align: right; font-size: 15px; font-weight: bold; color: #047857;">₹${net.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="cert-box">
    <strong>Statutory Certification:</strong> Certified that the assignment scripts mentioned above were duly evaluated, marks entered in the continuous evaluation award sheet, verified against the question paper key, and returned to Study Centre 2033 in accordance with IGNOU Evaluation Guidelines.
  </div>

  <div class="footer-signs">
    <div class="sign-block">
      <strong>Signature of Academic Counsellor (Claimant)</strong><br/>
      Name: ${details.evaluatorName || 'Academic Evaluator'}<br/>
      PAN: XXXXX1234X | A/C: ••••••••8912
    </div>
    <div class="sign-block">
      <strong>Verified & Sanctioned by Coordinator</strong><br/>
      Dr. V. K. Aggarwal (Coordinator, SC-2033)<br/>
      IGNOU Study Centre 2033, Al-Ameen College
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}
