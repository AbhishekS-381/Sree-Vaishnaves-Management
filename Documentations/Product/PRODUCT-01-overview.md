# Restaurant Management App — Product Overview
**Document type:** Product · High Level  
**Audience:** Product owner, stakeholders, developers onboarding  
**Version:** v1.0 | Last updated: 2026-03-15

---

## The problem we are solving

A thriving restaurant with 35+ staff and two branches is being run almost entirely on paper and memory.

Every day, the owner manually:
- Keeps a notebook to track who came to work
- Does salary calculations by hand at the end of each month
- Writes expenses in a cash book
- Has no reliable way to know if today was a profitable day
- Cannot easily compare this month's performance to last month
- Has no record of stock levels or vendor payments
- Carries all of this in his head across two branches

This works today because the owner is physically present and deeply experienced. But it creates three serious risks:

1. **The takeover risk.** When the next generation takes over, there is no system to hand over — just a pile of notebooks and institutional memory locked in one person's head.
2. **The scale risk.** Managing one branch manually is hard. Managing two branches manually at 35+ staff each is nearly impossible without dropping things.
3. **The insight risk.** Without data, there is no way to answer basic business questions: Are we more profitable than last month? Which days of the week perform best? Is our salary cost too high as a percentage of revenue?

This application solves all three.

---

## What this application is

A **private, web-based management tool** built exclusively for the restaurant owner and branch managers.

It is not:
- A customer-facing app
- An online ordering platform
- A public website
- A tool for staff to use

It is a **digital operations layer** that replaces notebooks, mental arithmetic, and verbal communication with a structured, reliable, and searchable system.

The goal is not to change how the restaurant operates. The goal is to **make the existing operations visible, trackable, and transferable.**

---

## Who uses this app

### The owner
The primary user. He is on his phone most of the day, moving between branches. He needs to:
- Know at a glance how each branch is doing today
- Approve salaries at the end of the month
- See if the business is growing month over month
- Have full visibility and control over everything

The app must work on a phone. Actions must be fast — he is not sitting at a desk.

### The branch manager
A trusted employee who runs day-to-day operations at one branch. He needs to:
- Mark attendance every morning
- Log the day's income and expenses every evening
- Manage the staff list and menu for his branch

He cannot see other branches. He cannot approve payroll. He cannot delete records.

### The developer (you)
Technical owner of the system. Has super admin access during development and onboarding. Responsible for setting up branches, creating the first user accounts, and maintaining the system.

---

## The two-year journey

This app is being built alongside the business, not handed over all at once. The plan is designed so that each phase delivers something immediately useful — the owner starts getting value from month one, not month eighteen.

```
TODAY                                              TAKEOVER
|                                                      |
|--- Phase 1 ---|--- Phase 2 ---|--- Phase 3 ---|- Ph 4|
  0–6 months      6–12 months     12–18 months   18–24
  Daily ops        Supply chain    Insights       POS
  Staff & pay      Inventory       Reports
  EOD entry        Vendors         Analytics
```

By the time the handover happens, the system will have:
- 18–24 months of daily income and expense data
- Full salary and attendance history for every staff member
- A working, trusted process the father already uses daily
- The developer (new owner) already knowing every corner of the system because they built it

---

## The four phases — what changes for the owner

### Phase 1: "I know what's happening in my business every day"
Before: The owner ends each day with a rough idea of how things went.  
After: Every day has a clear record — income by type, expenses by category, net profit, who was present.

The owner opens the app every morning and sees both branches at a glance. Every evening, the EOD entry takes 2 minutes to fill. At the end of the month, salary calculations happen automatically and he approves them in one screen.

### Phase 2: "I know what I have and what I owe"
Before: Stock levels are guessed. Vendor payments are tracked by memory or loose receipts.  
After: Every purchase from every vendor is recorded. Stock levels are visible. Low stock triggers a visible alert before the restaurant runs out.

### Phase 3: "I understand how my business is performing"
Before: The owner knows last month was good or bad but cannot say by how much or why.  
After: Charts show income trends, expense breakdowns, salary as a percentage of revenue, and month-on-month comparisons. A one-page PDF can be handed to the accountant each month.

### Phase 4: "My billing system feeds my management system"
Before: Bills are written by hand or on a basic billing app with no connection to the management system.  
After: Every order placed at the table feeds directly into the daily income record. The EOD entry fills itself. The management system and the billing system are one.

---

## Core design principles

These principles guided every feature and UX decision. Any future feature must be evaluated against them.

### 1. Speed over completeness
The owner uses this app at the end of a long day on a phone. Every screen must be completable in under 2 minutes. If a feature requires more than 3 taps to reach or more than 5 fields to fill, it needs to be redesigned.

### 2. Data for tomorrow, not bureaucracy today
Every piece of data collected today has a purpose for the future — attendance feeds payroll, EOD entries feed analytics, expenses feed P&L. No data is collected "just in case." Every field has a clear downstream use.

### 3. The owner is always in control
The app assists the owner — it does not replace his judgment. He can override salary calculations. He can unlock a locked entry. He can add a note to anything. The system surfaces information; the owner makes decisions.

### 4. Forgiveness over enforcement
The app does not block the owner from doing his job if he skips a step. Petty cash is optional. Notes are optional. EOD can be saved incomplete. The system reminds gently — it does not enforce rigidly.

### 5. Built to be handed over
Every decision — from the modular phased rollout to the audit trail to the comprehensive documentation — is made with the handover in mind. The new owner must be able to open this system and understand the business's entire history.
