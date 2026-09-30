# .kiro — Specs & Steering

This folder is the durable, code-verified foundation for working on **Sree Vaishnaves Management**. It exists so that any future change starts from an accurate, shared understanding of the system instead of re-deriving it each time.

## Layout

```
.kiro/
├── steering/                 # ALWAYS-ON context (auto-applied to every task)
│   ├── product.md            # what the product is, who uses it, principles, non-goals
│   ├── tech.md               # stack, Server Action contract, conventions, gotchas
│   └── structure.md          # repo layout, module→code map, collections, where code goes
└── specs/
    └── app-baseline/         # BASELINE spec — the whole system as-built (not a feature)
        ├── requirements.md   # 15 EARS-style requirements = the regression baseline
        ├── design.md         # architecture, data model, flows, decisions (D1–D8)
        └── tasks.md          # baseline status + how to start new feature specs
```

## What this is (and isn't)

- **`steering/`** — persistent project knowledge that applies to *everything*. Keep it current with the code; it's the first thing to read.
- **`specs/app-baseline/`** — a **baseline** spec describing the entire application as it exists today. It is a reference and a regression contract, **not** a feature to implement.
- It is **not** a single-feature spec. Feature work gets its own folder (below).

## How to use it for future work

1. **Read the steering docs** — they capture the rules (Server Actions only, JSON-blob store, four roles, branch scoping, integer money, IST dates, soft-delete conventions, non-goals).
2. **Consult the baseline** (`app-baseline/requirements.md` + `design.md`) for how the relevant area already behaves and which decisions constrain it.
3. **Create a new spec per feature:** `.kiro/specs/<feature-name>/` containing:
   - `requirements.md` — EARS-style acceptance criteria for the *delta*, referencing baseline requirement numbers (e.g. "extends R8 EOD").
   - `design.md` — only what changes; record a new decision if you must break a baseline decision (D1–D8).
   - `tasks.md` — a checkable plan naming files, following the Server Action contract, and listing the Vitest tests to add.
4. **Follow the Definition of Done** in `app-baseline/tasks.md`: acceptance criteria met, branch scoping enforced in action + loader, tests + lint green, docs updated, no new secrets/`/api`/second datastore without a recorded decision.

## Relationship to `/Documentations`

`/Documentations` (Technical `DOC-00..14` + Product docs + maps) is the long-form, human-readable documentation and is kept in sync with the code. `.kiro` is the concise, agent-oriented working context and spec workflow. Both are derived from the same source of truth — **the code** — and when they disagree with the code, the code wins and the docs get updated.
