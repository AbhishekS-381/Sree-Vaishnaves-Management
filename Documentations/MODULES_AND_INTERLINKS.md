# Application Modules & Architecture Interlinks

This document outlines the core modules implemented within the Restaurant Management System and details how data flows and interlinks between them to automate daily operations.

## 📦 Core Modules Implemented

1. **Dashboard:** The central command center aggregating daily stats and pending alerts.
2. **Staff Management:** Profiles, roles, shift types, and basic salary configurations for employees.
3. **Daily Attendance:** Daily tracking of staff presence, half-days, or absences.
4. **Payroll:** Automated generation of monthly salary payables based on days worked and recorded advances.
5. **EOD Daily Entry:** Fast-entry system for submitting total daily collection (Dine-in/Takeaway x Cash/UPI) and logging ad-hoc daily expenses.
6. **Expense Ledger:** The master ledger that aggregates all operational and supply chain expenses.
7. **Menu Management:** The catalog of available items, categories, and dynamic availability toggles.
8. **Inventory & Stock:** Tracking of raw materials, units, low-stock thresholds, and manual adjustments.
9. **Vendors & Bills:** Database of suppliers and the interface for recording purchase invoices.
10. **Reports & Analytics:** Generates monthly P&L statements, Net Profit calculations, and visual breakdowns of revenue/expenses.
11. **Settings / Config:** Global configurations to manage Branches, Roles, Departments, and Expense Categories.

---

## 🔗 How Modules are Interlinked

The true power of the system comes from its data coupling. Modules actively share data to prevent double-entry and enforce operational logic.

### ⚙️ Highly Interlinked (Automated Flows)

**1. Staff Management ↔ Daily Attendance ↔ Payroll**
- You cannot mark attendance without `Staff` profiles. 
- The `Payroll` module completely relies on parsing the `Daily Attendance` logs to auto-calculate the exact "Days Worked" for the month. It also factors in any `Salary Advances` recorded before generating the final payable amount.

**2. EOD Daily Entry ↔ Expense Ledger**
- When a manager submits the daily EOD, any "Daily Expenses" added during that shift (like quick runs for ice, fuel, or petty cash usage) are automatically injected straight into the shared `Expense Ledger`.

**3. Vendors & Bills ↔ Expense Ledger**
- When you record a purchase bill for a vendor (e.g., buying 10kg of chicken), the system automatically takes that bill amount, category, and date, and writes it directly into the `Expense Ledger`. Unpaid bills are tracked directly on the vendor profile.

**4. Everything ↔ Reports & Analytics**
- This is the ultimate consumer module. It calculates the final **Net Profit** by reading:
  - **Total Revenue** from `EOD Daily Entry`
  - **Total Expenses** from the `Expense Ledger`
  - **Total Salary Costs** from `Payroll`

**5. Everything ↔ Dashboard**
- The Dashboard aggregates live updates. It reads `EOD` for today's collection, `Staff` for the active employee count, and scans `Attendance` (missing logs), `EOD` (unfilled shifts), `Inventory` (low stock), and `Payroll` (due generation) to feed the intelligent "Pending Actions" Notification Widget.

---

## 🏝️ Decoupled / Independent Modules

These modules currently operate in their own silos. They are functional on without needing operational data from other parts of the system (outside of basic Branch settings).

**1. Menu Management**
- **Current State:** Acts as a digital catalog for your items, prices, and availability toggles. 
- *(Future State: Will interlink strictly with the Phase 4 POS for billing, and Inventory for automatic ingredient deduction).*

**2. Inventory & Stock**
- **Current State:** You manually add items, set thresholds, and manually log stock adjustments (+ / -) when shipments arrive or stock is consumed.
- *(Future State: Will interlink with Vendors so that recording a vendor bill automatically adds to the inventory quantity, and POS orders automatically decrease it).*

**3. Settings (Configuration)**
- **Current State:** Every module reads from Settings to map data to a specific `BranchId` or `RoleId`, but the Settings module inherently dictates the ground rules rather than consuming live operational data.

---

## 🎛️ Module Feature Toggling (Core vs Layer vs Optional)

The application features a progressive roll-out philosophy, giving you complete control over the system's complexity. You can actively enable or disable modules within the **Settings -> Module Features**.

### 🔴 Core Modules (Always On)
These are the foundational blocks required to track basic restaurant operations and simple cash flow:
- **Settings:** Required to manage Branch contexts.
- **Staff Management:** Required to operate the application and track base employee information.
- **EOD Daily Entry:** Required to track "Money In" (Revenue).
- **Expense Ledger:** Required to track "Money Out" (Daily expenses).
- **Dashboard:** The visual anchor.

### 🟡 Layer Modules (Toggleable)
These modules sit *on top* of the Core Modules, pulling data from them to provide automated management features and advanced analytics. If toggled off in Settings:
- They completely disappear from the Navigation sidebar.
- Their specific warnings in the Dashboard's "Pending Actions" widget are silenced (e.g., turning off Inventory stops "Low Stock" alerts).
1. **Daily Attendance:** Layers onto *Staff Management*.
2. **Payroll:** Layers onto *Attendance*.
3. **Vendors & Bills:** Layers onto the *Expense Ledger*.
4. **Reports & Analytics:** Layers onto *EOD, Ledger, and Payroll* output.
5. **Inventory & Stock:** Layers onto general supply operations.

### 🟢 Optional Modules (Toggleable)
These standalone tools are completely isolated.
1. **Menu Management:** Currently acts solely as a digital reference catalog for your items. Turning this off does not impact any financial calculations.
