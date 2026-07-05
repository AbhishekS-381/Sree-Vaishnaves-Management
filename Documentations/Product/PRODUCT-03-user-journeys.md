# Restaurant Management App — User Journeys
**Document type:** Product · High Level  
**Audience:** Product owner, UX designers, developers  
**Version:** v1.0 | Last updated: 2026-03-15

---

## What this document is

This document describes how the app is actually used — not features in isolation, but real scenarios from real days. These journeys define what "success" looks like from the user's perspective.

---

## Journey 1: The owner's morning routine

**Who:** Owner  
**When:** 8am, opening time, at Branch 1  
**Goal:** Know the state of the business before the day starts

---

The owner unlocks his phone and opens the app. The dashboard loads.

He sees two branch cards side by side. Branch 1 — yesterday's income was ₹28,500. EOD filled. 33 of 35 staff were present. Branch 2 — yesterday's income was ₹31,200. One alert: "Attendance not marked yet for today."

He taps the Branch 2 alert. It takes him directly to today's attendance screen for Branch 2. He calls the Branch 2 manager, who opens the app and marks attendance while on the call.

The owner goes back to the dashboard. Both branches show green. He notes that Branch 2 is consistently outperforming Branch 1 on Sundays — something to think about.

**What the system enabled:** In 3 minutes, the owner got a cross-branch status update that previously required two phone calls and still left him with incomplete information.

---

## Journey 2: Morning attendance — branch manager

**Who:** Branch manager  
**When:** 9am, all staff have arrived  
**Goal:** Mark today's attendance quickly before the lunch rush

---

The manager opens the app and goes to attendance. Today's date is shown. He sees "35 staff — 0 marked."

He taps "Mark all present." In one tap, all 35 staff are marked present. The screen now shows "35 of 35 present."

He scans the list. Ravi called in sick today. The manager taps Ravi's row and changes his status to "Absent." The count updates: "34 present · 1 absent."

Selvi is leaving at 1pm for a doctor's appointment. The manager marks her as "Half day."

Final: 33 present, 1 half-day, 1 absent. Takes 45 seconds total.

The manager closes the app and gets on with the day.

**What the system enabled:** What previously required writing in a register, counting entries, and recounting at month end is now a 45-second tap through on a phone.

---

## Journey 3: Evening EOD entry

**Who:** Branch manager  
**When:** 10:30pm, restaurant closed, manager wrapping up  
**Goal:** Log today's income and expenses before going home

---

The manager opens the EOD entry for today. The date is pre-filled. The form is clean — three sections: income, expenses, notes.

He fills in income from the cash counter and the UPI summary on the payment device:
- Dine-in cash: ₹9,500
- Dine-in UPI: ₹14,000
- Takeaway cash: ₹3,200
- Takeaway UPI: ₹5,800

Running total shows ₹32,500 income.

He taps "Raw materials" in the expense tags. A row appears. He types ₹5,200. He taps "Gas / fuel" and types ₹800. He taps "Miscellaneous" and types ₹400.

Total expenses: ₹6,400. Net for today: ₹26,100.

He adds a note: "Very busy Sunday. Ran out of fish curry by 1pm."

He taps "Save." Done.

The entry is saved. The draft that was auto-saved to his phone during entry is cleared. The dashboard for the owner now shows Branch 1's updated figures.

**What the system enabled:** A clean, searchable daily record in under 2 minutes. That same record will appear in the month's P&L, in the year's trend charts, and in the branch comparison when the owner reviews performance.

---

## Journey 4: Month-end payroll — owner

**Who:** Owner  
**When:** 28th of the month, 3 days before month end  
**Goal:** Calculate and approve March salaries for Branch 1

---

A reminder banner appears on the dashboard: "Payroll for Branch 1 — March 2026 has not been approved. 3 days remaining."

The owner taps it. He's taken to the payroll screen for Branch 1, March 2026.

