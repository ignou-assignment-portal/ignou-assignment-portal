# Remove Redundant Helpline Box from Contact & Location Section

Remove the duplicate "Official Study Centre Helpline & Inquiries" block from the Contact & Location section in `StudyCentreHomePage.tsx` so that contact details are cleanly centralized in the newly implemented Officials & Administrative Staff directory.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decision has been confirmed:
>
> - **Confirmed Action**: Completely remove the redundant "Official Study Centre Helpline & Inquiries" box (containing Head of Centre, Centre Helpline, and Official Email) from lines 1187–1207 of `src/components/StudyCentreHomePage.tsx`.
> - **Rationale**: The newly added **Study Centre Officials & Staff** directory already features the Co-ordinator (**Dr. Sant Kumar Gupta**, M: 9436013686) along with the Asst Co-ordinator, Clerical Assistants, and Support Staff, making the older helpline card duplicate and cluttering.

---

### 1. Overview & Core Concept

- **Target Component**: `src/components/StudyCentreHomePage.tsx`
- **Section**: `#contact-location` (Contact & Location)
- **Changes**:
  - Delete the 3-column card block titled `"Official Study Centre Helpline & Inquiries"`.
  - Let the **Study Centre Officials & Staff Directory** flow seamlessly below the **Physical Location** and **Desk Operating Timings** cards.
  - Retain the official email address if desired in the footer or let the direct phone numbers in the Officials directory serve as the direct contact points.

---

### 2. User Experience & Visual Design

#### Layout After Removal:
```text
┌────────────────────────────────────────────────────────────────────────┐
│  REACH STUDY CENTRE SC-2033                                            │
│                                                                        │
│  ┌──────────────────────────────┐  ┌────────────────────────────────┐  │
│  │ [Desk Location]              │  │ [Desk Operating Timings]       │  │
│  │ IGNOU Study Centre 2033      │  │ Fri & Sat: 2:00 PM to 4:00 PM  │  │
│  │ S.D. Jain Girls' College     │  │ (Except Holidays)              │  │
│  │ Dimapur, Nagaland - 797112   │  │ Other Days: Closed             │  │
│  └──────────────────────────────┘  └────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ STUDY CENTRE OFFICIALS & STAFF (SC-2033 Administration)          │  │
│  │                                                                  │  │
│  │ [Co-ordinator]                   [Asst Co-ordinator]             │  │
│  │ Dr. Sant Kumar Gupta             Shri Raju Deb                   │  │
│  │ M: 9436013686                    M: 9856827642, 8787768196       │  │
│  │                                                                  │  │
│  │ [Clerical Assistants]                                            │  │
│  │ • Shri Binay Shankar Singh (M: 8787500493)                       │  │
│  │ • Ms Ariale (M: 8974460993)                                      │  │
│  │                                                                  │  │
│  │ [Peons]                                                          │  │
│  │ • Shri Shambu Gautam  • Smti Parmila Mahato  • Smti Bimala Gautam│  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Technical Implementation Steps

#### Step 1: Edit `src/components/StudyCentreHomePage.tsx`
- Remove lines 1187–1207 containing the `"Official Study Centre Helpline & Inquiries"` card.
- Adjust spacing of the Officials directory container to connect cleanly below the Location & Timings cards.

#### Step 2: Verification & Build Validation
- Run `compile_applet` and `lint_applet` to confirm zero syntax or TypeScript errors.
- Confirm that the Contact & Location layout renders cleanly without layout shifts or orphaned elements.

---

### 4. Verification Scenarios

1. Navigate to the Home Page (`/` or click "Centre Home" in the top bar).
2. Scroll down to `#contact-location`.
3. Confirm the "Official Study Centre Helpline & Inquiries" box is gone.
4. Confirm the "Desk Location", "Desk Operating Timings", and the full "Study Centre Officials & Staff" directory remain displayed.
