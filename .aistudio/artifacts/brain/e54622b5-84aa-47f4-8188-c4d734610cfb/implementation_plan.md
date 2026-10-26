# Course Ledger Reconciliation & Duplicate Rectification Plan

Ensure the Evaluation Master reflects the exact 208 course scripts registered across the 45 candidates in the Intake Register by eliminating 4 duplicate unpacked rows, providing a web-first reconciliation with manual Google Sheets sync, and enforcing component-aware duplicate prevention.

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed preferences in Phase 1:
> - **Reconciliation Strategy**: Strictly re-sync Course Ledger from the 45 Candidates in Intake Register (reconciling 212 rows down to the exact 208 canonical scripts).
> - **Google Sheets Sync Policy**: Clean and rectify in the Web App first, with an explicit manual sync button to push the reconciled Course Ledger to Google Sheets.
> - **Duplicate Prevention Policy**: Enforce unique constraints per `(Enrollment, Course, Session, Component)` so that duplicate entries for the same course are only permitted if the course legitimately has distinct Assignment (TMA) and Practical components (e.g. BAPI-003).

---

## 1. Overview & Core Concept

- **The Problem**: The Intake Register records **45 candidates** with **208 total course scripts**. However, the Evaluation Master is currently displaying **212 scripts** because 4 redundant course rows were unpacked or double-appended into the Course Ledger.
- **The Solution**: 
  1. A canonical reconciliation engine that rebuilds the Course Ledger directly from the 45 registered candidates, matching every student's registered course list while preserving all previously entered marks and allotted academic counsellors.
  2. A dedicated **"Reconcile & Deduplicate Ledger"** control in Evaluation Master with a side-by-side audit modal showing the exact 4 duplicate entries being pruned.
  3. A **"Sync Cleaned Ledger to Google Sheets"** action that allows the Coordinator to review the clean 208 scripts in the app first, and then push the updated ledger to the `Course_Ledger` tab in Google Sheets.
  4. Automatic duplicate filtering in the data normalizer (`cleanLedger` in `AppContext.tsx`) to permanently prevent duplicate scripts unless a course contains both Assignment and Practical components.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Viewing the Evaluation Master Status**:
   - In the Evaluation Master header bar, an alert banner indicates:
     `Ledger Discrepancy Detected: 212 entries in Ledger vs 208 registered scripts across 45 candidates (4 duplicates).`
   - A distinct action button appears: **"Rectify Duplicates (208 Scripts)"**.

2. **Interactive Reconciliation & Audit Modal**:
   - Clicking **"Rectify Duplicates"** opens an institutional reconciliation modal showing:
     - **Summary**: 45 Candidates · 208 Registered Scripts · 4 Redundant Duplicate Rows Identified.
     - **Duplicate Inspection Table**: Lists the student enrollment numbers, candidate names, course codes, and session for the 4 duplicate rows.
     - **Conflict Resolution Intelligence**: Highlights that entries with entered marks or assigned evaluators are preserved, while the empty/redundant duplicate row is safely pruned.
   - Action buttons:
     - **"Apply Reconciliation (208 Scripts)"**: Instantly updates the web app state and local storage.
     - **"Cancel"**: Leaves current view unchanged.

3. **Post-Cleanup Google Sheets Sync**:
   - Once applied, the Evaluation Master immediately reflects **Total Unpacked Scripts: 208**.
   - A success banner offers:
     `Ledger reconciled to 208 scripts. Ready to update Google Sheets? [Sync Cleaned Ledger to Google Sheets]`
   - Clicking this pushes the 208 canonical rows to Google Sheets `Course_Ledger`.

4. **Visual Theme & Anti-Slop Discipline**:
   - Adheres to SaaS & Dashboard guidelines: clean neutral palette (`#0F172A` / `#FFFFFF`), 1px subtle hairline borders, monospace tabular figures (`font-mono tabular-nums`), zero pill clutter, and clear semantic status indicators.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Canonical Re-Sync from Intake Register vs. Generic Row Deletion**
  - *Chosen Approach*: Strictly re-derive the 208 course script slots from the 45 Candidate intake records, pairing each course code with existing evaluation data (marks, grades, allotted evaluator) while discarding unlinked extra rows.
  - *Why*: Guarantees mathematical parity between Candidates (45) and Scripts (208) with zero data loss of entered marks.
  - *Alternative Considered*: Manual row-by-row deletion, which is error-prone and requires hunting through 212 rows.

