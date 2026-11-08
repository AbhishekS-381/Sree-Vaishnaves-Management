import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsPage from '@/app/management/settings/page'
import * as auth from '@/app/actions/auth'
import { redirect } from 'next/navigation'

const { mockDb } = vi.hoisted(() => {
  const mock: any = {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        const filtered: any[] = []
        const builder: any = {
          where: vi.fn(() => builder),
          limit: vi.fn(() => Promise.resolve(filtered)),
          catch: (cb: any) => Promise.resolve(filtered).catch(cb),
          then: (res: any, rej: any) => Promise.resolve(filtered).then(res, rej),
        }
        return builder
      }),
    })),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  roles: { tableName: 'roles' },
  departments: { tableName: 'departments' },
  categories: { tableName: 'categories' },
  users: { tableName: 'users' },
  branches: { tableName: 'branches' },
  config: { tableName: 'config' },
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/app/management/settings/SettingsClientPage', () => ({
  default: () => <div data-testid="settings-client" />
}))

describe('Settings Page RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Root Admin can access settings page', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true } as any)
    
    await SettingsPage()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Owner is redirected from settings page', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalAdmin: true, isGlobalOwner: true, isRootAdmin: false } as any)
    
    await SettingsPage()
    expect(redirect).toHaveBeenCalledWith('/management')
  })

  it('Manager is redirected from settings page', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', isGlobalAdmin: false, isRootAdmin: false } as any)
    
    await SettingsPage()
    expect(redirect).toHaveBeenCalledWith('/management')
  })

  it('Read-Only is redirected from settings page', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'readonly', isGlobalOwner: false, isRootAdmin: false } as any)
    
    await SettingsPage()
    expect(redirect).toHaveBeenCalledWith('/management')
  })
})
