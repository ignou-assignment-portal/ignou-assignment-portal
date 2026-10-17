# Admissions Multi-Session Composite Keying, Home Page Fresh Status & Google Sheets Sync Blueprint

Architectural plan to eliminate re-registration duplicate collision across academic cycles (guaranteeing proper coexistence of Jan 2025: 39, July 2025: 94, and Jan 2026: 26), introduce the **Fresh Admission Status** public portal with interactive Jan/July session tabs and instant roll search on the Home Page before Institutional Profile, and establish bidirectional Google Sheets synchronization for Admissions.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following operational solutions were selected during the interactive clarification session:
>
> - **Confirmed Decision 1 (Composite Identity Key)**: Re-registration duplicate checking will be keyed on a composite tuple: `[Enrollment No] + [Session] + [Academic Year] + [Cadre]`. In IGNOU distance education, a single student legitimately carries the same 9–10 digit Enrolment Number across their 1st Year, 2nd Year, and 3rd Year across Jan 2025, July 2025, and Jan 2026 sessions. Keying globally by Enrollment alone was causing the Jan 2026 import to overwrite Jan 2025 records.
> - **Confirmed Decision 2 (Home Page Placement & Layout)**: A dedicated **Fresh Admission Status** section will be positioned immediately before the **Institutional Profile** (`#about-centre`) section on the Home Page. It will feature:
>   - Segmented interactive session tabs for **January Session** and **July Session** (current academic year).
>   - Global Search input for learners to search by 9-10 digit Enrolment Number, Candidate Name, or Course Code.
>   - Academic course roster showing confirmed admission status and registered courses.
> - **Confirmed Decision 3 (Google Sheets Sync Extension)**: Admissions and Re-Registration records will synchronize with Google Sheets alongside existing Intakes and Evaluators tabs, supporting both pull hydration (`doGet`) and push updates (`doPost`).

---

### 1. Root Cause Analysis: Re-Registration Import Duplication

#### Problem Identification
In `src/context/AppContext.tsx` (lines 1126–1145) and `src/components/RegistrationExcelUploadModal.tsx` (lines 81–90):
```typescript
// ❌ PREVIOUS FLAWED DEDUPLICATION:
const map = new Map<string, StudentRegistrationRecord>();
prev.forEach((r) => map.set(r.enrollmentNo.trim().toUpperCase(), r));
```
- The previous implementation indexed records strictly by `enrollmentNo`.
- When an administrator imported **January 2025** re-registrations (39 students), then imported **January 2026** re-registrations (26 students):
  - Any continuing student enrolled in both sessions (e.g., Year 2 in Jan 2025 and Year 3 in Jan 2026) was flagged as an existing duplicate and either overwritten or skipped.
  - As a result, the session counts for Jan 2025 (39), July 2025 (94), and Jan 2026 (26) were mutated and distorted.

#### The Architectural Fix
- **Composite Storage Key**:
  ```typescript
  const getRegistrationKey = (r: StudentRegistrationRecord | Partial<StudentRegistrationRecord>) =>
    `${(r.enrollmentNo || '').trim().toUpperCase()}__${(r.session || '').trim().toUpperCase()}__${r.academicYear || '1st Year'}__${r.cadre || 'FRESH'}`;
  ```
- **Session-Aware Spreadsheet Ingestion**:
  In `validateAndMapRows`, duplicate warning checks will only trigger if the student already exists *within the target session and year*, allowing the same student to maintain distinct historical records across multiple sessions.

---

### 2. Architecture & Domain Layout Constitution

Following the `frontend-design` constitutional rules and institutional editorial guidelines:

1. **Zero-Pill Discipline**: Metadata (Enrolment Number, Admission Date, Academic Session, Contact) is rendered as clean unboxed text separated by typographic middots (`·`) rather than nested pill badges.
2. **Segmented Interactive Tabs**: January Session vs. July Session filter is rendered as an accessible segmented button control with clean active/inactive surfaces.
3. **Institutional Editorial Hierarchy**:
   - Section kicker: `text-xs uppercase tracking-widest text-slate-500 font-mono`
   - Headline: `text-2xl sm:text-3xl font-black text-slate-950 tracking-tight`
   - Data rows: tabular numerals (`tabular-nums font-mono`) with high-contrast copyable roll numbers.
