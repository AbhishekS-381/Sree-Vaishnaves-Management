import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsPage from '@/app/settings/page'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import { redirect } from 'next/navigation'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn().mockResolvedValue([]),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn()
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}))

vi.mock('@/app/settings/SettingsClientPage', () => ({
  default: () => <div data-testid="settings-client" />
}))

describe('Settings Page RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.readJSON).mockResolvedValue([])
  })

  it('Root Admin can access settings page', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true } as any)
    
    await SettingsPage()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Owner is redirected from settings page', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalAdmin: true, isGlobalOwner: true, isRootAdmin: false } as any)
    
    await SettingsPage()
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('Manager is redirected from settings page', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', isGlobalAdmin: false, isRootAdmin: false } as any)
    
    await SettingsPage()
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('Read-Only is redirected from settings page', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'readonly', isGlobalOwner: false, isRootAdmin: false } as any)
    
    await SettingsPage()
    expect(redirect).toHaveBeenCalledWith('/')
  })
})
