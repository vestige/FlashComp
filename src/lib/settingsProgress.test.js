import { describe, expect, it } from "vitest";
import { buildSettingsProgress } from "./settingsProgress";

describe("buildSettingsProgress", () => {
  it("returns full completion when all settings exist", () => {
    const result = buildSettingsProgress({ seasonCount: 3, categoryCount: 4, taskCount: 36 });
    expect(result.completed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.percent).toBe(100);
    expect(result.steps.map((s) => s.status)).toEqual(["done", "done", "done"]);
  });

  it("blocks categories/tasks when seasons are missing", () => {
    const result = buildSettingsProgress({ seasonCount: 0, categoryCount: 0, taskCount: 0 });
    expect(result.completed).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.steps.find((s) => s.key === "seasons")?.status).toBe("todo");
    expect(result.steps.find((s) => s.key === "categories")?.status).toBe("blocked");
    expect(result.steps.find((s) => s.key === "tasks")?.status).toBe("blocked");
  });

  it("shows tasks as todo when seasons/categories exist but tasks are missing", () => {
    const result = buildSettingsProgress({ seasonCount: 2, categoryCount: 2, taskCount: 0 });
    expect(result.completed).toBe(2);
    expect(result.percent).toBe(67);
    expect(result.steps.find((s) => s.key === "tasks")?.status).toBe("todo");
  });
});
