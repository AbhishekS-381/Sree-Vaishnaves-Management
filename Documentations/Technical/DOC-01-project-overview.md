# DOC-01 · Project Overview
**Version:** v1.0  
**Last updated:** 2026-03-15

---

## What this app is

A custom restaurant management web application built for a specific restaurant business. It is a **management-only tool** — only the owner and branch managers use it. No customer-facing features. No staff-facing interface. No public pages.

The app replaces fully manual processes: paper attendance, notebook salary calculations, cash-book expense tracking, and verbal stock management.

---

## Business context

- Single owner running the business alone today; a branch manager will be appointed soon
- Currently **one branch operating**, a **second branch is planned** within 2 years
- Approximately **35 staff per branch** across multiple roles
- The owner's primary device is a **mobile phone**; the developer/manager uses a laptop
- All monetary values are in **Indian Rupees (INR)**
- The restaurant runs **dine-in and takeaway** service — no delivery platform integration yet
- Language: English UI only

---

## Users and roles

There are exactly **three roles** in the system:

### Owner
- Full access across all branches
- Can approve and lock monthly payroll
- Can delete records (soft delete only)
- Can unlock locked EOD entries
- Can export all data
- Sees consolidated dashboard across all branches
- Only role that can manage user accounts

### Branch manager
- Full operational access within their **assigned branch only**
- Cannot see any data from other branches
- Cannot approve payroll
- Cannot delete records
- Cannot export data
- Cannot unlock locked EOD entries
- Can mark attendance, fill EOD entry, manage staff profiles, manage menu

### Super admin (developer only)
- Full system access including branch creation, role assignment, data seeding
- Never exposed in the UI
- Used only during development and initial onboarding
- Should be disabled or removed before handing the app to the owner

---

## Multi-branch design

This is critical — **every piece of data is scoped to a branch.**

- Every table has a `branch_id` foreign key
- Queries always filter by `branch_id` unless the user is the owner requesting consolidated data
- Adding a new branch requires only inserting a new row in the `branches` table — no code changes
- Branch 1 starts active; Branch 2 is activated when ready

---

## What is NOT in scope

The following are explicitly out of scope and must not be built or suggested:

- GST / tax filing or integration
- Staff-facing interface (no login, no leave requests, no self-service)
- Customer-facing interface (no online ordering, no table booking)
- Delivery platform integration (Swiggy, Zomato)
- Multi-user concurrent editing / real-time sync between users
- SMS or WhatsApp notifications (in-app alerts only for now)
- Payment gateway integration
- Accounting software integration (Tally, Zoho Books etc.)
- POS and billing (Phase 4 — deferred)

---

## Phased delivery plan

| Phase | Timeline | Scope |
|-------|----------|-------|
| Phase 1 | 0–6 months | Auth, staff, attendance, payroll, EOD entry, expense ledger, menu, dashboard, notifications |
| Phase 2 | 6–12 months | Inventory, vendor management |
| Phase 3 | 12–18 months | Reports, analytics, data export |
| Phase 4 | 18–24 months | POS and billing |

Build only Phase 1 features now. Do not scaffold or stub Phase 2–4 features prematurely.

---

## Key business rules (global)

1. **Soft deletes only** — no hard deletes anywhere in the system. Use `deleted_at` timestamp or `is_active` boolean.
2. **Audit everything** — every insert, update, and delete is logged in the `audit_logs` table with user ID, timestamp, old value, and new value.
3. **Monetary values are integers** — store rupees as integers (e.g. ₹1,500 = `1500`). No decimals. No paise.
4. **Timestamps in UTC, display in IST** — store all timestamps as UTC in the DB. Convert to IST (Asia/Kolkata, UTC+5:30) on the frontend.
5. **Branch scoping is mandatory** — never return data across branches unless the requesting user is the owner.
6. **One EOD entry per branch per day** — enforced at DB level with a unique constraint.
7. **One attendance record per staff per day** — enforced at DB level with a unique constraint.
8. **One payroll record per staff per month** — enforced at DB level with a unique constraint.
