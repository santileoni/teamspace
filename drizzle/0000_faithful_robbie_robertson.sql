CREATE TYPE "public"."BillingPlan" AS ENUM('FREE', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."ProjectStatus" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."TaskStatus" AS ENUM('TODO', 'IN_PROGRESS', 'DONE');--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('ADMIN', 'MEMBER');--> statement-breakpoint
CREATE TABLE "Organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" "BillingPlan" DEFAULT 'FREE' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "ProjectStatus" DEFAULT 'ACTIVE' NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	"deletedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "Task" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" "TaskStatus" DEFAULT 'TODO' NOT NULL,
	"projectId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	"deletedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "UserRole" DEFAULT 'MEMBER' NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "Project_organizationId_idx" ON "Project" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "Project_organizationId_deletedAt_idx" ON "Project" USING btree ("organizationId","deletedAt");--> statement-breakpoint
CREATE INDEX "Task_projectId_idx" ON "Task" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "Task_deletedAt_idx" ON "Task" USING btree ("deletedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE INDEX "User_organizationId_idx" ON "User" USING btree ("organizationId");