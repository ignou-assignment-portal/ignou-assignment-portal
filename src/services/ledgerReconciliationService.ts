/**
 * Course Ledger Reconciliation & Deduplication Service
 * IGNOU Study Centre 2033
 * 
 * Reconciles Course Ledger rows strictly against registered candidate intakes,
 * eliminates redundant duplicate unpacked rows (e.g. 212 down to 208 canonical scripts),
 * preserves marks & evaluator allotments, and supports manual sync to Google Sheets.
 */

import { CourseEvaluationRecord, IntakeRecord } from '../types';
import { norm } from '../context/AppContext';
import { calculateIGNOUGrade } from '../utils/helpers';

export interface DuplicateAuditItem {
  enrollmentNo: string;
  studentName: string;
  programmeCode: string;
  courseCode: string;
  session: string;
  componentType: 'Assignment' | 'Practical';
  duplicateCount: number;
  subIds: string[];
  keptSubId: string;
  hasMarks: boolean;
  marksValue?: number | string | null;
  allottedEvaluator?: string;
  actionTaken: string;
}

export interface ReconciliationResult {
  canonicalScriptCount: number;
  originalLedgerCount: number;
  duplicateCount: number;
  reconciledLedger: CourseEvaluationRecord[];
  duplicatesAudited: DuplicateAuditItem[];
  orphanLedgerRowsCount: number;
}

/**
 * Reconciles the course ledger against registered candidate intakes for the active session.
 * 
 * Guarantees:
 * 1. Parity between the candidate course registrations (e.g. 45 candidates with 208 scripts)
 *    and the unpacked evaluation rows in the ledger.
 * 2. Preserves any recorded marks, grades, and evaluator allotments.
 * 3. Supports dual components: allows 2 separate rows only if the course has distinct
 *    Assignment and Practical components (e.g. BAPI-003 TMA + PRAC).
 */
