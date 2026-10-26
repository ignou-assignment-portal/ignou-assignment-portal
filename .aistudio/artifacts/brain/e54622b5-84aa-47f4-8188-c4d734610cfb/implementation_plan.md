# Google Sheets-Managed Staff Authentication & Access Security System

Replace the terminal PIN gatekeeper with an enterprise **Google Sheets-driven Staff Authentication System**, enabling the Centre Coordinator to create, manage, and audit staff credentials directly inside a dedicated `Staff_Users` tab in their connected Google Spreadsheet, supported by **real-time verification with resilient offline local fallback**, **5-attempt progressive lockout protection**, and **30-minute idle session surveillance**.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been confirmed based on your requirements:
> - **Credential Store & Authority**: Staff accounts (Username, Full Name, Role, Password, Account Status, and Failed Attempts) are stored in and managed through a dedicated `Staff_Users` tab in the Google Spreadsheet, created and controlled by the Admin.
> - **Synchronization Strategy**: **Real-time Google Sheets lookup with offline cached fallback**. On login, the system validates credentials against Google Sheets; if Google Sheets is momentarily unreachable or offline, it seamlessly authenticates against local encrypted/cached credentials.
> - **Authentication Method**: **Username and Password only** (2FA Authenticator codes omitted as requested), providing a fast, streamlined intake desk experience.
> - **Lockout & Session Protection**: **5 consecutive failed attempts lock the account** (requiring 15-minute cooldown or instant Coordinator unlock in Google Sheets / Settings), paired with an automated **30-minute idle timeout** featuring a 2-minute preemptive countdown modal.
> - **Role Enforcement**: User roles (`ADMIN` Coordinator vs `OFFICIAL` Desk Staff) are dictated by their assigned role in the `Staff_Users` sheet, with URL parameters (`?mode=desk`) strictly locking terminals to Desk privileges.

---

### 1. Overview & Core Concept

- **The Problem**:
  The previous 4-digit PIN gatekeeper (`1001` and `2033`) lacked individual staff accountability, had no rate-limiting protection, and required hardcoded credentials in the app rather than giving the Coordinator control inside their existing Google Spreadsheet.

- **The Solution**:
  1. **Google Sheets `Staff_Users` Master Tab**: A dedicated tab in the Coordinator's Google Sheet containing columns:
     `Staff_ID` | `Full_Name` | `Role` (`ADMIN` or `OFFICIAL`) | `Password` | `Account_Status` (`Active` or `Locked`) | `Failed_Attempts` | `Last_Login`
  2. **Admin-Driven Credential Management**: The Coordinator can add, modify, or revoke staff accounts either directly in Google Sheets or via the app's System Settings.
  3. **Real-Time Verification + Zero-Downtime Cache**: Authentication queries Google Apps Script in real-time. To ensure intake desks never stall during network outages or Google service interruptions, verified credentials are authenticated locally via the cached state.
  4. **Lockout Guard (5 Attempts)**: After 5 incorrect passwords, the account is marked `Locked` locally and updated in Google Sheets, generating a security alert in the Forensic Audit Trail. The Coordinator can instantly unlock the account by setting `Account_Status` to `Active` in Google Sheets or clicking "Unlock" in Settings.
  5. **30-Minute Idle Session Surveillance**: Monitors user interaction events (`mousemove`, `keydown`, `touchstart`). At 28 minutes, displays an institutional warning modal with a 2-minute countdown timer.

---

### 2. User Experience & Visual Design

- **Institutional Design Constitution (Anti-AI Slop & Zero-Pill Discipline)**:
  - Deep corporate slate and graphite theme (`slate-950`, `zinc-900`, `indigo-950`) with high-contrast, crisp typography.
  - Crisp rectangular badges with standard `rounded-sm` or `rounded-md` borders; strictly avoiding bubbly pill shapes.
  - Tabular monospace numbers (`font-mono tracking-wider tabular-nums`) for timers and attempt counters.
  - Clean, professional Login Card:
    - **Header**: IGNOU Study Centre 2033 crest, centre details, and live Google Sheets connectivity indicator (green dot = Online Sheet Sync, amber dot = Resilient Offline Mode).
    - **Fields**: Staff ID / Username, Password (with eye toggle), and "Remember Staff ID" checkbox.
    - **Submit Action**: Primary `[Authenticate & Access Terminal]` button with loading indicator.
    - **Assistance Hint**: Discreet note: *"Credentials managed by Centre Coordinator in Google Sheets. Contact Dr. Sant K. Gupta for account assistance."*
