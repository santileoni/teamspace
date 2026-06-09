import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { InvalidProjectInputError } from "@/lib/projects";
import { createTaskForUser, updateTaskStatusForUser } from "@/lib/tasks";

export async function POST(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const body = await readJsonBody(request);
    const task = await createTaskForUser(userId, body);

    return NextResponse.json(
      {
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          projectId: task.projectId
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
        error: error instanceof Error ? error.message : "Unable to create task"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const body = await readJsonBody(request);
    const task = await updateTaskStatusForUser(userId, body);

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        projectId: task.projectId
      }
    });
  } catch (error) {
    if (error instanceof InvalidProjectInputError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update task"
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
