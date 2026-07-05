import { withTransaction, DB_FILES } from './db'

export type RateLimitEntry = {
  ip: string;
  attempts: number;
  resetAt: number;
}

const LIMIT = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function checkRateLimit(ip: string): Promise<{ success: boolean; error?: string }> {
  let isAllowed = true;

  await withTransaction<RateLimitEntry>(DB_FILES.RATE_LIMITS, (limits) => {
    const now = Date.now();
    
    // 1. Garbage collect expired entries
    const activeLimits = limits.filter(entry => entry.resetAt > now);
    
    // 2. Find current IP
    let entryIndex = activeLimits.findIndex(e => e.ip === ip);
    
    if (entryIndex === -1) {
      // New IP, add it
      activeLimits.push({
        ip,
        attempts: 1,
        resetAt: now + WINDOW_MS
      });
    } else {
      // Existing IP
      const entry = activeLimits[entryIndex];
      if (entry.attempts >= LIMIT) {
        isAllowed = false; // Blocked
      } else {
        entry.attempts += 1; // Increment
      }
    }
    
    return activeLimits;
  });

  if (!isAllowed) {
    return { success: false, error: 'Too many login attempts, please try again in 5 minutes.' };
  }

  return { success: true };
}
