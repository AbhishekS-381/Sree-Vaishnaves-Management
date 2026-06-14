# Restaurant Management App — Module Guide
**Document type:** Product · High Level  
**Audience:** Product owner, stakeholders, developers onboarding  
**Version:** v1.0 | Last updated: 2026-03-15

---

## How to read this document

Each module is described from the perspective of the owner. For every module, this document answers:
- **What is the problem right now?** — the manual, painful, or risky thing happening today
- **What does this module do?** — what the system replaces or enables
- **What does the owner experience?** — the actual day-to-day interaction
- **What does this unlock?** — what becomes possible downstream because of this data

---

---

# MODULE 1 — Home Dashboard

## What is the problem right now?
The owner has to physically visit or call each branch to know what's happening. There is no single place where he can see "is Branch 1 doing well today? Did the manager mark attendance at Branch 2? Do I need to approve payroll this week?" Each of these requires a separate conversation or visit.

## What does this module do?
The dashboard is the first screen after login. It gives the owner a complete snapshot of both branches in a single view — today's income, today's attendance headcount, and any pending actions that need his attention. Branch managers see the same but scoped to their own branch only.

## What does the owner experience?
He opens the app on his phone. Without tapping anything, he sees:
- How much each branch has made today (dine-in and takeaway separately)
- How many staff are present at each branch
- Whether the EOD entry has been filled
- Whether payroll is due this month
- Any alerts needing his attention (e.g. "Branch 2 attendance not marked yet")

He can tap any branch card to drill in. He can tap a pending action to go directly to the screen that needs his attention.

## What does this unlock?
Without the dashboard, every other module is a form you open deliberately. With the dashboard, the app becomes a habit — something you open every morning like checking messages. That daily habit is what makes the rest of the system work.

---

---

# MODULE 2 — Staff Management

## What is the problem right now?
Staff records live in the owner's memory and scattered across phone contacts, WhatsApp, and maybe a notebook. There is no reliable place to check: what is Murugan's salary? When did Selvi join? How many waiters do we have on the morning shift? When a staff member leaves, that information just disappears.

## What does this module do?
It maintains a clean, permanent record of every staff member — their role, salary, shift, and joining date. Staff can be deactivated when they leave (their history stays, they just stop appearing in active lists). The list can be filtered by role or shift. Each person has a profile showing their complete history: salary changes, attendance record, advances taken.

## What does the owner experience?
Adding a new staff member takes one minute — name, role, salary, shift. That's all. From that point on, that person appears in attendance, payroll, and analytics automatically. When someone leaves, the owner taps "deactivate" and they're gone from active views but their entire history is preserved.

The staff list groups people by role — all cooks together, all waiters together — making it easy to scan a large team.

## What does this unlock?
Staff data is the foundation of the entire HR side of the system. Without it, attendance has no roster to mark against, payroll has no salaries to calculate from, and analytics cannot break down costs by role.

---

---

# MODULE 3 — Daily Attendance

## What is the problem right now?
Attendance is marked in a register — a notebook that lives at the restaurant. Someone has to physically sign or be ticked off each morning. At the end of the month, someone (often the owner) manually counts present days per person to calculate salary. With 35 staff, this takes significant time and is error-prone.

## What does this module do?
It replaces the physical register with a digital one, optimised for speed. The key design insight: **most days, most staff are present.** So instead of marking each person one by one, the manager taps "Mark all present" and then only changes the few exceptions — the one person who called in sick, the one on leave.

For 35 staff, the daily attendance process takes under 60 seconds.

Marking a day as a holiday (festival, branch closed) marks everyone at once with a single tap and automatically excludes that day from salary calculations.

## What does the owner experience?
**Morning routine:** The manager opens the attendance screen. Taps "Mark all present." The system marks all 35 staff in one action. The manager then taps the 2–3 people who are absent or on half-day. Done in under a minute.

**Month end:** The owner no longer counts days manually. The payroll module reads the attendance records and calculates everything automatically.

**Looking back:** If the owner needs to check when a particular person was absent three months ago, it's searchable — not buried in a notebook.

## What does this unlock?
Attendance is what makes payroll possible. Without clean daily attendance records, salary calculations are guesswork. With 6 months of attendance data, the analytics module can also show absenteeism patterns — who is frequently absent, which roles have the highest absence rate.

