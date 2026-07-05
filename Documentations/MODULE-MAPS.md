# Restaurant Management App — Module Maps
**Document type:** Product · Visual Reference  
**Version:** v1.0 | Last updated: 2026-03-15  
**Render with:** Any Markdown viewer that supports Mermaid (GitHub, Notion, Obsidian, VS Code + Mermaid plugin)

---

## How to read these maps

Each diagram uses a consistent colour convention:

| Colour | Meaning |
|--------|---------|
| 🟣 Purple | Foundation / cross-cutting |
| 🟡 Amber/Yellow | Phase 1 modules |
| 🟢 Green | Phase 2 modules |
| 🔵 Blue | Phase 3 modules |
| 🩷 Pink | Phase 4 modules |
| ⬜ Grey | Shared data / neutral nodes |

---

---

## MAP 1 — Full application module overview

All 15 modules across all four phases, showing phase groupings and the foundation layer.

```mermaid
graph TD
  subgraph FOUNDATION["🟣 Foundation — cross-cutting"]
    AUTH["Auth & roles\n3 roles · JWT · branch-scoped"]
    MULTI["Multi-branch architecture\nAll data scoped per branch"]
    AUDIT["Audit log\nEvery change tracked silently"]
    NOTIF["In-app notifications\nReminders · alerts · badges"]
  end

  subgraph P1["🟡 Phase 1 · 0–6 months · Core daily operations"]
    DASH["Dashboard\nDaily snapshot · pending actions"]
    STAFF["Staff management\nProfiles · roles · salaries"]
    ATT["Attendance\nDaily marking · bulk present"]
    PAY["Payroll\nCalc · advances · approve"]
    EOD["EOD daily entry\nIncome · expenses · petty cash"]
    EXP["Expense ledger\nShared · EOD + vendor source"]
    MENU["Menu management\nItems · price · availability"]
  end

  subgraph P2["🟢 Phase 2 · 6–12 months · Supply chain"]
    INV["Inventory & stock\nQuantities · low-stock alerts"]
    VEN["Vendor management\nBills · POs · full expense edit"]
  end

  subgraph P3["🔵 Phase 3 · 12–18 months · Insights"]
    REP["Reports & analytics\nP&L · trends · month-on-month"]
    SAL["Salary analytics\nCost % · role breakdown"]
    EXP_OUT["Data export\nCSV · Excel · PDF"]
  end

  subgraph P4["🩷 Phase 4 · 18–24 months · POS & billing"]
    POS["POS & billing\nTable orders · receipts"]
    AUTOEOD["Auto EOD feed\nReplaces manual income entry"]
    AUTOINV["Auto stock deduction\nSales reduce inventory"]
  end

  STAFF --> ATT
  ATT --> PAY
  STAFF --> PAY
  EOD --> EXP
  VEN --> EXP
  EXP --> REP
  PAY --> REP
  EOD --> REP
  INV --> DASH
  EXP --> DASH
  ATT --> DASH
  PAY --> DASH
  EOD --> DASH
  REP --> EXP_OUT
  POS --> AUTOEOD
  POS --> AUTOINV
  AUTOEOD -.->|"Phase 4 replaces"| EOD
  AUTOINV -.->|"Phase 4 deducts"| INV
```

---

---

## MAP 2 — Data flow across modules

How data moves between modules from input to output.

```mermaid
flowchart TD
  STAFF["Staff profiles\n(name · department · role · monthly salary)"]
  ATT["Daily attendance\n(present / absent / half-day / holiday)"]
  ADV["Salary advances\n(recorded any time in month)"]
  EOD_INC["EOD income entry\n(dine-in + takeaway · cash + UPI)"]
  EOD_EXP["EOD expense entry\n(quick tap · insert only)"]
  VEN_EXP["Vendor bill entry\n(full CRUD · source=vendor)"]
  LEDGER[("Shared expense ledger\n(single DB table)")]
  PAYROLL["Payroll calculation\n(formula + deductions)"]
  DAILY_PL["Daily P&L\n(income − expenses)"]
  DASH["Dashboard\n(today's snapshot)"]
  MONTHLY["Monthly reports\n(roll-up of locked days)"]
  EXPORT["Data export\n(CSV · Excel · PDF)"]

  STAFF --> ATT
  STAFF --> PAYROLL
  ATT --> PAYROLL
  ADV --> PAYROLL
  EOD_INC --> DAILY_PL
  EOD_EXP --> LEDGER
  VEN_EXP --> LEDGER
  LEDGER --> DAILY_PL
  LEDGER --> MONTHLY
  DAILY_PL --> DASH
  PAYROLL --> DASH
  PAYROLL --> MONTHLY
  EOD_INC --> MONTHLY
  MONTHLY --> EXPORT
```

