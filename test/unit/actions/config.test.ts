import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toggleModule } from '@/app/actions/config'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import { revalidatePath } from 'next/cache'

vi.mock('@/lib/db', () => ({
  writeJSON: vi.fn().mockResolvedValue(true),
  readJSON: vi.fn().mockResolvedValue([]),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ role: 'admin' })
}))

describe('config.ts - toggleModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'admin' } as any)
  })

  it('forbids non-admin users', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner' } as any)
    const result = await toggleModule('attendance', false)
    expect(result).toEqual({ error: 'Forbidden: Only admin can toggle modules' })
  })

  it('creates default config if list is empty and toggles module', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([])
    const result = await toggleModule('attendance', false)
    
    expect(result).toEqual({ success: true })
    expect(db.writeJSON).toHaveBeenCalledWith('mock.json', [
      expect.objectContaining({ id: 'global', attendance: false, payroll: true })
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('updates existing config', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([
      { id: 'global', attendance: true, payroll: true, vendors: true, inventory: true, menu: true, reports: true }
    ])
    const result = await toggleModule('payroll', false)
    
    expect(result).toEqual({ success: true })
    expect(db.writeJSON).toHaveBeenCalledWith('mock.json', [
      expect.objectContaining({ payroll: false })
    ])
  })

  it('ignores "id" as a toggle target', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([
      { id: 'global', attendance: true, payroll: true, vendors: true, inventory: true, menu: true, reports: true }
    ])
    const result = await toggleModule('id' as any, false)
    
    expect(result).toEqual({ success: true })
    expect(db.writeJSON).toHaveBeenCalledWith('mock.json', [
      expect.objectContaining({ id: 'global' })
    ])
  })
})
