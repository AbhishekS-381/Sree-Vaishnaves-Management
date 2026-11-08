import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockInsert, mockValues, mockOnConflictDoUpdate, mockSourceSql, mockTargetSql } = vi.hoisted(() => {
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const mockValues = vi.fn().mockReturnValue({
    onConflictDoUpdate: mockOnConflictDoUpdate,
  });
  const mockInsert = vi.fn().mockReturnValue({
    values: mockValues,
  });

  const mockSourceSql: any = vi.fn();
  mockSourceSql.end = vi.fn().mockResolvedValue(undefined);

  const mockTargetSql: any = vi.fn();
  mockTargetSql.end = vi.fn().mockResolvedValue(undefined);

  return {
    mockInsert,
    mockValues,
    mockOnConflictDoUpdate,
    mockSourceSql,
    mockTargetSql,
  };
});

vi.mock('postgres', () => ({
  default: vi.fn((url: string) => {
    return url.includes('source') ? mockSourceSql : mockTargetSql;
  }),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    insert: mockInsert,
  })),
}));

describe('scripts/migrate-from-json-store.ts', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...origEnv,
      SOURCE_DATABASE_URL: 'postgres://source:5432/db',
      DATABASE_URL: 'postgres://target:5432/db',
    };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('reads json_store rows, writes backup, and inserts into tables', async () => {
    mockSourceSql.mockResolvedValueOnce([
      { filename: 'branches.json', data: JSON.stringify([{ id: 'br_1', name: 'Branch 1', status: 'operational' }]) },
      { filename: 'config.json', data: JSON.stringify([{ id: 'global', pos: true }]) },
    ]);

    const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => '');

    const { runMigration } = await import('../../../scripts/migrate-from-json-store');
    const result = await runMigration();

    expect(result).toBe(true);
    expect(fsSpy).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockSourceSql.end).toHaveBeenCalled();
    expect(mockTargetSql.end).toHaveBeenCalled();

    fsSpy.mockRestore();
    mkdirSpy.mockRestore();
  });
});

