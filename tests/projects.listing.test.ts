import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/projects/route";
import { closeDb, db } from "@/db/client";
import {
  organizations,
  ProjectStatus,
  projects,
  UserRole,
  users
} from "@/db/schema";

const fixture = {
  org: "test-list-org",
  user: "test-list-user",
  otherOrg: "test-list-other-org"
};

async function resetFixture() {
  await cleanupFixture();

  await db.insert(organizations).values({
    id: fixture.org,
    name: "List Test Org",
    slug: "test-list-org"
  });

  await db.insert(users).values({
    id: fixture.user,
    email: "list-user@test.example",
    name: "List User",
    role: UserRole.ADMIN,
    organizationId: fixture.org
  });

  await db.insert(projects).values([
    {
      id: "test-list-active",
      name: "Active Project",
      status: ProjectStatus.ACTIVE,
      organizationId: fixture.org
    },
    {
      id: "test-list-archived",
      name: "Archived Project",
      status: ProjectStatus.ARCHIVED,
      organizationId: fixture.org
    },
    {
      id: "test-list-deleted",
      name: "Deleted Project",
      status: ProjectStatus.ACTIVE,
      organizationId: fixture.org,
      deletedAt: new Date("2026-01-15T00:00:00.000Z")
    }
  ]);
}

async function cleanupFixture() {
  await db.delete(projects).where(eq(projects.organizationId, fixture.org));
  await db.delete(projects).where(eq(projects.organizationId, fixture.otherOrg));

  await db.delete(users).where(eq(users.organizationId, fixture.org));

  await db.delete(organizations).where(eq(organizations.id, fixture.org));
  await db.delete(organizations).where(eq(organizations.id, fixture.otherOrg));
}

describe("project lists", () => {
  beforeEach(async () => {
    await resetFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
    await closeDb();
  });

  it("returns active and archived projects but omits deleted projects", async () => {
    const response = await requestProjects(fixture.user);
    const listedProjects = response.projects.filter((project) =>
      project.id.startsWith("test-list-")
    );

    expect(listedProjects.map((project) => project.name)).toEqual([
      "Active Project",
      "Archived Project"
    ]);
    expect(listedProjects.map((project) => project.status)).toEqual([
      ProjectStatus.ACTIVE,
      ProjectStatus.ARCHIVED
    ]);
  });

  it("excludes projects that belong to other organizations", async () => {
    await db.insert(organizations).values({
      id: fixture.otherOrg,
      name: "Other List Org",
      slug: fixture.otherOrg
    });
    await db.insert(projects).values({
      id: "test-otherorg-project",
      name: "Other Org Project",
      status: ProjectStatus.ACTIVE,
      organizationId: fixture.otherOrg
    });

    const response = await requestProjects(fixture.user);
    const ids = response.projects.map((project) => project.id);

    expect(ids).toContain("test-list-active");
    expect(ids).not.toContain("test-otherorg-project");
  });
});

async function requestProjects(userId: string) {
  const request = new NextRequest("http://localhost/api/projects", {
    headers: {
      "x-user-id": userId
    }
  });
  const response = await GET(request);

  expect(response.status).toBe(200);

  return (await response.json()) as {
    projects: Array<{
      id: string;
      name: string;
      status: ProjectStatus;
    }>;
  };
}
