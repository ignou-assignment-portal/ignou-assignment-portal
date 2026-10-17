# Admissions & Re-Registration Module (Fresh & 2nd/3rd Year) Blueprint

Comprehensive architectural blueprint and implementation plan for the **Admissions & Re-Registration** module at IGNOU Study Centre 2033. Features **separate independent registers** for **Fresh Admissions (1st Year)** and **Re-Registrations (2nd & 3rd Year)** across **January and July** admission sessions, powered by an intelligent Excel/CSV batch spreadsheet ingestion wizard.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following operational and architectural choices were confirmed during the interactive clarification session:
>
> - **Confirmed Decision 1 (Module Title)**: Official naming in sidebar navigation and counter bar will be **"Admissions & Re-Registration"**.
> - **Confirmed Decision 2 (Register Structure)**: **Separate independent registers for Fresh Admissions and Re-Registrations**. Rather than mixing them into one table, the module will feature two dedicated, sovereign registers:
>   1. **Fresh Admissions Register**: For 1st Year new entrants in January & July cycles.
>   2. **Re-Registration Register**: For continuing 2nd Year & 3rd Year (and semester-wise) students in January & July cycles.
> - **Confirmed Decision 3 (Spreadsheet Ingestion)**: **Auto-detect registration type from spreadsheet columns** (e.g. `Type`, `Year`, `Semester`, `Category`), or allow the desk official to explicitly pick the target register during upload.
> - **Confirmed Decision 4 (Counter Decoupling)**: Fresh Admissions and Re-Registration rosters remain **independent with on-demand counter lookup**, ensuring assignment intake operations remain 100% focused, fast, and unblocked.

---

### 1. Data Models & Architectural Schemas

#### Core Record Interface (`StudentRegistrationRecord`)
```typescript
export type RegistrationCadre = 'FRESH' | 'RE_REGISTRATION';
export type AcademicYearLevel = '1st Year' | '2nd Year' | '3rd Year' | 'Semester';

export interface StudentRegistrationRecord {
  id: string;                         // e.g. 'ADM-FRESH-2026-0042' or 'RR-YR2-2026-0018'
  cadre: RegistrationCadre;           // 'FRESH' (1st Year) | 'RE_REGISTRATION' (2nd/3rd Year)
  academicYear: AcademicYearLevel;     // '1st Year' | '2nd Year' | '3rd Year' | 'Semester'
  semesterNo?: number;                // e.g. 1 to 6 (for BCA/MCA/semester programmes)
  enrollmentNo: string;               // 9-10 digit IGNOU Enrollment Number
  studentName: string;                // Full Candidate Name
  programmeCode: string;              // e.g. MEG, BCOMF, BAG, BCA, MPS, BSCG
  programmeName?: string;             // Dynamic Programme Description
  session: string;                    // e.g. 'July 2026' or 'January 2026'
  sessionCycle: 'January' | 'July';   // Standard IGNOU cycle
  sessionYear: number;                // e.g. 2026
  courseCodes: string[];              // Registered courses array for this specific year
  studentPhone: string;               // Mobile Number
  studentEmail: string;               // Email Address
  registrationDate: string;           // YYYY-MM-DD
  status: 'Confirmed' | 'Provisional' | 'Cancelled';
  feeReference?: string;              // Challan / Online Transaction Ref (Optional)
  studyCentreCode: string;            // '2033'
  regionalCentreCode: string;         // 'RC-20' (Kohima)
  remarks?: string;
  createdAt: string;                  // ISO Timestamp
  updatedAt: string;                  // ISO Timestamp
}
```

#### Dual Register Persistence:
- Stored persistently in `localStorage` under `ignou_sc2033_student_registrations`.
- Clean helper accessors in `AppContext.tsx`:
  - `freshAdmissions`: filtered subset where `cadre === 'FRESH'` (1st Year).
  - `reRegistrations`: filtered subset where `cadre === 'RE_REGISTRATION'` (2nd/3rd Year).
- Dedicated CRUD actions with validation, duplicate checking, and Google Sheets sync compatibility.

---

### 2. User Experience & Interactive Design

