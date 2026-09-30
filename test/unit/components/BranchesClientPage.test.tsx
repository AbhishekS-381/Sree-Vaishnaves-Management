import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BranchesClientPage from '@/app/management/branches/BranchesClientPage'

vi.mock('lucide-react')
vi.mock('next/link', () => ({
  // forward all props so href/className behave like the real Link
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}))

const actions = vi.hoisted(() => ({
  addBranch: vi.fn(),
  updateBranch: vi.fn(),
  deleteBranch: vi.fn(),
}))
vi.mock('@/app/actions/branches', () => actions)

const branches = [
  { id: 'br_1', name: 'Sree Vaishnaves', address: 'Rajiv Gandhi Road', phone: '9080441018', status: 'operational' },
  { id: 'br_2', name: 'Vaishnaves Classic', address: 'Talap', phone: '555-0101', status: 'maintenance' },
]

beforeEach(() => {
  vi.clearAllMocks()
  Object.values(actions).forEach(fn => fn.mockResolvedValue({ success: true }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('BranchesClientPage — detail navigation (regression)', () => {
  /**
   * Regression guard: the card used to link to `/branches/<id>`, which does not
   * exist as a route. Next then rendered not-found.tsx, which redirects to '/',
   * so clicking "View Details" silently dumped the user on the marketing site.
   * The real route is /management/branches/[id].
   */
  it('links each branch card to the /management-prefixed detail route', () => {
    const { container } = render(<BranchesClientPage branches={branches} />)
    const hrefs = Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(['/management/branches/br_1', '/management/branches/br_2'])
  })

  it('never links to a bare /branches path', () => {
    const { container } = render(<BranchesClientPage branches={branches} />)
    Array.from(container.querySelectorAll('a')).forEach(a => {
      expect(a.getAttribute('href')).not.toMatch(/^\/branches\//)
      expect(a.getAttribute('href')).toMatch(/^\/management\/branches\//)
    })
  })
})

describe('BranchesClientPage — rendering', () => {
  it('renders each branch with address, phone and status', () => {
    const { container } = render(<BranchesClientPage branches={branches} />)
    expect(screen.getByText('Sree Vaishnaves')).toBeTruthy()
    expect(screen.getByText('Rajiv Gandhi Road')).toBeTruthy()
    expect(screen.getByText('9080441018')).toBeTruthy()
    expect(container.textContent).toContain('operational')
    expect(container.textContent).toContain('maintenance')
  })

  it('shows the View Details affordance on each card', () => {
    render(<BranchesClientPage branches={branches} />)
    expect(screen.getAllByText(/View Details/)).toHaveLength(2)
  })

  it('shows an empty state when there are no branches', () => {
    render(<BranchesClientPage branches={[]} />)
    expect(screen.getByText(/No branches found/i)).toBeTruthy()
  })

  it('shows Add Branch for editors and hides it for read-only users', () => {
    const editable = render(<BranchesClientPage branches={branches} />)
    expect(editable.getByText('Add Branch')).toBeTruthy()
    editable.unmount()

    const readOnly = render(<BranchesClientPage branches={branches} isReadOnly />)
    expect(readOnly.queryByText('Add Branch')).toBeNull()
  })

  it('hides edit/delete controls for read-only users', () => {
    const { container } = render(<BranchesClientPage branches={branches} isReadOnly />)
    // only the card links remain; no action buttons
    expect(container.querySelectorAll('button').length).toBe(0)
  })
})

describe('BranchesClientPage — card actions do not navigate', () => {
  /** Buttons inside the first branch card, in DOM order: [edit, delete]. */
  const cardButtons = (container: HTMLElement) =>
    Array.from(
      (container.querySelectorAll('a')[0] as HTMLElement).querySelectorAll('button')
    ) as HTMLElement[]

  it('delete calls deleteBranch without following the card link', () => {
    const { container } = render(<BranchesClientPage branches={branches} />)
    const [, del] = cardButtons(container)
    fireEvent.click(del)
    expect(actions.deleteBranch).toHaveBeenCalledWith('br_1')
  })

  it('delete is skipped when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = render(<BranchesClientPage branches={branches} />)
    const [, del] = cardButtons(container)
    fireEvent.click(del)
    expect(actions.deleteBranch).not.toHaveBeenCalled()
  })

  it('edit opens the modal instead of navigating', () => {
    const { container } = render(<BranchesClientPage branches={branches} />)
    const [edit] = cardButtons(container)
    fireEvent.click(edit)
    expect(screen.getByText('Edit Branch')).toBeTruthy()
    expect(actions.deleteBranch).not.toHaveBeenCalled()
  })

  it('opens the Add Branch modal', () => {
    render(<BranchesClientPage branches={branches} />)
    fireEvent.click(screen.getByText('Add Branch'))
    expect(screen.getByText('Add New Branch')).toBeTruthy()
  })
})