---

---

## MAP 3 — Auth & roles module

Who can do what, and how access is scoped to branches.

```mermaid
flowchart TD
  LOGIN["Login\n(email + password)"]
  JWT["JWT issued\n(userId · role · branchId)"]

  LOGIN --> JWT

  JWT --> OWNER
  JWT --> MANAGER
  JWT --> SUPERADMIN

  subgraph OWNER["Owner"]
    O1["All branches — full access"]
    O2["Approve & lock payroll"]
    O3["Delete records (soft)"]
    O4["Export all data"]
    O5["Unlock EOD entries"]
    O6["Consolidated dashboard"]
  end

  subgraph MANAGER["Branch manager"]
    M1["Assigned branch only"]
    M2["Mark attendance"]
    M3["Fill EOD entry"]
    M4["Manage staff & menu"]
    M5["Cannot approve payroll"]
    M6["Cannot delete or export"]
  end

  subgraph SUPERADMIN["Super admin (developer)"]
    S1["Full system access"]
    S2["Create branches"]
    S3["Assign roles"]
    S4["Seed data"]
    S5["Never shown in UI"]
  end

  JWT --> SCOPE

  subgraph SCOPE["Branch scope middleware — runs on every request"]
    SC1{"User role?"}
    SC1 -->|owner / super_admin| SC2["Allow any branch_id\nor cross-branch query"]
    SC1 -->|branch_manager| SC3{"Request branch_id\n= user's branch_id?"}
    SC3 -->|Yes| SC4["Allow — inject branchId"]
    SC3 -->|No| SC5["403 FORBIDDEN"]
  end
```

---

---

## MAP 4 — Staff management module

Full lifecycle of a staff member in the system.

```mermaid
flowchart TD
  ADD["Add staff member\n(name · department · role · salary · branch)"]
  PROFILE["Staff profile\n(active record in DB)"]
  EDIT["Edit profile\n(owner or branch manager)"]
  DEACTIVATE["Deactivate\n(is_active = false · soft delete)"]
  HISTORY["Staff history view\n(attendance · advances · payroll)"]

  ADD --> PROFILE
  EDIT --> PROFILE
  PROFILE --> HISTORY

  PROFILE --> ATT_FEED["Feeds attendance roster\n(appears in daily marking)"]
  PROFILE --> PAY_FEED["Feeds payroll generation\n(monthly salary snapshot)"]
  DEACTIVATE --> HIDDEN["Hidden from active lists\nHistory preserved in DB"]

  subgraph ROLES["Staff role categories"]
    R1["head_cook"]
    R2["assistant_cook"]
    R3["waiter"]
    R4["cashier"]
    R5["cleaner"]
    R6["delivery"]
    R7["manager"]
    R8["other"]
  end

  subgraph DEPARTMENTS["Departments"]
    SH1["kitchen"]
    SH2["service"]
    SH3["management"]
  end

  subgraph FILTERS["List filters"]
    F1["By department"]
    F2["By role"]
    F3["Search by name"]
    F4["Include inactive (owner only)"]
  end
```

---

---

## MAP 5 — Attendance module

Daily marking flow optimised for 35+ staff.

