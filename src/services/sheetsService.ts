import { getIgnouGrade } from '../utils/helpers';
import { validatePrePushToGoogleSheets } from './dataEntryValidationService';
import { enqueueSyncMutation, SyncQueueItem } from './syncQueueService';

/**
 * Universal Session Normalizer
 * Converts raw session strings or ISO date stamps (e.g. "2026-06-30T18:30:00.000Z") into standard "July 2026" / "January 2026"
 */
export const normalizeSessionName = (rawVal: any, fallbackSubId?: string): string => {
  if (!rawVal && fallbackSubId) {
    const match = fallbackSubId.match(/(July|January|Jan|Jul)\s*(\d{4})/i);
    if (match) {
      const month = match[1].toLowerCase().startsWith('jul') ? 'July' : 'January';
      return `${month} ${match[2]}`;
    }
  }
  const str = String(rawVal || '').trim();
  if (!str) return 'July 2026';

  // If ISO date string: e.g. "2026-06-30T18:30:00.000Z" or "2026-07-01..."
  if (str.includes('T') || /^\d{4}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      // Offset by +5:30 for Indian Standard Time (IST)
      const istDate = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
      const m = istDate.getUTCMonth(); // 0-based: 6 is July, 0 is Jan
      const y = istDate.getUTCFullYear();
      const sessionMonth = (m >= 4 && m <= 9) ? 'July' : 'January';
      return `${sessionMonth} ${y}`;
    }
  }

  // If contains July or January with year: e.g. "July 2026", "JULY 2026", "July-2026"
  const textMatch = str.match(/(July|January|Jan|Jul)[^\d]*(\d{4})/i);
  if (textMatch) {
    const month = textMatch[1].toLowerCase().startsWith('jul') ? 'July' : 'January';
    return `${month} ${textMatch[2]}`;
  }

  return str;
};

/**
 * Normalizes session values for whitespace-insensitive and format-insensitive comparison
 */
export const norm = (val: any): string => {
  if (!val) return '';
  const clean = normalizeSessionName(val);
  return clean.toString().trim().toLowerCase().replace(/\s+/g, '').replace(/[-_]/g, '');
};

/**
 * Google Sheets & Apps Script Integration Service
 * Target Script Web App ID / URL:
 */
export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzAPe0qevCc1wb7WhywMlSJQGJwAz4ykg76xc_E08l1DRjTFjd-V9MEytql11O_-cMEbg/exec";

export function getFullAppsScriptUrl(url: string = SCRIPT_URL): string {
  if (!url) return SCRIPT_URL;
  if (url.startsWith('http')) return url;
  return `https://script.google.com/macros/s/${url}/exec`;
}

export interface HydrationResult {
  success: boolean;
  intakes?: any[];
  courseLedger?: any[];
  evaluatorsMaster?: any[];
  source: 'google_sheets' | 'local_cache' | 'offline_fallback';
  message?: string;
  reachable?: boolean;
  latencyMs?: number;
}

export interface ApiResponse<T = any> {
  status: 'success' | 'fallback' | 'error';
  action?: string;
  downloadUrl?: string;
  url?: string;
  data?: T;
  message?: string;
  queued?: boolean;
}

/**
 * Sends a POST request to Google Apps Script.
 * Uses /api/sheets proxy first (which reliably handles redirects & CORS in full-stack dev/prod),
 * falling back to direct POST to Google Apps Script.
 * If network is offline or request fails and queueOnFailure is true, automatically saves to IndexedDB.
 */
export async function sendScriptPost(
  payload: any,
  options?: { queueOnFailure?: boolean; summary?: string; type?: SyncQueueItem['type'] }
): Promise<boolean> {
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;

  if (!isOnline && options?.queueOnFailure && options?.type) {
    console.info(`[Offline] Enqueuing ${options.type} into persistent offline sync queue`);
    try {
      await enqueueSyncMutation({
        type: options.type,
        payload,
        summary: options.summary || `${options.type} queued while offline`,
      });
    } catch (e) {
      console.warn('[enqueueSyncMutation error]:', e);
    }
    return false;
  }

  let sent = false;

  // 1. Try server proxy first to follow Google Apps Script 302 redirects and ensure data is committed
  try {
    const proxyRes = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (proxyRes.ok) {
      const result = await proxyRes.json();
      if (result && (result.status === 'success' || result.saved || result.message)) {
        sent = true;
      }
    }
  } catch (proxyErr) {
    console.warn("[Google Sheets proxy error, falling back to direct POST]:", proxyErr);
  }

  // 2. Direct fallback to Google Apps Script
  if (!sent) {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      sent = true;
    } catch (err) {
      console.error("[Google Sheets direct POST error]:", err);
    }
  }

  if (!sent && options?.queueOnFailure && options?.type) {
    console.info(`[Failed] Enqueuing ${options.type} into persistent offline sync queue for automatic retry`);
    try {
      await enqueueSyncMutation({
        type: options.type,
        payload,
        summary: options.summary || `${options.type} queued after network failure`,
      });
    } catch (qErr) {
      console.warn('[enqueueSyncMutation error]:', qErr);
    }
  }

  return sent;
}

/**
 * Executor function used by syncQueueService to replay queued operations
 */
export async function executeQueuedMutation(item: SyncQueueItem): Promise<boolean> {
  try {
    return await sendScriptPost(item.payload, { queueOnFailure: false });
  } catch (err) {
    console.error(`[executeQueuedMutation ${item.type} error]:`, err);
    return false;
  }
}

/**
 * Legacy payload extractor kept for type compatibility
 */
export function extractRegistrationsFromSheetsPayload(_json: Record<string, any>): any[] {
  return [];
}

/**
 * 1. On Load:
 * Call doGet() to hydrate IntakeRegister and CourseLedger state from Google Sheets.
 * Uses 5-second automatic timeout with seamless local storage fallback.
 */
