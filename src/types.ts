/**
 * IGNOU SC-2033 Assignment Operations Dashboard Data Types
 */

export type UserRole = 'ADMIN' | 'OFFICIAL';

export interface RoleConfig {
  id: UserRole;
  title: string;
  badgeLabel: string;
  description: string;
  canSanctionBills: boolean;
  canOverrideRates: boolean;
  canAllocateEvaluators: boolean;
  canResetDatabase: boolean;
  canEnterMarks: boolean;
  canRegisterStudent: boolean;
  canPrintReceipts: boolean;
}

export type SubmissionMode = 'In-Person (Desk)' | 'Speed Post' | 'Registered Post' | 'Courier';

export type IntakeStatus = 'Received' | 'In Packet' | 'Under Evaluation' | 'Evaluated' | 'Marks Uploaded';

export interface IntakeRecord {
  id: string;
  session: string; // Strict session isolation: e.g., 'July 2026'
  tokenNo: string; // e.g., 'SC2033-JUL26-0001'
  enrollmentNo: string;
  studentName: string;
  studentPhone?: string;
  studentEmail?: string;
  programmeCode: string;
  courseCodes: string[];
  submissionDate: string; // YYYY-MM-DD
  submissionMode: SubmissionMode;
  consignmentNo?: string; // For postal/speedpost
  remarks?: string;
  status: IntakeStatus;
  marks: Record<string, number | null>; // courseCode -> marks (0-100) or null
  createdAt: string;
  registeredBy: string;
}

export interface Evaluator {
  id: string;
  evaluatorCode: string; // e.g. EV-101
  name: string;
  evaluatorName?: string; // alias for name
  designation: string; // e.g. Associate Professor
  department: string; // e.g. Department of English
  collegeInstitution: string; // e.g. Hindu College, University of Delhi
  contactPhone: string;
  contactNumber?: string; // alias for contactPhone
  email: string;
  emailId?: string; // alias for email
  eligibleCourses: string[]; // e.g. ['MEG-01', 'MEG-02', 'BEGC-131']
  bankName: string;
  accountNumber: string;
  bankAccountNo?: string; // alias for accountNumber
  ifscCode: string;
  panNumber: string;
  status: 'Active' | 'On Leave' | 'Inactive' | string;
  lastSyncedAt: string;
}

export interface CoursePacket {
  id: string;
  session: string;
  packetNumber: string; // e.g., PKT-JUL26-MEG01-01
  courseCode: string;
  programmeCode: string;
  evaluatorId: string | null;
  scriptCount: number;
  assignedDate: string | null;
  expectedReturnDate: string | null;
  returnedDate: string | null;
  status: 'Formed' | 'Dispatched' | 'Evaluated' | 'Archived';
  notes?: string;
}

export interface RemunerationBill {
  id: string;
  session: string;
  billNumber: string;
  evaluatorId: string;
  evaluatorCode: string;
  evaluatorName: string;
  bankAccountNo?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  panNumber?: string;
  department?: string;
  designation?: string;
  courseCodes: string[];
  totalScripts: number;
  ratePerScript: number;
  scriptAmount: number;
  conveyanceAmount: number;
  grossAmount: number;
  sanctionStatus: 'Draft' | 'Sanctioned' | 'Disbursed';
  sanctionedDate?: string;
  sanctionedBy?: string;
  disbursedDate?: string;
  disbursementReference?: string;
}

export interface SystemSettings {
  centreCode: string; // 'SC-2033'
  centreName: string; // 'IGNOU Study Centre 2033'
  institutionName: string; // "S.D. Jain Girls' College, Dimapur"
  hostInstitution?: string; // "S.D. Jain Girls' College, Dimapur"
  collegeName?: string; // "S.D. Jain Girls' College, Dimapur"
  regionalCentreCode: string; // 'RC-20 Kohima (Regional Centre Kohima)'
  regionalCentre?: string; // 'RC-20 Kohima'
  coordinatorName: string; // 'Dr. Sant K. Gupta'
  coordinatorDesignation?: string;
  coordinatorContact: string; // '+91 9436013686 | sant.k.gupta@gmail.com'
  coordinatorPhone?: string; // '9436013686'
  coordinatorEmail?: string; // 'sant.k.gupta@gmail.com'
  remunerationRatePerScript: number; // default Rs 27.50
  conveyanceAllowancePerPacket: number; // default Rs 0.00
  coordinationChargesPerScript: number; // default Rs 0.00
  availableSessions: string[];
  defaultSession: string;
  adminPin?: string; // 4-digit Administrator PIN (default: '2033')
  lastBackupDate?: string;
}

