import { pgTable, varchar, text } from "drizzle-orm/pg-core";

export const jsonStore = pgTable("json_store", {
  filename: varchar("filename", { length: 255 }).primaryKey(),
  data: text("data").notNull(),
});
