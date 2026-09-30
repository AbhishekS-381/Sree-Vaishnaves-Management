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

  // ── username (credential-stuffing) limiter ────────────────────────────────

  it('also checks the username limiter when a username is supplied', async () => {
    vi.mocked(db.execute).mockResolvedValue({
      rows: [{ attempts: 1, window_start: Date.now(), blocked_until: 0 }]
    } as any)

    const res = await checkRateLimit('127.0.0.1', 'Abhishek')
    expect(res.success).toBe(true)
    expect(db.execute).toHaveBeenCalledTimes(2)   // IP + username
  })

  it('blocks on the username limiter even when the IP limiter passes', async () => {
    const now = Date.now()
    vi.mocked(db.execute)
      .mockResolvedValueOnce({ rows: [{ attempts: 1, window_start: now, blocked_until: 0 }] } as any)
      .mockResolvedValueOnce({ rows: [{ attempts: 20, window_start: now, blocked_until: now + 300000 }] } as any)

    const res = await checkRateLimit('127.0.0.1', 'Abhishek')
    expect(res.success).toBe(false)
    expect((res as any).retryAfterMs).toBe(300000)
  })

  it('short-circuits and skips the username check when the IP is already blocked', async () => {
    const now = Date.now()
    vi.mocked(db.execute).mockResolvedValue({
      rows: [{ attempts: 10, window_start: now, blocked_until: now + 1000 }]
    } as any)

    const res = await checkRateLimit('1.2.3.4', 'Abhishek')
    expect(res.success).toBe(false)
    expect(db.execute).toHaveBeenCalledTimes(1)   // username never checked
  })

  it('skips the username limiter for an empty or whitespace username', async () => {
    vi.mocked(db.execute).mockResolvedValue({
      rows: [{ attempts: 1, window_start: Date.now(), blocked_until: 0 }]
    } as any)

    await checkRateLimit('127.0.0.1', '')
    expect(db.execute).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    vi.mocked(db.execute).mockResolvedValue({
      rows: [{ attempts: 1, window_start: Date.now(), blocked_until: 0 }]
    } as any)
    await checkRateLimit('127.0.0.1', '   ')
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('lowercases the username key so casing cannot bypass the limit', async () => {
    vi.mocked(db.execute).mockResolvedValue({
      rows: [{ attempts: 1, window_start: Date.now(), blocked_until: 0 }]
    } as any)
    await checkRateLimit('127.0.0.1', 'AbHiShEk')
    // second call is the username upsert; its SQL params must carry the lowercased key
    const sqlArg = JSON.stringify(vi.mocked(db.execute).mock.calls[1][0])
    expect(sqlArg).toContain('login:user:abhishek')
  })

  // ── resilience ────────────────────────────────────────────────────────────

  it('treats a missing row as success', async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as any)
    const res = await checkRateLimit('127.0.0.1')
    expect(res.success).toBe(true)
  })

  it('fails open when the datastore errors', async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error('db unavailable'))
    const res = await checkRateLimit('127.0.0.1', 'someone')
    expect(res.success).toBe(true)
  })

  it('resetRateLimit clears both the IP and username counters', async () => {
    vi.mocked(db.execute).mockResolvedValue({} as any)
    await resetRateLimit('127.0.0.1', 'Abhishek')
    expect(db.execute).toHaveBeenCalledTimes(2)
  })

  it('resetRateLimit skips the username delete when none is supplied', async () => {
    vi.mocked(db.execute).mockResolvedValue({} as any)
    await resetRateLimit('127.0.0.1', '  ')
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('resetRateLimit swallows datastore errors', async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error('nope'))
    await expect(resetRateLimit('127.0.0.1', 'x')).resolves.toBeUndefined()
  })

  it('pruneRateLimits swallows datastore errors', async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error('nope'))
    await expect(pruneRateLimits()).resolves.toBeUndefined()
  })
})
