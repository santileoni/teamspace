import { BillingPlan } from "@/db/schema";

export const PLAN_LIMITS = {
  FREE: { maxActiveProjects: 3 },
  PRO: { maxActiveProjects: null }
} as const;

export function getProjectLimit(plan: BillingPlan): number | null {
  return PLAN_LIMITS[plan].maxActiveProjects;
}

export function isAtProjectLimit(plan: BillingPlan, activeCount: number): boolean {
  const limit = getProjectLimit(plan);

  if (limit === null) {
    return false;
  }

  return activeCount >= limit;
}