---

---

# MODULE 4 — Payroll

## What is the problem right now?
Every month, the owner calculates 35 salaries by hand. He counts the days each person worked, applies the absent deductions, subtracts any advances given, and arrives at a final number. This takes hours, is done under pressure (staff need to be paid), and any arithmetic error means either overpaying or underpaying someone — both are bad.

There is no paper trail. If a staff member disputes their salary, there is no structured record to refer back to.

## What does this module do?
At the end of the month, the owner opens the payroll screen and taps "Generate payroll." The system reads every attendance record for the month, applies the salary formula for each person, subtracts any recorded advances, and produces a complete salary table — all 35 staff on one screen with their calculated amounts.

The owner reviews the numbers. If anything looks wrong, he can override an individual amount and add a note explaining why. When he is satisfied, he taps "Approve all" and the month is locked.

Every staff member's salary slip can be downloaded as a PDF.

## What does the owner experience?
What used to take 2–3 hours of manual calculation now takes 10–15 minutes of review and approval. The owner's job shifts from calculating to verifying — which is a much better use of his expertise.

The salary formula is transparent and consistent:
> *Final salary = (days present + half days × 0.5) ÷ working days × base salary − advances*

If the restaurant was closed for a festival, those days are excluded from the denominator automatically — staff are not penalised for a closure the owner decided.

## What does this unlock?
Payroll records feed directly into the analytics module — the owner can track total salary cost per month, salary as a percentage of revenue, and how those ratios trend over time. This is one of the most important health metrics for a restaurant and currently completely invisible.

---

---

# MODULE 5 — Daily EOD Entry

## What is the problem right now?
At the end of each day, the owner has a rough sense of how much came in and how much went out. But this lives entirely in his head or in a cash book that is hard to search, hard to analyse, and easy to lose. There is no way to look back and say: "How did we do on the last Sunday of February compared to this Sunday?"

There is also a cash reconciliation problem — cash received through the day, cash paid out for expenses, and the cash remaining in the drawer should always balance. Right now, discrepancies are noticed but rarely investigated because there is no record to trace back.

## What does this module do?
Every evening, after closing, the owner or manager fills in the EOD (End of Day) entry. It takes under 2 minutes. It captures:

- **Income** — how much came in from dine-in, how much from takeaway, split between cash and UPI
- **Expenses** — what was spent today, tapped by category (raw materials, gas, electricity, etc.)
- **Petty cash** — opening and closing cash in the drawer (optional but useful for reconciliation)
- **Notes** — anything unusual about the day (power cut, big catering order, staff issue)

The entry is saved and locked after 24 hours. The owner can unlock any entry if a correction is needed.

If the internet is down, the entry is saved as a draft on the device and automatically submitted when connectivity returns.

## What does the owner experience?
The screen is designed to feel like filling in a diary, not operating software. Income fields are prominent at the top. Expense categories are shown as tap-to-add buttons — he taps "Raw materials", enters ₹4,500, done. The running net (income minus expenses) updates live as he types.

He sees immediately: today was a ₹22,000 income day with ₹8,000 expenses — ₹14,000 net.

## What does this unlock?
The EOD entry is the single most important data source in the entire system. Every financial report, every trend chart, every P&L statement is built from these daily records. Six months of consistent EOD entries transforms a business with no financial visibility into one where every day is accounted for and every month tells a clear story.

When Phase 4 (POS) arrives, the billing system will fill in the income section automatically — the owner will only need to confirm and add expenses.

---

---

# MODULE 6 — Expense Ledger

## What is the problem right now?
Expenses are recorded inconsistently — sometimes in the EOD cash book, sometimes on a loose receipt, sometimes just remembered. When the owner wants to know how much was spent on raw materials last month, there is no reliable answer. Vendor bills are paid and filed with no easy way to review patterns.

## What does this module do?
All expenses flow into a single shared ledger regardless of where they were entered. An expense added during the evening EOD entry and an expense added while reviewing vendor bills both land in the same place.

The ledger can be filtered by date, category, or vendor. It gives a clear answer to: "How much did we spend on gas over the last 3 months?"

