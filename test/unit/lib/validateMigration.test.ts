import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSql } = vi.hoisted(() => {
  const mockSql: any = vi.fn();
  mockSql.end = vi.fn().mockResolvedValue(undefined);
  return { mockSql };
});

vi.mock('postgres', () => ({
  default: vi.fn(() => mockSql),
}));

describe('scripts/validate-migration.ts', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...origEnv,
      DATABASE_URL: 'postgres://target:5432/db',
    };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('reports MATCH when json_store and table counts equal', async () => {
    // mock queries alternating between json_store query and SELECT COUNT(*)
    mockSql.mockImplementation((first: any) => {
      if (typeof first === 'string') return first;
      const q = Array.isArray(first) ? first.join('') : String(first);
      if (q.includes('COUNT(*)')) {
        return Promise.resolve([{ count: '1' }]);
      }
      if (q.includes('FROM json_store')) {
        return Promise.resolve([{ data: JSON.stringify([{ id: '1' }]) }]);
      }
      return Promise.resolve([]);
    });

    const { runValidation } = await import('../../../scripts/validate-migration');
    const matched = await runValidation();

    expect(matched).toBe(true);
    expect(mockSql.end).toHaveBeenCalled();
  });

  it('reports MISMATCH when counts differ', async () => {
    mockSql.mockImplementation((first: any) => {
      if (typeof first === 'string') return first;
      const q = Array.isArray(first) ? first.join('') : String(first);
      if (q.includes('COUNT(*)')) {
        return Promise.resolve([{ count: '1' }]);
      }
      if (q.includes('FROM json_store')) {
        return Promise.resolve([{ data: JSON.stringify([{ id: '1' }, { id: '2' }]) }]);
      }
      return Promise.resolve([]);
    });

    const { runValidation } = await import('../../../scripts/validate-migration');
    const matched = await runValidation();

    expect(matched).toBe(false);
  });
});
