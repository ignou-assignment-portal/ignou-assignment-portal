# Professional Workspace Redesign & Study Centre Configuration Restructuring

Streamline the IGNOU Study Centre 2033 web application into an executive, high-density professional portal by removing visual clutter, technical widgets, and settings controls from the top header into a structured multi-tab Study Centre Configuration center (General, Appearance, Rates, and Data Sync).

> [!IMPORTANT]
> **Confirmed Decisions from Clarification**:
> - **Header Relocation**: Theme selector, layout toggles (compact/full-width), and data sync monitoring controls are relocated out of the persistent header into Study Centre Configuration.
> - **Top Header Bar**: Streamlined into an executive 3-zone bar containing institutional branding, instant student search (`Ctrl+K`), academic cycle isolation selector, and user profile / role credentials.
> - **Study Centre Configuration Structure**: Organized into four clean tabs:
>   1. **General**: Centre details (SC-2033, RC-20 Kohima, S.D. Jain Girls' College), coordinator contact, and Gatekeeper terminal security PINs.
>   2. **Appearance**: Theme selection cards, layout density (compact vs default), and workspace width preferences (fluid full-width vs standard container).
>   3. **Rates & Norms**: IGNOU statutory evaluation rates (₹27.50/script), conveyance allowances, coordination charges, and financial mandates.
>   4. **Data Sync & Governance**: Google Sheets live sync monitors, manual evaluators/sheet sync triggers, session rollover archives, JSON exports, and disaster recovery.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the application from a busy, control-crowded screen into an uncluttered, authoritative academic operations workspace. The persistent top bar focuses strictly on active operational tasks (who is logged in, what cycle is being processed, and looking up student files), while administrative options and system health monitors reside in a dedicated, tabbed Study Centre Configuration suite.
- **Target Audience / Persona**: 
  - **Desk Officials**: Front-desk operators processing high-volume student assignment submissions requiring zero distractions, fast search, and crisp cycle visibility.
  - **Centre Coordinator (Dr. Sant K. Gupta)**: Administrator reviewing evaluator bills, configuring university remuneration rates, adjusting layout/theme preferences, and managing academic session rollovers.
- **Key Value**: Eliminates visual noise and cognitive overload, adheres to SaaS dashboard design standards (no unwired icons, no telemetry tickers in the header), and groups operational governance into an intuitive administrative center.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Executive Header Navigation**:
   - The user sees a clean, authoritative 1-row header:
     - **Left (Brand Zone)**: IGNOU Study Centre 2033 insignia, "Assignment Operations Cell", and host institution indicator.
     - **Center/Middle (Utility Zone)**: Instant Student Lookup button with `Ctrl+K` shortcut indicator, providing quick access to candidate status and evaluation history.
     - **Right (Context & Account Zone)**: Active Academic Cycle badge with single-click dropdown switcher, user role status (Coordinator / Desk Official) with switch button, and Lock/Sign Out action.
   - No distracting pulsing status dots, no floating layout switches, and no color theme palettes cluttering the workspace top.
2. **Accessing Study Centre Configuration**:
   - The user navigates to **System Settings / Study Centre Configuration** via the left navigation drawer.
   - The view presents a tabbed layout:
     - **Tab 1: General**: Edit centre identification, regional centre affiliation, host college details, coordinator contact info, and terminal gatekeeper PINs.
     - **Tab 2: Appearance**: Choose visual themes (Corporate Navy, Slate Minimal, Academic Emerald, Royal Purple, etc.) with real-time preview, toggle compact header mode, and toggle fluid full-width layout.
     - **Tab 3: Rates & Norms**: Set evaluation remuneration rate (₹27.50/script default), conveyance allowance, coordination charges, and administrator security credentials.
     - **Tab 4: Data Sync & Governance**: Live Google Sheets sync engine status, last sync timestamp, "Sync Evaluators Directory" trigger, "Force Sync Intake Sheet" trigger, session rollover archival history, and full JSON database backup.

### Visual Identity & Theme
- **Aesthetic Direction**: Executive institutional SaaS portal—disciplined, restrained, high-legibility. Deep navy and slate foundation (`bg-slate-900` / `bg-zinc-900` accents, crisp white and slate-50 surfaces, and emerald/indigo semantic accents).
- **Color Palette & Mood**:
  - Dominant Neutral (60%): Canvas background (`#F8FAFC` in light mode, `#090D16` in dark mode).
  - Structural Surfaces (30%): White cards with hairline border (`border-zinc-200 / dark:border-zinc-800`), clean 1px dividers, zero heavy drop shadows.
  - Accent Budget (10%): Royal indigo (`#4338CA`) for primary actions and active tabs; muted emerald (`#059669`) for active status indicators.
- **Typography & Hierarchy**:
  - System display face: `Plus Jakarta Sans` / clean sans-serif for headers and labels.
  - Tabular numerals (`tabular-nums font-mono`) for all counts, timestamps, session labels, and currency figures.
  - Zero-pill metadata: unboxed textual status with subtle middot (`·`) separators instead of nested pill badges.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Relocating Theme & Layout Toggles
- **Chosen Approach**: Move `ThemeSelector` and layout switches (Compact Header & Full-Width toggles) into the **Appearance** tab of Study Centre Configuration.
- **Why**: Theme and layout changes are infrequent user preferences. Having them permanently occupying horizontal header space caused crowding, especially on laptops and tablets, pushing critical session and search controls into hidden overflow.
- **Alternatives Considered**: Keeping a small gear icon in the header. Rejected because it violates the Top Bar Contract (which mandates a clean 3-zone layout with no decorative gear clutter).

### Decision 2: Relocating DataSyncMonitor & Evaluator Sync
- **Chosen Approach**: Place `DataSyncMonitor` and the Evaluators Sync button inside the **Data Sync & Governance** tab of Study Centre Configuration.
- **Why**: Continuous sync telemetry tickers in the header distract desk officials during student intake. The Data Sync tab offers dedicated space to display sync health, parity state with Google Sheets, error logs, and one-click manual refresh actions.
- **Alternatives Considered**: Collapsible popup modal in the header. Rejected in favor of a cohesive configuration hub.

### Decision 3: Tabbed Architecture in Study Centre Configuration
- **Chosen Approach**: Replace the continuous vertical scroll of `SystemSettingsView.tsx` with a segmented 4-tab control (`General`, `Appearance`, `Rates`, `Data Sync`).
- **Why**: The settings view was over 1,200 lines long, requiring extensive scrolling past theme pickers and centre forms to reach archival and backup functions. Tabs provide immediate, zero-scroll access to specific administrative domains.

---

## 4. Technical Architecture & Data Strategy

### Component Architecture & Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       HEADER COMPONENT                                          │
│ ┌─────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────────┐ │
│ │ Zone 1: Branding        │   │ Zone 2: Global Search     │   │ Zone 3: Cycle & Profile       │ │
│ │ [SC-2033 Insignia]      │   │ [Student Lookup  Ctrl+K]  │   │ [Active Cycle: July 2026 ▼]   │ │
│ │ IGNOU SC-2033           │   │                           │   │ [Coordinator / Desk Role]     │ │
│ │ Ops Cell • S.D. Jain    │   │                           │   │ [Lock / Sign Out]             │ │
│ └─────────────────────────┘   └───────────────────────────┘   └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      STUDY CENTRE CONFIGURATION (SystemSettingsView)                           │
│ ┌───────────────────┬───────────────────┬───────────────────────┬─────────────────────────────┐ │
│ │ 🏢 General        │ 🎨 Appearance     │ 💰 Rates & Norms      │ 🔄 Data Sync & Governance   │ │
│ └───────────────────┴───────────────────┴───────────────────────┴─────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Tab 1 (General):                                                                            │ │
│ │   - Study Centre Code, Host Institution, Regional Centre, Coordinator Contact               │ │
│ │   - Gatekeeper Terminal PINs (Desk PIN 1001, Admin PIN 2033)                                │ │
│ ├─────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ Tab 2 (Appearance):                                                                         │ │
│ │   - Visual Theme Palette (ThemeSelector card layout)                                        │ │
│ │   - Layout Toggles: Header Compactness Mode, Full-Width Fluid Workspace                     │ │
│ ├─────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ Tab 3 (Rates & Norms):                                                                      │ │
│ │   - IGNOU Evaluation Rate (₹27.50 / script), Conveyance Allowance, Coordination Charges     │ │
│ │   - Financial Mandates and Remuneration Guidelines                                          │ │
│ ├─────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ Tab 4 (Data Sync & Governance):                                                             │ │
│ │   - Google Sheets DataSyncMonitor Engine & Parity Inspector                                 │ │
│ │   - One-Click Triggers: Sync Evaluators Directory & Refresh Google Sheets Intake Data        │ │
│ │   - Session Closeout Archival Engine & Historical Snapshots Ledger                          │ │
│ │   - Forensic Audit Trail Export & Institutional JSON Backup                                 │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### State Management & Wiring
- **AppContext State Preserved**:
  - `isHeaderCompact` & `toggleHeaderCompact`: Controlled seamlessly from the Appearance tab.
  - `isContentFullWidth` & `toggleContentFullWidth`: Controlled seamlessly from the Appearance tab.
  - `theme` & `setTheme`: Configured via `ThemeSelector` rendered in the Appearance tab.
  - `isSyncingSheets`, `syncGoogleSheets`, `isSyncingEvaluators`, `syncEvaluatorsDirectory`, `lastSheetSync`: Wired directly into the Data Sync & Governance tab.
- **Session & Search Accessibility**:
  - Student Search Modal (`openSearchModal`) remains instantly accessible via header button or `Ctrl+K`.
  - Session Selector dropdown remains in the header to switch or initialize academic cycles.
  - Role switcher stays accessible for rapid testing or PIN-authorized administration.

---

## 5. Verification Plan

1. **Header Inspection**:
   - Verify top header renders cleanly without horizontal overflow.
   - Verify absence of theme selector, layout toggles, and sync tickers in the header bar.
   - Verify Search trigger, Session dropdown, Role badge/switcher, and Sign Out button operate smoothly.
2. **Configuration Tabs Verification**:
   - Switch between **General**, **Appearance**, **Rates**, and **Data Sync** tabs.
   - **General Tab**: Verify institutional details and PIN updates save to `localStorage` and `AppContext`.
   - **Appearance Tab**: Change themes (e.g. Navy, Emerald) and toggle Compact Header / Full Width modes; confirm immediate visual response.
   - **Rates Tab**: Update remuneration rate and verify persistence in billing calculations.
   - **Data Sync Tab**: Verify Google Sheets sync status displays properly; click "Sync Evaluators" and confirm live refresh feedback.
3. **Applet Compilation**:
   - Run `compile_applet` to ensure zero TypeScript or Vite build errors.