- **Lockout Screen State**:
  - High-visibility security card: *"Security Alert: Account Temporarily Locked after 5 consecutive failed login attempts."*
  - Monospace cooldown timer (`14:59`, `14:58`, ...) and guidance: *"Contact Centre Coordinator to unlock immediately via Google Sheets or Admin Terminal."*
- **Idle Session Expiry Warning Modal (`IdleTimeoutModal.tsx`)**:
  - Unobtrusive, high-priority modal triggered at 28 minutes of inactivity: *"Session Inactivity Warning — Terminal will lock in 01:59"*.
  - Dual action buttons: `[Extend Session]` (primary) and `[Lock Terminal Now]` (secondary).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Google Sheets as the Primary Source of Truth**
  - *Chosen Approach*: Add `Staff_Users` tab to the Apps Script template (`Code.gs`) and app synchronization engine.
  - *Why*: Gives Dr. Sant Kumar Gupta full, transparent ownership of staff credentials in the exact tool he already uses daily for assignment registers and billing.
  - *Initial Seeding*: If the `Staff_Users` tab does not exist in the Google Spreadsheet, the Apps Script / app automatically creates it with pre-configured default accounts:
    - `coordinator` (Dr. Sant Kumar Gupta, Role: `ADMIN`, Initial Password: `Coordinator@2033`)
    - `desk01` (Counter 1 Desk Official, Role: `OFFICIAL`, Initial Password: `Desk@2033`)
    - `desk02` (Counter 2 Desk Official, Role: `OFFICIAL`, Initial Password: `Desk@2033`)

- **Decision 2: Real-Time Sheet Verification with Resilient Offline Fallback**
  - *Chosen Approach*: On login submission, the client calls `server.ts` `/api/sheets` with a 5-second timeout to verify against Google Sheets. If the script is unreachable or times out, the local cached credentials (updated on every successful sync) authenticate the user seamlessly.
  - *Why*: Guarantees zero downtime at the intake desk even if the internet drops or Google Apps Script responds slowly, while still honoring credential changes made by the Admin in Google Sheets when online.

- **Decision 3: Password & Account Security**
  - *Chosen Approach*: Passwords can be viewed/edited by the Admin in Google Sheets in plain text or standard format for simplicity. In the app cache, credentials are encrypted and stored in `localStorage` under `ignou_sc2033_staff_accounts`.
  - *Why*: Matches the user's specific request for Admin-managed credentials in Google Sheets without requiring complex external key servers.

---

### 4. Technical Architecture & Component Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Gatekeeper Authentication Portal                     │
│               (src/components/GatekeeperLockScreen.tsx)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Enter Staff ID + Password)
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │ Check Local Lockout State (< 5 failed attempts)         │
       └──────────────┬───────────────────────────┬──────────────┘
                      │ (Not Locked)              │ (>= 5 Attempts)
                      ▼                           ▼
       ┌──────────────────────────────┐  ┌──────────────────────────────┐
       │ Verify Credential via        │  │ Display Lockout Screen       │
       │ Google Apps Script / Sheet   │  │ 15-min cooldown timer        │
       └──────────────┬───────────────┘  │ Log Audit: SECURITY_LOCKOUT  │
                      │                  └──────────────────────────────┘
         ┌────────────┴────────────┐
         │ (Online)                │ (Offline / 5s Timeout)
         ▼                         ▼
   [Google Sheets]          [Local Cached Accounts]
         │                         │
         └────────────┬────────────┘
                      │
         ┌────────────┴────────────┐
         │ (Match)                 │ (Invalid Password)
         ▼                         ▼
   ┌─────────────────────────┐  ┌─────────────────────────┐
   │ Login Success:          │  │ Increment Failed Count  │
   │ - Reset failed count    │  │ Update Sheet & Cache    │
   │ - Set userRole & auth   │  │ If 5 -> Trigger Lockout │
   │ - Start 30m idle watch  │  │ Show Error Notice       │
   │ - Log Audit: USER_LOGIN │  └─────────────────────────┘
   └─────────────────────────┘
