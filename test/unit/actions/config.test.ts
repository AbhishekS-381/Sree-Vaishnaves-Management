import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toggleModule, updatePosGstRate } from '@/app/actions/config'
import * as auth from '@/app/actions/auth'
import { revalidatePath } from 'next/cache'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  config: {
    id: 'id',
    attendance: 'attendance',
    payroll: 'payroll',
    vendors: 'vendors',
    inventory: 'inventory',
    menu: 'menu',
    reports: 'reports',
    pos: 'pos',
    posDefaultGstPercent: 'posDefaultGstPercent',
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('config.ts - toggleModule & updatePosGstRate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.onConflictDoUpdate.mockResolvedValue([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true } as any)
  })

  // ─── toggleModule ────────────────────────────────────────────────────────
  it('forbids non-admin users', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'owner' } as any)
    const result = await toggleModule('attendance', false)
    expect(result).toEqual({ error: 'Forbidden: Only admin can toggle modules' })
  })

  it('rejects when there is no session at all', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce(null as any)
    const result = await toggleModule('reports', false)
    expect(result).toEqual({ error: 'Forbidden: Only admin can toggle modules' })
  })

  it('creates default config if empty and toggles module', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const result = await toggleModule('attendance', false)
    expect(result).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/management', 'layout')
  })

  it('updates existing config', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'global', attendance: true, payroll: true, vendors: true, inventory: true, menu: true, reports: true, pos: false, posDefaultGstPercent: 5 }
    ])
    const result = await toggleModule('payroll', false)
    expect(result).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockDb.onConflictDoUpdate).toHaveBeenCalled()
  })

  it('can re-enable a module', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'global', attendance: false, payroll: true, vendors: true, inventory: true, menu: true, reports: true, pos: false, posDefaultGstPercent: 5 }
    ])
    const result = await toggleModule('attendance', true)
    expect(result).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('handles db error in toggleModule', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.onConflictDoUpdate.mockRejectedValueOnce(new Error('db down'))
    const result = await toggleModule('menu', false)
    expect(result).toEqual({ error: 'Transaction failed' })
  })

  // ─── updatePosGstRate ────────────────────────────────────────────────────
  it('forbids non-admin users in updatePosGstRate', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const fd = { get: () => '5' } as any
    const result = await updatePosGstRate({}, fd)
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('validates invalid GST rate', async () => {
    const fd = { get: () => '99' } as any
    const result = await updatePosGstRate({}, fd)
    expect(result).toEqual({ error: 'Invalid GST rate. Must be an integer between 0 and 28.' })
  })

  it('updates GST rate successfully', async () => {
    const fd = { get: () => '18' } as any
    const result = await updatePosGstRate({}, fd)
    expect(result).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/management/settings')
  })

  it('handles db error in updatePosGstRate', async () => {
    mockDb.onConflictDoUpdate.mockRejectedValueOnce(new Error('db down'))
    const fd = { get: () => '5' } as any
    const result = await updatePosGstRate({}, fd)
    expect(result).toEqual({ error: 'Transaction failed' })
  })
})
