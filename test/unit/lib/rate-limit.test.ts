import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, RateLimitEntry } from '@/lib/rate-limit'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))

describe('Rate Limit Utility', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows new IP and adds it', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (file: string, cb: any) => {
      const result = await cb([]);
      return result;
    })
    
    const res = await checkRateLimit('127.0.0.1');
    expect(res.success).toBe(true);
  })

  it('blocks IP if attempts exceed limit', async () => {
    const now = Date.now();
    vi.mocked(db.withTransaction).mockImplementation(async (file: string, cb: any) => {
      const result = await cb([{ ip: '127.0.0.1', attempts: 5, resetAt: now + 50000 }]);
      return result;
    })
    
    const res = await checkRateLimit('127.0.0.1');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  })

  it('allows IP if previous limit is expired', async () => {
    const now = Date.now();
    vi.mocked(db.withTransaction).mockImplementation(async (file: string, cb: any) => {
      // The old limit expired 1 second ago
      const result = await cb([{ ip: '127.0.0.1', attempts: 5, resetAt: now - 1000 }]);
      return result;
    })
    
    const res = await checkRateLimit('127.0.0.1');
    expect(res.success).toBe(true);
  })
})
