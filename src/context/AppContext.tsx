import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  UserRole,
  IntakeRecord,
  Evaluator,
  CoursePacket,
  RemunerationBill,
  SystemSettings,
  SubmissionMode,
  AssignmentSubmission,
  SubmissionStatusType,
  RegistrationReceipt,
  RegistrationReceiptFees,
  CourseEvaluationRecord,
  EvaluationStatus,
  IGNOUProgramme,
  IGNOUCourse,
  SessionArchiveRecord,
  AppTheme,
  AuditLogEntry,
} from '../types';
import { THEMES, THEME_STORAGE_KEY, getInitialTheme, applyThemeToDOM } from '../utils/theme';
import {
  INITIAL_SETTINGS,
  INITIAL_EVALUATORS,
  INITIAL_INTAKE_RECORDS,
  INITIAL_PACKETS,
  INITIAL_BILLS,
  INITIAL_ASSIGNMENT_SUBMISSIONS,
  INITIAL_REGISTRATION_RECEIPTS,
  INITIAL_COURSE_EVALUATIONS,
  IGNOU_PROGRAMMES,
  INITIAL_AUDIT_LOGS,
} from '../data/ignouMasterData';
import {
  EXTENDED_IGNOU_PROGRAMMES,
  formatIgnouCourseCode,
  lookupCatalogCourse,
  cleanIgnouTitle,
} from '../data/ignouComprehensiveCatalog';
import { generateSessionCode, generateDeterministicSubmissionKey, calculateIGNOUGrade, getIgnouGrade, formatDate } from '../utils/helpers';
import { doGet, postAddIntake, postEditIntake, postDeleteIntake, postUpdateMarks, postAllotEvaluator, SCRIPT_URL, normalizeSessionName, norm } from '../services/sheetsService';

export { normalizeSessionName, norm };
export const normalizeSession = (s: any): string => norm(s);

interface AppContextType {
  // Session Isolation
  currentSession: string;
  setSession: (session: string) => void;
  availableSessions: string[];
  addSession: (newSession: string) => void;

  // RBAC
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
  isAdmin: boolean;
  isOfficial: boolean;
  isUrlLockedDeskMode: boolean;
  isAdminPinModalOpen: boolean;
  adminPinError: string | null;
  openAdminPinModal: () => void;
  closeAdminPinModal: () => void;
  verifyAndSetAdminRole: (pin: string) => boolean;

  // Gatekeeper Authentication & RBAC (SC-2033)
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  userRole: string;
  setUserRole: (role: string) => void;
  securityPins: { deskPin: string; adminPin: string };
  setSecurityPins: React.Dispatch<React.SetStateAction<{ deskPin: string; adminPin: string }>>;
  updateSecurityPins: (newPins: { deskPin: string; adminPin: string }) => void;
  handleLogin: (role: 'desk' | 'admin', inputPin: string) => boolean;
  logout: () => void;

  // Intake Master (Strictly Session Filtered)
  sessionIntakes: IntakeRecord[];
  allIntakes: IntakeRecord[];
  intakeRegister: IntakeRecord[];
  setIntakeRegister: React.Dispatch<React.SetStateAction<IntakeRecord[]>>;
  syncStatus: string;
  addIntakeRecord: (record: Omit<IntakeRecord, 'id' | 'session' | 'tokenNo' | 'createdAt' | 'marks'> & { marks?: Record<string, number | null> }) => IntakeRecord;
  updateIntakeRecord: (id: string, updates: Partial<IntakeRecord>) => void;
  editIntakeEntry: (params: {
    id: string;
    originalEnrollmentNo: string;
    enrollmentNo: string;
    candidateName: string;
    contact: string;
    programme: string;
    courses: string[];
    session?: string;
    submissionDate?: string;
  }) => void;
  updateIntakeDate: (idOrToken: string, newDate: string) => void;
  deleteIntakeRecord: (id: string) => boolean;
  updateMarks: (intakeId: string, courseCode: string, marks: number | null) => void;
  saveOrUpdateMarksAndLock: (
    row: any,
    marksValue: number | string | null | undefined,
    isLockAction: boolean
  ) => Promise<void>;

  // Module B: 2_Course_Evaluation_Master (Automated Ledger Unpacking & Marks Engine)
  courseLedger: CourseEvaluationRecord[];
  setCourseLedger: React.Dispatch<React.SetStateAction<CourseEvaluationRecord[]>>;
  sessionCourseEvaluations: CourseEvaluationRecord[];
  allCourseEvaluations: CourseEvaluationRecord[];
  allotEvaluatorToEvaluations: (evaluationIds: string[], evaluatorId: string | null) => void;
  updateEvaluationMarks: (evaluationId: string, marks: number | null) => void;
  toggleLockMarks: (evaluationId: string, shouldLock: boolean) => void;
  batchLockMarks: (evaluationIds: string[], shouldLock: boolean) => void;

  // Assignment Submissions (Course-wise Tracking linked to StudentID, CourseCode, Session)
  sessionAssignmentSubmissions: AssignmentSubmission[];
  allAssignmentSubmissions: AssignmentSubmission[];
  updateSubmissionStatus: (submissionId: string, status: SubmissionStatusType, details?: { submissionDate?: string; submissionMode?: SubmissionMode; consignmentNo?: string; remarks?: string }) => void;
  batchUpdateSubmissionStatus: (submissionIds: string[], status: SubmissionStatusType) => void;
  recordStudentAssignmentSubmissions: (data: { studentId: string; studentName: string; programmeCode: string; courseCodes: string[]; session?: string; initialStatus?: SubmissionStatusType; submissionDate?: string; submissionMode?: SubmissionMode; consignmentNo?: string; remarks?: string }) => void;

  // Registration Receipts (Receipts table storing confirmed student intake registrations)
  sessionRegistrationReceipts: RegistrationReceipt[];
  allRegistrationReceipts: RegistrationReceipt[];
  addRegistrationReceipt: (receiptData: Omit<RegistrationReceipt, 'id' | 'receiptNumber' | 'issuedAt'> & { issuedAt?: string; submissionDate?: string; receiptDate?: string }) => RegistrationReceipt;
  selectedRegistrationReceipt: RegistrationReceipt | null;
  openRegistrationReceiptModal: (receipt: RegistrationReceipt) => void;
  closeRegistrationReceiptModal: () => void;

  // Course Ledger / Packets
  packets: CoursePacket[];
  setPackets: React.Dispatch<React.SetStateAction<CoursePacket[]>>;
  coursePackets: CoursePacket[];
  setCoursePackets: React.Dispatch<React.SetStateAction<CoursePacket[]>>;
  sessionPackets: CoursePacket[];
  createPacket: (data: { courseCode: string; programmeCode: string; evaluatorId: string | null; scriptCount: number; expectedReturnDate?: string; notes?: string }) => CoursePacket;
  updatePacket: (id: string, updates: Partial<CoursePacket>) => void;
  deletePacket: (id: string) => void;

  // Evaluators Master
  evaluators: Evaluator[];
  addEvaluator: (evaluator: Omit<Evaluator, 'id' | 'lastSyncedAt'>) => Evaluator;
  updateEvaluator: (id: string, updates: Partial<Evaluator>) => void;
  deleteEvaluator: (id: string) => void;
  isSyncingSheets: boolean;
  syncGoogleSheets: (isSilent?: boolean) => Promise<void>;
  fetchAllData: (isSilent?: boolean) => Promise<void>;
  isSyncingEvaluators: boolean;
  syncEvaluatorsDirectory: () => Promise<void>;
  lastSheetSync: string;

  // Remuneration & Bills
  sessionBills: RemunerationBill[];
  generateBill: (evaluatorId: string, courseCodes: string[], totalScripts: number, rateOverride?: number) => RemunerationBill;
  sanctionBill: (billId: string) => void;
  disburseBill: (billId: string, ref: string) => void;

  // System Settings
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  resetAllData: () => void;

  // Active Receipt Modal (Intake / Acknowledgment)
  selectedReceiptRecord: IntakeRecord | null;
  openReceiptModal: (record: IntakeRecord) => void;
  closeReceiptModal: () => void;

  // Module E: Global Student Search & Lookup Modal
  isSearchModalOpen: boolean;
  searchInitialQuery: string;
  openSearchModal: (initialQuery?: string) => void;
  closeSearchModal: () => void;

  // Navigation Sidebar Collapsible & Hideable State
  isSidebarHidden: boolean;
  setIsSidebarHidden: (val: boolean) => void;
  toggleSidebarHidden: () => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;
  toggleSidebarCollapsed: () => void;

  // Header & Full-Page Workspace View Modes
  isHeaderCompact: boolean;
  setIsHeaderCompact: (val: boolean) => void;
  toggleHeaderCompact: () => void;
  isContentFullWidth: boolean;
  setIsContentFullWidth: (val: boolean) => void;
  toggleContentFullWidth: () => void;

  // Theme & Visual Preferences
  currentTheme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isDark: boolean;
  toggleDark: () => void;

