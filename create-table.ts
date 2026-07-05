import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rate_limit (
        key            VARCHAR(255) PRIMARY KEY,
        attempts       INTEGER      NOT NULL DEFAULT 0,
        window_start   BIGINT       NOT NULL,
        blocked_until  BIGINT       NOT NULL DEFAULT 0
      );
    `);
    console.log("rate_limit table created successfully.");
  } catch (err) {
    console.error(err);
  }
}

run();