- **Decision 2: Web App First with Manual Google Sheets Push**
  - *Chosen Approach*: Clean the state and local store immediately in the web app, and provide an explicit button to overwrite/re-sync the Google Sheets `Course_Ledger` sheet.
  - *Why*: Follows your exact answer to inspect and verify the 208 count in the web app before modifying Google Drive.

- **Decision 3: Component-Aware Duplicate Prevention**
  - *Chosen Approach*: Course keys are unique on `(Enrollment_No, Course_Code, Session, Component)`. If a course has both TMA and Practical, two distinct rows (`_TMA` and `_PRAC`) are preserved; duplicate TMA or duplicate PRAC rows are barred.
  - *Why*: Accommodates IGNOU curricula with dual components while strictly blocking accidental duplicate submissions.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        45 Registered Candidates                        │
│                   (Intake_Register: 208 Course Scripts)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Canonical Courses
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Reconciliation & Deduplication Engine                │
│                                                                        │
│  - Maps each student's registered course list (208 scripts)           │
│  - Merges existing Marks, Grades, and Allotted Evaluators             │
│  - Filters out the 4 redundant/duplicate rows                          │
│  - Preserves dual components (Assignment + Practical) only             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│     Web App State & Cache         │ │    Google Sheets Course_Ledger    │
│  (Evaluation Master: 208 Scripts) │ │    (Optional Manual Sync Action)  │
└───────────────────────────────────┘ └───────────────────────────────────┘
```

### Component & File Work Plan

1. **`src/services/ledgerReconciliationService.ts` (New)**:
   - `reconcileLedgerFromIntakes(intakes, currentLedger, session)`:
     - Computes the canonical 208 scripts from the 45 candidate intake records.
     - Detects the 4 duplicate records and generates a reconciliation audit report.
     - Preserves all locked marks, evaluator allotments, and submission dates.
   - `pushCleanedLedgerToSheets(cleanedLedger, scriptUrl)`:
     - Dispatches batch update to replace or de-duplicate the `Course_Ledger` tab in Google Sheets.

2. **`src/components/LedgerDuplicateModal.tsx` (New)**:
   - Institutional modal showing duplicate audit details (Enrollment, Course, Candidate, Resolution).
   - "Apply Re-sync (208 Scripts)" button.
   - "Sync Cleaned Ledger to Google Sheets" action.

3. **`src/components/CourseEvaluationMaster.tsx`**:
   - Integrates the discrepancy alert banner (`212 scripts vs 208 canonical scripts`).
   - Adds the "Rectify Duplicates" launcher button.
   - Replaces filteredLedger with reconciled state upon execution.

4. **`src/context/AppContext.tsx`**:
   - Exposes `reconcileCourseLedger()` to update React state, `localStorage`, and `sheets_store.json`.
   - Hardens `cleanLedger` in `fetchAllData` so future Google Sheets hydrations automatically de-duplicate identical course component rows.

5. **`server.ts` & Google Apps Script (`Code.gs`)**:
   - Add `RECONCILE_COURSE_LEDGER` handler to `POST /api/sheets` and `Code.gs` to overwrite `Course_Ledger` with the clean 208 rows when the user clicks "Sync to Google Sheets".

---

## 5. Verification Plan

1. **Unit & Discrepancy Verification**:
   - Verify that 45 Candidates yield exactly 208 scripts.
   - Confirm that the 4 duplicate rows are correctly identified and safely isolated.
2. **Evaluation Parity Verification**:
   - Ensure all existing marks, grades, and evaluator assignments are preserved without alteration.
3. **Build & Type Check**:
   - Run `npm run lint` (`tsc --noEmit`) and `compile_applet` to ensure zero compilation errors.
4. **Interactive Walkthrough**:
   - Open Evaluation Master, verify the discrepancy badge, open the modal, apply the 208-script clean re-sync, and test the Google Sheets sync flow.
