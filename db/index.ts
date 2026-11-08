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

const sql = postgres(DATABASE_URL, {
  ssl: AIVEN_CA_CERT
    ? { rejectUnauthorized: true, ca: AIVEN_CA_CERT }
    : undefined,
  max: 2,
  idle_timeout: 20,
  max_lifetime: 1800,
  connect_timeout: 10,
  onnotice: () => {},
});

export const db = drizzle({ client: sql, schema });
