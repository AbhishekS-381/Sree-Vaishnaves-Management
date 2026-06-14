# DOC-00 · Master Index
**Project:** Restaurant Management App  
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Status:** Locked — Phase 1 ready to build

---

## How to use this documentation system

This is a modular documentation set designed to be fed to AI coding assistants (Gemini, Copilot, Cursor, etc.) in pieces. Each document is self-contained but references others where needed.

### Rules
1. **Always feed DOC-01 + DOC-02 + DOC-03** to the AI at the start of every session — these are the foundation.
2. **Add only the relevant module doc(s)** for whatever you're building that session.
3. **When AI changes something**, paste that doc back to Claude with a note like "Gemini changed X in DOC-05, please update." Claude will revise and return the updated doc.
4. **Version numbers** increment on every meaningful change (v1.0 → v1.1). Always check the version header before feeding a doc to AI.
5. **Never feed all docs at once** to a coding AI — context overload produces worse output. Feed foundation + 1–2 module docs per session.

---

## Document registry

### Foundation docs — always feed these
| Doc | File | Purpose | Feed to AI |
|-----|------|---------|------------|
| DOC-01 | `DOC-01-project-overview.md` | App identity, goals, constraints, user roles | Always |
| DOC-02 | `DOC-02-architecture-and-stack.md` | Tech stack, folder structure, conventions, API patterns | Always |
| DOC-03 | `DOC-03-database-schema.md` | Full PostgreSQL schema, all tables, constraints, indexes | Always |

### Phase 1 module docs — 0 to 6 months
| Doc | File | Purpose | Feed when building... |
|-----|------|---------|----------------------|
| DOC-04 | `DOC-04-auth-and-roles.md` | JWT auth, role definitions, middleware | Login, protected routes, role checks |
| DOC-05 | `DOC-05-staff-and-payroll.md` | Staff profiles, salary formula, advance tracking, payroll approval | Any staff or payroll screen/route |
| DOC-06 | `DOC-06-attendance.md` | Daily marking, bulk-present, holiday flag, edit rules | Attendance screen or API |
| DOC-07 | `DOC-07-eod-entry.md` | EOD income, cash/UPI split, petty cash, offline draft, locking | EOD form or daily entry API |
| DOC-08 | `DOC-08-expense-ledger.md` | Shared expense table, EOD vs vendor source, categories | Any expense-related feature |
| DOC-09 | `DOC-09-menu-management.md` | Menu items, categories, availability toggle | Menu screen or route |
| DOC-13 | `DOC-13-dashboard.md` | Home screen, branch cards, pending actions widget | Dashboard screen |
| DOC-14 | `DOC-14-notifications.md` | In-app alerts, reminder rules, badge logic | Any alert or reminder feature |

### Phase 2 module docs — 6 to 12 months
| Doc | File | Purpose | Feed when building... |
|-----|------|---------|----------------------|
| DOC-10 | `DOC-10-inventory.md` | Stock items, manual updates, low-stock alerts | Inventory screen or route |
| DOC-11 | `DOC-11-vendors.md` | Vendor profiles, purchase bills, full expense edit | Vendor or supplier screen |

### Phase 3 module docs — 12 to 18 months
| Doc | File | Purpose | Feed when building... |
|-----|------|---------|----------------------|
| DOC-12 | `DOC-12-reports-and-analytics.md` | P&L, salary analytics, export, month-on-month | Any reports or charts screen |

---

## Session prompt template

Copy this template at the start of every AI coding session:

```
You are helping me build a restaurant management app.

Always follow the conventions and rules in the documents I provide.
Never invent your own schema, naming conventions, or folder structure.
If something is unclear, ask before generating code.
Do not add features not described in the docs.

[PASTE DOC-01 HERE]
[PASTE DOC-02 HERE]  
[PASTE DOC-03 HERE]
[PASTE RELEVANT MODULE DOC(S) HERE]

Task: [describe exactly what you want built]
```

---

## Change log
| Version | Date | Changed by | What changed |
|---------|------|-----------|--------------|
| v1.0 | 2026-03-15 | Claude | Initial creation — all 14 docs generated |
