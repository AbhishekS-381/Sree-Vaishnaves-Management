import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Navigation } from '@/components/Navigation'

vi.mock('lucide-react')
vi.mock('next/link', () => ({
  // forward every prop so className / onClick behave like the real Link
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>
}))
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/')
}))
vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }))

describe('Navigation component', () => {
  it('renders the owner portal label', () => {
    const { container } = render(<Navigation role="owner" isGlobalOwner={true} config={{}} />)
    expect(container.textContent).toContain('Owner Portal')
  })

  it('renders read-only portal when role=readonly', () => {
    const { container } = render(<Navigation role="readonly" config={{}} />)
    expect(container.textContent).toContain('Read-Only Portal')
  })

  it('hides Menu nav item when config.menu=false', () => {
    const { queryByText } = render(<Navigation role="owner" config={{ menu: false }} />)
    expect(queryByText('Menu')).toBeNull()
  })

  it('hides Inventory when config.inventory=false', () => {
    const { queryByText } = render(<Navigation role="owner" config={{ inventory: false }} />)
    expect(queryByText('Inventory')).toBeNull()
  })

  it('hides Vendors when config.vendors=false', () => {
    const { queryByText } = render(<Navigation role="owner" config={{ vendors: false }} />)
    expect(queryByText('Vendors')).toBeNull()
  })

  it('hides Attendance when config.attendance=false', () => {
    const { queryByText } = render(<Navigation role="owner" config={{ attendance: false }} />)
    expect(queryByText('Attendance')).toBeNull()
  })

  it('hides Payroll when config.payroll=false', () => {
    const { queryByText } = render(<Navigation role="owner" config={{ payroll: false }} />)
    expect(queryByText('Payroll')).toBeNull()
  })

  it('shows all nav items when config is empty', () => {
    const { getByText } = render(<Navigation role="owner" isRootAdmin={true} config={{}}  />)
    expect(getByText('Dashboard')).toBeTruthy()
    expect(getByText('Staff')).toBeTruthy()
    expect(getByText('Settings')).toBeTruthy()
  })

  it('all navigation links should point to /management paths', () => {
    const { getByText } = render(<Navigation role="owner" isRootAdmin={true} config={{}}  />)
    
    // Test a few core links to ensure they have the correct /management prefix
    expect(getByText('Dashboard').closest('a')?.getAttribute('href')).toBe('/management')
    expect(getByText('Menu').closest('a')?.getAttribute('href')).toBe('/management/menu')
    expect(getByText('Settings').closest('a')?.getAttribute('href')).toBe('/management/settings')
  })

  it('hides Reports when config.reports=false', () => {
    const { queryByText } = render(<Navigation role="owner" config={{ reports: false }} />)
    expect(queryByText('Reports')).toBeNull()
  })

  it('hides Settings from non-root-admins', () => {
    const { queryByText } = render(<Navigation role="owner" isGlobalOwner config={{}} />)
    expect(queryByText('Settings')).toBeNull()
  })

  it('hides EOD Entry from read-only users', () => {
    const { queryByText } = render(<Navigation role="readonly" config={{}} />)
    expect(queryByText('EOD Entry')).toBeNull()
  })

  it('renders the admin portal label and avatar initials for root admin', () => {
    const { container } = render(
      <Navigation role="admin" isRootAdmin userName="Abhishek" config={{}} />
    )
    expect(container.textContent).toContain('Admin Portal')
    expect(container.textContent).toContain('AB')       // first two letters, uppercased
    expect(container.textContent).toContain('Abhishek')
  })

  it('falls back to role-based initials when no userName is given', () => {
    const owner = render(<Navigation role="owner" isGlobalOwner config={{}} />)
    expect(owner.container.textContent).toContain('OW')
    const manager = render(<Navigation role="manager" config={{}} />)
    expect(manager.container.textContent).toContain('MA')
    const ro = render(<Navigation role="readonly" config={{}} />)
    expect(ro.container.textContent).toContain('RO')
    const admin = render(<Navigation role="admin" isRootAdmin config={{}} />)
    expect(admin.container.textContent).toContain('AD')
  })

  it('renders the manager portal label', () => {
    const { container } = render(<Navigation role="manager" config={{}} />)
    expect(container.textContent).toContain('Manager Portal')
  })

  it('toggles the mobile sidebar open and closed', () => {
    const { container } = render(<Navigation role="owner" config={{}} />)
    const sidebar = () => container.querySelector('.fixed.inset-y-0')!
    const toggle = container.querySelector('.md\\:hidden button') as HTMLElement

    expect(sidebar().className).toContain('-translate-x-full')   // closed
    fireEvent.click(toggle)
    expect(sidebar().className).toContain('translate-x-0')       // open
    fireEvent.click(toggle)
    expect(sidebar().className).toContain('-translate-x-full')   // closed again
  })

  it('closes the mobile sidebar when the overlay is clicked', () => {
    const { container } = render(<Navigation role="owner" config={{}} />)
    const toggle = container.querySelector('.md\\:hidden button') as HTMLElement
    fireEvent.click(toggle)

    const overlay = container.querySelector('.fixed.inset-0.z-30') as HTMLElement
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay)
    expect(container.querySelector('.fixed.inset-y-0')!.className).toContain('-translate-x-full')
  })

  it('closes the mobile sidebar after following a nav link', () => {
    const { container, getByText } = render(<Navigation role="owner" config={{}} />)
    fireEvent.click(container.querySelector('.md\\:hidden button') as HTMLElement)
    fireEvent.click(getByText('Dashboard'))
    expect(container.querySelector('.fixed.inset-y-0')!.className).toContain('-translate-x-full')
  })

  it('calls logout when Sign Out is clicked', async () => {
    const { logout } = await import('@/app/actions/auth')
    const { getByText } = render(<Navigation role="owner" config={{}} />)
    fireEvent.click(getByText('Sign Out'))
    expect(logout).toHaveBeenCalled()
  })

  it('marks the active route', async () => {
    const nav = await import('next/navigation')
    vi.mocked(nav.usePathname).mockReturnValue('/management/menu')
    const { getByText } = render(<Navigation role="owner" config={{}} />)
    expect(getByText('Menu').closest('a')!.className).toContain('border-primary')
    expect(getByText('Dashboard').closest('a')!.className).not.toContain('border-primary')
    vi.mocked(nav.usePathname).mockReturnValue('/')
  })
})