4. **Placement Before Institutional Profile**:
   Mounted as Section 5.5 in `StudyCentreHomePage.tsx`, between `#tracker` (Submissions Tracker) and `#about-centre` (Institutional Profile).

---

### 3. Phase-by-Phase Execution Plan

#### Phase 1: Fix Deduplication Engine & Multi-Session Keying
- **`src/context/AppContext.tsx`**:
  - Update `batchImportStudentRegistrations`: Key the deduplication map by `compositeKey = enrollmentNo + session + academicYear + cadre`.
  - Update `addStudentRegistration`: Prevent accidental overwriting of different sessions.
  - Update `updateStudentRegistration` & `deleteStudentRegistration` to target exact composite ID.
- **`src/services/registrationExcelService.ts`**:
  - Update `validateAndMapRows`: Accept `existingSessionKeys: Set<string>` instead of global enrollment set, ensuring validation warnings only fire when a duplicate exists in the *same* session and year.
- **`src/components/RegistrationExcelUploadModal.tsx`**:
  - Compute existing keys filtered by target session and cadre.

#### Phase 2: Home Page "Fresh Admission Status" with Global Search
- **`src/components/StudyCentreHomePage.tsx`**:
  - Create `<section id="fresh-admissions" className="py-12 sm:py-16 bg-white border-b border-zinc-200">`.
  - Insert immediately before `<section id="about-centre"` (Institutional Profile).
  - Add state for selected session (`January 2026` vs `July 2026` or current year cycles) and search query (`admissionSearchQuery`).
  - Render summary statistics: Total Fresh Admissions for session, unique programmes, and courses.
  - Render responsive table/card list of admitted students:
    - S.No, Enrolment Number, Candidate Name, Programme, Courses Allotted (pills), Confirmation Status.
  - Include quick search input with instant matching across Enrolment No, Name, Programme, and Course Codes.
  - Empty state with clear guidance if no records match search query.

#### Phase 3: Google Sheets Synchronization for Admissions
- **`src/services/sheetsService.ts`**:
  - Update `doGet()` to parse `json.freshAdmissions`, `json.reRegistrations`, or `json.studentRegistrations` from Apps Script payload.
  - Add `postSyncAdmissions(records: StudentRegistrationRecord[])` to send registration records to Google Sheets via `action: "SYNC_ADMISSIONS"`.
- **`src/context/AppContext.tsx`**:
  - Integrate registration records into `syncGoogleSheets` hydration.
  - Add `isSyncingAdmissions` state and `syncAdmissionsWithGoogleSheets()` method.
- **`src/components/AdmissionsView.tsx`**:
  - Add "Sync with Google Sheets" button next to "Import Excel" and "Export Roster" with live sync status badge.
- **`server.ts`**:
  - Extend `sheets_store.json` schema to include `studentRegistrations: []`.
  - Ensure `/api/sheets` GET and POST preserve student registration data.

#### Phase 4: Verification & Automated Lint/Compile
- Run `compile_applet` and `lint_applet` to ensure 100% build integrity.
- Verify session counts: Jan 2025 (39), July 2025 (94), Jan 2026 (26).

---

### 4. Verification Scenarios & Operational Acceptance

1. **Multi-Session Re-Registration Import**:
   - Import test dataset for Jan 2025 (39 records).
   - Import test dataset for July 2025 (94 records).
   - Import test dataset for Jan 2026 (26 records).
   - Verify all 3 sessions maintain their exact respective counts (39, 94, 26) without collision or overwriting.
2. **Home Page Fresh Admission Status**:
   - Open Home page, navigate to section before Institutional Profile.
   - Switch between January Session and July Session tabs.
   - Enter Enrolment Number or Name in Global Search; verify instant filtering and clear results display.
3. **Google Sheets Sync**:
   - Trigger Google Sheets sync and verify admissions records are hydrated into local state and synced to master sheet.
