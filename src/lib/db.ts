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
  AUDIT_LOGS: 'audit_logs.json',
  RATE_LIMITS: 'rate_limits.json'
};

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
