# Admissions Multi-Session Composite Keying, Home Page Fresh Status & Multi-Tab Google Sheets Sync Plan

Architectural blueprint to guarantee zero duplicate collisions across multi-session re-registrations (Jan 2025: 39, July 2025: 94, Jan 2026: 26), deploy the public **Fresh Admission Status** portal with January & July session tabs and global search on the Home Page before Institutional Profile, and implement multi-tab Google Sheets synchronization with auto-push on Excel import and master composite key conflict resolution.

---

### User Review & Operational Decisions (Confirmed)

> [!IMPORTANT]
> The following operational decisions from the clarifying session govern this architecture:
>
> 1. **Composite Identity Keying**: Re-registration and fresh admission records are keyed by the composite tuple:
>    `[Enrollment No] + [Cadre (FRESH vs RR)] + [Academic Year] + [Session]`
>    In IGNOU distance education, a student retains the exact same 9–10 digit enrolment number across 1st Year, 2nd Year, and 3rd Year across sessions (e.g. Jan 2025, July 2025, Jan 2026). Keying globally by Enrollment alone caused Jan 2026 imports to overwrite Jan 2025 records. The composite key guarantees that Jan 2025 (39), July 2025 (94), and Jan 2026 (26) coexist independently with accurate counts.
>
> 2. **Home Page Fresh Admission Status**:
>    Positioned directly before the **Institutional Profile** (`#about-centre`) section on the Home Page. Features:
>    - Segmented tabs for **January Session** and **July Session** for current academic cycles.
>    - Instant Global Search across 9–10 digit Enrolment Number, Candidate Name, Programme, and Course Codes.
>    - Clean tabular card view showing admission verification, enrolled courses, and candidate details.
>
> 3. **Multi-Tab Google Sheets Sync & Conflict Resolution**:
>    - **Google Sheets Tab Architecture**: Supports multi-tab structure by session (e.g., `Fresh Jan 2025`, `RR Jan 2025`, `Fresh July 2025`, `RR July 2025`, `Fresh Jan 2026`, `RR Jan 2026`), as well as unified admissions tabs.
>    - **Automatic Push on Excel Import**: When an Excel file is imported in the web app and Google Sheets is configured, the web app automatically pushes the imported records to Google Sheets in real time.
>    - **Master Conflict Resolution**: Google Sheets acts as master. Sync operations merge records by the composite key, updating fields without deleting or duplicating records from other sessions.

---

### Phase 1: Fix Multi-Session Duplicate Collision Engine

#### 1.1 Composite Key Formulation
In `src/utils/helpers.ts` or `src/context/AppContext.tsx`:
```typescript
export const getRegistrationCompositeKey = (
  r: Pick<StudentRegistrationRecord, 'enrollmentNo' | 'cadre' | 'academicYear' | 'session'>
): string => {
  const roll = (r.enrollmentNo || '').trim().toUpperCase();
  const cadre = (r.cadre || 'FRESH').trim().toUpperCase();
  const year = (r.academicYear || '1st Year').trim();
  const session = (r.session || '').trim().toUpperCase();
  return `${roll}__${cadre}__${year}__${session}`;
};
```

#### 1.2 `registrationExcelService.ts` & `RegistrationExcelUploadModal.tsx`
- Replace single-roll duplicate check (`existingEnrollments.has(enrollmentNo)`) with target session duplicate check:
  `existingCompositeKeys.has(getRegistrationCompositeKey({ enrollmentNo, cadre, academicYear, session }))`.
- Allow the same student to exist in Jan 2025 (e.g., 2nd Year) and Jan 2026 (3rd Year) without triggering a duplicate error.
- Only warn if a student has two duplicate rows within the *exact same session, cadre, and year*.

#### 1.3 `AppContext.tsx` Deduplication
- Refactor `batchImportStudentRegistrations`:
  - Deduplicate existing array using `getRegistrationCompositeKey(record)`.
  - Ensure importing Jan 2026 does not overwrite or drop Jan 2025 or July 2025 records.
  - Correct total counts: Jan 2025 = 39, July 2025 = 94, Jan 2026 = 26.

