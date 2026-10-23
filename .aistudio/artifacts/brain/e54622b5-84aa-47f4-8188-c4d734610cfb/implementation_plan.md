# Complete Removal of Group (B) Student Status & Google Apps Script Connectivity Fix

Streamline the system to focus strictly on **Assignment Operations & Academic Management** by completely removing Group (B) Student Status (Admission & Re-Registration) from the codebase and Google Apps Script, while resolving Google Apps Script reachability issues with an automated 5-second timeout, resilient local fallback, and detailed connection diagnostics.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following requirements have been confirmed based on your input:
> - **Google Apps Script Handling**: Automatic 5-second timeout on requests, with seamless fallback to local zero-data-loss storage and an instant connection health diagnostic in Settings.
> - **Group (B) Removal**: Completely remove Option/Section "(B) STUDENT STATUS ONLY (Admission & Re-Registration)" from the Apps Script template, setup guide, and interface. Student profiles, course history, and search will be derived purely from verified Assignment Intake and Course Ledger records.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Complete Removal of Group (B)**: Strips out all Admission and Re-Registration tabs, rules, and synchronization logic from Google Apps Script (`Code.gs`), the deployment modals, and the app state. The system is dedicated 100% to **Assignment Operations** (Intake Desk, Course Ledger, Evaluators Master, and Award Sheets).
  2. **Student Profile Unification**: All student search (Ctrl+K), auto-fill, and history tracking will seamlessly index directly from actual Assignment Intake submissions and Course Ledger records.
  3. **Google Apps Script Reachability Resolution**: Replaces indefinite hanging requests and unhandled CORS/HTML error redirects with an enforced 5-second timeout, smart URL normalization, proxy error handling, and a diagnostic health check tool in Settings.

- **Target Persona**: Study Centre 2033 Desk Officials and Centre Coordinators who require instant, reliable desk intake and marks management without stalling when Google Sheets is unreachable or slow.

---

### 2. User Experience & Visual Design

- **Settings Connection Diagnostics**:
  - The "Test Google Apps Script Connection" tool in **Settings** will now test both the proxy route and target script URL with an active 5-second countdown.
  - Returns clear, actionable status cards:
    - **Green (Verified)**: Shows HTTP 200, latency in ms, and detected tabs (`Intake_Register`, `Course_Ledger`, `Evaluators_Master`).
    - **Amber (Local Fallback Active)**: Displays informative diagnostic (e.g., *"Apps Script endpoint did not respond within 5s. Zero-data-loss local persistence is active and saving all records to `/data/sheets_store.json`"*).
    - **Red (Invalid URL)**: Identifies if the provided URL is malformed or returning Google account login HTML rather than JSON Web App output, with instructions on setting Web App access to *"Anyone"*.
- **Deployment Modal Refinement (`AppsScriptSetupModal.tsx`)**:
  - Tab 3 ("Separation of (A) & (B) Rules") is removed.
  - The modal now displays a simplified 2-tab view:
    1. **Step-by-Step Deployment Guide** (Copying Code.gs into Google Sheets).
    2. **View Full Code.gs Source** (Updated clean script focusing solely on Assignment Operations).
- **Intake Desk & Student Search (Ctrl+K)**:
  - Instant lookup seamlessly aggregates past assignment submissions and evaluation grades by enrollment number and name directly from the verified intake register.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Removal of Group (B) Admission & Re-Registration**
  - *Chosen Approach*: Fully remove Group (B) from the Apps Script template, documentation modals, and store synchronization. Replaced with dynamic indexing of students from `allIntakes` and `allCourseEvaluations`.
  - *Why*: Eliminates clutter, removes script scanning overhead on unrelated sheets, and aligns with the operational focus of the assignment intake cell.
  - *Alternatives Considered*: Retaining passive read-only admission tabs in the background was rejected to honor the requirement to remove Section (B) completely.

- **Decision 2: 5-Second Timeout with Resilient Local Persistence**
  - *Chosen Approach*: Add `AbortController` timeout (5000ms) to all `/api/sheets` requests in `server.ts`. When remote Google Apps Script fails, times out, or returns Google Drive HTML error pages, the server immediately returns a structured fallback payload with local records and diagnostic status.
  - *Why*: Prevents the UI from hanging or displaying raw `Could not reach Google Apps Script` errors during desk operations. Student intake is always recorded locally with zero data loss.
  - *Alternatives Considered*: Direct browser fetches to `script.google.com` (which fail with browser CORS blocks) are replaced by the Express server proxy.

---

### 4. Technical Architecture & Implementation Steps

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Browser UI                         │
│  Intake Desk │ Course Ledger │ Settings Diagnostic │ Search  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                       Fetch /api/sheets
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Server Proxy                     │
│  - 5-Second AbortController Timeout                         │
│  - Optimistic Local Persistence (/data/sheets_store.json)    │
│  - Automatic JSON / Error / HTML Detection                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ (5s timeout)
             ┌─────────────────┴─────────────────┐
             │                                   │
      [Remote Success]                    [Timeout / Error]
             ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│ Google Apps Script Exec │         │ Local Store Fallback    │
│ (Group A Assignment Ops)│         │ (Status: 'fallback')    │
│ - Intake_Register       │         │ - Zero Data Loss        │
│ - Course_Ledger         │         │ - Pending Sync Queue    │
│ - Evaluators_Master     │         │ - Diagnostic Details    │
└─────────────────────────┘         └─────────────────────────┘
```

#### Step 1: Clean Google Apps Script Template (`OFFICIAL_APPS_SCRIPT_CODE`)
- In `src/services/sheetsService.ts`:
  - Remove all Group (B) code, comments, and multi-sheet registration loops.
  - Retain strictly Assignment Operations: `doGet()` for `intakeRegister`, `courseLedger`, `evaluatorsMaster`, and `awardSheets`.
  - Retain `doPost()` for `PING`, `ADD_INTAKE` (with auto-unpacking to `courseLedger`), `UPDATE_MARKS`, `ALLOT_EVALUATOR`, and PDF generation.

#### Step 2: Update Setup Modal & Documentation (`AppsScriptSetupModal.tsx`)
- Remove Tab 3 ("Separation of (A) & (B) Rules") and remove Group (B) badges.
- Update footer notes to reflect pure Assignment Operations.

#### Step 3: Server Proxy Timeout & Reachability Fix (`server.ts`)
- Implement 5-second `AbortSignal.timeout(5000)` on all `fetch(targetUrl)` calls.
- In `POST /api/sheets` and `GET /api/sheets`:
  - When target URL is unreachable, times out, or returns HTML ("Page not found" / "Google Sign In"):
    - Catch error and return `{ status: 'fallback', reachable: false, latencyMs, message: 'Apps Script unreachable; running in resilient local mode' }`.
  - In `action === 'PING'`:
    - Send clean ping with timeout, measure roundtrip latency, and return structured diagnostics including whether Google responded with JSON.

#### Step 4: Settings View & Diagnostics Integration (`SystemSettingsView.tsx`)
- In `handleTestScriptConnection`:
  - Pass configured `scriptUrl` in the test request.
  - Display diagnostic status: online/offline, latency in ms, active tabs, or exact reason for fallback with a one-click guide to redeploy the clean `Code.gs`.

#### Step 5: Student Profile Indexing Clean Up (`StudentSearchModal.tsx`)
- Ensure search indexes candidate details solely from `allIntakes` and `allCourseEvaluations`.

#### Step 6: Verification & Compilation
- Run `compile_applet` and `lint_applet` to verify clean build without regressions.
