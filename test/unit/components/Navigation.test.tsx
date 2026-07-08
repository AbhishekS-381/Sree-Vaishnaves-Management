import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Navigation } from '@/components/Navigation'

vi.mock('lucide-react')
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>
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
})
