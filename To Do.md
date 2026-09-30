# To Do

## Security / hardening (priority)
- **Rotate and remove committed secrets.** `netlify/database/migrations/20260614160000_create_admin_user.sql` creates a Postgres role with a hardcoded password, and `20260614170000_seed_admin_app_user.sql` seeds an app admin with a **plaintext** password. Rotate both, remove from source control, and re-seed the admin via a bcrypt hash.
- Enforce password complexity on user creation/login (currently only non-empty is required).
- Decide on rate-limiter behavior under DB failure (it currently **fails open**).

## Data integrity
- Address JSON-blob write concurrency: writes are whole-array read-modify-write guarded only by an **in-process** mutex, so concurrent writes from multiple serverless instances are last-write-wins. Consider row-level updates, optimistic versioning, or moving hot collections to real tables.
- Clean up `deleteCategory` (`src/app/actions/categories.ts`) — it contains dead/incomplete "warning" logic and leftover developer comments.
- Decide the fate of unused collections `advances.json` and `daily_tally.json` (seeded but not read/written).

## Feature gaps (previously deferred)
- Generate and print individual **PDF salary slips**.
- **Export**: Excel monthly dump and/or a full "data dump" action (only CSV export from Reports exists today).
- Link **menu items to inventory** items for ingredient/cost tracking.
- Expand the **audit log** coverage (currently only staff create/delete, attendance save, EOD save, expense edit/delete) and add a read-only audit UI.

## Larger initiatives
- **POS & billing**: table/takeaway order capture that auto-feeds EOD income and auto-deducts inventory. (Not started; the EOD `billing` block is entered manually.)
- Evaluate migrating the static marketing website content into a manageable surface if the business wants to edit it in-app.

## Testing
- Unit (Vitest) and integration (Playwright) suites exist with coverage thresholds configured. Keep coverage green as features change; expand Playwright scenarios beyond the current EOD smoke tests.
