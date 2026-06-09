import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { DELETE, PATCH, POST } from "@/app/api/projects/route";
import { closeDb, db } from "@/db/client";
import {
  BillingPlan,
  organizations,
  ProjectStatus,
  projects,
  tasks,
  TaskStatus,
  UserRole,
  users
} from "@/db/schema";

const fixture = {
  org: "test-create-org",
  user: "test-create-user"
};

async function resetFixture() {
  await cleanupFixture();

  await db.insert(organizations).values({
    id: fixture.org,
    name: "Create Test Org",
    slug: "test-create-org",
    plan: BillingPlan.FREE
  });

  await db.insert(users).values({
    id: fixture.user,
    email: "creator@test.example",
    name: "Creator",
    role: UserRole.ADMIN,
    organizationId: fixture.org
  });

  await db.insert(projects).values([
    {
      id: "test-create-existing-1",
      name: "Existing One",
      status: ProjectStatus.ACTIVE,
      organizationId: fixture.org
    },
    {
      id: "test-create-existing-2",
      name: "Existing Two",
      status: ProjectStatus.ACTIVE,
      organizationId: fixture.org
    },
    {
      id: "test-create-existing-3",
      name: "Existing Three",
      status: ProjectStatus.ARCHIVED,
      organizationId: fixture.org
    },
    {
      id: "test-create-archived",
      name: "Archived Project",
      status: ProjectStatus.ARCHIVED,
      organizationId: fixture.org
    }
  ]);
}

async function cleanupFixture() {
  await db.delete(projects).where(eq(projects.organizationId, fixture.org));

  await db.delete(users).where(eq(users.organizationId, fixture.org));

  await db.delete(organizations).where(eq(organizations.id, fixture.org));
}

describe("project creation", () => {
  beforeEach(async () => {
    await resetFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
    await closeDb();
  });

  it("creates projects in the selected user's organization", async () => {
    const response = await requestCreateProject(fixture.user, {
      name: "  New Launch  ",
      status: ProjectStatus.ACTIVE
    });
    const body = (await response.json()) as {
      project: {
        name: string;
        status: ProjectStatus;
        organizationId: string;
      };
    };

    expect(response.status).toBe(201);
    expect(body.project.name).toBe("New Launch");
    expect(body.project.status).toBe(ProjectStatus.ACTIVE);
    expect(body.project.organizationId).toBe(fixture.org);
  });

  it("blocks free workspaces from creating more than 3 active projects", async () => {
    await insertActiveProject("test-create-existing-extra", "Existing Extra");

    const response = await requestCreateProject(fixture.user, {
      name: "One Too Many"
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toContain("Free plan is limited to 3 active projects");
  });

  it("rejects empty project names", async () => {
    const response = await requestCreateProject(fixture.user, {
      name: "   "
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Project name is required.");
  });

  it("always creates active projects", async () => {
    const response = await requestCreateProject(fixture.user, {
      name: "Should Start Active",
      status: ProjectStatus.ARCHIVED
    });
    const body = (await response.json()) as {
      project: {
        name: string;
        status: ProjectStatus;
      };
    };

    expect(response.status).toBe(201);
    expect(body.project.name).toBe("Should Start Active");
    expect(body.project.status).toBe(ProjectStatus.ACTIVE);
  });

  it("updates project status after creation", async () => {
    const response = await requestUpdateProjectStatus(fixture.user, {
      projectId: "test-create-existing-1",
      status: ProjectStatus.ARCHIVED
    });
    const body = (await response.json()) as {
      project: {
        status: ProjectStatus;
      };
    };

    expect(response.status).toBe(200);
    expect(body.project.status).toBe(ProjectStatus.ARCHIVED);
  });

  it("requires an available project slot to restore archived free projects", async () => {
    await insertActiveProject("test-create-existing-extra", "Existing Extra");

    const blockedResponse = await requestUpdateProjectStatus(fixture.user, {
      projectId: "test-create-archived",
      status: ProjectStatus.ACTIVE
    });
    const blockedBody = (await blockedResponse.json()) as { error: string };

    expect(blockedResponse.status).toBe(403);
    expect(blockedBody.error).toContain("Free plan is limited to 3 active projects");

    await requestUpdateProjectStatus(fixture.user, {
      projectId: "test-create-existing-1",
      status: ProjectStatus.ARCHIVED
    });

    const restoredResponse = await requestUpdateProjectStatus(fixture.user, {
      projectId: "test-create-archived",
      status: ProjectStatus.ACTIVE
    });
    const restoredBody = (await restoredResponse.json()) as {
      project: {
        status: ProjectStatus;
      };
    };

    expect(restoredResponse.status).toBe(200);
    expect(restoredBody.project.status).toBe(ProjectStatus.ACTIVE);
  });

  it("permanently deletes projects owned by the selected user's organization", async () => {
    await db.insert(tasks).values({
      id: "test-create-delete-task",
      title: "Delete me too",
      status: TaskStatus.TODO,
      projectId: "test-create-existing-1"
    });

    const response = await requestDeleteProject(fixture.user, {
      projectId: "test-create-existing-1"
    });
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, "test-create-existing-1")
    });
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, "test-create-delete-task")
    });

    expect(response.status).toBe(200);
    expect(project).toBeUndefined();
    expect(task).toBeUndefined();
  });
});

async function insertActiveProject(id: string, name: string) {
  await db.insert(projects).values({
    id,
    name,
    status: ProjectStatus.ACTIVE,
    organizationId: fixture.org
  });
}

function requestCreateProject(userId: string, body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(body)
    })
  );
}

function requestUpdateProjectStatus(userId: string, body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/projects", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(body)
    })
  );
}

function requestDeleteProject(userId: string, body: Record<string, unknown>) {
  return DELETE(
    new NextRequest("http://localhost/api/projects", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(body)
    })
  );
}
