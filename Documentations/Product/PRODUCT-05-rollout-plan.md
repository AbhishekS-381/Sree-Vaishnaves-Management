# Restaurant Management App — Rollout & Adoption Plan
**Document type:** Product · High Level  
**Audience:** Product owner, developer  
**Version:** v1.0 | Last updated: 2026-03-15

---

## The real challenge

Building the app is the easier half of this project. The harder half is **getting a busy restaurant owner to change a habit that has worked for 20+ years.**

The owner is not opposed to change — he trusts the developer (his son/daughter). But he will not adopt a system that:
- Slows him down at a busy moment
- Requires him to learn too much at once
- Feels unreliable or loses his data
- Makes him dependent on something he doesn't understand

This plan is designed around those constraints.

---

## The adoption strategy: earn trust, one module at a time

Do not launch all features at once. Each phase should feel like a small, natural step — not a system overhaul.

The sequence is designed so that each new module builds on habits already formed in the previous one.

---

## Phase 1 rollout — months 1 to 6

### Month 1: Staff profiles only
**Goal:** Get all staff entered into the system. No new daily habits yet.

The developer enters all 35 staff members themselves during initial setup. The owner just reviews and confirms the list. This is a zero-effort first interaction — the owner opens the app, sees his team listed correctly, and feels the system is already useful.

No attendance marking. No EOD entry. Just: "Your staff are in the system."

**Success signal:** Owner can look up any staff member's salary or role from his phone in 5 seconds.

---

### Month 2: Attendance marking
**Goal:** Replace the physical register with the app — one new 60-second habit every morning.

The developer demonstrates the "mark all present + tap exceptions" flow on the owner's phone. It takes 60 seconds. The owner immediately sees it is faster than the register.

For the first two weeks, the developer checks daily whether attendance was marked and messages gently if it wasn't. After two weeks, it should be a habit.

Keep the physical register running in parallel for one month — this gives the owner confidence that if the app fails, nothing is lost.

**Success signal:** Attendance is marked in the app every day for 3 consecutive weeks without a reminder.

---

### Month 3: EOD entry
**Goal:** Replace the cash book with a 2-minute evening entry.

Only after attendance is a stable habit. The EOD entry is introduced as "it's just like your cash book, but on your phone."

The developer fills in the first 3 entries alongside the owner so he can see how it works. After that, the owner does it himself with the developer available by phone.

Critically: the app should show the owner something **immediately useful** from his first week of EOD entries — a simple week's total, a note about which day was best. This makes the data feel rewarding to enter.

**Success signal:** EOD entry filled every day for 3 consecutive weeks. Owner mentions an insight from the data unprompted ("this Tuesday was much better than last Tuesday").

---

### Month 4: Payroll
**Goal:** Replace manual salary calculation with one approval session.

By month 4, the system has 3 months of attendance data and is ready to generate a full payroll. The developer sits with the owner for the first payroll cycle, walks through the generated numbers, and shows how the formula maps to what the owner would have calculated manually.

The numbers should match. If they do, trust is established. If there is a discrepancy, investigate it together — the audit trail will show exactly where the difference came from.

**Success signal:** Owner approves payroll using the app and feels the numbers are correct.

---

### Month 5–6: Refinement
Use these months to:
- Fix any friction points the owner or manager are experiencing
- Fine-tune the payroll formula if the owner calculates differently for certain staff categories
- Ensure Branch 2 setup is ready for when the second branch opens
- Build the Dashboard into a daily-open habit

By month 6, the system should be running smoothly for staff, attendance, payroll, and EOD. The owner should be checking the dashboard as a morning habit.

---

## Phase 2 rollout — months 7 to 12

By the time Phase 2 starts, the owner is comfortable with the app and trusts the data. Introducing inventory and vendor management is much easier because:
- He already enters expenses via EOD — vendor bills are just the same thing with more detail
- He already sees expense totals — inventory helps explain where those costs are going

Introduce inventory for the top 5–10 most important items first. Don't try to track everything at once.

---

## Phase 3 rollout — months 13 to 18

Reports are the payoff. By this point there is 12+ months of clean data. The first time the owner sees a monthly P&L chart that actually matches his experience of the business — "yes, October was our best month, and I can see why" — the system becomes irreplaceable.

This is also when the monthly PDF export becomes part of the routine with the accountant.

---

## Phase 4 rollout — months 19 to 24

POS is the highest-stakes change — it touches the actual billing process during service. This must be piloted on slow days first, run in parallel with the existing billing method for at least 4 weeks, and only cut over fully when the staff are comfortable.

The fact that the system has been running reliably for 18+ months by this point is what makes this transition possible without resistance.

---

## Managing the manager

When the branch manager is appointed (likely in months 2–4), they need to be onboarded into the app. Their scope is narrower than the owner's — they primarily use attendance and EOD entry.

Onboarding checklist for a new branch manager:
1. Create their user account with branch_manager role and correct branch assignment
2. 30-minute walkthrough of attendance screen
3. 30-minute walkthrough of EOD entry screen
4. Two supervised days where developer or owner reviews their entries
5. One week of independent operation with developer available for questions

The manager does not need to understand the payroll, reports, or multi-branch features. Keep their training focused on the two screens they use daily.

---

## What to do when things go wrong

### Owner forgets to fill EOD for a day
The system shows an alert but does not block anything. The developer should check in the following morning. After 48 hours, the entry is technically possible to back-fill but will be locked if done 24+ hours late — the owner can unlock it. The key is to handle the first few missed entries generously, without making the owner feel like the system is punishing him.

### Owner questions a payroll number
This is actually a good sign — it means he is engaging with the data. Walk through the calculation together using the attendance records. If he finds an error in the data, fix it and regenerate. If the formula is calculating correctly but the owner expected a different result, understand why — it may reveal that the formula needs adjustment.

### App is slow or unavailable
If there is a technical issue, the owner should still be able to fill in the EOD entry — it will save as a draft and sync when the app is back. The attendance can be filled in the physical register as backup and entered later. The system should never be a single point of failure for the restaurant's daily operations.

---

## Definition of success at handover (month 24)

When the new owner takes over, the following should be true:

1. **24 months of clean daily data** — every day's income, expenses, and attendance is on record
2. **Full payroll history** — every staff member's salary for every month is documented
3. **The owner is already the primary user** — the system is not new; it has been in daily use for 2 years
4. **The processes are habitual** — the manager marks attendance every morning and fills EOD every evening without being asked
5. **The business is legible** — anyone opening the reports screen can understand the financial health of the business without asking the previous owner to explain it
6. **The system is trustworthy** — there have been enough months of the system producing correct payroll numbers and matching cash book entries that no one questions the data
