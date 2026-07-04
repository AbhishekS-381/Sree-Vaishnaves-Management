# Current State

## Application Capabilities
- **Status**: Phase 1 MVP - UI & Database Layer + Auth Complete.
- **Tech Stack**: Next.js 16 (Turbopack), TailwindCSS, TypeScript, Netlify PostgreSQL (Drizzle ORM), Server Actions.
- **Location**: Root Directory.
- **Theme**: "Sree Vaishnaves" Branding, Dark Mode with Lavender/Lilac Tint.
- **Features**: 
  - **Authentication**: JWT-based Secure Login (Username & Password) with Role-Based Access Control (RBAC).
  - **Dashboard**: Global stats.
  - **System Users**: Full CRUD management of system users and access roles from the Settings page (restricted to Owners).
  - **Settings & Config**: Master data configuration, expense categories, and toggles for enabling/disabling app modules.
  - **Payroll**: 
    - URL: `/payroll`
    - Tracks **Monthly Salaries** and **Days Worked**.
    - Auto-calculates payable amount.
    - Mark as Paid/Pending status.
  - **Staff Management**: 
    - Full CRUD with **Salary**, **Label**, **Shifts**, and **Timings** fields.
    - Timeline view and Open Positions (Staff Requirements) mapping.
  - **Branch Management**: Full CRUD.
  - **Master Data**: Departments & Roles (CRUD).
  - **Security**: Middleware protecting all routes and validating JWT tokens.
