import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

function getDbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NETLIFY_DB_URL) return process.env.NETLIFY_DB_URL;
  if (typeof (globalThis as any).Netlify !== "undefined" && (globalThis as any).Netlify?.env?.get) {
    const u = (globalThis as any).Netlify.env.get("DATABASE_URL") || (globalThis as any).Netlify.env.get("NETLIFY_DB_URL");
    if (u) return u;
  }
  if (typeof (globalThis as any).Deno !== "undefined" && (globalThis as any).Deno?.env?.get) {
    const u = (globalThis as any).Deno.env.get("DATABASE_URL") || (globalThis as any).Deno.env.get("NETLIFY_DB_URL");
    if (u) return u;
  }
  return "";
}

const dbUrl = getDbUrl();

if (process.env.NETLIFY === "true" && process.env.NEXT_RUNTIME !== "edge") {
  // Use the native Netlify Database connection in production Node.js runtime.
  // Dynamically require so edge/middleware bundles don't statically trace 'pg'.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzleNetlify } = require("drizzle-orm/netlify-db");
  db = drizzleNetlify({ schema });
} else if (dbUrl.length > 0) {
  db = drizzleNeon(dbUrl, { schema });
} else {
  // Local/build fallback when no live database credentials are provided
  db = drizzleNeon("postgresql://mockuser:mockpass@mock.neon.tech/mockdb", { schema });
}

export { db };
