# Restaurant Management System — Product Requirements Document
**Document type:** Product Requirements Document (PRD)  
**Version:** v1.0  
**Date:** March 2026  
**Author:** Product Owner  
**Status:** Approved for development

---

# Part 1 — The Problem

## 1.1 What is happening today

A restaurant with 35 employees and two service types (dine-in and takeaway) is being run almost entirely on manual processes. Every critical business function — from knowing how much money was made today, to calculating whether a cook's salary was correctly paid, to understanding if the business is profitable — depends on handwritten records, mental arithmetic, and a business owner who holds everything in his head.

This works. Until it doesn't.

The owner is preparing to hand over management to a new branch manager, open a second branch, and eventually pass the business to a family member with a software engineering background. None of these transitions can happen smoothly if the entire business knowledge lives in one person's memory and a few notebooks.

---

## 1.2 The real problems being solved

### Problem 1 — There is no reliable record of daily income
Every evening, the owner roughly tallies the day's earnings. There is no split between dine-in and takeaway. There is no record of how much came in as cash versus UPI transfer. If someone asks "how did last Tuesday compare to the Tuesday before?", there is no answer. If the owner is unwell and absent, nobody knows whether it was a good day or a bad day.

**What this causes:** No ability to spot trends. No way to identify a bad week early. No data to make pricing decisions. No record for the accountant.

---

### Problem 2 — Salary calculation is error-prone and trust-eroding
The owner calculates 35 salaries by hand every month. He tracks attendance in a register, adds up working days, mentally subtracts any advances given, and arrives at a number. Staff sometimes dispute the calculation. The owner sometimes miscounts. Advances given mid-month are easy to forget. There is no paper trail showing how a salary figure was arrived at.

**What this causes:** Staff distrust. Owner stress. Errors that cost money and relationships. No ability to delegate payroll to a manager.

---

### Problem 3 — Expenses are invisible until it's too late
Daily purchases — vegetables from the market, gas cylinder refills, maintenance costs — are either remembered or forgotten. At the end of the month, the owner has a rough sense of what was spent but no category-wise breakdown. He cannot tell if the raw material cost this month was higher than last month, or whether the electricity bill has been creeping up.

**What this causes:** Inability to identify cost leakage. No data to negotiate better prices with suppliers. No understanding of which expense category is squeezing margins.

---

### Problem 4 — Scaling to a second branch is currently impossible
The owner is one person managing one location with 35 staff. When a second branch opens, he will need to trust a branch manager to run operations day-to-day. But there is currently no system that allows him to oversee both branches simultaneously, compare their performance, or verify what is happening at Branch 2 when he is at Branch 1.

**What this causes:** The owner either micromanages both locations (unsustainable) or operates blind (risky). A second branch without a management system is a liability, not a growth move.

---

### Problem 5 — The business cannot be handed over
When the owner's family member takes over in 2 years, there are no systems to inherit — only habits and muscle memory. A business that runs on one person's knowledge is fragile. The new operator would need to rebuild understanding from scratch.

**What this causes:** High risk during the transition. No baseline data for the new owner to make decisions from. Dependence on the previous owner staying involved longer than needed.

---

## 1.3 What success looks like

Two years from now, the owner opens the app on his phone each morning and sees — without asking anyone — exactly how both branches performed yesterday, whether all staff came in, whether payroll is on track, and whether the business made more or less money than last month.

When his family member takes over, every piece of business data from the past two years is available, searchable, and exportable. The transition is a handover of a login, not a transfer of knowledge.

---

# Part 2 — The Product

## 2.1 What this application is

**Restaurant Management System (RMS)** is a private web application for the owner and branch manager of a restaurant business. It is the single place where daily operations are recorded, salaries are calculated, and business performance is tracked.

It is not a customer-facing app. It is not a food ordering system. It is not accounting software. It is a management tool — designed specifically for how this restaurant business actually works, not how a generic restaurant "should" work.

---

## 2.2 Who uses it

There are two types of users:

**The Owner**
Accesses the app on his phone, primarily in the morning and late evening. He wants to see the big picture fast — how both branches are doing, whether anything needs his attention today, whether this month is trending better or worse than last month. He approves salaries. He is the only person who can unlock or delete anything.

