# BCOMF Course BRL-101 TMA Classification & Retroactive Rectification Plan

Fix the classification defect where BCOMF course BRL-101 (and the BRL series) was erroneously treated as a Practical course due to generic lab regex patterns matching the "L" in BRL, establish strict user-selection component precedence over automated course inference, and automatically reclassify all existing BRL-101 practical records into Tutor Marked Assignments (TMAs).

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed during the interactive clarification session:

- **Confirmed Decision 1**: Automatically reclassify existing BRL-101 intake and evaluation entries to TMA assignments across active sessions, local state, and storage.
- **Confirmed Decision 2**: Systematically classify all BRL series courses (`BRL-101` through `BRL-115`) under BCOMF as standard theory TMA courses, excluding them from any lab/practical regex matching.
- **Confirmed Decision 3**: Enforce absolute component precedence where explicit user selection (`Assignment` / `TMA` vs. `Practical`) at the Intake Desk strictly overrides automated course-code heuristic detection.

---

### 1. Overview & Core Concept

- **What It Does**: Resolves a classification mismatch in the IGNOU assignment management engine. In IGNOU, `BRL` stands for Bachelor in Retailing (a foundational domain within BCOMF / BBA Retail Operations), where courses such as `BRL-101` (Overview of Retailing), `BRL-102`, and `BRL-103` are 100-mark theory papers evaluated through Tutor Marked Assignments (TMA). Because the legacy helper checked `/^[A-Z]{2,5}L[-_]?\d+/i`, the system matched `BR` + `L` + `-101` and wrongly inferred it as a laboratory practical course. This plan removes `BRL` from lab heuristics, updates the master curriculum for BCOMF, respects desk official component selection as authoritative, and migrates existing entries.
- **Target Audience / Persona**: Desk Officials and Study Centre Coordinators at IGNOU SC-2033 registering incoming candidate assignment scripts and managing evaluator course-wise allotments.
- **Key Value**: Guarantees accurate academic record keeping, prevents theory TMA scripts from ending up in lab/viva rosters or practical payment batches, and eliminates manual data corrections.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Intake Registration*: When a desk official types or selects `PROGRAMME: BCOMF` and enters course `BRL-101`, the course badge instantly tags as `[Assignment (TMA)]` with blue theory styling rather than purple lab styling.
  2. *Intake Desk Component Override*: If a desk official explicitly selects `Assignment (TMA)`, the validation engine guarantees it stays TMA even if a course code has ambiguous characters.
  3. *Ledger & Register Views*: Existing submissions of `BRL-101` currently listed under the "Practical" tab in Course Evaluation Master and Intake Register immediately transition to the "Assignment (TMA)" tab.
  4. *Receipt Generation*: Official student intake receipts generated for BRL-101 display "Component: Assignment (TMA)" with standard assignment submission norms.
- **Visual Identity & Theme**:
  - Theory TMA badges retain clean slate/blue tones (`bg-blue-50 text-blue-700 border-blue-200` in light mode; `bg-blue-950/40 text-blue-300 border-blue-800` in dark mode).
  - Practical courses remain clearly distinct with emerald/purple accents (`bg-purple-50 text-purple-700 border-purple-200`).
- **Interactive Feedback & Motion**:
  - Auto-fill notification toast when BCOMF or BRL courses are selected: `"Course BRL-101 verified as Theory TMA (BCOMF)"`.
  - Seamless tab count updates in Course Evaluation Master (TMA count increments, Practical count decrements).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Explicit BRL Discipline Exclusion in `helpers.ts` & `dataEntryValidationService.ts`**:
  - *Chosen Approach*: Specifically check for `^BRL[-_]?\d+` as an explicit theory course prefix that returns `false` from `isPracticalCourse()`, and tighten the lab regex from `/^[A-Z]{2,5}L[-_]?\d+/i` to only match recognized IGNOU lab disciplines (`BCSL`, `MCSL`, `CITL`, `BPCL`, `MPCL`, `BBYCL`, `BCHCL`, `BPHCL`, `BZYCL`, `BGGCL`, `BGYCL`).
  - *Why*: Prevents false positives for any academic acronyms that legitimately end with the letter "L" (e.g., `BRL` for Retailing).
  - *Alternatives Considered*: Only checking `BRL-101` in an array was rejected because `BRL-102` through `BRL-115` would remain vulnerable to the same bug.
