import { describe, expect, it } from "vitest";
import { getEventActionPlan, getPrimaryEventActionKey } from "./dashboardActions";

describe("dashboardActions", () => {
  it("maps status to primary action", () => {
    expect(getPrimaryEventActionKey("upcoming")).toBe("settings");
    expect(getPrimaryEventActionKey("live")).toBe("scores");
    expect(getPrimaryEventActionKey("completed")).toBe("ranking");
    expect(getPrimaryEventActionKey("invalid")).toBe("settings");
  });

  it("keeps climbers action for non-completed events", () => {
    const plan = getEventActionPlan({ status: "live", isCompleted: false });
    expect(plan.primary).toBe("scores");
    expect(plan.secondary).toEqual(["settings", "climbers", "ranking"]);
  });

  it("hides scores action outside live events", () => {
    const upcomingPlan = getEventActionPlan({ status: "upcoming", isCompleted: false });
    expect(upcomingPlan.primary).toBe("settings");
    expect(upcomingPlan.secondary).toEqual(["climbers", "ranking"]);
  });

  it("removes climbers and scores actions for completed events", () => {
    const plan = getEventActionPlan({ status: "completed", isCompleted: true });
    expect(plan.primary).toBe("ranking");
    expect(plan.secondary).toEqual(["settings"]);
  });
});
