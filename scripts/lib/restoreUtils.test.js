import { describe, expect, it } from "vitest";
import {
  createRestoreLogEntry,
  formatTimestamp,
  normalizeGymIds,
  readArgValue,
  readList,
} from "./restoreUtils.js";

describe("restoreUtils", () => {
  it("reads arg values from '--flag value' and '--flag=value'", () => {
    expect(readArgValue(["node", "x", "--file", "backups/demo.json"], "--file")).toBe(
      "backups/demo.json"
    );
    expect(readArgValue(["node", "x", "--file=backups/demo.json"], "--file")).toBe(
      "backups/demo.json"
    );
    expect(readArgValue(["node", "x"], "--file")).toBe("");
  });

  it("reads comma-separated list args", () => {
    expect(readList(["node", "x", "--scope-events", "event-a,event-b"], "--scope-events")).toEqual(
      ["event-a", "event-b"]
    );
    expect(readList(["node", "x", "--scope-events=event-a, event-b"], "--scope-events")).toEqual(
      ["event-a", "event-b"]
    );
  });

  it("normalizes gymIds from profile", () => {
    expect(normalizeGymIds(["*", "", "gym-a", null])).toEqual(["*", "gym-a"]);
    expect(normalizeGymIds(undefined)).toEqual([]);
  });

  it("formats restore log timestamp", () => {
    expect(formatTimestamp("2026-03-23T12:34:56.000Z")).toMatch(/^\d{8}-\d{6}$/);
  });

  it("creates restore log payload for dry-run", () => {
    const entry = createRestoreLogEntry({
      mode: "dry-run",
      startedAt: "2026-03-23T10:00:00.000Z",
      completedAt: "2026-03-23T10:00:03.000Z",
      actor: "vestige_sync@me.com",
      sourceFile: "C:/code/FlashComp/backups/demo.json",
      includeSystem: false,
      hasAllGymAccess: true,
      sourceProject: "flashcomp-demo",
      environment: "demo",
      requestedScope: { events: ["event-a"], gyms: ["gym-a"] },
      targetDocs: 10,
      sourceDocs: 20,
      skipped: {
        byPermissionScope: 2,
        bySystemFlag: 3,
        byFilter: 4,
        byUnknownTopLevel: 1,
      },
      restoredCount: 0,
      restoredEvents: ["event-a"],
      restoredGyms: ["gym-a"],
    });

    expect(entry.mode).toBe("dry-run");
    expect(entry.requestedScope.events).toEqual(["event-a"]);
    expect(entry.requestedScope.gyms).toEqual(["gym-a"]);
    expect(entry.restoredCount).toBe(0);
    expect(entry.sourceDocs).toBe(20);
    expect(entry.targetDocs).toBe(10);
  });
});