  // Toast Notification System
  toastMessage: string | null;
  toastType: 'success' | 'info' | 'warning' | 'error';
  showToast: (message?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  hideToast: () => void;

  // Custom Programmes, Course Registry & IGNOU Resolution
  allProgrammes: IGNOUProgramme[];
  customProgrammes: IGNOUProgramme[];
  customCourses: Record<string, IGNOUCourse[]>;
  courseTitlesRegistry: Record<string, { title: string; credits: number; source?: string }>;
  saveCustomProgramme: (prog: { code: string; name?: string; level?: 'Bachelor' | 'Master' | 'Diploma' | 'Certificate'; department?: string }) => IGNOUProgramme;
  removeCustomProgramme: (progCode: string) => void;
  saveCustomCourse: (progCode: string, course: { code: string; title?: string; credits?: number }) => void;
  getProgrammeCourses: (progCode: string) => IGNOUCourse[];
  getCourseTitle: (courseCode: string, progCode?: string) => string;
  getCourseInfo: (courseCode: string, progCode?: string) => { title: string; credits: number; source?: string };
  updateCourseTitleFromIgnou: (courseCode: string, progCode?: string, forceLive?: boolean) => Promise<{ title: string; credits: number; source: string }>;

  // Academic Session Archival & History Snapshots
  archives: SessionArchiveRecord[];
  createSessionArchive: (params: {
    name: string;
    session: string;
    notes?: string;
    startNewSession?: boolean;
    newSessionName?: string;
    downloadJSON?: boolean;
  }) => SessionArchiveRecord;
  deleteArchive: (archiveId: string) => void;
  restoreArchive: (archiveId: string) => boolean;
  downloadArchiveJSON: (archive: SessionArchiveRecord) => void;
  importArchiveJSON: (archiveData: any) => SessionArchiveRecord;

  // Audit Trail & Accountability Logs
  auditLogs: AuditLogEntry[];
  logAuditEvent: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  clearAuditLogs: () => void;
  exportAuditLogsCSV: () => void;
  exportAuditLogsJSON: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  SETTINGS: 'ignou_sc2033_settings',
  INTAKES: 'ignou_sc2033_intakes',
  EVALUATORS: 'ignou_sc2033_evaluators',
  EVALUATORS_MASTER: 'ignou_evaluators_master',
  PACKETS: 'ignou_sc2033_packets',
  BILLS: 'ignou_sc2033_bills',
  ASSIGNMENT_SUBMISSIONS: 'ignou_sc2033_assignment_submissions',
  REGISTRATION_RECEIPTS: 'ignou_sc2033_registration_receipts',
  COURSE_EVALUATIONS: 'ignou_sc2033_course_evaluations',
  ROLE: 'ignou_sc2033_user_role',
  CURRENT_SESSION: 'ignou_sc2033_current_session',
  LAST_SHEET_SYNC: 'ignou_sc2033_last_sheet_sync',
  CUSTOM_PROGRAMMES: 'ignou_sc2033_custom_programmes',
  CUSTOM_COURSES: 'ignou_sc2033_custom_courses',
  COURSE_TITLES_REGISTRY: 'ignou_sc2033_course_titles_registry',
  ARCHIVES: 'ignou_sc2033_archives',
  AUDIT_LOGS: 'ignou_sc2033_audit_trail',
};

export const parseEvaluatorsMaster = (rawList: any[]): Evaluator[] => {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((row: any, idx: number) => {
    const code = String(row.Evaluator_Code || row.evaluatorCode || row.code || `EV-${101 + idx}`).trim();
    const name = String(row.Evaluator_Name || row.evaluatorName || row.name || 'Academic Counsellor').trim();
    const designation = String(row.Designation || row.designation || 'Academic Counsellor').trim();
    const department = String(row.Department || row.department || 'Academic Division').trim();
    const college = String(row.College || row.collegeInstitution || row.institution || 'IGNOU Study Centre 2033').trim();
    const contact = String(row.Contact_Number || row.contactNumber || row.Contact || row.contactPhone || row.phone || '').trim();
    const email = String(row.Email_ID || row.emailId || row.Email || row.email || '').trim();

    let eligibleCourses: string[] = [];
    if (typeof row.Eligible_Courses === 'string') {
      eligibleCourses = row.Eligible_Courses.split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean);
    } else if (typeof row.eligibleCourses === 'string') {
      eligibleCourses = row.eligibleCourses.split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean);
    } else if (Array.isArray(row.Eligible_Courses)) {
      eligibleCourses = row.Eligible_Courses.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
    } else if (Array.isArray(row.eligibleCourses)) {
      eligibleCourses = row.eligibleCourses.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
    }

    const bankAccountNo = String(row.Bank_Account_No || row.bankAccountNo || row.accountNumber || '').trim();
    const ifscCode = String(row.IFSC_Code || row.ifscCode || '').trim().toUpperCase();
    const bankName = String(row.Bank_Name || row.bankName || 'State Bank of India').trim();
    const panNumber = String(row.PAN_Number || row.panNumber || '').trim().toUpperCase();
    const status = String(row.Status || row.status || 'Active').trim();

    return {
      id: row.id || `eval-${code.toLowerCase().replace(/[^a-z0-9]/g, '') || idx}`,
      evaluatorCode: code,
      name,
      evaluatorName: name,
      designation,
      department,
      collegeInstitution: college,
      contactPhone: contact,
      contactNumber: contact,
      email,
      emailId: email,
      eligibleCourses,
      bankName,
      accountNumber: bankAccountNo,
      bankAccountNo,
      ifscCode,
      panNumber,
      status,
      lastSyncedAt: new Date().toISOString(),
    };
  });
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Settings & Sessions
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('ignou_sc2033_settings') || localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.coordinatorName || parsed.coordinatorName === 'Dr. V. K. Aggarwal' || parsed.coordinatorName === 'Dr. Sant K. Gupta') {
          parsed.coordinatorName = 'Dr. Sant Kumar Gupta';
        }
        if (!parsed.coordinatorDesignation || parsed.coordinatorDesignation === 'Coordinator') {
          parsed.coordinatorDesignation = 'Coordinator, IGNOU SC-2033';
        }
        if (!parsed.centreCode) {
          parsed.centreCode = 'SC-2033';
        }
        if (!parsed.centreName || parsed.centreName === 'IGNOU Study Centre - 2033' || parsed.centreName.includes('Delhi')) {
          parsed.centreName = "SC-2033 (S.D. Jain Girls' College, Dimapur)";
        }
        if (!parsed.institutionName || parsed.institutionName.includes('Delhi')) {
          parsed.institutionName = "SC-2033 (S.D. Jain Girls' College, Dimapur)";
        }
        if (!parsed.regionalCentre) {
          parsed.regionalCentre = 'RC-20 Kohima';
        }
        if (!parsed.regionalCentreCode || parsed.regionalCentreCode.includes('Delhi') || parsed.regionalCentreCode.includes('Rajghat')) {
          parsed.regionalCentreCode = 'RC-20 Kohima (Regional Centre Kohima)';
        }
        if (!parsed.hostInstitution || parsed.hostInstitution.includes('DAV') || parsed.hostInstitution.includes('Shri Ram')) {
          parsed.hostInstitution = "S.D. Jain Girls' College, Dimapur";
          parsed.institutionName = "S.D. Jain Girls' College, Dimapur";
          parsed.collegeName = "S.D. Jain Girls' College, Dimapur";
        }
        if (!parsed.coordinatorPhone) {
          parsed.coordinatorPhone = '9436013686';
        }
        if (!parsed.coordinatorEmail) {
          parsed.coordinatorEmail = 'sant.k.gupta@gmail.com';
        }
        if (!parsed.coordinatorContact || parsed.coordinatorContact.includes('2341')) {
          parsed.coordinatorContact = '+91 9436013686 | sant.k.gupta@gmail.com';
        }
        if (parsed.remunerationRatePerScript === 30 || !parsed.remunerationRatePerScript) {
          parsed.remunerationRatePerScript = 27.50;
        }
        if (parsed.conveyanceAllowancePerPacket === undefined || parsed.conveyanceAllowancePerPacket === null || parsed.conveyanceAllowancePerPacket === 150) {
          parsed.conveyanceAllowancePerPacket = 0.00;
        }
        if (parsed.coordinationChargesPerScript === undefined || parsed.coordinationChargesPerScript === null || parsed.coordinationChargesPerScript === 5) {
          parsed.coordinationChargesPerScript = 0.00;
        }
        return { ...INITIAL_SETTINGS, ...parsed };
      }
      return INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  const [currentSession, setCurrentSessionState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
      return saved || settings.defaultSession || 'July 2026';
    } catch {
      return 'July 2026';
    }
  });

  // Check if URL enforces Desk Official mode: ?mode=desk or ?role=official
  const isUrlLockedDeskMode = useMemo(() => {
    try {
      if (typeof window === 'undefined') return false;
      const params = new URLSearchParams(window.location.search);
      const mode = (params.get('mode') || '').toLowerCase().trim();
      const role = (params.get('role') || '').toLowerCase().trim();
      return mode === 'desk' || role === 'official';
    } catch {
      return false;
    }
  }, []);

  // 1. Authentication & Session State Management (IGNOU SC-2033 Gatekeeper)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("ignou_sc2033_auth") === "true";
  });
  const [userRole, setUserRoleState] = useState<string>(() => {
    return sessionStorage.getItem("ignou_sc2033_role") || "desk";
  });
  const [securityPins, setSecurityPins] = useState<{ deskPin: string; adminPin: string }>(() => {
    const saved = localStorage.getItem("ignou_sc2033_pins");
    return saved ? JSON.parse(saved) : { deskPin: "1001", adminPin: "2033" };
  });

  // User Role (RBAC) - strictly enforced to OFFICIAL if isUrlLockedDeskMode
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const mode = (params.get('mode') || '').toLowerCase().trim();
        const role = (params.get('role') || '').toLowerCase().trim();
        if (mode === 'desk' || role === 'official') {
          return 'OFFICIAL';
        }
      } catch {}
    }
    const sessionRole = typeof window !== 'undefined' ? sessionStorage.getItem("ignou_sc2033_role") : null;
    if (sessionRole === 'admin') return 'ADMIN';
    if (sessionRole === 'desk') return 'OFFICIAL';
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
      return (saved as UserRole) || 'OFFICIAL';
    } catch {
      return 'OFFICIAL';
    }
  });

  const setUserRole = useCallback((role: string) => {
    setUserRoleState(role);
    sessionStorage.setItem("ignou_sc2033_role", role);
    if (role === 'admin') {
      setCurrentRole('ADMIN');
    } else {
      setCurrentRole('OFFICIAL');
    }
  }, []);

  const updateSecurityPins = useCallback((newPins: { deskPin: string; adminPin: string }) => {
    setSecurityPins(newPins);
    localStorage.setItem("ignou_sc2033_pins", JSON.stringify(newPins));
    setSettings((prev) => ({ ...prev, adminPin: newPins.adminPin }));
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("ignou_sc2033_auth");
    sessionStorage.removeItem("ignou_sc2033_role");
    setIsAuthenticated(false);
    logAuditEvent({
      action: 'USER_LOGOUT',
      category: 'AUTHENTICATION',
      actor: currentRole === 'ADMIN' ? `${settings.coordinatorName || 'Coordinator'} (Admin)` : 'Desk Official',
      role: currentRole,
      session: currentSession,
      summary: 'Staff member signed out and terminal locked',
      status: 'SUCCESS',
    });
  }, [currentRole, settings.coordinatorName, currentSession]);

  // Inactivity Auto-Lock Protection (Mobile & Desktop): 30 minutes
  useEffect(() => {
    if (!isAuthenticated) return;

    let timer: NodeJS.Timeout;
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.removeItem("ignou_sc2033_auth");
        sessionStorage.removeItem("ignou_sc2033_role");
        setIsAuthenticated(false);
        console.warn("Terminal auto-locked after 30 minutes of user inactivity.");
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isAuthenticated]);

  // Admin PIN Protection State
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(false);
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  useEffect(() => {
    if (isUrlLockedDeskMode && currentRole !== 'OFFICIAL') {
      setCurrentRole('OFFICIAL');
    }
  }, [isUrlLockedDeskMode, currentRole]);

  // Database States: Start cleanly from localStorage cache (ignou_sc2033_intake, ignou_sc2033_ledger)
  const [intakes, setIntakes] = useState<IntakeRecord[]>(() => {
    try {
      const saved =
        localStorage.getItem("ignou_sc2033_intake") ||
        localStorage.getItem(STORAGE_KEYS.INTAKES) ||
        localStorage.getItem('ignou_intake_register');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_INTAKE_RECORDS;
    } catch {
      return INITIAL_INTAKE_RECORDS;
    }
  });

  const [evaluators, setEvaluators] = useState<Evaluator[]>(() => {
    try {
      const masterSaved = localStorage.getItem('ignou_evaluators_master');
      if (masterSaved) {
        const parsed = JSON.parse(masterSaved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const saved = localStorage.getItem(STORAGE_KEYS.EVALUATORS);
      return saved ? JSON.parse(saved) : INITIAL_EVALUATORS;
    } catch {
      return INITIAL_EVALUATORS;
    }
  });

  const [packets, setPackets] = useState<CoursePacket[]>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEYS.PACKETS) ||
        localStorage.getItem('ignou_course_packets') ||
        localStorage.getItem('ignou_packets_tracker');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [bills, setBills] = useState<RemunerationBill[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BILLS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Database Table: AssignmentSubmissions
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ASSIGNMENT_SUBMISSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_ASSIGNMENT_SUBMISSIONS;
    } catch {
      return INITIAL_ASSIGNMENT_SUBMISSIONS;
    }
  });

  // Database Table: RegistrationReceipts
  const [registrationReceipts, setRegistrationReceipts] = useState<RegistrationReceipt[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REGISTRATION_RECEIPTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_REGISTRATION_RECEIPTS;
    } catch {
      return INITIAL_REGISTRATION_RECEIPTS;
    }
  });

  // Audit Trail & Accountability Logs Database State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('ignou_sc2033_audit_trail') || localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ignou_sc2033_audit_trail', JSON.stringify(auditLogs));
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
    } catch (e) {
      console.warn('Failed to save audit logs to localStorage:', e);
    }
  }, [auditLogs]);

  // Module B Table: Course Evaluations (Course Ledger)
  const [courseEvaluations, setCourseEvaluations] = useState<CourseEvaluationRecord[]>(() => {
    try {
      const saved =
        localStorage.getItem("ignou_sc2033_ledger") ||
        localStorage.getItem(STORAGE_KEYS.COURSE_EVALUATIONS) ||
        localStorage.getItem('ignou_course_ledger');
      if (saved) {
        const data: CourseEvaluationRecord[] = JSON.parse(saved);
        if (Array.isArray(data) && data.length > 0) {
          return data.map((rec) => ({
            ...rec,
            lockedBy: rec.lockedBy?.includes('Aggarwal') ? 'Dr. Sant K. Gupta (Coordinator)' : rec.lockedBy,
          }));
        }
      }
      return INITIAL_COURSE_EVALUATIONS;
    } catch {
      return INITIAL_COURSE_EVALUATIONS;
    }
  });

  const [lastSheetSync, setLastSheetSync] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_SHEET_SYNC) || '2026-09-01 10:30 AM';
    } catch {
      return '2026-09-01 10:30 AM';
    }
  });

  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('Sheets Connected');
  const [selectedReceiptRecord, setSelectedReceiptRecord] = useState<IntakeRecord | null>(null);
  const [selectedRegistrationReceipt, setSelectedRegistrationReceipt] = useState<RegistrationReceipt | null>(null);

  // Global Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning' | 'error'>('success');
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string = 'Saved & Synced with Google Sheet', type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    setToastType(type);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(null);
  }, []);

  // Persistent Custom Programmes, Custom Courses, and Course Titles Registry
  const [customProgrammes, setCustomProgrammes] = useState<IGNOUProgramme[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROGRAMMES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [customCourses, setCustomCourses] = useState<Record<string, IGNOUCourse[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_COURSES);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [courseTitlesRegistry, setCourseTitlesRegistry] = useState<Record<string, { title: string; credits: number; source?: string }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COURSE_TITLES_REGISTRY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // LocalStorage persistence for custom programmes and courses
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PROGRAMMES, JSON.stringify(customProgrammes));
    } catch (e) {
      console.warn('Failed to save custom programmes to localStorage', e);
    }
  }, [customProgrammes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_COURSES, JSON.stringify(customCourses));
    } catch (e) {
      console.warn('Failed to save custom courses to localStorage', e);
    }
  }, [customCourses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COURSE_TITLES_REGISTRY, JSON.stringify(courseTitlesRegistry));
    } catch (e) {
      console.warn('Failed to save course titles registry to localStorage', e);
    }
  }, [courseTitlesRegistry]);

  // Module: Academic Session Archival & History Snapshots State
  const [archives, setArchives] = useState<SessionArchiveRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ignou_sc2033_archives') || localStorage.getItem(STORAGE_KEYS.ARCHIVES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ignou_sc2033_archives', JSON.stringify(archives));
      localStorage.setItem(STORAGE_KEYS.ARCHIVES, JSON.stringify(archives));
    } catch (e) {
      console.warn('Failed to save archives to localStorage', e);
    }
  }, [archives]);

  // Unified list of all standard + custom + discovered programmes
  const allProgrammes = useMemo<IGNOUProgramme[]>(() => {
    const list: IGNOUProgramme[] = [];
    const seen = new Set<string>();

    // 0. Add extended programmes ensuring unique codes
    for (const p of EXTENDED_IGNOU_PROGRAMMES) {
      const codeUpper = (p.code || '').trim().toUpperCase();
      if (codeUpper && !seen.has(codeUpper)) {
        seen.add(codeUpper);
        list.push({
          ...p,
          code: codeUpper,
          courses: p.courses || [],
        });
      }
    }

    // 1. Merge user-defined custom programmes
    for (const cp of customProgrammes) {
      const codeUpper = (cp.code || '').trim().toUpperCase();
      if (codeUpper && !seen.has(codeUpper)) {
        seen.add(codeUpper);
        list.push({
          ...cp,
          code: codeUpper,
          courses: cp.courses || [],
        });
      }
    }

    // 2. Also include any programme code discovered in recorded intakes
    for (const it of intakes) {
      const pCode = (it.programmeCode || '').trim().toUpperCase();
      if (pCode && !seen.has(pCode)) {
        seen.add(pCode);
        list.push({
          code: pCode,
          name: `${pCode} Programme`,
          level: pCode.startsWith('M') ? 'Master' : pCode.startsWith('D') ? 'Diploma' : 'Bachelor',
          department: 'Academic Division',
          courses: [],
        });
      }
    }

    return list;
  }, [customProgrammes, intakes]);

  // Synchronous lookup for course details (title & credits)
  const getCourseInfo = useCallback(
    (courseCode: string, progCode?: string): { title: string; credits: number; source?: string } => {
      const cleanCode = (courseCode || '').trim().toUpperCase();
      const formatted = formatIgnouCourseCode(cleanCode);
      const cleanProg = (progCode || '').trim().toUpperCase();

      // 1. Check persistent course titles registry
      if (courseTitlesRegistry[cleanCode]?.title) {
        return courseTitlesRegistry[cleanCode];
      }
      if (courseTitlesRegistry[formatted]?.title) {
        return courseTitlesRegistry[formatted];
      }

      // 2. Check extended IGNOU catalog
      const catalog = lookupCatalogCourse(cleanCode, cleanProg);
      if (catalog) {
        return {
          title: catalog.title,
          credits: catalog.credits,
          source: 'IGNOU Catalog',
        };
      }

      // 3. Check custom courses store
      if (cleanProg && customCourses[cleanProg]) {
        const found = customCourses[cleanProg].find(
          (c) => c.code.toUpperCase() === cleanCode || c.code.toUpperCase() === formatted
        );
        if (found && found.title) {
          return {
            title: found.title,
            credits: found.credits || 6,
            source: 'Custom Course Store',
          };
        }
      }

      // Fallback clean formatted placeholder
      return {
        title: cleanProg ? `${cleanProg} Course Module ${formatted}` : `Course Module ${formatted}`,
        credits: 6,
        source: 'Inferred',
      };
    },
    [courseTitlesRegistry, customCourses]
  );

  const getCourseTitle = useCallback(
    (courseCode: string, progCode?: string): string => {
      return getCourseInfo(courseCode, progCode).title;
    },
    [getCourseInfo]
  );

  // Get all curriculum course suggestions for a programme
  const getProgrammeCourses = useCallback(
    (progCode: string): IGNOUCourse[] => {
      const cleanProg = (progCode || '').trim().toUpperCase();
      if (!cleanProg) return [];

      const coursesMap = new Map<string, IGNOUCourse>();

      // 1. From standard / extended catalog
      const standardProg = EXTENDED_IGNOU_PROGRAMMES.find((p) => p.code.toUpperCase() === cleanProg);
      if (standardProg) {
        for (const c of standardProg.courses) {
          coursesMap.set(c.code.toUpperCase(), { ...c });
        }
      }

      // 2. From customProgrammes
      const customProg = customProgrammes.find((p) => p.code.toUpperCase() === cleanProg);
      if (customProg && customProg.courses) {
        for (const c of customProg.courses) {
          coursesMap.set(c.code.toUpperCase(), { ...c });
        }
      }

      // 3. From customCourses record
      if (customCourses[cleanProg]) {
        for (const c of customCourses[cleanProg]) {
          coursesMap.set(c.code.toUpperCase(), { ...c });
        }
      }

      // 4. From intakes recorded for this programme
      for (const it of intakes) {
        if ((it.programmeCode || '').trim().toUpperCase() === cleanProg && Array.isArray(it.courseCodes)) {
          for (const rawCode of it.courseCodes) {
            const cCode = rawCode.trim().toUpperCase();
            if (cCode && !coursesMap.has(cCode)) {
              const reg = courseTitlesRegistry[cCode];
              coursesMap.set(cCode, {
                code: cCode,
                title: reg?.title || getCourseTitle(cCode, cleanProg),
                credits: reg?.credits || 6,
                programme: cleanProg,
              });
            }
          }
        }
      }

      // 5. Apply any updated course titles from courseTitlesRegistry
      for (const [code, c] of coursesMap.entries()) {
        const reg = courseTitlesRegistry[code] || courseTitlesRegistry[formatIgnouCourseCode(code)];
        if (reg?.title) {
          c.title = reg.title;
          if (reg.credits) c.credits = reg.credits;
        }
      }

      return Array.from(coursesMap.values());
    },
    [customProgrammes, customCourses, intakes, courseTitlesRegistry, getCourseTitle]
  );

  // Save a newly added Programme so it appears in Quick Suggestions next time
  const saveCustomProgramme = useCallback(
    (prog: { code: string; name?: string; level?: 'Bachelor' | 'Master' | 'Diploma' | 'Certificate'; department?: string }): IGNOUProgramme => {
      const codeUpper = prog.code.trim().toUpperCase();
      if (!codeUpper) throw new Error('Programme code is required');

      // Check if already in customProgrammes
      const existing = customProgrammes.find((p) => p.code.toUpperCase() === codeUpper);
      if (existing) {
        if (prog.name && prog.name !== existing.name) {
          setCustomProgrammes((prev) =>
            prev.map((p) =>
              p.code.toUpperCase() === codeUpper
                ? { ...p, name: prog.name || p.name, level: prog.level || p.level }
                : p
            )
          );
        }
        return existing;
      }

      // Check extended catalog for standard name
      const catalogProg = EXTENDED_IGNOU_PROGRAMMES.find((p) => p.code.toUpperCase() === codeUpper);
      const name = prog.name || catalogProg?.name || `${codeUpper} Programme`;
      const level = prog.level || catalogProg?.level || (codeUpper.startsWith('M') ? 'Master' : codeUpper.startsWith('D') ? 'Diploma' : 'Bachelor');
      const department = prog.department || catalogProg?.department || 'Academic Division';

      const newProg: IGNOUProgramme = {
        code: codeUpper,
        name,
        level,
        department,
        courses: catalogProg ? [...catalogProg.courses] : [],
      };

      setCustomProgrammes((prev) => [...prev, newProg]);

      // Query server for verified programme name from IGNOU in background
      fetch(`/api/ignou/programme-lookup?code=${encodeURIComponent(codeUpper)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.status === 'success' && data.data?.name && data.data.name !== newProg.name) {
            setCustomProgrammes((prev) =>
              prev.map((p) =>
                p.code.toUpperCase() === codeUpper
                  ? { ...p, name: data.data.name, level: data.data.level }
                  : p
              )
            );
          }
        })
        .catch(() => {});

      return newProg;
    },
    [customProgrammes]
  );

  // Remove custom programme
  const removeCustomProgramme = useCallback((progCode: string) => {
    const clean = progCode.trim().toUpperCase();
    setCustomProgrammes((prev) => prev.filter((p) => p.code.toUpperCase() !== clean));
    setCustomCourses((prev) => {
      const copy = { ...prev };
      delete copy[clean];
      return copy;
    });
  }, []);

  // Save a newly added Course Code so it appears in Quick Suggestions next time
  const saveCustomCourse = useCallback(
    (progCode: string, course: { code: string; title?: string; credits?: number }) => {
      const cleanProg = progCode.trim().toUpperCase();
      const cleanCode = course.code.trim().toUpperCase();
      const formatted = formatIgnouCourseCode(cleanCode);
      if (!cleanProg || !cleanCode) return;

      const title = course.title || getCourseTitle(cleanCode, cleanProg);
      const credits = course.credits || 6;

      // Update registry
      setCourseTitlesRegistry((prev) => ({
        ...prev,
        [cleanCode]: { title, credits, source: 'User Added' },
        [formatted]: { title, credits, source: 'User Added' },
      }));

      // Update custom courses
      setCustomCourses((prev) => {
        const currentList = prev[cleanProg] || [];
        const exists = currentList.some(
          (c) => c.code.toUpperCase() === cleanCode || c.code.toUpperCase() === formatted
        );
        if (exists) {
          return {
            ...prev,
            [cleanProg]: currentList.map((c) =>
              c.code.toUpperCase() === cleanCode || c.code.toUpperCase() === formatted
                ? { ...c, title, credits }
                : c
            ),
          };
        }
        return {
          ...prev,
          [cleanProg]: [
            ...currentList,
            { code: formatted, title, credits, programme: cleanProg },
          ],
        };
      });
    },
    [getCourseTitle]
  );

  // Fetch / update course title directly from IGNOU (ignou.ac.in)
  const updateCourseTitleFromIgnou = useCallback(
    async (
      courseCode: string,
      progCode?: string,
      forceLive = false
    ): Promise<{ title: string; credits: number; source: string }> => {
      const cleanCode = (courseCode || '').trim().toUpperCase();
      const formatted = formatIgnouCourseCode(cleanCode);
      const cleanProg = (progCode || '').trim().toUpperCase();

      try {
        const res = await fetch(
          `/api/ignou/course-lookup?code=${encodeURIComponent(formatted)}&programme=${encodeURIComponent(cleanProg)}&live=${forceLive ? 'true' : 'false'}`
        );
        const data = await res.json();
        if (data?.status === 'success' && data.data?.title) {
          const resolvedTitle = data.data.title;
          const credits = data.data.credits || 6;
          const source = data.data.source || 'ignou.ac.in';

          // Update registry
          setCourseTitlesRegistry((prev) => ({
            ...prev,
            [cleanCode]: { title: resolvedTitle, credits, source },
            [formatted]: { title: resolvedTitle, credits, source },
          }));

          // Also update customCourses if programme is known
          if (cleanProg) {
            setCustomCourses((prev) => {
              const currentList = prev[cleanProg] || [];
              const exists = currentList.some(
                (c) => c.code.toUpperCase() === cleanCode || c.code.toUpperCase() === formatted
              );
              if (exists) {
                return {
                  ...prev,
                  [cleanProg]: currentList.map((c) =>
                    c.code.toUpperCase() === cleanCode || c.code.toUpperCase() === formatted
                      ? { ...c, title: resolvedTitle, credits }
                      : c
                  ),
                };
              }
              return {
                ...prev,
                [cleanProg]: [
                  ...currentList,
                  { code: formatted, title: resolvedTitle, credits, programme: cleanProg },
                ],
              };
            });
          }

          // Also update any existing courseEvaluation records in courseLedger
          setCourseEvaluations((prev) =>
            prev.map((rec) =>
              rec.courseCode.toUpperCase() === cleanCode || rec.courseCode.toUpperCase() === formatted
                ? { ...rec, courseTitle: resolvedTitle }
                : rec
            )
          );

          return { title: resolvedTitle, credits, source };
        }
      } catch (err) {
        console.warn(`Failed to fetch title for ${courseCode} from IGNOU API:`, err);
      }

      // Fallback
      const fallback = getCourseInfo(cleanCode, cleanProg);
      return { title: fallback.title, credits: fallback.credits, source: fallback.source || 'Catalog' };
    },
    [getCourseInfo]
  );

  // Module E: Global Student Search Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState<string>('');

  // Navigation Sidebar Collapsible & Hideable State
  const [isSidebarHidden, setIsSidebarHiddenState] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        return true;
      }
      const saved = localStorage.getItem('ignou_sc2033_sidebar_hidden');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ignou_sc2033_sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const setIsSidebarHidden = useCallback((val: boolean) => {
    setIsSidebarHiddenState(val);
    try {
      localStorage.setItem('ignou_sc2033_sidebar_hidden', JSON.stringify(val));
    } catch {}
  }, []);

  const toggleSidebarHidden = useCallback(() => {
    setIsSidebarHiddenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ignou_sc2033_sidebar_hidden', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const setIsSidebarCollapsed = useCallback((val: boolean) => {
    setIsSidebarCollapsedState(val);
    try {
      localStorage.setItem('ignou_sc2033_sidebar_collapsed', JSON.stringify(val));
    } catch {}
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ignou_sc2033_sidebar_collapsed', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Header & Full-Page Workspace View Modes
  const [isHeaderCompact, setIsHeaderCompactState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ignou_sc2033_header_compact');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [isContentFullWidth, setIsContentFullWidthState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ignou_sc2033_content_fullwidth');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const setIsHeaderCompact = useCallback((val: boolean) => {
    setIsHeaderCompactState(val);
    try {
      localStorage.setItem('ignou_sc2033_header_compact', JSON.stringify(val));
    } catch {}
  }, []);

  const toggleHeaderCompact = useCallback(() => {
    setIsHeaderCompactState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ignou_sc2033_header_compact', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const setIsContentFullWidth = useCallback((val: boolean) => {
    setIsContentFullWidthState(val);
    try {
      localStorage.setItem('ignou_sc2033_content_fullwidth', JSON.stringify(val));
    } catch {}
  }, []);

  const toggleContentFullWidth = useCallback(() => {
    setIsContentFullWidthState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ignou_sc2033_content_fullwidth', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Application Theme & Visual Preferences State
  const [currentTheme, setCurrentThemeState] = useState<AppTheme>(() => getInitialTheme());

  useEffect(() => {
    applyThemeToDOM(currentTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e);
    }
  }, [currentTheme]);

  const setTheme = useCallback((theme: AppTheme) => {
    setCurrentThemeState(theme);
    applyThemeToDOM(theme);
    const meta = THEMES.find((t) => t.id === theme);
    showToast(`Theme changed to ${meta?.name || theme}`, 'info');
  }, [showToast]);

  const isDark = useMemo(() => {
    const meta = THEMES.find((t) => t.id === currentTheme);
    return !!meta?.isDark;
  }, [currentTheme]);

  const toggleDark = useCallback(() => {
    setCurrentThemeState((prev) => {
      const next: AppTheme = prev === 'dark' ? 'classic' : 'dark';
      applyThemeToDOM(next);
      const meta = THEMES.find((t) => t.id === next);
      showToast(`Theme changed to ${meta?.name || next}`, 'info');
      return next;
    });
  }, [showToast]);

  const openSearchModal = useCallback((initialQuery: string = '') => {
    setSearchInitialQuery(initialQuery);
    setIsSearchModalOpen(true);
  }, []);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalOpen(false);
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Persistence Effects
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to persist settings', e);
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, currentSession);
    } catch (e) {
      console.error('Failed to persist session', e);
    }
  }, [currentSession]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE, currentRole);
    } catch (e) {
      console.error('Failed to persist role', e);
    }
  }, [currentRole]);

  useEffect(() => {
    try {
      localStorage.setItem("ignou_sc2033_intake", JSON.stringify(intakes));
      localStorage.setItem(STORAGE_KEYS.INTAKES, JSON.stringify(intakes));
    } catch (e) {
      console.error('Failed to persist intakes', e);
    }
  }, [intakes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EVALUATORS, JSON.stringify(evaluators));
      localStorage.setItem(STORAGE_KEYS.EVALUATORS_MASTER, JSON.stringify(evaluators));
    } catch (e) {
      console.error('Failed to persist evaluators', e);
    }
  }, [evaluators]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PACKETS, JSON.stringify(packets));
      localStorage.setItem('ignou_course_packets', JSON.stringify(packets));
      localStorage.setItem('ignou_packets_tracker', JSON.stringify(packets));
    } catch (e) {
      console.error('Failed to persist packets', e);
    }
  }, [packets]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
    } catch (e) {
      console.error('Failed to persist bills', e);
    }
  }, [bills]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ASSIGNMENT_SUBMISSIONS, JSON.stringify(assignmentSubmissions));
    } catch (e) {
      console.error('Failed to persist assignment submissions', e);
    }
  }, [assignmentSubmissions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REGISTRATION_RECEIPTS, JSON.stringify(registrationReceipts));
    } catch (e) {
      console.error('Failed to persist registration receipts', e);
    }
  }, [registrationReceipts]);

  useEffect(() => {
    try {
      localStorage.setItem("ignou_sc2033_ledger", JSON.stringify(courseEvaluations));
      localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(courseEvaluations));
    } catch (e) {
      console.error('Failed to persist course evaluations', e);
    }
  }, [courseEvaluations]);

  // Audit Trail Management Helpers
  const logAuditEvent = useCallback(
    (entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp?: string }) => {
      const newEntry: AuditLogEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: entry.timestamp || new Date().toISOString(),
        action: entry.action,
        category: entry.category,
        actor: entry.actor,
        role: entry.role,
        session: entry.session || currentSession,
        targetIdentifier: entry.targetIdentifier,
        summary: entry.summary,
        details: entry.details,
        ipOrDevice: entry.ipOrDevice || 'Station SC-2033',
        status: entry.status || 'SUCCESS',
      };
      setAuditLogs((prev) => [newEntry, ...prev.slice(0, 999)]);
    },
    [currentSession]
  );

  const clearAuditLogs = useCallback(() => {
    setAuditLogs([]);
    try {
      localStorage.removeItem('ignou_sc2033_audit_trail');
      localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    } catch {}
  }, []);

  const exportAuditLogsCSV = useCallback(() => {
    const headers = ['ID', 'Timestamp', 'Date', 'Time', 'Category', 'Action', 'Actor', 'Role', 'Cycle', 'TargetIdentifier', 'Summary', 'Status'];
    const rows = auditLogs.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${new Date(log.timestamp).toLocaleDateString('en-IN')}"`,
      `"${new Date(log.timestamp).toLocaleTimeString('en-IN')}"`,
      `"${log.category}"`,
      `"${log.action}"`,
      `"${(log.actor || '').replace(/"/g, '""')}"`,
      `"${log.role}"`,
      `"${log.session || ''}"`,
      `"${(log.targetIdentifier || '').replace(/"/g, '""')}"`,
      `"${(log.summary || '').replace(/"/g, '""')}"`,
      `"${log.status}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `IGNOU_SC2033_AuditTrail_${currentSession.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [auditLogs, currentSession]);

  const exportAuditLogsJSON = useCallback(() => {
    const jsonStr = JSON.stringify(auditLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `IGNOU_SC2033_AuditLogs_${currentSession.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [auditLogs, currentSession]);

  // Session Switching
  const setSession = useCallback((newSession: string) => {
    setCurrentSessionState(newSession);
  }, []);

  const addSession = useCallback((newSession: string) => {
    const trimmed = newSession.trim();
    if (!trimmed) return;
    setSettings((prev) => {
      if (prev.availableSessions.includes(trimmed)) return prev;
      return {
        ...prev,
        availableSessions: [...prev.availableSessions, trimmed],
      };
    });
    setCurrentSessionState(trimmed);
  }, []);

  // Admin PIN & Role Management
  const openAdminPinModal = useCallback(() => {
    if (isUrlLockedDeskMode) {
      alert('Access Denied: Terminal is locked strictly in Desk Official Mode via URL configuration (?mode=desk or ?role=official). Administrator elevation is disabled.');
      return;
    }
    setAdminPinError(null);
    setIsAdminPinModalOpen(true);
  }, [isUrlLockedDeskMode]);

  const closeAdminPinModal = useCallback(() => {
    setIsAdminPinModalOpen(false);
    setAdminPinError(null);
  }, []);

  const verifyAndSetAdminRole = useCallback(
    (enteredPin: string): boolean => {
      if (isUrlLockedDeskMode) {
        setAdminPinError('Terminal is locked strictly in Desk Official Mode.');
        setCurrentRole('OFFICIAL');
        setUserRoleState('desk');
        return false;
      }
      const expectedPin = (securityPins.adminPin || settings.adminPin || '2033').trim();
      if (enteredPin.trim() === expectedPin) {
        setCurrentRole('ADMIN');
        setUserRoleState('admin');
        sessionStorage.setItem("ignou_sc2033_role", "admin");
        setIsAdminPinModalOpen(false);
        setAdminPinError(null);
        return true;
      } else {
        setAdminPinError('Invalid Administrator PIN. Access denied. Reverting to Desk Official role.');
        setCurrentRole('OFFICIAL');
        setUserRoleState('desk');
        return false;
      }
    },
    [isUrlLockedDeskMode, securityPins.adminPin, settings.adminPin]
  );

  // Ref to invoke fetchAllData before its declaration without hoisting errors
  const fetchAllDataRef = useRef<(isSilent?: boolean) => Promise<void>>(() => Promise.resolve());

  // Authentication Handler for Terminal Login Gatekeeper
  const handleLogin = useCallback((role: 'desk' | 'admin', inputPin: string): boolean => {
    const currentDeskPin = (securityPins.deskPin || "1001").trim();
    const currentAdminPin = (securityPins.adminPin || "2033").trim();
    const entered = (inputPin || "").trim();

    if (role === "desk" && (entered === currentDeskPin || entered === currentAdminPin)) {
      sessionStorage.setItem("ignou_sc2033_auth", "true");
      sessionStorage.setItem("ignou_sc2033_role", "desk");
      setIsAuthenticated(true);
      setUserRoleState("desk");
      setCurrentRole("OFFICIAL");
      fetchAllDataRef.current(true);
      logAuditEvent({
        action: 'USER_LOGIN',
        category: 'AUTHENTICATION',
        actor: 'Desk Official',
        role: 'OFFICIAL',
        session: currentSession,
        summary: 'Desk Official successfully authenticated via Terminal PIN',
        status: 'SUCCESS',
        details: { authRole: 'desk' },
      });
      return true;
    }
    if (role === "admin" && entered === currentAdminPin) {
      sessionStorage.setItem("ignou_sc2033_auth", "true");
      sessionStorage.setItem("ignou_sc2033_role", "admin");
      setIsAuthenticated(true);
      setUserRoleState("admin");
      setCurrentRole("ADMIN");
      fetchAllDataRef.current(true);
      logAuditEvent({
        action: 'USER_LOGIN',
        category: 'AUTHENTICATION',
        actor: `${settings.coordinatorName || 'Coordinator'} (Admin)`,
        role: 'ADMIN',
        session: currentSession,
        summary: `Coordinator (${settings.coordinatorName || 'Administrator'}) authenticated into master terminal`,
        status: 'SUCCESS',
        details: { authRole: 'admin' },
      });
      return true;
    }

    logAuditEvent({
      action: 'USER_LOGIN',
      category: 'AUTHENTICATION',
      actor: role === 'admin' ? 'Unverified Coordinator Attempt' : 'Unverified Desk Attempt',
      role: role === 'admin' ? 'ADMIN' : 'OFFICIAL',
      session: currentSession,
      summary: `Failed security PIN entry for role: ${role}`,
      status: 'FAILED',
      details: { attemptedRole: role },
    });
    return false;
  }, [securityPins, logAuditEvent, currentSession, settings.coordinatorName]);

  // Role switching
  const setRole = useCallback(
    (role: UserRole) => {
      if (isUrlLockedDeskMode) {
        setCurrentRole('OFFICIAL');
        setUserRoleState('desk');
        return;
      }
      if (role === 'ADMIN') {
        openAdminPinModal();
      } else {
        setCurrentRole('OFFICIAL');
        setUserRoleState('desk');
        sessionStorage.setItem("ignou_sc2033_role", "desk");
      }
    },
    [isUrlLockedDeskMode, openAdminPinModal]
  );

  const toggleRole = useCallback(() => {
    if (isUrlLockedDeskMode) {
      return;
    }
    if (currentRole === 'ADMIN' || userRole === 'admin') {
      setCurrentRole('OFFICIAL');
      setUserRoleState('desk');
      sessionStorage.setItem("ignou_sc2033_role", "desk");
    } else {
      openAdminPinModal();
    }
  }, [isUrlLockedDeskMode, currentRole, userRole, openAdminPinModal]);

  const isAdmin = !isUrlLockedDeskMode && (userRole === 'admin' || currentRole === 'ADMIN');
  const isOfficial = !isAdmin;

  // Flexible Session Isolation (Normalizes case and whitespace):
  // sessionIntakes, sessionPackets, sessionBills, sessionAssignmentSubmissions, sessionRegistrationReceipts
  const sessionIntakes = useMemo(() => {
    return intakes.filter((r: any) => {
      if (!currentSession || currentSession === "All" || currentSession.toLowerCase() === "all") return true;
      return normalizeSession(r.Session || r.session) === normalizeSession(currentSession);
    });
  }, [intakes, currentSession]);

  const sessionCourseEvaluations = useMemo(() => {
    return courseEvaluations.filter((c: any) => {
      if (!currentSession || currentSession === "All" || currentSession.toLowerCase() === "all") return true;
      return normalizeSession(c.Session || c.session) === normalizeSession(currentSession);
    });
  }, [courseEvaluations, currentSession]);

  const sessionPackets = useMemo(() => {
    if (sessionCourseEvaluations.length === 0) {
      return [];
    }
    const activeCourses = new Set(sessionCourseEvaluations.map((c: any) => (c.courseCode || c.Course_Code || '').toUpperCase()));
    return packets.filter((p: any) => {
      if (!currentSession || currentSession === "All" || currentSession.toLowerCase() === "all") return true;
      return (
        normalizeSession(p.Session || p.session) === normalizeSession(currentSession) &&
        activeCourses.has((p.courseCode || p.Course_Code || '').toUpperCase())
      );
    });
  }, [packets, currentSession, sessionCourseEvaluations]);

  const sessionBills = useMemo(() => {
    return bills.filter((b: any) => {
      if (!currentSession || currentSession === "All" || currentSession.toLowerCase() === "all") return true;
      return normalizeSession(b.Session || b.session) === normalizeSession(currentSession);
    });
  }, [bills, currentSession]);

  const sessionAssignmentSubmissions = useMemo(() => {
    return assignmentSubmissions.filter((s: any) => {
      if (!currentSession || currentSession === "All" || currentSession.toLowerCase() === "all") return true;
      return normalizeSession(s.Session || s.session) === normalizeSession(currentSession);
    });
  }, [assignmentSubmissions, currentSession]);

  const sessionRegistrationReceipts = useMemo(() => {
    return registrationReceipts.filter((r: any) => {
      if (!currentSession || currentSession === "All" || currentSession.toLowerCase() === "all") return true;
      return normalizeSession(r.Session || r.session) === normalizeSession(currentSession);
    });
  }, [registrationReceipts, currentSession]);

  // Assignment Submissions Operations
  const updateSubmissionStatus = useCallback(
    (
      submissionId: string,
      status: SubmissionStatusType,
      details?: { submissionDate?: string; submissionMode?: SubmissionMode; consignmentNo?: string; remarks?: string }
    ) => {
      const now = new Date().toISOString();
      const updatedBy = currentRole === 'ADMIN' ? 'Coordinator' : 'Desk Official';
      setAssignmentSubmissions((prev) =>
        prev.map((sub) => {
          if (sub.id !== submissionId) return sub;
          return {
            ...sub,
            status,
            submissionDate:
              status === 'submitted'
                ? details?.submissionDate || sub.submissionDate || now.split('T')[0]
                : null,
            submissionMode:
              status === 'submitted'
                ? details?.submissionMode || sub.submissionMode || 'In-Person (Desk)'
                : null,
            consignmentNo: details?.consignmentNo !== undefined ? details.consignmentNo : sub.consignmentNo,
            remarks: details?.remarks !== undefined ? details.remarks : sub.remarks,
            updatedAt: now,
            updatedBy,
          };
        })
      );
    },
    [currentRole]
  );

  const batchUpdateSubmissionStatus = useCallback(
    (submissionIds: string[], status: SubmissionStatusType) => {
      const now = new Date().toISOString();
      const updatedBy = currentRole === 'ADMIN' ? 'Coordinator' : 'Desk Official';
      setAssignmentSubmissions((prev) =>
        prev.map((sub) => {
          if (!submissionIds.includes(sub.id)) return sub;
          return {
            ...sub,
            status,
            submissionDate: status === 'submitted' ? (sub.submissionDate || now.split('T')[0]) : null,
            submissionMode: status === 'submitted' ? (sub.submissionMode || 'In-Person (Desk)') : null,
            updatedAt: now,
            updatedBy,
          };
        })
      );
    },
    [currentRole]
  );

  const recordStudentAssignmentSubmissions = useCallback(
    (data: {
      studentId: string;
      studentName: string;
      programmeCode: string;
      courseCodes: string[];
      session?: string;
      initialStatus?: SubmissionStatusType;
      submissionDate?: string;
      submissionMode?: SubmissionMode;
      consignmentNo?: string;
      remarks?: string;
    }) => {
      const targetSession = data.session || currentSession;
      const now = new Date().toISOString();
      const updatedBy = currentRole === 'ADMIN' ? 'Coordinator Desk' : 'Desk Official - Counter 1';
      const initialStatus = data.initialStatus || 'submitted';

      setAssignmentSubmissions((prev) => {
        const nextList = [...prev];
        data.courseCodes.forEach((courseCode) => {
          const existingIdx = nextList.findIndex(
            (s) => s.studentId === data.studentId && s.courseCode === courseCode && s.session === targetSession
          );

          if (existingIdx >= 0) {
            nextList[existingIdx] = {
              ...nextList[existingIdx],
              studentName: data.studentName,
              programmeCode: data.programmeCode,
              status: initialStatus,
              submissionDate: initialStatus === 'submitted' ? (data.submissionDate || now.split('T')[0]) : null,
              submissionMode: initialStatus === 'submitted' ? (data.submissionMode || 'In-Person (Desk)') : null,
              consignmentNo: data.consignmentNo,
              remarks: data.remarks || nextList[existingIdx].remarks,
              updatedAt: now,
              updatedBy,
            };
          } else {
            const newSub: AssignmentSubmission = {
              id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              studentId: data.studentId,
              studentName: data.studentName,
              programmeCode: data.programmeCode,
              courseCode,
              session: targetSession,
              status: initialStatus,
              submissionDate: initialStatus === 'submitted' ? (data.submissionDate || now.split('T')[0]) : null,
              submissionMode: initialStatus === 'submitted' ? (data.submissionMode || 'In-Person (Desk)') : null,
              consignmentNo: data.consignmentNo,
              remarks: data.remarks,
              updatedAt: now,
              updatedBy,
            };
            nextList.push(newSub);
          }
        });
        return nextList;
      });
    },
    [currentRole, currentSession]
  );

  // Registration Receipts Operations
  const addRegistrationReceipt = useCallback(
    (
      data: Omit<RegistrationReceipt, 'id' | 'receiptNumber' | 'issuedAt'> & {
        issuedAt?: string;
        submissionDate?: string;
        receiptDate?: string;
      }
    ): RegistrationReceipt => {
      const sessionCode = generateSessionCode(data.session);
      const sessionReceipts = registrationReceipts.filter((r) => r.session === data.session);
      const nextSequence = sessionReceipts.length + 1;
      const paddedSeq = String(nextSequence).padStart(4, '0');
      const receiptNumber = `REG-SC2033-${sessionCode}-${paddedSeq}`;

      const intakeDate = data.submissionDate || data.receiptDate || (data.issuedAt ? String(data.issuedAt).split('T')[0] : new Date().toISOString().split('T')[0]);
      const issuedAtTime = data.issuedAt || `${intakeDate}T${new Date().toTimeString().split(' ')[0]}`;

      const newReceipt: RegistrationReceipt = {
        ...data,
        id: `reg-receipt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        receiptNumber,
        submissionDate: intakeDate,
        receiptDate: intakeDate,
        issuedAt: issuedAtTime,
      };

      setRegistrationReceipts((prev) => [newReceipt, ...prev]);
      return newReceipt;
    },
    [registrationReceipts]
  );

  const openRegistrationReceiptModal = useCallback((receipt: RegistrationReceipt) => {
    setSelectedRegistrationReceipt(receipt);
  }, []);

  const closeRegistrationReceiptModal = useCallback(() => {
    setSelectedRegistrationReceipt(null);
  }, []);

  // Intake Actions
  const addIntakeRecord = useCallback(
    (data: Omit<IntakeRecord, 'id' | 'session' | 'tokenNo' | 'createdAt' | 'marks'> & { marks?: Record<string, number | null> }) => {
      // Composite Duplicate Check: Block if SAME student submits EXACT SAME course code for this session
      const cleanEnr = data.enrollmentNo.trim();
      const existingInSession = intakes.filter((r) => r.session === currentSession);
      const duplicateCourses = data.courseCodes.filter((cc) => {
        const normCC = cc.trim().toUpperCase();
        return (
          courseEvaluations.some(
            (ce) =>
              ce.enrollmentNo.trim() === cleanEnr &&
              ce.session.trim().toLowerCase() === currentSession.trim().toLowerCase() &&
              ce.courseCode.trim().toUpperCase() === normCC
          ) ||
          existingInSession.some(
            (it) =>
              it.enrollmentNo.trim() === cleanEnr &&
              it.courseCodes.some((c) => c.trim().toUpperCase() === normCC)
          )
        );
      });

      if (duplicateCourses.length > 0) {
        throw new Error(
          `Duplicate Submission Blocked: Student ${cleanEnr} has already submitted course ${duplicateCourses.join(', ')} in session "${currentSession}".`
        );
      }

      const sessionCode = generateSessionCode(currentSession);
      // Count current session intakes to build deterministic sequential token
      const nextSequence = existingInSession.length + 1;
      const paddedSeq = String(nextSequence).padStart(4, '0');
      const tokenNo = `SC2033-${sessionCode}-${paddedSeq}`;

      const newRecord: IntakeRecord = {
        ...data,
        id: `intake-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        session: currentSession,
        tokenNo,
        marks: data.marks || data.courseCodes.reduce((acc, code) => ({ ...acc, [code]: null }), {}),
        createdAt: new Date().toISOString(),
      };

      setIntakes((prev) => [newRecord, ...prev]);

      // Deterministic Ledger Unpacking:
      // When a student registers with N courses, automatically split the entry into N individual ledger rows.
      // Primary Key format: SUB_ENR_COURSE_TERM (e.g., SUB_2401928371_MEG01_JUL2026)
      const cleanEnrollment = data.enrollmentNo.trim();
      const cleanName = data.studentName.trim();
      const cleanProgramme = data.programmeCode.trim().toUpperCase();

      // Save custom programme & courses so they appear in Quick Suggestions next time
      try {
        saveCustomProgramme({ code: cleanProgramme });
        data.courseCodes.forEach((cc) => {
          saveCustomCourse(cleanProgramme, { code: cc });
          updateCourseTitleFromIgnou(cc, cleanProgramme).catch(() => {});
        });
      } catch (e) {
        console.warn('Could not auto-save custom programme or course:', e);
      }

      const unpackedRows: CourseEvaluationRecord[] = data.courseCodes.map((courseCode) => {
        const cleanCourse = courseCode.trim().toUpperCase();
        const deterministicKey = generateDeterministicSubmissionKey(cleanEnrollment, cleanCourse, currentSession);
        const markVal = data.marks?.[courseCode] ?? null;
        const gradeInfo = calculateIGNOUGrade(markVal);
        const statusVal: EvaluationStatus = markVal !== null ? 'Evaluated' : 'Pending Allotment';
        const resolvedTitle = getCourseTitle(cleanCourse, cleanProgramme);

        return {
          // Clean Google Sheets Course_Ledger keys
          Sub_ID: deterministicKey,
          subId: deterministicKey,
          Session: currentSession,
          Enrollment_No: cleanEnrollment,
          Candidate_Name: cleanName,
          Contact_No: data.studentPhone?.trim() || '',
          Email_ID: data.studentEmail?.trim() || '',
          Programme_Code: cleanProgramme,
          Course_Code: cleanCourse,
          Course_Title: resolvedTitle,
          courseTitle: resolvedTitle,
          Programme: cleanProgramme,
          Allotted_Evaluator: '',
          Marks: markVal,
          Grade: gradeInfo.grade,
          Status: statusVal,

          // Application properties
          id: deterministicKey,
          submissionKey: deterministicKey,
          intakeId: newRecord.id,
          tokenNo,
          enrollmentNo: cleanEnrollment,
          studentName: cleanName,
          studentPhone: data.studentPhone?.trim() || '',
          studentEmail: data.studentEmail?.trim() || '',
          programmeCode: cleanProgramme,
          courseCode: cleanCourse,
          session: currentSession,
          submissionDate: data.submissionDate,
          submissionMode: data.submissionMode,
          consignmentNo: data.consignmentNo,
          evaluatorId: null,
          evaluatorCode: null,
          evaluatorName: null,
          allottedDate: null,
          allottedBy: null,
          marks: markVal,
          grade: gradeInfo.grade,
          gradeLabel: gradeInfo.label,
          isLocked: false,
          lockedAt: null,
          lockedBy: null,
          status: statusVal,
          updatedAt: new Date().toISOString(),
          remarks: data.remarks,
        };
      });

      setCourseEvaluations((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]));
        unpackedRows.forEach((row) => map.set(row.id, row));
        const combined = Array.from(map.values());
        // Immediate localStorage backup
        try {
          localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(combined));
          localStorage.setItem(STORAGE_KEYS.INTAKES, JSON.stringify([newRecord, ...intakes]));
        } catch {}
        return combined;
      });

      // Show confirmation toast immediately
      showToast('Saved & Synced with Google Sheet', 'success');

      // 2. On Intake Submission: Send POST with action "ADD_INTAKE". Save row to Intake_Register and automatically unpack courses to Course_Ledger
      const rawCourses = (data as any).courses || data.courseCodes || [];
      const coursesArray: string[] = (Array.isArray(rawCourses) ? rawCourses.join(',') : String(rawCourses))
        .split(',')
        .map((c: string) => c.trim().toUpperCase())
        .filter(Boolean);

      postAddIntake(
        {
          ...newRecord,
          enrollmentNo: data.enrollmentNo.trim(),
          candidateName: data.studentName.trim(),
          contact: (data.studentPhone || '').trim(),
          programme: data.programmeCode.trim().toUpperCase(),
          courses: coursesArray,
          handledBy: currentRole === 'ADMIN' ? 'Coordinator' : 'Desk Official',
          session: (data as any).session || currentSession,
          timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        },
        unpackedRows
      ).catch((err) => {
        console.warn('Google Sheets ADD_INTAKE notification:', err);
      });

      logAuditEvent({
        action: 'INTAKE_CREATED',
        category: 'ASSIGNMENT_INTAKE',
        actor: currentRole === 'ADMIN' ? `${settings.coordinatorName || 'Coordinator'} (Admin)` : 'Desk Official',
        role: currentRole,
        session: (data as any).session || currentSession,
        targetIdentifier: `${newRecord.tokenNo} (Enr: ${newRecord.enrollmentNo})`,
        summary: `Registered assignment intake for candidate ${newRecord.studentName} (Enrollment: ${newRecord.enrollmentNo}, Courses: ${coursesArray.join(', ')})`,
        details: { tokenNo: newRecord.tokenNo, courses: coursesArray, mode: newRecord.submissionMode },
        status: 'SUCCESS',
      });

      return newRecord;
    },
    [currentSession, intakes, courseEvaluations, currentRole, showToast, logAuditEvent, settings.coordinatorName]
  );

  const updateIntakeRecord = useCallback((id: string, updates: Partial<IntakeRecord>) => {
    setIntakes((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const editIntakeEntry = useCallback(
    (data: {
      id: string;
      originalEnrollmentNo: string;
      enrollmentNo: string;
      candidateName: string;
      contact: string;
      programme: string;
      courses: string[];
      session?: string;
      submissionDate?: string;
    }) => {
      const targetIntake = intakes.find((i) => i.id === data.id);
      const activeSession = data.session || targetIntake?.session || currentSession;
      const cleanOrigEnr = data.originalEnrollmentNo.trim();
      const cleanNewEnr = data.enrollmentNo.trim();
      const cleanName = data.candidateName.trim();
      const cleanContact = data.contact.trim();
      const cleanProg = data.programme.trim().toUpperCase();
      const cleanCourses = Array.from(new Set(data.courses.map((c) => c.trim().toUpperCase()).filter(Boolean)));

      // Check if any course removed by this edit was already locked in courseLedger
      const matchingCurrentStudentEvals = courseEvaluations.filter(
        (e) =>
          (e.intakeId === data.id || e.enrollmentNo.trim() === cleanOrigEnr) &&
          e.session.trim().toLowerCase() === activeSession.trim().toLowerCase()
      );
      for (const ce of matchingCurrentStudentEvals) {
        if (
          !cleanCourses.includes(ce.courseCode.toUpperCase()) &&
          (ce.isLocked || ce.status === 'Locked' || ce.status === 'Marks Locked')
        ) {
          alert(`Cannot remove course ${ce.courseCode}: Marks have already been locked.`);
          return;
        }
      }

      // 1. Optimistic state update across intakeRegister (intakes)
      try {
        saveCustomProgramme({ code: cleanProg });
        cleanCourses.forEach((cc) => {
          saveCustomCourse(cleanProg, { code: cc });
          updateCourseTitleFromIgnou(cc, cleanProg).catch(() => {});
        });
      } catch (e) {
        console.warn('Could not auto-save custom programme or course:', e);
      }

      let updatedIntakeRecord: IntakeRecord | null = null;
      setIntakes((prev) => {
        const next = prev.map((item) => {
          if (item.id === data.id || (item.enrollmentNo.trim() === cleanOrigEnr && item.session === activeSession)) {
            const newMarks: Record<string, number | null> = {};
            cleanCourses.forEach((c) => {
              newMarks[c] = item.marks?.[c] ?? null;
            });
            const allEntered = cleanCourses.length > 0 && cleanCourses.every((c) => newMarks[c] !== null && newMarks[c] !== undefined);
            const hasSomeMarks = cleanCourses.some((c) => newMarks[c] !== null && newMarks[c] !== undefined);
            const newStatus = allEntered ? 'Evaluated' : hasSomeMarks ? 'Under Evaluation' : item.status;

            const newSubDate = data.submissionDate ? data.submissionDate.trim() : item.submissionDate;
            const updated: IntakeRecord = {
              ...item,
              enrollmentNo: cleanNewEnr,
              studentName: cleanName,
              studentPhone: cleanContact,
              programmeCode: cleanProg,
              courseCodes: cleanCourses,
              submissionDate: newSubDate,
              Timestamp: newSubDate || item.Timestamp,
              marks: newMarks,
              status: newStatus,
            };
            updatedIntakeRecord = updated;
            return updated;
          }
          return item;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.INTAKES, JSON.stringify(next));
        } catch {}
        return next;
      });

      // 2. Optimistic state update across courseLedger (courseEvaluations)
      setCourseEvaluations((prev) => {
        const studentEvals = prev.filter(
          (e) =>
            (e.intakeId === data.id || e.enrollmentNo.trim() === cleanOrigEnr) &&
            e.session.trim().toLowerCase() === activeSession.trim().toLowerCase()
        );
        const existingCodes = studentEvals.map((e) => e.courseCode.toUpperCase());
        const otherEvals = prev.filter(
          (e) =>
            !(
              (e.intakeId === data.id || e.enrollmentNo.trim() === cleanOrigEnr) &&
              e.session.trim().toLowerCase() === activeSession.trim().toLowerCase()
            )
        );

        // Update existing evaluations that are kept
        const updatedExisting = studentEvals
          .filter((e) => cleanCourses.includes(e.courseCode.toUpperCase()))
          .map((e) => {
            const detKey = generateDeterministicSubmissionKey(cleanNewEnr, e.courseCode, activeSession);
            return {
              ...e,
              Sub_ID: detKey,
              subId: detKey,
              Session: activeSession,
              Enrollment_No: cleanNewEnr,
              Candidate_Name: cleanName,
              Programme: cleanProg,
              Course_Code: e.courseCode.toUpperCase(),
              enrollmentNo: cleanNewEnr,
              studentName: cleanName,
              studentPhone: cleanContact,
              programmeCode: cleanProg,
              submissionKey: detKey,
              submissionDate: data.submissionDate ? data.submissionDate.trim() : e.submissionDate,
              updatedAt: new Date().toISOString(),
            };
          });

        // Create new unpacked rows for newly added courses
        const addedCodes = cleanCourses.filter((c) => !existingCodes.includes(c));
        const newUnpackedRows: CourseEvaluationRecord[] = addedCodes.map((c) => {
          const detKey = generateDeterministicSubmissionKey(cleanNewEnr, c, activeSession);
          return {
            Sub_ID: detKey,
            subId: detKey,
            Session: activeSession,
            Enrollment_No: cleanNewEnr,
            Candidate_Name: cleanName,
            Programme: cleanProg,
            Course_Code: c.toUpperCase(),
            Allotted_Evaluator: '',
            Marks: null,
            Grade: '—',
            Status: 'Pending Allotment',

            id: detKey,
            submissionKey: detKey,
            intakeId: data.id,
            tokenNo: targetIntake?.tokenNo || `SC2033-${generateSessionCode(activeSession)}-MOD`,
            session: activeSession,
            enrollmentNo: cleanNewEnr,
            studentName: cleanName,
            studentPhone: cleanContact,
            programmeCode: cleanProg,
            courseCode: c,
            courseTitle: `${cleanProg} Course ${c}`,
            submissionDate: data.submissionDate ? data.submissionDate.trim() : (targetIntake?.submissionDate || new Date().toISOString().split('T')[0]),
            submissionMode: targetIntake?.submissionMode || 'In-Person (Desk)',
            consignmentNo: targetIntake?.consignmentNo || null,
            evaluatorId: null,
            evaluatorCode: null,
            evaluatorName: null,
            allottedDate: null,
            allottedBy: null,
            marks: null,
            grade: null,
            gradeLabel: null,
            isLocked: false,
            lockedAt: null,
            lockedBy: null,
            status: 'Pending Allotment',
            updatedAt: new Date().toISOString(),
            remarks: targetIntake?.remarks,
          };
        });

        const combined = [...otherEvals, ...updatedExisting, ...newUnpackedRows];
        try {
          localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(combined));
        } catch {}
        return combined;
      });

      // 3. Keep registration receipts in sync
      setRegistrationReceipts((prev) => {
        const next = prev.map((rcpt) => {
          if (rcpt.studentId.trim() === cleanOrigEnr && rcpt.session.trim().toLowerCase() === activeSession.trim().toLowerCase()) {
            return {
              ...rcpt,
              studentId: cleanNewEnr,
              studentName: cleanName,
              studentPhone: cleanContact,
              programmeCode: cleanProg,
              registeredCourses: cleanCourses,
              submissionDate: data.submissionDate ? data.submissionDate.trim() : rcpt.submissionDate,
              receiptDate: data.submissionDate ? data.submissionDate.trim() : rcpt.receiptDate,
              issuedAt: data.submissionDate ? `${data.submissionDate.trim()}T${new Date().toTimeString().split(' ')[0]}` : rcpt.issuedAt,
            };
          }
          return rcpt;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.REGISTRATION_RECEIPTS, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Keep open receipt modals in sync
      if (updatedIntakeRecord) {
        setSelectedReceiptRecord((prev) => (prev && prev.id === data.id ? { ...prev, ...updatedIntakeRecord } : prev));
      }

      // 4. Dispatch POST to Google Apps Script:
      // action: "EDIT_INTAKE",
      // payload: { originalEnrollmentNo, enrollmentNo, candidateName, contact, programme, courses, session: activeSession }
      // using mode: 'no-cors'.
      postEditIntake({
        originalEnrollmentNo: cleanOrigEnr,
        enrollmentNo: cleanNewEnr,
        candidateName: cleanName,
        contact: cleanContact,
        programme: cleanProg,
        courses: cleanCourses,
        session: activeSession,
      }).catch((err) => {
        console.warn('Google Sheets EDIT_INTAKE notification warning:', err);
      });

      // 5. Close modal & Toast: "Intake entry updated & synced"
      logAuditEvent({
        action: 'INTAKE_UPDATED',
        category: 'ASSIGNMENT_INTAKE',
        actor: currentRole === 'ADMIN' ? `${settings.coordinatorName || 'Coordinator'} (Admin)` : 'Desk Official',
        role: currentRole,
        session: activeSession,
        targetIdentifier: cleanNewEnr,
        summary: `Modified intake record for ${cleanName} (Enrollment: ${cleanNewEnr}, Programme: ${cleanProg}, Courses: ${cleanCourses.join(', ')})`,
        details: { enrollmentNo: cleanNewEnr, courses: cleanCourses, session: activeSession },
        status: 'SUCCESS',
      });

      showToast('Intake entry updated & synced', 'success');
    },
    [intakes, courseEvaluations, currentSession, showToast, logAuditEvent, currentRole, settings.coordinatorName]
  );

  const deleteIntakeRecord = useCallback(
    (id: string): boolean => {
      const target = intakes.find((i) => i.id === id);
      if (!target) return false;

      const targetSession = target.session || currentSession;
      const cleanEnr = target.enrollmentNo.trim();

      // Check if any course for this student in courseLedger has status === "Locked" or isLocked:
      const hasLocked = courseEvaluations.some(
        (ce) =>
          ce.enrollmentNo.trim() === cleanEnr &&
          ce.session.trim().toLowerCase() === targetSession.trim().toLowerCase() &&
          (ce.isLocked || ce.status === 'Locked' || ce.status === 'Marks Locked')
      );

      if (hasLocked) {
        alert('Cannot delete intake. Marks have already been locked for one or more courses.');
        return false;
      }

      // Optimistically remove the row from intakeRegister
      setIntakes((prev) => {
        const next = prev.filter((item) => item.id !== id);
        try {
          localStorage.setItem(STORAGE_KEYS.INTAKES, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Remove corresponding scripts from courseLedger
      setCourseEvaluations((prev) => {
        const next = prev.filter(
          (e) =>
            !(
              (e.intakeId === id || e.enrollmentNo.trim() === cleanEnr) &&
              e.session.trim().toLowerCase() === targetSession.trim().toLowerCase()
            )
        );
        try {
          localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Also remove from registrationReceipts
      setRegistrationReceipts((prev) => {
        const next = prev.filter(
          (rcpt) =>
            !(
              (rcpt.studentId.trim() === cleanEnr || rcpt.receiptNumber === target.tokenNo) &&
              rcpt.session.trim().toLowerCase() === targetSession.trim().toLowerCase()
            )
        );
        try {
          localStorage.setItem(STORAGE_KEYS.REGISTRATION_RECEIPTS, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Also remove from assignmentSubmissions
      setAssignmentSubmissions((prev) => {
        const next = prev.filter(
          (sub) =>
            !(
              sub.studentId.trim() === cleanEnr &&
              sub.session.trim().toLowerCase() === targetSession.trim().toLowerCase()
            )
        );
        try {
          localStorage.setItem(STORAGE_KEYS.ASSIGNMENT_SUBMISSIONS, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Dispatch POST to Google Apps Script:
      // action: "DELETE_INTAKE",
      // payload: { enrollmentNo, session: activeSession }
      // using mode: 'no-cors'.
      postDeleteIntake({
        enrollmentNo: cleanEnr,
        session: targetSession,
      }).catch((err) => {
        console.warn('Google Sheets DELETE_INTAKE notification warning:', err);
      });

      // Toast: "Intake receipt and ledger rows deleted"
      logAuditEvent({
        action: 'INTAKE_DELETED',
        category: 'ASSIGNMENT_INTAKE',
        actor: currentRole === 'ADMIN' ? `${settings.coordinatorName || 'Coordinator'} (Admin)` : 'Desk Official',
        role: currentRole,
        session: targetSession,
        targetIdentifier: cleanEnr,
        summary: `Purged intake submission & course ledger entries for student enrollment: ${cleanEnr}`,
        status: 'WARNING',
        details: { enrollmentNo: cleanEnr, session: targetSession },
      });

      showToast('Intake receipt and ledger rows deleted', 'success');
      return true;
    },
    [intakes, courseEvaluations, currentSession, showToast, logAuditEvent, currentRole, settings.coordinatorName]
  );

  const updateIntakeDate = useCallback(
    (idOrToken: string, newDate: string) => {
      if (!idOrToken || !newDate) return;
      const cleanDate = newDate.trim();
      let matchingSession = '';
      let matchingEnr = '';

      // 1. Update intakes
      setIntakes((prev) => {
        const next = prev.map((item) => {
          if (item.id === idOrToken || item.tokenNo === idOrToken) {
            matchingSession = item.session;
            matchingEnr = item.enrollmentNo;
            return {
              ...item,
              submissionDate: cleanDate,
              Timestamp: cleanDate,
            };
          }
          return item;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.INTAKES, JSON.stringify(next));
        } catch {}
        return next;
      });

      // 2. Update course evaluations
      setCourseEvaluations((prev) => {
        const next = prev.map((ce) => {
          if (
            ce.intakeId === idOrToken ||
            ce.tokenNo === idOrToken ||
            (matchingEnr && ce.enrollmentNo === matchingEnr && ce.session === matchingSession)
          ) {
            return {
              ...ce,
              submissionDate: cleanDate,
            };
          }
          return ce;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(next));
        } catch {}
        return next;
      });

      // 3. Update registration receipts
      setRegistrationReceipts((prev) => {
        const next = prev.map((rcpt) => {
          if (
            rcpt.id === idOrToken ||
            rcpt.receiptNumber === idOrToken ||
            (matchingEnr && rcpt.studentId === matchingEnr && rcpt.session === matchingSession)
          ) {
            return {
              ...rcpt,
              submissionDate: cleanDate,
              receiptDate: cleanDate,
              issuedAt: `${cleanDate}T${new Date().toTimeString().split(' ')[0]}`,
            };
          }
          return rcpt;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.REGISTRATION_RECEIPTS, JSON.stringify(next));
        } catch {}
        return next;
      });

      // 4. Update assignment submissions tracker
      setAssignmentSubmissions((prev) => {
        const next = prev.map((sub) => {
          if (
            matchingEnr &&
            sub.studentId === matchingEnr &&
            (!matchingSession || sub.session === matchingSession)
          ) {
            return {
              ...sub,
              submissionDate: cleanDate,
            };
          }
          return sub;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.ASSIGNMENT_SUBMISSIONS, JSON.stringify(next));
        } catch {}
        return next;
      });

      // 5. Update active receipt modal state if open
      setSelectedReceiptRecord((prev) => {
        if (!prev) return null;
        if (prev.id === idOrToken || prev.tokenNo === idOrToken) {
          return {
            ...prev,
            submissionDate: cleanDate,
            Timestamp: cleanDate,
          };
        }
        return prev;
      });

      setSelectedRegistrationReceipt((prev) => {
        if (!prev) return null;
        if (
          prev.id === idOrToken ||
          prev.receiptNumber === idOrToken ||
          (matchingEnr && prev.studentId === matchingEnr)
        ) {
          return {
            ...prev,
            submissionDate: cleanDate,
            receiptDate: cleanDate,
            issuedAt: `${cleanDate}T${new Date().toTimeString().split(' ')[0]}`,
          };
        }
        return prev;
      });

      logAuditEvent({
        action: 'INTAKE_DATE_CHANGED',
        category: 'ASSIGNMENT_INTAKE',
        actor: currentRole === 'ADMIN' ? `${settings.coordinatorName || 'Coordinator'} (Admin)` : 'Desk Official',
        role: currentRole,
        session: matchingSession || currentSession,
        targetIdentifier: matchingEnr || idOrToken,
        summary: `Calibrated submission intake date for record ${matchingEnr || idOrToken} to ${cleanDate}`,
        details: { target: idOrToken, enrollmentNo: matchingEnr, newDate: cleanDate },
        status: 'SUCCESS',
      });

      showToast(`Intake & receipt date updated to ${formatDate(cleanDate)}`, 'success');
    },
    [showToast, logAuditEvent, currentRole, settings.coordinatorName, currentSession]
  );

  const saveOrUpdateMarksAndLock = useCallback(
    async (
      row: any,
      marksValue: number | string | null | undefined,
      isLockAction: boolean = false
    ) => {
      if (isLockAction && !row.isLocked) {
        if (marksValue === null || marksValue === undefined || marksValue === '' || isNaN(Number(marksValue))) {
          alert('Cannot lock script: A valid numerical mark (0-100) must be recorded before locking.');
          return;
        }
      }
      if (!isLockAction && row.isLocked && (isUrlLockedDeskMode || currentRole !== 'ADMIN')) {
        alert('Permission Denied: Only an Administrator (Coordinator) can unlock marks for verified scripts. Unlocking permissions are strictly disabled in Desk Official mode.');
        return;
      }

      const cleanEnrollment = (row.Enrollment_No || row.enrollmentNo || '').toString().replace(/^'/, '').trim();
      const cleanCourse = (row.Course_Code || row.courseCode || '').toString().trim().toUpperCase();
      const rawSubId = (
        row.Sub_ID ||
        row.subId ||
        row.submissionKey ||
        row.id ||
        `SUB_${cleanEnrollment}_${cleanCourse}_${(row.session || currentSession || 'JUL2026').replace(/\s+/g, '')}`
      ).toString().trim();

      const numericMarks = marksValue !== null && marksValue !== undefined && marksValue !== ''
        ? Number(marksValue)
        : null;

      const calculatedGrade = numericMarks !== null ? getIgnouGrade(numericMarks).grade : '—';
      const gradeInfo = calculateIGNOUGrade(numericMarks);

      const payload = {
        subId: rawSubId,
        enrollmentNo: cleanEnrollment,
        courseCode: cleanCourse,
        marks: Number(numericMarks ?? 0),
        grade: calculatedGrade,
        isLocked: isLockAction,
      };

      const now = new Date().toISOString();
      const lockedBy = isLockAction
        ? currentRole === 'ADMIN'
          ? `${settings.coordinatorName || 'Dr. Sant K. Gupta'} (Coordinator)`
          : 'Desk Official'
        : null;

      // 1. Optimistic UI update for courseEvaluations
      setCourseEvaluations((prev) => {
        const index = prev.findIndex(
          (e) =>
            e.id === rawSubId ||
            e.submissionKey === rawSubId ||
            (e.enrollmentNo.trim() === cleanEnrollment && e.courseCode.trim().toUpperCase() === cleanCourse)
        );

        let next: CourseEvaluationRecord[];
        if (index >= 0) {
          next = prev.map((rec, i) => {
            if (i !== index) return rec;
            return {
              ...rec,
              marks: numericMarks,
              grade: calculatedGrade,
              gradeLabel: gradeInfo.label,
              isLocked: isLockAction,
              lockedAt: isLockAction ? now : null,
              lockedBy,
              status: isLockAction
                ? 'Marks Locked'
                : numericMarks !== null
                ? 'Evaluated'
                : rec.evaluatorId
                ? 'Allotted'
                : 'Pending Allotment',
              updatedAt: now,
            };
          });
        } else {
          const newEval: CourseEvaluationRecord = {
            id: rawSubId,
            submissionKey: rawSubId,
            tokenNo: row.tokenNo || `TOK-${cleanEnrollment.slice(-4)}`,
            enrollmentNo: cleanEnrollment,
            studentName: row.studentName || row.Candidate_Name || '',
            studentPhone: row.studentPhone || '',
            studentEmail: row.studentEmail || '',
            programmeCode: row.programmeCode || row.Programme || 'BAG',
            courseCode: cleanCourse,
            session: row.session || currentSession,
            submissionDate: row.submissionDate || now.split('T')[0],
            submissionMode: row.submissionMode || 'In-Person (Desk)',
            evaluatorId: null,
            allottedDate: null,
            marks: numericMarks,
            grade: calculatedGrade,
            gradeLabel: gradeInfo.label,
            isLocked: isLockAction,
            lockedAt: isLockAction ? now : null,
            lockedBy,
            status: isLockAction ? 'Marks Locked' : numericMarks !== null ? 'Evaluated' : 'Pending Allotment',
            updatedAt: now,
          };
          next = [newEval, ...prev];
        }

        try {
          localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Optimistic UI update for intakes
      setIntakes((prev) => {
        const next = prev.map((item) => {
          if (item.enrollmentNo.trim() !== cleanEnrollment) return item;
          const updatedMarks = { ...item.marks, [cleanCourse]: numericMarks };
          const allEntered = item.courseCodes.every((c) => updatedMarks[c] !== null && updatedMarks[c] !== undefined);
          const status = allEntered ? 'Evaluated' : item.status === 'Received' ? 'Under Evaluation' : item.status;
          return {
            ...item,
            marks: updatedMarks,
            status,
          };
        });
        try {
          localStorage.setItem(STORAGE_KEYS.INTAKES, JSON.stringify(next));
        } catch {}
        return next;
      });

      // 2. Dispatch POST to SCRIPT_URL:
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
        console.warn('Google Sheets UPDATE_MARKS fetch error:', err);
      }

      // Also call postUpdateMarks for server proxy fallback
      postUpdateMarks(payload).catch(() => {});

      logAuditEvent({
        action: isLockAction ? 'MARKS_LOCKED' : 'MARKS_UPDATED',
        category: 'MARKS_EVALUATION',
        actor: currentRole === 'ADMIN' ? `${settings.coordinatorName || 'Coordinator'} (Admin)` : 'Desk Official',
        role: currentRole,
        session: row.session || currentSession,
        targetIdentifier: `${cleanEnrollment} (${cleanCourse})`,
        summary: isLockAction
          ? `Verified and locked marks for candidate ${cleanEnrollment} in course ${cleanCourse} at ${payload.marks} (Grade ${payload.grade})`
          : `Updated marks draft for candidate ${cleanEnrollment} in course ${cleanCourse} to ${payload.marks} (Grade ${payload.grade})`,
        details: { enrollmentNo: cleanEnrollment, courseCode: cleanCourse, marks: payload.marks, grade: payload.grade, isLocked: isLockAction },
        status: 'SUCCESS',
      });

      // 3. Show toast notification as requested
      showToast(
        `Marks for ${payload.courseCode} (${payload.marks}/100 - Grade ${payload.grade}) updated & synced to Google Sheets`,
        'success'
      );
    },
    [currentRole, isUrlLockedDeskMode, settings.coordinatorName, currentSession, showToast, logAuditEvent]
  );

  const updateMarks = useCallback((intakeId: string, courseCode: string, marksValue: number | null) => {
    const intake = intakes.find((i) => i.id === intakeId);
    const cleanCourse = courseCode.trim().toUpperCase();
    const cleanEnrollment = (intake?.enrollmentNo || '').trim();

    const matchingEval = courseEvaluations.find(
      (e) => (e.intakeId === intakeId || e.enrollmentNo === cleanEnrollment) && e.courseCode === cleanCourse
    );

    const row = matchingEval || {
      subId: `SUB_${cleanEnrollment}_${cleanCourse}_${(intake?.session || currentSession).replace(/\s+/g, '')}`,
      Sub_ID: `SUB_${cleanEnrollment}_${cleanCourse}_${(intake?.session || currentSession).replace(/\s+/g, '')}`,
      enrollmentNo: cleanEnrollment,
      Enrollment_No: cleanEnrollment,
      courseCode: cleanCourse,
      Course_Code: cleanCourse,
      tokenNo: intake?.tokenNo,
      studentName: intake?.studentName,
      programmeCode: intake?.programmeCode,
      session: intake?.session || currentSession,
      isLocked: false,
    };

    saveOrUpdateMarksAndLock(row, marksValue, false);
  }, [intakes, courseEvaluations, currentSession, saveOrUpdateMarksAndLock]);

  // Module B: 2_Course_Evaluation_Master Allotment & Marks Engine Operations
  const allotEvaluatorToEvaluations = useCallback(
    (evaluationIds: string[], evaluatorId: string | null) => {
      const ev = evaluatorId
        ? evaluators.find(
            (e) =>
              e.id === evaluatorId ||
              e.evaluatorCode === evaluatorId ||
              `${e.evaluatorName || e.name} (${e.evaluatorCode})` === evaluatorId
          )
        : null;
      const now = new Date().toISOString();
      const dateStr = now.split('T')[0];
      const allottedBy = currentRole === 'ADMIN' ? 'Coordinator Desk' : 'Counter Desk Official';
      const evalDisplayName = ev ? `${ev.evaluatorName || ev.name} (${ev.evaluatorCode})` : null;

      setCourseEvaluations((prev) => {
        const updated = prev.map((rec) => {
          if (!evaluationIds.includes(rec.id)) return rec;
          if (rec.isLocked && currentRole !== 'ADMIN') return rec;

          return {
            ...rec,
            evaluatorId: ev ? ev.id : null,
            evaluatorCode: ev ? ev.evaluatorCode : null,
            evaluatorName: ev ? (ev.evaluatorName || ev.name) : null,
            Allotted_Evaluator: evalDisplayName,
            allottedDate: ev ? dateStr : null,
            allottedBy: ev ? allottedBy : null,
            status: rec.isLocked
              ? 'Marks Locked'
              : rec.marks !== null
              ? 'Evaluated'
              : ev
              ? 'Allotted'
              : 'Pending Allotment',
            updatedAt: now,
          };
        });

        try {
          localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(updated));
        } catch {}

        return updated;
      });

      // Dispatch ALLOT_EVALUATOR to Google Sheets
      if (ev) {
        evaluationIds.forEach((subId) => {
          postAllotEvaluator(subId, {
            id: ev.id,
            name: ev.evaluatorName || ev.name,
            evaluatorCode: ev.evaluatorCode,
            Allotted_Evaluator: evalDisplayName,
          }).catch((err) => console.warn(err));
        });
      }

      showToast('Saved & Synced with Google Sheet', 'success');
    },
    [evaluators, currentRole, showToast]
  );

  const updateEvaluationMarks = useCallback(
    (evaluationId: string, marksValue: number | null) => {
      let updatedCourse = '';
      let updatedEnr = '';
      let targetSession = '';
      let targetIntakeId = '';
      let subKey = '';
      let isRecLocked = false;

      const gradeInfo = calculateIGNOUGrade(marksValue);
      const now = new Date().toISOString();

      setCourseEvaluations((prev) =>
        prev.map((rec) => {
          if (rec.id !== evaluationId && rec.submissionKey !== evaluationId && (rec as any).Sub_ID !== evaluationId) return rec;
          if (rec.isLocked) {
            alert('Security Notice: This assignment script is locked. Marks cannot be edited unless unlocked by an Administrator.');
            return rec;
          }

          updatedCourse = rec.courseCode;
          updatedEnr = rec.enrollmentNo;
          targetSession = rec.session;
          targetIntakeId = rec.intakeId || '';
          subKey = rec.submissionKey || rec.id;
          isRecLocked = rec.isLocked;

          return {
            ...rec,
            marks: marksValue,
            grade: gradeInfo.grade,
            gradeLabel: gradeInfo.label,
            status: marksValue !== null ? 'Evaluated' : rec.evaluatorId ? 'Allotted' : 'Pending Allotment',
            updatedAt: now,
          };
        })
      );

      // Keep intakes table in sync and dispatch fail-safe UPDATE_MARKS writeback
      if (updatedCourse) {
        setIntakes((prev) =>
          prev.map((item) => {
            const matches = targetIntakeId
              ? item.id === targetIntakeId
              : item.enrollmentNo === updatedEnr && item.session === targetSession;
            if (!matches) return item;
            const nextMarks = { ...item.marks, [updatedCourse]: marksValue };
            const allEntered = item.courseCodes.every((c) => nextMarks[c] !== null && nextMarks[c] !== undefined);
            return {
              ...item,
              marks: nextMarks,
              status: allEntered ? 'Evaluated' : item.status === 'Received' ? 'Under Evaluation' : item.status,
            };
          })
        );

        // Fail-safe Google Sheets writeback with subId + composite keys (enrollmentNo + courseCode) via mode: 'no-cors'
        postUpdateMarks({
          subId: subKey || evaluationId,
          enrollmentNo: updatedEnr,
          courseCode: updatedCourse,
          marks: marksValue,
          grade: gradeInfo.grade,
          isLocked: isRecLocked,
        }).catch((err) => {
          console.warn('Google Sheets UPDATE_MARKS writeback warning:', err);
        });
      }
    },
    []
  );

  const toggleLockMarks = useCallback(
    (evaluationId: string, shouldLock: boolean) => {
      const rec = courseEvaluations.find(
        (e) =>
          e.id === evaluationId ||
          e.submissionKey === evaluationId ||
          (e as any).Sub_ID === evaluationId ||
          (e as any).subId === evaluationId
      );
      if (!rec) return;
      saveOrUpdateMarksAndLock(
        rec,
        (rec as any).Marks !== undefined && (rec as any).Marks !== '' ? (rec as any).Marks : (rec as any).marks,
        shouldLock
      );
    },
    [courseEvaluations, saveOrUpdateMarksAndLock]
  );

  const batchLockMarks = useCallback(
    (evaluationIds: string[], shouldLock: boolean) => {
      if (!shouldLock && (isUrlLockedDeskMode || currentRole !== 'ADMIN')) {
        alert('Permission Denied: Only an Administrator (Coordinator) can unlock marks. Unlocking permissions are strictly disabled in Desk Official mode.');
        return;
      }

      const now = new Date().toISOString();
      const lockedBy = currentRole === 'ADMIN' ? `${settings.coordinatorName || 'Dr. Sant K. Gupta'} (Coordinator)` : 'Desk Official';

      setCourseEvaluations((prev) => {
        const next = prev.map((rec) => {
          if (!evaluationIds.includes(rec.id)) return rec;

          if (shouldLock) {
            if (rec.marks === null || rec.marks === undefined) return rec;
            const gradeInfo = calculateIGNOUGrade(rec.marks);
            // 3. On Marks Locking: Send POST with action "UPDATE_MARKS" containing subId, enrollmentNo, courseCode, marks, calculated grade, and isLocked: true
            postUpdateMarks({
              subId: rec.submissionKey || rec.id,
              enrollmentNo: rec.enrollmentNo,
              courseCode: rec.courseCode,
              marks: rec.marks,
              grade: gradeInfo.grade,
              isLocked: true,
            }).catch((err) => {
              console.warn('Google Sheets UPDATE_MARKS notification:', err);
            });
            return {
              ...rec,
              isLocked: true,
              lockedAt: now,
              lockedBy,
              status: 'Marks Locked',
              updatedAt: now,
            };
          } else {
            const gradeInfo = calculateIGNOUGrade(rec.marks);
            postUpdateMarks({
              subId: rec.submissionKey || rec.id,
              enrollmentNo: rec.enrollmentNo,
              courseCode: rec.courseCode,
              marks: rec.marks,
              grade: gradeInfo.grade,
              isLocked: false,
            }).catch((err) => {
              console.warn('Google Sheets UPDATE_MARKS notification:', err);
            });
            return {
              ...rec,
              isLocked: false,
              lockedAt: null,
              lockedBy,
              status: rec.marks !== null ? 'Evaluated' : rec.evaluatorId ? 'Allotted' : 'Pending Allotment',
              updatedAt: now,
            };
          }
        });

        try {
          localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(next));
        } catch {}

        return next;
      });

      if (shouldLock) {
        showToast('Saved & Synced with Google Sheet', 'success');
      }
    },
    [currentRole, isUrlLockedDeskMode, settings.coordinatorName, showToast]
  );

  // Course Packets
  const createPacket = useCallback(
    (data: { courseCode: string; programmeCode: string; evaluatorId: string | null; scriptCount: number; expectedReturnDate?: string; notes?: string }) => {
      const sessionCode = generateSessionCode(currentSession);
      const cleanCode = data.courseCode.replace(/[^a-zA-Z0-9]/g, '');
      const existingPackets = packets.filter((p) => p.session === currentSession && p.courseCode === data.courseCode);
      const packetNumber = `PKT-${sessionCode}-${cleanCode}-${String(existingPackets.length + 1).padStart(2, '0')}`;

      const newPacket: CoursePacket = {
        id: `pkt-${Date.now()}`,
        session: currentSession,
        packetNumber,
        courseCode: data.courseCode,
        programmeCode: data.programmeCode,
        evaluatorId: data.evaluatorId,
        scriptCount: data.scriptCount,
        assignedDate: data.evaluatorId ? new Date().toISOString().split('T')[0] : null,
        expectedReturnDate: data.expectedReturnDate || null,
        returnedDate: null,
        status: data.evaluatorId ? 'Dispatched' : 'Formed',
        notes: data.notes,
      };

      setPackets((prev) => [newPacket, ...prev]);
      return newPacket;
    },
    [currentSession, packets]
  );

  const updatePacket = useCallback((id: string, updates: Partial<CoursePacket>) => {
    setPackets((prev) => prev.map((pkt) => (pkt.id === id ? { ...pkt, ...updates } : pkt)));
  }, []);

  const deletePacket = useCallback((id: string) => {
    setPackets((prev) => prev.filter((pkt) => pkt.id !== id));
  }, []);

  // Evaluators Master
  const addEvaluator = useCallback((data: Omit<Evaluator, 'id' | 'lastSyncedAt'>) => {
    const newEvaluator: Evaluator = {
      ...data,
      id: `ev-${Date.now()}`,
      lastSyncedAt: new Date().toISOString(),
    };
    setEvaluators((prev) => [...prev, newEvaluator]);
    return newEvaluator;
  }, []);

  const updateEvaluator = useCallback((id: string, updates: Partial<Evaluator>) => {
    setEvaluators((prev) => prev.map((ev) => (ev.id === id ? { ...ev, ...updates } : ev)));
  }, []);

  const deleteEvaluator = useCallback((id: string) => {
    setEvaluators((prev) => prev.filter((ev) => ev.id !== id));
  }, []);

  // 1. Google Sheets Backend Hydration & Persistent Storage Sync (fetchAllData / syncGoogleSheets)
  const fetchAllData = useCallback(async (isSilent = false) => {
    setIsSyncingSheets(true);
    setSyncStatus('Syncing with Google Sheets...');
    try {
      let data: any = null;

      // 1. Try direct fetch from SCRIPT_URL with redirect: "follow"
      try {
        const res = await fetch(SCRIPT_URL, { method: "GET", redirect: "follow" });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            data = await res.json();
          } else {
            const text = await res.text();
            try {
              data = JSON.parse(text);
            } catch {
              // Not direct JSON
            }
          }
        }
      } catch (directErr) {
        console.warn('[Direct SCRIPT_URL fetch failed, trying proxy]:', directErr);
      }

      // 2. If direct fetch failed or gave non-JSON, try the Express backend proxy
      if (!data || (!data.intakeRegister && !data.intakes && !data.courseLedger)) {
        try {
          const proxyRes = await fetch(`/api/sheets?action=doGet&scriptUrl=${encodeURIComponent(SCRIPT_URL)}`, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          if (proxyRes.ok) {
            data = await proxyRes.json();
          }
        } catch (proxyErr) {
          console.warn('[Proxy fetch error]:', proxyErr);
        }
      }

      // 3. Fallback to doGet() if data still empty
      if (!data || (!data.intakeRegister && !data.intakes && !data.courseLedger)) {
        const dogetRes = await doGet();
        if (dogetRes.success) {
          data = {
            intakeRegister: dogetRes.intakes,
            courseLedger: dogetRes.courseLedger,
            evaluatorsMaster: dogetRes.evaluatorsMaster,
          };
        }
      }

      if (data) {
        const rawIntake = data.intakeRegister || data.intakes || data.Intake_Register || [];
        const rawLedger = data.courseLedger || data.course_ledger || data.Course_Ledger || [];

        // 1. Universal Normalizer: Intake Register
        const cleanIntake = rawIntake.map((r: any) => {
          const rawCourses = r.Courses || r.courses || r.courseCodes || "";
          const courseArr = Array.isArray(rawCourses)
            ? rawCourses
            : rawCourses.toString().split(",").map((c: string) => c.trim()).filter(Boolean);

          const enrollment = (r.Enrollment_No || r.enrollmentNo || r["Enrollment No"] || "").toString().replace(/^'/, '').trim();
          const candidate = (r.Candidate_Name || r.candidateName || r["Candidate Name"] || r.studentName || "").toString().trim();
          const session = normalizeSessionName(r.Session || r.session || "July 2026");
          const programme = (r.Programme || r.programme || r.programmeCode || "MEG").toString().trim();
          const rawContact = r.Contact || r.contact || r.studentPhone || "";
          const contact = (rawContact).toString().replace(/^'/, '').trim();
          const explicitDate = r.submissionDate || r.Submission_Date || r.Date || r.date || r.receiptDate;
          const rawTimestamp = r.Timestamp || r.timestamp || r.createdAt || "";
          const subDate = explicitDate
            ? String(explicitDate).split('T')[0]
            : (rawTimestamp ? String(rawTimestamp).split('T')[0] : new Date().toISOString().split('T')[0]);
          const timestamp = rawTimestamp || `${subDate}T10:00:00Z`;
          const official = r.Official || r.handledBy || r.official || "Desk Official";
          const id = r.id || r.tokenNo || r.Token_No || `intake-${enrollment}-${session.replace(/\s+/g, '')}`;
          const tokenNo = r.tokenNo || r.Token_No || id;

          return {
            timestamp,
            session,
            enrollmentNo: enrollment,
            candidateName: candidate,
            contact,
            programme,
            courses: courseArr,
            coursesStr: courseArr.join(", "),
            handledBy: official,
            // Dual-key fallbacks
            Timestamp: timestamp,
            Session: session,
            Enrollment_No: enrollment,
            Candidate_Name: candidate,
            Contact: contact,
            Programme: programme,
            Courses: courseArr.join(", "),
            Official: official,
            // Component compatibility keys
            id,
            tokenNo,
            studentName: candidate,
            studentPhone: contact,
            programmeCode: programme,
            courseCodes: courseArr,
            submissionDate: subDate,
            submissionMode: r.submissionMode || 'In-Person (Desk)',
            status: r.status || r.Status || 'Received',
            marks: r.marks || {},
            createdAt: timestamp,
            receiptNumber: r.receiptNumber || tokenNo,
          };
        });

        // 2. Universal Normalizer: Course Ledger
        const cleanLedger = rawLedger.map((r: any) => {
          const enrollment = (r.Enrollment_No || r.enrollmentNo || r["Enrollment No"] || "").toString().replace(/^'/, '').trim();
          const course = (r.Course_Code || r.courseCode || r["Course Code"] || "").toString().trim().toUpperCase();
          const session = normalizeSessionName(r.Session || r.session || "July 2026", r.Sub_ID || r.subId);
          const subId = (r.Sub_ID || r.subId || r.id || `SUB_${enrollment}_${course}_${session.replace(/\s+/g, '')}`).toString().trim();
          const candidate = (r.Candidate_Name || r.candidateName || r["Candidate Name"] || r.studentName || "").toString().trim();
          const programme = (r.Programme || r.programme || r.programmeCode || "MEG").toString().trim();
          const evaluator = r.Allotted_Evaluator || r.allottedEvaluator || r.evaluatorName || "Unallotted";
          const marks = (r.Marks !== undefined && r.Marks !== "") ? r.Marks : (r.marks !== undefined ? r.marks : "");
          const numMarks = (marks !== "" && marks !== null && !isNaN(Number(marks))) ? Number(marks) : null;
          const grade = r.Grade || r.grade || (numMarks !== null ? calculateIGNOUGrade(numMarks).grade : "");
          const status = r.Status || r.status || "Pending";
          const isLocked = Boolean(status === 'Locked' || status === 'Marks Locked' || r.isLocked);

          return {
            subId,
            session,
            enrollmentNo: enrollment,
            candidateName: candidate,
            programme,
            courseCode: course,
            allottedEvaluator: evaluator,
            marks,
            grade,
            status,
            // Dual-key fallbacks
            Sub_ID: subId,
            Session: session,
            Enrollment_No: enrollment,
            Candidate_Name: candidate,
            Programme: programme,
            Course_Code: course,
            Allotted_Evaluator: evaluator,
            Marks: marks,
            Grade: grade,
            Status: status,
            // Component compatibility keys
            id: subId,
            submissionKey: subId,
            studentName: candidate,
            programmeCode: programme,
            evaluatorName: evaluator !== 'Unallotted' ? evaluator : null,
            isLocked,
            tokenNo: r.tokenNo || '',
            submissionDate: r.submissionDate || new Date().toISOString().split('T')[0],
            submissionMode: r.submissionMode || 'In-Person (Desk)',
          };
        });

        // 3. Update React State
        setIntakes(cleanIntake as any);
        setCourseEvaluations(cleanLedger as any);

        // Also update Registration Receipts so receipts view has latest entries
        setRegistrationReceipts((prev) => {
          const map = new Map(prev.map((item) => [item.id || item.receiptNumber, item]));
          cleanIntake.forEach((item: any) => {
            map.set(item.id, {
              id: item.id,
              receiptNumber: item.tokenNo || item.id,
              studentId: item.enrollmentNo,
              studentName: item.candidateName,
              studentPhone: item.contact,
              programmeCode: item.programme,
              session: item.session,
              registeredCourses: item.courses,
              issuedBy: item.handledBy,
              issuedAt: item.submissionDate ? `${item.submissionDate}T10:00:00Z` : (item.timestamp || new Date().toISOString()),
              submissionDate: item.submissionDate,
              receiptDate: item.submissionDate,
              remarks: '',
              Enrollment_No: item.enrollmentNo,
              Candidate_Name: item.candidateName,
              Contact: item.contact,
              Programme: item.programme,
              Courses: item.courses,
              Timestamp: item.submissionDate || item.timestamp,
              Official: item.handledBy,
              Session: item.session,
            } as any);
          });
          return Array.from(map.values());
        });

        // Also update Assignment Submissions so Course Submissions Tracker is hydrated
        setAssignmentSubmissions((prev) => {
          const map = new Map(prev.map((s) => [s.id, s]));
          cleanLedger.forEach((cl: any) => {
            const id = cl.subId || `sub-${cl.enrollmentNo}-${cl.courseCode}`;
            map.set(id, {
              id,
              studentId: cl.enrollmentNo,
              studentName: cl.candidateName,
              programmeCode: cl.programme,
              courseCode: cl.courseCode,
              session: cl.session,
              status: cl.isLocked ? 'locked' : cl.status === 'Evaluated' ? 'evaluated' : 'submitted',
              submissionDate: cl.submissionDate || new Date().toISOString().split('T')[0],
              submissionMode: (cl.submissionMode as any) || 'In-Person (Desk)',
              Session: cl.session,
              Course_Code: cl.courseCode,
              Enrollment_No: cl.enrollmentNo,
            } as any);
          });
          return Array.from(map.values());
        });

        // 4. Update LocalStorage Cache immediately so data survives reloads & login
        localStorage.setItem("ignou_sc2033_intake", JSON.stringify(cleanIntake));
        localStorage.setItem("ignou_sc2033_ledger", JSON.stringify(cleanLedger));
        localStorage.setItem(STORAGE_KEYS.INTAKES, JSON.stringify(cleanIntake));
        localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(cleanLedger));

        // Auto-register any incoming sessions in settings
        const incomingSessions = new Set<string>();
        cleanIntake.forEach((r: any) => { if (r.session) incomingSessions.add(r.session); });
        cleanLedger.forEach((r: any) => { if (r.session) incomingSessions.add(r.session); });
        if (incomingSessions.size > 0) {
          setSettings((prev) => {
            const updated = Array.from(new Set([...prev.availableSessions, ...incomingSessions]));
            if (updated.length !== prev.availableSessions.length) {
              return { ...prev, availableSessions: updated };
            }
            return prev;
          });
        }

        const syncMsg = `Synced (${cleanIntake.length} receipts, ${cleanLedger.length} scripts)`;
        setSyncStatus(syncMsg);

        const now = new Date();
        const formattedDate = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
        setLastSheetSync(formattedDate);
        localStorage.setItem(STORAGE_KEYS.LAST_SHEET_SYNC, formattedDate);

        // Also handle evaluatorsMaster if present
        if (data.evaluatorsMaster && data.evaluatorsMaster.length > 0) {
          const parsedEvaluators = parseEvaluatorsMaster(data.evaluatorsMaster);
          if (parsedEvaluators.length > 0) {
            setEvaluators(parsedEvaluators);
            localStorage.setItem(STORAGE_KEYS.EVALUATORS_MASTER, JSON.stringify(parsedEvaluators));
            localStorage.setItem(STORAGE_KEYS.EVALUATORS, JSON.stringify(parsedEvaluators));
          }
        }

        if (!isSilent) {
          showToast(syncMsg, 'success');
        }
      } else {
        setSyncStatus('Using Cached Data (Offline)');
        if (!isSilent) {
          showToast('Offline mode: Using cached data', 'info');
        }
      }
    } catch (err) {
      console.warn('[fetchAllData error]:', err);
      setSyncStatus('Sync Failed (Using Cache)');
      if (!isSilent) {
        showToast('Sync failed. Using cached data.', 'warning');
      }
    } finally {
      setIsSyncingSheets(false);
    }
  }, [showToast]);

  fetchAllDataRef.current = fetchAllData;

  const syncGoogleSheets = fetchAllData;

  const [isSyncingEvaluators, setIsSyncingEvaluators] = useState<boolean>(false);

  const syncEvaluatorsDirectory = useCallback(async () => {
    setIsSyncingEvaluators(true);
    try {
      const res = await doGet();
      if (res.evaluatorsMaster && res.evaluatorsMaster.length > 0) {
        const parsed = parseEvaluatorsMaster(res.evaluatorsMaster);
        if (parsed.length > 0) {
          setEvaluators(parsed);
          try {
            localStorage.setItem(STORAGE_KEYS.EVALUATORS_MASTER, JSON.stringify(parsed));
            localStorage.setItem(STORAGE_KEYS.EVALUATORS, JSON.stringify(parsed));
          } catch {}
        }
      }
      const now = new Date();
      const formattedDate = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
      setLastSheetSync(formattedDate);
      localStorage.setItem(STORAGE_KEYS.LAST_SHEET_SYNC, formattedDate);
      showToast('Evaluators Directory Synced', 'success');
    } catch (err) {
      console.warn('[Evaluators Directory Sync Error]:', err);
      showToast('Evaluators Directory Synced', 'success');
    } finally {
      setIsSyncingEvaluators(false);
    }
  }, [showToast]);

  // 1. On Load: Call doGet() to hydrate IntakeRegister and CourseLedger state from Google Sheets
  useEffect(() => {
    syncGoogleSheets(true);
  }, [syncGoogleSheets]);

  // Billing & Remuneration
  const generateBill = useCallback(
    (evaluatorId: string, courseCodes: string[], totalScripts: number, rateOverride?: number) => {
      const ev = evaluators.find((e) => e.id === evaluatorId || e.evaluatorCode === evaluatorId);
      const rate = rateOverride !== undefined ? Number(rateOverride) : Number(settings.remunerationRatePerScript || 27.50);
      const scriptAmount = totalScripts * rate;
      const conveyanceAmount = Number(settings.conveyanceAllowancePerPacket ?? 0.00);
      const grossAmount = scriptAmount + conveyanceAmount;
      const sessionCode = generateSessionCode(currentSession);
      const billNumber = `BILL-SC2033-${sessionCode}-${String(bills.length + 1).padStart(3, '0')}`;

      const newBill: RemunerationBill = {
        id: `bill-${Date.now()}`,
        session: currentSession,
        billNumber,
        evaluatorId: ev?.id || evaluatorId,
        evaluatorCode: ev?.evaluatorCode || 'EV-UNK',
        evaluatorName: ev?.name || ev?.evaluatorName || 'Academic Counsellor',
        bankAccountNo: ev?.bankAccountNo || ev?.accountNumber || '',
        accountNumber: ev?.bankAccountNo || ev?.accountNumber || '',
        ifscCode: ev?.ifscCode || '',
        bankName: ev?.bankName || '',
        panNumber: ev?.panNumber || '',
        department: ev?.department || '',
        designation: ev?.designation || '',
        courseCodes,
        totalScripts,
        ratePerScript: rate,
        scriptAmount,
        conveyanceAmount,
        grossAmount,
        sanctionStatus: 'Draft',
      };

      setBills((prev) => [newBill, ...prev]);
      return newBill;
    },
    [evaluators, settings, currentSession, bills.length]
  );

  const sanctionBill = useCallback(
    (billId: string) => {
      if (currentRole !== 'ADMIN') {
        alert('Permission Denied: Only Administrator / Study Centre Coordinator can sanction remuneration bills.');
        return;
      }
      setBills((prev) =>
        prev.map((b) =>
          b.id === billId
            ? {
                ...b,
                sanctionStatus: 'Sanctioned',
                sanctionedDate: new Date().toISOString().split('T')[0],
                sanctionedBy: `${settings.coordinatorName} (Coordinator, ${settings.centreCode})`,
              }
            : b
        )
      );
    },
    [currentRole, settings]
  );

  const disburseBill = useCallback((billId: string, ref: string) => {
    setBills((prev) =>
      prev.map((b) =>
        b.id === billId
          ? {
              ...b,
              sanctionStatus: 'Disbursed',
              disbursedDate: new Date().toISOString().split('T')[0],
              disbursementReference: ref,
            }
          : b
      )
    );
  }, []);

  // Settings
  const updateSettings = useCallback((newValues: Partial<SystemSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newValues };
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
        localStorage.setItem('ignou_sc2033_settings', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to persist settings:', err);
      }
      return updated;
    });
  }, []);

  const resetAllData = useCallback(() => {
    if (window.confirm('Are you sure you want to reset all data to initial institutional seed state? This cannot be undone.')) {
      const defaultResetSettings = {
        ...INITIAL_SETTINGS,
        remunerationRatePerScript: 27.50,
        conveyanceAllowancePerPacket: 0.00,
        coordinationChargesPerScript: 0.00,
      };
      setSettings(defaultResetSettings);
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultResetSettings));
        localStorage.setItem('ignou_sc2033_settings', JSON.stringify(defaultResetSettings));
      } catch {}
      setIntakes([]); // Submissions register: []
      setEvaluators(INITIAL_EVALUATORS);
      setPackets([]); // Course packets: [] (0 packets)
      setBills([]);
      setAssignmentSubmissions([]);
      setRegistrationReceipts([]);
      setCourseEvaluations([]); // Course ledger: []
      setCurrentSessionState(INITIAL_SETTINGS.defaultSession);
      setCurrentRole('ADMIN');
      localStorage.removeItem('ignou_intake_register');
      localStorage.removeItem('ignou_course_ledger');
      localStorage.removeItem('ignou_course_packets');
      localStorage.removeItem('ignou_marks_draft');
      localStorage.removeItem('ignou_conveyance');
      localStorage.removeItem('ignou_coordination');
      localStorage.removeItem('ignou_remuneration_rate');
      localStorage.removeItem('ignou_conveyance_allowance');
      localStorage.removeItem('ignou_coordination_charges');
      localStorage.removeItem('ignou_packets_tracker');
      localStorage.removeItem('ignou_sc2033_packets');
      localStorage.removeItem('ignou_sc2033_remuneration_rate');
      localStorage.removeItem('ignou_sc2033_conveyance_allowance');
      localStorage.removeItem('ignou_sc2033_coordination_charges');
      localStorage.removeItem('ignou_sc2033_intakes');
      localStorage.removeItem('ignou_sc2033_course_evaluations');
      localStorage.removeItem('ignou_sc2033_bills');
      localStorage.removeItem('ignou_sc2033_assignment_submissions');
      localStorage.removeItem('ignou_sc2033_registration_receipts');
      localStorage.removeItem('custom_allowances');
      localStorage.clear();
      window.dispatchEvent(new CustomEvent('ignou_factory_reset'));
    }
  }, []);

  // Academic Session Archival & History Snapshots Handlers
  const downloadArchiveJSON = useCallback((archive: SessionArchiveRecord) => {
    const cleanSession = (archive.session || 'Session').replace(/[^a-zA-Z0-9]/g, '_');
    const datePart = new Date(archive.archivedAt || Date.now()).toISOString().split('T')[0];
    const filename = `IGNOU_SC2033_HistoryArchive_${cleanSession}_${datePart}.json`;
    const jsonStr = JSON.stringify(archive, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const createSessionArchive = useCallback((params: {
    name: string;
    session: string;
    notes?: string;
    startNewSession?: boolean;
    newSessionName?: string;
    downloadJSON?: boolean;
  }): SessionArchiveRecord => {
    const targetSession = params.session || currentSession;
    
    // Filter records belonging to targetSession
    const sessionIntakesList = intakes.filter((r) => norm(r.session) === norm(targetSession));
    const sessionEvaluationsList = courseEvaluations.filter((r) => norm(r.session) === norm(targetSession));
    const sessionPacketsList = packets.filter((p) => norm(p.session) === norm(targetSession));
    const sessionBillsList = bills.filter((b) => norm(b.session) === norm(targetSession));
    const sessionSubmissionsList = assignmentSubmissions.filter((s) => norm(s.session) === norm(targetSession));
    const sessionReceiptsList = registrationReceipts.filter((r) => norm(r.session) === norm(targetSession));

    const uniqueCandidates = new Set(sessionIntakesList.map((r) => (r.enrollmentNo || '').trim())).size;

    const archiveRecord: SessionArchiveRecord = {
      id: `ARCHIVE-${targetSession.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${Date.now()}`,
      name: params.name || `${targetSession} Closeout Archive`,
      session: targetSession,
      archivedAt: new Date().toISOString(),
      archivedBy: `${settings.coordinatorName || 'Administrator'} (${settings.centreCode || 'SC-2033'})`,
      notes: params.notes || 'Academic session historical snapshot',
      stats: {
        totalIntakes: sessionIntakesList.length,
        totalCandidates: uniqueCandidates,
        totalCourseScripts: sessionEvaluationsList.length,
        totalPackets: sessionPacketsList.length,
        totalBills: sessionBillsList.length,
        totalEvaluated: sessionEvaluationsList.filter((e) => e.marks !== null && e.marks !== undefined && e.marks !== '').length,
        totalLocked: sessionEvaluationsList.filter((e) => Boolean(e.isLocked || e.status === 'Locked' || e.status === 'Marks Locked')).length,
      },
      snapshot: {
        session: targetSession,
        intakes: sessionIntakesList,
        courseEvaluations: sessionEvaluationsList,
        packets: sessionPacketsList,
        bills: sessionBillsList,
        assignmentSubmissions: sessionSubmissionsList,
        registrationReceipts: sessionReceiptsList,
        settings: {
          centreCode: settings.centreCode,
          centreName: settings.centreName,
          regionalCentre: settings.regionalCentre,
          coordinatorName: settings.coordinatorName,
          remunerationRatePerScript: settings.remunerationRatePerScript,
        },
      },
    };

    setArchives((prev) => [archiveRecord, ...prev.filter((a) => a.id !== archiveRecord.id)]);

    // Download JSON file if requested (defaults to true)
    if (params.downloadJSON !== false) {
      downloadArchiveJSON(archiveRecord);
    }

    // If startNewSession is selected, clear active records for this session to give a clean slate
    if (params.startNewSession) {
      // 1. Remove active records for targetSession from active registers
      setIntakes((prev) => prev.filter((r) => norm(r.session) !== norm(targetSession)));
      setCourseEvaluations((prev) => prev.filter((r) => norm(r.session) !== norm(targetSession)));
      setPackets((prev) => prev.filter((p) => norm(p.session) !== norm(targetSession)));
      setBills((prev) => prev.filter((b) => norm(b.session) !== norm(targetSession)));
      setAssignmentSubmissions((prev) => prev.filter((s) => norm(s.session) !== norm(targetSession)));
      setRegistrationReceipts((prev) => prev.filter((r) => norm(r.session) !== norm(targetSession)));

      // 2. Switch to new session if provided
      if (params.newSessionName && params.newSessionName.trim()) {
        const nextSession = params.newSessionName.trim();
        setSettings((prev) => {
          if (!prev.availableSessions.includes(nextSession)) {
            return {
              ...prev,
              availableSessions: [...prev.availableSessions, nextSession],
            };
          }
          return prev;
        });
        setCurrentSessionState(nextSession);
      }
    }

    showToast(
      params.startNewSession
        ? `Session ${targetSession} archived & started new session: ${params.newSessionName || 'Fresh State'}`
        : `Snapshot for ${targetSession} saved to History (${archiveRecord.stats.totalCourseScripts} scripts)`,
      'success'
    );

    return archiveRecord;
  }, [currentSession, intakes, courseEvaluations, packets, bills, assignmentSubmissions, registrationReceipts, settings, downloadArchiveJSON, showToast]);

  const deleteArchive = useCallback((archiveId: string) => {
    setArchives((prev) => prev.filter((a) => a.id !== archiveId));
    showToast('Historical archive deleted', 'info');
  }, [showToast]);

  const restoreArchive = useCallback((archiveId: string): boolean => {
    const target = archives.find((a) => a.id === archiveId);
    if (!target) return false;

    const snap = target.snapshot;
    // Add/merge restored records
    setIntakes((prev) => {
      const existingIds = new Set((snap.intakes || []).map((r) => r.id));
      const filtered = prev.filter((r) => !existingIds.has(r.id));
      return [...(snap.intakes || []), ...filtered];
    });

    setCourseEvaluations((prev) => {
      const existingIds = new Set((snap.courseEvaluations || []).map((e) => e.id));
      const filtered = prev.filter((e) => !existingIds.has(e.id));
      return [...(snap.courseEvaluations || []), ...filtered];
    });

    setPackets((prev) => {
      const existingIds = new Set((snap.packets || []).map((p) => p.id));
      const filtered = prev.filter((p) => !existingIds.has(p.id));
      return [...(snap.packets || []), ...filtered];
    });

    setBills((prev) => {
      const existingIds = new Set((snap.bills || []).map((b) => b.id));
      const filtered = prev.filter((b) => !existingIds.has(b.id));
      return [...(snap.bills || []), ...filtered];
    });

    setAssignmentSubmissions((prev) => {
      const existingIds = new Set((snap.assignmentSubmissions || []).map((s) => s.id));
      const filtered = prev.filter((s) => !existingIds.has(s.id));
      return [...(snap.assignmentSubmissions || []), ...filtered];
    });

    setRegistrationReceipts((prev) => {
      const existingIds = new Set((snap.registrationReceipts || []).map((r) => r.id));
      const filtered = prev.filter((r) => !existingIds.has(r.id));
      return [...(snap.registrationReceipts || []), ...filtered];
    });

    // Ensure session is in availableSessions and switch to it
    setSettings((prev) => {
      if (!prev.availableSessions.includes(target.session)) {
        return {
          ...prev,
          availableSessions: [...prev.availableSessions, target.session],
        };
      }
      return prev;
    });
    setCurrentSessionState(target.session);

    showToast(`Restored snapshot '${target.name}' (${target.session}) into active state`, 'success');
    return true;
  }, [archives, showToast]);

  const importArchiveJSON = useCallback((archiveData: any): SessionArchiveRecord => {
    if (!archiveData || typeof archiveData !== 'object' || !archiveData.snapshot) {
      throw new Error('Invalid archive JSON format: Missing snapshot object.');
    }
    const newArchive: SessionArchiveRecord = {
      id: archiveData.id || `ARCHIVE-IMPORT-${Date.now()}`,
      name: archiveData.name || `Imported Archive (${archiveData.session || 'Session'})`,
      session: archiveData.session || currentSession,
      archivedAt: archiveData.archivedAt || new Date().toISOString(),
      archivedBy: archiveData.archivedBy || 'Imported File',
      notes: archiveData.notes || 'Imported from offline JSON backup',
      stats: archiveData.stats || {
        totalIntakes: archiveData.snapshot.intakes?.length || 0,
        totalCandidates: new Set((archiveData.snapshot.intakes || []).map((r: any) => r.enrollmentNo)).size,
        totalCourseScripts: archiveData.snapshot.courseEvaluations?.length || 0,
        totalPackets: archiveData.snapshot.packets?.length || 0,
        totalBills: archiveData.snapshot.bills?.length || 0,
        totalEvaluated: (archiveData.snapshot.courseEvaluations || []).filter((e: any) => e.marks !== null).length,
        totalLocked: (archiveData.snapshot.courseEvaluations || []).filter((e: any) => e.isLocked).length,
      },
      snapshot: archiveData.snapshot,
    };

    setArchives((prev) => [newArchive, ...prev.filter((a) => a.id !== newArchive.id)]);
    showToast(`Imported archive '${newArchive.name}' to History`, 'success');
    return newArchive;
  }, [currentSession, showToast]);

  // Modal helpers
  const openReceiptModal = useCallback((record: IntakeRecord) => {
    setSelectedReceiptRecord(record);
  }, []);

  const closeReceiptModal = useCallback(() => {
    setSelectedReceiptRecord(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentSession,
        setSession,
        availableSessions: settings.availableSessions,
        addSession,
        currentRole,
        setRole,
        toggleRole,
        isAdmin,
        isOfficial,
        isUrlLockedDeskMode,
        isAdminPinModalOpen,
        adminPinError,
        openAdminPinModal,
        closeAdminPinModal,
        verifyAndSetAdminRole,
        // Gatekeeper Authentication & RBAC (SC-2033)
        isAuthenticated,
        setIsAuthenticated,
        userRole,
        setUserRole,
        securityPins,
        setSecurityPins,
        updateSecurityPins,
        handleLogin,
        logout,
        sessionIntakes,
        allIntakes: intakes,
        intakeRegister: intakes,
        setIntakeRegister: setIntakes,
        addIntakeRecord,
        updateIntakeRecord,
        editIntakeEntry,
        updateIntakeDate,
        deleteIntakeRecord,
        updateMarks,
        saveOrUpdateMarksAndLock,
        // Module B: Course Evaluations
        courseLedger: courseEvaluations,
        setCourseLedger: setCourseEvaluations,
        sessionCourseEvaluations,
        allCourseEvaluations: courseEvaluations,
        allotEvaluatorToEvaluations,
        updateEvaluationMarks,
        toggleLockMarks,
        batchLockMarks,
        sessionAssignmentSubmissions,
        allAssignmentSubmissions: assignmentSubmissions,
        updateSubmissionStatus,
        batchUpdateSubmissionStatus,
        recordStudentAssignmentSubmissions,
        sessionRegistrationReceipts,
        allRegistrationReceipts: registrationReceipts,
        addRegistrationReceipt,
        selectedRegistrationReceipt,
        openRegistrationReceiptModal,
        closeRegistrationReceiptModal,
        sessionPackets,
        packets,
        setPackets,
        coursePackets: packets,
        setCoursePackets: setPackets,
        createPacket,
        updatePacket,
        deletePacket,
        evaluators,
        addEvaluator,
        updateEvaluator,
        deleteEvaluator,
        isSyncingSheets,
        syncStatus,
        syncGoogleSheets,
        fetchAllData,
        isSyncingEvaluators,
        syncEvaluatorsDirectory,
        lastSheetSync,
        sessionBills,
        generateBill,
        sanctionBill,
        disburseBill,
        settings,
        updateSettings,
        resetAllData,
        selectedReceiptRecord,
        openReceiptModal,
        closeReceiptModal,
        // Module E: Global Student Search
        isSearchModalOpen,
        searchInitialQuery,
        openSearchModal,
        closeSearchModal,
        // Navigation Sidebar Collapsible & Hideable State
        isSidebarHidden,
        setIsSidebarHidden,
        toggleSidebarHidden,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebarCollapsed,
        // Header & Full-Page Workspace View Modes
        isHeaderCompact,
        setIsHeaderCompact,
        toggleHeaderCompact,
        isContentFullWidth,
        setIsContentFullWidth,
        toggleContentFullWidth,
        // Theme & Visual Preferences
        currentTheme,
        setTheme,
        isDark,
        toggleDark,
        // Toast Notification System
        toastMessage,
        toastType,
        showToast,
        hideToast,
        // Custom Programmes, Course Registry & IGNOU Resolution
        allProgrammes,
        customProgrammes,
        customCourses,
        courseTitlesRegistry,
        saveCustomProgramme,
        removeCustomProgramme,
        saveCustomCourse,
        getProgrammeCourses,
        getCourseTitle,
        getCourseInfo,
        updateCourseTitleFromIgnou,
        // Academic Session Archival & History Snapshots
        archives,
        createSessionArchive,
        deleteArchive,
        restoreArchive,
        downloadArchiveJSON,
        importArchiveJSON,
        // Audit Trail & Accountability Logs
        auditLogs,
        logAuditEvent,
        clearAuditLogs,
        exportAuditLogsCSV,
        exportAuditLogsJSON,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
