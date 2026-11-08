import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

const { mockInsert, mockValues, mockOnConflictDoUpdate, mockOnConflictDoNothing } = vi.hoisted(() => {
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const mockValues = vi.fn().mockReturnValue({
    onConflictDoUpdate: mockOnConflictDoUpdate,
    onConflictDoNothing: mockOnConflictDoNothing,
  });
  const mockInsert = vi.fn().mockReturnValue({
    values: mockValues,
  });

  return {
    mockInsert,
    mockValues,
    mockOnConflictDoUpdate,
    mockOnConflictDoNothing,
  };
});

vi.mock('../../../db/index', () => ({
  db: {
    insert: mockInsert,
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedAdminPassword'),
  },
}));

describe('db/seed.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs typed seeds for config, branches, departments, roles, categories, and admin user', async () => {
    const { seed } = await import('../../../db/seed');
    await seed();

    expect(mockInsert).toHaveBeenCalled();
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1); // config
    expect(mockOnConflictDoNothing).toHaveBeenCalled(); // branches, depts, roles, categories, user
    expect(bcrypt.hash).toHaveBeenCalled();
  });
});
