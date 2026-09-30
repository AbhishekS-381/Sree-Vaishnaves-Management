---
inclusion: always
---

# Product Steering — Sree Vaishnaves Management

> Always-on context describing WHAT this product is and WHO it serves. Read this before any spec or change. Facts here are derived from the code, not from aspirational planning docs.

## What it is

One Next.js application that serves two surfaces:

1. **Public marketing website** at `/` — a static, single-page hotel/restaurant site (hero, about, menu, gallery, contact). No auth, no dynamic data.
2. **Management portal** at `/management/*` — the operations tool for running the restaurant business. This is where nearly all engineering work happens.

The business is **Hotel Sree Vaishnaves**, a vegetarian restaurant in Kannur, Kerala, with ~35 staff per branch and multiple branches. The portal replaces paper attendance, manual salary math, cash-book expenses, and verbal stock/vendor tracking.

## Who uses the portal — four roles

| Role | Scope | Notes |
|------|-------|-------|
| `admin` | All branches | Root/system account. **Only** role that can open Settings. Undeletable. |
| `owner` | All branches | Full operations except Settings. Marks payroll paid, edits/deletes ledger, overrides EOD locks, deletes staff, manages branches. |
| `manager` | One assigned branch | Sandboxed to `branchId`. Day-to-day ops only. |
| `readonly` | All branches (view) | Dashboards + reports; no mutations; cannot open EOD. |

JWT capability flags: `isRootAdmin` (admin), `isGlobalAdmin` (admin OR owner), `isGlobalOwner` (owner). Staff and customers do **not** log in.

## Modules (all implemented)

Dashboard, Staff & Positions, Attendance, Payroll, Day-End (EOD) Entry, Expenses, Vendors, Inventory, Menu, Reports, Branches, Settings.

**Module toggles:** an admin can enable/disable `attendance`, `payroll`, `vendors`, `inventory`, `menu`, `reports` globally via `config.json`. A disabled module disappears from navigation and stops raising dashboard alerts. Dashboard, Staff, EOD, Expenses, Branches, and Settings are always on.

## Product principles (honor these in every change)

1. **Speed on a phone.** The primary user is on a phone at the end of a long day. Routine screens must stay fast (few taps, few fields).
2. **Branch scoping is sacred.** A manager must never read or write another branch's data. Enforce in the Server Action AND the page loader.
3. **The operator stays in control.** Days can be re-saved; global admins can edit locked/aged records; nudges never block.
4. **Data for a downstream purpose.** Attendance → payroll; EOD → reports; expenses → P&L. Don't collect data without a use.
5. **Preserve history where it matters.** Core entities are soft-deleted.
6. **Money is integer rupees.** No decimals, no paise.
7. **"Today" is IST.** Date-sensitive logic uses Asia/Kolkata.

## Explicit non-goals (do not build without a new decision)

- No POS/order-taking (EOD billing is entered manually).
- No staff self-service or customer-facing features; no delivery-aggregator integration.
- No PDF salary slips; no Excel export (Reports exports CSV only).
- No SMS/WhatsApp/email; alerts are in-app only.
- No accounting-software or payment-gateway integration.

## Source of truth

The `/Documentations` folder (Technical `DOC-00..DOC-14`, Product docs, MODULE-MAPS, MODULES_AND_INTERLINKS) mirrors this and is kept in sync with the code. When code and docs disagree, the code wins — update the docs.
