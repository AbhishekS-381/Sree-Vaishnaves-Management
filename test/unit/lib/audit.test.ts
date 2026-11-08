import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAction } from '@/lib/audit';
import * as auth from '@/app/actions/auth';
import { buildMockDb } from '../drizzleMock';

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
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
    transaction: vi.fn().mockImplementation(async (cb: any) => cb(mock)),
  };
  return { mockDb: mock };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
  auditLogs: { timestamp: 'timestamp' },
}));

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
}));

describe('audit.ts - logAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockResolvedValue([]);
    mockDb.execute.mockResolvedValue([]);
    mockDb.from.mockResolvedValue([{ count: 10 }]);
  });

  it('writes log with system user when no session', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValue(null as any);
    await logAction('CREATE', 'STAFF', 'Added a staff member');

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb.values).toHaveBeenCalledTimes(1);
    const inserted = mockDb.values.mock.calls[0][0];
    expect(inserted).toMatchObject({ action: 'CREATE', userId: 'system', userName: 'system' });
  });

  it('writes audit log with session', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Alice', role: 'owner' } as any);
    await logAction('UPDATE', 'EXPENSE', 'Updated expense', 'e1');

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const inserted = mockDb.values.mock.calls[0][0];
    expect(inserted).toMatchObject({
      action: 'UPDATE',
      entityType: 'EXPENSE',
      entityId: 'e1',
      userId: 'u1',
      userName: 'Alice',
    });
  });

  it('catches write errors without throwing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Bob', role: 'owner' } as any);
    mockDb.values.mockRejectedValueOnce(new Error('Disk full'));

    // Should not throw
    await expect(logAction('READ', 'REPORT', 'Viewed report')).resolves.toBeUndefined();
  });

  it('falls back to system user when getSession throws', async () => {
    vi.mocked(auth.getSession).mockRejectedValueOnce(new Error('no cookie store'));
    await logAction('CREATE', 'STAFF', 'x');

    const inserted = mockDb.values.mock.calls[0][0];
    expect(inserted).toMatchObject({ userId: 'system', userName: 'system' });
  });

  it('trims to the most recent 3000 entries when count exceeds 3000', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Alice' } as any);
    mockDb.from.mockResolvedValueOnce([{ count: 3005 }]);

    await logAction('NEW', 'STAFF', 'newest');

    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  it('does not trim when count is <= 3000', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Alice' } as any);
    mockDb.from.mockResolvedValueOnce([{ count: 2500 }]);

    await logAction('NEW', 'STAFF', 'newest');

    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('handles empty count result gracefully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Alice' } as any);
    mockDb.from.mockResolvedValueOnce([]);

    await logAction('NEW', 'STAFF', 'newest');

    expect(mockDb.execute).not.toHaveBeenCalled();
  });
});
