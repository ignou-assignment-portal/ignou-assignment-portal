# Assignment Intake Google Sheets Persistence & Auto-Sync Engine

Fix the student assignment intake persistence failure to ensure all desk intakes save reliably to Google Sheets, are automatically unpacked into individual course ledger rows, never disappear from the screen, and provide an updated copy-ready Apps Script with instant verification in Centre Settings.

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices in Phase 1:
> - **Data Persistence Strategy**: Save locally first into local storage and server cache, and sync to Google Sheets in the background with automatic retry.
> - **Backend Apps Script Update**: Provide a copy-ready script with one-click verification and diagnostic status in Centre Configuration / System Settings.
> - **Course Ledger Unpacking**: Automatically unpack multiple course codes into individual rows in the `Course_Ledger` / `courseLedger` sheet for Stage 2 evaluation tracking.

## 1. Overview & Core Concept

When a desk official or coordinator enters an assignment intake in Stage 1 (Intake Desk), two issues currently prevent successful recording:
1. **Google Apps Script Mismatch**: The deployed Google Apps Script does not write incoming POST payloads to the actual sheet tabs (`intakeRegister` / `Intake_Register` and `courseLedger` / `Course_Ledger`) because it lacks dynamic header matching and tab name aliases.
2. **Client-Side State Overwrite**: When the client app attempts to validate after submission, `fetchAllData` fetches the remote sheet data (which still has only the original rows) and overwrites the local React state, causing newly entered student assignments to vanish from the interface.

This implementation resolves both problems through a resilient two-tier architecture:
- **Resilient Client & Server Persistence**: Newly added intake records and unpacked course rows are immediately committed to local memory, browser storage, and the local backend JSON store. When `fetchAllData` refreshes data, it optimistically preserves any local records that have not yet appeared in the remote spreadsheet, guaranteeing **zero data loss**.
- **Updated Universal Google Apps Script (`Code.gs`)**: An enhanced, self-healing script supporting all tab naming variations (`intakeRegister`, `Intake_Register`), flexible column headers (`Timestamp`, `Session`, `Enrollment_No`, `Candidate_Name`, `Contact`, `Programme`, `Courses`, `Official`), and automatic course ledger row creation.
- **In-App Script Generator & Verification**: A dedicated control panel in System Settings providing the exact updated script with copy-to-clipboard, a "Test Connection & Verify Sync" button, and step-by-step deployment instructions.

## 2. User Experience & Visual Design

### Key User Flows
1. **Assignment Intake Registration (Stage 1)**:
   - Desk official enters student enrollment number, selects/enters candidate name, contact, programme, and courses.
   - Upon clicking "Save & Issue Receipt", the intake record and its unpacked course assignments are immediately rendered on screen and printed/downloaded without delay.
   - A quiet toast confirms "Saved locally & queued for Google Sheets sync".
   - Subsequent sheet data refreshes will **never** wipe or overwrite the newly entered record.

2. **Apps Script Update & Verification (Centre Configuration)**:
   - Coordinator opens **Centre Configuration > System Settings**.
   - Under the "Google Sheets Integration" section, a clean card displays:
     - Current connection status and last sync timestamp.
     - "Copy Updated Apps Script (Code.gs)" button with copy feedback.
     - "Test & Verify Connection" button that sends a ping to the Apps Script URL and reports exact sheet readiness (e.g. "Connected: 33 intakes, 145 course ledger rows ready").
     - 4-step deployment instructions (Extensions > Apps Script > Paste > Deploy as New Version).

3. **Stage 2 Evaluation Master Reflects New Intake**:
   - As soon as the assignment intake is registered, each course in the intake (e.g., `BEGC-101`, `BEGC-102`) immediately surfaces in the Course Ledger table ready for evaluator allotment and marks entry.