**The Branch Manager**
Accesses the app to handle daily operations — marking who came to work, filling in the day's income and expenses, managing the menu, tracking stock. They see only their branch. They cannot approve salaries or access the other branch's data.

Nobody else uses the app. Staff do not have logins. Customers have no access. The accountant gets a PDF export once a month.

---

## 2.3 How the app is structured

The app is organised into modules. Each module solves one specific management problem. They are built in phases — the most urgent problems first, the more complex ones later as the owner and his team get comfortable with the system.

The modules are:

| Module | Problem it solves | Phase |
|--------|------------------|-------|
| Staff & Payroll | Salary errors, missing advance records, no payslips | 1 |
| Daily EOD Entry | No daily income record, no cash/UPI split | 1 |
| Expense Ledger | Invisible daily expenses, no category tracking | 1 |
| Attendance | Manual register, no audit trail | 1 |
| Menu Management | No single source of truth for items and prices | 1 |
| Dashboard | Owner has no at-a-glance view of the business | 1 |
| Inventory & Stock | No visibility into raw material levels | 2 |
| Vendor Management | Supplier bills not tracked, no PO history | 2 |
| Reports & Analytics | No trend data, no monthly P&L | 3 |
| POS & Billing | Real-time order and receipt management | 4 |

---

# Part 3 — Module Descriptions

## Module 1 — Staff & Payroll

### The problem it solves
Every month, 35 salaries are calculated by hand. There is no record of how a number was arrived at. Advances given during the month are tracked mentally or in a notebook and sometimes forgotten. Staff receive no payslip — just a cash or transfer with a number. When a staff member questions their salary, there is no paper trail to refer to.

### What the module does
This module is the complete record of every person who works at the restaurant. It knows their name, their role, their monthly salary, and which branch they work at. Every day their attendance is marked in this system. Every advance given to them mid-month is recorded here. At the end of the month, the system calculates each person's salary automatically — counting how many days they worked, applying half-day weightage, subtracting all advances — and presents the owner with a table of all 35 salaries for review.

The owner reviews the table, can override any individual amount if needed, and approves the entire month's payroll with one action. After approval, the records are locked. Each staff member's salary slip can be printed or saved as a PDF.

### What changes for the owner
Before: mental arithmetic, notebook, trust issues, re-explaining calculations.
After: tap approve, print slip, done. Any dispute is resolved by showing the slip.

### What changes for the manager
Before: could not calculate or verify salaries — had to ask the owner.
After: can see attendance records and salary drafts, flag anything that looks wrong before the owner approves.

---

## Module 2 — Attendance

### The problem it solves
Attendance is currently marked in a physical register. At the end of the month, the owner counts entries manually to calculate working days per staff member. There is no record of who marked attendance, when, or whether it was edited. With 35 staff members across multiple departments, the register is cluttered and error-prone.

### What the module does
Each morning, the manager or owner opens the attendance screen. Instead of tapping 35 individual entries, they tap "Mark all present" — the system marks every active staff member as present in one action. Then they tap only the exceptions: who is absent, who came for half a day, who is on leave.

If the restaurant is closed for a festival, the owner marks the day as a holiday. Every staff member is automatically marked as holiday — this day is not counted against them in salary calculation.

At the end of the month, the attendance data feeds directly into payroll. No manual counting. No re-entry.

### What changes for the owner
Before: physical register, manual counting at month end, disputes with no trail.
After: 2-minute daily task, automatic payroll feed, full history per staff member.

---

## Module 3 — Daily EOD Entry

### The problem it solves
Today's income is unknown unless the owner physically tallies the cash drawer and checks the UPI statement. There is no daily record. There is no split between what came from dine-in versus takeaway. There is no tracking of whether today's expenses were high or low. By the time the month ends, the owner's sense of profitability is based on feeling, not data.

### What the module does
Every evening after closing, the owner or manager fills in the day's entry. It takes less than 2 minutes. They enter four numbers: dine-in cash, dine-in UPI, takeaway cash, takeaway UPI. The system adds it up. They then tap the expense categories for the day — raw materials, gas, electricity, whatever applied — and enter the amounts. The system shows the net for the day: total income minus total expenses.

