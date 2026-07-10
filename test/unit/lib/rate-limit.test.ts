import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, resetRateLimit, pruneRateLimits } from '@/lib/rate-limit'
import { db } from '../../../db/index'

vi.mock('../../../db/index', () => ({
  db: {
    execute: vi.fn(),
  }
}))

describe('Rate Limit Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows new IP and adds it', async () => {
    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        {
          attempts: 1,
          window_start: Date.now(),
          blocked_until: 0
        }
      ]
    } as any)
    
    const res = await checkRateLimit('127.0.0.1');
    expect(res.success).toBe(true);
  })

  it('blocks IP if attempts exceed limit', async () => {
    const now = Date.now();
    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        {
          attempts: 10,
          window_start: now - 10000,
          blocked_until: now + 300000
        }
      ]
    } as any)
    
    const res = await checkRateLimit('127.0.0.1');
    expect(res.success).toBe(false);
    expect((res as any).error).toMatch(/Too many login attempts/);
    expect((res as any).retryAfterMs).toBe(300000);
  })

  it('allows IP if previous limit is expired', async () => {
    const now = Date.now();
    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        {
          attempts: 1,
          window_start: now,
          blocked_until: 0
        }
      ]
    } as any)
    
    const res = await checkRateLimit('127.0.0.1');
    expect(res.success).toBe(true);
  })

  it('resetRateLimit executes delete', async () => {
    vi.mocked(db.execute).mockResolvedValue({} as any)
    await resetRateLimit('127.0.0.1');
    expect(db.execute).toHaveBeenCalled();
  })

  it('pruneRateLimits executes delete', async () => {
    vi.mocked(db.execute).mockResolvedValue({} as any)
    await pruneRateLimits();
    expect(db.execute).toHaveBeenCalled();
  })
})
