import { vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockDb(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: vi.fn().mockImplementation(async (cb: any) => cb(mockDb)),
  };

  return mockDb;
}

export const buildMockDb = createMockDb;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMockWithDbTransaction(mockDb: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.fn().mockImplementation(async (cb: any) => cb(mockDb));
}
