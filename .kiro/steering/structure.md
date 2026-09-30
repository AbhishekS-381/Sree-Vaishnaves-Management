---
inclusion: always
---

# Structure Steering — Sree Vaishnaves Management

> Always-on map of WHERE things live. Use this to locate code and to place new code consistently.

## Repository layout

```
/ (repo root)
├── db/
│   ├── index.ts            # driver selection (Neon dev / Netlify prod)
│   ├── schema.ts           # json_store + rate_limit tables (the ONLY real tables)
│   ├── seed.ts             # upserts defaults into json_store
│   └── seed-data.ts        # default departments, roles, categories, branches, config, owner
├── netlify/database/migrations/   # SQL migrations (json_store, rate_limit, admin bootstrap)
├── src/
│   ├── middleware.ts       # session gate for /management/*
│   ├── app/
│   │   ├── layout.tsx      # root layout
│   │   ├── (website)/      # PUBLIC marketing site (page.tsx, layout.tsx) — static
│   │   ├── management/
│   │   │   ├── layout.tsx  # authenticated shell (Navigation + config)
│   │   │   ├── page.tsx    # DASHBOARD (server component; reads + scopes + computes)
│   │   │   ├── login/
│   │   │   └── <module>/   # staff, attendance, payroll, eod, expenses, vendors,
│   │   │                   #   inventory, menu, reports, branches, settings
│   │   │       ├── page.tsx            # server loader: fetch + branch-scope + redirects
│   │   │       └── XxxClientPage.tsx   # client UI
│   │   │       └── [id]/page.tsx       # (branches) detail route
│   │   └── actions/        # ALL server logic ('use server')
│   ├── components/         # Navigation, StaffModal, ScheduleTimeline, AutoScheduleModal,
│   │                       #   RequirementModal, RoleModal, UserModal, GenericEntityModal,
│   │                       #   StaffFilters, StaffRequirements, PositionsSummaryCards
│   ├── hooks/              # useEODSave, useStaffFilters, useMenuFilters
│   └── lib/
│       ├── db.ts           # JSON store + mutex (readJSON/writeJSON/withTransaction/DB_FILES)
│       ├── jwt.ts          # sign/verify JWT
│       ├── rate-limit.ts   # SQL sliding-window limiter
│       ├── audit.ts        # logAction → audit_logs.json
│       ├── scheduleGenerator.ts   # auto-schedule algorithm
│       ├── positionsSummary.ts    # pure summary calc
│       ├── useDraft.ts            # localStorage draft (48h TTL)
│       └── utils.ts              # cn(), formatCurrency()
├── test/
│   ├── unit/               # vitest: actions/, lib/, hooks/, components/, pages/, middleware
│   └── integration/        # playwright
├── public/                 # static website assets (bootstrap, swiper, aos, images)
└── Documentations/         # human docs kept in sync with code (Technical + Product)
```

## Module → code map

| Module | Route(s) | Client component | Server action file(s) |
|--------|----------|------------------|-----------------------|
| Dashboard | `/management` | inline in `page.tsx` | (reads via `readJSON`) |
| Staff & Positions | `/management/staff` | `StaffClientPage.tsx` | `staff.ts`, `staff_requirements.ts` |
| Attendance | `/management/attendance` | `AttendanceClientPage.tsx` | `attendance.ts` |
| Payroll | `/management/payroll` | `PayrollClientPage.tsx` | `salary.ts` |
| EOD Entry | `/management/eod` | `EODClientPage.tsx` | `eod.ts` |
| Expenses | `/management/expenses` | `ExpensesClientPage.tsx` | `expenses.ts` |
| Vendors | `/management/vendors` | `VendorsClientPage.tsx` | `vendors.ts` |
| Inventory | `/management/inventory` | `InventoryClientPage.tsx` | `inventory.ts` |
| Menu | `/management/menu` | `MenuClientPage.tsx` | `menu.ts`, `menu_categories.ts` |
| Reports | `/management/reports` | `ReportsClientPage.tsx` | (reads via `readJSON`) |
| Branches | `/management/branches`, `/branches/[id]` | `BranchesClientPage.tsx` | `branches.ts` |
| Settings | `/management/settings` | `SettingsClientPage.tsx` | `settings.ts`, `categories.ts`, `menu_categories.ts`, `config.ts`, `users.ts` |
| Auth | `/management/login` | `login/page.tsx` | `auth.ts` |
| Public site | `/` | `(website)/page.tsx` | none (static) |

## Data collections (rows in `json_store`)

Active/used: `branches`, `departments`, `roles`, `staff`, `staff_requirements`, `attendance`, `payroll`, `eod`, `expenses`, `categories`, `menu`, `menu_categories`, `branch_menu_items`, `branch_categories`, `inventory`, `stock_adjustments`, `vendors`, `config`, `users`, `audit_logs`.

Seeded but currently unused: `advances`, `daily_tally`.

Real Postgres tables: `json_store`, `rate_limit`.

Full field-by-field shapes live in `Documentations/Technical/DOC-03-database-schema.md` and are mirrored in `.kiro/specs/app-baseline/design.md`.

## Where to put new code

- **New feature on an existing module** → extend that module's action file + ClientPage; add a spec under `.kiro/specs/<feature-name>/`.
- **New entity/collection** → add to `DB_FILES`, define its TypeScript type in the owning action file, follow the soft-delete-vs-hard-delete convention of similar collections, and seed a default (usually `[]`) in `db/seed-data.ts`.
- **New shared logic** → `src/lib/` (pure/testable) or `src/hooks/` (React).
- **New reusable UI** → `src/components/` (prefer extending `GenericEntityModal` / existing modals).
- **Never** add a `/api` route or a second persistence mechanism.
