import * as XLSX from 'xlsx';
import { StudentRegistrationRecord, RegistrationCadre, AcademicYearLevel } from '../types';
import { normalizeSessionName } from './sheetsService';

export interface ColumnMapping {
  enrollmentKey: string;
  nameKey: string;
  programmeKey: string;
  coursesKey: string;
  phoneKey: string;
  emailKey: string;
  cadreKey?: string;
  yearKey?: string;
  sessionKey?: string;
}

export interface ParsedExcelResult {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rawRows: Record<string, any>[];
  detectedMapping: ColumnMapping;
  detectedCadre?: RegistrationCadre;
  detectedSession?: string;
}

export interface ValidationItem {
  rowIndex: number;
  record: Partial<StudentRegistrationRecord>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Fuzzy matches header name against common aliases
 */
function findBestHeaderMatch(headers: string[], aliases: string[]): string {
  const cleanAliases = aliases.map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const h of headers) {
    const cleanH = String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanAliases.includes(cleanH)) {
      return h;
    }
  }
  for (const h of headers) {
    const cleanH = String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const a of cleanAliases) {
      if (cleanH.includes(a) || a.includes(cleanH)) {
        return h;
      }
    }
  }
  return '';
}

/**
 * Parses uploaded Excel / CSV File into structured sheet data and auto-detects columns
 */
export async function parseExcelSpreadsheet(file: File): Promise<ParsedExcelResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('The uploaded spreadsheet contains no readable worksheets.');
  }

  const activeSheet = sheetNames[0];
  const worksheet = workbook.Sheets[activeSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('The worksheet is empty. Please verify data rows.');
  }

  // Extract all distinct column headers
  const headersSet = new Set<string>();
  rawRows.forEach((row) => {
    Object.keys(row).forEach((k) => headersSet.add(k));
  });
  const headers = Array.from(headersSet);

  // Auto-detect mappings
  const detectedMapping: ColumnMapping = {
    enrollmentKey: findBestHeaderMatch(headers, [
      'enrolmentno',
      'enrollmentno',
      'enrolment',
      'enrollment',
      'enrno',
      'enr_no',
      'student_id',
      'studentid',
      'rollno',
      'roll_no',
    ]),
    nameKey: findBestHeaderMatch(headers, [
      'studentname',
      'candidatename',
      'name',
      'student_name',
      'candidate_name',
      'learnername',
    ]),
    programmeKey: findBestHeaderMatch(headers, [
      'programmecode',
      'programme',
      'program',
      'prog',
      'progcode',
      'course_programme',
    ]),
    coursesKey: findBestHeaderMatch(headers, [
      'courses',
      'course_codes',
      'coursecodes',
      'subjects',
      'papers',
      'enrolledcourses',
      'courses_registered',
      'courses_taken',
    ]),
    phoneKey: findBestHeaderMatch(headers, [
      'mobile',
      'phone',
      'contact',
      'studentphone',
      'mobileno',
      'contactno',
      'telephone',
    ]),
    emailKey: findBestHeaderMatch(headers, [
      'email',
      'emailid',
      'studentemail',
      'mail',
      'email_id',
    ]),
    cadreKey: findBestHeaderMatch(headers, [
      'cadre',
      'type',
      'registrationtype',
      'admissiontype',
      'category',
      'registration_cadre',
    ]),
    yearKey: findBestHeaderMatch(headers, [
      'year',
      'academicyear',
      'yr',
      'yearlevel',
      'level',
      'semester',
      'sem',
    ]),
    sessionKey: findBestHeaderMatch(headers, [
      'session',
      'admissionsession',
      'cycle',
      'sessioncycle',
      'batch',
    ]),
  };

  // Detect session and cadre from filename or active sheet name
  let detectedCadre: RegistrationCadre | undefined = undefined;
  let detectedSession: string | undefined = undefined;

  const combinedName = `${file.name || ''} ${activeSheet || ''}`.toLowerCase();
  if (combinedName.includes('rr') || combinedName.includes('re-reg') || combinedName.includes('rereg') || combinedName.includes('2nd') || combinedName.includes('3rd')) {
    detectedCadre = 'RE_REGISTRATION';
  } else if (combinedName.includes('fresh') || combinedName.includes('1st') || combinedName.includes('new')) {
    detectedCadre = 'FRESH';
  }

  if (combinedName.includes('jan') && combinedName.includes('2025')) {
    detectedSession = 'January 2025';
  } else if (combinedName.includes('jul') && combinedName.includes('2025')) {
    detectedSession = 'July 2025';
  } else if (combinedName.includes('jan') && combinedName.includes('2026')) {
    detectedSession = 'January 2026';
  } else if (combinedName.includes('jul') && combinedName.includes('2026')) {
    detectedSession = 'July 2026';
  } else if (combinedName.includes('jan') && combinedName.includes('2027')) {
    detectedSession = 'January 2027';
  }

  return {
    sheetNames,
    activeSheet,
    headers,
    rawRows,
    detectedMapping,
    detectedCadre,
    detectedSession,
  };
}

