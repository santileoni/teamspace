import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { BillingPlan, organizations, UserRole } from "@/db/schema";
import { requireCurrentUser } from "@/lib/current-user";
import { InvalidProjectInputError } from "@/lib/projects";

export async function upgradeOrganizationPlan(userId: string, targetPlan: unknown) {
  const currentUser = await requireCurrentUser(userId);

  if (currentUser.role !== UserRole.ADMIN) {
    throw new InvalidProjectInputError("Only an admin can change the workspace plan.", 403);
  }

  if (targetPlan !== BillingPlan.PRO) {
    throw new InvalidProjectInputError("Unsupported plan.", 400);
  }

  await db
    .update(organizations)
    .set({ plan: BillingPlan.PRO, updatedAt: new Date() })
    .where(eq(organizations.id, currentUser.organizationId));

  return {
    id: currentUser.organization.id,
    name: currentUser.organization.name,
    plan: BillingPlan.PRO
  };
}
