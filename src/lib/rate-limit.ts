import { db } from '../../db/index';
import { sql } from 'drizzle-orm';

// ── Configuration ──────────────────────────────────────────────
const WINDOW_MS         = 60_000;     // 1 minute rolling window
const MAX_ATTEMPTS      = 10;         // max attempts per window
const BLOCK_DURATION_MS = 300_000;    // 5 min hard block after exceeding
// ───────────────────────────────────────────────────────────────

export type RateLimitResult =
  | { success: true }
  | { success: false; error: string; retryAfterMs: number };

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const now = Date.now();
  const key = `login:${ip}`;

  try {
    // Single atomic upsert — no separate read, no race condition,
    // works correctly across all Netlify function instances.
    const result = await db.execute(sql`
      INSERT INTO rate_limit (key, attempts, window_start, blocked_until)
      VALUES (${key}, 1, ${now}, 0)
      ON CONFLICT (key) DO UPDATE SET

        attempts = CASE
          -- Already hard-blocked: freeze the counter
          WHEN rate_limit.blocked_until > ${now}
            THEN rate_limit.attempts

          -- Window has expired: reset to 1 (this request)
          WHEN rate_limit.window_start < ${now - WINDOW_MS}
            THEN 1

          -- Same window, under limit: increment
          ELSE rate_limit.attempts + 1
        END,

        window_start = CASE
          WHEN rate_limit.window_start < ${now - WINDOW_MS}
            THEN ${now}
          ELSE rate_limit.window_start
        END,

        blocked_until = CASE
          -- Trigger hard block when the new attempt count hits the limit
          WHEN (
            CASE
              WHEN rate_limit.window_start < ${now - WINDOW_MS} THEN 1
              ELSE rate_limit.attempts + 1
            END
          ) >= ${MAX_ATTEMPTS}
          AND rate_limit.blocked_until <= ${now}
            THEN ${now + BLOCK_DURATION_MS}
          ELSE rate_limit.blocked_until
        END

      RETURNING attempts, window_start, blocked_until
    `);

    const row = result.rows[0] as {
      attempts: number;
      window_start: number;
      blocked_until: number;
    } | undefined;

    // If DB returned nothing, fail open — don't block logins
    if (!row) return { success: true };

    if (Number(row.blocked_until) > now) {
      const retryAfterMs = Number(row.blocked_until) - now;
      const waitSecs = Math.ceil(retryAfterMs / 1000);
      return {
        success: false,
        error: `Too many login attempts. Try again in ${waitSecs} seconds.`,
        retryAfterMs,
      };
    }

    return { success: true };

  } catch (err) {
    // Fail open if table doesn't exist yet or DB is unreachable.
    // Logins still work — you just temporarily lose rate limiting.
    console.error('Rate limit check failed (failing open):', err);
    return { success: true };
  }
}

// Call this on successful login to clear the counter for that IP.
export async function resetRateLimit(ip: string): Promise<void> {
  try {
    const key = `login:${ip}`;
    await db.execute(sql`DELETE FROM rate_limit WHERE key = ${key}`);
  } catch {
    // Non-critical — ignore
  }
}

// Prune stale rows to keep the table small.
// Called inline from login at 1% probability — fire and forget.
export async function pruneRateLimits(): Promise<void> {
  const now = Date.now();
  try {
    await db.execute(sql`
      DELETE FROM rate_limit
      WHERE blocked_until < ${now}
        AND window_start  < ${now - WINDOW_MS}
    `);
  } catch {
    // Non-critical — ignore
  }
}