There is also an optional petty cash section for owners who maintain a daily cash float, to verify the physical drawer matches the recorded amount.

The entry is saved. The day is recorded. A month of these entries becomes the foundation for every report in Phase 3.

### What changes for the owner
Before: end of month surprise when the accountant totals everything.
After: knows by 10pm every night whether today was profitable, and by how much.

---

## Module 4 — Expense Ledger

### The problem it solves
Expenses happen throughout the day — vegetable purchase in the morning, gas refill in the afternoon, small maintenance in the evening. Some are entered in the EOD screen at night. Some are entered when a vendor bill arrives. Currently, there is no single place where all expenses live. Some are forgotten. None are categorised.

### What the module does
Every expense — regardless of where or when it was entered — lives in one shared ledger. The EOD screen is the quick lane: the owner taps a category and enters an amount at the end of the day. The vendor management screen (Phase 2) is the full lane: supplier name, invoice reference, exact date, and full editing capability.

If a vendor bill was already entered earlier in the day from the vendor screen, it automatically appears in the EOD expense list tonight. The owner doesn't enter it twice. The system shows it, clearly labelled as "already recorded."

Over time, this ledger becomes the complete expense history of the restaurant — searchable, filterable by category, and ready for monthly reporting.

### What changes for the owner
Before: scattered notes, forgotten expenses, no category breakdown.
After: one place, always complete, ready to answer "how much did we spend on raw materials this month?"

---

## Module 5 — Menu Management

### The problem it solves
There is no single document that lists all menu items, their categories, and their current prices. When prices change, different people may know different prices. When an item is temporarily unavailable, the information is passed verbally. When a second branch opens with a slightly different menu, there is no clean way to manage the differences.

### What the module does
Each branch has its own menu. The owner or manager can add items, set prices, organise them by category (breakfast, lunch, dinner, beverages, specials), and toggle any item as unavailable when it runs out. The menu is the reference point for the POS system in Phase 4 — so getting it set up now means Phase 4 has clean data to work from.

### What changes for the owner
Before: verbal communication of prices, no record of availability.
After: single source of truth, per branch, always current.

---

## Module 6 — Dashboard

### The problem it solves
The owner has no at-a-glance view of his business. To understand how things are going, he has to physically call the branch, check the cash drawer, or ask the manager. There is no morning briefing. There is no way to compare both branches simultaneously.

### What the module does
The dashboard is the first screen the owner sees when he opens the app. It shows — for each branch — today's income so far, today's attendance headcount, and any actions that need his attention (payroll due, EOD not filled, attendance not marked).

The owner sees both branches side by side. Below the branch cards is a combined total — total income across both branches today, total net profit this month, and how this month compares to last month.

The branch manager sees only their branch, in more detail — a full breakdown of income, a list of today's attendance exceptions, and any pending tasks.

The dashboard does not require any action to stay useful — it is updated automatically as data comes in throughout the day.

### What changes for the owner
Before: calls the branch to find out what's happening.
After: opens the app and knows in 10 seconds.

---

## Module 7 — Inventory & Stock *(Phase 2)*

### The problem it solves
Raw material shortages cause menu unavailability. Currently, the owner or kitchen head notices a shortage only when an ingredient is physically running out. There is no early warning system. There is no record of consumption patterns that would help predict when to reorder.

### What the module does
Each branch maintains a list of stock items — rice, oil, vegetables, gas cylinders, packaging — with current quantity and a low-stock threshold. When stock is received (after a purchase), the manager updates the quantity. When daily usage is logged, the quantity reduces. When any item drops below its threshold, an alert appears on the dashboard.

This is entirely manual in Phase 2 — there is no automatic deduction. The value is awareness and early warning, not automation.

### What changes for the owner
Before: shortage discovered when the kitchen runs out mid-service.
After: alert appears the day before, purchase can be arranged in time.

---

## Module 8 — Vendor & Supplier Management *(Phase 2)*

### The problem it solves
The restaurant buys from multiple suppliers — vegetable vendors, dairy suppliers, gas distributors, packaging vendors. Bills are received physically, noted down somewhere, and sometimes paid late because there is no tracking. There is no history of what was purchased from whom and when.

