# In-App PWA Install Action Across Header & Sidebar Navigation

Restore and prominently integrate the in-app **"Install App"** action across both the top Header navigation bar and the main Left Sidebar navigation rail. The action features a warm amber accent badge, download iconography, and a comprehensive guided installation modal for mobile home screens (iOS/Android) and desktop docks (Windows/macOS/Linux), transitioning cleanly to an **"App Guide"** trigger when running in installed standalone mode.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and UX decisions were confirmed during the interactive clarification session:

- **Confirmed Decision 1 (Dual Placement)**: The Install App action will be prominently mounted in **both** the top header navigation bar and the left sidebar navigation drawer, ensuring seamless discovery whether users navigate via desktop rail or mobile header.
- **Confirmed Decision 2 (Visual Styling)**: Styled with a **warm amber accent badge** (`from-amber-50 to-orange-50` with amber border and rich amber typography) paired with a high-contrast download icon (`Download` from Lucide).
- **Confirmed Decision 3 (Post-Install State)**: When the application is already running in standalone mode or detected as installed on the device, the button will dynamically update to **"App Guide"**, providing direct access to offline usage tips, launch instructions, and PWA capabilities without cluttering the screen.
- **Preserved Governance**: The 2-Stage menu isolation for Desk Officials (`Stage 1: Student Intake & Desk` and `Stage 2: Evaluation Master`), coordinator-protected mark locking/bills, and hidden forensic audit trail remain strictly intact.

---

## 1. Overview & Core Concept

### What It Does
Provides an accessible, native-feeling in-app install workflow for IGNOU Study Centre 2033 operators and students. Users can install the portal directly to their smartphone home screen (iOS Safari / Android Chrome) or desktop taskbar/dock (Chrome / Edge / Brave), giving them full-screen offline-ready operation with zero browser URL bar overhead.

### Target Audience & Persona
- **Front Counter Desk Officials & Evaluators**: Quick one-tap launch from their tablet, desktop, or mobile workstation without typing URLs or navigating browser bookmarks.
- **Centre Coordinator**: Full-screen standalone monitoring of intake cycles, mark locks, and gazette award sheets.
- **Students & Evaluators on Public Portal**: Quick installation to check assignment receipt statuses and regional guidelines offline.

### Key Value
- **Zero Confusion**: Solves the browser-specific hidden install problem by providing an immediate, visible UI button that triggers the browser prompt or shows visual step-by-step installation guides.
- **Offline Reliability**: Leverages existing PWA service worker caching to ensure fast loading even during regional network drops.

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. Initial Visit / Uninstalled State
1. **Header Navigation Bar**:
   - The user sees a warm amber button labeled `Install App` with a download icon right next to the role switcher and public home trigger.
   - On small screens, the button scales gracefully with compact padding to avoid pushing other actions out of view.
2. **Left Sidebar Navigation Menu**:
   - In the expanded sidebar, an amber-accented card or action item sits prominently above the active cycle footer, displaying `Install App` with an amber `PWA` pill tag and download badge.
   - When the sidebar is collapsed to icon-only mode, it renders a sleek download icon with a tooltip explaining *"Install IGNOU SC-2033 App"*.
3. **Click Interaction**:
   - **Chromium / Edge / Android**: Directly invokes the native browser `beforeinstallprompt` dialog for 1-click home screen or desktop dock installation.
   - **iOS Safari / Fallback**: Opens the interactive **Installation Guide Modal** featuring tabbed instructions for Mobile (Safari Share → Add to Home Screen) and Desktop (Address Bar Install Icon / Browser Menu).

#### B. Installed Standalone State
1. When launched from the home screen or running in standalone display mode, both the Header and Sidebar buttons automatically switch their label to `App Guide`.
2. Clicking `App Guide` opens the guided offline reference modal, showing how the app synchronizes data, stores offline tokens, and caches academic registers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual Navigation Presence (Header + Sidebar)**
  - *Chosen Approach*: Embed the button in both `Header.tsx` (top-right utility bar) and `Sidebar.tsx` (navigation rail).
  - *Why*: User confirmed preference. Ensures immediate visibility on both wide desktop displays where users focus on the sidebar, and mobile viewports where the header is primary.
- **Decision 2: "App Guide" Mode Over Complete Hiding**
  - *Chosen Approach*: Switch to "App Guide" rather than completely unmounting when installed.
  - *Why*: User confirmed preference. Allows users to easily access offline documentation and re-check installation steps on companion devices.
- **Decision 3: Reusable Component Architecture (`PWAInstallButton.tsx`)**
  - *Chosen Approach*: Leverage and enhance the dedicated `PWAInstallButton` component supporting multiple variants (`compact`, `sidebar`, `nav`, `full`).
  - *Why*: Eliminates duplicated event listener code and ensures uniform event handling for `beforeinstallprompt` and `appinstalled` across the entire codebase.

---

## 4. Technical Architecture & Data Strategy

### Visual Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        IGNOU SC-2033 Web App                          │
├────────────────────────────────────────────────────────────────────────┤
│ Top Header (Header.tsx)                                                │
│ ┌───────────────┐  ┌─────────────┐  ┌──────────────────┐  ┌──────────┐ │
│ │ Academic Seal │  │ Role Toggle │  │ [Install App] ◄──┼──┼─ Header  │ │
│ └───────────────┘  └─────────────┘  └──────────────────┘  └──────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ Sidebar Navigation (Sidebar.tsx)                                       │
│ ┌────────────────────────────┐                                         │
│ │ Stage 1: Student Intake    │                                         │
│ ├────────────────────────────┤                                         │
│ │ Stage 2: Evaluation Master │                                         │
│ ├────────────────────────────┤                                         │
│ │ [Install SC-2033 App] ◄────┼── Sidebar Variant                       │
│ ├────────────────────────────┤                                         │
│ │ Session / Cycle Footer     │                                         │
│ └────────────────────────────┘                                         │
└────────────────────────────────────────────────────────────────────────┘
                                 │ Click
                                 ▼
              ┌─────────────────────────────────────┐
              │ Has Native `beforeinstallprompt`?   │
              └──────────────────┬──────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼ (Yes)                         ▼ (No / iOS)
       [Native OS Prompt]              [Guided Instructions Modal]
       - Add to Home Screen            - Mobile: iOS Safari Guide
       - Desktop Dock Pin              - Desktop: Address bar icon
```

### Component Implementation Tasks

1. **`src/components/Sidebar.tsx`**:
   - Import `PWAInstallButton` from `./PWAInstallButton`.
   - Mount `<PWAInstallButton variant="sidebar" />` right above the sidebar footer.
   - For collapsed sidebar view, ensure compact icon-only representation with proper tooltip and touch target ($\ge 40\text{px}$).
2. **`src/components/Header.tsx`**:
   - Ensure `<PWAInstallButton variant="compact" />` is prominently visible in the header action strip, with responsive styling (`hidden sm:inline-flex` or responsive text truncation) so it never overflows on small mobile devices.
3. **`src/components/PWAInstallButton.tsx`**:
   - Verify variant styles:
     - `sidebar`: Full-width banner with amber gradient, download icon, label, and `PWA` tag.
     - `compact`: Elegant inline amber pill/button with download icon.
   - Confirm proper state transitions between `Install App` and `App Guide`.
4. **Verification**:
   - Test build via `compile_applet` and verify no TypeScript or lint regressions.
