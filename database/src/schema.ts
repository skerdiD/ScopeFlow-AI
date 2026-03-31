import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  projectType: varchar("project_type", { length: 120 }).notNull(),
  budget: varchar("budget", { length: 120 }),
  timeline: varchar("timeline", { length: 120 }),
  notes: text("notes"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});