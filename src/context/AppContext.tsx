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
import { generateSessionCode, generateDeterministicSubmissionKey, calculateIGNOUGrade } from '../utils/helpers';
import { doGet, postAddIntake, postUpdateMarks, postAllotEvaluator, SCRIPT_URL } from '../services/sheetsService';

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
  addIntakeRecord: (record: Omit<IntakeRecord, 'id' | 'session' | 'tokenNo' | 'createdAt' | 'marks'> & { marks?: Record<string, number | null> }) => IntakeRecord;
  updateIntakeRecord: (id: string, updates: Partial<IntakeRecord>) => void;
  deleteIntakeRecord: (id: string) => void;
  updateMarks: (intakeId: string, courseCode: string, marks: number | null) => void;

  // Module B: 2_Course_Evaluation_Master (Automated Ledger Unpacking & Marks Engine)
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
  PACKETS: 'ignou_sc2033_packets',
  BILLS: 'ignou_sc2033_bills',
  ASSIGNMENT_SUBMISSIONS: 'ignou_sc2033_assignment_submissions',
  REGISTRATION_RECEIPTS: 'ignou_sc2033_registration_receipts',
  COURSE_EVALUATIONS: 'ignou_sc2033_course_evaluations',
  ROLE: 'ignou_sc2033_user_role',
  CURRENT_SESSION: 'ignou_sc2033_current_session',
  LAST_SHEET_SYNC: 'ignou_sc2033_last_sheet_sync',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Settings & Sessions
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
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

  // Database Simulation States
  const [intakes, setIntakes] = useState<IntakeRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INTAKES);
      return saved ? JSON.parse(saved) : INITIAL_INTAKE_RECORDS;
    } catch {
      return INITIAL_INTAKE_RECORDS;
    }
  });

  const [evaluators, setEvaluators] = useState<Evaluator[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVALUATORS);
      return saved ? JSON.parse(saved) : INITIAL_EVALUATORS;
    } catch {
      return INITIAL_EVALUATORS;
    }
  });

  const [packets, setPackets] = useState<CoursePacket[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PACKETS);
      return saved ? JSON.parse(saved) : INITIAL_PACKETS;
    } catch {
      return INITIAL_PACKETS;
    }
  });

  const [bills, setBills] = useState<RemunerationBill[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BILLS);
      return saved ? JSON.parse(saved) : INITIAL_BILLS;
    } catch {
      return INITIAL_BILLS;
    }
  });

  // Mock Database Table: AssignmentSubmissions
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ASSIGNMENT_SUBMISSIONS);
      return saved ? JSON.parse(saved) : INITIAL_ASSIGNMENT_SUBMISSIONS;
    } catch {
      return INITIAL_ASSIGNMENT_SUBMISSIONS;
    }
  });

  // Mock Database Table: RegistrationReceipts
  const [registrationReceipts, setRegistrationReceipts] = useState<RegistrationReceipt[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REGISTRATION_RECEIPTS);
      return saved ? JSON.parse(saved) : INITIAL_REGISTRATION_RECEIPTS;
    } catch {
      return INITIAL_REGISTRATION_RECEIPTS;
    }
  });

  // Module B Table: Course Evaluations (2_Course_Evaluation_Master)
  const [courseEvaluations, setCourseEvaluations] = useState<CourseEvaluationRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COURSE_EVALUATIONS);
      return saved ? JSON.parse(saved) : INITIAL_COURSE_EVALUATIONS;
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
    } catch (e) {
      console.error('Failed to persist evaluators', e);
    }
  }, [evaluators]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PACKETS, JSON.stringify(packets));
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

  // Strict Session Isolation:
  // sessionIntakes, sessionPackets, sessionBills, sessionAssignmentSubmissions, sessionRegistrationReceipts
  // ONLY return records for active session
  const sessionIntakes = useMemo(() => {
    return intakes.filter((r) => r.session === currentSession);
  }, [intakes, currentSession]);

  const sessionPackets = useMemo(() => {
    return packets.filter((p) => p.session === currentSession);
  }, [packets, currentSession]);

  const sessionBills = useMemo(() => {
    return bills.filter((b) => b.session === currentSession);
  }, [bills, currentSession]);

  const sessionAssignmentSubmissions = useMemo(() => {
    return assignmentSubmissions.filter((s) => s.session === currentSession);
  }, [assignmentSubmissions, currentSession]);

  const sessionRegistrationReceipts = useMemo(() => {
    return registrationReceipts.filter((r) => r.session === currentSession);
  }, [registrationReceipts, currentSession]);

  const sessionCourseEvaluations = useMemo(() => {
    return courseEvaluations.filter((c) => c.session === currentSession);
  }, [courseEvaluations, currentSession]);

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
      const sessionCode = generateSessionCode(currentSession);
      // Count current session intakes to build deterministic sequential token
      const existingInSession = intakes.filter((r) => r.session === currentSession);
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
      const unpackedRows: CourseEvaluationRecord[] = data.courseCodes.map((courseCode) => {
        const deterministicKey = generateDeterministicSubmissionKey(data.enrollmentNo, courseCode, currentSession);
        const markVal = data.marks?.[courseCode] ?? null;
        const gradeInfo = calculateIGNOUGrade(markVal);
        return {
          id: deterministicKey,
          submissionKey: deterministicKey,
          intakeId: newRecord.id,
          tokenNo,
          enrollmentNo: data.enrollmentNo,
          studentName: data.studentName,
          studentPhone: data.studentPhone,
          studentEmail: data.studentEmail,
          programmeCode: data.programmeCode,
          courseCode,
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
          status: markVal !== null ? 'Evaluated' : 'Pending Allotment',
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
      postAddIntake(newRecord, unpackedRows).catch((err) => {
        console.warn('Google Sheets ADD_INTAKE notification:', err);
      });

      return newRecord;
    },
    [currentSession, intakes, showToast]
  );

  const updateIntakeRecord = useCallback((id: string, updates: Partial<IntakeRecord>) => {
    setIntakes((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const deleteIntakeRecord = useCallback((id: string) => {
    const target = intakes.find((i) => i.id === id);
    setIntakes((prev) => prev.filter((item) => item.id !== id));
    if (target) {
      setCourseEvaluations((prev) => prev.filter((e) => e.intakeId !== id && e.tokenNo !== target.tokenNo));
    }
  }, [intakes]);

  const updateMarks = useCallback((intakeId: string, courseCode: string, marksValue: number | null) => {
    setIntakes((prev) =>
      prev.map((item) => {
        if (item.id !== intakeId) return item;
        const updatedMarks = { ...item.marks, [courseCode]: marksValue };
        // Check if all marks are entered
        const allEntered = item.courseCodes.every((c) => updatedMarks[c] !== null && updatedMarks[c] !== undefined);
        const status = allEntered ? 'Evaluated' : item.status === 'Received' ? 'Under Evaluation' : item.status;
        return {
          ...item,
          marks: updatedMarks,
          status,
        };
      })
    );

    const gradeInfo = calculateIGNOUGrade(marksValue);
    setCourseEvaluations((prev) =>
      prev.map((rec) => {
        if (rec.intakeId === intakeId && rec.courseCode === courseCode) {
          if (rec.isLocked) return rec;
          return {
            ...rec,
            marks: marksValue,
            grade: gradeInfo.grade,
            gradeLabel: gradeInfo.label,
            status: marksValue !== null ? 'Evaluated' : rec.evaluatorId ? 'Allotted' : 'Pending Allotment',
            updatedAt: new Date().toISOString(),
          };
        }
        return rec;
      })
    );
  }, []);

  // Module B: 2_Course_Evaluation_Master Allotment & Marks Engine Operations
  const allotEvaluatorToEvaluations = useCallback(
    (evaluationIds: string[], evaluatorId: string | null) => {
      const ev = evaluatorId ? evaluators.find((e) => e.id === evaluatorId) : null;
      const now = new Date().toISOString();
      const dateStr = now.split('T')[0];
      const allottedBy = currentRole === 'ADMIN' ? 'Coordinator Desk' : 'Counter Desk Official';

      setCourseEvaluations((prev) => {
        const updated = prev.map((rec) => {
          if (!evaluationIds.includes(rec.id)) return rec;
          if (rec.isLocked && currentRole !== 'ADMIN') return rec;

          return {
            ...rec,
            evaluatorId: ev ? ev.id : null,
            evaluatorCode: ev ? ev.evaluatorCode : null,
            evaluatorName: ev ? ev.name : null,
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
            name: ev.name,
            evaluatorCode: ev.evaluatorCode,
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

          const gradeInfo = calculateIGNOUGrade(marksValue);
          const now = new Date().toISOString();

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

      // Keep intakes table in sync
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
      }
    },
    []
  );

  const toggleLockMarks = useCallback(
    (evaluationId: string, shouldLock: boolean) => {
      if (!shouldLock && (isUrlLockedDeskMode || currentRole !== 'ADMIN')) {
        alert('Permission Denied: Only an Administrator (Coordinator) can unlock marks for verified scripts. Unlocking permissions are strictly disabled in Desk Official mode.');
        return;
      }

      const now = new Date().toISOString();
      const lockedBy = currentRole === 'ADMIN' ? 'Dr. V. K. Aggarwal (Coordinator)' : 'Desk Official';

      setCourseEvaluations((prev) => {
        const next = prev.map((rec) => {
          if (rec.id !== evaluationId) return rec;

          if (shouldLock) {
            if (rec.marks === null || rec.marks === undefined) {
              alert('Cannot lock script: A valid numerical mark (0-100) must be recorded before locking.');
              return rec;
            }
            const gradeInfo = calculateIGNOUGrade(rec.marks);
            // 3. On Marks Locking: Send POST with action "UPDATE_MARKS" containing subId, marks, calculated grade, and isLocked: true
            postUpdateMarks(rec.submissionKey || rec.id, rec.marks, gradeInfo.grade, true).catch((err) => {
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
    [currentRole, isUrlLockedDeskMode, showToast]
  );

  const batchLockMarks = useCallback(
    (evaluationIds: string[], shouldLock: boolean) => {
      if (!shouldLock && (isUrlLockedDeskMode || currentRole !== 'ADMIN')) {
        alert('Permission Denied: Only an Administrator (Coordinator) can unlock marks. Unlocking permissions are strictly disabled in Desk Official mode.');
        return;
      }

      const now = new Date().toISOString();
      const lockedBy = currentRole === 'ADMIN' ? 'Dr. V. K. Aggarwal (Coordinator)' : 'Desk Official';

      setCourseEvaluations((prev) => {
        const next = prev.map((rec) => {
          if (!evaluationIds.includes(rec.id)) return rec;

          if (shouldLock) {
            if (rec.marks === null || rec.marks === undefined) return rec;
            const gradeInfo = calculateIGNOUGrade(rec.marks);
            // 3. On Marks Locking: Send POST with action "UPDATE_MARKS" containing subId, marks, calculated grade, and isLocked: true
            postUpdateMarks(rec.submissionKey || rec.id, rec.marks, gradeInfo.grade, true).catch((err) => {
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
    [currentRole, isUrlLockedDeskMode, showToast]
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
    try {
      const res = await doGet();
      if (res.success) {
        if (res.intakes && res.intakes.length > 0) {
          setIntakes((prev) => {
            const map = new Map(prev.map((i) => [i.tokenNo || i.id, i]));
            res.intakes?.forEach((item: any) => {
              const enr = item.Enrollment_No || item.enrollmentNo || item.studentId || '';
              const sess = item.Session || item.session || currentSession;
              const key = item.Token_No || item.tokenNo || item.id || `intake-${enr}-${sess}`;
              const courseRaw = item.Courses || item.courses || item.courseCodes || item.Course_Codes || [];
              const courseCodesArr = Array.isArray(courseRaw)
                ? courseRaw
                : typeof courseRaw === 'string'
                ? courseRaw.split(',').map((c: string) => c.trim()).filter(Boolean)
                : [];
              map.set(key, {
                id: item.id || key,
                tokenNo: item.tokenNo || item.Token_No || key,
                enrollmentNo: enr,
                studentName: item.Candidate_Name || item.candidateName || item.studentName || '',
                studentPhone: item.Contact || item.contact || item.studentPhone || '',
                studentEmail: item.Email || item.studentEmail || '',
                programmeCode: item.Programme || item.programme || item.programmeCode || '',
                courseCodes: courseCodesArr,
                submissionDate: item.Timestamp ? String(item.Timestamp).split('T')[0] : (item.submissionDate || new Date().toISOString().split('T')[0]),
                submissionMode: item.submissionMode || 'In-Person (Desk)',
                consignmentNo: item.consignmentNo,
                session: sess,
                status: item.status || 'Received',
                marks: item.marks || {},
                remarks: item.remarks || '',
                createdAt: item.Timestamp || item.createdAt || new Date().toISOString(),
              });
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
    } catch (err) {
      console.warn('[Google Sheets Sync Error]:', err);
    } finally {
      setIsSyncingSheets(false);
    }
  }, [currentSession]);

  // 1. On Load: Call doGet() to hydrate IntakeRegister and CourseLedger state from Google Sheets
  useEffect(() => {
    syncGoogleSheets(true);
  }, [syncGoogleSheets]);

  // Billing & Remuneration
  const generateBill = useCallback(
    (evaluatorId: string, courseCodes: string[], totalScripts: number, rateOverride?: number) => {
      const ev = evaluators.find((e) => e.id === evaluatorId);
      const rate = rateOverride ?? settings.remunerationRatePerScript;
      const scriptAmount = totalScripts * rate;
      const conveyanceAmount = settings.conveyanceAllowancePerPacket;
      const grossAmount = scriptAmount + conveyanceAmount;
      const sessionCode = generateSessionCode(currentSession);
      const billNumber = `BILL-SC2033-${sessionCode}-${String(bills.length + 1).padStart(3, '0')}`;

      const newBill: RemunerationBill = {
        id: `bill-${Date.now()}`,
        session: currentSession,
        billNumber,
        evaluatorId,
        evaluatorCode: ev?.evaluatorCode || 'EV-UNK',
        evaluatorName: ev?.name || 'Evaluator',
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
    setSettings((prev) => ({ ...prev, ...newValues }));
  }, []);

  const resetAllData = useCallback(() => {
    if (window.confirm('Are you sure you want to reset all data to initial institutional seed state? This cannot be undone.')) {
      setSettings(INITIAL_SETTINGS);
      setIntakes(INITIAL_INTAKE_RECORDS);
      setEvaluators(INITIAL_EVALUATORS);
      setPackets(INITIAL_PACKETS);
      setBills(INITIAL_BILLS);
      setAssignmentSubmissions(INITIAL_ASSIGNMENT_SUBMISSIONS);
      setRegistrationReceipts(INITIAL_REGISTRATION_RECEIPTS);
      setCourseEvaluations(INITIAL_COURSE_EVALUATIONS);
      setCurrentSessionState(INITIAL_SETTINGS.defaultSession);
      setCurrentRole('ADMIN');
      localStorage.clear();
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
        addIntakeRecord,
        updateIntakeRecord,
        deleteIntakeRecord,
        updateMarks,
        // Module B: Course Evaluations
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
        createPacket,
        updatePacket,
        deletePacket,
        evaluators,
        addEvaluator,
        updateEvaluator,
        deleteEvaluator,
        isSyncingSheets,
        syncGoogleSheets,
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
