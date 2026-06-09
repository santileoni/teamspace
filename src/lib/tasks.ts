import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ProjectStatus,
  projects,
  tasks,
  TaskStatus
} from "@/db/schema";
import { requireCurrentUser } from "@/lib/current-user";
import { InvalidProjectInputError } from "@/lib/projects";

const taskStatuses = new Set<string>(Object.values(TaskStatus));

type CreateTaskInput = {
  projectId?: unknown;
  title?: unknown;
};

export async function createTaskForUser(userId: string, input: CreateTaskInput) {
  const currentUser = await requireCurrentUser(userId);
  const projectId = parseProjectId(input.projectId);
  const title = parseTaskTitle(input.title);
  const project = await db.query.projects.findFirst({
    columns: {
      id: true
    },
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, currentUser.organizationId),
      isNull(projects.deletedAt),
      ne(projects.status, ProjectStatus.ARCHIVED)
    )
  });

  if (!project) {
    throw new InvalidProjectInputError("Project not found.", 404);
  }

  const [task] = await db
    .insert(tasks)
    .values({
      id: createId("task"),
      projectId: project.id,
      title,
      status: TaskStatus.TODO,
      updatedAt: new Date()
    })
    .returning();

  return task;
}

type UpdateTaskStatusInput = {
  taskId?: unknown;
  status?: unknown;
};

export async function updateTaskStatusForUser(
  userId: string,
  input: UpdateTaskStatusInput
) {
  const currentUser = await requireCurrentUser(userId);
  const taskId = parseTaskId(input.taskId);
  const status = parseTaskStatus(input.status);
  const [task] = await db
    .select({
      id: tasks.id
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.id, taskId),
        isNull(tasks.deletedAt),
        eq(projects.organizationId, currentUser.organizationId),
        isNull(projects.deletedAt),
        ne(projects.status, ProjectStatus.ARCHIVED)
      )
    )
    .limit(1);

  if (!task) {
    throw new InvalidProjectInputError("Task not found.", 404);
  }

  const [updatedTask] = await db
    .update(tasks)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(eq(tasks.id, task.id))
    .returning();

  return updatedTask;
}

function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function parseProjectId(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidProjectInputError("Project id is required.");
  }

  return value.trim();
}

function parseTaskTitle(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidProjectInputError("Task title is required.");
  }

  const title = value.trim();

  if (title.length > 120) {
    throw new InvalidProjectInputError("Task title must be 120 characters or fewer.");
  }

  return title;
}

function parseTaskId(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidProjectInputError("Task id is required.");
  }

  return value.trim();
}

function parseTaskStatus(value: unknown) {
  if (typeof value !== "string" || !taskStatuses.has(value)) {
    throw new InvalidProjectInputError("Task status is invalid.");
  }

  return value as TaskStatus;
}
