import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const UserRole = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER"
} as const;

export const BillingPlan = {
  FREE: "FREE",
  PRO: "PRO"
} as const;

export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED"
} as const;

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE"
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export type BillingPlan = (typeof BillingPlan)[keyof typeof BillingPlan];
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const userRoleEnum = pgEnum("UserRole", [UserRole.ADMIN, UserRole.MEMBER]);
export const billingPlanEnum = pgEnum("BillingPlan", [BillingPlan.FREE, BillingPlan.PRO]);
export const projectStatusEnum = pgEnum("ProjectStatus", [
  ProjectStatus.ACTIVE,
  ProjectStatus.ARCHIVED
]);
export const taskStatusEnum = pgEnum("TaskStatus", [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE
]);

export const organizations = pgTable(
  "Organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    plan: billingPlanEnum("plan").notNull().default(BillingPlan.FREE),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("Organization_slug_key").on(table.slug)]
);

export const users = pgTable(
  "User",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default(UserRole.MEMBER),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("User_email_key").on(table.email),
    index("User_organizationId_idx").on(table.organizationId)
  ]
);

export const projects = pgTable(
  "Project",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: projectStatusEnum("status").notNull().default(ProjectStatus.ACTIVE),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
    deletedAt: timestamp("deletedAt", { mode: "date", precision: 3 })
  },
  (table) => [
    index("Project_organizationId_idx").on(table.organizationId),
    index("Project_organizationId_deletedAt_idx").on(table.organizationId, table.deletedAt)
  ]
);

export const tasks = pgTable(
  "Task",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    status: taskStatusEnum("status").notNull().default(TaskStatus.TODO),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull().defaultNow(),
    deletedAt: timestamp("deletedAt", { mode: "date", precision: 3 })
  },
  (table) => [
    index("Task_projectId_idx").on(table.projectId),
    index("Task_deletedAt_idx").on(table.deletedAt)
  ]
);

export const organizationRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  projects: many(projects)
}));

export const userRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id]
  })
}));

export const projectRelations = relations(projects, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id]
  }),
  tasks: many(tasks)
}));

export const taskRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id]
  })
}));