The key design decision: the EOD screen and the vendor management screen both write to the same underlying ledger. There is no separate "daily expenses" and "vendor expenses" — it is one source of truth. This prevents double entry and ensures reports are always complete.

## What does the owner experience?
During EOD entry: he taps expense categories and enters amounts. Fast and simple.

During vendor management (Phase 2): he adds a bill with the vendor's name, invoice reference, and amount. This also appears in the EOD view for that day — he never enters the same expense twice.

If he needs to correct an expense (wrong amount, wrong category), he does it from the vendor screen. He cannot edit from the EOD screen — that screen is insert-only to prevent accidental changes during the quick evening entry.

## What does this unlock?
Clean expense data enables every cost-related insight in Phase 3: what is the biggest expense category, is raw material cost trending up, how much was paid to a specific vendor over 6 months. Without clean expense data, a P&L is just income minus a guess.

---

---

# MODULE 7 — Menu Management

## What is the problem right now?
The menu exists as physical boards, printed sheets, or in the owner's head. Updating a price means reprinting something or telling everyone verbally. There is no easy way for the system to know what items the restaurant sells or at what price.

## What does this module do?
A simple, clean list of every menu item — name, category, price, and whether it's available today. Items can be toggled available/unavailable instantly (e.g. "we ran out of fish curry today"). Prices can be updated at any time. Each branch has its own menu.

## What does the owner experience?
Primarily a reference and maintenance tool in Phase 1. The owner adds all menu items once during setup. After that, it requires minimal attention — occasional price updates and toggling items when they're not available for the day.

## What does this unlock?
Menu data becomes essential in Phase 2 (linking menu items to ingredients for cost tracking) and Phase 4 (POS uses the menu to build orders). Setting it up correctly in Phase 1 means those later phases have a solid foundation to build on.

---

---

# MODULE 8 — Inventory & Stock
*(Phase 2 — 6 to 12 months)*

## What is the problem right now?
Stock levels are managed by eye and experience. The cook knows roughly how much rice is left; the owner trusts the cook's judgement. This works until it doesn't — and running out of a key ingredient mid-service is both costly and embarrassing.

There is no record of how much was ordered from which supplier, no way to compare this month's raw material cost to last month, and no early warning before something runs out.

## What does this module do?
It gives every ingredient and supply item a tracked quantity. When stock arrives (a delivery from the vegetable vendor), the manager adds it. When daily usage is logged, the quantity reduces. When any item drops below a set threshold, an alert appears on the dashboard.

Every adjustment — in or out — is recorded with a reason. Over time, this builds a picture of consumption patterns.

## What does the owner experience?
He sets a low-stock threshold for each important ingredient — say, 5 kg for rice. When the kitchen is down to 4 kg, the dashboard shows an alert: "Rice — low stock (4 kg remaining)." He calls the supplier. No more running out mid-service.

At month end, the total stock purchased feeds directly into the expense analysis — he can see raw material cost broken down by ingredient type.

## What does this unlock?
With consumption data, the owner can start to understand the true cost of running each menu item, identify waste and spoilage patterns, and negotiate better with suppliers from a position of data rather than guesswork.

---

---

# MODULE 9 — Vendor & Supplier Management
*(Phase 2 — 6 to 12 months)*

## What is the problem right now?
The restaurant buys from multiple vendors daily — vegetables, dairy, gas, packaging, cleaning supplies. Payments are made in cash or UPI with no structured record. The owner cannot easily answer: "How much did we pay Kumar Vegetables this month? Do we owe any supplier money?"

## What does this module do?
It maintains a contact record for every regular supplier — name, what they supply, phone number. Every purchase from a supplier is recorded as a bill against that vendor's profile. Bills can be marked as paid or outstanding.

This module also provides the "full edit" capability for the shared expense ledger — the owner can update or correct any expense from here, whereas the quick EOD screen only allows adding.

## What does the owner experience?
When the vegetable supplier delivers and presents a bill for ₹3,800, the manager records it here — linked to the vendor, with the amount and date. It automatically appears in that day's expense view. At month end, the owner can see a complete payment history per vendor.

If a supplier is overcharging or if costs are creeping up month over month, it becomes visible here — not something the owner has to try to remember.

