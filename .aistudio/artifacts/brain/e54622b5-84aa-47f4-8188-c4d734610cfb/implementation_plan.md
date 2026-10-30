# Institutional Seal Logo Update Plan (Royal Indigo Background & SC 2033 Inscription)

Update the existing circular institutional seal logo by changing **only** the background fill colour from dark navy to **Royal Indigo Blue (`#1E3A8A`)** and modifying the bottom foundation ribbon text from **`ESTD 2033`** to **`SC 2033`**, while keeping the rest of the emblem design completely unchanged.

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your explicit instructions and confirmed choice:
> - **Scope**: Modify **only the logo** (keeping all circular rings, stars, laurel wreath, open book, golden feather quill, and arc inscriptions intact).
> - **Background Colour**: Change the circular seal background from dark navy (`#0F172A` / `#0A192F` / `#020617`) to **Royal Indigo Blue (`#1E3A8A` gradient: `#1E40AF` → `#1E3A8A` → `#172554`)**.
> - **Base Ribbon Text**: Change the bottom plaque inscription from **`ESTD 2033`** to **`SC 2033`**.

---

## 1. Overview & Core Concept

- **What It Does**: Updates the circular IGNOU Study Centre 2033 emblem across all UI views and the static application SVG icon so that the seal features a vibrant, authoritative **Royal Indigo Blue (`#1E3A8A`)** background and displays **`SC 2033`** on the lower foundation ribbon instead of `ESTD 2033`.
- **Visual Reference**: Preserves the exact circular geometry shown in your screenshot:
  - Top arc inscription: `INDIRA GANDHI NATIONAL OPEN UNIV` (with adjusted arc radius/offset so all letters including the leading `I` render cleanly without clipping).
  - Bottom arc inscription: `STUDY CENTRE 2033`
  - Central motif: Three gold stars, open book with red bookmark ribbon, diagonal golden feather quill, and gold laurel leaves.
  - Bottom ribbon plaque: Updated from `ESTD 2033` to **`SC 2033`** with matching Royal Indigo fill (`#1E3A8A`) and gold border.

---

## 2. User Experience & Visual Design

### Color & Typography Specification
- **Outer & Inner Medallion Background Gradient**:
  - Top-left highlight stop (`0%`): `#1E40AF` (Rich Royal Blue)
  - Primary mid-tone stop (`50%`): `#1E3A8A` (Royal Indigo Blue)
  - Deep edge stop (`100%`): `#172554` (Deep Collegiate Indigo)
- **Concentric Ring & Bottom Plaque Fill**: `#1E3A8A`
- **Foundation Ribbon Text**: `SC 2033` (bold gold typography, centered at `x="256" y="400"`, `letter-spacing="3"`).

---

## 3. Technical Architecture & Update Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Circular Institutional Seal SVG                     │
├──────────────────────────────────────────────────────────────────────┤
│  1. Background Gradient:                                             │
│     #0F172A / #0A192F / #020617  ──►  #1E40AF / #1E3A8A / #172554    │
│                                                                      │
│  2. Concentric Ring & Base Ribbon Fill:                              │
│     #0A192F                      ──►  #1E3A8A                        │
│                                                                      │
│  3. Base Foundation Ribbon Text:                                     │
│     "ESTD 2033"                  ──►  "SC 2033"                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Verification Plan
1. Update both the React seal component and the public SVG icon so the browser tab icon, PWA icon, header logo, lock screen, and printable receipts all display the updated **Royal Indigo Blue (`#1E3A8A`)** background and **`SC 2033`** ribbon text.
2. Run TypeScript validation (`lint_applet`) and production build check (`compile_applet`) to ensure zero errors.
