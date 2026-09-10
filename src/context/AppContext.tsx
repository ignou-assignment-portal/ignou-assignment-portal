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
} from '../types';
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
} from '../data/ignouMasterData';
import { generateSessionCode, generateDeterministicSubmissionKey, calculateIGNOUGrade, getIgnouGrade } from '../utils/helpers';
import { doGet, postAddIntake, postEditIntake, postDeleteIntake, postUpdateMarks, postAllotEvaluator, SCRIPT_URL } from '../services/sheetsService';

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
  }) => void;
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
  addRegistrationReceipt: (receiptData: Omit<RegistrationReceipt, 'id' | 'receiptNumber' | 'issuedAt'>) => RegistrationReceipt;
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
  syncGoogleSheets: () => Promise<void>;
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

  // Toast Notification System
  toastMessage: string | null;
  toastType: 'success' | 'info' | 'warning' | 'error';
  showToast: (message?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  hideToast: () => void;
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
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
      return (saved as UserRole) || 'OFFICIAL';
    } catch {
      return 'OFFICIAL';
    }
  });

  // Admin PIN Protection State
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(false);
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  useEffect(() => {
    if (isUrlLockedDeskMode && currentRole !== 'OFFICIAL') {
      setCurrentRole('OFFICIAL');
    }
  }, [isUrlLockedDeskMode, currentRole]);

  // Database States: Start cleanly with empty arrays (0 records) if cache is empty
  const [intakes, setIntakes] = useState<IntakeRecord[]>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEYS.INTAKES) ||
        localStorage.getItem('ignou_intake_register');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
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
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Database Table: RegistrationReceipts
  const [registrationReceipts, setRegistrationReceipts] = useState<RegistrationReceipt[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REGISTRATION_RECEIPTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Module B Table: Course Evaluations (Course Ledger)
  const [courseEvaluations, setCourseEvaluations] = useState<CourseEvaluationRecord[]>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEYS.COURSE_EVALUATIONS) ||
        localStorage.getItem('ignou_course_ledger');
      const data: CourseEvaluationRecord[] = saved ? JSON.parse(saved) : [];
      return data.map((rec) => ({
        ...rec,
        lockedBy: rec.lockedBy?.includes('Aggarwal') ? 'Dr. Sant K. Gupta (Coordinator)' : rec.lockedBy,
      }));
    } catch {
      return [];
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
      localStorage.setItem(STORAGE_KEYS.COURSE_EVALUATIONS, JSON.stringify(courseEvaluations));
    } catch (e) {
      console.error('Failed to persist course evaluations', e);
    }
  }, [courseEvaluations]);

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
        return false;
      }
      const expectedPin = (settings.adminPin || '2033').trim();
      if (enteredPin.trim() === expectedPin) {
        setCurrentRole('ADMIN');
        setIsAdminPinModalOpen(false);
        setAdminPinError(null);
        return true;
      } else {
        setAdminPinError('Invalid Administrator PIN. Access denied. Reverting to Desk Official role.');
        setCurrentRole('OFFICIAL');
        return false;
      }
    },
    [isUrlLockedDeskMode, settings.adminPin]
  );

  // Role switching
  const setRole = useCallback(
    (role: UserRole) => {
      if (isUrlLockedDeskMode) {
        setCurrentRole('OFFICIAL');
        return;
      }
      if (role === 'ADMIN') {
        openAdminPinModal();
      } else {
        setCurrentRole('OFFICIAL');
      }
    },
    [isUrlLockedDeskMode, openAdminPinModal]
  );

  const toggleRole = useCallback(() => {
    if (isUrlLockedDeskMode) {
      return;
    }
    if (currentRole === 'ADMIN') {
      setCurrentRole('OFFICIAL');
    } else {
      openAdminPinModal();
    }
  }, [isUrlLockedDeskMode, currentRole, openAdminPinModal]);

  const isAdmin = !isUrlLockedDeskMode && currentRole === 'ADMIN';
  const isOfficial = isUrlLockedDeskMode || currentRole === 'OFFICIAL';

  // Flexible Session Isolation (Normalizes case and whitespace):
  // sessionIntakes, sessionPackets, sessionBills, sessionAssignmentSubmissions, sessionRegistrationReceipts
  const cleanActiveSession = (currentSession || "July 2026").trim().toLowerCase();

  const sessionIntakes = useMemo(() => {
    return intakes.filter((r: any) => {
      const rowSession = (r.Session || r.session || "July 2026").toString().trim().toLowerCase();
      return rowSession === cleanActiveSession || cleanActiveSession === "all";
    });
  }, [intakes, cleanActiveSession]);

  const sessionCourseEvaluations = useMemo(() => {
    return courseEvaluations.filter((c: any) => {
      const rowSession = (c.Session || c.session || "July 2026").toString().trim().toLowerCase();
      return rowSession === cleanActiveSession || cleanActiveSession === "all";
    });
  }, [courseEvaluations, cleanActiveSession]);

  const sessionPackets = useMemo(() => {
    if (sessionCourseEvaluations.length === 0) {
      return [];
    }
    const activeCourses = new Set(sessionCourseEvaluations.map((c) => c.courseCode.toUpperCase()));
    return packets.filter((p: any) => {
      const rowSession = (p.Session || p.session || "July 2026").toString().trim().toLowerCase();
      return (rowSession === cleanActiveSession || cleanActiveSession === "all") && activeCourses.has((p.courseCode || p.Course_Code || '').toUpperCase());
    });
  }, [packets, cleanActiveSession, sessionCourseEvaluations]);

  const sessionBills = useMemo(() => {
    return bills.filter((b: any) => {
      const rowSession = (b.Session || b.session || "July 2026").toString().trim().toLowerCase();
      return rowSession === cleanActiveSession || cleanActiveSession === "all";
    });
  }, [bills, cleanActiveSession]);

  const sessionAssignmentSubmissions = useMemo(() => {
    return assignmentSubmissions.filter((s: any) => {
      const rowSession = (s.Session || s.session || "July 2026").toString().trim().toLowerCase();
      return rowSession === cleanActiveSession || cleanActiveSession === "all";
    });
  }, [assignmentSubmissions, cleanActiveSession]);

  const sessionRegistrationReceipts = useMemo(() => {
    return registrationReceipts.filter((r: any) => {
      const rowSession = (r.Session || r.session || "July 2026").toString().trim().toLowerCase();
      return rowSession === cleanActiveSession || cleanActiveSession === "all";
    });
  }, [registrationReceipts, cleanActiveSession]);

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
    (data: Omit<RegistrationReceipt, 'id' | 'receiptNumber' | 'issuedAt'>): RegistrationReceipt => {
      const sessionCode = generateSessionCode(data.session);
      const sessionReceipts = registrationReceipts.filter((r) => r.session === data.session);
      const nextSequence = sessionReceipts.length + 1;
      const paddedSeq = String(nextSequence).padStart(4, '0');
      const receiptNumber = `REG-SC2033-${sessionCode}-${paddedSeq}`;

      const newReceipt: RegistrationReceipt = {
        ...data,
        id: `reg-receipt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        receiptNumber,
        issuedAt: new Date().toISOString(),
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

      const unpackedRows: CourseEvaluationRecord[] = data.courseCodes.map((courseCode) => {
        const cleanCourse = courseCode.trim().toUpperCase();
        const deterministicKey = generateDeterministicSubmissionKey(cleanEnrollment, cleanCourse, currentSession);
        const markVal = data.marks?.[courseCode] ?? null;
        const gradeInfo = calculateIGNOUGrade(markVal);
        const statusVal: EvaluationStatus = markVal !== null ? 'Evaluated' : 'Pending Allotment';

        return {
          // Clean Google Sheets Course_Ledger keys
          Sub_ID: deterministicKey,
          subId: deterministicKey,
          Session: currentSession,
          Enrollment_No: cleanEnrollment,
          Candidate_Name: cleanName,
          Programme: cleanProgramme,
          Course_Code: cleanCourse,
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

      return newRecord;
    },
    [currentSession, intakes, courseEvaluations, currentRole, showToast]
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

            const updated: IntakeRecord = {
              ...item,
              enrollmentNo: cleanNewEnr,
              studentName: cleanName,
              studentPhone: cleanContact,
              programmeCode: cleanProg,
              courseCodes: cleanCourses,
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
            submissionDate: targetIntake?.submissionDate || new Date().toISOString().split('T')[0],
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
            };
          }
          return rcpt;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.REGISTRATION_RECEIPTS, JSON.stringify(next));
        } catch {}
        return next;
      });

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
      showToast('Intake entry updated & synced', 'success');
    },
    [intakes, courseEvaluations, currentSession, showToast]
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
      showToast('Intake receipt and ledger rows deleted', 'success');
      return true;
    },
    [intakes, courseEvaluations, currentSession, showToast]
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

      // 3. Show toast notification as requested
      showToast(
        `Marks for ${payload.courseCode} (${payload.marks}/100 - Grade ${payload.grade}) updated & synced to Google Sheets`,
        'success'
      );
    },
    [currentRole, isUrlLockedDeskMode, settings.coordinatorName, currentSession, showToast]
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
          if (rec.id !== evaluationId) return rec;
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
      const rec = courseEvaluations.find((e) => e.id === evaluationId || e.submissionKey === evaluationId);
      if (!rec) return;
      saveOrUpdateMarksAndLock(rec, rec.marks, shouldLock);
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

  // 1. Google Sheets Backend Hydration (doGet)
  const syncGoogleSheets = useCallback(async (isSilent = false) => {
    setIsSyncingSheets(true);
    setSyncStatus('Syncing...');
    try {
      const res = await doGet();
      if (res.success) {
        if (res.intakes && res.intakes.length > 0) {
          setIntakes((prev) => {
            const map = new Map(prev.map((i) => [i.tokenNo || i.id, i]));
            res.intakes?.forEach((item: any) => {
              const enr = item.Enrollment_No || item.enrollmentNo || item.studentId || item['Enrollment No'] || '';
              const sess = item.Session || item.session || currentSession || 'July 2026';
              const key = item.Token_No || item.tokenNo || item.id || `intake-${enr}-${sess}`;
              const candName = item.Candidate_Name || item.candidateName || item.studentName || item['Candidate Name'] || '';
              const contact = item.Contact || item.contact || item.studentPhone || item['Contact Number'] || '';
              const prog = item.Programme || item.programme || item.programmeCode || '';
              const courseRaw = item.Courses || item.courses || item.courseCodes || item.Course_Codes || [];
              const courseCodesArr = Array.isArray(courseRaw)
                ? courseRaw
                : typeof courseRaw === 'string'
                ? courseRaw.split(',').map((c: string) => c.trim()).filter(Boolean)
                : [];
              const ts = item.Timestamp || item.timestamp || item.createdAt || new Date().toISOString();
              const official = item.Official || item.handledBy || item.official || 'Desk Official';
              map.set(key, {
                id: item.id || key,
                tokenNo: item.tokenNo || item.Token_No || key,
                enrollmentNo: enr,
                studentName: candName,
                studentPhone: contact,
                studentEmail: item.Email || item.studentEmail || '',
                programmeCode: prog,
                courseCodes: courseCodesArr,
                submissionDate: item.Timestamp ? String(item.Timestamp).split('T')[0] : (item.submissionDate || new Date().toISOString().split('T')[0]),
                submissionMode: item.submissionMode || 'In-Person (Desk)',
                consignmentNo: item.consignmentNo,
                session: sess,
                status: item.status || 'Received',
                marks: item.marks || {},
                remarks: item.remarks || '',
                createdAt: ts,
                // Also store raw / alternate keys for transparent access
                Enrollment_No: enr,
                Candidate_Name: candName,
                Contact: contact,
                Programme: prog,
                Courses: courseCodesArr,
                Timestamp: ts,
                Official: official,
              } as any);
            });
            return Array.from(map.values());
          });

          // Also populate registrationReceipts so Receipts Register reflects all synced intakes
          setRegistrationReceipts((prev) => {
            const map = new Map(prev.map((r) => [r.id || r.receiptNumber, r]));
            res.intakes?.forEach((item: any) => {
              const enr = item.Enrollment_No || item.enrollmentNo || item.studentId || item['Enrollment No'] || '';
              const sess = item.Session || item.session || currentSession || 'July 2026';
              const candName = item.Candidate_Name || item.candidateName || item.studentName || item['Candidate Name'] || '';
              const contact = item.Contact || item.contact || item.studentPhone || item['Contact Number'] || '';
              const prog = item.Programme || item.programme || item.programmeCode || '';
              const official = item.Official || item.handledBy || item.official || item.issuedBy || 'Desk Official';
              const ts = item.Timestamp || item.timestamp || item.createdAt || item.submissionDate || new Date().toISOString();
              const token = item.Token_No || item.tokenNo || item.id || `REG-${enr}-${sess}`;
              const courseRaw = item.Courses || item.courses || item.courseCodes || item.Course_Codes || [];
              const courseCodesArr = Array.isArray(courseRaw)
                ? courseRaw
                : typeof courseRaw === 'string'
                ? courseRaw.split(',').map((c: string) => c.trim()).filter(Boolean)
                : [];
              const key = item.id || token;
              map.set(key, {
                id: key,
                receiptNumber: item.receiptNumber || token,
                studentId: enr,
                studentName: candName,
                studentPhone: contact,
                programmeCode: prog,
                session: sess,
                registeredCourses: courseCodesArr,
                issuedBy: official,
                issuedAt: ts,
                remarks: item.remarks || '',
                // Dual keys
                Enrollment_No: enr,
                Candidate_Name: candName,
                Contact: contact,
                Programme: prog,
                Courses: courseCodesArr,
                Timestamp: ts,
                Official: official,
              } as any);
            });
            return Array.from(map.values());
          });
        }

        if (res.courseLedger && res.courseLedger.length > 0) {
          setCourseEvaluations((prev) => {
            const map = new Map<string, CourseEvaluationRecord>(prev.map((c) => [c.submissionKey || c.id, c]));
            res.courseLedger?.forEach((item: any) => {
              const key: string = String(item.Sub_ID || item.subId || item.submissionKey || item.id || '');
              if (!key) return;
              const existing: CourseEvaluationRecord | undefined = map.get(key);
              const rawMark = (item.Marks !== undefined && item.Marks !== '' && item.Marks !== null)
                ? item.Marks
                : (item.marks !== undefined && item.marks !== '' && item.marks !== null)
                ? item.marks
                : null;
              const markVal = rawMark !== null && rawMark !== undefined ? Number(rawMark) : null;
              const gradeInfo = calculateIGNOUGrade(markVal);
              const isLocked = item.Status === 'Locked' || item.status === 'Locked' || item.isLocked === true || item.isLocked === 'true';
              const evaluatorName = item.Allotted_Evaluator || item.allottedEvaluator || item.evaluatorName || existing?.evaluatorName || null;
              const merged: CourseEvaluationRecord = {
                // Clean Google Sheets Course_Ledger keys
                Sub_ID: key,
                subId: key,
                Session: item.Session || item.session || existing?.session || currentSession,
                Enrollment_No: item.Enrollment_No || item.enrollmentNo || existing?.enrollmentNo || '',
                Candidate_Name: item.Candidate_Name || item.candidateName || item.studentName || existing?.studentName || '',
                Programme: item.Programme || item.programme || item.programmeCode || existing?.programmeCode || '',
                Course_Code: item.Course_Code || item.courseCode || existing?.courseCode || '',
                Allotted_Evaluator: evaluatorName && evaluatorName !== 'Unallotted' ? evaluatorName : '',
                Marks: markVal,
                Grade: item.Grade || item.grade || gradeInfo.grade,
                Status: isLocked ? 'Marks Locked' : markVal !== null ? 'Evaluated' : (evaluatorName && evaluatorName !== 'Unallotted') ? 'Allotted' : 'Pending Allotment',

                id: key,
                submissionKey: key,
                tokenNo: item.tokenNo || existing?.tokenNo || '',
                enrollmentNo: item.Enrollment_No || item.enrollmentNo || existing?.enrollmentNo || '',
                studentName: item.Candidate_Name || item.candidateName || item.studentName || existing?.studentName || '',
                studentPhone: existing?.studentPhone || '',
                studentEmail: existing?.studentEmail || '',
                programmeCode: item.Programme || item.programme || item.programmeCode || existing?.programmeCode || '',
                courseCode: item.Course_Code || item.courseCode || existing?.courseCode || '',
                session: item.Session || item.session || existing?.session || currentSession,
                submissionDate: item.submissionDate || existing?.submissionDate || new Date().toISOString().split('T')[0],
                submissionMode: item.submissionMode || existing?.submissionMode || 'In-Person (Desk)',
                consignmentNo: item.consignmentNo || existing?.consignmentNo,
                evaluatorId: existing?.evaluatorId || null,
                evaluatorCode: existing?.evaluatorCode || null,
                evaluatorName: evaluatorName && evaluatorName !== 'Unallotted' ? evaluatorName : null,
                allottedDate: existing?.allottedDate || null,
                allottedBy: existing?.allottedBy || null,
                marks: markVal,
                grade: item.Grade || item.grade || gradeInfo.grade,
                gradeLabel: gradeInfo.label,
                isLocked,
                lockedAt: existing?.lockedAt || (isLocked ? new Date().toISOString() : null),
                lockedBy: existing?.lockedBy || (isLocked ? 'Coordinator' : null),
                status: isLocked ? 'Marks Locked' : markVal !== null ? 'Evaluated' : (evaluatorName && evaluatorName !== 'Unallotted') ? 'Allotted' : 'Pending Allotment',
                updatedAt: new Date().toISOString(),
                remarks: existing?.remarks || '',
              };
              map.set(key, merged);
            });
            return Array.from(map.values());
          });
        }
      }
      // Hydrate evaluators master if present
      if (res.evaluatorsMaster && res.evaluatorsMaster.length > 0) {
        const parsedEvaluators = parseEvaluatorsMaster(res.evaluatorsMaster);
        if (parsedEvaluators.length > 0) {
          setEvaluators(parsedEvaluators);
          try {
            localStorage.setItem(STORAGE_KEYS.EVALUATORS_MASTER, JSON.stringify(parsedEvaluators));
            localStorage.setItem(STORAGE_KEYS.EVALUATORS, JSON.stringify(parsedEvaluators));
          } catch {}
        }
      }

      const now = new Date();
      const formattedDate = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
      setLastSheetSync(formattedDate);
      localStorage.setItem(STORAGE_KEYS.LAST_SHEET_SYNC, formattedDate);
      setEvaluators((prev) =>
        prev.map((ev) => ({
          ...ev,
          lastSyncedAt: now.toISOString(),
        }))
      );

      const receiptsCount = res.intakes?.length || 0;
      const scriptsCount = res.courseLedger?.length || 0;
      const statusText = `Synced (${receiptsCount} receipts, ${scriptsCount} scripts)`;
      setSyncStatus(statusText);
      if (!isSilent) {
        showToast(statusText, 'success');
      }
    } catch (err) {
      console.warn('[Google Sheets Sync Error]:', err);
      setSyncStatus('Sync Failed');
      if (!isSilent) {
        showToast('Sync failed. Please check network.', 'warning');
      }
    } finally {
      setIsSyncingSheets(false);
    }
  }, [currentSession, showToast]);

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
        sessionIntakes,
        allIntakes: intakes,
        intakeRegister: intakes,
        setIntakeRegister: setIntakes,
        addIntakeRecord,
        updateIntakeRecord,
        editIntakeEntry,
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
        // Toast Notification System
        toastMessage,
        toastType,
        showToast,
        hideToast,
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