## What does this unlock?
Vendor data connects expenses to their source — a critical step toward understanding true cost of goods. It also enables Phase 3 analytics to break down raw material costs by supplier category.

---

---

# MODULE 10 — Reports & Analytics
*(Phase 3 — 12 to 18 months)*

## What is the problem right now?
The owner operates on instinct. He knows this month felt busier than last month, or that costs felt higher, but he cannot quantify it. He cannot show a bank manager a P&L. He cannot identify which days of the week are consistently weak. He cannot tell whether salary costs are sustainable relative to revenue.

## What does this module do?
It turns 12+ months of accumulated daily data into clear, readable reports. It answers the questions a business owner actually asks:

- "Are we doing better than last month?"
- "What is eating the most cost in the business?"
- "What percentage of our revenue goes to salaries?"
- "Which branch is more profitable?"
- "Which days of the week perform best?"

It also produces a monthly summary PDF the owner can hand to his accountant — a clean, printable record of income, expenses, payroll cost, and net profit.

## What does the owner experience?
He opens the reports screen and sees income for this month vs last month — ₹5.7 lakh this month vs ₹5.1 lakh last month, up 11.8%. Below that, expenses broken down by category — raw materials 35%, salaries 54%, rent 9%, other 2%. He immediately sees that salary as a percentage is high this month and can investigate.

He can switch between branches or see a consolidated view across both.

Data export lets him download everything as Excel for his accountant or for his own analysis.

## What does this unlock?
This module is the culmination of the entire system. Everything built in Phases 1 and 2 was data collection. Phase 3 is where that data becomes insight. It is also what makes the business truly transferable — the new owner inherits not just the operations but the business intelligence.

---

---

# MODULE 11 — POS & Billing
*(Phase 4 — 18 to 24 months)*

## What is the problem right now?
Billing is currently done on paper KOTs (kitchen order tickets) or a basic standalone billing app with no connection to the management system. The daily income total is manually counted and entered into the EOD form each evening. There is no connection between what was sold and what was reported.

## What does this module do?
It replaces the standalone billing system with one that is natively integrated into the management platform. Every order taken at a table or for takeaway flows through the system. Bills are generated with item-level detail. Payment type (cash or UPI) is captured at the point of sale.

At the end of the day, the EOD income fields fill themselves automatically from the day's billing records. The owner's evening routine becomes even simpler — just review, add expenses, and submit.

## What does the owner experience?
The waiter or cashier takes an order on the POS screen. Items are selected from the menu, the bill is generated, and the customer pays. Cash or UPI is recorded at the time of payment. No manual tally at the end of the day — the system has been counting all day.

The owner's evening routine: open EOD entry, see income already filled in from the day's bills, add today's expenses, review the net, submit. Two minutes, maximum.

## What does this unlock?
With POS data, the system can answer the most granular business questions: which menu item sells the most, what is the average bill value, what is the peak ordering hour, which waiter handles the most tables. This is the data layer that separates a managed business from a guessed one.

It also enables automatic stock deduction — every dish sold reduces ingredient quantities — closing the loop between sales, inventory, and purchasing.

---

---

# System-wide features

## Multi-branch architecture

Everything in this system is branch-aware from the ground up. Every piece of data — staff, attendance, expenses, income, inventory — belongs to a specific branch.

The owner sees everything across both branches. A branch manager sees only their branch. This means one app, two branches, zero confusion about whose data is whose.

Adding Branch 2 when it opens requires no code changes — just a new branch entry in the system and assigning the manager to it.

## Audit trail

Every change made in the system is silently recorded: who changed it, what it was before, what it is now, and when. This is invisible to users in normal operation but protects the owner if there is ever a dispute — "who changed this salary figure and when?" becomes an answerable question.

## In-app reminders

The system generates gentle, timely nudges for things that need attention:
- Attendance not marked today
- EOD entry not filled by 10pm
- Payroll due before month end
- Low stock (Phase 2)

These appear as banners on the dashboard. They are reminders, not blockers — the owner is never prevented from doing anything, just informed.

## Data safety

No data is ever permanently deleted. Removing a staff member, deleting an expense, deactivating a menu item — all of these hide the record from active views but preserve it in the database. This means mistakes are always recoverable and historical data is always intact for reporting.
