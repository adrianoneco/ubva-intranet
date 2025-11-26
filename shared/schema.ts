import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
});

export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description"),
  completed: boolean("completed").notNull().default(false),
  categoryId: integer("category_id").references(() => categories.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const cards = pgTable("cards", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  image: text("image"),
  scheduleStart: timestamp("schedule_start"),
  scheduleEnd: timestamp("schedule_end"),
  scheduleWeekdays: text("schedule_weekdays"), // store as JSON string of array
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const departments = pgTable("departments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const setores = pgTable("setores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  kind: varchar("kind", { length: 32 }).notNull(), // ramais | departments | companies | setor | cargos
  name: text("name").notNull(),
  number: text("number"),
  department: text("department"),
  setor: text("setor"),
  company: text("company"),
  image: text("image"),
  email: text("email"),
  rocketUser: text("rocket_user"),
  whatsapp: text("whatsapp"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  iterations: integer("iterations").notNull().default(100000),
  role: varchar("role", { length: 32 }).notNull().default('admin'),
  displayName: text("display_name"),
  email: text("email"),
  // note: per-user permissions moved to normalized `permissions` registry and mappings
  // `users.permissions` column removed by migration
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const groups = pgTable("groups", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name").notNull().unique(),
  permissions: text("permissions"), // JSON string array (legacy) — migrated permissions are in `permissions` + `group_permissions`
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const permissions = pgTable("permissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const groupPermissions = pgTable("group_permissions", {
  groupId: varchar("group_id", { length: 64 }).notNull(),
  permissionId: integer("permission_id").notNull(),
}, (t) => ({
  pk: primaryKey(t.groupId, t.permissionId),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  category: one(categories, {
    fields: [tasks.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  tasks: many(tasks),
}));

export const insertCategorySchema = z.object({
  name: z.string(),
  color: z.string(),
});

export const insertTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  categoryId: z.number().optional(),
});

export const insertCardSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  image: z.string().nullable().optional(),
  scheduleStart: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  scheduleEnd: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  scheduleWeekdays: z.string().optional(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Contact = typeof contacts.$inferSelect;
export type User = typeof users.$inferSelect;