He taps "Generate payroll." The system calculates every salary based on March attendance records. A table appears — all 35 staff listed with their:
- Monthly salary
- Days present / half days / absent
- Advances taken this month
- Calculated net payable

The owner scans the list. He notices Murugan's calculated salary is ₹15,308. He remembers he promised Murugan a ₹500 bonus for handling an extra shift last week. He taps Murugan's row and overrides the amount to ₹15,808, adding a note: "₹500 bonus — extra shift on 22 March."

He scrolls to the bottom. Total payout: ₹3,08,500 across 35 staff.

He taps "Approve all." A confirmation appears: "This will lock March payroll and mark all advances as deducted. Confirm?" He confirms.

The payroll is locked. Each staff member's salary slip is now available as a PDF. The advances taken this month are marked as deducted — they won't appear in April's calculation.

**What the system enabled:** What previously took 2–3 hours of manual calculation, subject to arithmetic errors and disputes, now takes 15 minutes of review and one approval tap. The trail of every decision is preserved.

---

## Journey 5: Owner reviews performance at month end

**Who:** Owner  
**When:** 1st of April, reviewing March  
**Goal:** Understand how March performed and whether the business is growing

---

The owner opens the Reports section. He selects "Monthly report — March 2026."

He sees the summary:
- Total income: ₹5,71,000 (Branch 1: ₹2,68,000 · Branch 2: ₹3,03,000)
- Total expenses: ₹2,55,000
- Payroll cost: ₹3,08,500
- Net profit: ₹7,500

He taps "vs February." The comparison loads:
- Income up ₹61,000 (+12%)
- Expenses up ₹8,000 (+3%)
- Net profit up ₹53,000

Good month.

He scrolls to expense breakdown. Raw materials are 38% of revenue — slightly high. He notes this to discuss with the head cook.

He taps "Salary analytics." Payroll is 54% of revenue this month — it was 52% last month. He makes a note to monitor this.

He downloads the monthly PDF. He'll send it to his accountant later.

**What the system enabled:** The owner made three data-driven business observations in under 5 minutes — something that was previously impossible without hours of manual aggregation. This is the compounding value of 3+ months of consistent data entry.

---

## Journey 6: A staff member disputes their salary

**Who:** Owner + staff member (Ravi)  
**When:** Salary day, Ravi believes he was marked absent incorrectly  
**Goal:** Resolve the dispute fairly and quickly

---

Ravi approaches the owner: "Anna, I was present on the 14th but my salary is deducted."

Previously: the owner would look in the register, try to remember, ask the manager who may or may not remember, and likely guess.

Now: the owner opens the app, goes to Ravi's staff profile, taps "Attendance history — March 2026." The 14th shows "Absent." He taps the entry — it was marked by the branch manager at 9:15am on 14 March.

The owner calls the manager. The manager confirms he misread the register that day — Ravi was present. The owner goes to the attendance record for 14 March, changes Ravi's status to "Present," and regenerates payroll. The corrected amount is ₹11,000 instead of ₹10,577.

The owner approves the correction. Ravi is paid the correct amount.

**What the system enabled:** A fair, evidence-based resolution in under 5 minutes. Both the owner and staff member can see the record. There is no room for "I said, you said." The system builds trust between management and staff.

---

## Journey 7: Owner checks up while travelling

**Who:** Owner  
**When:** 3pm, owner is at a supplier meeting, away from both branches  
**Goal:** Quickly check if everything is running normally at both branches

---

The owner has 2 minutes between meetings. He opens the app.

Dashboard shows:
- Branch 1: ₹14,200 income so far today (good for a Tuesday). Attendance marked. No alerts.
- Branch 2: ₹16,800 income so far. Attendance marked. One alert: "Low stock — Tomatoes (2 kg remaining)."

He messages the Branch 2 manager on WhatsApp: "Order tomatoes before evening."

He closes the app and goes back to his meeting.

**What the system enabled:** Remote visibility in 30 seconds. The owner's physical absence from the branches no longer means operational blind spots.
