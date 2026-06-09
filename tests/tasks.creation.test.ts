import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { PATCH, POST } from "@/app/api/tasks/route";
import { closeDb, db } from "@/db/client";
import {
  organizations,
  ProjectStatus,
  projects,
  tasks,
  TaskStatus,
  UserRole,
  users
} from "@/db/schema";

const fixture = {
  orgA: "test-task-org-a",
  orgB: "test-task-org-b",
  userA: "test-task-user-a",
  userB: "test-task-user-b",
  projectA: "test-task-project-a",
  projectAArchived: "test-task-project-a-archived",
  projectB: "test-task-project-b",
  taskA: "test-task-a",
  taskArchived: "test-task-archived",
  taskB: "test-task-b"
};

async function resetFixture() {
  await cleanupFixture();

  await db.insert(organizations).values([
    {
      id: fixture.orgA,
      name: "Task Org A",
      slug: "test-task-org-a"
    },
    {
      id: fixture.orgB,
      name: "Task Org B",
      slug: "test-task-org-b"
    }
  ]);

  await db.insert(users).values([
    {
      id: fixture.userA,
      email: "task-user-a@test.example",
      name: "Task User A",
      role: UserRole.ADMIN,
      organizationId: fixture.orgA
    },
    {
      id: fixture.userB,
      email: "task-user-b@test.example",
      name: "Task User B",
      role: UserRole.MEMBER,
      organizationId: fixture.orgB
    }
  ]);

  await db.insert(projects).values([
    {
      id: fixture.projectA,
      name: "Task Project A",
      status: ProjectStatus.ACTIVE,
      organizationId: fixture.orgA
    },
    {
      id: fixture.projectAArchived,
      name: "Task Project A Archived",
      status: ProjectStatus.ARCHIVED,
      organizationId: fixture.orgA
    },
    {
      id: fixture.projectB,
      name: "Task Project B",
      status: ProjectStatus.ACTIVE,
      organizationId: fixture.orgB
    }
  ]);

  await db.insert(tasks).values([
    {
      id: fixture.taskA,
      title: "Task A",
      status: TaskStatus.TODO,
      projectId: fixture.projectA
    },
    {
      id: fixture.taskArchived,
      title: "Archived Task",
      status: TaskStatus.TODO,
      projectId: fixture.projectAArchived
    },
    {
      id: fixture.taskB,
      title: "Task B",
      status: TaskStatus.TODO,
      projectId: fixture.projectB
    }
  ]);
}

async function cleanupFixture() {
  await db
    .delete(tasks)
    .where(inArray(tasks.projectId, [fixture.projectA, fixture.projectAArchived, fixture.projectB]));

  await db
    .delete(projects)
    .where(inArray(projects.id, [fixture.projectA, fixture.projectAArchived, fixture.projectB]));

  await db.delete(users).where(inArray(users.id, [fixture.userA, fixture.userB]));

  await db.delete(organizations).where(inArray(organizations.id, [fixture.orgA, fixture.orgB]));
}

describe("task creation", () => {
  beforeEach(async () => {
    await resetFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
    await closeDb();
  });

  it("creates todo tasks in projects owned by the selected user's organization", async () => {
    const response = await requestCreateTask(fixture.userA, {
      projectId: fixture.projectA,
      title: "  Follow up with sales  "
    });
    const body = (await response.json()) as {
      task: {
        projectId: string;
        status: TaskStatus;
        title: string;
      };
    };

    expect(response.status).toBe(201);
    expect(body.task.projectId).toBe(fixture.projectA);
    expect(body.task.status).toBe(TaskStatus.TODO);
    expect(body.task.title).toBe("Follow up with sales");
  });

  it("rejects empty task titles", async () => {
    const response = await requestCreateTask(fixture.userA, {
      projectId: fixture.projectA,
      title: " "
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Task title is required.");
  });

  it("does not create tasks in another organization's project", async () => {
    const response = await requestCreateTask(fixture.userA, {
      projectId: fixture.projectB,
      title: "Cross org task"
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Project not found.");
  });

  it("does not create tasks in archived projects", async () => {
    const response = await requestCreateTask(fixture.userA, {
      projectId: fixture.projectAArchived,
      title: "Archived task"
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Project not found.");
  });

  it("updates task status in projects owned by the selected user's organization", async () => {
    const response = await requestUpdateTask(fixture.userA, {
      taskId: fixture.taskA,
      status: TaskStatus.IN_PROGRESS
    });
    const body = (await response.json()) as {
      task: {
        id: string;
        status: TaskStatus;
      };
    };

    expect(response.status).toBe(200);
    expect(body.task.id).toBe(fixture.taskA);
    expect(body.task.status).toBe(TaskStatus.IN_PROGRESS);
  });

  it("does not update tasks in another organization's project", async () => {
    const response = await requestUpdateTask(fixture.userA, {
      taskId: fixture.taskB,
      status: TaskStatus.DONE
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Task not found.");
  });

  it("does not update tasks in archived projects", async () => {
    const response = await requestUpdateTask(fixture.userA, {
      taskId: fixture.taskArchived,
      status: TaskStatus.DONE
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Task not found.");
  });
});

function requestCreateTask(userId: string, body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(body)
    })
  );
}

function requestUpdateTask(userId: string, body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/tasks", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(body)
    })
  );
}