---

### Phase 2: Home Page "Fresh Admission Status" with Global Search

#### 2.1 Placement
- Insert in `src/components/StudyCentreHomePage.tsx` immediately preceding `<section id="about-centre"` (Institutional Profile).
- Section anchor: `<section id="fresh-admissions">`.

#### 2.2 Features & UI Architecture
- **Editorial Header**:
  - Kicker: `ADMISSIONS DESK · STUDY CENTRE 2033`
  - Title: `Fresh Admission Status & Verification`
  - Subtitle: `Verify your IGNOU admission confirmation and allotted course roster for January and July cycles.`
- **Session Switcher**:
  - Segmented buttons for **January Session** and **July Session** with total admitted count badges.
  - Cycle selector for Year (e.g. 2026 / 2025).
- **Global Search Box**:
  - Prominent search input with icon and keyboard shortcut indicator (`/` to search).
  - Searches instantaneously across Enrolment Number, Student Name, Programme Code (e.g. `BAG`, `BCOMG`, `MEG`, `MPS`), and Course Codes.
- **Learner Admission Cards & Roster Table**:
  - Displays Enrolment Number (monospace, copy-ready), Student Name, Programme, Date of Admission, and Allotted Course roster.
  - "Confirmed" status badge with link/action to view dossier or copy verification details.
  - Empty state with clear guidance when search yield is zero.

---

### Phase 3: Multi-Tab Google Sheets Bidirectional Sync

#### 3.1 Apps Script & `sheetsService.ts` Multi-Tab Handling
- Support reading and writing sheets matching session patterns:
  - Fresh tabs: `Fresh Jan 2025`, `Fresh July 2025`, `Fresh Jan 2026`, or `Fresh Admissions`.
  - Re-Registration tabs: `RR Jan 2025`, `RR July 2025`, `RR Jan 2026`, or `Re-Registrations`.
- Export/sync parser to dynamically map row headers:
  `[S.No, Enrolment Number, Student Name, Programme, Academic Year, Session, Courses, Mobile, Email, Admission Date, Status]`.

#### 3.2 Automatic Push on Excel Import
- When a user imports an Excel file via `RegistrationExcelUploadModal.tsx`:
  - Records are imported locally into `AppContext`.
  - If Google Sheets integration is active, `pushRegistrationsToGoogleSheets(importedRecords)` triggers automatically in the background.
  - Visual toast notification: "Imported records saved and synchronized to Google Sheets".

#### 3.3 Master Google Sheets Conflict Resolution
- Google Sheets acts as authoritative master.
- When performing a sync (`Pull from Google Sheets` or scheduled sync):
  - Inbound rows are indexed by composite key `[enrollmentNo]__[cadre]__[academicYear]__[session]`.
  - Merges records seamlessly without creating duplicate entries or deleting other sessions.
  - Preserves local timestamps and ensures full data validity.

#### 3.4 UI Controls in `AdmissionsView.tsx`
- Add "Sync with Google Sheets" button alongside "Import Excel" and "Export Roster".
- Display live sync timestamp, connection indicator, and multi-tab sync status.

---

### Phase 4: Verification & Operational Validation

1. **Duplicate Resolution Verification**:
   - Verify Jan 2025 (39), July 2025 (94), and Jan 2026 (26) coexist simultaneously with accurate counts.
2. **Home Page Validation**:
   - Verify layout placement before Institutional Profile.
   - Test session switching between Jan and July.
   - Test global search by roll number, student name, and course codes.
3. **Google Sheets Sync Validation**:
   - Test auto-push on Excel import.
   - Test multi-tab sync (Fresh and RR tabs per session).
   - Test conflict-free merging by composite key.
4. **Applet Compilation**:
   - Run `compile_applet` and `lint_applet` to guarantee zero errors.
