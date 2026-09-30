import { db } from '../../db/index';
import { jsonStore } from '../../db/schema';
import { eq } from 'drizzle-orm';

class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async lock() {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  unlock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }
}

const fileMutexes: Record<string, Mutex> = {};

function getMutex(filename: string) {
  if (!fileMutexes[filename]) {
    fileMutexes[filename] = new Mutex();
  }
  return fileMutexes[filename];
}

export const DB_FILES = {
  BRANCHES: 'branches.json',
  DEPARTMENTS: 'departments.json',
  ROLES: 'roles.json',
  STAFF: 'staff.json',
  DAILY_TALLY: 'daily_tally.json',
  PAYROLL: 'payroll.json',
  ATTENDANCE: 'attendance.json',
  EOD: 'eod.json',
  EXPENSES: 'expenses.json',
  MENU: 'menu.json',
  INVENTORY: 'inventory.json',
  VENDORS: 'vendors.json',
  STOCK_ADJUSTMENTS: 'stock_adjustments.json',
  ADVANCES: 'advances.json',
  CONFIG: 'config.json',
  CATEGORIES: 'categories.json',
  USERS: 'users.json',
  STAFF_REQUIREMENTS: 'staff_requirements.json',
  MENU_CATEGORIES: 'menu_categories.json',
  BRANCH_MENU_ITEMS: 'branch_menu_items.json',
  BRANCH_CATEGORIES: 'branch_categories.json',
  MENU_ITEM_VARIANTS: 'menu_item_variants.json',
  MENU_PRICE_HISTORY: 'menu_price_history.json',
  AUDIT_LOGS: 'audit_logs.json'
};

/**
 * Per-branch shard filename for branch menu overrides.
 *
 * `branch_menu_items.json` used to hold the entire item × branch cross-product,
 * so flipping one availability flag rewrote every branch's rows. Sharding by
 * branch cuts write amplification proportionally to the branch count and gives
 * each branch its own mutex, so two managers can never clobber each other.
 */
export function branchMenuItemsFile(branchId: string): string {
  return `branch_menu_items_${branchId}.json`;
}

/**
 * Read a branch's menu overrides, falling back to the legacy combined blob for
 * branches that have not been migrated yet. Read-only — never writes.
 */
export async function readBranchMenuItems<T extends { branchId: string }>(branchId: string): Promise<T[]> {
  const shard = await readJSON<T>(branchMenuItemsFile(branchId));
  if (shard.length > 0) return shard;

  const legacy = await readJSON<T>(DB_FILES.BRANCH_MENU_ITEMS);
  return legacy.filter(row => row.branchId === branchId);
}

/**
 * Transaction against a single branch's shard.
 * On first write for a branch, seeds the shard from the legacy blob so the
 * migration is lazy and no data is lost if the one-shot migration never ran.
 */
export async function withBranchMenuTransaction<T extends { branchId: string }>(
  branchId: string,
  callback: (data: T[]) => T[] | Promise<T[]>
): Promise<boolean> {
  const file = branchMenuItemsFile(branchId);

  const existing = await readJSON<T>(file);
  if (existing.length === 0) {
    const legacy = await readJSON<T>(DB_FILES.BRANCH_MENU_ITEMS);
    const seed = legacy.filter(row => row.branchId === branchId);
    if (seed.length > 0) {
      await writeJSON<T>(file, seed);
    }
  }

  return withTransaction<T>(file, callback);
}

export async function readJSON<T>(filename: string): Promise<T[]> {
  try {
    const rows = await db.select().from(jsonStore).where(eq(jsonStore.filename, filename));
    if (rows.length > 0) {
      return JSON.parse(rows[0].data) as T[];
    }
    return [];
  } catch (error) {
    console.error(`PostgreSQL Error reading ${filename}:`, error);
    return [];
  }
}

export async function writeJSON<T>(filename: string, data: T[]): Promise<boolean> {
  try {
    const jsonString = JSON.stringify(data);
    await db.insert(jsonStore)
      .values({ filename, data: jsonString })
      .onConflictDoUpdate({ target: jsonStore.filename, set: { data: jsonString } });
    return true;
  } catch (error) {
    console.error(`PostgreSQL Error writing ${filename}:`, error);
    return false;
  }
}

export async function withTransaction<T>(filename: string, callback: (data: T[]) => Promise<T[]> | T[]): Promise<boolean> {
  const mutex = getMutex(filename);
  await mutex.lock();
  try {
    const data = await readJSON<T>(filename);
    const updatedData = await callback(data);
    return await writeJSON<T>(filename, updatedData);
  } catch (error) {
    console.error(`Transaction failed for ${filename}:`, error);
    return false;
  } finally {
    mutex.unlock();
  }
}
