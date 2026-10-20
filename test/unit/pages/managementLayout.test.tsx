import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ManagementLayout from '@/app/management/layout'

const { mockGetSession, mockReadJSON, mockHeaders } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockReadJSON: vi.fn(),
  mockHeaders: vi.fn(),
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: mockGetSession,
}))

vi.mock('@/lib/db', () => ({
  readJSON: mockReadJSON,
  DB_FILES: {
    CONFIG: 'config.json',
  },
}))

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

vi.mock('@/components/Navigation', () => ({
  Navigation: ({ role, userName }: { role: string; userName: string }) => (
    <nav data-testid="mock-navigation">
      <span>{role}</span>
      <span>{userName}</span>
    </nav>
  ),
}))

describe('ManagementLayout Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadJSON.mockResolvedValue([{ attendance: true, reports: true }])
    mockHeaders.mockResolvedValue(new Headers())
  })

  it('renders fullscreen without Navigation when user has posRole', async () => {
    mockGetSession.mockResolvedValue({
      userId: 'u-pos',
      name: 'POS User',
      role: 'kitchen',
      posRole: 'kitchen',
    })

    const layout = await ManagementLayout({
      children: <div data-testid="child-content">POS Station Content</div>,
    })

    render(layout)

    expect(screen.getByTestId('child-content')).toBeDefined()
    expect(screen.queryByTestId('mock-navigation')).toBeNull()
  })

  it('renders fullscreen without Navigation when pathname is a POS station route', async () => {
    mockGetSession.mockResolvedValue({
      userId: 'u-admin',
      name: 'Owner Admin',
      role: 'owner',
      isGlobalOwner: true,
    })

    const reqHeaders = new Headers()
    reqHeaders.set('x-pathname', '/management/pos/kitchen')
    mockHeaders.mockResolvedValue(reqHeaders)

    const layout = await ManagementLayout({
      children: <div data-testid="child-content">Kitchen Fullscreen Content</div>,
    })

    render(layout)

    expect(screen.getByTestId('child-content')).toBeDefined()
    expect(screen.queryByTestId('mock-navigation')).toBeNull()
  })

  it('renders Navigation sidebar on normal management routes for authenticated user', async () => {
    mockGetSession.mockResolvedValue({
      userId: 'u-admin',
      name: 'Super Admin',
      role: 'admin',
      isRootAdmin: true,
    })

    const reqHeaders = new Headers()
    reqHeaders.set('x-pathname', '/management/attendance')
    mockHeaders.mockResolvedValue(reqHeaders)

    const layout = await ManagementLayout({
      children: <div data-testid="child-content">Attendance Page Content</div>,
    })

    render(layout)

    expect(screen.getByTestId('child-content')).toBeDefined()
    expect(screen.getByTestId('mock-navigation')).toBeDefined()
    expect(screen.getByText('Super Admin')).toBeDefined()
  })

  it('handles readJSON failure gracefully with fallback config', async () => {
    mockGetSession.mockResolvedValue({
      userId: 'u-manager',
      name: 'Manager Dave',
      role: 'manager',
    })
    mockReadJSON.mockRejectedValue(new Error('Disk error'))

    const layout = await ManagementLayout({
      children: <div data-testid="child-content">Manager Dashboard Content</div>,
    })

    render(layout)

    expect(screen.getByTestId('child-content')).toBeDefined()
    expect(screen.getByTestId('mock-navigation')).toBeDefined()
  })

  it('renders simple main wrapper when user is unauthenticated or role is missing', async () => {
    mockGetSession.mockResolvedValue(null)

    const layout = await ManagementLayout({
      children: <div data-testid="child-content">Public / Login Content</div>,
    })

    render(layout)

    expect(screen.getByTestId('child-content')).toBeDefined()
    expect(screen.queryByTestId('mock-navigation')).toBeNull()
  })
})
