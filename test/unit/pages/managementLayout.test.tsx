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
  db: {
    select: () => ({
      from: () => ({
        limit: async () => [{ attendance: true, reports: true, pos: true }],
      }),
    }),
  },
  config: {},
}))

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

vi.mock('@/components/Navigation', () => ({
  Navigation: ({ role, userName }: { role: string; userName: string }) => (
    <nav data-testid="mock-navigation">
      <span data-testid="nav-role">{role}</span>
      <span data-testid="nav-user">{userName}</span>
    </nav>
  ),
}))

describe('ManagementLayout RBAC & Fullscreen Matrix Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadJSON.mockResolvedValue([{ attendance: true, reports: true, pos: true }])
    mockHeaders.mockResolvedValue(new Headers())
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Matrix: Management Roles (admin, owner, manager, readonly)
  //    Must NEVER be full screen — must ALWAYS render Navigation sidebar
  // ──────────────────────────────────────────────────────────────────────────
  describe('Management Flow (Admin, Owner, Manager, Readonly) - NEVER Fullscreen', () => {
    const managementRoles = [
      { role: 'admin', name: 'Super Admin', isRootAdmin: true },
      { role: 'owner', name: 'Hotel Owner', isGlobalOwner: true },
      { role: 'manager', name: 'Branch Manager' },
      { role: 'readonly', name: 'Auditor User' },
    ]

    const posStationRoutes = [
      { label: 'POS Dashboard', path: '/management/pos' },
      { label: 'POS Dashboard with branch query', path: '/management/pos?branch=branch-1' },
      { label: 'Kitchen / KDS Station', path: '/management/pos/kitchen' },
      { label: 'Kitchen with branch query', path: '/management/pos/kitchen?branch=branch-1' },
      { label: 'Billing Station', path: '/management/pos/billing' },
      { label: 'Billing with branch query', path: '/management/pos/billing?branch=branch-1' },
      { label: 'Waiter Order Station', path: '/management/pos/order' },
      { label: 'Waiter with branch query', path: '/management/pos/order?branch=branch-1' },
      { label: 'Order History & Audit', path: '/management/pos/history' },
      { label: 'History with branch query', path: '/management/pos/history?branch=branch-1' },
    ]

    managementRoles.forEach(({ role, name, isRootAdmin, isGlobalOwner }) => {
      describe(`Role: ${role} (${name})`, () => {
        posStationRoutes.forEach(({ label, path }) => {
          it(`renders Navigation sidebar on ${label} (${path}) and does not collapse to fullscreen`, async () => {
            mockGetSession.mockResolvedValue({
              userId: `u-${role}`,
              name,
              role,
              isRootAdmin: Boolean(isRootAdmin),
              isGlobalOwner: Boolean(isGlobalOwner),
              posRole: undefined, // Management users NEVER have posRole
            })

            const reqHeaders = new Headers()
            reqHeaders.set('x-pathname', path)
            mockHeaders.mockResolvedValue(reqHeaders)

            const layout = await ManagementLayout({
              children: <div data-testid="station-content">{label} Content</div>,
            })

            const { container } = render(layout)

            // 1. Content rendered
            expect(screen.getByTestId('station-content')).toBeDefined()

            // 2. Navigation sidebar MUST be present
            expect(screen.getByTestId('mock-navigation')).toBeDefined()
            expect(screen.getByTestId('nav-role').textContent).toBe(role)
            expect(screen.getByTestId('nav-user').textContent).toBe(name)

            // 3. Not in dedicated fullscreen kiosk (<main className="h-screen w-full overflow-y-auto"> with no nav)
            const mainEl = container.querySelector('main')
            expect(mainEl).toBeDefined()
            expect(mainEl?.className).toContain('flex-1')

            // 4. POS station view uses responsive full-width container next to sidebar
            const contentContainer = mainEl?.querySelector('div')
            expect(contentContainer?.className).toContain('w-full min-h-full')
            expect(contentContainer?.className).not.toContain('max-w-7xl')
          })
        })
      })
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Matrix: POS-Dedicated Accounts (billing, kitchen, waiter)
  //    Must ALWAYS stay full screen — NO Navigation sidebar
  // ──────────────────────────────────────────────────────────────────────────
  describe('POS-Dedicated Accounts (Billing, Kitchen, Waiter) - ALWAYS Fullscreen', () => {
    const posDedicatedRoles = [
      { role: 'billing', name: 'Cashier Account', homePath: '/management/pos/billing' },
      { role: 'kitchen', name: 'Chef Account', homePath: '/management/pos/kitchen' },
      { role: 'waiter', name: 'Floor Server Account', homePath: '/management/pos/order' },
    ]

    posDedicatedRoles.forEach(({ role, name, homePath }) => {
      it(`renders 100% fullscreen kiosk without Navigation sidebar for ${role} on ${homePath}`, async () => {
        mockGetSession.mockResolvedValue({
          userId: `u-${role}`,
          name,
          role,
          posRole: role, // posRole flag is true/string for dedicated accounts
        })

        const reqHeaders = new Headers()
        reqHeaders.set('x-pathname', homePath)
        mockHeaders.mockResolvedValue(reqHeaders)

        const layout = await ManagementLayout({
          children: <div data-testid="kiosk-content">{role} Kiosk Active</div>,
        })

        const { container } = render(layout)

        // 1. Content rendered
        expect(screen.getByTestId('kiosk-content')).toBeDefined()

        // 2. Navigation sidebar MUST NOT be rendered
        expect(screen.queryByTestId('mock-navigation')).toBeNull()

        // 3. Rendered in fullscreen container
        const mainEl = container.querySelector('main')
        expect(mainEl?.className).toBe('h-screen w-full overflow-y-auto')
      })

      it(`retains fullscreen kiosk on page refresh event for ${role}`, async () => {
        // Simulating hard page reload where SSR runs with headers populated
        mockGetSession.mockResolvedValue({
          userId: `u-${role}-reload`,
          name,
          role,
          posRole: role,
        })

        const reqHeaders = new Headers()
        reqHeaders.set('x-pathname', `${homePath}?branch=branch-1`)
        mockHeaders.mockResolvedValue(reqHeaders)

        const layout = await ManagementLayout({
          children: <div data-testid="kiosk-content">{role} Refreshed</div>,
        })

        render(layout)

        expect(screen.getByTestId('kiosk-content')).toBeDefined()
        expect(screen.queryByTestId('mock-navigation')).toBeNull()
      })
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Page Refresh Scenario: Management roles on station routes
  // ──────────────────────────────────────────────────────────────────────────
  describe('Page Refresh Event Simulation for Management Users', () => {
    it.each([
      ['admin', '/management/pos/kitchen'],
      ['admin', '/management/pos/billing'],
      ['admin', '/management/pos/order'],
      ['admin', '/management/pos/history'],
      ['owner', '/management/pos/kitchen'],
      ['owner', '/management/pos/billing'],
      ['owner', '/management/pos/order'],
      ['manager', '/management/pos/kitchen'],
      ['manager', '/management/pos/billing'],
      ['manager', '/management/pos/order'],
    ])('on page refresh as %s at %s, stays in management layout with sidebar', async (role, pathname) => {
      mockGetSession.mockResolvedValue({
        userId: `u-${role}`,
        name: `User ${role}`,
        role,
        posRole: undefined,
      })

      const reqHeaders = new Headers()
      reqHeaders.set('x-pathname', pathname)
      mockHeaders.mockResolvedValue(reqHeaders)

      const layout = await ManagementLayout({
        children: <div data-testid="refreshed-content">Refreshed {pathname}</div>,
      })

      render(layout)

      expect(screen.getByTestId('refreshed-content')).toBeDefined()
      expect(screen.getByTestId('mock-navigation')).toBeDefined()
      expect(screen.getByTestId('nav-role').textContent).toBe(role)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Standard Non-POS Management Routes: Container Max-Width Verification
  // ──────────────────────────────────────────────────────────────────────────
  describe('Standard Non-POS Management Routes Container Width', () => {
    const standardRoutes = [
      { name: 'Dashboard', path: '/management' },
      { name: 'Attendance', path: '/management/attendance' },
      { name: 'Menu', path: '/management/menu' },
      { name: 'Settings', path: '/management/settings' },
      { name: 'Staff', path: '/management/staff' },
      { name: 'Branches', path: '/management/branches' },
      { name: 'Expenses', path: '/management/expenses' },
      { name: 'EOD Entry', path: '/management/eod' },
    ]

    standardRoutes.forEach(({ name, path }) => {
      it(`renders Navigation sidebar and max-w-7xl centered container on ${name} (${path})`, async () => {
        mockGetSession.mockResolvedValue({
          userId: 'u-admin',
          name: 'Super Admin',
          role: 'admin',
          isRootAdmin: true,
        })

        const reqHeaders = new Headers()
        reqHeaders.set('x-pathname', path)
        mockHeaders.mockResolvedValue(reqHeaders)

        const layout = await ManagementLayout({
          children: <div data-testid="std-content">{name} View</div>,
        })

        const { container } = render(layout)

        expect(screen.getByTestId('std-content')).toBeDefined()
        expect(screen.getByTestId('mock-navigation')).toBeDefined()

        const mainEl = container.querySelector('main')
        const contentContainer = mainEl?.querySelector('div')
        expect(contentContainer?.className).toContain('max-w-7xl mx-auto')
        expect(contentContainer?.className).toContain('p-4 md:p-8 lg:p-10')
      })
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Edge Cases & Resilience
  // ──────────────────────────────────────────────────────────────────────────
  describe('Edge Cases and Resilience', () => {
    it('renders bare wrapper without navigation when unauthenticated (session is null)', async () => {
      mockGetSession.mockResolvedValue(null)

      const layout = await ManagementLayout({
        children: <div data-testid="login-content">Login Form</div>,
      })

      const { container } = render(layout)

      expect(screen.getByTestId('login-content')).toBeDefined()
      expect(screen.queryByTestId('mock-navigation')).toBeNull()
      expect(container.querySelector('main')?.className).toBe('h-screen w-full')
    })

    it('renders bare wrapper when session exists but role is undefined or empty', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'u-empty',
        name: 'Empty Role User',
        role: '',
      })

      const layout = await ManagementLayout({
        children: <div data-testid="fallback-content">Fallback View</div>,
      })

      const { container } = render(layout)

      expect(screen.getByTestId('fallback-content')).toBeDefined()
      expect(screen.queryByTestId('mock-navigation')).toBeNull()
      expect(container.querySelector('main')?.className).toBe('h-screen w-full')
    })

    it('falls back to default config without crashing when database read throws', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'u-manager',
        name: 'Manager Dave',
        role: 'manager',
      })
      mockReadJSON.mockRejectedValue(new Error('Database unavailable'))

      const layout = await ManagementLayout({
        children: <div data-testid="resilient-content">Dashboard under DB error</div>,
      })

      render(layout)

      expect(screen.getByTestId('resilient-content')).toBeDefined()
      expect(screen.getByTestId('mock-navigation')).toBeDefined()
      expect(screen.getByTestId('nav-role').textContent).toBe('manager')
    })
  })
})
