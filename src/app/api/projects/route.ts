import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import {
  createProjectForUser,
  deleteProjectForUser,
  getPlanUsageForUser,
  InvalidProjectInputError,
  listProjectsForUser,
  updateProjectStatusForUser
} from "@/lib/projects";

export async function GET(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const [projects, usage] = await Promise.all([
      listProjectsForUser(userId),
      getPlanUsageForUser(userId)
    ]);

    return NextResponse.json({
      userId,
      usage,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        organizationId: project.organizationId,
        organizationName: project.organization.name,
        tasks: project.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status
        }))
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load projects"
      },
      { status: 404 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const body = await readJsonBody(request);
    const project = await createProjectForUser(userId, body);

    return NextResponse.json(
      {
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          organizationId: project.organizationId,
          organizationName: project.organization.name,
          tasks: project.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status
          }))
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof InvalidProjectInputError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create project"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const body = await readJsonBody(request);
    const project = await updateProjectStatusForUser(userId, body);

    return NextResponse.json({
      project: serializeProject(project)
    });
  } catch (error) {
    if (error instanceof InvalidProjectInputError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update project"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const body = await readJsonBody(request);
    const project = await deleteProjectForUser(userId, body);

    return NextResponse.json({
      project: serializeProject(project)
    });
  } catch (error) {
    if (error instanceof InvalidProjectInputError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete project"
      },
      { status: 500 }
    );
  }
}

function getRequestUserId(request: NextRequest) {
  return (
    request.headers.get("x-user-id") ??
    request.nextUrl.searchParams.get("userId") ??
    DEFAULT_USER_ID
  );
}

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new InvalidProjectInputError("Request body must be valid JSON.");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new InvalidProjectInputError("Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}

function serializeProject(project: Awaited<ReturnType<typeof createProjectForUser>>) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    organizationId: project.organizationId,
    organizationName: project.organization.name,
    tasks: project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status
    }))
  };
}