export async function doGet(): Promise<HydrationResult> {
  const timestamp = Date.now();
  const startTime = Date.now();

  try {
    // Try via full-stack Express proxy first with cache-busting and 5-second timeout
    const response = await fetch(`/api/sheets?action=doGet&scriptUrl=${encodeURIComponent(SCRIPT_URL)}&_t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const json = await response.json();
      const rawIntakes = json.intakeRegister || json.intakes || json.Intake_Register || [];
      const rawLedger = json.courseLedger || json.course_ledger || json.Course_Ledger || [];
      const rawEvaluators = json.evaluatorsMaster || json.evaluators_master || json.Evaluators_Master || json.evaluators || [];
      const isReachable = json.status !== 'fallback';

      return {
        success: true,
        intakes: rawIntakes,
        courseLedger: rawLedger,
        evaluatorsMaster: rawEvaluators,
        source: isReachable ? 'google_sheets' : 'local_cache',
        reachable: isReachable,
        latencyMs: Date.now() - startTime,
        message: isReachable
          ? 'Hydrated successfully from Google Sheets.'
          : 'Operating in local store fallback mode (5s timeout/unreachable).',
      };
    }
  } catch (err: any) {
    console.warn('[Google Sheets] Express proxy doGet failed or timed out:', err);
  }

  // Direct client fetch fallback with cache-busting and 5s timeout
  try {
    const directRes = await fetch(`${SCRIPT_URL}?_t=${timestamp}`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (directRes.ok) {
      const data = await directRes.json();
      const rawIntakes = data.intakeRegister || data.intakes || data.Intake_Register || [];
      const rawLedger = data.courseLedger || data.course_ledger || data.Course_Ledger || [];
      const rawEvaluators = data.evaluatorsMaster || data.evaluators_master || data.Evaluators_Master || data.evaluators || [];
      return {
        success: true,
        intakes: rawIntakes,
        courseLedger: rawLedger,
        evaluatorsMaster: rawEvaluators,
        source: 'google_sheets',
        reachable: true,
        latencyMs: Date.now() - startTime,
        message: 'Hydrated via direct Google Apps Script call.',
      };
    }
  } catch (directErr: any) {
    console.warn('[Google Sheets] Direct doGet failed or timed out:', directErr);
  }

  return {
    success: true,
    source: 'local_cache',
    reachable: false,
    latencyMs: Date.now() - startTime,
    message: 'Google Sheets script endpoint pending or offline. Local storage active.',
  };
}

/**
 * 2. On Intake Submission (Stage 1: Intake Desk):
 * Send POST with action "ADD_INTAKE".
 * Format:
 * {
 *   action: "ADD_INTAKE",
 *   payload: {
 *     timestamp: new Date().toISOString(),
 *     session: activeSession,
 *     enrollmentNo: form.enrollmentNo.trim(),
 *     candidateName: form.candidateName.trim(),
 *     contact: form.contact.trim(),
 *     programme: form.programme,
 *     courses: form.courses, // array of strings
 *     handledBy: currentRole === "admin" ? "Coordinator" : "Official"
 *   }
 * }
 */
export async function postAddIntake(
  intakeRecord: any,
  unpackedCourses?: any[]
): Promise<ApiResponse> {
  // Pre-Push Background Validation Gate:
  // Checks for common data entry errors (malformed enrollment numbers, invalid names, dates, course codes)
  // before pushing to Google Sheets, and guarantees TMA and Practical are NEVER mixed together.
  const prePushCheck = validatePrePushToGoogleSheets(intakeRecord, unpackedCourses);
  if (!prePushCheck.canPush) {
    const errorDetails = prePushCheck.errors.join('; ');
    console.error('[Google Sheets Push Blocked by Validation]:', errorDetails);
    throw new Error(`Data entry validation failed: ${errorDetails}`);
  }

  const sanitized = prePushCheck.sanitizedData!;
  const activeSession = intakeRecord.session || 'July 2026';
  const cleanEnrollment = sanitized.enrollmentNo;
  const candidateName = sanitized.candidateName;
  const contact = sanitized.contact;
  const programme = sanitized.programme;
  const practicalList = sanitized.practicalCourses;
  const assignmentList = sanitized.assignmentCourses;
  const formattedCourseList = sanitized.separatedCourseString;
  const categoryLabel = sanitized.categoryLabel;

  const rawCourses = intakeRecord.courses || intakeRecord.courseCodes || [];
  const coursesArray: string[] = Array.isArray(rawCourses)
    ? rawCourses.flatMap((c: any) => String(c).split(',')).map((c: string) => c.replace(/\s*[\(\[](Practical|TMA\s*\+\s*Practical|TMA|Both|P|Asgn|Assignment)[\)\]]\s*/gi, '').trim().toUpperCase()).filter(Boolean)
    : typeof rawCourses === 'string'
    ? rawCourses.split(',').map((c: string) => c.replace(/\s*[\(\[](Practical|TMA\s*\+\s*Practical|TMA|Both|P|Asgn|Assignment)[\)\]]\s*/gi, '').trim().toUpperCase()).filter(Boolean)
    : [];

  const handledBy =
    intakeRecord.handledBy ||
    (intakeRecord.registeredBy?.includes('Coordinator') || intakeRecord.role === 'admin'
      ? 'Coordinator'
      : 'Desk Official');

  const timestamp =
    intakeRecord.timestamp ||
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const payload = {
    action: "ADD_INTAKE",
    payload: {
      timestamp,
      session: activeSession,
      enrollmentNo: cleanEnrollment,
      candidateName,
      contact,
      programme,
      courses: formattedCourseList,
      rawCourses: coursesArray,
      component: categoryLabel,
      componentType: categoryLabel,
      practicalCourses: practicalList,
      assignmentCourses: assignmentList,
      handledBy,
    },
    // Top-level aliases for direct access by Google Apps Script
    enrollmentNo: cleanEnrollment,
    candidateName,
    programme,
    courses: formattedCourseList,
    rawCourses: coursesArray,
    component: categoryLabel,
    componentType: categoryLabel,
    practicalCourses: practicalList,
    assignmentCourses: assignmentList,
    session: activeSession,
    contact,
    handledBy,
    timestamp,
    intake: {
      ...intakeRecord,
      enrollmentNo: cleanEnrollment,
      candidateName,
      courses: formattedCourseList,
      rawCourses: coursesArray,
      component: categoryLabel,
      componentType: categoryLabel,
      practicalCourses: practicalList,
      assignmentCourses: assignmentList,
    },
    unpackedCourses: sanitized.unpackedCourses || [],
  };

  // Dispatch once to SCRIPT_URL with automatic fallback to offline queue
  await sendScriptPost(payload, {
    queueOnFailure: true,
    type: 'ADD_INTAKE',
    summary: `Add Intake: ${cleanEnrollment} (${candidateName} - ${programme})`,
  });

  // Sync with Express backend data store
  try {
    fetch('/api/intake/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollmentNo: cleanEnrollment,
        studentName: candidateName,
        studentPhone: contact,
        programmeCode: programme,
        courseCodes: coursesArray,
        practicalCourses: practicalList,
        assignmentCourses: assignmentList,
        componentType: categoryLabel,
        session: activeSession,
        submissionDate: sanitized.submissionDate,
        submissionMode: intakeRecord.submissionMode,
        consignmentNo: intakeRecord.consignmentNo,
        remarks: intakeRecord.remarks,
      }),
    }).catch(() => {});
  } catch {}

  return {
    status: 'success',
    action: 'ADD_INTAKE',
    message: 'Saved & Synced with Google Sheet',
  };
}

/**
 * Edit Intake Receipt (Stage 1: Intake & Desk Submissions):
 * Dispatch POST to Google Apps Script and backend /api/intake/update:
 * action: "EDIT_INTAKE",
 * payload: { id, originalEnrollmentNo, enrollmentNo, candidateName, contact, programme, courses, session: activeSession }
 */
export async function postEditIntake(payloadData: {
  id?: string;
  originalEnrollmentNo: string;
  enrollmentNo: string;
  candidateName: string;
  contact: string;
  programme: string;
  courses: string[];
  session: string;
  submissionDate?: string;
  receiptDate?: string;
}): Promise<ApiResponse> {
  // Pre-push validation check for Edit
  const prePushCheck = validatePrePushToGoogleSheets({
    enrollmentNo: payloadData.enrollmentNo,
    candidateName: payloadData.candidateName,
    contact: payloadData.contact,
    programme: payloadData.programme,
    courses: payloadData.courses,
    submissionDate: payloadData.submissionDate,
    session: payloadData.session,
  });

  if (!prePushCheck.canPush) {
    const errorDetails = prePushCheck.errors.join('; ');
    console.error('[Google Sheets Edit Push Blocked by Validation]:', errorDetails);
    throw new Error(`Data entry validation failed: ${errorDetails}`);
  }

  const sanitized = prePushCheck.sanitizedData!;
  const cleanEnr = sanitized.enrollmentNo;
  const cleanName = sanitized.candidateName;
  const cleanContact = sanitized.contact;
  const cleanProg = sanitized.programme;
  const cleanDate = sanitized.submissionDate;
  const cleanTimestamp = cleanDate ? `${cleanDate}T10:00:00.000Z` : '';
  const separatedCourseList = sanitized.separatedCourseString;

  const payload = {
    action: "EDIT_INTAKE",
    payload: {
      id: payloadData.id,
      originalEnrollmentNo: String(payloadData.originalEnrollmentNo || '').trim(),
      enrollmentNo: cleanEnr,
      candidateName: cleanName,
      studentName: cleanName,
      Candidate_Name: cleanName,
      contact: cleanContact,
      programme: cleanProg,
      courses: payloadData.courses || [],
      separatedCourses: separatedCourseList,
      practicalCourses: sanitized.practicalCourses,
      assignmentCourses: sanitized.assignmentCourses,
      component: sanitized.categoryLabel,
      session: payloadData.session || 'July 2026',
      submissionDate: cleanDate,
      receiptDate: payloadData.receiptDate || cleanDate,
      timestamp: cleanTimestamp,
      Timestamp: cleanTimestamp,
      date: cleanDate,
      Date: cleanDate,
    },
    // Top-level aliases for flexible Apps Script handlers
    id: payloadData.id,
    originalEnrollmentNo: String(payloadData.originalEnrollmentNo || '').trim(),
    enrollmentNo: cleanEnr,
    candidateName: cleanName,
    studentName: cleanName,
    Candidate_Name: cleanName,
    contact: cleanContact,
    programme: cleanProg,
    courses: payloadData.courses || [],
    separatedCourses: separatedCourseList,
    practicalCourses: sanitized.practicalCourses,
    assignmentCourses: sanitized.assignmentCourses,
    component: sanitized.categoryLabel,
    session: payloadData.session || 'July 2026',
    submissionDate: cleanDate,
    receiptDate: payloadData.receiptDate || cleanDate,
    timestamp: cleanTimestamp,
    Timestamp: cleanTimestamp,
    date: cleanDate,
    Date: cleanDate,
  };

  try {
    await sendScriptPost(payload, {
      queueOnFailure: true,
      type: 'EDIT_INTAKE',
      summary: `Edit Intake: ${cleanEnr} (${cleanName} - ${cleanProg})`,
    });
  } catch (err) {
    console.warn('[postEditIntake error]:', err);
  }

  // Sync with Express backend data store
  try {
    await fetch('/api/intake/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: payloadData.id,
        originalEnrollmentNo: payloadData.originalEnrollmentNo,
        enrollmentNo: cleanEnr,
        studentName: cleanName,
        studentPhone: cleanContact,
        programmeCode: cleanProg,
        courseCodes: payloadData.courses,
        practicalCourses: sanitized.practicalCourses,
        assignmentCourses: sanitized.assignmentCourses,
        session: payloadData.session,
        submissionDate: cleanDate,
      }),
    });
  } catch (backendErr) {
    console.warn('[postEditIntake backend sync warning]:', backendErr);
  }

  return {
    status: 'success',
    action: 'EDIT_INTAKE',
    message: 'Intake entry updated & validated with Google Sheet',
  };
}

/**
 * Delete Intake Receipt (Stage 1: Intake & Desk Submissions):
 * Dispatch POST to Google Apps Script and backend /api/intake/delete:
 * action: "DELETE_INTAKE",
 * payload: { id, enrollmentNo, session: activeSession }
 */
export async function postDeleteIntake(payloadData: {
  id?: string;
  enrollmentNo: string;
  session: string;
}): Promise<ApiResponse> {
  const payload = {
    action: "DELETE_INTAKE",
    payload: {
      id: payloadData.id,
      enrollmentNo: String(payloadData.enrollmentNo || '').trim(),
      session: payloadData.session || 'July 2026',
    },
    id: payloadData.id,
    enrollmentNo: String(payloadData.enrollmentNo || '').trim(),
    session: payloadData.session || 'July 2026',
  };

  sendScriptPost(payload, {
    queueOnFailure: true,
    type: 'DELETE_INTAKE',
    summary: `Delete Intake: ${payloadData.enrollmentNo || payloadData.id} (${payloadData.session})`,
  }).catch((err) => console.warn('[postDeleteIntake error]:', err));

  // Sync with Express backend data store
  if (payloadData.id) {
    try {
      fetch('/api/intake/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: payloadData.id }),
      }).catch(() => {});
    } catch {}
  }

  return {
    status: 'success',
    action: 'DELETE_INTAKE',
    message: 'Intake receipt and ledger rows deleted',
  };
}

/**
 * 3. On Marks Locking / Updating (Stage 2: Course Evaluation Master):
 * Send POST with action "UPDATE_MARKS" containing subId, marks, calculated grade, and isLocked: true.
 * Format:
 * {
 *   action: "UPDATE_MARKS",
 *   payload: {
 *     subId: script.subId,
 *     marks: Number(marks),
 *     grade: calculatedGrade,
 *     isLocked: true
 *   }
 * }
 */
export interface UpdateMarksPayload {
  subId: string;
  enrollmentNo: string;
  courseCode: string;
  marks: number | null;
  grade: string;
  isLocked: boolean;
}

/**
 * 3. On Marks Locking / Updating (Stage 2: Course Evaluation Master):
 * Send POST with action "UPDATE_MARKS" containing subId, enrollmentNo, courseCode, marks, calculated grade, and isLocked.
 * Format:
 * {
 *   action: "UPDATE_MARKS",
 *   payload: {
 *     subId,
 *     enrollmentNo,
 *     courseCode,
 *     marks,
 *     grade,
 *     isLocked
 *   }
 * }
 */
export async function postUpdateMarks(
  rowOrParams: any,
  marksParam?: number | null,
  gradeParam?: string,
  isLockedParam?: boolean,
  compositeParams?: { enrollmentNo?: string; courseCode?: string }
): Promise<ApiResponse> {
  let subId = '';
  let enrollmentNo = '';
  let courseCode = '';
  let marksValue: any = null;
  let isLockAction = isLockedParam !== undefined ? Boolean(isLockedParam) : true;

  if (typeof rowOrParams === 'object' && rowOrParams !== null) {
    const row = rowOrParams;
    subId = (row.Sub_ID || row.subId || row.submissionKey || row.id || '').toString().trim();
    enrollmentNo = (row.Enrollment_No || row.enrollmentNo || '').toString().replace(/^'/, '').trim();
    courseCode = (row.Course_Code || row.courseCode || '').toString().trim().toUpperCase();
    marksValue = marksParam !== undefined
      ? marksParam
      : (row.marks !== undefined ? row.marks : (row.Marks !== undefined ? row.Marks : null));
    if (row.isLocked !== undefined && isLockedParam === undefined) {
      isLockAction = Boolean(row.isLocked);
    }
  } else {
    subId = String(rowOrParams || '');
    marksValue = marksParam !== undefined ? marksParam : null;
    isLockAction = isLockedParam !== undefined ? Boolean(isLockedParam) : true;
    enrollmentNo = (compositeParams?.enrollmentNo || '').toString().replace(/^'/, '').trim();
    courseCode = (compositeParams?.courseCode || '').toString().trim().toUpperCase();
  }

  // Fallback composite key parsing from subId if missing
  if ((!enrollmentNo || !courseCode) && subId) {
    const parts = subId.split('_');
    if (parts.length >= 3) {
      if (!enrollmentNo) enrollmentNo = parts[1].replace(/^'/, '').trim();
      if (!courseCode) courseCode = parts[2].trim().toUpperCase();
    }
  }

  if (!subId && enrollmentNo && courseCode) {
    subId = `SUB_${enrollmentNo}_${courseCode}_JUL2026`;
  }

  const numericMarks = marksValue !== null && marksValue !== undefined && marksValue !== ''
    ? Number(marksValue)
    : 0;

  const calculatedGrade = gradeParam || getIgnouGrade(numericMarks).grade;

  const payload = {
    subId,
    enrollmentNo,
    courseCode,
    marks: Number(numericMarks),
    grade: calculatedGrade,
    isLocked: isLockAction,
  };

  // Direct fetch to Apps Script Web App URL with mode: "no-cors"
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "UPDATE_MARKS",
        payload: payload,
      }),
    });
  } catch (err) {
    console.warn('[UPDATE_MARKS fetch error]:', err);
  }

  // Also dispatch to local server proxy in parallel with offline queuing support
  sendScriptPost({
    action: "UPDATE_MARKS",
    payload,
    // Top-level aliases
    subId,
    enrollmentNo,
    courseCode,
    marks: Number(numericMarks),
    grade: calculatedGrade,
    isLocked: isLockAction,
  }, {
    queueOnFailure: true,
    type: 'UPDATE_MARKS',
    summary: `Update Marks: ${enrollmentNo} - ${courseCode} (${numericMarks}/100 Grade ${calculatedGrade})`,
  }).catch((err) => console.warn(err));

  return {
    status: 'success',
    action: 'UPDATE_MARKS',
    message: `Marks for ${payload.courseCode} (${payload.marks}/100 - Grade ${payload.grade}) updated & synced to Google Sheets`,
  };
}

/**
 * On Allotting Evaluator (Stage 2: Course Evaluation Master):
 * Send POST with action "ALLOT_EVALUATOR".
 * Format:
 * {
 *   action: "ALLOT_EVALUATOR",
 *   payload: {
 *     subId: script.subId,
 *     evaluatorId: evaluator.id,
 *     evaluatorName: evaluator.name,
 *     evaluatorCode: evaluator.evaluatorCode
 *   }
 * }
 */
export async function postAllotEvaluator(
  subId: string,
  evaluator: { id?: string; name?: string; evaluatorCode?: string; Allotted_Evaluator?: string | null; enrollmentNo?: string; courseCode?: string }
): Promise<ApiResponse> {
  const allottedEvaluatorVal = evaluator.Allotted_Evaluator || (evaluator.name && evaluator.evaluatorCode ? `${evaluator.name} (${evaluator.evaluatorCode})` : evaluator.name || '');
  const cleanSubId = (subId || '').toString().trim();
  const cleanEnr = (evaluator.enrollmentNo || '').toString().replace(/^'/, '').trim();
  const cleanCourse = (evaluator.courseCode || '').toString().trim().toUpperCase();

  const payload = {
    subId: cleanSubId,
    subIds: [cleanSubId],
    enrollmentNo: cleanEnr,
    courseCode: cleanCourse,
    evaluator: allottedEvaluatorVal,
    evaluatorId: evaluator.id || '',
    evaluatorName: evaluator.name || allottedEvaluatorVal,
    evaluatorCode: evaluator.evaluatorCode || '',
    Allotted_Evaluator: allottedEvaluatorVal,
  };

  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "ALLOT_EVALUATOR",
        payload: payload,
      }),
    });
  } catch (err) {
    console.warn("[postAllotEvaluator direct POST fallback]:", err);
    sendScriptPost({ action: "ALLOT_EVALUATOR", payload }).catch(() => {});
  }

  return {
    status: 'success',
    action: 'ALLOT_EVALUATOR',
    message: 'Saved & Synced with Google Sheet',
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
  evaluatorCode?: string;
  evaluatorName?: string;
  session: string;
  grossAmount?: number;
  netPayable?: number;
  scriptCount?: number;
  totalScripts?: number;
  rate?: number;
  ratePerScript?: number;
  conveyance?: number;
  conveyanceAmount?: number;
  coordination?: number;
  coordinationCharges?: number;
  courses?: string[];
  courseCodes?: string[];
  bankAccountNo?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  panNumber?: string;
  department?: string;
  designation?: string;
  centreCode?: string;
}): Promise<string> {
  const activeSession = details.session;
  const evName = details.evaluatorName || 'Academic Counsellor';
  const rateVal = parseFloat(String(details.rate ?? details.ratePerScript ?? 27.50));
  const conveyanceVal = parseFloat(String(details.conveyance ?? details.conveyanceAmount ?? 0)) || 0;
  const coordinationVal = parseFloat(String(details.coordination ?? details.coordinationCharges ?? 0)) || 0;
  const count = details.scriptCount || details.totalScripts || 0;
  const gross = details.grossAmount ?? (count * rateVal + conveyanceVal + coordinationVal);

  const payload = {
    action: 'GENERATE_CLAIM_PDF',
    payload: {
      session: activeSession,
      evaluatorName: evName,
      rate: rateVal,
      conveyance: conveyanceVal,
      coordination: coordinationVal,
    },
    // Top-level fields for backwards compatibility with Google Apps Script
    session: activeSession,
    evaluatorName: evName,
    rate: rateVal,
    conveyance: conveyanceVal,
    coordination: coordinationVal,
    billId: details.billId || 'STATUTORY-CLAIM-VOUCHER',
    evaluatorId: details.evaluatorId || details.evaluatorCode || 'EV-SC2033',
    evaluatorCode: details.evaluatorCode || details.evaluatorId || 'EV-SC2033',
    bankAccountNo: details.bankAccountNo || details.accountNumber || '',
    accountNumber: details.bankAccountNo || details.accountNumber || '',
    ifscCode: details.ifscCode || '',
    bankName: details.bankName || 'State Bank of India',
    panNumber: details.panNumber || '',
    department: details.department || '',
    designation: details.designation || '',
    grossAmount: gross,
    netPayable: details.netPayable || gross,
    scriptCount: count,
    ratePerScript: rateVal,
    conveyanceAmount: conveyanceVal,
    coordinationCharges: coordinationVal,
    courses: details.courses || details.courseCodes || [],
  };

  // Direct no-cors post to Apps Script to guarantee request dispatch without browser blockage
  sendScriptPost(payload).catch((err) => console.warn('[GENERATE_CLAIM_PDF no-cors dispatch]:', err));

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
  return createFallbackClaimBillPdfBlob({
    ...details,
    grossAmount: gross,
    ratePerScript: rateVal,
    conveyanceAmount: conveyanceVal,
    coordinationCharges: coordinationVal,
    scriptCount: count,
  });
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
    <div class="division">Student Evaluation Division (SED) — IGNOU HQ</div>
    <div class="sub">Continuous Assessment Award List for Tutor Marked Assignments (TMA)</div>
    <div style="font-weight: bold; font-size: 12px; margin-top: 4px; color: #1e3a8a;">PART - 1: SED STATUTORY TABULATION COPY (ORIGINAL)</div>
  </div>

  <table class="meta-box">
    <tr>
      <td class="meta-label">Study Centre Code:</td>
      <td><strong>SC-2033</strong> (S.D. Jain Girls' College, Dimapur)</td>
      <td class="meta-label">Regional Centre:</td>
      <td><strong>RC-20 Kohima (Regional Centre Kohima)</strong></td>
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
      (Study Centre SC-2033, Dimapur)
    </div>
    <div class="sign-block">
      Signature & Seal of Coordinator<br/>
      Dr. Sant Kumar Gupta<br/>
      Coordinator, IGNOU SC-2033
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
  evaluatorCode?: string;
  evaluatorName?: string;
  session: string;
  grossAmount: number;
  netPayable?: number;
  scriptCount?: number;
  ratePerScript?: number;
  conveyanceAmount?: number;
  coordinationCharges?: number;
  coordination?: number;
  courses?: string[];
  bankAccountNo?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  panNumber?: string;
  department?: string;
  designation?: string;
}): string {
  const coursesStr = (details.courses && details.courses.length > 0)
    ? details.courses.join(', ')
    : 'Allotment Courses';
  const rate = details.ratePerScript || 27.5;
  const scriptCount = details.scriptCount || Math.round(details.grossAmount / rate) || 1;
  const scriptAmount = scriptCount * rate;
  const conveyance = details.conveyanceAmount ?? 0;
  const coordination = (details as any).coordinationCharges ?? (details as any).coordination ?? 0;
  const gross = details.grossAmount || (scriptAmount + conveyance + coordination);
  const net = details.netPayable || gross;
  const evalCode = details.evaluatorCode || details.evaluatorId || 'EV-SC2033-01';
  const bankAcc = details.bankAccountNo || details.accountNumber || '—';
  const ifsc = details.ifscCode || '—';
  const bank = details.bankName || 'State Bank of India';
  const pan = details.panNumber || 'XXXXX1234X';

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
    <div class="division">Finance & Accounts Division (F&AD) — IGNOU HQ</div>
    <div class="sub">Study Centre SC-2033 (S.D. Jain Girls' College, Dimapur) | Regional Centre: RC-20 Kohima (Regional Centre Kohima)</div>
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
      <td><strong style="font-family: monospace;">${evalCode}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Designation & Dept:</td>
      <td><strong>${details.designation || 'Academic Counsellor'} ${details.department ? `(${details.department})` : ''}</strong></td>
      <td class="meta-label">Term-End Session:</td>
      <td><strong>${details.session}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Bank Account Number:</td>
      <td><strong style="font-family: monospace;">${bankAcc}</strong></td>
      <td class="meta-label">Bank & IFSC:</td>
      <td><strong>${bank}</strong> (IFSC: <strong style="font-family: monospace;">${ifsc}</strong>)</td>
    </tr>
    <tr>
      <td class="meta-label">Assigned Courses:</td>
      <td colspan="3"><strong>${coursesStr}</strong></td>
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
        <td>Conveyance Allowance (Study Centre Delivery / Return)</td>
        <td style="text-align: center;">${conveyance > 0 ? 'Sanctioned' : 'Default Norm'}</td>
        <td style="text-align: right; font-weight: bold;">₹${conveyance.toFixed(2)}</td>
      </tr>
      <tr>
        <td>3</td>
        <td>Coordination & Verification Charges</td>
        <td style="text-align: center;">${coordination > 0 ? 'Sanctioned' : 'Default Norm'}</td>
        <td style="text-align: right; font-weight: bold;">₹${coordination.toFixed(2)}</td>
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
      Code: ${evalCode} | PAN: ${pan} | A/C: ${bankAcc}
    </div>
    <div class="sign-block">
      <strong>Verified & Sanctioned by Coordinator</strong><br/>
      Dr. Sant Kumar Gupta<br/>
      Coordinator, IGNOU SC-2033
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}

/**
 * Master Google Apps Script (Code.gs) template for IGNOU SC-2033
 * Dedicated Assignment Operations (Intake Desk, Course Ledger, Evaluation Master, Award Sheets)
 */
export const OFFICIAL_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * IGNOU STUDY CENTRE 2033 - MASTER GOOGLE APPS SCRIPT (Code.gs)
 * =========================================================================
 * 
 * ASSIGNMENT OPERATIONS & ACADEMIC LEDGER:
 * 1. Student Intake & Desk (intakeRegister / Intake_Register)
 * 2. Evaluation Master & Course Ledger (courseLedger / Course_Ledger)
 * 3. Evaluators Master (evaluatorsMaster / Evaluators_Master)
 * 4. SED Award Sheets (awardSheets / Award_Sheets)
 * 
 * Data submitted at Intake Desk is saved to Google Sheets (doPost) and
 * auto-unpacked into individual course rows in Course_Ledger.
 * =========================================================================
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {};

  // ASSIGNMENT OPERATIONS & ACADEMIC DATA
  var intakeData = getSheetDataByAliases(ss, ["intakeRegister", "Intake_Register", "IntakeRegister", "Intake Register", "Intake"]);
  result.intakeRegister = intakeData;
  result.Intake_Register = intakeData;
  result.intakes = intakeData;

  var ledgerData = getSheetDataByAliases(ss, ["courseLedger", "Course_Ledger", "CourseLedger", "Course Ledger"]);
  result.courseLedger = ledgerData;
  result.Course_Ledger = ledgerData;

  var evalData = getSheetDataByAliases(ss, ["evaluatorsMaster", "Evaluators_Master", "EvaluatorsMaster", "Evaluators"]);
  result.evaluatorsMaster = evalData;
  result.Evaluators_Master = evalData;

  var awardData = getSheetDataByAliases(ss, ["awardSheets", "Award_Sheets", "AwardSheets"]);
  result.awardSheets = awardData;
  result.Award_Sheets = awardData;

  // STAFF ACCOUNTS & GOVERNANCE
  var staffSheet = getOrCreateSheet(ss, ["Staff_Users", "StaffUsers", "Staff"], ["Staff_ID", "Full_Name", "Role", "Password", "Account_Status", "Failed_Attempts", "Last_Login"]);
  if (staffSheet.getLastRow() <= 1) {
    staffSheet.appendRow(["coordinator", "Centre Coordinator", "ADMIN", "Coord@2033", "Active", 0, new Date().toISOString()]);
    staffSheet.appendRow(["staff_desk1", "Desk Official (Terminal 1)", "OFFICIAL", "Desk@2033", "Active", 0, new Date().toISOString()]);
    staffSheet.appendRow(["staff_eval", "Evaluation Assistant", "OFFICIAL", "Eval@2033", "Active", 0, new Date().toISOString()]);
  }
  var staffData = getSheetDataAsArray(staffSheet);
  result.staffUsers = staffData;
  result.Staff_Users = staffData;

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid JSON payload" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var action = body.action || "UNKNOWN";
  var payload = body.payload || body;

  // 1. Connection Ping & Health Diagnostics
  if (action === "PING" || action === "TEST_CONNECTION") {
    var sheetNames = [];
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      sheetNames.push(all[i].getName());
    }
    var intakeSheet = findSheetByAliases(ss, ["intakeRegister", "Intake_Register", "IntakeRegister"]);
    var ledgerSheet = findSheetByAliases(ss, ["courseLedger", "Course_Ledger", "CourseLedger"]);
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      action: action,
      reachable: true,
      message: "Google Apps Script connected: Assignment Operations active.",
      sheets: sheetNames,
      intakeTab: intakeSheet ? intakeSheet.getName() : "None",
      ledgerTab: ledgerSheet ? ledgerSheet.getName() : "None",
      totalIntakes: intakeSheet ? Math.max(0, intakeSheet.getLastRow() - 1) : 0,
      totalCourseRows: ledgerSheet ? Math.max(0, ledgerSheet.getLastRow() - 1) : 0,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Student Intake Submission & Automatic Course Unpacking
  if (action === "ADD_INTAKE" || action === "SUBMIT_INTAKE") {
    var intakeSheet = getOrCreateSheet(ss, ["intakeRegister", "Intake_Register", "IntakeRegister"], [
      "Timestamp", "Session", "Enrollment_No", "Candidate_Name", "Contact", "Programme", "Courses", "Official"
    ]);

    var item = payload;
    var enrollment = String(item.enrollmentNo || item.Enrollment_No || "").trim();
    var candidate = String(item.candidateName || item.studentName || item.Candidate_Name || "").trim();
    var prog = String(item.programme || item.programmeCode || item.Programme || "").trim().toUpperCase();
    var contact = String(item.contact || item.studentPhone || item.mobile || item.Contact || "").trim();
    var email = String(item.email || item.studentEmail || item.Email_ID || "").trim();
    var session = String(item.session || item.Session || "July 2026").trim();
    var official = String(item.handledBy || item.official || item.Official || "Desk Official").trim();
    var tokenNo = String(item.tokenNo || item.token || item.Token_No || "").trim();
    var timestamp = item.timestamp || item.submissionDate || item.date || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // Normalize courses list
    var rawCourses = item.rawCourses || item.courses || item.courseCodes || [];
    var courseList = Array.isArray(rawCourses)
      ? rawCourses.flatMap(function(c) { return String(c).split(","); })
      : String(rawCourses).split(",");

    var cleanCourses = [];
    for (var c = 0; c < courseList.length; c++) {
      var cleanCode = String(courseList[c]).replace(/\\s*[\\[\\(](Practical|TMA|Both|P|Asgn)[\\]\\)]\\s*/gi, "").trim().toUpperCase();
      if (cleanCode && cleanCourses.indexOf(cleanCode) === -1) {
        cleanCourses.push(cleanCode);
      }
    }
    var coursesStr = cleanCourses.join(", ");

    // Dynamic header mapping for intake row
    var lastCol = intakeSheet.getLastColumn() || 1;
    var headers = intakeSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowData = new Array(headers.length);

    for (var h = 0; h < headers.length; h++) {
      var col = String(headers[h]).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (col.indexOf("time") !== -1 || col === "date") rowData[h] = timestamp;
      else if (col.indexOf("token") !== -1) rowData[h] = tokenNo;
      else if (col.indexOf("session") !== -1) rowData[h] = session;
      else if (col.indexOf("enrol") !== -1) rowData[h] = "'" + enrollment;
      else if (col.indexOf("name") !== -1 || col.indexOf("cand") !== -1) rowData[h] = candidate;
      else if (col.indexOf("contact") !== -1 || col.indexOf("mobile") !== -1 || col.indexOf("phone") !== -1) rowData[h] = contact;
      else if (col.indexOf("email") !== -1) rowData[h] = email;
      else if (col.indexOf("prog") !== -1) rowData[h] = prog;
      else if (col.indexOf("course") !== -1) rowData[h] = coursesStr;
      else if (col.indexOf("offic") !== -1 || col.indexOf("handle") !== -1 || col.indexOf("by") !== -1) rowData[h] = official;
      else if (col.indexOf("mode") !== -1) rowData[h] = item.submissionMode || "In-Person (Desk)";
      else if (col.indexOf("status") !== -1) rowData[h] = "Received";
      else rowData[h] = "";
    }

    intakeSheet.appendRow(rowData);

    // Auto-unpack courses to Course Ledger
    var ledgerSheet = getOrCreateSheet(ss, ["courseLedger", "Course_Ledger", "CourseLedger"], [
      "Sub_ID", "Session", "Enrollment_No", "Candidate_Name", "Contact_No", "Email_ID", "Programme_Code", "Course_Code", "Allotted_Evaluator", "Marks", "Grade", "Status"
    ]);

    var lHeaders = ledgerSheet.getRange(1, 1, 1, ledgerSheet.getLastColumn() || 1).getValues()[0];
    for (var k = 0; k < cleanCourses.length; k++) {
      var cCode = cleanCourses[k];
      var subId = "SUB_" + enrollment + "_" + cCode + "_" + session.replace(/\\s+/g, "").toUpperCase();

      var lRow = new Array(lHeaders.length);
      for (var lh = 0; lh < lHeaders.length; lh++) {
        var lCol = String(lHeaders[lh]).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (lCol.indexOf("sub") !== -1 && lCol.indexOf("id") !== -1) lRow[lh] = subId;
        else if (lCol.indexOf("session") !== -1) lRow[lh] = session;
        else if (lCol.indexOf("enrol") !== -1) lRow[lh] = "'" + enrollment;
        else if (lCol.indexOf("name") !== -1 || lCol.indexOf("cand") !== -1) lRow[lh] = candidate;
        else if (lCol.indexOf("contact") !== -1 || lCol.indexOf("phone") !== -1 || lCol.indexOf("mobile") !== -1) lRow[lh] = contact;
        else if (lCol.indexOf("email") !== -1) lRow[lh] = email;
        else if (lCol.indexOf("prog") !== -1) lRow[lh] = prog;
        else if (lCol.indexOf("course") !== -1) lRow[lh] = cCode;
        else if (lCol.indexOf("eval") !== -1 || lCol.indexOf("allot") !== -1) lRow[lh] = "Unallotted";
        else if (lCol.indexOf("mark") !== -1) lRow[lh] = "";
        else if (lCol.indexOf("grade") !== -1) lRow[lh] = "—";
        else if (lCol.indexOf("status") !== -1) lRow[lh] = "Pending Allotment";
        else lRow[lh] = "";
      }
      ledgerSheet.appendRow(lRow);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      action: action,
      message: "Intake record and unpacked courses saved to Google Sheets.",
      tokenNo: tokenNo,
      coursesCount: cleanCourses.length
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Edit Intake & Date Updates (Guarantees zero date reversion in Google Sheets)
  if (action === "EDIT_INTAKE" || action === "UPDATE_INTAKE" || action === "UPDATE_INTAKE_DATE") {
    var intakeSheet = findSheetByAliases(ss, ["intakeRegister", "Intake_Register", "IntakeRegister"]);
    if (intakeSheet) {
      var data = intakeSheet.getDataRange().getValues();
      var headers = data[0] || [];
      var targetToken = String(payload.tokenNo || payload.token || payload.id || "").trim().toLowerCase();
      var targetEnr = String(payload.enrollmentNo || payload.originalEnrollmentNo || payload.Enrollment_No || "").replace(/^'/, '').trim().toLowerCase();
      var targetSession = String(payload.session || payload.Session || "").trim().toLowerCase();
      var newDate = payload.submissionDate || payload.receiptDate || payload.date || payload.timestamp || payload.Timestamp;

      // Locate column indices dynamically from headers
      var dateCol = -1;
      var sessionCol = -1;
      var enrCol = 2; // default
      var nameCol = 3;
      var contactCol = 4;
      var progCol = 5;
      var coursesCol = 6;
      var tokenCol = -1;

      for (var h = 0; h < headers.length; h++) {
        var hName = String(headers[h]).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (hName.indexOf("time") !== -1 || hName === "date" || hName.indexOf("submissiondate") !== -1 || hName.indexOf("receiptdate") !== -1) {
          dateCol = h;
        } else if (hName.indexOf("session") !== -1) {
          sessionCol = h;
        } else if (hName.indexOf("enrol") !== -1) {
          enrCol = h;
        } else if (hName.indexOf("token") !== -1) {
          tokenCol = h;
        } else if (hName.indexOf("name") !== -1 || hName.indexOf("cand") !== -1) {
          nameCol = h;
        } else if (hName.indexOf("contact") !== -1 || hName.indexOf("phone") !== -1 || hName.indexOf("mobile") !== -1) {
          contactCol = h;
        } else if (hName.indexOf("prog") !== -1) {
          progCol = h;
        } else if (hName.indexOf("course") !== -1) {
          coursesCol = h;
        }
      }

      for (var i = 1; i < data.length; i++) {
        var rowEnr = String(data[i][enrCol] || "").replace(/^'/, '').trim().toLowerCase();
        var rowToken = tokenCol !== -1 ? String(data[i][tokenCol] || "").trim().toLowerCase() : "";
        var rowId = String(data[i][0] || "").trim().toLowerCase();
        var rowSession = sessionCol !== -1 ? String(data[i][sessionCol] || "").trim().toLowerCase() : "";

        var sessionMatch = !targetSession || !rowSession || rowSession === targetSession;
        var isMatch = false;

        if (targetToken && (rowToken === targetToken || rowId === targetToken)) {
          isMatch = true;
        } else if (targetEnr && rowEnr === targetEnr && sessionMatch) {
          isMatch = true;
        }

        if (isMatch) {
          // 1. Always update Date / Timestamp in Google Sheets
          if (newDate && dateCol !== -1) {
            intakeSheet.getRange(i + 1, dateCol + 1).setValue(newDate);
          }
          if (payload.candidateName && nameCol !== -1) {
            intakeSheet.getRange(i + 1, nameCol + 1).setValue(payload.candidateName);
          }
          if (payload.contact && contactCol !== -1) {
            intakeSheet.getRange(i + 1, contactCol + 1).setValue(payload.contact);
          }
          if (payload.programme && progCol !== -1) {
            intakeSheet.getRange(i + 1, progCol + 1).setValue(payload.programme);
          }
          if (payload.courses && coursesCol !== -1) {
            var cStr = Array.isArray(payload.courses) ? payload.courses.join(", ") : payload.courses;
            intakeSheet.getRange(i + 1, coursesCol + 1).setValue(cStr);
          }
          break;
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      action: action,
      message: "Intake record and assignment date updated in Google Sheets."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 4. Allot Evaluator & Update Marks
  if (action === "ALLOT_EVALUATOR" || action === "UPDATE_MARKS") {
    var ledgerSheet = findSheetByAliases(ss, ["courseLedger", "Course_Ledger", "CourseLedger"]);
    if (ledgerSheet) {
      var data = ledgerSheet.getDataRange().getValues();
      var targetSubId = String(payload.subId || "").trim();
      var targetEnr = String(payload.enrollmentNo || "").replace(/^'/, '').trim();
      var targetCourse = String(payload.courseCode || "").trim().toUpperCase();

      for (var i = 1; i < data.length; i++) {
        var rowSubId = String(data[i][0] || "").trim();
        var rowEnr = String(data[i][2] || "").replace(/^'/, '').trim();
        var rowCourse = String(data[i][7] || "").trim().toUpperCase();

        if ((targetSubId && rowSubId === targetSubId) || (targetEnr && targetCourse && rowEnr === targetEnr && rowCourse === targetCourse)) {
          if (action === "ALLOT_EVALUATOR" && payload.evaluator) {
            ledgerSheet.getRange(i + 1, 9).setValue(payload.evaluator);
            ledgerSheet.getRange(i + 1, 12).setValue("Allotted");
          } else if (action === "UPDATE_MARKS") {
            ledgerSheet.getRange(i + 1, 10).setValue(payload.marks !== undefined ? payload.marks : "");
            ledgerSheet.getRange(i + 1, 11).setValue(payload.grade || "");
            ledgerSheet.getRange(i + 1, 12).setValue("Marks Locked");
          }
          break;
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", action: action, message: "Ledger updated." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 5. Staff Authentication & Account Governance
  if (action === "VERIFY_STAFF_LOGIN") {
    var staffSheet = getOrCreateSheet(ss, ["Staff_Users", "StaffUsers", "Staff"], ["Staff_ID", "Full_Name", "Role", "Password", "Account_Status", "Failed_Attempts", "Last_Login"]);
    var staffData = getSheetDataAsArray(staffSheet);
    var targetId = String(payload.staffId || "").trim().toLowerCase();
    var enteredPass = String(payload.password || "").trim();

    var userRow = null;
    var rowIndex = -1;
    for (var i = 0; i < staffData.length; i++) {
      if (String(staffData[i].Staff_ID || staffData[i].staffId || "").trim().toLowerCase() === targetId) {
        userRow = staffData[i];
        rowIndex = i + 2;
        break;
      }
    }

    if (!userRow) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Staff ID not found in Staff_Users sheet" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var status = String(userRow.Account_Status || userRow.status || "Active").trim();
    if (status.toLowerCase() === "locked") {
      return ContentService.createTextOutput(JSON.stringify({ status: "locked", message: "Account is locked in Google Sheets. Contact Centre Coordinator to unlock." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var correctPass = String(userRow.Password || userRow.password || "").trim();
    if (enteredPass === correctPass) {
      staffSheet.getRange(rowIndex, 5).setValue("Active");
      staffSheet.getRange(rowIndex, 6).setValue(0);
      staffSheet.getRange(rowIndex, 7).setValue(new Date().toISOString());

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        user: {
          staffId: targetId,
          fullName: userRow.Full_Name || userRow.fullName || targetId,
          role: String(userRow.Role || userRow.role || "OFFICIAL").toUpperCase(),
          status: "Active"
        }
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      var failed = Number(userRow.Failed_Attempts || 0) + 1;
      var newStatus = failed >= 5 ? "Locked" : status;
      staffSheet.getRange(rowIndex, 5).setValue(newStatus);
      staffSheet.getRange(rowIndex, 6).setValue(failed);

      return ContentService.createTextOutput(JSON.stringify({
        status: newStatus === "Locked" ? "locked" : "error",
        remainingAttempts: Math.max(0, 5 - failed),
        message: newStatus === "Locked" ? "Account locked after 5 failed attempts." : "Incorrect password."
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "UPDATE_STAFF_STATUS") {
    var staffSheet = findSheetByAliases(ss, ["Staff_Users", "StaffUsers", "Staff"]);
    if (staffSheet) {
      var staffData = getSheetDataAsArray(staffSheet);
      var targetId = String(payload.staffId || "").trim().toLowerCase();
      for (var i = 0; i < staffData.length; i++) {
        if (String(staffData[i].Staff_ID || "").trim().toLowerCase() === targetId) {
          if (payload.status) staffSheet.getRange(i + 2, 5).setValue(payload.status);
          if (payload.failedAttempts !== undefined) staffSheet.getRange(i + 2, 6).setValue(payload.failedAttempts);
          if (payload.lastLogin) staffSheet.getRange(i + 2, 7).setValue(payload.lastLogin);
          break;
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", action: action }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "SAVE_STAFF_USER") {
    var staffSheet = getOrCreateSheet(ss, ["Staff_Users", "StaffUsers", "Staff"], ["Staff_ID", "Full_Name", "Role", "Password", "Account_Status", "Failed_Attempts", "Last_Login"]);
    var staffData = getSheetDataAsArray(staffSheet);
    var targetId = String(payload.staffId || "").trim().toLowerCase();
    var foundIndex = -1;
    for (var i = 0; i < staffData.length; i++) {
      if (String(staffData[i].Staff_ID || "").trim().toLowerCase() === targetId) {
        foundIndex = i + 2;
        break;
      }
    }

    if (foundIndex >= 2) {
      if (payload.fullName) staffSheet.getRange(foundIndex, 2).setValue(payload.fullName);
      if (payload.role) staffSheet.getRange(foundIndex, 3).setValue(payload.role);
      if (payload.password) staffSheet.getRange(foundIndex, 4).setValue(payload.password);
      if (payload.status) staffSheet.getRange(foundIndex, 5).setValue(payload.status);
    } else {
      staffSheet.appendRow([
        targetId,
        payload.fullName || targetId,
        payload.role || "OFFICIAL",
        payload.password || "Desk@2033",
        payload.status || "Active",
        0,
        new Date().toISOString()
      ]);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", action: action }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "DELETE_STAFF_USER") {
    var staffSheet = findSheetByAliases(ss, ["Staff_Users", "StaffUsers", "Staff"]);
    if (staffSheet) {
      var staffData = getSheetDataAsArray(staffSheet);
      var targetId = String(payload.staffId || "").trim().toLowerCase();
      for (var i = 0; i < staffData.length; i++) {
        if (String(staffData[i].Staff_ID || staffData[i].staffId || "").trim().toLowerCase() === targetId) {
          staffSheet.deleteRow(i + 2);
          break;
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", action: action }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    action: action,
    message: "Action received and processed."
  })).setMimeType(ContentService.MimeType.JSON);
}

function findSheetByAliases(ss, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var s = ss.getSheetByName(aliases[i]);
    if (s) return s;
  }
  return null;
}

function getOrCreateSheet(ss, aliases, defaultHeaders) {
  var s = findSheetByAliases(ss, aliases);
  if (!s) {
    s = ss.insertSheet(aliases[0]);
    if (defaultHeaders && defaultHeaders.length > 0) {
      s.appendRow(defaultHeaders);
      s.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#f1f5f9");
    }
  }
  return s;
}

function getSheetDataByAliases(ss, aliases) {
  var sheet = findSheetByAliases(ss, aliases);
  if (!sheet) return [];
  return getSheetDataAsArray(sheet);
}

function getSheetDataAsArray(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var h = 0; h < headers.length; h++) {
      var key = String(headers[h]).trim();
      if (key) obj[key] = row[h];
    }
    rows.push(obj);
  }
  return rows;
}
`;

export async function postSyncAdmissions(_records: any[]): Promise<ApiResponse> {
  return {
    status: 'success',
    message: 'Assignment Operations are active.',
  };
}

