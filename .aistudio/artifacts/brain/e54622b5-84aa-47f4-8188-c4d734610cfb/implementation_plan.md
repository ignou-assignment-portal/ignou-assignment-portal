# Dedicated 'Install App' Banner in Centre Configuration (Desktop & Mobile)

Restructure the application installation experience by removing the "Install App" button from global headers and sidebars, and establishing a dedicated, high-visibility **"Install App" Banner** exclusively within **Centre Configuration** under the **General Centre Profile** section.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX specifications were confirmed during the interactive clarification session:

- **Confirmed Decision 1 (Exclusive Placement)**: The Install App capability will be restricted exclusively to **Centre Configuration** (`SETTINGS` tab) and completely removed from the global top Header (`Header.tsx`), the left Sidebar (`Sidebar.tsx`), and the public home page header (`StudyCentreHomePage.tsx`).
- **Confirmed Decision 2 (Exact Section Target)**: Mounted directly under the **General Centre Profile / Institutional Centre Details** section within the General tab of Centre Configuration.
- **Confirmed Decision 3 (Interactive Controls Suite)**: The banner will feature:
  1. **Direct Native Install Trigger**: Immediately invokes Chromium / Edge / Android `beforeinstallprompt`.
  2. **Mobile Handoff QR Code**: Displays a scannable QR code generated from the current app URL so coordinators and desk staff can easily install the PWA on companion smartphones and tablets.
  3. **Guided Installation Modal**: Step-by-step illustrated manual for iOS Safari (*Add to Home Screen*) and desktop dock pinning.
  4. **Post-Install Standalone Awareness**: Clear badge and status indicating when the application is already running as an installed standalone PWA.

---

## 1. Overview & Core Concept

### What It Does
Centralizes progressive web application (PWA) management into the administrative **Centre Configuration & Governance** workspace. Rather than cluttering general navigation bars across day-to-day intake operations, system installation is treated as a foundational centre setup task. Coordinators and staff setting up counter terminals or mobile scanning stations can install the desktop dock shortcut, trigger mobile installation via QR code, or review offline operational guides all in one place.

### Target Audience & Persona
- **Study Centre Coordinator (`admin` role)**: Configures desk kiosks and distributes mobile links to counter staff.
- **Counter Staff & Evaluators**: Scans the setup QR code or installs the desktop workstation app during workstation onboarding.

### Key Value
- **Zero Global Clutter**: Cleans the top Header and left Sidebar navigation, keeping intake and evaluation workflows uncluttered.
- **Seamless Desktop-to-Mobile Handoff**: The interactive QR code allows instant transfer from a desktop administration monitor to an operator's mobile smartphone.
- **Offline & Standalone Preparedness**: Informs operators of the offline caching mechanism and standalone full-screen benefits before deployment.

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. Global Navigation State
1. **Header Navigation Bar (`Header.tsx`)**: The install button is cleanly removed, restoring a streamlined header containing only the academic seal, cycle selector, role switcher, home link, and sign-out action.
2. **Left Sidebar (`Sidebar.tsx`)**: The install card is removed from the sidebar rail and footer, preserving the clean two-stage focus for Desk Officials and institutional registers for Coordinators.

#### B. Centre Configuration View (`SystemSettingsView.tsx`)
1. User navigates to **Centre Configuration** (via sidebar or settings shortcut).
2. Under the **General** tab, beneath the **Institutional Centre Details (Host Institution, Code, Regional Centre)** form, a dedicated **PWA Installation Banner** is rendered:
   - **Banner Header**: Academic Seal / PWA badge, clear headline *"Install IGNOU SC-2033 Terminal Application"*, and explanatory subtext highlighting offline execution and zero-address-bar productivity.
   - **Action Strip**:
     - **"Install to This Device"** button: Primary warm amber / indigo action with download icon. Triggers native browser install or guided modal.
     - **"Show Mobile QR Code"** toggle: Expands an inline scannable QR code with instructions to scan with an iPhone or Android camera to install immediately on mobile.
     - **"Setup Guide & Instructions"** button: Opens the multi-device illustrated guide modal.
   - **Status Badge**: If already launched in standalone mode, highlights *"Application Installed & Running Standalone (Offline Ready)"*.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Removal from Global Navigation**
  - *Chosen Approach*: Fully remove install buttons from Header and Sidebar.
  - *Why*: User explicitly confirmed *"Yes, display exclusively in Centre Configuration and remove elsewhere"*. This keeps operational views focused on core academic tasks.
- **Decision 2: Dual Desktop & Mobile QR Code Integration**
  - *Chosen Approach*: Embed a high-contrast QR code directly in the banner using the existing `qrcode` library.
  - *Why*: Makes mobile onboarding frictionless. A coordinator on a desktop terminal can open Centre Configuration and have counter staff scan the QR code with their phones in seconds.
- **Decision 3: Reusable Modal Support**
  - *Chosen Approach*: Keep the existing detailed step-by-step instructions (iOS Safari and Desktop browser) intact within the banner's guide trigger.
  - *Why*: Ensures users on browsers without `beforeinstallprompt` (such as Safari) receive clear, accurate guidance.

---

## 4. Technical Architecture & Component Layout

### Component Hierarchy Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│               Centre Configuration (SystemSettingsView.tsx)            │
├────────────────────────────────────────────────────────────────────────┤
│ Tabs: [General] [Appearance] [Rates] [Governance] [Database]           │
├────────────────────────────────────────────────────────────────────────┤
│ [Institutional Centre Details Form]                                    │
│ - Centre Code, Regional Centre, Host Institution, Coordinator Contact  │
├────────────────────────────────────────────────────────────────────────┤
│ ▼ NEW: Dedicated Install App Banner (Desktop & Mobile)                │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ ⬡ IGNOU SC-2033 Terminal Application · PWA Installation            │ │
│ │                                                                    │ │
│ │ [ Install App on This Device ]  [ 📱 Scan Mobile QR ]  [ 📖 Guide ]│ │
│ │                                                                    │ │
│ │ ┌───────────────────┐  ┌─────────────────────────────────────────┐ │ │
│ │ │  Scannable QR     │  │ Features:                               │ │ │
│ │ │  Code for Mobile  │  │ • 100% Offline Counter Operation        │ │ │
│ │ │  Handoff          │  │ • Dedicated Desktop Dock / Home Screen   │ │ │
│ │ └───────────────────┘  └─────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ [Gatekeeper PIN Security Settings]                                     │
└────────────────────────────────────────────────────────────────────────┘
```

### File Modification Blueprint

1. **`src/components/CentreInstallAppBanner.tsx`** (New Component):
   - Handles `beforeinstallprompt` and `appinstalled` events.
   - Detects standalone mode via `display-mode: standalone`.
   - Generates canvas QR code for `window.location.origin` or current URL.
   - Renders responsive desktop/mobile action bar with guided instructions modal.
2. **`src/components/SystemSettingsView.tsx`**:
   - Mount `<CentreInstallAppBanner />` under the General Centre Details form in `activeTab === 'general'`.
3. **`src/components/Header.tsx`**:
   - Remove `<PWAInstallButton />` from the header toolbar.
4. **`src/components/Sidebar.tsx`**:
   - Remove `<PWAInstallButton />` from the sidebar rail.
5. **`src/components/StudyCentreHomePage.tsx`**:
   - Remove `<PWAInstallButton />` from the public homepage navigation.
6. **`src/components/Navigation.tsx`**:
   - Clean up export references.
7. **Verification**:
   - Verify compilation with `compile_applet` and type check with `lint_applet`.
