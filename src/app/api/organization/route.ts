import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { upgradeOrganizationPlan } from "@/lib/organization";
import { InvalidProjectInputError } from "@/lib/projects";

export async function PATCH(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const body = await readJsonBody(request);
    const organization = await upgradeOrganizationPlan(userId, body.plan);

    return NextResponse.json({ organization });
  } catch (error) {
    if (error instanceof InvalidProjectInputError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update plan"
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