### What the module does
Each supplier has a profile — name, contact, what they supply. Every purchase bill is recorded against a supplier — amount, date, optional invoice reference. Outstanding (unpaid) bills are tracked with due dates and appear as alerts.

Critically, every vendor-entered expense feeds into the same shared expense ledger that the EOD screen reads from. The owner does not enter the same bill twice — it is one system.

### What changes for the owner
Before: loose bills, forgotten payments, no supplier history.
After: every purchase is on record. Outstanding bills are visible. No supplier disputes without a paper trail.

---

## Module 9 — Reports & Analytics *(Phase 3)*

### The problem it solves
After 12+ months of daily EOD entries, attendance records, and expense logging, the business is sitting on a goldmine of data — but nobody can see it. There are no charts. No trend lines. No answer to "is this month better than last month?" No understanding of which expense category is growing. No way to know whether salary costs are eating too much of revenue.

### What the module does
The reports module turns the accumulated data into answers. The owner can view:

**Financial reports** — daily, weekly, and monthly profit and loss. Income split by dine-in and takeaway, by cash and UPI. Expenses split by category. Net profit trend over time.

**Month-on-month comparison** — this month versus last month for income, expenses, and net profit. Simple percentage change. Answers the most common owner question.

**Salary analytics** — total payroll cost as a percentage of monthly revenue (the single most important health metric for a restaurant). Cost broken down by staff role — how much is the kitchen costing versus the floor versus delivery. Staff members who take advances frequently — a signal worth watching.

**Exportable reports** — a monthly PDF summary the owner can hand to his accountant. CSV exports of any module for further analysis. A full monthly Excel dump with every piece of data.

**Cross-branch comparison** — owner-only view showing both branches side by side. Which branch has better margins? Which one has higher raw material costs? This is the view that makes owning two branches manageable.

### What changes for the owner
Before: gut feeling about profitability, no data for decisions.
After: every business decision is backed by 12+ months of actual data.

---

## Module 10 — POS & Billing *(Phase 4)*

### The problem it solves
Currently, bills are written by hand or calculated mentally. There is no itemised receipt for the customer. The cash drawer total at end of day has to be manually tallied and entered into the EOD screen. There is no record of individual orders.

### What the module does
The POS module replaces manual billing entirely. For dine-in, orders are taken against a table number. For takeaway, orders are created without a table. Items are selected from the menu (already set up in Phase 1). The system generates an itemised bill. Payment type — cash or UPI — is recorded. At end of day, the system automatically populates the EOD income entry with the day's total — the manual income entry step becomes unnecessary.

This is the highest-stakes module and is deliberately deferred to Phase 4. By then, the owner will have 18 months of experience with the system, full trust in the data, and a clear picture of exactly how billing should work for their specific operation.

### What changes for the owner
Before: handwritten bills, manual tally, EOD entry done from memory.
After: every order is recorded, bills are printed or sent digitally, EOD income is auto-filled.

---

# Part 4 — How the Modules Connect

The modules are not independent — they feed each other. This is the most important thing to understand about the system design.

```
Attendance  ──────────────────────────────►  Payroll
(who came, how many days)                   (calculates salary)

EOD Entry   ──────────────────────────────►  Reports
(daily income and expenses)                 (monthly P&L, trends)

Expense Ledger  ──────────────────────────►  Reports
(all expenses in one place)                 (category breakdown)

Menu  ────────────────────────────────────►  POS (Phase 4)
(items and prices)                          (order taking)

Inventory  ───────────────────────────────►  Dashboard alerts
(stock levels)                              (low stock warnings)

Vendor bills  ────────────────────────────►  Expense Ledger
(supplier purchases)                        (shared ledger)

All Phase 1 data  ────────────────────────►  Reports (Phase 3)
(12+ months of records)                     (analytics engine)
```

The sequence matters. Phase 1 builds the data foundation. Phase 2 adds supply chain visibility. Phase 3 turns the foundation into insight. Phase 4 completes the loop by feeding real-time order data back into income tracking.

