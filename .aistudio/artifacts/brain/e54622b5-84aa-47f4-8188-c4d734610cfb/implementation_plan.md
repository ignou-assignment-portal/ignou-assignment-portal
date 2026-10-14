# Implementation Plan: Post-Submission Edit, Delete, and Date Modification

Enable operators to modify, re-date, or delete student assignment intake submissions directly after registration, both within the printable receipt acknowledgment modal and from the Intake Register table.

## User Requirements & Clarifications
- **Locations**: Post-submission **Edit** and **Delete** controls placed inside the **Printable Receipt Modal** (and Registration Receipt Modal) as well as the **Intake Register Table**.
- **Date Modifications**: Interactive date picker in the receipt modal and edit modal with retroactive cascading updates across all linked records (`Intakes`, `Course Ledger / CourseEvaluations`, `AssignmentSubmissions`, `Registration Receipts`, and Google Sheets sync queue).
- **Authorization**:
  - **Edit**: Instant unrestricted access for desk operators without password barriers.
  - **Delete**: Protected by Coordinator PIN `2033` authorization, locked course marks verification, and explicit deletion confirmation.

---

## Proposed Changes

### 1. Printable Receipt Modal (`src/components/ReceiptModal.tsx` & `src/components/RegistrationReceiptModal.tsx`)
- **Action Header Controls**:
  - Add **"Edit Intake"** button with pencil icon, allowing desk operators to immediately open `EditIntakeModal` for the active receipt record.
  - Add **"Delete Intake"** button with trash icon in danger styling.
  - Enhance the existing **Date Picker** input with quick pre-sets (e.g., "Today", clear change feedback) and seamless cascading date update via `updateIntakeDate`.
- **Delete Workflow**:
  - Check coordinator access; if not in Admin/Coordinator mode, prompt for PIN `2033` and verify with `verifyAndSetAdminRole('2033')`.
  - Validate that no registered courses for this intake have locked marks in `Course Ledger`.
  - Display clear confirmation modal/prompt.
  - Execute cascading deletion via `deleteIntakeRecord(id)`, automatically closing the receipt modal and showing confirmation toast.
- **Embedded Modal Integration**:
  - Mount `<EditIntakeModal>` within `ReceiptModal` (and `RegistrationReceiptModal`) so edits can be saved and immediately reflected in the printable view.

### 2. Intake Register Table (`src/components/IntakeRegister.tsx`)
- **Enforce PIN 2033 Security on Deletion**:
  - Update `handleDeleteClick` to mandate Coordinator PIN `2033` authorization before permitting deletion if operator is not currently in Admin mode.
  - Maintain instant operator access for the `Edit` button (opening `EditIntakeModal` without PIN).
- **Inline Date Editing & Badge Display**:
  - Ensure the submission date column in the table clearly shows the recorded intake date and allows quick inspection and editing.

### 3. Cascading Updates & Integrity Validation (`src/context/AppContext.tsx`)
- Verify that `updateIntakeDate` and `editIntakeEntry`:
  - Update intake records in local state and `localStorage`.
  - Cascade new submission date to `courseEvaluations` (`submissionDate`, `receiptDate`, `receivedDate`, `Timestamp`).
  - Update `assignmentSubmissions` and `registrationReceipts`.
  - Push changes to Google Sheets background sync queue and trigger refresh.
  - Keep open modal objects synchronized in real-time.

---

## Verification Plan

### Automated Build & Syntax Verification
- Run `compile_applet` to verify TypeScript compilation and zero component/type errors.

### User Flow Walkthrough
1. **Intake Submission -> Immediate Receipt Edit**:
   - Submit an assignment intake on `IntakeDesk`.
   - On the receipt modal that appears, click the **"Edit Intake"** button.
   - Verify modal opens instantly without PIN prompt.
   - Change candidate name, course code, or submission date. Click "Save & Sync Changes".
   - Verify receipt modal reflects the updated details and date immediately.
2. **Date Picker on Receipt Modal**:
   - Change the date using the date picker on the receipt modal header.
   - Verify that the receipt date updates and linked records in Course Ledger reflect the new date.
3. **PIN 2033 Protected Deletion**:
   - In the receipt modal, click **"Delete Intake"**.
   - Verify prompt asks for Coordinator PIN `2033`.
   - Enter invalid PIN -> verify deletion is rejected.
   - Enter `2033` -> verify confirmation dialog appears, deletes record upon confirmation, and closes receipt modal.
4. **Intake Register Table Verification**:
   - Go to `Intake Register` tab.
   - Click Edit on an intake -> verify instant edit modal.
   - Click Delete on an intake -> verify PIN 2033 requirement and successful deletion.
