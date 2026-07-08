import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logAction } from '@/lib/audit'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  writeJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn()
}))

describe('audit.ts - logAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('writes log with system user when no session', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null as any)
    vi.mocked(db.readJSON).mockResolvedValue([])
    vi.mocked(db.writeJSON).mockResolvedValue(undefined)
    await logAction('CREATE', 'STAFF', 'Added a staff member')
    expect(db.writeJSON).toHaveBeenCalledTimes(1)
    const writtenLogs = vi.mocked(db.writeJSON).mock.calls[0][1] as any[]
    expect(writtenLogs[0]).toMatchObject({ action: 'CREATE', userId: 'system', userName: 'system' })
  })

  it('writes audit log with session', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Alice', role: 'owner' } as any)
    vi.mocked(db.readJSON).mockResolvedValue([])
    vi.mocked(db.writeJSON).mockResolvedValue(undefined)
    await logAction('UPDATE', 'EXPENSE', 'Updated expense', 'e1')
    expect(db.writeJSON).toHaveBeenCalledTimes(1)
    const writtenLogs = vi.mocked(db.writeJSON).mock.calls[0][1] as any[]
    expect(writtenLogs).toHaveLength(1)
    expect(writtenLogs[0]).toMatchObject({ action: 'UPDATE', entityType: 'EXPENSE', entityId: 'e1', userId: 'u1', userName: 'Alice' })
  })

  it('handles read failure gracefully (uses empty array)', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Bob', role: 'owner' } as any)
    vi.mocked(db.readJSON).mockRejectedValue(new Error('File not found'))
    vi.mocked(db.writeJSON).mockResolvedValue(undefined)
    await logAction('DELETE', 'VENDOR', 'Removed vendor')
    expect(db.writeJSON).toHaveBeenCalledTimes(1)
  })

  it('catches write errors without throwing', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Bob', role: 'owner' } as any)
    vi.mocked(db.readJSON).mockResolvedValue([])
    vi.mocked(db.writeJSON).mockRejectedValue(new Error('Disk full'))
    // Should not throw
    await expect(logAction('READ', 'REPORT', 'Viewed report')).resolves.toBeUndefined()
  })
})