Each phase is independently useful. The owner does not need to wait for Phase 4 to get value. Phase 1 alone solves the three most painful problems: salary errors, invisible daily income, and untracked expenses.

---

# Part 5 — The Rollout Strategy

## Why phased rollout matters

This system is being introduced to a business that has never used software for management. The owner and the future branch manager need to build habits gradually. If 10 modules are launched at once, none of them will be used properly. Worse, a bad first experience with one module poisons trust in the whole system.

The phased approach deliberately limits what is introduced at each stage to what the business is ready to absorb.

## Phase 1 — Building the daily habit (Months 0–6)

The goal of Phase 1 is not features — it is habit formation. Specifically, two daily habits:
1. Mark attendance every morning
2. Fill the EOD entry every evening

If these two habits are established, Phase 1 has succeeded. Everything else — payroll, reports, analytics — is downstream of consistent daily data entry.

Phase 1 also sets up staff profiles and menu items — one-time setup tasks that create the foundation everything else rests on.

**Success metric for Phase 1:** EOD entry filled at least 25 out of every 30 days. Attendance marked for every working day.

## Phase 2 — Adding supply chain (Months 6–12)

By month 6, the owner has 6 months of income and expense data. He now has a sense of whether the app is reliable and useful. Phase 2 introduces stock tracking and vendor management — both of which require discipline to maintain but pay off in cost visibility.

**Success metric for Phase 2:** Every major purchase bill recorded against a vendor. Low-stock alerts caught before a shortage reaches the kitchen.

## Phase 3 — Unlocking insight (Months 12–18)

By month 12, there is enough data to make reports meaningful. A monthly P&L with 12 months of history is genuinely useful. Payroll analytics over a year reveal patterns (which roles cost the most, which staff take the most advances) that would be invisible without the data.

**Success metric for Phase 3:** Owner makes at least one business decision (pricing change, staffing adjustment, supplier negotiation) based on report data.

## Phase 4 — Completing the system (Months 18–24)

POS and billing is the highest-risk module — it sits directly in the path of money flowing into the business. By Phase 4, the owner has 18 months of experience with the app, deep trust in the system, and clarity on exactly how billing should work. The risk of a bad implementation is lowest at this stage.

**Success metric for Phase 4:** Manual EOD income entry is retired. All income flows through POS automatically.

---

# Part 6 — Non-Negotiable Principles

These are the product decisions that must never be reversed, regardless of what features are added later.

### 1. Management-only, always
No staff portal. No customer interface. No public-facing pages. This is a private management tool.

### 2. Mobile-first
The owner uses a phone. Every screen must work perfectly on a phone screen. Desktop is secondary.

### 3. Nothing is ever permanently deleted
Every deleted record is archived, not erased. Staff who leave, expenses that are removed, menu items that are discontinued — all of it stays in the database, just hidden from normal views. This protects the business from accidental data loss and preserves the audit history.

### 4. The owner is always in control
Only the owner can approve payroll, export data, delete records, or unlock a locked entry. The branch manager operates within clear boundaries. As the business grows and trust builds, these boundaries can be relaxed — but they start conservative.

### 5. Multi-branch from the start
Even though only one branch is active today, every piece of data is tagged to a branch. The second branch is activated by adding a row in a database table — not by rewriting code.

### 6. Simple beats clever
Every screen should be completable in under 2 minutes on a phone with average internet. No complex workflows. No multi-step processes where one step will do. The owner and manager are busy people running a physical business. The app earns its place by staying out of their way.

---

# Part 7 — What This App Is Not

To be clear about scope — this application will never be:

- A food ordering or delivery platform
- A table reservation system
- A customer loyalty or CRM system
- A full accounting package (not a replacement for the accountant or Tally)
- A multi-restaurant franchise management platform
- An HR system with leave approval, payslip portal, or employee self-service
- An integration with Swiggy, Zomato, or any third-party aggregator
- A real-time KOT (Kitchen Order Ticket) system (unless explicitly added to Phase 4 scope)

Staying out of these areas keeps the system focused, fast to build, and easier to trust.

---

*End of Product Requirements Document*  
*Next document: Technical Architecture Overview (HLD-01)*