- **Decision 2: Strict Component Precedence Over Heuristic Detection**:
  - *Chosen Approach*: If an incoming submission or record carries an explicit `componentType` or `Component` of `'Assignment'` or `'TMA'` (or `hasAsgnTag`), `isPracticalCourse()` is never permitted to override it to `'Practical'`.
  - *Why*: The desk official's explicit operational input must always supersede code-based name guesses.
- **Decision 3: Retroactive Hydration & Ledger Rectification**:
  - *Chosen Approach*: During state initialization in `AppContext.tsx` (`cleanIntake` and `cleanLedger`), reclassify existing records for `BRL` courses that were assigned `_PRAC_` keys or `isPractical: true` back into standard `Assignment` records. Clean `intakePracticalCourseSet` so it does not contain BRL courses unless explicitly tagged with `Practical`.
  - *Why*: Ensures the fix corrects existing erroneous data in memory and localStorage without requiring desk officials to delete and re-enter previous submissions.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### System Architecture & Classification Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Intake Registration Desk                        │
│   Desk Official inputs Enrollment No, Programme: BCOMF, Course: BRL-101│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Course Classification Engine                         │
│                                                                        │
│  1. Check Explicit Selection:                                          │
│     Did user select "Assignment (TMA)"? ──────► KEEP AS TMA (Strict)   │
│                                                                        │
│  2. Check Discipline Exclusion:                                        │
│     Matches ^BRL[-_]?\d+? ───────────────────► CLASSIFY AS TMA         │
│                                                                        │
│  3. Check Known Lab Disciplines:                                       │
│     BCSL, MCSL, CITL, BPCL, BBYCL, etc.? ────► CLASSIFY AS PRACTICAL   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐   ┌────────────────────────────────┐
│        Assignment (TMA)           │   │           Practical            │
│  - Sub_ID: SUB_ENR_BRL101_TERM    │   │  - Sub_ID: SUB_ENR_CRS_PRAC_...│
│  - Component: "Assignment"        │   │  - Component: "Practical"      │
│  - isPractical: false             │   │  - isPractical: true           │
│  - Target Tab: TMA Assignments    │   │  - Target Tab: Practical / Lab │
└───────────────────────────────────┘   └────────────────────────────────┘
```

#### Files to Update During Execution Phase

1. `src/utils/helpers.ts`:
   - Update `isPracticalCourse`: Exclude `BRL` prefix (`/^BRL[-_]?\d+/i => false`).
   - Narrow lab prefix matching to true IGNOU lab disciplines (`BCSL`, `MCSL`, `CITL`, `BPCL`, `MPCL`, `BBYCL`, `BCHCL`, `BPHCL`, `BZYCL`, etc.).
   - Support `componentType === 'assignment' || componentType === 'tma'` as immediate return `false`.
2. `src/services/dataEntryValidationService.ts`:
   - Fix regex `/L\d|P\d|LAB|PRAC/i` so it does not trigger on `BRL` courses.
   - Respect explicit `courseComponents[c] === 'Assignment'` over `isLabOrPracCode`.
3. `src/context/AppContext.tsx`:
   - In `cleanIntake` (line ~4293): Ensure `hasAsgnTag` prevents `isPracticalCourse(clean)` from routing to practicals.
   - In `cleanLedger` (line ~4475): Ensure `r.componentType === 'Assignment'` or `r.Component === 'Assignment'` or `hasAsgnTag` takes precedence over `isPracticalCourse()`.
   - Add automated migration pass for existing `BRL` courses in `intakes` and `courseEvaluations` to clean up old `_PRAC_` keys and reset `isPractical: false`.
4. `src/data/ignouMasterData.ts`:
   - Add `BCOMF` (Bachelor of Commerce in Financial and Cost Accounting / Retailing) with courses `BRL-101`, `BRL-102`, `BRL-103`, `BRL-104`, `BRL-105` as standard theory courses.
5. `src/components/IntakeDesk.tsx`:
   - Ensure default component calculation does not evaluate `isPracticalCourse` if the user is in standard TMA intake mode.