### Visual Styling & Restraint
- Strict adherence to the universal design constitution: no generic purple gradients, no decorative status dots, no pill badges on metadata.
- Clean unboxed metadata with subtle typographic separators (`·`).
- Monospace tabular numerals (`tabular-nums font-mono`) for enrollment numbers, token numbers, and timestamps.
- Action buttons adhere to the single-line contract (`whitespace-nowrap shrink-0`).

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Optimistic Local Preservation vs. Blocking UI on Remote Confirmation**
  - *Chosen Approach*: Save locally first into React state, localStorage, and server store; background sync to Google Sheets with automatic retry.
  - *Why*: Desk officials often operate during high-traffic admissions/intake periods where network latency or Google Apps Script execution limits could cause delays. The official should never be blocked from issuing a student receipt.
  - *Alternatives Considered*: Blocking submission until Google Sheets responds with 200 OK was rejected because network flakiness would stall the intake queue.

- **Decision 2: Course Unpacking in Apps Script + Client-Side Fallback**
  - *Chosen Approach*: Handle course unpacking in both the client proxy and the Google Apps Script.
  - *Why*: Redundancy ensures that even if the Google Apps Script update is delayed, the local app immediately has individual course rows in Stage 2 evaluation master.

- **Decision 3: Flexible Schema Matching in Google Apps Script**
  - *Chosen Approach*: The script dynamically scans row 1 headers of the target sheet to map field names to column indexes, falling back to canonical column order if empty.
  - *Why*: Users may have slightly different header spellings (`Enrollment_No` vs `Enrollment No`, `Candidate_Name` vs `Candidate Name`, `Contact` vs `Mobile No`). Flexible matching prevents silent append failures.

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Stage 1: Intake Desk                   │
│   (User enters enrollment, student name, courses, session)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     AppContext.tsx                          │
│  1. setIntakes(prev => [newRecord, ...prev])                │
│  2. setCourseEvaluations(prev => [...unpackedRows, ...prev])│
│  3. localStorage.setItem(...)                               │
│  4. dispatch postAddIntake()                                │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      server.ts Proxy         │ │   fetchAllData(preserve)   │
│  - Saves intake to local     │ │  - Merges remote sheet rows│
│    store (sheets_store.json) │ │    with local unconfirmed  │
│  - Proxies to Apps Script    │ │    entries (no data wipe)  │
└──────────────┬───────────────┘ └────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│             Google Apps Script (Code.gs)                    │
│  - Matches sheet tab: "Intake_Register" / "intakeRegister"  │
│  - Appends intake row based on dynamic header positions     │
│  - Unpacks courses into "Course_Ledger" / "courseLedger"    │
└─────────────────────────────────────────────────────────────┘
```

### Key Changes
1. **`src/context/AppContext.tsx`**:
   - In `fetchAllData`, update `cleanIntake` and `cleanLedger` reconciliation so locally added records that have not yet appeared in remote Google Sheets data are preserved rather than overwritten.
   - Prevent `fetchAllDataRef.current(true)` in `addIntakeRecord` from wiping optimistic state.
2. **`server.ts`**:
   - In `/api/sheets` (POST), handle `action === "ADD_INTAKE"` by saving intake records and unpacked course entries to `data/sheets_store.json`.
   - In `/api/sheets` (GET), merge local store records with remote data so the proxy always reflects recent entries.
3. **`src/services/sheetsService.ts`**:
   - Update `OFFICIAL_APPS_SCRIPT_CODE` to handle tab aliases (`Intake_Register` / `intakeRegister`, `Course_Ledger` / `courseLedger`), dynamic header lookup, and automatic course unpacking.
   - Update `postAddIntake` to pass complete normalized payloads and retry on network disruption.
4. **`src/components/SystemSettingsView.tsx`**:
   - Add a "Google Apps Script Backend & Sync Diagnostics" section with a "Copy Updated Code.gs" button, connection tester, and clear instructions.

## 5. Verification Plan
1. **Automated Verification**:
   - Compile applet with `compile_applet`.
   - Lint applet with `lint_applet`.
2. **Functional Testing**:
   - Submit a new student assignment intake with multiple courses (e.g. `BEGC-101`, `BEGC-102`).
   - Confirm intake appears in Intake Register and never disappears upon refresh.
   - Confirm individual courses appear in Course Ledger / Evaluation Master.
   - Verify connection tester in System Settings passes and returns sheet status.