#### Master View Layout (`AdmissionsView.tsx`)
1. **Top Register Selector & Cadre Switcher**:
   ```text
   ┌────────────────────────────────────────────────────────────────────────┐
   │  ADMISSIONS & RE-REGISTRATION CELL • SC-2033                           │
   │                                                                        │
   │  [ ① Fresh Admissions (1st Year) - 148 ]  [ ② Re-Registration (2nd & 3rd Year) - 96 ] │
   └────────────────────────────────────────────────────────────────────────┘
   ```
   - Two large, clean sovereign tabs matching the refined academic slate aesthetic.
   - Activating a tab switches the entire register context, summary metrics, filters, and records table.

2. **Register 1: Fresh Admissions (1st Year)**:
   - Focuses strictly on new learners admitted in 1st Year.
   - Metrics: Total 1st Year Fresh Entrants, July Cycle Count, January Cycle Count, Top 1st Year Programmes.
   - Filter pills: Session (`All`, `July 2026`, `January 2026`, `July 2025`, `January 2025`), Programme (`BCOMF`, `MEG`, `BAG`, etc.).
   - Actions: `+ New Fresh Admission`, `Import Fresh Excel`, `Export Roster`.

3. **Register 2: Re-Registration (2nd & 3rd Year)**:
   - Focuses on continuing learners re-registering for 2nd or 3rd year.
   - Metrics: Total Re-Registered Learners, 2nd Year Count, 3rd Year Count, Session Breakdown (`July 2026` vs `January 2026`).
   - Filter pills: Year Level (`All Years`, `2nd Year`, `3rd Year`, `Semester`), Session (`July 2026`, `January 2026`), Programme.
   - Actions: `+ New Re-Registration`, `Import Re-Reg Excel`, `Export Roster`.

4. **Structured Table Presentation**:
   - Clean slate micro-borders (`border-slate-200`) and high-contrast typography.
   - S.No., Enrollment No. (monospace with copy icon), Candidate Name, Programme badge, Academic Year badge (`1st Year`, `2nd Year`, `3rd Year`), Admission Session (`July 2026` / `January 2026`), Registered Course Pills, Contact Details (phone & email), Status badge (`Confirmed`), and Actions (View Card, Edit, Delete with Coordinator PIN 2033).

---

### 3. Intelligent Excel/CSV Spreadsheet Ingestion Wizard

