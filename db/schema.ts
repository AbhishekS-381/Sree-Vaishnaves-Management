import { pgTable, varchar, text, integer, bigint } from "drizzle-orm/pg-core";

export const jsonStore = pgTable("json_store", {
  filename: varchar("filename", { length: 255 }).primaryKey(),
  data: text("data").notNull(),
});

export const rateLimitTable = pgTable("rate_limit", {
  key:          varchar("key",          { length: 255 }).primaryKey(),
  attempts:     integer("attempts")     .notNull().default(0),
  windowStart:  bigint("window_start",  { mode: "number" }).notNull(),
  blockedUntil: bigint("blocked_until", { mode: "number" }).notNull().default(0),
});
