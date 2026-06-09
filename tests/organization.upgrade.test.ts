import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/organization/route";
import { closeDb, db } from "@/db/client";
import { BillingPlan, organizations, UserRole, users } from "@/db/schema";

const fixture = {
  org: "test-upgrade-org",
  admin: "test-upgrade-admin",
  member: "test-upgrade-member"
};

async function cleanupFixture() {
  await db.delete(users).where(eq(users.organizationId, fixture.org));
  await db.delete(organizations).where(eq(organizations.id, fixture.org));
}

async function resetFixture() {
  await cleanupFixture();

  await db.insert(organizations).values({
    id: fixture.org,
    name: "Upgrade Org",
    slug: "test-upgrade-org",
    plan: BillingPlan.FREE
  });

  await db.insert(users).values([
    { id: fixture.admin, email: "admin@test.example", name: "Admin", role: UserRole.ADMIN, organizationId: fixture.org },
    { id: fixture.member, email: "member@test.example", name: "Member", role: UserRole.MEMBER, organizationId: fixture.org }
  ]);
}

async function requestUpgrade(userId: string, body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(body)
    })
  );
}

async function readPlan() {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, fixture.org) });
  return org?.plan;
}

describe("organization upgrade", () => {
  beforeEach(async () => {
    await resetFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
    await closeDb();
  });

  it("lets an ADMIN upgrade the workspace to PRO", async () => {
    const response = await requestUpgrade(fixture.admin, { plan: BillingPlan.PRO });
    const body = (await response.json()) as { organization: { plan: string } };

    expect(response.status).toBe(200);
    expect(body.organization.plan).toBe(BillingPlan.PRO);
    expect(await readPlan()).toBe(BillingPlan.PRO);
  });

  it("rejects a MEMBER upgrade attempt with 403 and keeps the plan", async () => {
    const response = await requestUpgrade(fixture.member, { plan: BillingPlan.PRO });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toContain("admin");
    expect(await readPlan()).toBe(BillingPlan.FREE);
  });

  it("rejects an unsupported target plan with 400", async () => {
    const response = await requestUpgrade(fixture.admin, { plan: "ENTERPRISE" });

    expect(response.status).toBe(400);
    expect(await readPlan()).toBe(BillingPlan.FREE);
  });

  it("is idempotent when already on PRO", async () => {
    await requestUpgrade(fixture.admin, { plan: BillingPlan.PRO });
    const response = await requestUpgrade(fixture.admin, { plan: BillingPlan.PRO });
    const body = (await response.json()) as { organization: { plan: string } };

    expect(response.status).toBe(200);
    expect(body.organization.plan).toBe(BillingPlan.PRO);
  });
});
