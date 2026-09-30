import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { CloneBranchModal } from '@/components/CloneBranchModal'

vi.mock('lucide-react')

const actions = vi.hoisted(() => ({ cloneBranchMenuConfig: vi.fn() }))
vi.mock('@/app/actions/menu', () => actions)

const branches = [
  { id: 'b1', name: 'Main' },
  { id: 'b2', name: 'Classic' },
  { id: 'b3', name: 'Talap' },
]

beforeEach(() => {
  vi.clearAllMocks()
  actions.cloneBranchMenuConfig.mockResolvedValue({ success: true, applied: 5 })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('CloneBranchModal', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <CloneBranchModal isOpen={false} onClose={vi.fn()} branches={branches} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders both selectors and copy options', () => {
    render(<CloneBranchModal isOpen onClose={vi.fn()} branches={branches} />)
    expect(screen.getByText('Copy Branch Menu')).toBeTruthy()
    expect(screen.getByText('Copy price overrides')).toBeTruthy()
    expect(screen.getByText('Copy availability')).toBeTruthy()
  })

  it('defaults the target to the supplied branch and picks a different source', () => {
    const { container } = render(
      <CloneBranchModal isOpen onClose={vi.fn()} branches={branches} defaultTargetId="b2" />
    )
    const selects = container.querySelectorAll('select')
    expect((selects[1] as HTMLSelectElement).value).toBe('b2')   // target
    expect((selects[0] as HTMLSelectElement).value).toBe('b1')   // source ≠ target
  })

  it('warns and blocks when source equals target', () => {
    const { container } = render(
      <CloneBranchModal isOpen onClose={vi.fn()} branches={branches} defaultTargetId="b2" />
    )
    const selects = container.querySelectorAll('select')
    fireEvent.change(selects[0], { target: { value: 'b2' } })
    expect(screen.getByText(/must be different branches/i)).toBeTruthy()
    expect((screen.getByText('Copy').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('warns and blocks when nothing is selected to copy', () => {
    render(<CloneBranchModal isOpen onClose={vi.fn()} branches={branches} defaultTargetId="b2" />)
    fireEvent.click(screen.getByText('Copy price overrides'))
    fireEvent.click(screen.getByText('Copy availability'))
    expect(screen.getByText(/at least one thing to copy/i)).toBeTruthy()
    expect((screen.getByText('Copy').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('submits the clone and closes on success', async () => {
    const onClose = vi.fn()
    const onResult = vi.fn()
    render(
      <CloneBranchModal isOpen onClose={onClose} branches={branches} defaultTargetId="b2" onResult={onResult} />
    )
    fireEvent.click(screen.getByText('Copy'))
    await waitFor(() =>
      expect(actions.cloneBranchMenuConfig).toHaveBeenCalledWith('b1', 'b2', { prices: true, availability: true })
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onResult).toHaveBeenCalledWith({ success: true, applied: 5 })
  })

  it('passes only the selected options', async () => {
    render(<CloneBranchModal isOpen onClose={vi.fn()} branches={branches} defaultTargetId="b2" />)
    fireEvent.click(screen.getByText('Copy price overrides'))  // uncheck prices
    fireEvent.click(screen.getByText('Copy'))
    await waitFor(() =>
      expect(actions.cloneBranchMenuConfig).toHaveBeenCalledWith('b1', 'b2', { prices: false, availability: true })
    )
  })

  it('aborts when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CloneBranchModal isOpen onClose={vi.fn()} branches={branches} defaultTargetId="b2" />)
    fireEvent.click(screen.getByText('Copy'))
    await waitFor(() => expect(actions.cloneBranchMenuConfig).not.toHaveBeenCalled())
  })

  it('surfaces an action error and stays open', async () => {
    actions.cloneBranchMenuConfig.mockResolvedValue({ error: 'Source branch has no menu configuration to copy' })
    const onClose = vi.fn()
    render(<CloneBranchModal isOpen onClose={onClose} branches={branches} defaultTargetId="b2" />)
    fireEvent.click(screen.getByText('Copy'))
    expect(await screen.findByText(/no menu configuration/i)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes via backdrop, X and Cancel', () => {
    const onClose = vi.fn()
    const { container } = render(
      <CloneBranchModal isOpen onClose={onClose} branches={branches} defaultTargetId="b2" />
    )
    fireEvent.click(container.querySelector('.absolute.inset-0')!)
    fireEvent.click(screen.getByLabelText('Close'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
