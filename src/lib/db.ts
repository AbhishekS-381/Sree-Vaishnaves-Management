import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';

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

// This ensures we look for data in the correct place relative to the project root
// When running in Next.js dev mode, process.cwd() is the project root (web folder)
export const DATA_DIR = process.env.NODE_ENV === 'test' 
  ? path.join(process.cwd(), 'test-db') 
  : path.join(process.cwd(), 'data');

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
  AUDIT_LOGS: 'audit_logs.json'
};

// Lazy initialization of MySQL pool
let pool: mysql.Pool | null = null;

async function getMysqlPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.MYSQL_URI || 'mysql://root:password@localhost:3306/restaurant_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Auto-create the unified table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS JsonStore (
          filename VARCHAR(255) PRIMARY KEY,
          data LONGTEXT
        );
      `);
    } catch (e) {
      console.error("Failed to initialize MySQL Table:", e);
    }
  }
  return pool;
}

export async function readJSON<T>(filename: string): Promise<T[]> {
  if (process.env.DB_TYPE === 'MYSQL') {
    try {
      const db = await getMysqlPool();
      const [rows] = await db.query<any>('SELECT data FROM JsonStore WHERE filename = ?', [filename]);
      if (rows && rows.length > 0) {
        return JSON.parse(rows[0].data) as T[];
      }
      return [];
    } catch (error) {
       console.error(`MySQL Error reading ${filename}:`, error);
       return [];
    }
  }

  // Fallback to pure local JSON storage
  const filePath = path.join(DATA_DIR, filename);
  try {
    let data = await fs.readFile(filePath, 'utf-8');
    // Strip BOM if present
    if (data.charCodeAt(0) === 0xFEFF) {
      data = data.slice(1);
    }
    return JSON.parse(data) as T[];
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    // If we assume all files contain arrays. 
    return [];
  }
}

export async function writeJSON<T>(filename: string, data: T[]): Promise<boolean> {
  if (process.env.DB_TYPE === 'MYSQL') {
    try {
      const db = await getMysqlPool();
      const jsonString = JSON.stringify(data);
      await db.query(`
        INSERT INTO JsonStore (filename, data) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE data = VALUES(data)
      `, [filename, jsonString]);
      return true;
    } catch (error) {
      console.error(`MySQL Error writing ${filename}:`, error);
      return false;
    }
  }

  // Fallback to pure local JSON storage
  const filePath = path.join(DATA_DIR, filename);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
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