```mermaid
flowchart TD
  OPEN["Open attendance screen\n(today's date · branch)"]
  CHECK{"Any records\nexist for today?"}

  OPEN --> CHECK
  CHECK -->|No| BULK["Tap — Mark all present\n(35 staff marked in 1 tap)"]
  CHECK -->|Yes| LIST["Show current list\n(statuses already set)"]

  BULK --> LIST

  LIST --> EXCEPT["Tap exceptions only\n(absent · half-day · leave)"]
  EXCEPT --> SAVED["Records saved\n(unique: staff_id + date)"]

  subgraph STATUSES["Status values & payroll weight"]
    ST1["present → 1.0 day"]
    ST2["half_day → 0.5 day"]
    ST3["absent → 0.0 day"]
    ST4["leave → 0.0 day"]
    ST5["holiday → excluded from denominator"]
  end

  subgraph HOLIDAY["Holiday flag flow"]
    H1["Owner flags date as holiday"]
    H2["All staff marked holiday in bulk"]
    H3["Day excluded from working day count"]
    H4["No salary deduction for staff"]
    H1 --> H2 --> H3 --> H4
  end

  subgraph EDIT_RULES["Edit rules"]
    E1["Same day — owner + manager"]
    E2["Up to 7 days back — owner only"]
    E3["Beyond 7 days — no edit via UI"]
    E4["After payroll approved — locked"]
  end

  SAVED --> PAY["Feeds payroll\ncalculation at month end"]
  SAVED --> DASH["Updates dashboard\nattendance count"]
```

---

---

## MAP 6 — Payroll module

End-to-end from attendance records to locked salary slips.

```mermaid
flowchart TD
  TRIG["Trigger: owner opens\npayroll for month YYYY-MM"]

  TRIG --> GEN["Generate payroll\n(reads attendance for all active staff)"]

  subgraph CALC["Calculation per staff member"]
    C1["Count days_present from attendance_logs"]
    C2["Count half_days"]
    C3["Count holiday days (excluded)"]
    C4["Get working_days from branch config (default 26)"]
    C5["Snapshot monthly_salary from staff profile"]
    C6["Sum advances where is_deducted = false"]
    C7["gross = ROUND((present + 0.5×half) ÷ working × monthly_salary)"]
    C8["net = MAX(0, gross − advances)"]
    C1 --> C7
    C2 --> C7
    C4 --> C7
    C5 --> C7
    C7 --> C8
    C6 --> C8
  end

  GEN --> CALC
  CALC --> DRAFT["Draft payroll table\n(all 35 staff · status = draft)"]

  DRAFT --> REVIEW["Owner reviews bulk table\n(all staff · calculated amounts)"]
  REVIEW --> OVERRIDE{"Override\nneeded?"}
  OVERRIDE -->|Yes| OVR["Set override_amount\n+ override_note"]
  OVERRIDE -->|No| APPROVE
  OVR --> APPROVE

  APPROVE["Owner taps — Approve all\n(owner role only)"]
  APPROVE --> LOCK["Payroll locked\n(status = approved)"]
  LOCK --> DEDUCT["Advances marked is_deducted = true\n(prevents double deduction)"]
  LOCK --> SLIPS["Salary slips available\n(PDF per staff member)"]
  LOCK --> ANALYTICS["Feeds salary analytics\n(Phase 3 reports)"]

  subgraph SLIP_CONTENT["Salary slip PDF contains"]
    SL1["Restaurant + branch name"]
    SL2["Staff name · role · month"]
    SL3["Working days · present · half days"]
    SL4["Base · gross · advances · net payable"]
    SL5["Approved by · date"]
  end
```

---

---

## MAP 7 — EOD daily entry module

The daily closing routine — income, expenses, petty cash, notes.

