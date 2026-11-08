import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const DATABASE_URL = process.env.AIVEN_DATABASE_URL || process.env.DATABASE_URL;
const AIVEN_CA_CERT = process.env.AIVEN_CA_CERT;

if (!DATABASE_URL) {
  throw new Error(
    '[db] DATABASE_URL is not set. Set DATABASE_URL to your Aiven (or local) PostgreSQL connection string.'
  );
}

if (process.env.AIVEN_DATABASE_URL && !AIVEN_CA_CERT) {
  throw new Error('[db] AIVEN_CA_CERT is required when AIVEN_DATABASE_URL is set.');
}

// Global singleton to prevent connection leaks across HMR and serverless warm containers
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  db: ReturnType<typeof drizzle> | undefined;
};

const sql =
  globalForDb.conn ??
  postgres(DATABASE_URL, {
    ssl: AIVEN_CA_CERT
      ? { rejectUnauthorized: true, ca: AIVEN_CA_CERT }
      : (DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('aivencloud.com') ? 'require' : false),
    max: 10,             // Dedicated connection pool capped at 10 (guaranteed to never exceed Aiven's 20 limit)
    idle_timeout: 60,    // Keep warm for 60s of inactivity to avoid repeated cross-region connection handshakes
    max_lifetime: 1800,  // Recycle connections every 30 minutes
    connect_timeout: 5,  // 5s connect timeout
    prepare: false,      // Disable prepared statement overhead for serverless/pooled workloads
    onnotice: () => {},
  });

globalForDb.conn = sql;

export const db = globalForDb.db ?? drizzle({ client: sql, schema });
globalForDb.db = db;
