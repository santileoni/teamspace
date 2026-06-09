import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/projects/route";
import { closeDb, db } from "@/db/client";
import {
  BillingPlan,
  organizations,
  ProjectStatus,
  projects,
  UserRole,
  users
} from "@/db/schema";

const freeFixture = { org: "test-usage-free-org", user: "test-usage-free-user" };
const proFixture = { org: "test-usage-pro-org", user: "test-usage-pro-user" };

async function cleanupFixture() {
  for (const org of [freeFixture.org, proFixture.org]) {
    await db.delete(projects).where(eq(projects.organizationId, org));
    await db.delete(users).where(eq(users.organizationId, org));
    await db.delete(organizations).where(eq(organizations.id, org));
  }
}

async function resetFixture() {
  await cleanupFixture();

  await db.insert(organizations).values([
    { id: freeFixture.org, name: "Usage Free Org", slug: "test-usage-free-org", plan: BillingPlan.FREE },
    { id: proFixture.org, name: "Usage Pro Org", slug: "test-usage-pro-org", plan: BillingPlan.PRO }
  ]);

  await db.insert(users).values([
    { id: freeFixture.user, email: "usage-free@test.example", name: "Free User", role: UserRole.ADMIN, organizationId: freeFixture.org },
    { id: proFixture.user, email: "usage-pro@test.example", name: "Pro User", role: UserRole.ADMIN, organizationId: proFixture.org }
  ]);

  await db.insert(projects).values([
    { id: "test-usage-free-1", name: "Free One", status: ProjectStatus.ACTIVE, organizationId: freeFixture.org },
    { id: "test-usage-free-2", name: "Free Two", status: ProjectStatus.ACTIVE, organizationId: freeFixture.org }
  ]);
}

async function requestUsage(userId: string) {
  const response = await GET(
    new NextRequest("http://localhost/api/projects", { headers: { "x-user-id": userId } })
  );

  expect(response.status).toBe(200);

  return (await response.json()) as {
    usage: { plan: string; activeProjects: number; limit: number | null; atLimit: boolean };
  };
}

describe("plan usage", () => {
  beforeEach(async () => {
    await resetFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
    await closeDb();
  });

  it("reports a FREE workspace below the limit", async () => {
    const body = await requestUsage(freeFixture.user);

    expect(body.usage.plan).toBe(BillingPlan.FREE);
    expect(body.usage.activeProjects).toBe(2);
    expect(body.usage.limit).toBe(3);
    expect(body.usage.atLimit).toBe(false);
  });

  it("flags a FREE workspace that reaches the limit", async () => {
    await db.insert(projects).values({
      id: "test-usage-free-3",
      name: "Free Three",
      status: ProjectStatus.ACTIVE,
      organizationId: freeFixture.org
    });

    const body = await requestUsage(freeFixture.user);

    expect(body.usage.activeProjects).toBe(3);
    expect(body.usage.atLimit).toBe(true);
  });

  it("reports a PRO workspace as unlimited and never at-limit", async () => {
    const body = await requestUsage(proFixture.user);

    expect(body.usage.plan).toBe(BillingPlan.PRO);
    expect(body.usage.limit).toBeNull();
    expect(body.usage.atLimit).toBe(false);
  });

  it("creates beyond 3 active projects on PRO without blocking", async () => {
    const { POST } = await import("@/app/api/projects/route");

    for (const name of ["Pro A", "Pro B", "Pro C", "Pro D"]) {
      const response = await POST(
        new NextRequest("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": proFixture.user },
          body: JSON.stringify({ name })
        })
      );
      expect(response.status).toBe(201);
    }
  });
});