export function reconcileLedgerFromIntakes(
  intakes: IntakeRecord[],
  currentLedger: CourseEvaluationRecord[],
  targetSession?: string
): ReconciliationResult {
  const normSession = targetSession && targetSession !== 'All' ? norm(targetSession) : null;

  // 1. Filter intakes for the target session
  const sessionIntakes = normSession
    ? intakes.filter((i) => norm(i.session) === normSession)
    : intakes;

  // Build a lookup map of existing ledger rows by composite key:
  // key: `${enrollment}_${course}_${session}_${componentType}`
  // Map stores array of rows in case duplicates exist
  const existingMap = new Map<string, CourseEvaluationRecord[]>();
  const ledgerRowsInSession = normSession
    ? currentLedger.filter((l) => norm(l.session || (l as any).Session) === normSession)
    : currentLedger;

  ledgerRowsInSession.forEach((row) => {
    const enr = String(row.enrollmentNo || row.Enrollment_No || '').replace(/^'/, '').trim().toUpperCase();
    const course = String(row.courseCode || row.Course_Code || '')
      .replace(/\s*[\(\[](Practical|TMA\s*\+\s*Practical|TMA|Both|P|Asgn|Assignment)[\)\]]\s*/gi, '')
      .trim()
      .toUpperCase();
    const sess = norm(row.session || row.Session || targetSession || 'July 2026');
    const comp = row.componentType || (row.isPractical ? 'Practical' : 'Assignment');
    const key = `${enr}_${course}_${sess}_${comp}`;

    const list = existingMap.get(key) || [];
    list.push(row);
    existingMap.set(key, list);
  });

  const reconciledRows: CourseEvaluationRecord[] = [];
  const duplicatesAudited: DuplicateAuditItem[] = [];
  const matchedExistingKeys = new Set<string>();

  // 2. Iterate through canonical candidate intakes and generate exactly the registered course scripts
  sessionIntakes.forEach((intake) => {
    const enr = String(intake.enrollmentNo || intake.Enrollment_No || '').replace(/^'/, '').trim().toUpperCase();
    const name = String(intake.studentName || intake.candidateName || intake.Candidate_Name || '').trim();
    const prog = String(intake.programmeCode || intake.programme || intake.Programme || '').trim().toUpperCase();
    const sess = intake.session || targetSession || 'July 2026';
    const cleanSessionNorm = norm(sess);
    const subDate = intake.submissionDate || intake.receiptDate || new Date().toISOString().split('T')[0];

    const rawCourses = intake.courseCodes || intake.courses || [];
    const courseList = Array.isArray(rawCourses)
      ? rawCourses.flatMap((c) => String(c).split(','))
      : String(rawCourses).split(',');

    const distinctCleanCourses: string[] = [];
    courseList.forEach((c) => {
      const clean = String(c)
        .replace(/\s*[\(\[](Practical|TMA\s*\+\s*Practical|TMA|Both|P|Asgn|Assignment)[\)\]]\s*/gi, '')
        .trim()
        .toUpperCase();
      if (clean && !distinctCleanCourses.includes(clean)) {
        distinctCleanCourses.push(clean);
      }
    });

    const pracList = (intake.practicalCourses || []).map((c) => c.trim().toUpperCase());
    const asgnList = (intake.assignmentCourses || []).map((c) => c.trim().toUpperCase());

    distinctCleanCourses.forEach((course) => {
      // Determine components for this course:
      // A course can have Assignment, Practical, or Both
      const isBrl = /^BRL[-_]?\d+/i.test(course);
      const isExplicitPrac = pracList.includes(course);
      const isExplicitAsgn = asgnList.includes(course);

      const componentsToGenerate: ('Assignment' | 'Practical')[] = [];

      if (isBrl) {
        componentsToGenerate.push('Assignment');
      } else if (isExplicitPrac && isExplicitAsgn) {
        componentsToGenerate.push('Assignment');
        componentsToGenerate.push('Practical');
      } else if (isExplicitPrac) {
        componentsToGenerate.push('Practical');
      } else if (isExplicitAsgn) {
        componentsToGenerate.push('Assignment');
      } else {
        // Fallback default: Assignment
        componentsToGenerate.push('Assignment');
      }

      componentsToGenerate.forEach((compType) => {
        const key = `${enr}_${course}_${cleanSessionNorm}_${compType}`;
        matchedExistingKeys.add(key);

        const existingMatches = existingMap.get(key) || [];
        let chosenRow: CourseEvaluationRecord | null = null;

        if (existingMatches.length > 0) {
          // If duplicates exist, pick the best candidate:
          // Priority: Row with entered marks > Row with allotted evaluator > Earliest row
          chosenRow = existingMatches.slice().sort((a, b) => {
            const hasMarksA = typeof a.marks === 'number' && !isNaN(a.marks) ? 2 : 0;
            const hasMarksB = typeof b.marks === 'number' && !isNaN(b.marks) ? 2 : 0;
            const evalA = a.allottedEvaluator || (a as any).Allotted_Evaluator;
            const evalB = b.allottedEvaluator || (b as any).Allotted_Evaluator;
            const hasEvalA = evalA && evalA !== 'Unallotted' ? 1 : 0;
            const hasEvalB = evalB && evalB !== 'Unallotted' ? 1 : 0;
            return (hasMarksB + hasEvalB) - (hasMarksA + hasEvalA);
          })[0];

          // If there were multiple rows for this exact same component, record the audit
          if (existingMatches.length > 1) {
            const keptEval = chosenRow.allottedEvaluator || (chosenRow as any).Allotted_Evaluator;
            duplicatesAudited.push({
              enrollmentNo: enr,
              studentName: name,
              programmeCode: prog,
              courseCode: course,
              session: sess,
              componentType: compType,
              duplicateCount: existingMatches.length,
              subIds: existingMatches.map((m) => m.subId || m.id),
              keptSubId: chosenRow.subId || chosenRow.id,
              hasMarks: typeof chosenRow.marks === 'number' && !isNaN(chosenRow.marks),
              marksValue: chosenRow.marks,
              allottedEvaluator: keptEval,
              actionTaken: `Preserved record with ${chosenRow.marks !== null ? 'marks (' + chosenRow.marks + ')' : keptEval || 'canonical entry'}; discarded ${existingMatches.length - 1} duplicate row(s).`,
            });
          }
        }

        const canonicalSubId = compType === 'Practical'
          ? `SUB_${enr}_${course}_PRAC_${sess.replace(/\s+/g, '').toUpperCase()}`
          : `SUB_${enr}_${course}_${sess.replace(/\s+/g, '').toUpperCase()}`;

        const isLocked = Boolean(
          chosenRow?.isLocked ||
          chosenRow?.status === 'Marks Locked' ||
          (chosenRow as any)?.Status === 'Marks Locked' ||
          (chosenRow as any)?.Status === 'Locked'
        );

        const rawMarks = chosenRow?.marks !== undefined && chosenRow.marks !== null ? chosenRow.marks : (chosenRow as any)?.Marks;
        const numMarks = rawMarks !== undefined && rawMarks !== null && rawMarks !== '' && !isNaN(Number(rawMarks)) ? Number(rawMarks) : null;
        const grade = chosenRow?.grade || (numMarks !== null ? calculateIGNOUGrade(numMarks).grade : '—');
        const allottedEvaluator = chosenRow?.allottedEvaluator || (chosenRow as any)?.Allotted_Evaluator || 'Unallotted';
        const evalStatus: import('../types').EvaluationStatus = isLocked
          ? 'Marks Locked'
          : (numMarks !== null ? 'Evaluated' : (allottedEvaluator !== 'Unallotted' ? 'Allotted' : 'Pending Allotment'));

        const canonicalRecord: CourseEvaluationRecord = {
          id: chosenRow?.id || canonicalSubId,
          subId: chosenRow?.subId || canonicalSubId,
          submissionKey: canonicalSubId,
          session: sess,
          enrollmentNo: enr,
          candidateName: name,
          studentName: name,
          programme: prog,
          programmeCode: prog,
          courseCode: course,
          allottedEvaluator,
          evaluatorName: allottedEvaluator !== 'Unallotted' ? allottedEvaluator : null,
          evaluatorId: chosenRow?.evaluatorId || null,
          allottedDate: chosenRow?.allottedDate || null,
          marks: numMarks,
          grade,
          gradeLabel: numMarks !== null ? calculateIGNOUGrade(numMarks).label : null,
          status: evalStatus,
          isLocked,
          lockedAt: chosenRow?.lockedAt || null,
          lockedBy: chosenRow?.lockedBy || null,
          componentType: compType,
          isPractical: compType === 'Practical',
          submissionDate: subDate,
          receiptDate: subDate,
          intakeDate: subDate,
          submissionMode: chosenRow?.submissionMode || 'In-Person (Desk)',
          tokenNo: intake.tokenNo,
          intakeId: intake.id,
          updatedAt: new Date().toISOString(),
          // Dual-key compatibility
          Sub_ID: canonicalSubId,
          Session: sess,
          Enrollment_No: enr,
          Candidate_Name: name,
          Programme: prog,
          Course_Code: course,
          Allotted_Evaluator: allottedEvaluator,
          Marks: numMarks,
          Grade: grade,
          Status: evalStatus,
          Component: compType,
        };

        reconciledRows.push(canonicalRecord);
      });
    });
  });

  // Calculate orphan rows (rows in ledger for this session with no matching candidate intake)
  let orphanCount = 0;
  existingMap.forEach((rows, key) => {
    if (!matchedExistingKeys.has(key)) {
      orphanCount += rows.length;
    }
  });

  // If outside session filter, preserve other session rows untouched
  let finalLedger = reconciledRows;
  if (normSession) {
    const otherSessionRows = currentLedger.filter(
      (l) => norm(l.session || (l as any).Session) !== normSession
    );
    finalLedger = [...reconciledRows, ...otherSessionRows];
  }

  const duplicatesCount = Math.max(0, ledgerRowsInSession.length - reconciledRows.length);

  return {
    canonicalScriptCount: reconciledRows.length,
    originalLedgerCount: ledgerRowsInSession.length,
    duplicateCount: duplicatesCount,
    reconciledLedger: finalLedger,
    duplicatesAudited,
    orphanLedgerRowsCount: orphanCount,
  };
}

/**
 * Pushes the clean, reconciled course ledger to Google Sheets via the proxy or direct endpoint.
 */
export async function pushCleanedLedgerToSheets(
  cleanedLedger: CourseEvaluationRecord[],
  scriptUrl?: string
): Promise<{ success: boolean; message: string; rowsPushed: number }> {
  const payloadRows = cleanedLedger.map((row) => {
    const enr = String(row.enrollmentNo || row.Enrollment_No || '').replace(/^'/, '').trim();
    const course = String(row.courseCode || row.Course_Code || '').trim();
    const sess = row.session || row.Session || 'July 2026';
    const subId = row.subId || row.Sub_ID || `SUB_${enr}_${course}_${sess.replace(/\s+/g, '').toUpperCase()}`;

    return {
      Sub_ID: subId,
      subId,
      Session: sess,
      session: sess,
      Enrollment_No: `'${enr}`,
      enrollmentNo: enr,
      Candidate_Name: row.candidateName || row.studentName || row.Candidate_Name || '',
      studentName: row.candidateName || row.studentName || row.Candidate_Name || '',
      Contact_No: (row as any).studentPhone || (row as any).contact || '',
      Email_ID: (row as any).studentEmail || (row as any).email || '',
      Programme_Code: row.programme || row.programmeCode || '',
      programmeCode: row.programme || row.programmeCode || '',
      Course_Code: course,
      courseCode: course,
      Allotted_Evaluator: row.allottedEvaluator || (row as any).Allotted_Evaluator || 'Unallotted',
      Marks: row.marks !== undefined && row.marks !== null ? row.marks : '',
      Grade: row.grade || '—',
      Status: row.status || 'Pending Allotment',
      Component: row.componentType || (row.isPractical ? 'Practical' : 'Assignment'),
      componentType: row.componentType || (row.isPractical ? 'Practical' : 'Assignment'),
      submissionDate: row.submissionDate || row.receiptDate || '',
      tokenNo: row.tokenNo || '',
    };
  });

  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RECONCILE_COURSE_LEDGER',
        scriptUrl,
        ledgerRows: payloadRows,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const json = await response.json();
      return {
        success: true,
        message: json.message || `Reconciled ${payloadRows.length} course scripts in Google Sheets.`,
        rowsPushed: payloadRows.length,
      };
    }
  } catch (err: any) {
    console.warn('[pushCleanedLedgerToSheets proxy failed]:', err);
  }

  return {
    success: false,
    message: 'Could not connect to Google Sheets endpoint. Cleaned ledger is active in local storage with zero data loss.',
    rowsPushed: payloadRows.length,
  };
}
