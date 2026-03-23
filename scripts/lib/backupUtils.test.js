import { describe, expect, it } from "vitest";
import {
  createBackupPayload,
  formatFileTimestamp,
  normalizeEnvironmentTag,
  normalizeGymIds,
  readArgValue,
} from "./backupUtils.js";

describe("backupUtils", () => {
  it("normalizes gymIds as non-empty string list", () => {
    expect(normalizeGymIds(["gym-a", "", "   ", "gym-b", 10, null])).toEqual(["gym-a", "gym-b"]);
    expect(normalizeGymIds(null)).toEqual([]);
  });

  it("reads CLI arg values from both '--flag value' and '--flag=value'", () => {
    expect(readArgValue(["node", "x", "--env", "demo"], "--env")).toBe("demo");
    expect(readArgValue(["node", "x", "--env=demo"], "--env")).toBe("demo");
    expect(readArgValue(["node", "x"], "--env")).toBe("");
  });

  it("normalizes environment tags", () => {
    expect(normalizeEnvironmentTag("production")).toBe("prod");
    expect(normalizeEnvironmentTag("demo")).toBe("demo");
    expect(normalizeEnvironmentTag("")).toBe("manual");
    expect(normalizeEnvironmentTag("Staging!")).toBe("env-staging-");
  });

  it("formats backup timestamp for filenames", () => {
    expect(formatFileTimestamp(new Date("2026-03-23T12:34:56Z"))).toMatch(/^\d{8}-\d{6}$/);
  });

  it("builds payload manifest and collection counts", () => {
    const payload = createBackupPayload({
      exportedAt: "2026-03-23T00:00:00.000Z",
      sourceUser: "vestige_sync@me.com",
      sourceProject: "flashcomp-demo",
      includeSystem: true,
      environment: "demo",
      eventCount: 2,
      docs: [
        { path: "events/event-a", data: { name: "A" } },
        { path: "events/event-a/categories/cat-1", data: { name: "Cat 1" } },
        { path: "gyms/gym-a", data: { name: "Gym A" } },
      ],
    });

    expect(payload.docCount).toBe(3);
    expect(payload.collectionCounts).toEqual({
      events: 2,
      gyms: 1,
    });
    expect(payload.eventCount).toBe(2);
    expect(payload.environment).toBe("demo");
  });
});