export interface IGNOUCourse {
  code: string;
  title: string;
  credits: number;
  programme: string;
  medium?: string;
}

export interface IGNOUProgramme {
  code: string;
  name: string;
  level: 'Bachelor' | 'Master' | 'Diploma' | 'Certificate';
  department: string;
  courses: IGNOUCourse[];
}

export type SubmissionStatusType = 'submitted' | 'not submitted';

export interface AssignmentSubmission {
  id: string;
  studentId: string; // StudentID / Enrollment Number (e.g. 2350198421)
  studentName: string;
  programmeCode: string;
  courseCode: string;
  session: string; // Academic Session (e.g. 'July 2026')
  status: SubmissionStatusType; // 'submitted' or 'not submitted'
  submissionDate?: string | null;
  submissionMode?: SubmissionMode | null;
  consignmentNo?: string | null;
  remarks?: string | null;
  updatedAt: string;
  updatedBy: string;
}

export type PaymentMode = 'Cash' | 'UPI / QR' | 'Demand Draft' | 'Online Netbanking';

export interface RegistrationReceiptFees {
  handlingFeePerCourse?: number;
  totalCourses?: number;
  courseFeeTotal?: number;
  lateFee?: number;
  totalFeesPaid?: number;
  paymentMode?: string;
  transactionRef?: string;
  paymentDate?: string;
}

export interface RegistrationReceipt {
  id: string;
  receiptNumber: string; // e.g. 'REG-SC2033-JUL26-0001'
  studentId: string; // Enrollment No / Student ID
  studentName: string;
  studentPhone?: string;
  studentEmail?: string;
  programmeCode: string;
  session: string;
  registeredCourses: string[];
  issuedBy: string;
  issuedAt: string;
  remarks?: string;
  feesPaid?: RegistrationReceiptFees;
}

// Module B: Automated Ledger Unpacking (2_Course_Evaluation_Master) & Marks Engine
export type EvaluationStatus = 'Pending Allotment' | 'Allotted' | 'Evaluated' | 'Marks Locked';

export interface CourseEvaluationRecord {
  // Clean Google Sheets Course_Ledger keys
  Sub_ID?: string;
  subId?: string;
  Session?: string;
  Enrollment_No?: string;
  Candidate_Name?: string;
  Programme?: string;
  Course_Code?: string;
  Allotted_Evaluator?: string | null;
  Marks?: number | null;
  Grade?: string | null;
  Status?: string;

  id: string; // Deterministic Primary Key format: SUB_ENR_COURSE_TERM (e.g. SUB_2401928371_MEG01_JUL2026)
  submissionKey: string; // Same as id
  intakeId?: string; // Linked Intake Token / Id
  tokenNo: string; // Intake Token e.g., SC2033-JUL26-0001
  enrollmentNo: string;
  studentName: string;
  studentPhone?: string;
  studentEmail?: string;
  programmeCode: string;
  courseCode: string; // e.g. MEG-01
  courseTitle?: string;
  session: string; // e.g. July 2026
  submissionDate: string; // YYYY-MM-DD
  submissionMode: SubmissionMode;
  consignmentNo?: string | null;

  // Academic Evaluator Allotment
  evaluatorId: string | null;
  evaluatorCode?: string | null; // e.g. EV-101
  evaluatorName?: string | null;
  allottedDate: string | null;
  allottedBy?: string | null;

  // Marks Engine
  marks: number | null; // Numeric 0 to 100
  grade: string | null; // 'A' | 'B' | 'C' | 'D' | 'E' | '—'
  gradeLabel: string | null; // 'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Unsatisfactory / Failed' | 'Pending'

  // Marks Locking & Verification
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;

  status: EvaluationStatus;
  updatedAt: string;
  remarks?: string;
}