```mermaid
flowchart TD
  OPEN["Open EOD entry\n(today's date · branch pre-filled)"]

  OPEN --> DRAFT_CHECK{"Local draft\nexists?"}
  DRAFT_CHECK -->|Yes| RESTORE["Restore draft from localStorage\n(show banner: draft restored)"]
  DRAFT_CHECK -->|No| FRESH["Fresh form"]
  RESTORE --> FORM
  FRESH --> FORM

  subgraph FORM["EOD form sections"]
    INC["Income section\nDine-in cash · Dine-in UPI\nTakeaway cash · Takeaway UPI"]
    EXP_SEC["Expense section\nTap category tags to add rows\nReflects vendor bills for today"]
    PETTY["Petty cash (optional)\nOpening float · Closing balance"]
    NOTES["Notes (optional)\nAnything unusual today"]
  end

  FORM --> AUTOSAVE["Auto-save draft to localStorage\n(on every field change)"]
  FORM --> NET["Live net calculation\nIncome − Expenses · updates as user types"]

  FORM --> SAVE["Tap — Save entry"]
  SAVE --> VALIDATE{"Validation\npassed?"}
  VALIDATE -->|No| ERROR["Show field errors"]
  VALIDATE -->|Yes| SUBMIT["POST to server\n(one entry per branch per day)"]
  SUBMIT --> CLEAR["Clear localStorage draft"]
  SUBMIT --> LOCKED_LATER["Auto-locks after 24 hours"]

  subgraph LOCK_FLOW["Locking rules"]
    L1["24 hrs after created_at → is_locked = true"]
    L2["Owner can manually lock early"]
    L3["Owner can unlock any entry"]
    L4["Branch manager cannot lock or unlock"]
  end

  subgraph OFFLINE["Offline behaviour"]
    OF1["Fields saved to localStorage on every change"]
    OF2["If save fails — draft persists"]
    OF3["On reconnect — auto-submit or user re-taps Save"]
    OF4["Draft older than 48 hrs — auto-discarded"]
  end
```

---

---

## MAP 8 — Shared expense ledger module

Single source of truth for all expenses — two entry points, one table.

```mermaid
flowchart LR
  subgraph ENTRY_EOD["EOD entry screen"]
    E1["Tap category tag"]
    E2["Enter amount"]
    E3["INSERT · source = eod"]
  end

  subgraph ENTRY_VEN["Vendor management screen (Phase 2)"]
    V1["Select vendor (optional)"]
    V2["Enter amount · invoice ref"]
    V3["INSERT / UPDATE / DELETE · source = vendor"]
  end

  ENTRY_EOD --> LEDGER
  ENTRY_VEN --> LEDGER

  LEDGER[("expenses table\nbranch_id · date · category\namount · vendor_name\ninvoice_ref · source\ncreated_by · deleted_at")]

  LEDGER --> REFLECT["Reflected back in EOD view\n(vendor bills show as read-only\nwith 'from vendor' badge)"]
  LEDGER --> PL["Daily P&L\n(sum expenses where date = today)"]
  LEDGER --> MONTHLY["Monthly reports\n(category breakdown)"]
  LEDGER --> EXPORT["Data export\n(expense ledger CSV)"]

  subgraph PERMS["Permissions"]
    P1["EOD screen — INSERT only\n(no edit · no delete)"]
    P2["Vendor screen — full CRUD\n(can edit EOD-sourced entries too)"]
    P3["source field = audit trail only\n(does not restrict operations)"]
  end

  subgraph CATS["Default expense categories"]
    C1["Raw materials"]
    C2["Gas / fuel"]
    C3["Electricity"]
    C4["Rent"]
    C5["Salary advance"]
    C6["Maintenance"]
    C7["Miscellaneous"]
  end
```

---

---

## MAP 9 — Dashboard module

What loads on the home screen and where every number comes from.

```mermaid
flowchart TD
  LOGIN["User logs in"]
  LOGIN --> ROLE{"User role?"}

  ROLE -->|owner| CONSOLIDATED["Consolidated view\n(all branches side by side + totals)"]
  ROLE -->|branch_manager| SINGLE["Single branch view\n(assigned branch only)"]

  subgraph BRANCH_CARD["Branch card — data sources"]
    D1["Today's income → from daily_entries"]
    D2["Today's expenses → from expenses table"]
    D3["Net so far → income − expenses"]
    D4["Attendance count → from attendance_logs"]
    D5["Month-to-date income → sum of locked EOD entries"]
    D6["vs last month → previous month sum"]
  end

  CONSOLIDATED --> BRANCH_CARD
  SINGLE --> BRANCH_CARD

  subgraph PENDING["Pending actions widget — computed each load"]
    PA1{"Attendance marked\ntoday?"}
    PA1 -->|No| A1["⚠ Attendance not marked"]
    PA2{"EOD entry filled\nby 10pm?"}
    PA2 -->|No| A2["⚠ EOD entry not filled"]
    PA3{"Last 3 days of month\n+ payroll not approved?"}
    PA3 -->|Yes| A3["ℹ Payroll due this month"]
    PA4{"Any stock item\nbelow threshold? (Phase 2)"}
    PA4 -->|Yes| A4["⚠ Low stock alert"]
  end

  BRANCH_CARD --> QUICK["Quick action buttons\n(Mark attendance · Fill EOD · Review payroll)"]
  PENDING --> QUICK
```

