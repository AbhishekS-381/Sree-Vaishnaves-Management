import { drizzle as drizzleNetlify } from "drizzle-orm/netlify-db";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let db: any;

const dbUrl = process.env.DATABASE_URL || "";

// Use the local DATABASE_URL connection if we are not running in Netlify production
// Netlify automatically injects `NETLIFY=true` during builds and functions.
if (process.env.NETLIFY !== "true" && dbUrl.length > 0) {
  db = drizzleNeon(dbUrl, { schema });
} else {
  // Use the native Netlify Database connection in production
  db = drizzleNetlify({ schema });
}

export { db };
