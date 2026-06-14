# Restaurant Management System — High Level Design
**Document type:** High Level Design (HLD)  
**Version:** v1.0  
**Date:** March 2026  
**Status:** Approved

---

# Part 1 — System Overview

## 1.1 What this document covers

This document describes the system architecture of the Restaurant Management System at a high level — how the application is structured, how the major components talk to each other, what data flows where, and what the key design decisions are and why they were made. It does not go into code-level detail (that is in the LLD docs). It is meant to be readable by both a product owner and a senior engineer.

---

## 1.2 System context

```
┌─────────────────────────────────────────────────────────┐
│                    EXTERNAL WORLD                        │
│                                                          │
│   Owner's phone      Manager's laptop/phone             │
│        │                      │                         │
│        └──────────┬───────────┘                         │
│                   │ HTTPS                               │
└───────────────────┼─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│              RESTAURANT MANAGEMENT SYSTEM                │
│                                                          │
│   ┌─────────────┐        ┌──────────────────────────┐   │
│   │  Web App    │◄──────►│      API Server          │   │
│   │  (React)    │  REST  │      (Node.js)            │   │
│   └─────────────┘        └────────────┬─────────────┘   │
│                                       │                  │
│                          ┌────────────▼─────────────┐   │
│                          │      Database            │   │
│                          │    (PostgreSQL)           │   │
│                          └──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

The system is entirely self-contained. There are no third-party integrations in Phase 1. No external APIs are called. No data leaves the system except via manual export.

---

## 1.3 The three-layer architecture

The system is built in three layers. Each layer has one job and talks only to the layer next to it.

**Layer 1 — The Web App (what the user sees)**
A React application running in the browser. It handles all user interaction — forms, buttons, navigation, charts. It never talks directly to the database. All data comes from the API.

**Layer 2 — The API Server (the brain)**
A Node.js server that receives requests from the web app, applies all business rules and permissions, and talks to the database. This layer is where all decisions are made — who is allowed to see what, how salary is calculated, when an entry should be locked.

**Layer 3 — The Database (the memory)**
A PostgreSQL database that stores everything permanently. It enforces data integrity — making sure, for example, that you cannot have two attendance records for the same person on the same day.

---

# Part 2 — The Data Model (High Level)

## 2.1 How data is organised

Everything in the system belongs to a branch. This is the most important structural decision — every record, from a staff member to a daily expense, is tagged to a specific branch. This is what makes multi-branch management possible.

```
BUSINESS
    │
    ├── Branch 1 (Main)
    │       ├── Staff (35 people)
    │       │       ├── Attendance records
    │       │       ├── Salary advances
    │       │       └── Monthly payroll
    │       ├── Daily EOD entries
    │       │       └── Expenses
    │       ├── Menu items
    │       └── Stock items (Phase 2)
    │
    └── Branch 2 (Coming soon)
            ├── Staff (own team)
            ├── Daily EOD entries
            ├── Menu items (can differ from Branch 1)
            └── Stock items
```

## 2.2 The shared expense ledger

One design decision worth calling out at a high level: there is one expense table shared between the EOD entry screen and the vendor management screen. Both screens write to the same place.

```
EOD Screen          Vendor Screen
(quick add)         (full edit)
     │                   │
     └─────────┬─────────┘
               │ writes to
               ▼
       EXPENSE LEDGER
       (one shared table)
               │
               ▼
      Reports & Analytics
```

This means the owner never enters the same expense twice. If a vegetable bill was entered from the vendor screen in the morning, it shows up automatically in the EOD expense list that evening — already recorded, just displayed.

## 2.3 How attendance feeds payroll

Attendance and payroll are tightly linked. The payroll module does not ask the owner to enter days worked — it reads directly from the attendance records.

```
Daily attendance marking
(35 people × 30 days = up to 900 records/month)
               │
               ▼
Monthly payroll calculation
(reads attendance, applies formula, deducts advances)
               │
               ▼
Owner reviews and approves
               │
               ▼
Payroll locked, salary slips generated
```

Once the owner approves payroll, the attendance records for that month are frozen — they cannot be edited without unlocking payroll. This is an intentional safeguard.

---

# Part 3 — User Experience Flow

## 3.1 The owner's typical day

```
MORNING
  Opens app → Dashboard
  Sees: yesterday's income, both branches
  Sees: today's attendance (not yet marked — alert shown)
  Taps: "Go to attendance" quick action

  Opens attendance → taps "Mark all present"
  Taps 2 exceptions (1 absent, 1 half-day)
  Returns to dashboard — attendance alert gone