---

---

## MAP 10 — Inventory & stock module (Phase 2)

Stock tracking, adjustment history, and low-stock alert flow.

```mermaid
flowchart TD
  ADD_ITEM["Add stock item\n(name · unit · threshold)"]
  ITEM["Stock item record\n(current_quantity · low_stock_threshold)"]
  ADD_ITEM --> ITEM

  subgraph ADJUST["Stock adjustments"]
    ADJ_IN["Add stock\n(delivery arrived · type = add)"]
    ADJ_OUT["Reduce stock\n(daily usage · spoilage · type = reduce)"]
    ADJ_POS["Auto-reduce from POS (Phase 4)"]
  end

  ADJ_IN --> UPDATE["Update current_quantity\n(+ or − the adjustment amount)"]
  ADJ_OUT --> UPDATE
  ADJ_POS -.->|Phase 4| UPDATE
  ITEM --> UPDATE

  UPDATE --> CHECK{"current_quantity\n≤ threshold?"}
  CHECK -->|Yes| ALERT["Low stock alert\n(appears on dashboard)"]
  CHECK -->|No| OK["No alert"]

  UPDATE --> HISTORY["Adjustment history\n(every change logged with reason)"]

  subgraph UNITS["Supported units"]
    U1["kg"]
    U2["litres"]
    U3["pieces"]
    U4["packets"]
    U5["custom"]
  end

  subgraph LINKS["Phase 2+ connections"]
    LK1["Link stock item to menu item\n(estimated consumption tracking)"]
    LK2["Link to vendor\n(which supplier provides this item)"]
  end
```

---

---

## MAP 11 — Vendor management module (Phase 2)

Supplier profiles, purchase bills, and full expense ledger control.

```mermaid
flowchart TD
  ADD_VEN["Add vendor profile\n(name · phone · supply type · branch)"]
  VEN_PROFILE["Vendor profile\n(active record)"]
  ADD_VEN --> VEN_PROFILE

  VEN_PROFILE --> BILL["Record purchase bill\n(vendor · amount · date · invoice ref)"]
  BILL --> LEDGER["Writes to shared expense ledger\n(source = vendor)"]

  LEDGER --> EOD_REFLECT["Appears in EOD view for that date\n(read-only · labelled from vendor)"]
  LEDGER --> REPORTS["Feeds monthly expense reports\n(category + vendor breakdown)"]

  subgraph FULL_EDIT["Full edit capability"]
    FE1["Edit any expense — any source\n(incl. EOD-entered expenses)"]
    FE2["Delete any expense (soft)\n(owner only)"]
    FE3["Correct wrong amounts\nor categories"]
  end

  subgraph OUTSTANDING["Outstanding bills (nice to have)"]
    OB1["Mark bill as unpaid\n(is_paid = false)"]
    OB2["Set due date"]
    OB3["Dashboard shows unpaid count"]
    OB1 --> OB2 --> OB3
  end
```

---

---

## MAP 12 — Reports & analytics module (Phase 3)

What gets calculated, how, and what can be exported.

