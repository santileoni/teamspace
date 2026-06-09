import { randomUUID } from "node:crypto";
import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { BillingPlan, ProjectStatus, projects, tasks } from "@/db/schema";
import { requireCurrentUser } from "@/lib/current-user";
import { getProjectLimit, isAtProjectLimit } from "@/lib/plans";

const projectStatuses = new Set<string>(Object.values(ProjectStatus));

export class InvalidProjectInputError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
  }
}

export async function listProjectsForUser(userId: string) {
  await requireCurrentUser(userId);

  return db.query.projects.findMany({
    where: isNull(projects.deletedAt),
    with: {
      organization: true,
      tasks: {
        where: isNull(tasks.deletedAt),
        orderBy: asc(tasks.title)
      }
    },
    orderBy: asc(projects.name)
  });
}

export async function getPlanUsageForUser(userId: string) {
  const currentUser = await requireCurrentUser(userId);
  const plan = currentUser.organization.plan;
  const activeProjects = await countActiveProjects(currentUser.organizationId);

  return {
    plan,
    activeProjects,
    limit: getProjectLimit(plan),
    atLimit: isAtProjectLimit(plan, activeProjects)
  };
}

type CreateProjectInput = {
  name?: unknown;
};

export async function createProjectForUser(userId: string, input: CreateProjectInput) {
  const currentUser = await requireCurrentUser(userId);
  const name = parseProjectName(input.name);

  await ensureProjectSlotAvailable(currentUser.organizationId, currentUser.organization.plan);

  const id = createId("project");

  await db.insert(projects).values({
    id,
    name,
    status: ProjectStatus.ACTIVE,
    organizationId: currentUser.organizationId,
    updatedAt: new Date()
  });

  return getProjectWithRelations(id);
}

type UpdateProjectStatusInput = {
  projectId?: unknown;
  status?: unknown;
};

export async function updateProjectStatusForUser(
  userId: string,
  input: UpdateProjectStatusInput
) {
  const currentUser = await requireCurrentUser(userId);
  const projectId = parseProjectId(input.projectId);
  const status = parseProjectStatus(input.status);
  const project = await db.query.projects.findFirst({
    columns: {
      id: true,
      status: true
    },
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, currentUser.organizationId),
      isNull(projects.deletedAt)
    )
  });

  if (!project) {
    throw new InvalidProjectInputError("Project not found.", 404);
  }

  if (project.status === ProjectStatus.ARCHIVED && status !== ProjectStatus.ARCHIVED) {
    await ensureProjectSlotAvailable(currentUser.organizationId, currentUser.organization.plan);
  }

  await db
    .update(projects)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(eq(projects.id, project.id));

  return getProjectWithRelations(project.id);
}

type DeleteProjectInput = {
  projectId?: unknown;
};

export async function deleteProjectForUser(userId: string, input: DeleteProjectInput) {
  const currentUser = await requireCurrentUser(userId);
  const projectId = parseProjectId(input.projectId);
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.organizationId, currentUser.organizationId)),
    with: {
      organization: true,
      tasks: {
        where: isNull(tasks.deletedAt),
        orderBy: asc(tasks.title)
      }
    }
  });

  if (!project) {
    throw new InvalidProjectInputError("Project not found.", 404);
  }

  await db.delete(projects).where(eq(projects.id, project.id));

  return project;
}

async function getProjectWithRelations(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      organization: true,
      tasks: {
        where: isNull(tasks.deletedAt),
        orderBy: asc(tasks.title)
      }
    }
  });

  if (!project) {
    throw new InvalidProjectInputError("Project not found.", 404);
  }

  return project;
}

async function countActiveProjects(organizationId: string): Promise<number> {
  const [result] = await db
    .select({
      value: count()
    })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organizationId),
        isNull(projects.deletedAt),
        ne(projects.status, ProjectStatus.ARCHIVED)
      )
    );

  return result?.value ?? 0;
}

async function ensureProjectSlotAvailable(organizationId: string, plan: BillingPlan) {
  const limit = getProjectLimit(plan);

  if (limit === null) {
    return;
  }

  const activeProjects = await countActiveProjects(organizationId);

  if (isAtProjectLimit(plan, activeProjects)) {
    throw new InvalidProjectInputError(
      `Free plan is limited to ${limit} active projects. Archive or delete a project, or upgrade to PRO.`,
      403
    );
  }
}

function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function parseProjectName(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidProjectInputError("Project name is required.");
  }

  const name = value.trim();

  if (name.length > 80) {
    throw new InvalidProjectInputError("Project name must be 80 characters or fewer.");
  }

  return name;
}

function parseProjectId(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidProjectInputError("Project id is required.");
  }

  return value.trim();
}

function parseProjectStatus(value: unknown) {
  if (typeof value !== "string" || !projectStatuses.has(value)) {
    throw new InvalidProjectInputError("Project status is invalid.");
  }

  return value as ProjectStatus;
}
