# To Do

## Operational — required once per environment
- [x] **Ran `migrateBranchMenuItemsToShards` against the live Netlify/Neon DB on 2026-09-30.** Executed directly over the connection (not via the Server Action). Result: legacy `branch_menu_items.json` had 4 rows → split into 2 shards of 2 rows each (`Sree Vaishnaves`, `Vaishnaves Classic`), both verified by read-back. Legacy blob **retained** (756 bytes). Re-run confirmed idempotent (both branches skipped, no writes). A full `json_store` backup was taken first to a gitignored `backup-json_store-*.json`.
  - Still to do for **other** environments (e.g. a separate staging DB) if any exist.
  - Optional cleanup: the legacy `branch_menu_items.json` row may be deleted now that both shards are verified.
- [ ] **Ensure `JWT_SECRET` is set in every environment.** Without it `signToken` throws and **login fails at runtime** (the `login` action has no catch around it). It was missing from the local `.env` and has been added for development; verify production has its own distinct secret in Netlify env vars.
- [ ] Consider removing the stale **`rate_limits.json`** row from `json_store` — it's an orphan from an older design (the code uses the real `rate_limit` table). Harmless but confusing.

## High priority — product
- **Publish the managed menu to the public website.** The marketing site at `/` renders a **static, hardcoded** menu section, while the real catalog lives in `menu.json` + per-branch overrides. Every price change must currently be made twice, and the public site can silently drift from reality. Decision (2026-09-30) was to keep them separate *for now*, but this is the highest-priority product gap: wire the website menu to the managed catalog (e.g. ISR/static regeneration reading the catalog at build time).

## Security / hardening (priority)
- **Rotate and remove committed secrets.** `netlify/database/migrations/20260614160000_create_admin_user.sql` creates a Postgres role with a hardcoded password, and `20260614170000_seed_admin_app_user.sql` seeds an app admin with a **plaintext** password. Rotate both, remove from source control, and re-seed the admin via a bcrypt hash.
- Enforce password complexity on user creation/login (currently only non-empty is required).
- Decide on rate-limiter behavior under DB failure (it currently **fails open**).

## Data integrity
- JSON-blob write concurrency: writes are whole-array read-modify-write guarded only by an **in-process** mutex, so concurrent writes from multiple serverless instances are last-write-wins. **Partially addressed** for menu overrides via per-branch sharding (`branch_menu_items_<branchId>.json`); the same pattern is a candidate for other high-churn collections. (See the operational section above for the one-time migration.)
- Clean up `deleteCategory` (`src/app/actions/categories.ts`) — it contains dead/incomplete "warning" logic and leftover developer comments.
- Decide the fate of unused collections `advances.json` and `daily_tally.json` (seeded but not read/written).

## Feature gaps (previously deferred)
- Generate and print individual **PDF salary slips**.
- **Export**: Excel monthly dump and/or a full "data dump" action (CSV export exists in Reports, and now in Menu).
- Link **menu items to inventory** items for ingredient/cost tracking (menu now carries `costPrice`, so food-cost % works today without a recipe BOM).
- Expand the **audit log** coverage and add a read-only audit UI. (Menu is now fully audited; other modules remain partial.)
- Surface **menu price history** in the UI — `menu_price_history.json` is written on every base and branch price change but has no viewer yet.

## Explicitly out of scope (decided 2026-09-30)
- Combos / thali composition, add-ons / modifier groups, tax class / HSN / short codes, recipe-level inventory BOM, and scheduled (effective-dated) pricing.

## Larger initiatives
- **POS & billing**: table/takeaway order capture that auto-feeds EOD income and auto-deducts inventory. (Not started; the EOD `billing` block is entered manually.)

## Testing
- Unit (Vitest) and integration (Playwright) suites exist with coverage thresholds configured and currently **passing**. Keep coverage green as features change; expand Playwright scenarios beyond the current EOD smoke tests — especially menu item edit, bulk repricing and branch cloning.