```

---

### 5. Implementation Tasks

#### Task 1: Update Google Apps Script (`Code.gs` in `src/services/sheetsService.ts`)
- Update `OFFICIAL_APPS_SCRIPT_CODE`:
  - Add `STAFF_USERS_SHEET_NAME = 'Staff_Users'` constant.
  - In `doGet()`: Return `staffUsers` array alongside `intakeRegister`, `courseLedger`, `evaluatorsMaster`, and `awardSheets`.
  - In `doPost()`: Support actions:
    - `VERIFY_STAFF_LOGIN`: Validates username and password in Google Sheets, returns user role and account status, and updates `Last_Login` and `Failed_Attempts`.
    - `UPDATE_STAFF_STATUS`: Updates `Account_Status` (`Active` / `Locked`) and `Failed_Attempts`.
    - `SAVE_STAFF_USER`: Adds or updates a staff member row in the `Staff_Users` sheet.
  - In `setupSheets()` / automatic initialization: If `Staff_Users` tab does not exist, automatically create it with headers and default accounts (`coordinator`, `desk01`, `desk02`).

#### Task 2: Create `src/services/staffAuthService.ts`
- Account schema:
  ```ts
  export interface StaffUser {
    staffId: string;
    fullName: string;
    role: 'ADMIN' | 'OFFICIAL';
    password: string;
    status: 'Active' | 'Locked' | 'Suspended';
    failedAttempts: number;
    lastLogin?: string;
  }
  ```
- Functions:
  - `authenticateStaff(username, password)`: Queries Google Sheets via `/api/sheets`, falls back to local cache if network fails.
  - `recordFailedAttempt(username)`: Increments failed attempt count; locks account if attempts >= 5.
  - `resetFailedAttempts(username)`: Resets counter to 0 on successful login.
  - `unlockStaffAccount(username)`: Resets status to `Active` and `failedAttempts` to 0.
  - `syncStaffAccountsFromSheet(remoteAccounts)`: Updates local cache from Google Sheets.
  - `saveStaffUser(user)`: Saves new or updated staff user to Google Sheets and local cache.

#### Task 3: Redesign `GatekeeperLockScreen.tsx`
- Replace the legacy 4-digit PIN form with an institutional Staff ID & Password interface:
  - Staff ID input and Password input with show/hide toggle.
  - Real-time connectivity indicator (Sheet Synced vs Offline Cached Mode).
  - Failed attempt feedback (e.g. *"Incorrect password. 3 attempts remaining before security lockout."*).
  - Lockout display mode with 15-minute countdown and instructions to contact Dr. Sant Kumar Gupta.
  - Retain `onBackToHome` / public mode navigation if applicable.

#### Task 4: AppContext Session State & Inactivity Surveillance
- Update `AppContext.tsx`:
  - `currentUser`: `{ staffId: string; fullName: string; role: UserRole; lastLogin: string } | null`.
  - Refactor `handleLogin` to call `authenticateStaff` with username and password.
  - Inactivity Watchdog: 30-minute idle surveillance across `mousemove`, `keydown`, `touchstart`, and `click`.
  - At 28 minutes, open `isIdleWarningOpen` modal.
  - At 30 minutes, automatically clear session and log `SESSION_TIMEOUT_AUTO_LOCKED`.

#### Task 5: Create `src/components/IdleTimeoutModal.tsx`
- High-priority dialog rendered when session reaches 28 minutes of inactivity.
- Tabular countdown (`01:59`, `01:58`, ...).
- Action buttons: `[Extend Session]` (resets timer for 30 minutes) and `[Lock Terminal Now]`.

#### Task 6: Add Staff Management in `SystemSettingsView.tsx`
- Add a new section in System Settings (accessible exclusively to `ADMIN` Coordinator):
  - **Staff Accounts & Google Sheets Governance**:
    - Live table showing users from `Staff_Users` sheet (`coordinator`, `desk01`, `desk02`, etc.).
    - Status badge (`Active` green, `Locked` red).
    - Quick actions: "Unlock Account", "Reset Password", "Add New Staff Member", "Sync from Google Sheet".
    - Explanation banner on managing accounts directly within the Google Sheet.

#### Task 7: Verification & Build
- Verify application compilation via `compile_applet` and check linting with `lint_applet`.
- Test real-time login against sheet data, offline fallback simulation, 5-attempt lockout, and 30-minute idle session warning.
