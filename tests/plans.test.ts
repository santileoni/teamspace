import { describe, expect, it } from "vitest";
import { BillingPlan } from "@/db/schema";
import { getProjectLimit, isAtProjectLimit } from "@/lib/plans";

describe("plan limits", () => {
  it("caps FREE at 3 active projects", () => {
    expect(getProjectLimit(BillingPlan.FREE)).toBe(3);
  });

  it("treats PRO as unlimited", () => {
    expect(getProjectLimit(BillingPlan.PRO)).toBeNull();
  });

  it("flags FREE as at-limit only when active count reaches the cap", () => {
    expect(isAtProjectLimit(BillingPlan.FREE, 2)).toBe(false);
    expect(isAtProjectLimit(BillingPlan.FREE, 3)).toBe(true);
    expect(isAtProjectLimit(BillingPlan.FREE, 4)).toBe(true);
  });

  it("never flags PRO as at-limit", () => {
    expect(isAtProjectLimit(BillingPlan.PRO, 999)).toBe(false);
  });
});