#### 3-Step Wizard Flow:
```text
┌────────────────────────────────────────────────────────────────────────┐
│             EXCEL BATCH INGESTION WIZARD (3 STEPS)                     │
├────────────────────────────────────────────────────────────────────────┤
│  STEP 1: Upload File & Target Register Detection                       │
│  - Target Register: [ (•) Fresh Admissions  ( ) Re-Registration ]      │
│  - Default Session: [ July 2026 ▼ ]                                    │
│  - Drag & Drop .xlsx, .xls, .csv                                       │
├────────────────────────────────────────────────────────────────────────┤
│  STEP 2: Intelligent Column Auto-Mapping                               │
│  • Enrollment Number  <──> [ "Enrolment No" / "ENRNO" ]                │
│  • Candidate Name     <──> [ "Student Name" / "CANDIDATE_NAME" ]       │
│  • Programme Code     <──> [ "Prog" / "PROGRAMME" ]                    │
│  • Year / Cadre       <──> [ "Year" / "2nd Yr" / "FRESH" (Optional) ]  │
│  • Courses Registered <──> [ "Courses" / "SUBJECTS" ]                  │
│  • Mobile Number      <──> [ "Mobile" / "PHONE" ]                      │
│  • Email Address      <──> [ "Email" / "EMAIL_ID" ]                    │
├────────────────────────────────────────────────────────────────────────┤
│  STEP 3: Parity & Quality Verification Preview                         │
│  - Total Records Detected: 84                                          │
│  - Valid Records: 84 (100% Pass)                                       │
│  - Duplicates in Roster: 0                                             │
│  - Live 5-row table preview showing mapped fields                      │
│                                                                        │
│  [ Cancel ]                                     [ Confirm & Import ]   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Navigation & Counter Bar Integration

1. **Sidebar Navigation (`Sidebar.tsx`)**:
   - Navigation item:
     - Label: **"Admissions & Re-Reg"**
     - Subtitle: **"Fresh (Yr 1) & Re-Reg (Yr 2/3)"**
     - Icon: `GraduationCap`
     - Badge: Dynamic total student count (e.g. `244 Total`)
     - Role: Accessible to both `ADMIN` (Coordinator) and `OFFICIAL` (Desk)
2. **Counter Quick Action Bar (`QuickActionBar.tsx`)**:
   - Quick shortcut button:
     - `[ Admissions & Re-Reg (244) ]` allowing counter operators to open the registry with one click when looking up a student's course entitlement.
3. **Global Student Search Modal (`StudentSearchModal.tsx`)**:
   - Integrated tab or badge in search results showing if a student is enrolled in Fresh 1st Year or Re-Registered 2nd/3rd Year, with their registered course list.

---

### 5. Technical Implementation Steps

#### Step 1: Install Excel Parsing Library
- Run `install_applet_package` for `xlsx` (SheetJS) to enable client-side Excel reading and parsing.

#### Step 2: Types & Context Extensions
- In `src/types.ts`: Define `StudentRegistrationRecord`, `RegistrationCadre`, and `AcademicYearLevel`.
- In `src/context/AppContext.tsx`:
  - Add state `studentRegistrations: StudentRegistrationRecord[]`.
  - Add CRUD handlers (`addStudentRegistration`, `batchImportStudentRegistrations`, `updateStudentRegistration`, `deleteStudentRegistration`).
  - Add computed selectors `freshAdmissions` and `reRegistrations`.

#### Step 3: Implement Ingestion Engine & Service
- Create `src/services/registrationExcelService.ts`:
  - Excel/CSV parsing algorithms.
  - Column matching rules for IGNOU admission sheets.
  - Course string sanitization (e.g. `"MEG-01, MEG-02, MEG-03"` -> `['MEG-01', 'MEG-02', 'MEG-03']`).
  - Duplicate detection.

#### Step 4: Create UI Components
- Create `src/components/AdmissionsView.tsx`:
  - Top tab switcher between **Fresh Admissions** and **Re-Registration**.
  - Metric summary cards for each register.
  - Search, filter bar, pagination, and export tools.
  - Structured data tables with copyable roll numbers and course pills.
- Create `src/components/RegistrationExcelUploadModal.tsx`:
  - 3-step wizard with file upload, column mapping, and preview table.
- Create `src/components/AddRegistrationModal.tsx`:
  - Manual entry modal supporting both Fresh 1st Year and 2nd/3rd Year Re-Registrations.

#### Step 5: Navigation & Workspace Wiring
- Add `ADMISSIONS` to `TabType` in `Sidebar.tsx`.
- Add quick action button in `QuickActionBar.tsx`.
- Mount `AdmissionsView` in `App.tsx` when `activeTab === 'ADMISSIONS'`.

#### Step 6: Quality Assurance & Build Verification
- Run `compile_applet` and `lint_applet` to confirm zero compilation or lint errors.
- Test both Fresh and Re-Registration workflows with sample data.

---

### 6. Verification Scenarios

1. **Dual Independent Registers**:
   - Open Admissions & Re-Registration view.
   - Switch between "Fresh Admissions (1st Year)" and "Re-Registration (2nd & 3rd Year)".
   - Verify each register shows its own independent data, counts, and filters.
2. **Excel Import for Fresh Admission**:
   - Upload sample Fresh Admission Excel file.
   - Confirm target register is Fresh Admissions, review column mapping, and verify records import into 1st Year.
3. **Excel Import for Re-Registration**:
   - Upload sample Re-Registration file (e.g. 2nd or 3rd year students).
   - Confirm records appear under Re-Registration register with correct academic year badges (`2nd Year` / `3rd Year`).
4. **Session Filtering**:
   - Filter by "July 2026" and "January 2026" in both registers.
   - Verify records filter accurately.
5. **Desk Usability**:
   - Confirm counter officials can look up any student's courses on demand without interfering with assignment intake operations.