/**
 * Normalizes course codes from string or array into clean uppercase codes
 */
export function normalizeCourseList(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  }
  const str = String(val).trim();
  if (!str) return [];

  // Split by comma, semicolon, slash, pipe, or multiple spaces
  return str
    .split(/[,;\/|\n]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c.length >= 3);
}

/**
 * Infers or standardizes academic year level
 */
export function inferAcademicYear(val: any, defaultCadre: RegistrationCadre): AcademicYearLevel {
  if (!val) {
    return defaultCadre === 'FRESH' ? '1st Year' : '2nd Year';
  }
  const str = String(val).trim().toLowerCase();
  if (str.includes('3') || str.includes('third') || str.includes('iii') || str.includes('3rd')) return '3rd Year';
  if (str.includes('2') || str.includes('second') || str.includes('ii') || str.includes('2nd')) return '2nd Year';
  if (str.includes('1') || str.includes('first') || str.includes('i') || str.includes('1st')) return '1st Year';
  if (str.includes('sem')) return 'Semester';
  return defaultCadre === 'FRESH' ? '1st Year' : '2nd Year';
}

/**
 * Generates composite unique key for a registration entry
 * A student can be enrolled in multiple sessions (e.g. Jan 2025, July 2025, Jan 2026) and academic years (1st, 2nd, 3rd)
 */
export function getRegistrationCompositeKey(
  enrollmentNo: string,
  session: string,
  academicYear?: string,
  cadre?: string
): string {
  const cleanEnr = (enrollmentNo || '').trim().toUpperCase();
  const normalizedSess = normalizeSessionName(session || 'July 2026').trim().toUpperCase();
  const cleanYr = (academicYear || '1st Year').trim().toUpperCase();
  const cleanCadre = (cadre || 'FRESH').trim().toUpperCase();
  return `${cleanEnr}__${normalizedSess}__${cleanYr}__${cleanCadre}`;
}

/**
 * Maps raw rows into validated candidate registration items
 */