DURING THE DAY
  App stays in background
  No required action during service

EVENING (after closing)
  Opens app → Dashboard shows "EOD not filled" alert
  Taps: "Fill EOD entry"

  EOD screen: enters dine-in cash, dine-in UPI, takeaway cash, takeaway UPI
  Taps expense categories: Raw materials, Gas
  Enters amounts
  Optional: notes field for anything unusual
  Taps Save

  Dashboard updates: today's net is now visible
  Entry auto-locks after 24 hours

END OF MONTH
  Payroll due alert appears on dashboard
  Owner taps "Review payroll"
  Sees table of all 35 staff with calculated salaries
  Reviews, adjusts 2 entries manually
  Taps "Approve all"
  Payroll locked, salary slips available for download
```

## 3.2 The branch manager's typical day

```
MORNING
  Opens app → Branch dashboard (their branch only)
  Marks attendance: all present → tap 3 exceptions

DURING THE DAY
  Can update menu availability if items run out
  Can record any advances given to staff
  Can check stock levels (Phase 2)

EVENING
  Fills EOD entry for the branch
  Records any vendor bills received today (Phase 2)

END OF MONTH
  Can view payroll draft (read only)
  Cannot approve — owner must do this
```

---

# Part 4 — Key Design Decisions

## 4.1 Why multi-branch is built from day one

The second branch is not open yet. It would be faster to build a single-branch system now and add multi-branch support later.

We chose not to do this because adding multi-branch support to an existing system with real data is one of the most disruptive structural changes possible. Every table needs a new column. Every query needs a new filter. Every permission check needs to be rewritten. Done with 2 years of live data, this is a dangerous migration.

Done from day one, it costs an extra 2 weeks of development and saves a future rewrite.

---

## 4.2 Why POS is Phase 4

POS and billing sits directly in the path of money flowing into the business. A bug in POS means incorrect bills, lost revenue, or customer complaints during service.

The earlier phases — EOD entry, attendance, payroll — are management tools used after the fact. A mistake in EOD entry affects a report. A mistake in POS affects a customer in real time.

By Phase 4 (month 18–24), the owner will have tested and trusted the system for 18 months. He will understand how it works. The team will have caught and fixed bugs in lower-stakes modules. The risk of deploying POS is far lower at that point than it is at month 1.

---

## 4.3 Why EOD is manual (not automatic from POS)

The decision to use manual EOD income entry in Phase 1 is deliberate, not a limitation.

Manual entry requires the owner or manager to consciously engage with the day's numbers every evening. This daily engagement is what builds the habit of using the system. If income were automatically populated, there would be no daily touchpoint, and the system would be used only when something goes wrong.

By the time POS auto-fills the EOD entry in Phase 4, the habit is already established. The transition is seamless.

---

## 4.4 Why there is no staff-facing portal

A staff portal would allow employees to check their own attendance, apply for leave, and view their salary slips. This sounds useful.

The reality is that it adds significant complexity — staff logins, notification systems, a mobile-optimised staff UI, a leave approval workflow — for marginal benefit in a context where the owner is physically present and relationships are personal, not corporate.

The system is designed for the owner's problems, not for a general HR solution. Staff queries are handled face-to-face, as they are today. Salary slips are printed or sent via WhatsApp by the manager. This is not a limitation — it is a deliberate scope decision that keeps the system focused and fast to build.

---

## 4.5 Why data is never permanently deleted

In a business context, hard-deleted records are a liability. If a staff member who was deleted six months ago comes back and disputes a past salary, there is no record. If an expense that was deleted by mistake affects a monthly P&L, there is no recovery.

Every deletion in this system is a soft delete — the record is hidden from normal views but preserved in the database. The owner can always recover data or investigate history.

This also enables a complete audit trail. At any point, the owner can see: who added this record, who changed it, and when.

---

# Part 5 — Security Model

## 5.1 Who can see what

The security model is based on three principles:
1. You can only see your branch's data (unless you are the owner)
2. You can only do what your role permits
3. Everything you do is logged

```
ACTION                          OWNER    BRANCH MGR
─────────────────────────────────────────────────────
View own branch data             ✓           ✓
View other branch data           ✓           ✗
View consolidated (all branches) ✓           ✗
Mark attendance                  ✓           ✓
Fill EOD entry                   ✓           ✓
Add expenses                     ✓           ✓
Edit / delete expenses           ✓           ✓
Approve payroll                  ✓           ✗
Unlock locked EOD entries        ✓           ✗
Export data                      ✓           ✗
Delete any record (soft)         ✓           ✗
Manage staff profiles            ✓           ✓
Manage menu                      ✓           ✓
```

## 5.2 The audit trail

Every action that changes data is recorded in a permanent audit log:
- Who did it (user name and ID)
- What they changed (which record, which table)
- What it was before and after the change
- When it happened

This log cannot be edited or deleted by anyone, including the owner. It exists purely as an evidence trail.

In Phase 1, there is no UI for the audit log — it runs silently in the background. If there is ever a dispute about who changed a salary figure or deleted an expense, the answer is in the audit log.

---

# Part 6 — The Rollout Architecture

## 6.1 How the system is introduced to the business

The system is introduced in four phases over 24 months. Each phase has a clear before/after for the business, not just a list of features shipped.

### Phase 1 — The foundation (Months 0–6)
**What gets replaced:** The attendance register, the salary notebook, the mental tally of daily income, and the scattered expense notes.
**What the business gains:** A daily record of income, a monthly payroll with paper trail, and attendance history for all staff.
**Adoption risk:** Medium. The owner and (future) manager need to form two daily habits — morning attendance and evening EOD entry. This is the hardest phase behaviourally.

### Phase 2 — Supply chain (Months 6–12)
**What gets replaced:** Mental stock awareness and loose vendor bills.
**What the business gains:** Early warning on stock shortages, complete purchase history per supplier.
**Adoption risk:** Low. Built on top of established Phase 1 habits. Vendor bill entry is a natural extension of expense tracking.

### Phase 3 — Insight (Months 12–18)
**What gets replaced:** End-of-year accountant surprises and gut-feel decision making.
**What the business gains:** 12 months of trend data, monthly P&L, cross-branch comparison, salary analytics.
**Adoption risk:** Very low. No new data entry required — this phase reads the data that Phase 1 and 2 collected. The owner just gains new visibility.

### Phase 4 — Operations (Months 18–24)
**What gets replaced:** Handwritten bills and manual end-of-day cash tallying.
**What the business gains:** Real-time order management, itemised receipts, automatic income entry.
**Adoption risk:** High. POS changes how every customer-facing transaction happens. Requires staff training (for the cashier role) even though staff don't use the app for management. This risk is why it is Phase 4 and not Phase 1.

---

# Part 7 — How the Two AI Tools Collaborate

This system is being built using two AI tools working in different roles:

**Claude (this tool) — product thinking and architecture**
Used for planning, requirements, design decisions, schema review, and keeping the product vision consistent. When something needs to be thought through — "what happens to advances if payroll is regenerated?", "how should the branch scope work for consolidated reports?" — Claude is the right tool.

**Gemini (Google AI Studio / Cursor) — code generation**
Used for writing actual code — API routes, React components, database queries, migrations. Works best when given precise, bounded tasks with a complete context document. Does not make architecture decisions.

**The documentation system is the bridge between them.**
Every decision made with Claude lives in a numbered markdown doc. Every session with Gemini starts with the relevant docs as context. When Gemini changes something, the affected doc is updated and brought back to Claude. Both tools always work from the same source of truth.

```
BRAINSTORM / PLAN          BUILD                    REVIEW
─────────────────          ──────────────────       ────────────────
Claude                     Gemini                   Claude
  │                           │                        │
  ├─ Requirements              ├─ Scaffold project      ├─ Review output
  ├─ Schema design             ├─ Write API routes      ├─ Catch errors
  ├─ Module planning           ├─ Build components      ├─ Update docs
  └─ Write docs ──────────────►└─ Use docs as context   └─ Sync docs
```

---

*End of High Level Design Document*  
*Related documents: PRODUCT-REQUIREMENTS-DOCUMENT.md, ../Technical/DOC-01 through DOC-14 (LLD)*
