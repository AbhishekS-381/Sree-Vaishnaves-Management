import { db } from '../../db/index';
import { sql } from 'drizzle-orm';

// ── Configuration ─────────────────────────────────────────────
const WINDOW_MS           = 60_000;    // 1 minute rolling window
const MAX_ATTEMPTS_IP     = 10;        // max attempts per IP per window
const MAX_ATTEMPTS_USER   = 20;        // max attempts per username per hour
const USER_WINDOW_MS      = 3_600_000; // 1 hour window for username limiter
const BLOCK_DURATION_MS   = 300_000;   // 5 min hard block
// ─────────────────────────────────────────────────────────────

export type RateLimitResult =
  | { success: true }
  | { success: false; error: string; retryAfterMs: number };

async function atomicUpsert(
  key: string,
  windowMs: number,
  maxAttempts: number
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const result = await db.execute(sql`
      INSERT INTO rate_limit (key, attempts, window_start, blocked_until)
      VALUES (${key}, 1, ${now}, 0)
      ON CONFLICT (key) DO UPDATE SET

        attempts = CASE
          WHEN rate_limit.blocked_until > ${now}
            THEN rate_limit.attempts
          WHEN rate_limit.window_start < ${now - windowMs}
            THEN 1
          ELSE rate_limit.attempts + 1
        END,

        window_start = CASE
          WHEN rate_limit.window_start < ${now - windowMs}
            THEN ${now}
          ELSE rate_limit.window_start
        END,

        blocked_until = CASE
          WHEN (
            CASE
              WHEN rate_limit.window_start < ${now - windowMs} THEN 1
              ELSE rate_limit.attempts + 1
            END
          ) >= ${maxAttempts}
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
    console.error('Rate limit check failed (failing open):', err);
    return { success: true };
  }
}

// Check both IP-based and username-based limits.
// Returns failure if either limit is exceeded.
export async function checkRateLimit(
  ip: string,
  username?: string
): Promise<RateLimitResult> {
  // Check IP limit first
  const ipResult = await atomicUpsert(
    `login:ip:${ip}`,
    WINDOW_MS,
    MAX_ATTEMPTS_IP
  );
  if (!ipResult.success) return ipResult;

  // Check username limit if username provided
  // This catches credential stuffing attacks that rotate IPs
  if (username && username.trim().length > 0) {
    const userResult = await atomicUpsert(
      `login:user:${username.toLowerCase()}`,
      USER_WINDOW_MS,
      MAX_ATTEMPTS_USER
    );
    if (!userResult.success) return userResult;
  }

  return { success: true };
}

// Reset both IP and username counters on successful login
export async function resetRateLimit(
  ip: string,
  username?: string
): Promise<void> {
  try {
    const ipKey = `login:ip:${ip}`;
    await db.execute(sql`DELETE FROM rate_limit WHERE key = ${ipKey}`);

    if (username && username.trim().length > 0) {
      const userKey = `login:user:${username.toLowerCase()}`;
      await db.execute(sql`DELETE FROM rate_limit WHERE key = ${userKey}`);
    }
  } catch {
    // Non-critical
  }
}

export async function pruneRateLimits(): Promise<void> {
  const now = Date.now();
  try {
    await db.execute(sql`
      DELETE FROM rate_limit
      WHERE blocked_until < ${now}
        AND window_start  < ${now - USER_WINDOW_MS}
    `);
  } catch {
    // Non-critical
  }
}
