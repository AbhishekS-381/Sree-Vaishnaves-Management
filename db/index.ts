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
    max: 1,              // Exactly 1 connection per serverless container to respect 20 max_connections limit
    idle_timeout: 5,     // Drop idle connection after 5 seconds of inactivity
    max_lifetime: 1800,  // Max connection lifetime 30 minutes
    connect_timeout: 5,  // Fast fail in 5s if connection limit is reached
    onnotice: () => {},
  });

globalForDb.conn = sql;

export const db = globalForDb.db ?? drizzle({ client: sql, schema });
globalForDb.db = db;
