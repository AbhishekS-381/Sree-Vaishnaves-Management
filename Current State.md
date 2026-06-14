# Current State

## Application Capabilities
- **Status**: Phase 1 MVP - UI & Read Layer + Auth Complete.
- **Tech Stack**: Next.js 14, TailwindCSS, TypeScript, Local JSON DB, Server Actions.
- **Location**: Root Directory.
- **Theme**: "Sree Vaishnaves" Branding, Dark Mode with Lavender/Lilac Tint.
- **Features**: 
  - **Authentication**: PIN-based Login (Owner/Manager).
  - **Dashboard**: Global stats.
  - **Payroll**: 
    - URL: `/payroll` (was `/tally`).
    - Tracks **Monthly Salaries** and **Days Worked**.
    - Auto-calculates payable amount.
    - Mark as Paid/Pending status.
  - **Staff Management**: 
    - Full CRUD with **Salary** & **Label** fields.
    - Delete & Restore (in future).
  - **Branch Management**: Full CRUD.
  - **Master Data**: Departments & Roles (CRUD).
  - **Security**: Middleware protecting all routes.
