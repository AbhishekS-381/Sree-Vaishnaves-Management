import { db } from '../../db/index';

export { db } from '../../db/index';

/**
 * Wraps a callback in a Drizzle database transaction.
 * Supports optional isolation level: 'read committed' | 'repeatable read' | 'serializable'
 */
export async function withDbTransaction<T>(
  callback: (tx: typeof db) => Promise<T>,
  options?: { isolationLevel?: 'read committed' | 'repeatable read' | 'serializable' }
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.transaction(async (tx: any) => {
    return callback(tx as typeof db);
  }, options);
}

// Re-export all tables from schema for single import point
export {
  jsonStore,
  rateLimitTable,
  branches,
  departments,
  roles,
  staff,
  staffRequirements,
  attendance,
  payroll,
  eod,
  expenses,
  categories,
  menuItems,
  menuCategories,
  branchMenuItems,
  branchCategories,
  menuItemVariants,
  menuPriceHistory,
  inventory,
  stockAdjustments,
  vendors,
  posTables,
  posOrders,
  posKots,
  config,
  users,
  auditLogs,
  advances,
  dailyTally,
} from '../../db/schema';