export function validateAndMapRows(
  rows: Record<string, any>[],
  mapping: ColumnMapping,
  defaultCadre: RegistrationCadre,
  defaultSession: string,
  existingKeys: Set<string>
): ValidationItem[] {
  const normalizedDefaultSession = normalizeSessionName(defaultSession || 'July 2026');

  // Track within-file duplicates to avoid duplicate counting within the exact same upload
  const fileSeenKeys = new Set<string>();

  return rows.map((row, idx) => {
    const rawEnroll = mapping.enrollmentKey ? String(row[mapping.enrollmentKey] || '').trim() : '';
    const cleanEnroll = rawEnroll.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
    const studentName = mapping.nameKey ? String(row[mapping.nameKey] || '').trim() : '';
    const rawProg = mapping.programmeKey ? String(row[mapping.programmeKey] || '').trim().toUpperCase() : '';
    const rawCourses = mapping.coursesKey ? row[mapping.coursesKey] : '';
    const courseCodes = normalizeCourseList(rawCourses);
    const rawPhone = mapping.phoneKey ? String(row[mapping.phoneKey] || '').trim() : '';
    const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
    const studentEmail = mapping.emailKey ? String(row[mapping.emailKey] || '').trim() : '';

    // Determine Cadre (Fresh vs Re-Registration)
    let cadre: RegistrationCadre = defaultCadre;
    if (mapping.cadreKey && row[mapping.cadreKey]) {
      const cStr = String(row[mapping.cadreKey]).toLowerCase();
      if (cStr.includes('re') || cStr.includes('rr') || cStr.includes('2nd') || cStr.includes('3rd')) {
        cadre = 'RE_REGISTRATION';
      } else if (cStr.includes('fresh') || cStr.includes('1st') || cStr.includes('new')) {
        cadre = 'FRESH';
      }
    }

    const academicYear = inferAcademicYear(mapping.yearKey ? row[mapping.yearKey] : '', cadre);
    const rawSessionVal = mapping.sessionKey && row[mapping.sessionKey] ? String(row[mapping.sessionKey]).trim() : '';
    const resolvedSession = rawSessionVal ? normalizeSessionName(rawSessionVal) : normalizedDefaultSession;
    const sessionCycle = resolvedSession.toLowerCase().includes('jan') ? 'January' : 'July';
    const yearMatch = resolvedSession.match(/\d{4}/);
    const sessionYear = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!cleanEnroll) {
      errors.push('Missing Enrollment Number');
    } else if (cleanEnroll.length < 8) {
      warnings.push('Enrollment number is shorter than 9 digits');
    }

    const compositeKey = getRegistrationCompositeKey(cleanEnroll, resolvedSession, academicYear, cadre);
    if (fileSeenKeys.has(compositeKey)) {
      warnings.push('Duplicate entry in current spreadsheet for this session & year');
    } else {
      fileSeenKeys.add(compositeKey);
    }

    if (existingKeys.has(compositeKey)) {
      warnings.push('Record already exists in this session & year (will be merged based on preference)');
    }

    if (!studentName) {
      errors.push('Missing Candidate Name');
    }

    if (!rawProg) {
      warnings.push('Missing Programme Code');
    }

    if (courseCodes.length === 0) {
      warnings.push('No course codes detected');
    }

    const record: Partial<StudentRegistrationRecord> = {
      id: `REG-${cleanEnroll}-${resolvedSession.replace(/\s+/g, '')}-${academicYear.replace(/\s+/g, '')}-${cadre}`,
      cadre,
      academicYear,
      enrollmentNo: cleanEnroll,
      studentName: studentName.toUpperCase(),
      programmeCode: rawProg,
      session: resolvedSession,
      sessionCycle,
      sessionYear,
      courseCodes,
      studentPhone: cleanPhone,
      studentEmail,
      registrationDate: new Date().toISOString().split('T')[0],
      status: 'Confirmed',
      studyCentreCode: '2033',
      regionalCentreCode: 'RC-20',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      rowIndex: idx + 1,
      record,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  });
}

/**
 * Exports registration records into a formatted Excel spreadsheet file
 */
export function exportRegistrationsToExcel(
  records: StudentRegistrationRecord[],
  filenamePrefix: string = 'IGNOU_SC2033_Student_Registrations'
): void {
  const exportData = records.map((r, idx) => ({
    'S.No.': idx + 1,
    'Enrollment No': r.enrollmentNo,
    'Candidate Name': r.studentName,
    'Programme': r.programmeCode,
    'Cadre': r.cadre === 'FRESH' ? 'Fresh (1st Year)' : 'Re-Registration',
    'Academic Year': r.academicYear,
    'Session': r.session,
    'Courses Taken': r.courseCodes.join(', '),
    'Courses Count': r.courseCodes.length,
    'Mobile Number': r.studentPhone || '',
    'Email Address': r.studentEmail || '',
    'Status': r.status,
    'Registration Date': r.registrationDate,
    'Study Centre': r.studyCentreCode || '2033',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateStr}.xlsx`);
}