```mermaid
flowchart TD
  subgraph INPUTS["Data sources (12+ months accumulated)"]
    I1["daily_entries\n(income per day)"]
    I2["expenses\n(all categories · both sources)"]
    I3["payroll_records\n(monthly salary totals)"]
    I4["attendance_logs\n(absenteeism patterns)"]
    I5["stock_adjustments\n(consumption data · Phase 2)"]
  end

  INPUTS --> ENGINE["Reports engine\n(reads all locked data · branch-scoped)"]

  subgraph FINANCIAL["Financial reports"]
    F1["Daily P&L\n(per date range)"]
    F2["Monthly P&L\n(income · expenses · net)"]
    F3["Month-on-month comparison\n(delta · % change)"]
    F4["Income breakdown\n(dine-in vs takeaway · cash vs UPI)"]
    F5["Expense breakdown\n(by category · by vendor)"]
    F6["Cross-branch consolidated\n(owner only)"]
  end

  subgraph SALARY_AN["Salary analytics"]
    S1["Monthly salary cost trend"]
    S2["Salary as % of revenue\n(key health metric)"]
    S3["Cost by role\n(kitchen vs floor vs delivery)"]
    S4["Advance frequency per staff\n(financial stress indicator)"]
    S5["Absenteeism rate\n(rolling 3-month window)"]
  end

  ENGINE --> FINANCIAL
  ENGINE --> SALARY_AN

  subgraph EXPORT["Export formats"]
    EX1["Monthly summary PDF\n(for accountant · printable)"]
    EX2["CSV per module\n(staff · attendance · expenses · income · payroll)"]
    EX3["Full Excel monthly dump\n(one sheet per module)"]
  end

  FINANCIAL --> EXPORT
  SALARY_AN --> EXPORT

  subgraph RULES["Report rules"]
    R1["Only locked EOD entries counted\n(drafts excluded)"]
    R2["Deleted expenses excluded\n(deleted_at IS NOT NULL)"]
    R3["Cross-branch consolidated — owner only"]
    R4["Export — owner only"]
  end
```

---

---

## MAP 13 — POS & billing module (Phase 4)

How POS integrates with the rest of the system and replaces manual entry.

```mermaid
flowchart TD
  ORDER["Order taken at table or counter\n(dine-in or takeaway)"]
  ORDER --> ITEMS["Items selected from menu\n(linked to live menu_items table)"]
  ITEMS --> BILL["Bill generated\n(itemised · GST line if applicable)"]
  BILL --> PAY_TYPE{"Payment type?"}
  PAY_TYPE -->|Cash| CASH["Cash recorded\n(adds to cash total)"]
  PAY_TYPE -->|UPI| UPI["UPI recorded\n(adds to UPI total)"]

  CASH --> DAILY_TOT["Day's running total\n(cash + UPI · dine-in + takeaway)"]
  UPI --> DAILY_TOT

  DAILY_TOT --> AUTO_EOD["Auto-fills EOD income fields\nat end of day\n(replaces manual entry)"]
  AUTO_EOD --> EOD_ENTRY["EOD entry\n(owner only confirms · adds expenses · submits)"]

  ITEMS --> STOCK_CHECK["Stock deduction trigger\n(per item sold · if linked to stock item)"]
  STOCK_CHECK --> INV_UPDATE["Updates inventory quantities\n(auto-reduce · no manual step)"]
  INV_UPDATE --> LOW_CHECK{"Below\nthreshold?"}
  LOW_CHECK -->|Yes| ALERT["Low stock alert on dashboard"]

  subgraph WHAT_CHANGES["What changes when POS goes live"]
    WC1["EOD income section pre-filled\n(owner just reviews · not re-enters)"]
    WC2["Item-level sales data available\n(what sold · when · which branch)"]
    WC3["Stock deduction is automatic\n(no daily manual usage entry)"]
    WC4["Average bill value trackable\n(new analytics dimension)"]
  end
```

---

---

## Summary — module dependency order

The order in which modules must be built, because each depends on the previous.

```mermaid
graph LR
  AUTH["Auth & roles"] --> BRANCH["Multi-branch setup"]
  BRANCH --> STAFF["Staff management"]
  STAFF --> ATT["Attendance"]
  ATT --> PAY["Payroll"]
  BRANCH --> EOD["EOD entry"]
  EOD --> EXP["Expense ledger"]
  BRANCH --> MENU["Menu management"]
  EOD --> DASH["Dashboard"]
  ATT --> DASH
  PAY --> DASH
  EXP --> VEN["Vendor mgmt\n(Phase 2)"]
  MENU --> INV["Inventory\n(Phase 2)"]
  VEN --> REP["Reports\n(Phase 3)"]
  INV --> REP
  PAY --> REP
  EOD --> REP
  REP --> EXP_OUT["Export\n(Phase 3)"]
  MENU --> POS["POS & billing\n(Phase 4)"]
  INV --> POS
  EOD --> POS
```
